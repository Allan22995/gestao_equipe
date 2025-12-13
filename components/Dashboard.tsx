import React, { useEffect, useState, useMemo } from 'react';
import { Collaborator, EventRecord, OnCallRecord, Schedule, SystemSettings, VacationRequest, UserProfile } from '../types';
import { weekDayMap, getWeekOfMonth, checkRotationDay } from '../utils/helpers';
import { Modal } from './ui/Modal';
import { MultiSelect } from './ui/MultiSelect';

interface DashboardProps {
  collaborators: Collaborator[];
  events: EventRecord[];
  onCalls: OnCallRecord[];
  vacationRequests: VacationRequest[];
  settings: SystemSettings;
  currentUserProfile: UserProfile;
  currentUserAllowedSectors: string[];
  canViewPhones: boolean; // Permissão ACL
  availableBranches: string[]; // Lista de filiais permitidas
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  collaborators, events, onCalls, vacationRequests, settings, currentUserProfile,
  currentUserAllowedSectors, canViewPhones, availableBranches
}) => {
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [details, setDetails] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [selectedColab, setSelectedColab] = useState<any | null>(null);
  
  // Daily Summary State
  const [showSummary, setShowSummary] = useState(false);

  // Filters (Multi-Select)
  const [filterName, setFilterName] = useState('');
  const [filterBranches, setFilterBranches] = useState<string[]>([]);
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterSectors, setFilterSectors] = useState<string[]>([]);

  // Card Selection Filter State
  const [activeStatFilter, setActiveStatFilter] = useState<'total' | 'active' | 'inactive'>('total');

  // Filtrar colaboradores ativos primeiro (Legacy undefined = true)
  const activeCollaborators = useMemo(() => {
     return collaborators.filter(c => c.active !== false);
  }, [collaborators]);

  // Force Sector Filter if Restricted (single sector)
  useEffect(() => {
    if (currentUserAllowedSectors.length === 1) {
      setFilterSectors([currentUserAllowedSectors[0]]);
    }
  }, [currentUserAllowedSectors]);

  // Force Branch Filter if Restricted (single branch)
  useEffect(() => {
    if (availableBranches.length === 1) {
      setFilterBranches([availableBranches[0]]);
    }
  }, [availableBranches]);

  // Available sectors for filter dropdown (Dynamic based on branch)
  const availableSectors = useMemo(() => {
    if (!settings) return [];
    
    // Determine the source of sectors
    let sectorsPool: string[] = [];

    if (filterBranches.length > 0) {
        filterBranches.forEach(branch => {
            const branchSectors: string[] = settings.branchSectors?.[branch] || [];
            sectorsPool = [...sectorsPool, ...branchSectors];
        });
    } else {
        if (availableBranches.length > 0) {
             availableBranches.forEach(branch => {
                const branchSectors: string[] = settings.branchSectors?.[branch] || [];
                sectorsPool = [...sectorsPool, ...branchSectors];
             });
        } else {
             if (settings.branchSectors) {
                Object.values(settings.branchSectors).forEach((s: string[]) => sectorsPool = [...sectorsPool, ...s]);
             } else {
                sectorsPool = settings.sectors || [];
             }
        }
    }
    
    sectorsPool = Array.from(new Set(sectorsPool));

    if (currentUserAllowedSectors.length > 0) {
        return sectorsPool.filter(s => currentUserAllowedSectors.includes(s));
    }
    
    return sectorsPool.sort();
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

  // --- Lógica de Funções Dinâmicas ---
  const availableRoles = useMemo(() => {
    let filtered = activeCollaborators;

    if (currentUserAllowedSectors.length > 0) {
      filtered = filtered.filter(c => c.sector && currentUserAllowedSectors.includes(c.sector));
    }
    
    // Filtra colaboradores pela filial permitida ou selecionada
    if (filterBranches.length > 0) {
        filtered = filtered.filter(c => filterBranches.includes(c.branch));
    } else if (availableBranches.length > 0) {
        filtered = filtered.filter(c => availableBranches.includes(c.branch));
    }

    if (filterSectors.length > 0) {
      filtered = filtered.filter(c => c.sector && filterSectors.includes(c.sector));
    }

    if (filterBranches.length > 0 || filterSectors.length > 0 || availableBranches.length > 0) {
       const rolesInUse = new Set(filtered.map(c => c.role));
       return Array.from(rolesInUse).sort();
    }

    return settings.roles.map(r => r.name).sort();
  }, [activeCollaborators, filterBranches, filterSectors, currentUserAllowedSectors, settings.roles, availableBranches]);

  useEffect(() => {
     if (filterRoles.length > 0) {
        const validRoles = filterRoles.filter(r => availableRoles.includes(r));
        if (validRoles.length !== filterRoles.length) {
           setFilterRoles(validRoles);
        }
     }
  }, [availableRoles, filterRoles]);

  const getPrevDayKey = (dayIndex: number): keyof Schedule => {
    const prevIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    return weekDayMap[prevIndex] as keyof Schedule;
  };

  const getNextDayKey = (dayIndex: number): keyof Schedule => {
    const nextIndex = dayIndex === 6 ? 0 : dayIndex + 1;
    return weekDayMap[nextIndex] as keyof Schedule;
  };

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const currentDayIndex = now.getDay();
    const currentDayKey = weekDayMap[currentDayIndex] as keyof Schedule;
    const prevDayKey = getPrevDayKey(currentDayIndex);
    const nextDayKey = getNextDayKey(currentDayIndex);

    const isSunday = currentDayIndex === 0;

    let activeCount = 0;
    let inactiveCount = 0;
    const tempDetails: any[] = [];

    const filteredCollaborators = activeCollaborators.filter(c => {
      if (currentUserAllowedSectors.length > 0) {
        if (!c.sector || !currentUserAllowedSectors.includes(c.sector)) return false;
      }

      // Branch Restriction (Available Branches)
      if (availableBranches.length > 0 && !availableBranches.includes(c.branch)) return false;

      const matchesName = filterName ? c.name.toLowerCase().includes(filterName.toLowerCase()) : true;
      const matchesBranch = filterBranches.length > 0 ? filterBranches.includes(c.branch) : true;
      const matchesRole = filterRoles.length > 0 ? filterRoles.includes(c.role) : true;
      const matchesSector = filterSectors.length > 0 ? (c.sector && filterSectors.includes(c.sector)) : true;

      return matchesName && matchesBranch && matchesRole && matchesSector;
    });

    // Helper para verificar horário
    const isTimeInRange = (startStr: string, endStr: string, startsPreviousDay: boolean, context: 'today' | 'yesterday' | 'tomorrow') => {
        if (!startStr || !endStr) return false;

        const [sh, sm] = startStr.split(':').map(Number);
        const [eh, em] = endStr.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;

        if (context === 'yesterday') {
            if (!startsPreviousDay && startMins > endMins) return currentMinutes <= endMins; 
            return false;
        }
        if (context === 'today') {
            if (startsPreviousDay) return currentMinutes <= endMins; 
            else {
                if (startMins < endMins) return currentMinutes >= startMins && currentMinutes <= endMins; 
                else return currentMinutes >= startMins; 
            }
        }
        if (context === 'tomorrow') {
            if (startsPreviousDay) return currentMinutes >= startMins;
            return false;
        }
        return false;
    };

    const isShiftActive = (scheduleDay: any, context: 'today' | 'yesterday' | 'tomorrow', colab: Collaborator) => {
         // --- LÓGICA DE ESCALA DE REVEZAMENTO (DOMINGO) ---
         if (isSunday && context === 'today' && colab.hasRotation && colab.rotationGroup) {
             const isOff = checkRotationDay(now, colab.rotationStartDate);
             if (isOff) return false;
         }

         if (!scheduleDay.enabled) return false;
         return isTimeInRange(scheduleDay.start, scheduleDay.end, !!scheduleDay.startsPreviousDay, context);
    };

    filteredCollaborators.forEach(c => {
      const approvedVacation = vacationRequests.find(v => {
        if (v.collaboratorId !== c.id || v.status !== 'aprovado') return false;
        const start = new Date(v.startDate + 'T00:00:00');
        const end = new Date(v.endDate + 'T00:00:00');
        const check = new Date(todayStr + 'T00:00:00');
        return check >= start && check <= end;
      });

      const todayOnCall = onCalls.find(oc => {
        if (oc.collaboratorId !== c.id) return false;
        const start = new Date(oc.startDate + 'T00:00:00');
        const end = new Date(oc.endDate + 'T00:00:00');
        const check = new Date(todayStr + 'T00:00:00');

        if (check >= start && check <= end) {
           const [sh, sm] = oc.startTime.split(':').map(Number);
           const [eh, em] = oc.endTime.split(':').map(Number);
           const startMins = sh * 60 + sm;
           const endMins = eh * 60 + em;
           
           if (startMins < endMins) {
               return currentMinutes >= startMins && currentMinutes <= endMins;
           } else {
               const isStartDay = check.getTime()