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
  canViewCharts?: boolean; // Permissão ACL para Gráficos
  availableBranches: string[]; // Lista de filiais permitidas
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  collaborators, events, onCalls, vacationRequests, settings, currentUserProfile,
  currentUserAllowedSectors, canViewPhones, canViewCharts = false, availableBranches
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

  // --- FILTERED LIST MEMO (Centralizado para uso em toda a tela) ---
  const filteredDashboardList = useMemo(() => {
      return activeCollaborators.filter(c => {
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
  }, [activeCollaborators, filterName, filterBranches, filterRoles, filterSectors, currentUserAllowedSectors, availableBranches]);

  // --- STATS CALCULATION FOR CHARTS ---
  const scalesStats = useMemo(() => {
      const counts: Record<string, number> = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'NA': 0 };
      let total = 0;

      filteredDashboardList.forEach(c => {
          total++;
          if (c.hasRotation && c.rotationGroup) {
              const grp = c.rotationGroup.toUpperCase();
              if (counts[grp] !== undefined) counts[grp]++;
              else counts['NA']++; // Fallback se grupo desconhecido
          } else {
              counts['NA']++;
          }
      });

      return { counts, total };
  }, [filteredDashboardList]);

  const shiftsStats = useMemo(() => {
      const counts: Record<string, number> = {};
      let total = 0;

      filteredDashboardList.forEach(c => {
          total++;
          const shift = c.shiftType || 'Não Definido';
          counts[shift] = (counts[shift] || 0) + 1;
      });

      // Sort by count desc
      const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([label, count]) => ({ label, count }));

      return { sorted, total };
  }, [filteredDashboardList]);

  const getShiftStyle = (shift: string) => {
      const s = shift.toLowerCase();
      if (s.includes('adm') || s.includes('geral')) return { icon: '🏢', color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' };
      if (s.includes('1º') || s.includes('manhã')) return { icon: '🌅', color: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700' };
      if (s.includes('2º') || s.includes('tarde')) return { icon: '🌇', color: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700' };
      if (s.includes('3º') || s.includes('noite') || s.includes('noturno')) return { icon: '🌙', color: 'bg-indigo-600', bg: 'bg-indigo-50', text: 'text-indigo-800' };
      return { icon: '⏱️', color: 'bg-gray-500', bg: 'bg-gray-50', text: 'text-gray-700' };
  };

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

         if (!scheduleDay || !scheduleDay.enabled) return false;
         return isTimeInRange(scheduleDay.start, scheduleDay.end, !!scheduleDay.startsPreviousDay, context);
    };

    filteredDashboardList.forEach(c => {
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
               const isStartDay = check.getTime() === start.getTime();
               const isEndDay = check.getTime() === end.getTime();

               if (isStartDay && isEndDay) {
                   return currentMinutes >= startMins || currentMinutes <= endMins;
               }
               if (isStartDay) return currentMinutes >= startMins;
               if (isEndDay) return currentMinutes <= endMins;
               return true;
           }
        }
        return false;
      });

      const todayEvent = events.find(e => {
        const start = new Date(e.startDate + 'T00:00:00');
        const end = new Date(e.endDate + 'T00:00:00');
        const check = new Date(todayStr + 'T00:00:00');
        return e.collaboratorId === c.id && check >= start && check <= end;
      });

      let isWorkingShift = false;

      // 1. Determine which schedule to use (Default or Temporary Event Schedule)
      let scheduleToUse = c.schedule;
      let usingTempSchedule = false;

      if (todayEvent && todayEvent.schedule) {
          scheduleToUse = todayEvent.schedule;
          usingTempSchedule = true;
      }

      // 2. Check schedule status based on the selected schedule source
      if (isShiftActive(scheduleToUse[prevDayKey], 'yesterday', c)) isWorkingShift = true;
      if (!isWorkingShift && isShiftActive(scheduleToUse[currentDayKey], 'today', c)) isWorkingShift = true;
      if (!isWorkingShift && isShiftActive(scheduleToUse[nextDayKey], 'tomorrow', c)) isWorkingShift = true;

      let status = 'Fora do Horário';
      let statusColor = 'bg-blue-100 text-blue-800';
      let isActive = false;

      // Check Rotation Off Day (Domingo de Folga pela Escala) - Only if NOT using temp schedule override
      let isRotationOff = false;
      if (!usingTempSchedule && isSunday && c.hasRotation && c.rotationGroup) {
          isRotationOff = checkRotationDay(now, c.rotationStartDate);
      }

      if (approvedVacation) {
        status = 'Férias';
        statusColor = 'bg-blue-100 text-blue-800 border border-blue-200';
      } else if (todayOnCall) {
        status = 'Plantão';
        statusColor = 'bg-orange-100 text-orange-800 border border-orange-200';
        isActive = true;
      } else if (todayEvent) {
        const evtConfig = settings.eventTypes.find(t => t.id === todayEvent.type);
        const evtLabel = evtConfig?.label || todayEvent.type;
        
        // Determina se é um evento de trabalho (Extra/Crédito)
        let isWorkEvent = false;
        if (todayEvent.type === 'trabalhado') {
            isWorkEvent = true;
        } else if (evtConfig && (evtConfig.behavior === 'credit_2x' || evtConfig.behavior === 'credit_1x')) {
            isWorkEvent = true;
        } else if (evtLabel.toLowerCase().includes('trabalha') || evtLabel.toLowerCase().includes('extra')) {
            isWorkEvent = true;
        }

        if (todayEvent.type === 'ferias') {
            status = `Férias (${evtLabel})`;
            statusColor = 'bg-blue-100 text-blue-800 border border-blue-200';
        } else if (todayEvent.type === 'folga') {
            status = `Folga (${evtLabel})`;
            statusColor = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
            isWorkingShift = false;
        } else if (isWorkEvent) {
             status = `Dia Extra (${evtLabel})`;
             statusColor = 'bg-purple-100 text-purple-800 border border-purple-200';
             
             // Se tiver escala temporária definida no evento, usa isWorkingShift calculado acima
             if (todayEvent.schedule) {
                 isActive = isWorkingShift;
             } else {
                 // Fallback antigo: tenta usar a escala normal se não tiver temp schedule
                 let refSchedule = c.schedule[currentDayKey];
                 if (!refSchedule.enabled) {
                     const weekdays: (keyof Schedule)[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
                     const fallbackDay = weekdays.find(d => c.schedule[d].enabled);
                     if (fallbackDay) {
                         refSchedule = c.schedule[fallbackDay];
                     }
                 }
                 if (refSchedule && refSchedule.start && refSchedule.end) {
                     isActive = isTimeInRange(refSchedule.start, refSchedule.end, !!refSchedule.startsPreviousDay, 'today');
                 } else {
                     isActive = false; 
                 }
             }

             if (!isActive) {
                 status += " (Fora de Horário)";
                 statusColor = 'bg-purple-50 text-purple-700 border border-purple-200 opacity-75';
             }
        } else {
            status = evtLabel;
            statusColor = 'bg-indigo-100 text-indigo-800 border border-indigo-200';
        }
      } else {
        if (isRotationOff) {
            status = 'Folga de Escala';
            statusColor = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
            isWorkingShift = false;
        } else if (isWorkingShift) {
            if (isSunday && c.hasRotation) {
               status = 'Plantão Escala';
            } else {
               status = 'Trabalhando';
            }
            statusColor = 'bg-green-100 text-green-800 border border-green-200';
            isActive = true;
        }
      }

      if (isActive) activeCount++;
      else inactiveCount++;

      tempDetails.push({
        ...c,
        status,
        statusColor,
        isActive
      });
    });

    setStats({
      total: filteredDashboardList.length,
      active: activeCount,
      inactive: inactiveCount
    });
    
    setDetails(tempDetails.sort((a, b) => a.name.localeCompare(b.name)));

    // Upcoming Events Logic (Próximos 7 dias)
    const nextWeekEvents: any[] = [];
    const todayTime = new Date(todayStr + 'T00:00:00').getTime();
    
    // 1. Process Database Events
    events.forEach(e => {
        const start = new Date(e.startDate + 'T00:00:00');
        const diffTime = start.getTime() - todayTime;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 7) {
             const colab = filteredDashboardList.find(c => c.id === e.collaboratorId);
             if (colab) {
                 const evtLabel = settings.eventTypes.find(t => t.id === e.type)?.label || e.type;
                 let displayLabel = evtLabel;
                 if (e.type === 'trabalhado') displayLabel = `Folga Trabalhada - Extra`;
                 if (e.schedule) displayLabel += ` (Escala Alterada)`;
                 
                 let colabNameDisplay = colab.name;
                 if (colab.hasRotation && colab.rotationGroup) colabNameDisplay += ` [${colab.rotationGroup}]`;

                 nextWeekEvents.push({
                     id: e.id,
                     colabName: colabNameDisplay,
                     type: 'Evento',
                     desc: displayLabel,
                     date: e.startDate,
                     day: diffDays === 0 ? 'Hoje' : diffDays === 1 ? 'Amanhã' : new Date(e.startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                 });
             }
        }
    });

    // 2. Process Vacations
    vacationRequests.forEach(v => {
        if (v.status !== 'aprovado') return;
        const start = new Date(v.startDate + 'T00:00:00');
        const diffTime = start.getTime() - todayTime;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 7) {
             const colab = filteredDashboardList.find(c => c.id === v.collaboratorId);
             if (colab) {
                 let colabNameDisplay = colab.name;
                 if (colab.hasRotation && colab.rotationGroup) colabNameDisplay += ` [${colab.rotationGroup}]`;

                 nextWeekEvents.push({
                     id: v.id,
                     colabName: colabNameDisplay,
                     type: 'Férias',
                     desc: 'Início das Férias',
                     date: v.startDate,
                     day: diffDays === 0 ? 'Hoje' : diffDays === 1 ? 'Amanhã' : new Date(v.startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                 });
             }
        }
    });

    // 3. Process Dynamic Rotation Off Days
    for (let i = 0; i <= 7; i++) {
        const targetDate = new Date(todayTime + (i * 24 * 60 * 60 * 1000));
        const dateStr = targetDate.toISOString().split('T')[0];
        
        if (targetDate.getDay() === 0) {
            filteredDashboardList.forEach(c => {
                if (!c.hasRotation || !c.rotationGroup) return;
                const isOff = checkRotationDay(targetDate, c.rotationStartDate);

                if (isOff) {
                    const hasExplicitEvent = events.some(e => e.collaboratorId === c.id && e.startDate <= dateStr && e.endDate >= dateStr);
                    const hasVacation = vacationRequests.some(v => v.collaboratorId === c.id && v.startDate <= dateStr && v.endDate >= dateStr && v.status === 'aprovado');
                    
                    if (!hasExplicitEvent && !hasVacation) {
                         nextWeekEvents.push({
                             id: `rot-off-${c.id}-${dateStr}`,
                             colabName: `${c.name} [Escala ${c.rotationGroup}]`,
                             type: 'Folga de Escala',
                             desc: 'Folga de Revezamento',
                             date: dateStr,
                             day: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : targetDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                         });
                    }
                }
            });
        }
    }

    setUpcoming(nextWeekEvents.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

  }, [filteredDashboardList, events, onCalls, vacationRequests, settings.eventTypes, settings.shiftRotations]);

  const summaryData = useMemo(() => {
    if (!showSummary) return null;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayLocale = today.toLocaleDateString('pt-BR');

    const isToday = (isoString?: string) => {
        if (!isoString) return false;
        if (isoString.startsWith(todayStr)) return true;
        const d = new Date(isoString);
        return d.toLocaleDateString('pt-BR') === todayLocale;
    };

    const newColabs = activeCollaborators.filter(c => isToday(c.createdAt));
    const newEvents = events.filter(e => isToday(e.createdAt));
    const newOnCalls = onCalls.filter(o => isToday(o.createdAt));
    const newVacations = vacationRequests.filter(v => isToday(v.createdAt));

    return {
        date: todayLocale,
        colabs: newColabs,
        events: newEvents,
        onCalls: newOnCalls,
        vacations: newVacations,
        total: newColabs.length + newEvents.length + newOnCalls.length + newVacations.length
    };
  }, [showSummary, activeCollaborators, events, onCalls, vacationRequests]);

  const filteredDetails = useMemo(() => {
      if (activeStatFilter === 'active') return details.filter(d => d.isActive);
      if (activeStatFilter === 'inactive') return details.filter(d => !d.isActive);
      return details;
  }, [details, activeStatFilter]);

  const copySummaryToClipboard = () => {
     if (!summaryData) return;
     let text = `*Resumo Diário - ${summaryData.date}*\n\n`;
     // ... (mantido igual) ...
     if (summaryData.colabs.length > 0) {
         text += `👤 *Novos Colaboradores (${summaryData.colabs.length}):*\n`;
         summaryData.colabs.forEach(c => text += `- ${c.name} (${c.role})\n`);
         text += '\n';
     }
     if (summaryData.events.length > 0) {
         text += `📅 *Eventos/Ausências (${summaryData.events.length}):*\n`;
         summaryData.events.forEach(e => {
             const name = collaborators.find(c => c.id === e.collaboratorId)?.name || '???';
             const typeLabel = settings.eventTypes.find(t => t.id === e.type)?.label || e.type;
             text += `- ${name}: ${typeLabel} (${new Date(e.startDate).toLocaleDateString('pt-BR')})\n`;
         });
         text += '\n';
     }
     if (summaryData.onCalls.length > 0) {
         text += `🚨 *Plantões Criados (${summaryData.onCalls.length}):*\n`;
         summaryData.onCalls.forEach(o => {
             const name = collaborators.find(c => c.id === o.collaboratorId)?.name || '???';
             text += `- ${name}: ${new Date(o.startDate).toLocaleDateString('pt-BR')} (${o.startTime}-${o.endTime})\n`;
         });
         text += '\n';
     }
     if (summaryData.vacations.length > 0) {
         text += `✈️ *Solicitações de Férias (${summaryData.vacations.length}):*\n`;
         summaryData.vacations.forEach(v => {
             const name = collaborators.find(c => c.id === v.collaboratorId)?.name || '???';
             text += `- ${name}: ${new Date(v.startDate).toLocaleDateString('pt-BR')} a ${new Date(v.endDate).toLocaleDateString('pt-BR')} (${v.status})\n`;
         });
     }
     if (summaryData.total === 0) text += "Nenhum registro hoje.";
     navigator.clipboard.writeText(text);
     alert("Resumo copiado para a área de transferência!");
  };

  const sortOrderWeek = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 z-20 relative">
        <div className="flex justify-between items-center mb-4">
           <h2 className="text-lg font-bold text-gray-700">FILTROS DO DASHBOARD</h2>
           <button 
             onClick={() => setShowSummary(true)}
             className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center gap-2"
           >
             📋 Resumo do Dia
           </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Buscar por nome</label>
            <input 
              type="text" 
              placeholder="Buscar por nome..." 
              className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={filterName}
              onChange={e => setFilterName(e.target.value)}
            />
          </div>
          <div>
              <MultiSelect 
                label="Filiais"
                options={availableBranches}
                selected={filterBranches}
                onChange={setFilterBranches}
                placeholder={availableBranches.length > 1 ? 'Todas as Filiais' : 'Sua Filial'}
                disabled={availableBranches.length === 1}
              />
          </div>
          <div>
              <MultiSelect 
                label="Setores"
                options={availableSectors}
                selected={filterSectors}
                onChange={setFilterSectors}
                placeholder="Todos os Setores"
                disabled={currentUserAllowedSectors.length === 1}
              />
          </div>
          <div>
              <MultiSelect 
                label="Funções"
                options={availableRoles}
                selected={filterRoles}
                onChange={setFilterRoles}
                placeholder="Todas as Funções"
              />
          </div>
        </div>
      </div>

      {/* Cards de Status (Clickable) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button 
          onClick={() => setActiveStatFilter('total')}
          className={`text-left w-full bg-emerald-500 rounded-xl shadow-lg p-6 text-white relative overflow-hidden group hover:scale-[1.02] transition-all focus:outline-none ${activeStatFilter === 'total' ? 'ring-4 ring-offset-2 ring-emerald-500' : ''}`}
        >
          <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>
          </div>
          <p className="text-emerald-100 font-bold uppercase text-xs tracking-wider">TOTAL (FILTRADO)</p>
          <p className="text-5xl font-bold mt-2">{stats.total}</p>
        </button>

        <button 
          onClick={() => setActiveStatFilter('active')}
          className={`text-left w-full bg-[#667eea] rounded-xl shadow-lg p-6 text-white relative overflow-hidden group hover:scale-[1.02] transition-all focus:outline-none ${activeStatFilter === 'active' ? 'ring-4 ring-offset-2 ring-[#667eea]' : ''}`}
        >
           <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"></path></svg>
          </div>
          <p className="text-blue-100 font-bold uppercase text-xs tracking-wider">TRABALHANDO AGORA</p>
          <p className="text-5xl font-bold mt-2">{stats.active}</p>
        </button>

        <button 
          onClick={() => setActiveStatFilter('inactive')}
          className={`text-left w-full bg-[#ff8c00] rounded-xl shadow-lg p-6 text-white relative overflow-hidden group hover:scale-[1.02] transition-all focus:outline-none ${activeStatFilter === 'inactive' ? 'ring-4 ring-offset-2 ring-[#ff8c00]' : ''}`}
        >
           <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
             <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"></path></svg>
          </div>
          <p className="text-orange-100 font-bold uppercase text-xs tracking-wider">AUSENTES / FOLGA / FÉRIAS</p>
          <p className="text-5xl font-bold mt-2">{stats.inactive}</p>
        </button>
      </div>

      {/* --- NOVOS GRÁFICOS DE DISTRIBUIÇÃO --- */}
      {canViewCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
            
            {/* DISTRIBUIÇÃO POR ESCALAS */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Distribuição por Escalas</h3>
                        <p className="text-xs text-gray-500">Total da equipe (Considerando filtros atuais)</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {['A', 'B', 'C', 'D'].map(group => {
                        const count = scalesStats.counts[group] || 0;
                        const percent = scalesStats.total > 0 ? Math.round((count / scalesStats.total) * 100) : 0;
                        
                        let colorClass = 'border-indigo-500 text-indigo-700';
                        let barColor = 'bg-indigo-500';
                        if (group === 'B') { colorClass = 'border-emerald-500 text-emerald-700'; barColor = 'bg-emerald-500'; }
                        if (group === 'C') { colorClass = 'border-amber-500 text-amber-700'; barColor = 'bg-amber-500'; }
                        if (group === 'D') { colorClass = 'border-rose-500 text-rose-700'; barColor = 'bg-rose-500'; }

                        return (
                            <div key={group} className={`bg-white border-l-4 ${colorClass} shadow-sm rounded p-3 hover:shadow-md transition-transform hover:scale-105`}>
                                <div className="text-xs font-bold uppercase text-gray-500 mb-1">Grupo {group}</div>
                                <div className="flex items-end gap-1">
                                    <span className="text-2xl font-bold">{count}</span>
                                    <span className="text-xs mb-1 text-gray-400">{percent}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                                    <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${percent}%` }}></div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-auto bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="bg-slate-200 text-slate-600 font-bold text-xs px-2 py-1 rounded">N/A</span>
                        <span className="text-xs font-bold text-slate-600 uppercase">Sem Escala (ADM/Geral)</span>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-bold text-slate-700">{scalesStats.counts['NA']}</div>
                        <div className="text-[10px] text-slate-400">{scalesStats.total > 0 ? Math.round((scalesStats.counts['NA'] / scalesStats.total) * 100) : 0}% do total</div>
                    </div>
                </div>
            </div>

            {/* DISTRIBUIÇÃO POR TURNOS */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Distribuição por Turnos</h3>
                        <p className="text-xs text-gray-500">Total da equipe (Considerando filtros atuais)</p>
                    </div>
                </div>

                <div className="space-y-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                    {shiftsStats.sorted.map((item) => {
                        const style = getShiftStyle(item.label);
                        const percent = shiftsStats.total > 0 ? Math.round((item.count / shiftsStats.total) * 100) : 0;

                        return (
                            <div key={item.label} className={`p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-all ${style.bg}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-sm bg-white`}>
                                            {style.icon}
                                        </div>
                                        <span className={`font-bold text-sm ${style.text}`}>{item.label}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xl font-bold text-gray-800">{item.count}</span>
                                    </div>
                                </div>
                                <div className="w-full bg-white/50 rounded-full h-2 overflow-hidden border border-white">
                                    <div className={`h-2 rounded-full ${style.color}`} style={{ width: `${percent}%` }}></div>
                                </div>
                                <div className="text-right text-[10px] text-gray-400 mt-1">{percent}%</div>
                            </div>
                        );
                    })}
                    {shiftsStats.sorted.length === 0 && (
                        <p className="text-center text-gray-400 italic py-4">Nenhum dado de turno disponível.</p>
                    )}
                </div>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 z-0 relative">
        {/* Lista Detalhada */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 flex flex-col h-[500px]">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            Status em Tempo Real {activeStatFilter !== 'total' && <span className="text-sm font-normal text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">({activeStatFilter === 'active' ? 'Trabalhando' : 'Ausentes'})</span>}
          </h3>
          <p className="text-xs text-gray-500 mb-4">Lista de presença em tempo real.</p>
          
          <div className="overflow-y-auto flex-1 pr-2 space-y-3">
             {filteredDetails.length === 0 && <p className="text-center text-gray-400 py-8 italic">Nenhum colaborador neste status.</p>}
             {filteredDetails.map(d => (
               <div 
                 key={d.id} 
                 className="flex justify-between items-center p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5" 
                 onClick={() => setSelectedColab(d)}
               >
                 <div>
                    <div className="font-bold text-gray-800 text-sm">
                        {d.name}
                        {d.hasRotation && d.rotationGroup && (
                           <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">Escala {d.rotationGroup}</span>
                        )}
                    </div>
                    <div className="text-xs text-indigo-500 font-medium">
                      {d.role} • {d.branch} • {d.sector}
                      {d.shiftType && <span className="ml-1 text-gray-400">• {d.shiftType}</span>}
                    </div>
                 </div>
                 <div className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${d.statusColor}`}>
                    {d.status}
                 </div>
               </div>
             ))}
          </div>
        </div>

        {/* Próximos Eventos */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 flex flex-col h-[500px]">
           <h3 className="text-lg font-bold text-gray-800 mb-4">Próximos Eventos (Filtrados)</h3>
           <div className="overflow-y-auto flex-1 pr-2 space-y-3">
              {upcoming.length === 0 ? <p className="text-gray-400 text-center py-10">Nenhum evento nos próximos 7 dias.</p> : upcoming.map((evt, i) => (
                <div key={i} className="flex gap-4 items-start p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-lg transition-colors">
                   <div className="bg-white border border-gray-200 rounded-lg p-2 text-center min-w-[60px] shadow-sm">
                      <div className="text-xs text-gray-500 uppercase font-bold">{new Date(evt.date + 'T12:00:00').toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}</div>
                      <div className="text-xl font-bold text-gray-800">{new Date(evt.date + 'T12:00:00').getDate()}</div>
                      <div className="text-[10px] text-gray-400">{evt.day}</div>
                   </div>
                   <div>
                      <div className="font-bold text-gray-800 text-sm">{evt.colabName}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{evt.desc}</div>
                      <div className={`text-[10px] font-bold uppercase mt-1 tracking-wide ${evt.type === 'Folga de Escala' ? 'text-emerald-500' : 'text-indigo-500'}`}>{evt.type}</div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      <Modal 
        isOpen={!!selectedColab} 
        onClose={() => setSelectedColab(null)} 
        title={selectedColab ? `Detalhes: ${selectedColab.name}` : ''}
      >
        <div className="space-y-4">
           {selectedColab && (
             <>
               <div className="flex items-center gap-3 mb-4">
                  <div className={`w-3 h-3 rounded-full ${selectedColab.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="font-bold text-lg">{selectedColab.status}</span>
               </div>
               
               <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-gray-500 text-xs uppercase font-bold">Filial</span>
                    <span className="font-medium">{selectedColab.branch}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500 text-xs uppercase font-bold">Setor</span>
                    <span className="font-medium">{selectedColab.sector || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500 text-xs uppercase font-bold">Turno</span>
                    <span className="font-medium">{selectedColab.shiftType || '-'}</span>
                  </div>
                  {selectedColab.hasRotation && selectedColab.rotationGroup && (
                    <div>
                      <span className="block text-gray-500 text-xs uppercase font-bold">Escala</span>
                      <span className="font-medium bg-purple-100 text-purple-800 px-1 rounded text-xs">Grupo {selectedColab.rotationGroup}</span>
                    </div>
                  )}
                  <div>
                    <span className="block text-gray-500 text-xs uppercase font-bold">Email</span>
                    <span className="font-medium text-xs">{selectedColab.email}</span>
                  </div>
               </div>

               {canViewPhones && (
                 <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mt-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Contatos</h4>
                    <div className="space-y-2 text-sm">
                       <div className="flex items-center gap-2">
                          <span>📞</span> 
                          <span className="font-medium">{selectedColab.phone || 'Não cadastrado'}</span>
                       </div>
                       {selectedColab.otherContact && (
                         <div className="flex items-center gap-2">
                            <span>💬</span> 
                            <span className="font-medium">{selectedColab.otherContact}</span>
                         </div>
                       )}
                    </div>
                 </div>
               )}
               
               <div className="mt-5 pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                     📅 Escala Semanal Detalhada
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                     {sortOrderWeek.map(dayKey => {
                        const sch = selectedColab.schedule[dayKey];
                        const isEnabled = sch.enabled;

                        return (
                          <div key={dayKey} className={`
                             relative flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all
                             ${isEnabled 
                                ? 'bg-white border-indigo-200 shadow-sm hover:border-indigo-300' 
                                : 'bg-gray-50 border-gray-100 opacity-60'
                             }
                          `}>
                             {isEnabled && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-green-500"></div>}
                             
                             <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isEnabled ? 'text-indigo-600' : 'text-gray-400'}`}>
                                {dayKey}
                             </span>
                             
                             {isEnabled ? (
                                <div className="flex items-center gap-1 text-xs font-bold text-gray-800 font-mono bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                   {sch.start} <span className="text-indigo-300 mx-0.5">➝</span> {sch.end}
                                </div>
                             ) : (
                                <div className="text-xs font-medium text-gray-400 italic py-1">
                                   Folga
                                </div>
                             )}

                             {isEnabled && sch.startsPreviousDay && (
                                <div className="mt-1 text-[9px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                                   Inicia dia anterior
                                </div>
                             )}
                          </div>
                        );
                     })}
                  </div>
               </div>
             </>
           )}
        </div>
      </Modal>

      {/* MODAL DE RESUMO DO DIA */}
      <Modal
        isOpen={showSummary}
        onClose={() => setShowSummary(false)}
        title={`Resumo Diário - ${summaryData?.date || ''}`}
      >
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="text-sm font-bold text-gray-600">Total de Registros Hoje:</span>
                <span className="text-xl font-bold text-indigo-600">{summaryData?.total || 0}</span>
            </div>

            {summaryData?.total === 0 && (
                <p className="text-center text-gray-500 italic py-4">Nenhum registro encontrado para a data de hoje.</p>
            )}

            {summaryData && summaryData.colabs.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 border-b pb-1">👤 Novos Colaboradores</h4>
                    <ul className="space-y-1 text-sm text-gray-700">
                        {summaryData.colabs.map(c => (
                            <li key={c.id}>• <span className="font-bold">{c.name}</span> ({c.role})</li>
                        ))}
                    </ul>
                </div>
            )}

            {summaryData && summaryData.events.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 border-b pb-1">📅 Eventos / Ausências</h4>
                    <ul className="space-y-1 text-sm text-gray-700">
                        {summaryData.events.map(e => {
                            const name = collaborators.find(c => c.id === e.collaboratorId)?.name || '???';
                            const typeLabel = settings.eventTypes.find(t => t.id === e.type)?.label || e.type;
                            return <li key={e.id}>• <span className="font-bold">{name}</span>: {typeLabel}</li>;
                        })}
                    </ul>
                </div>
            )}

            {summaryData && summaryData.onCalls.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 border-b pb-1">🚨 Plantões Criados</h4>
                    <ul className="space-y-1 text-sm text-gray-700">
                        {summaryData.onCalls.map(o => {
                             const name = collaborators.find(c => c.id === o.collaboratorId)?.name || '???';
                             return <li key={o.id}>• <span className="font-bold">{name}</span> ({o.startTime} - {o.endTime})</li>;
                        })}
                    </ul>
                </div>
            )}

            {summaryData && summaryData.vacations.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 border-b pb-1">✈️ Solicitações de Férias</h4>
                    <ul className="space-y-1 text-sm text-gray-700">
                        {summaryData.vacations.map(v => {
                             const name = collaborators.find(c => c.id === v.collaboratorId)?.name || '???';
                             return <li key={v.id}>• <span className="font-bold">{name}</span> ({v.status})</li>;
                        })}
                    </ul>
                </div>
            )}

            <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={copySummaryToClipboard}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    Copiar para Área de Transferência
                </button>
            </div>
        </div>
      </Modal>
    </div>
  );
};