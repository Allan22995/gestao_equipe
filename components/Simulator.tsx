

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
    }
  }, [currentUserAllowedSectors]);

  // Force Branch Filter if Restricted (single branch)
  useEffect(() => {
    if (availableBranches.length === 1) {
      setFilterBranches([availableBranches[0]]);
    }
  }, [availableBranches]);

  // Available sectors for filter dropdown
  const availableSectors = useMemo(() => {
    if (!settings?.sectors) return [];
    if (currentUserAllowedSectors.length === 0) return settings.sectors; // All
    return settings.sectors.filter(s => currentUserAllowedSectors.includes(s));
  }, [settings?.sectors, currentUserAllowedSectors]);

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


  // --- HELPERS ---

  const getRuleForRole = (role: string) => {
    return localRules.find(r => r.roleName === role)?.minPeople || 0;
  };

  const handleUpdateRule = (role: string, val: number) => {
    const newRules = [...localRules];
    const idx = newRules.findIndex(r => r.roleName === role);
    if (idx >= 0) {
        newRules[idx].minPeople = val;
    } else {
        newRules.push({ roleName: role, minPeople: val });
    }
    setLocalRules(newRules);
  };

  const saveRules = () => {
      onSaveSettings({ ...settings, coverageRules: localRules });
  };

  // --- SIMULATION ENGINE ---

  const simulationData = useMemo(() => {
    const start = new Date(simStartDate + 'T00:00:00');
    const end = new Date(simEndDate + 'T00:00:00');
    const days: { date: string, label: string, isHoliday: string | null }[] = [];

    // 1. Generate Date Range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const year = d.getFullYear();
        const holidays = getFeriados(year);
        days.push({
            date: dateStr,
            label: `${d.getDate()}/${d.getMonth() + 1}`,
            isHoliday: holidays[dateStr] || null
        });
    }

    // 2. Filter Collaborators (Security + Role Filter + Sector Filter)
    const activeCollaboratorsFiltered = activeCollaborators.filter(c => {
        // Sector Permission (Security)
        if (currentUserAllowedSectors.length > 0) {
            if (!c.sector || !currentUserAllowedSectors.includes(c.sector)) return false;
        }

        // Branch Restriction
        if (availableBranches.length > 0 && !availableBranches.includes(c.branch)) return false;
        
        // Visual Filters
        // If filterRoles has items, the collaborator's role MUST be in it.
        if (filterRoles.length > 0 && !filterRoles.includes(c.role)) return false;
        
        // Apply Sector Filter (Multi)
        if (filterSectors.length > 0 && (!c.sector || !filterSectors.includes(c.sector))) return false;

        return true;
    });

    // 3. Process Coverage Per Day Per Role
    let rolesToSimulate = filterRoles.length === 0 
        ? settings.roles.map(r => r.name) 
        : filterRoles;

    // Filter Optimization: If a specific sector is selected, only show roles present in that sector
    // This avoids showing irrelevant roles (with 0 data) in the matrix
    if (filterRoles.length === 0 && filterSectors.length > 0) {
        const rolesInSector = new Set(activeCollaboratorsFiltered.map(c => c.role));
        rolesToSimulate = rolesToSimulate.filter(r => rolesInSector.has(r));
    } else if (filterRoles.length === 0) {
        // If no filter, restrict to available roles in the general context to avoid noise
        rolesToSimulate = rolesToSimulate.filter(r => availableRolesOptions.includes(r));
    }

    const results: Record<string, Record<string, { available: number, min: number, status: 'ok' | 'alert' | 'violation', missing: number }>> = {};
    const grandTotals: Record<string, { available: number, min: number, status: 'ok' | 'alert' | 'violation' }> = {};
    
    // Initialize Grand Totals
    days.forEach(d => {
        grandTotals[d.date] = { available: 0, min: 0, status: 'ok' };
    });

    rolesToSimulate.forEach(role => {
        results[role] = {};
        const roleMin = getRuleForRole(role);
        const roleColabs = activeCollaboratorsFiltered.filter(c => c.role === role);

        days.forEach(day => {
            const dateObj = new Date(day.date + 'T00:00:00');
            const dayOfWeek = dateObj.getDay(); // 0 = Dom, 1 = Seg...
            const scheduleKey = weekDayMap[dayOfWeek] as keyof Schedule;

            let availableCount = 0;

            roleColabs.forEach(colab => {
                // A. Check if standard schedule enables work this day
                if (!colab.schedule[scheduleKey]?.enabled) return;

                // A.5 Check Rotation Off Day (New 3x1 Logic)
                if (dayOfWeek === 0 && colab.hasRotation && checkRotationDay(dateObj, colab.rotationStartDate)) {
                    // It's an off day due to rotation -> Absent
                    return; 
                }

                // B. Check Historical Events (Absences)
                const hasHistoryEvent = events.some(e => {
                    if (e.collaboratorId !== colab.id) return false;
                    const eStart = new Date(e.startDate + 'T00:00:00');
                    const eEnd = new Date(e.endDate + 'T00:00:00');
                    
                    // Consider absence if event type behaves like absence (ferias, folga, atestado, falta)
                    // We assume 'trabalhado' adds (credit_2x), all others subtract or are neutral absences.
                    const evtType = settings.eventTypes.find(t => t.id === e.type);
                    const isWorking = evtType && evtType.behavior === 'credit_2x'; // Only explicitly worked days count as presence override
                    
                    // Logic: If it's NOT a working credit event, it counts as absence for the schedule simulation
                    // This covers: ferias, folga, atestado, falta, suspensao (assuming they are configured as neutral or debit)
                    const isAbsence = !isWorking; 
                    
                    return isAbsence && dateObj >= eStart && dateObj <= eEnd;
                });
                if (hasHistoryEvent) return;

                // C. Check Proposed Events (Drafts)
                const hasDraftEvent = proposedEvents.some(e => {
                    if (e.collaboratorId !== colab.id) return false;
                    const eStart = new Date(e.startDate + 'T00:00:00');
                    const eEnd = new Date(e.endDate + 'T00:00:00');
                    return dateObj >= eStart && dateObj <= eEnd;
                });
                if (hasDraftEvent) return;

                // If passed all checks, employee is available
                availableCount++;
            });

            // Determine Status for Role
            let status: 'ok' | 'alert' | 'violation' = 'ok';
            if (availableCount < roleMin) status = 'violation';
            else if (availableCount === roleMin) status = 'alert';

            results[role][day.date] = {
                available: availableCount,
                min: roleMin,
                status,
                missing: roleMin - availableCount
            };

            // Add to Grand Totals
            if (!day.isHoliday) {
                grandTotals[day.date].available += availableCount;
                grandTotals[day.date].min += roleMin;
            }
        });
    });

    // Calculate Grand Total Status per day
    days.forEach(d => {
        if (!d.isHoliday) {
            const t = grandTotals[d.date];
            if (t.available < t.min) t.status = 'violation';
            else if (t.available === t.min) t.status = 'alert';
            else t.status = 'ok';
        }
    });

    return { days, results, grandTotals };
  }, [simStartDate, simEndDate, filterRoles, filterSectors, activeCollaborators, events, proposedEvents, localRules, settings, currentUserAllowedSectors, availableRolesOptions, availableBranches]);


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
      setDraftForm({ ...draftForm, collaboratorId: '' }); // reset only colab for faster entry
  };

  const removeDraft = (id: string) => {
      setProposedEvents(proposedEvents.filter(e => e.id !== id));
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
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h2 className="text-xl font-bold text-gray-800">Mínimo de Pessoas por Função</h2>
                    <p className="text-sm text-gray-500 mt-1">Defina quantos colaboradores de cada função devem estar trabalhando para considerar o dia "coberto".</p>
                 </div>
                 {canEditRules && (
                    <button 
                        onClick={saveRules}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors"
                    >
                        Salvar Regras
                    </button>
                 )}
              </div>

              {!canEditRules && <div className="mb-4 p-3 bg-amber-50 text-amber-800 rounded border border-amber-200 text-sm">Modo Leitura: Você não tem permissão para editar regras.</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {settings.roles.map(role => {
                      const currentVal = getRuleForRole(role.name);
                      return (
                          <div key={role.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                              <span className="font-bold text-gray-700">{role.name}</span>
                              <div className="flex items-center gap-3">
                                  <button 
                                    disabled={!canEditRules || currentVal <= 0}
                                    onClick={() => handleUpdateRule(role.name, currentVal - 1)}
                                    className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50 font-bold"
                                  >
                                      -
                                  </button>
                                  <span className="text-xl font-bold text-indigo-600 w-8 text-center">{currentVal}</span>
                                  <button 
                                    disabled={!canEditRules}
                                    onClick={() => handleUpdateRule(role.name, currentVal + 1)}
                                    className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50 font-bold"
                                  >
                                      +
                                  </button>
                              </div>
                          </div>
                      );
                  })}
              </div>
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
                          {/* Sector Filter (Multi) */}
                          <div>
                              <MultiSelect 
                                label="FILTRAR POR SETOR"
                                options={availableSectors}
                                selected={filterSectors}
                                onChange={setFilterSectors}
                                placeholder="Todos os Setores"
                                disabled={currentUserAllowedSectors.length === 1}
                              />
                          </div>
                          
                          {/* Role Multi-Select Filter */}
                          <div>
                              <MultiSelect 
                                label="FILTRAR POR FUNÇÃO"
                                options={availableRolesOptions}
                                selected={filterRoles}
                                onChange={setFilterRoles}
                                placeholder="Todas as Funções"
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
                                onChange={e => setDraftForm({...draftForm, collaboratorId: e.target.value})}
                                className="w-full border border-gray-300 rounded-md p-1.5 text-sm bg-white"
                              >
                                  <option value="">Selecione...</option>
                                  {activeCollaborators
                                    .filter(c => {
                                      // 1. Restriction Check
                                      if (currentUserAllowedSectors.length > 0 && (!c.sector || !currentUserAllowedSectors.includes(c.sector))) return false;
                                      
                                      // Branch Check
                                      if (availableBranches.length > 0 && !availableBranches.includes(c.branch)) return false;

                                      // 2. Simulator Sector Filter Check (Multi)
                                      if (filterSectors.length > 0 && (!c.sector || !filterSectors.includes(c.sector))) return false;
                                      return true;
                                    })
                                    .sort((a,b) => a.name.localeCompare(b.name))
                                    .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                                  }
                              </select>
                          </div>
                          <div className="w-full md:w-32">
                              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tipo</label>
                              <select value={draftForm.type} onChange={e => setDraftForm({...draftForm, type: e.target.value})} className="w-full border border-gray-300 rounded-md p-1.5 text-sm bg-white">
                                  <option value="ferias">Férias</option>
                                  <option value="folga">Folga</option>
                                  <option value="atestado">Atestado</option>
                                  <option value="falta">Falta</option>
                              </select>
                          </div>
                          <div className="w-full md:w-36">
                              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">De</label>
                              <input required type="date" value={draftForm.startDate} onChange={e => setDraftForm({...draftForm, startDate: e.target.value})} className="w-full border border-gray-300 rounded-md p-1.5 text-sm" />
                          </div>
                          <div className="w-full md:w-36">
                              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Até</label>
                              <input required type="date" value={draftForm.endDate} onChange={e => setDraftForm({...draftForm, endDate: e.target.value})} className="w-full border border-gray-300 rounded-md p-1.5 text-sm" />
                          </div>
                          <button type="submit" className="bg-[#667eea] hover:bg-[#5a6fd6] text-white font-bold py-2 px-4 rounded text-sm w-full md:w-auto">
                              Adicionar
                          </button>
                      </form>

                      {/* Draft List */}
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
                          <div className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-100 border border-emerald-400 rounded"></span> Cobertura OK</div>
                          <div className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-100 border border-amber-400 rounded"></span> Alerta (No limite)</div>
                          <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 border border-red-400 rounded"></span> Violação</div>
                      </div>
                  </div>
                  
                  <div className="overflow-x-auto pb-4">
                      {Object.keys(simulationData.results).length === 0 && (
                          <p className="text-center text-gray-500 py-8">Nenhum dado para o setor/filtro selecionado.</p>
                      )}

                      {/* TOTAL GERAL ROW */}
                      {Object.keys(simulationData.results).length > 0 && (
                          <div className="mb-8 px-4 pt-4 bg-indigo-50/50 border-b-2 border-indigo-200 pb-4">
                              <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-bold text-indigo-800 uppercase tracking-wide">TOTAL GERAL <span className="text-xs font-normal normal-case opacity-70">(Agrupado)</span></h3>
                              </div>
                              <div className="flex gap-1 min-w-max">
                                {simulationData.days.map((day, idx) => {
                                      const data = simulationData.grandTotals[day.date];
                                      let colorClass = 'bg-gray-50 border-gray-200 text-gray-400'; 
                                      
                                      if (!day.isHoliday) {
                                          if (data.status === 'ok') colorClass = 'bg-emerald-200 border-emerald-400 text-emerald-900 shadow-sm';
                                          else if (data.status === 'alert') colorClass = 'bg-amber-200 border-amber-400 text-amber-900 shadow-sm';
                                          else colorClass = 'bg-red-200 border-red-400 text-red-900 shadow-sm';
                                      } else {
                                          colorClass = 'bg-gray-200 border-gray-300 opacity-60'; 
                                      }

                                      return (
                                          <div key={`total-${idx}`} className={`w-12 h-16 flex flex-col items-center justify-center border-2 rounded-lg transition-all ${colorClass}`} title={`${day.date}: Total Disponível ${data.available} / Meta Global ${data.min}`}>
                                              <span className="text-[10px] font-bold uppercase">{weekDayMap[new Date(day.date + 'T00:00:00').getDay()].substr(0, 3)}</span>
                                              <span className="text-[10px] mb-1">{day.label.split('/')[0]}</span>
                                              {!day.isHoliday ? (
                                                  <span className="font-bold text-sm">
                                                      {data.available}<span className="text-[9px] opacity-60">/{data.min}</span>
                                                  </span>
                                              ) : <span className="text-xs">-</span>}
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      )}

                      {Object.keys(simulationData.results).map(role => {
                          const min = getRuleForRole(role);
                          return (
                              <div key={role} className="mb-6 px-4 pt-4">
                                  <div className="flex items-center gap-2 mb-2">
                                      <h3 className="font-bold text-gray-700">{role}</h3>
                                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Meta: {min} pessoas</span>
                                  </div>
                                  
                                  <div className="flex gap-1 min-w-max">
                                      {simulationData.days.map((day, idx) => {
                                          const data = simulationData.results[role][day.date];
                                          let colorClass = 'bg-gray-50 border-gray-200 text-gray-400'; // Default / Holiday
                                          
                                          if (!day.isHoliday) {
                                              if (data.status === 'ok') colorClass = 'bg-emerald-100 border-emerald-300 text-emerald-800';
                                              else if (data.status === 'alert') colorClass = 'bg-amber-100 border-amber-300 text-amber-800';
                                              else colorClass = 'bg-red-100 border-red-300 text-red-800';
                                          } else {
                                              // Holiday visual override, but keeping count visible
                                              colorClass = 'bg-gray-100 border-gray-200 opacity-60'; 
                                          }

                                          return (
                                              <div key={idx} className={`w-12 h-16 flex flex-col items-center justify-center border rounded transition-all hover:scale-105 ${colorClass}`} title={`${day.date}: ${data.available} disponíveis`}>
                                                  <span className="text-[10px] font-bold uppercase">{weekDayMap[new Date(day.date + 'T00:00:00').getDay()].substr(0, 3)}</span>
                                                  <span className="text-[10px] mb-1">{day.label.split('/')[0]}</span>
                                                  {!day.isHoliday ? (
                                                      <span className="font-bold text-sm">
                                                          {data.available}<span className="text-[9px] opacity-60">/{min}</span>
                                                      </span>
                                                  ) : <span className="text-xs">-</span>}
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};