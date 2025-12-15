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
  const activeCollaborators = useMemo<Collaborator[]>(() => {
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

  // Available sectors for filter dropdown (Dynamic based on selected branch)
  const availableSectors = useMemo(() => {
    if (!settings) return [];
    
    // Determine the source of sectors
    let sectorsPool: string[] = [];

    if (filterBranches.length > 0) {
        filterBranches.forEach(branch => {
            const branchSectors = settings.branchSectors?.[branch] || [];
            sectorsPool = [...sectorsPool, ...branchSectors];
        });
    } else {
        if (availableBranches.length > 0) {
             availableBranches.forEach(branch => {
                const branchSectors = settings.branchSectors?.[branch] || [];
                sectorsPool = [...sectorsPool, ...branchSectors];
             });
        } else {
             if (settings.branchSectors) {
                Object.values(settings.branchSectors).forEach(s => sectorsPool = [...sectorsPool, ...(s as string[])]);
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
        filteredColabs = filteredColabs.filter(c => c.sector && currentUserAllowedSectors.includes(c.sector));
    }
    if (availableBranches.length > 0) {
        filteredColabs = filteredColabs.filter(c => availableBranches.includes(c.branch));
    }

    // Apply UI Filters
    if (filterBranches.length > 0) {
        filteredColabs = filteredColabs.filter(c => filterBranches.includes(c.branch));
    }
    if (filterSectors.length > 0) {
        filteredColabs = filteredColabs.filter(c => c.sector && filterSectors.includes(c.sector));
    }
    if (filterRoles.length > 0) {
        filteredColabs = filteredColabs.filter(c => filterRoles.includes(c.role));
    }

    const options = new Set<string>();
    filteredColabs.forEach(c => {
        if (c.shiftType) options.add(c.shiftType);
        if (c.hasRotation && c.rotationGroup) options.add(`Escala ${c.rotationGroup}`);
    });

    return Array.from(options).sort();
  }, [activeCollaborators, currentUserAllowedSectors, availableBranches, filterBranches, filterSectors, filterRoles]);


  // --- Reset filterRoles if they are not valid for the new sector ---
  useEffect(() => {
     if (filterRoles.length > 0) {
        // Keep only roles that are still available in the new list
        const validRoles = filterRoles.filter(r => availableRolesOptions.includes(r));
        // If the selection changed (some were invalid), update state
        if (validRoles.length !== filterRoles.length) {
           setFilterRoles(validRoles);
        }
     }
  }, [filterSectors, availableRolesOptions, filterRoles]);

  // --- Reset filterScales if options change ---
  useEffect(() => {
      if (filterScales.length > 0) {
          const validScales = filterScales.filter(s => availableScalesOptions.includes(s));
          if (validScales.length !== filterScales.length) {
              setFilterScales(validScales);
          }
      }
  }, [availableScalesOptions, filterScales]);


  // --- HELPERS FOR RULES ---

  const getAggregatedTarget = (role: string) => {
      // Logic: Sum minPeople for all rules that match the active filters
      let matchingRules = localRules.filter(r => r.roleName === role);

      // Filter by Sector (if active in Simulator)
      if (filterSectors.length > 0) {
          matchingRules = matchingRules.filter(r => r.sector && filterSectors.includes(r.sector));
      }

      // Filter by Shift/Scale (if active in Simulator)
      if (filterScales.length > 0) {
          matchingRules = matchingRules.filter(r => r.shift && filterScales.includes(r.shift));
      }

      // If generic rules exists (no sector/shift), consider how to handle?
      // For now, if we have granular rules, we sum them.
      // If we have ONLY generic rules and no filter is applied, we use generic.
      
      const totalMin = matchingRules.reduce((acc, curr) => acc + (curr.minPeople || 0), 0);
      return totalMin;
  };

  const handleUpdateScopedRule = (role: string, sector: string, shift: string, val: number) => {
    const newRules = [...localRules];
    // Find existing rule for this exact combination
    const idx = newRules.findIndex(r => r.roleName === role && r.sector === sector && r.shift === shift);
    
    if (idx >= 0) {
        if (val <= 0) {
            // Remove rule if 0 to clean up
            newRules.splice(idx, 1);
        } else {
            newRules[idx].minPeople = val;
        }
    } else {
        if (val > 0) {
            newRules.push({ roleName: role, minPeople: val, sector, shift });
        }
    }
    setLocalRules(newRules);
  };

  const getRuleValue = (role: string, sector: string, shift: string) => {
      return localRules.find(r => r.roleName === role && r.sector === sector && r.shift === shift)?.minPeople || 0;
  };

  const saveRules = () => {
      onSaveSettings({ ...settings, coverageRules: localRules });
  };

  // --- DATA PREP FOR RULES TAB ---
  const shiftsInSelectedSector = useMemo(() => {
      if (!selectedRuleSector) return [];
      const colabsInSector = activeCollaborators.filter(c => c.sector === selectedRuleSector);
      const shifts = new Set<string>();
      colabsInSector.forEach(c => {
          if (c.shiftType) shifts.add(c.shiftType);
      });
      return Array.from(shifts).sort();
  }, [selectedRuleSector, activeCollaborators]);

  const rolesInSectorAndShift = (shift: string) => {
      if (!selectedRuleSector) return [];
      const colabs = activeCollaborators.filter(c => c.sector === selectedRuleSector && c.shiftType === shift);
      const roles = new Set(colabs.map(c => c.role));
      return Array.from(roles).sort();
  };

  // --- SIMULATION ENGINE ---

  const simulationData = useMemo(() => {
    const start = new Date(simStartDate + 'T00:00:00');
    const end = new Date(simEndDate + 'T00:00:00');
    const days: { date: string, label: string, weekDayName: string, isHoliday: string | null }[] = [];
    const weekDayShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // 1. Generate Date Range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const year = d.getFullYear();
        const holidays = getFeriados(year);
        const dayOfWeek = d.getDay();
        days.push({
            date: dateStr,
            label: `${weekDayShort[dayOfWeek]} ${d.getDate()}`,
            weekDayName: weekDayShort[dayOfWeek],
            isHoliday: holidays[dateStr] || null
        });
    }

    // 2. Filter Collaborators (Security + Role Filter + Sector Filter + Scale Filter)
    const activeCollaboratorsFiltered = activeCollaborators.filter((c: Collaborator) => {
        // Sector Permission (Security)
        if (currentUserAllowedSectors.length > 0) {
            if (!c.sector || !currentUserAllowedSectors.includes(c.sector)) return false;
        }

        // Branch Restriction
        if (availableBranches.length > 0 && !availableBranches.includes(c.branch)) return false;
        
        // Visual Filters
        
        // Apply Branch Filter (Multi)
        if (filterBranches.length > 0 && !filterBranches.includes(c.branch)) return false;

        // If filterRoles has items, the collaborator's role MUST be in it.
        if (filterRoles.length > 0 && !filterRoles.includes(c.role)) return false;
        
        // Apply Sector Filter (Multi)
        if (filterSectors.length > 0 && (!c.sector || !filterSectors.includes(c.sector))) return false;

        // Apply Scale/Shift Filter (Multi)
        if (filterScales.length > 0) {
            const colabScale = c.hasRotation && c.rotationGroup ? `Escala ${c.rotationGroup}` : null;
            const colabShift = c.shiftType;
            
            const matchesScale = colabScale && filterScales.includes(colabScale);
            const matchesShift = colabShift && filterScales.includes(colabShift);

            if (!matchesScale && !matchesShift) return false;
        }

        return true;
    });

    // 3. Process Coverage Per Day Per Role
    let rolesToSimulate = filterRoles.length === 0 
        ? settings.roles.map(r => r.name) 
        : filterRoles;

    // Filter Optimization: Only show roles present in filtered collaborators to reduce noise
    if (filterRoles.length === 0) {
        const rolesInFiltered = new Set(activeCollaboratorsFiltered.map(c => c.role));
        rolesToSimulate = rolesToSimulate.filter(r => rolesInFiltered.has(r));
    }

    const results: Record<string, Record<string, { available: number, min: number, status: 'ok' | 'alert' | 'violation', missing: number }>> = {};
    const grandTotals: Record<string, { available: number, min: number, status: 'ok' | 'alert' | 'violation' }> = {};
    
    // Initialize Grand Totals
    days.forEach(d => {
        grandTotals[d.date] = { available: 0, min: 0, status: 'ok' };
    });

    rolesToSimulate.forEach(role => {
        results[role] = {};
        
        // Calculate Dynamic Target based on active filters (Sector/Shift)
        const roleMin = getAggregatedTarget(role);
        
        const roleColabs = activeCollaboratorsFiltered.filter(c => c.role === role);

        days.forEach(day => {
            const dateObj = new Date(day.date + 'T00:00:00');
            const dayOfWeek = dateObj.getDay(); 
            const scheduleKey = weekDayMap[dayOfWeek] as keyof Schedule;

            let availableCount = 0;

            roleColabs.forEach(colab => {
                if (!colab.schedule[scheduleKey]?.enabled) return;

                if (dayOfWeek === 0 && colab.hasRotation && checkRotationDay(dateObj, colab.rotationStartDate)) {
                    return; 
                }

                const hasHistoryEvent = events.some(e => {
                    if (e.collaboratorId !== colab.id) return false;
                    const eStart = new Date(e.startDate + 'T00:00:00');
                    const eEnd = new Date(e.endDate + 'T00:00:00');
                    const evtType = settings.eventTypes.find(t => t.id === e.type);
                    const isWorking = evtType && evtType.behavior === 'credit_2x';
                    const isAbsence = !isWorking; 
                    return isAbsence && dateObj >= eStart && dateObj <= eEnd;
                });
                if (hasHistoryEvent) return;

                const hasDraftEvent = proposedEvents.some(e => {
                    if (e.collaboratorId !== colab.id) return false;
                    const eStart = new Date(e.startDate + 'T00:00:00');
                    const eEnd = new Date(e.endDate + 'T00:00:00');
                    return dateObj >= eStart && dateObj <= eEnd;
                });
                if (hasDraftEvent) return;

                availableCount++;
            });

            let status: 'ok' | 'alert' | 'violation' = 'ok';
            if (availableCount < roleMin) status = 'violation';
            else if (availableCount === roleMin) status = 'alert';

            results[role][day.date] = {
                available: availableCount,
                min: roleMin,
                status,
                missing: roleMin - availableCount
            };

            if (!day.isHoliday) {
                grandTotals[day.date].available += availableCount;
                grandTotals[day.date].min += roleMin;
            }
        });
    });

    days.forEach(d => {
        if (!d.isHoliday) {
            const t = grandTotals[d.date];
            if (t.available < t.min) t.status = 'violation';
            else if (t.available === t.min) t.status = 'alert';
            else t.status = 'ok';
        }
    });

    return { days, results, grandTotals };
  }, [simStartDate, simEndDate, filterRoles, filterSectors, filterBranches, filterScales, activeCollaborators, events, proposedEvents, localRules, settings, currentUserAllowedSectors, availableBranches]);

  // --- Group days into weeks for rendering ---
  const weeks = useMemo(() => {
      if (!simulationData?.days) return [];
      const chunks = [];
      for (let i = 0; i < simulationData.days.length; i += 7) {
          chunks.push(simulationData.days.slice(i, i + 7));
      }
      return chunks;
  }, [simulationData]);

  // --- HANDLERS ---

  const addDraft = (e: React.FormEvent) => {
      e.preventDefault();
      if (!draftForm.collaboratorId || !draftForm.startDate || !draftForm.endDate) return;

      const newDraft: ProposedEvent = {
          id: Math.random().toString(36).substr(2, 9),
          collaboratorId: draftForm.collaboratorId,
          type: draftForm.type,
          startDate: draftForm.startDate,
          endDate: draftForm.endDate
      };

      setProposedEvents([...proposedEvents, newDraft]);
      setDraftForm({ ...draftForm, collaboratorId: '' }); 
  };

  const removeDraft = (id: string) => {
      setProposedEvents(proposedEvents.filter(e => e.id !== id));
  };

  const getCellStyles = (status: 'ok' | 'alert' | 'violation', available: number, isHoliday: string | null) => {
      if (isHoliday) return 'bg-gray-50 text-gray-400 border border-gray-200 opacity-50';
      
      if (status === 'violation') return 'bg-red-100 text-red-800 border-red-200 font-bold';
      if (status === 'alert') return 'bg-amber-100 text-amber-800 border-amber-200 font-bold';
      
      // Status OK
      if (available > 0) return 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold';
      
      // Status OK but 0 available (Neutral/No work scheduled) - Sutil
      return 'bg-white text-gray-300 border border-dashed border-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* HEADER TABS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex overflow-x-auto">
         <button 
           onClick={() => setActiveTab('simulation')}
           className={`flex-1 py-3 px-6 rounded-lg font-bold text-sm transition-all ${activeTab === 'simulation' ? 'bg-[#667eea] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
         >
            🧪 Simulador & Calendário
         </button>
         <button 
           onClick={() => setActiveTab('rules')}
           className={`flex-1 py-3 px-6 rounded-lg font-bold text-sm transition-all ${activeTab === 'rules' ? 'bg-[#667eea] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
         >
            ⚙️ Regras de Cobertura
         </button>
      </div>

      {activeTab === 'rules' && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 animate-fadeIn">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                 <div>
                    <h2 className="text-xl font-bold text-gray-800">Metas de Pessoas por Jornada</h2>
                    <p className="text-sm text-gray-500 mt-1">Defina quantos colaboradores devem estar presentes em cada setor e turno.</p>
                 </div>
                 {canEditRules && (
                    <button 
                        onClick={saveRules}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors"
                    >
                        Salvar Todas Regras
                    </button>
                 )}
              </div>

              {!canEditRules && <div className="mb-4 p-3 bg-amber-50 text-amber-800 rounded border border-amber-200 text-sm">Modo Leitura: Você não tem permissão para editar regras.</div>}

              {/* Seletor de Setor */}
              <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <label className="block text-sm font-bold text-gray-700 mb-2">1. Selecione o Setor para Configurar:</label>
                  <select 
                    value={selectedRuleSector}
                    onChange={e => setSelectedRuleSector(e.target.value)}
                    className="w-full md:w-1/2 p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500"
                  >
                      <option value="">Selecione...</option>
                      {availableSectors.map(s => (
                          <option key={s} value={s}>{s}</option>
                      ))}
                  </select>
                  {availableSectors.length === 0 && <p className="text-xs text-red-500 mt-1">Nenhum setor disponível para seu perfil.</p>}
              </div>

              {selectedRuleSector ? (
                  <div className="space-y-8">
                      {shiftsInSelectedSector.length === 0 && (
                          <p className="text-gray-500 italic">Nenhuma jornada identificada neste setor (cadastre colaboradores com turnos primeiro).</p>
                      )}

                      {shiftsInSelectedSector.map(shift => {
                          const roles = rolesInSectorAndShift(shift);
                          return (
                              <div key={shift} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                  <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex items-center justify-between">
                                      <h3 className="font-bold text-indigo-800 flex items-center gap-2">
                                          <span className="text-xl">🕒</span> {shift}
                                      </h3>
                                      <span className="text-xs text-indigo-500 font-medium bg-white px-2 py-1 rounded-full border border-indigo-100">
                                          {selectedRuleSector}
                                      </span>
                                  </div>
                                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {roles.map(role => {
                                          const currentVal = getRuleValue(role, selectedRuleSector, shift);
                                          return (
                                              <div key={role} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                  <span className="font-medium text-gray-700 text-sm">{role}</span>
                                                  <div className="flex items-center gap-2">
                                                      <button 
                                                        disabled={!canEditRules || currentVal <= 0}
                                                        onClick={() => handleUpdateScopedRule(role, selectedRuleSector, shift, currentVal - 1)}
                                                        className="w-7 h-7 rounded bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50 font-bold"
                                                      >
                                                          -
                                                      </button>
                                                      <span className="text-lg font-bold text-indigo-600 w-6 text-center">{currentVal}</span>
                                                      <button 
                                                        disabled={!canEditRules}
                                                        onClick={() => handleUpdateScopedRule(role, selectedRuleSector, shift, currentVal + 1)}
                                                        className="w-7 h-7 rounded bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50 font-bold"
                                                      >
                                                          +
                                                      </button>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                      {roles.length === 0 && <p className="text-gray-400 text-sm italic">Nenhuma função neste turno.</p>}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              ) : (
                  <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                      <p className="text-gray-400">Selecione um setor acima para visualizar e editar as regras.</p>
                  </div>
              )}
          </div>
      )}

      {activeTab === 'simulation' && (
          <div className="animate-fadeIn space-y-6">
              {/* Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Period & Filter */}
                  <div className="bg-white rounded-xl shadow p-5 border border-gray-100 z-20 relative">
                      <h3 className="font-bold text-gray-800 mb-3">1. Período de Simulação</h3>
                      <div className="space-y-3">
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Inicio</label>
                              <input type="date" value={simStartDate} onChange={e => setSimStartDate(e.target.value)} className="w-full border border-gray-300 rounded-md p-1.5 text-sm" />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Fim</label>
                              <input type="date" value={simEndDate} onChange={e => setSimEndDate(e.target.value)} className="w-full border border-gray-300 rounded-md p-1.5 text-sm" />
                          </div>
                          
                          <div>
                              <MultiSelect 
                                label="FILTRAR POR FILIAL"
                                options={availableBranches}
                                selected={filterBranches}
                                onChange={setFilterBranches}
                                placeholder={availableBranches.length > 1 ? 'Todas' : 'Sua Filial'}
                                disabled={availableBranches.length === 1}
                              />
                          </div>

                          <div>
                              <MultiSelect 
                                label="FILTRAR POR SETOR"
                                options={availableSectors}
                                selected={filterSectors}
                                onChange={setFilterSectors}
                                placeholder={filterBranches.length === 0 ? "Selecione Filial" : "Todos os Setores"}
                                disabled={currentUserAllowedSectors.length === 1}
                              />
                          </div>
                          
                          <div>
                              <MultiSelect 
                                label="FILTRAR POR FUNÇÃO"
                                options={availableRolesOptions}
                                selected={filterRoles}
                                onChange={setFilterRoles}
                                placeholder="Todas as Funções"
                              />
                          </div>

                          <div>
                              <MultiSelect 
                                label="FILTRAR POR JORNADA/ESCALA"
                                options={availableScalesOptions}
                                selected={filterScales}
                                onChange={setFilterScales}
                                placeholder="Todas as Jornadas"
                              />
                          </div>
                      </div>
                  </div>

                  {/* Draft Form */}
                  <div className="bg-white rounded-xl shadow p-5 border border-gray-100 lg:col-span-2 z-10 relative">
                      <h3 className="font-bold text-gray-800 mb-3">2. Propor Evento (Rascunho)</h3>
                      <p className="text-xs text-gray-500 mb-3">Adicione férias ou folgas hipotéticas para ver como a cobertura é afetada. Estes dados <b>não</b> são salvos no banco.</p>
                      
                      <form onSubmit={addDraft} className="flex flex-col md:flex-row gap-3 items-end">
                          <div className="flex-1 w-full">
                              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Colaborador {filterSectors.length > 0 && <span className="font-normal text-indigo-500">(Filtrado)</span>}</label>
                              <select 
                                required 
                                value={draftForm.collaboratorId} 
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDraftForm({...draftForm, collaboratorId: e.target.value})}
                                className="w-full border border-gray-300 rounded-md p-1.5 text-sm bg-white"
                              >
                                  <option value="">Selecione...</option>
                                  {activeCollaborators
                                    .filter(c => {
                                      if (currentUserAllowedSectors.length > 0) {
                                          if (!c.sector) return false;
                                          if (!currentUserAllowedSectors.includes(c.sector)) return false;
                                      }

                                      if (availableBranches.length > 0 && !availableBranches.includes(c.branch)) return false;
                                      
                                      if (filterSectors.length > 0) {
                                          if (!c.sector) return false;
                                          if (!filterSectors.includes(c.sector)) return false;
                                      }

                                      // Scale Filter check for Draft Form options
                                      if (filterScales.length > 0) {
                                          const colabScale = c.hasRotation && c.rotationGroup ? `Escala ${c.rotationGroup}` : null;
                                          const colabShift = c.shiftType;
                                          
                                          const matchesScale = colabScale ? filterScales.includes(colabScale) : false;
                                          const matchesShift = colabShift ? filterScales.includes(colabShift) : false;

                                          if (!matchesScale && !matchesShift) return false;
                                      }

                                      return true;
                                    })
                                    .sort((a,b) => a.name.localeCompare(b.name))
                                    .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                                  }
                              </select>
                          </div>
                          <div className="w-full md:w-32">
                              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tipo</label>
                              <select 
                                value={draftForm.type} 
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDraftForm({...draftForm, type: e.target.value})} 
                                className="w-full border border-gray-300 rounded-md p-1.5 text-sm bg-white"
                              >
                                  <option value="ferias">Férias</option>
                                  <option value="folga">Folga</option>
                                  <option value="atestado">Atestado</option>
                                  <option value="falta">Falta</option>
                              </select>
                          </div>
                          <div className="w-full md:w-36">
                              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">De</label>
                              <input 
                                required 
                                type="date" 
                                value={draftForm.startDate} 
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftForm({...draftForm, startDate: e.target.value})} 
                                className="w-full border border-gray-300 rounded-md p-1.5 text-sm" 
                              />
                          </div>
                          <div className="w-full md:w-36">
                              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Até</label>
                              <input 
                                required 
                                type="date" 
                                value={draftForm.endDate} 
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftForm({...draftForm, endDate: e.target.value})} 
                                className="w-full border border-gray-300 rounded-md p-1.5 text-sm" 
                              />
                          </div>
                          <button type="submit" className="bg-[#667eea] hover:bg-[#5a6fd6] text-white font-bold py-2 px-4 rounded text-sm w-full md:w-auto">
                              Adicionar
                          </button>
                      </form>

                      {proposedEvents.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                              {proposedEvents.map(evt => {
                                  const name = collaborators.find(c => c.id === evt.collaboratorId)?.name || '???';
                                  return (
                                      <div key={evt.id} className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 rounded text-xs flex items-center gap-2">
                                          <span className="font-bold">{name}</span>
                                          <span>({evt.type})</span>
                                          <button onClick={() => removeDraft(evt.id)} className="text-red-600 font-bold hover:bg-red-100 rounded-full w-4 h-4 flex items-center justify-center">×</button>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              </div>

              {/* Matrix Result */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-0 relative">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                      <h2 className="text-lg font-bold text-gray-800">Resultado da Simulação</h2>
                      <div className="flex gap-4 text-xs font-bold">
                          <div className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded"></span> Cobertura OK</div>
                          <div className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-100 border border-amber-200 rounded"></span> Alerta</div>
                          <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 border border-red-200 rounded"></span> Violação</div>
                          <div className="flex items-center gap-1"><span className="w-3 h-3 bg-white border border-gray-300 border-dashed rounded"></span> Neutro</div>
                      </div>
                  </div>
                  
                  <div className="p-4 custom-scrollbar">
                      {Object.keys(simulationData.results).length === 0 && (
                          <p className="text-center text-gray-500 py-8">Nenhum dado para o setor/filtro selecionado.</p>
                      )}

                      {/* TOTAL GERAL ROW (Grouped by Week) */}
                      {Object.keys(simulationData.results).length > 0 && (
                          <div className="mb-8 p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-bold text-indigo-800 uppercase tracking-wide">TOTAL GERAL <span className="text-xs font-normal normal-case opacity-70">(Agrupado)</span></h3>
                              </div>
                              <div className="flex gap-4 flex-wrap">
                                {weeks.map((week, wIdx) => (
                                    <div key={wIdx} className="flex gap-1 p-1 bg-white/70 rounded-lg border border-indigo-100 shadow-sm">
                                        {week.map((day) => {
                                            const data = simulationData.grandTotals[day.date];
                                            const colorClass = getCellStyles(data.status, data.available, day.isHoliday);

                                            return (
                                                <div key={day.date} className={`w-12 h-16 flex flex-col items-center justify-center border rounded ${colorClass}`}>
                                                    <span className="text-[9px] uppercase font-bold tracking-tight text-indigo-900/60 mb-0.5">{day.weekDayName}</span>
                                                    <span className="text-[10px] font-bold opacity-80 leading-tight">{day.label.split(' ')[1]}</span>
                                                    {!day.isHoliday ? (
                                                        <span className="text-sm font-bold mt-1">{data.available}</span>
                                                    ) : <span className="text-xs mt-1">F</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                              </div>
                          </div>
                      )}

                      {/* Matrix Rows by Role (Grouped by Week) */}
                      <div className="space-y-6">
                        {Object.keys(simulationData.results).map(role => {
                            // Calculate specific goal for this role based on filters
                            const aggregatedGoal = getAggregatedTarget(role);
                            
                            return (
                            <div key={role} className="border-b border-gray-100 pb-4 last:border-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-bold text-gray-700">{role}</h3>
                                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 rounded border border-gray-200">Meta Agrupada: {aggregatedGoal}</span>
                                </div>
                                <div className="flex gap-4 flex-wrap">
                                    {weeks.map((week, wIdx) => (
                                        <div key={wIdx} className="flex gap-1">
                                            {week.map((day) => {
                                                const data = simulationData.results[role][day.date];
                                                const colorClass = getCellStyles(data.status, data.available, day.isHoliday);

                                                return (
                                                    <div key={`${role}-${day.date}`} className={`w-12 h-14 flex flex-col items-center justify-center border rounded text-xs ${colorClass}`} title={`${day.date}: ${data.available} disponíveis (Meta: ${data.min})`}>
                                                        <div className="text-[8px] opacity-60 leading-none mb-1 font-bold uppercase">{day.weekDayName}</div>
                                                        <div className="text-[9px] opacity-60 leading-none mb-1">{day.label.split(' ')[1]}</div>
                                                        <span className="font-bold text-sm">{day.isHoliday ? 'F' : data.available}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )})}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};