import React, { useState, useMemo, useEffect } from 'react';
import { Collaborator, EventRecord, SystemSettings, Schedule, CoverageRule } from '../types';
import { getFeriados, weekDayMap, checkRotationDay } from '../utils/helpers';
import { MultiSelect } from './ui/MultiSelect';

interface SimulatorProps {
  collaborators: Collaborator[];
  events: EventRecord[]; // Historical events
  settings: SystemSettings;
  onSaveSettings: (s: SystemSettings) => void;
  currentUserAllowedSectors: string[];
  canEditRules: boolean;
  availableBranches: string[]; // Lista de filiais permitidas
}

// Temporary Event Interface for Proposal
interface ProposedEvent {
  id: string;
  collaboratorId: string;
  type: string;
  startDate: string;
  endDate: string;
}

export const Simulator: React.FC<SimulatorProps> = ({
  collaborators,
  events,
  settings,
  onSaveSettings,
  currentUserAllowedSectors,
  canEditRules,
  availableBranches
}) => {
  const [activeTab, setActiveTab] = useState<'simulation' | 'rules'>('simulation');
  
  // Simulation State
  const [simStartDate, setSimStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [simEndDate, setSimEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  
  const [filterSectors, setFilterSectors] = useState<string[]>([]); // Sector Filter (Multi)
  const [filterBranches, setFilterBranches] = useState<string[]>([]); // Branch Filter (Multi)
  const [filterRoles, setFilterRoles] = useState<string[]>([]); // Role Filter (Multi)
  const [filterScales, setFilterScales] = useState<string[]>([]); // Scale/Shift Filter (Multi)
  
  const [proposedEvents, setProposedEvents] = useState<ProposedEvent[]>([]);

  // Draft Form State
  const [draftForm, setDraftForm] = useState({
    collaboratorId: '',
    type: 'ferias', // default
    startDate: '',
    endDate: ''
  });

  // Coverage Rules State (Local until saved)
  const [localRules, setLocalRules] = useState<CoverageRule[]>(settings.coverageRules || []);
  
  // Rule Editor State
  const [selectedRuleSector, setSelectedRuleSector] = useState('');

  useEffect(() => {
      setLocalRules(settings.coverageRules || []);
  }, [settings.coverageRules]);

  // Filtrar colaboradores ativos primeiro (Legacy undefined = true)
  const activeCollaborators = useMemo(() => {
     return collaborators.filter(c => c.active !== false);
  }, [collaborators]);

  // Force Sector Filter if Restricted (single sector)
  useEffect(() => {
    if (currentUserAllowedSectors.length === 1) {
      setFilterSectors([currentUserAllowedSectors[0]]);
      setSelectedRuleSector(currentUserAllowedSectors[0]);
    }
  }, [currentUserAllowedSectors]);

  // Force Branch Filter if Restricted (single branch)
  useEffect(() => {
    if (availableBranches.length === 1) {
      setFilterBranches([availableBranches[0]]);
    }
  }, [availableBranches]);

  // Available sectors for filter dropdown (Dynamic based on branch + Global)
  const availableSectors = useMemo(() => {
    if (!settings) return [];
    
    // 1. Inicia com Setores Globais (Sempre Visíveis)
    const sectorsSet = new Set<string>(settings.sectors || []);

    // 2. Adiciona setores específicos de filiais conforme contexto
    if (settings.branchSectors) {
        let branchesToCheck: string[] = [];

        if (filterBranches.length > 0) {
            // Se tem filtro de filial, olha apenas elas
            branchesToCheck = filterBranches;
        } else if (availableBranches.length > 0) {
            // Se tem restrição de acesso (e não filtrou), olha todas as permitidas
            branchesToCheck = availableBranches;
        } else {
            // Se é admin e não filtrou, olha todas as cadastradas no settings
            branchesToCheck = settings.branches || [];
            
            // Fallback: Se settings.branches estiver vazio, pega chaves do mapa
            if (branchesToCheck.length === 0) {
                branchesToCheck = Object.keys(settings.branchSectors);
            }
        }

        branchesToCheck.forEach(branch => {
            const specific = settings.branchSectors?.[branch];
            if (specific && Array.isArray(specific)) {
                specific.forEach(s => sectorsSet.add(s));
            }
        });
    }
    
    let result = Array.from(sectorsSet);

    // 3. Filtro de Segurança (Permissão do Usuário)
    if (currentUserAllowedSectors.length > 0) {
        result = result.filter(s => currentUserAllowedSectors.includes(s));
    }
    
    return result.sort();
  }, [settings, currentUserAllowedSectors, filterBranches, availableBranches]);

  // Reset sector filter if selected sector is no longer available
  useEffect(() => {
      if (filterSectors.length > 0) {
          const validSectors = filterSectors.filter(s => availableSectors.includes(s));
          if (validSectors.length !== filterSectors.length) {
              setFilterSectors(validSectors);
          }
      }
  }, [availableSectors, filterSectors]);

  // --- Calculate Available Roles based on Sector ---
  const availableRolesOptions = useMemo(() => {
    // 1. Base list of collaborators allowed for the user
    let filteredColabs = activeCollaborators;
    if (currentUserAllowedSectors.length > 0) {
        filteredColabs = filteredColabs.filter(c => c.sector && currentUserAllowedSectors.includes(c.sector));
    }
    
    // Filter by Available Branches
    if (availableBranches.length > 0) {
        filteredColabs = filteredColabs.filter(c => availableBranches.includes(c.branch));
    }

    // 2. If sectors are selected in the simulator, filter further
    if (filterSectors.length > 0) {
        filteredColabs = filteredColabs.filter(c => c.sector && filterSectors.includes(c.sector));
        
        // Extract unique roles from these collaborators
        const uniqueRoles = new Set(filteredColabs.map(c => c.role));
        return Array.from(uniqueRoles).sort();
    } 

    // 3. If no sector selected, show all configured roles
    return settings.roles.map(r => r.name).sort();
  }, [filterSectors, activeCollaborators, settings.roles, currentUserAllowedSectors, availableBranches]);

  // --- Calculate Available Scales/Shifts based on Sector/Branch/Role filters ---
  const availableScalesOptions = useMemo(() => {
    let filteredColabs = activeCollaborators;

    // Apply Permissions
    if (currentUserAllowedSectors.length > 0) {
        filteredColabs = filteredColabs.filter(c => c.sector && currentUserAllowedSectors