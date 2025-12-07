
import React, { useEffect, useState, useMemo } from 'react';
import { Collaborator, EventRecord, OnCallRecord, Schedule, SystemSettings, VacationRequest, UserProfile } from '../types';
import { weekDayMap } from '../utils/helpers';
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

  // --- Lógica de Funções Dinâmicas ---
  const availableRoles = useMemo(() => {
    let filtered = collaborators;

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
  }, [collaborators, filterBranches, filterSectors, currentUserAllowedSectors, settings.roles, availableBranches]);

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

    let activeCount = 0;
    let inactiveCount = 0;
    const tempDetails: any[] = [];

    const filteredCollaborators = collaborators.filter(c => {
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

    // Helper para verificar horário, desacoplado da propriedade 'enabled'
    const isTimeInRange = (startStr: string, endStr: string, startsPreviousDay: boolean, context: 'today' | 'yesterday' | 'tomorrow') => {
        if (!startStr || !endStr) return false;

        const [sh, sm] = startStr.split(':').map(Number);
        const [eh, em] = endStr.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;

        if (context === 'yesterday') {
            if (!startsPreviousDay && startMins > endMins) return currentMinutes <= endMins; // Virada de dia normal (ex: 22h as 06h)
            return false;
        }
        if (context === 'today') {
            if (startsPreviousDay) return currentMinutes <= endMins; // Turno começou ontem (ex: 22h ontem, até 06h hoje)
            else {
                if (startMins < endMins) return currentMinutes >= startMins && currentMinutes <= endMins; // Turno normal (08h as 17h)
                else return currentMinutes >= startMins; // Turno vira noite (22h as ...)
            }
        }
        if (context === 'tomorrow') {
            // Se hoje começa um turno que vira pro dia seguinte?
            // Na verdade, 'tomorrow' context é para verificar se um turno de amanhã afeta 'hoje'.
            // Geralmente não afeta 'trabalhando agora', a menos que seja muito cedo.
            // Mantendo lógica original simples:
            if (startsPreviousDay) return currentMinutes >= startMins;
            return false;
        }
        return false;
    };

    const isShiftActive = (scheduleDay: any, context: 'today' | 'yesterday' | 'tomorrow') => {
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

      // Check standard schedule
      if (isShiftActive(c.schedule[prevDayKey], 'yesterday')) isWorkingShift = true;
      if (!isWorkingShift && isShiftActive(c.schedule[currentDayKey], 'today')) isWorkingShift = true;
      if (!isWorkingShift && isShiftActive(c.schedule[nextDayKey], 'tomorrow')) isWorkingShift = true;

      let status = 'Fora do Horário';
      let statusColor = 'bg-blue-100 text-blue-800';
      let isActive = false;

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
             
             // --- LÓGICA DE VERIFICAÇÃO DE HORÁRIO PARA DIA EXTRA ---
             // Se o funcionário está em dia extra, ele deve respeitar o horário parametrizado.
             // 1. Tenta pegar o horário do dia atual (mesmo que enabled=false)
             let schedToCheck = c.schedule[currentDayKey];
             
             // 2. Se o dia atual não tiver horário (ex: Domingo vazio), busca o primeiro dia útil habilitado (ex: Segunda)
             // Isso assume que o "Extra" segue o padrão de turno normal do colaborador.
             if (!schedToCheck.start || !schedToCheck.end) {
                 const daysOrder: (keyof Schedule)[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
                 const standardDay = daysOrder.find(d => c.schedule[d].enabled && c.schedule[d].start && c.schedule[d].end);
                 if (standardDay) {
                     schedToCheck = c.schedule[standardDay];
                 }
             }

             // 3. Verifica se está no horário
             let isTimeActive = false;
             // Check if consistent with 'yesterday' logic (e.g. night shift finishing today)
             // Para simplificar no contexto de extra, focamos principalmente no 'today' e 'yesterday' transition
             if (isTimeInRange(schedToCheck.start, schedToCheck.end, !!schedToCheck.startsPreviousDay, 'today')) isTimeActive = true;
             // Caso seja um turno noturno que começou ontem (se aplicável ao extra)
             // if (!isTimeActive && isTimeInRange(schedToCheck.start, schedToCheck.end, !!schedToCheck.startsPreviousDay, 'yesterday')) isTimeActive = true;

             if (isTimeActive) {
                 isActive = true;
             } else {
                 isActive = false; // Fora do horário do extra
             }
        } else {
            status = evtLabel;
            statusColor = 'bg-indigo-100 text-indigo-800 border border-indigo-200';
        }
      } else {
        if (isWorkingShift) {
          status = 'Trabalhando';
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
      total: filteredCollaborators.length,
      active: activeCount,
      inactive: inactiveCount
    });
    setDetails(tempDetails);

    // Upcoming Events Logic (Próximos 7 dias)
    const nextWeekEvents: any[] = [];
    const todayTime = new Date(todayStr + 'T00:00:00').getTime();
    
    // Process Events
    events.forEach(e => {
        const start = new Date(e.startDate + 'T00:00:00');
        const diffTime = start.getTime() - todayTime;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 7) {
             const colab = collaborators.find(c => c.id === e.collaboratorId);
             if (colab) {
                 // Check filters for upcoming events too
                 if (currentUserAllowedSectors.length > 0) {
                     if (!colab.sector || !currentUserAllowedSectors.includes(colab.sector)) return;
                 }
                 if (availableBranches.length > 0 && !availableBranches.includes(colab.branch)) return;

                 if (filterName && !colab.name.toLowerCase().includes(filterName.toLowerCase())) return;
                 if (filterBranches.length > 0 && !filterBranches.includes(colab.branch)) return;
                 if (filterRoles.length > 0 && !filterRoles.includes(colab.role)) return;
                 if (filterSectors.length > 0 && (!colab.sector || !filterSectors.includes(colab.sector))) return;

                 // Get Event Label
                 const evtLabel = settings.eventTypes.find(t => t.id === e.type)?.label || e.type;
                 // Customize Label display
                 let displayLabel = evtLabel;
                 if (e.type === 'trabalhado') displayLabel = `Folga Trabalhada - Extra`;

                 nextWeekEvents.push({
                     id: e.id,
                     colabName: colab.name,
                     type: 'Evento',
                     desc: displayLabel,
                     date: e.startDate,
                     day: diffDays === 0 ? 'Hoje' : diffDays === 1 ? 'Amanhã' : new Date(e.startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                 });
             }
        }
    });

    // Process Vacations (Starting in next 7 days)
    vacationRequests.forEach(v => {
        if (v.status !== 'aprovado') return;
        const start = new Date(v.startDate + 'T00:00:00');
        const diffTime = start.getTime() - todayTime;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 7) {
             const colab = collaborators.find(c => c.id === v.collaboratorId);
             if (colab) {
                 if (currentUserAllowedSectors.length > 0 && (!colab.sector || !currentUserAllowedSectors.includes(colab.sector))) return;
                 if (availableBranches.length > 0 && !availableBranches.includes(colab.branch)) return;
                 
                 if (filterSectors.length > 0 && (!colab.sector || !filterSectors.includes(colab.sector))) return;

                 nextWeekEvents.push({
                     id: v.id,
                     colabName: colab.name,
                     type: 'Férias',
                     desc: 'Início das Férias',
                     date: v.startDate,
                     day: diffDays === 0 ? 'Hoje' : diffDays === 1 ? 'Amanhã' : new Date(v.startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                 });
             }
        }
    });

    setUpcoming(nextWeekEvents.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

  }, [collaborators, events, onCalls, vacationRequests, filterName, filterBranches, filterRoles, filterSectors, currentUserAllowedSectors, settings.eventTypes, settings.roles, availableBranches]);

  const summaryData = useMemo(() => {
    if (!showSummary) return null;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayLocale = today.toLocaleDateString('pt-BR');

    // Helper: Check if date string matches today (ignoring time if full ISO)
    const isToday = (isoString?: string) => {
        if (!isoString) return false;
        // Simple check: starts with YYYY-MM-DD
        if (isoString.startsWith(todayStr)) return true;
        // Check with timezone adjustment if needed (assuming server saves UTC but we want local day match)
        const d = new Date(isoString);
        return d.toLocaleDateString('pt-BR') === todayLocale;
    };

    const newColabs = collaborators.filter(c => isToday(c.createdAt));
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
  }, [showSummary, collaborators, events, onCalls, vacationRequests]);

  const copySummaryToClipboard = () => {
     if (!summaryData) return;
     let text = `*Resumo Diário - ${summaryData.date}*\n\n`;
     
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
                placeholder={currentUserAllowedSectors.length > 0 ? 'Todos Permitidos' : 'Todos'}
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

      {/* Cards de Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-500 rounded-xl shadow-lg p-6 text-white relative overflow-hidden group hover:scale-[1.02] transition-transform">
          <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>
          </div>
          <p className="text-emerald-100 font-bold uppercase text-xs tracking-wider">TOTAL (FILTRADO)</p>
          <p className="text-5xl font-bold mt-2">{stats.total}</p>
        </div>

        <div className="bg-[#667eea] rounded-xl shadow-lg p-6 text-white relative overflow-hidden group hover:scale-[1.02] transition-transform">
           <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"></path></svg>
          </div>
          <p className="text-blue-100 font-bold uppercase text-xs tracking-wider">TRABALHANDO AGORA</p>
          <p className="text-5xl font-bold mt-2">{stats.active}</p>
        </div>

        <div className="bg-[#ff8c00] rounded-xl shadow-lg p-6 text-white relative overflow-hidden group hover:scale-[1.02] transition-transform">
           <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
             <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"></path></svg>
          </div>
          <p className="text-orange-100 font-bold uppercase text-xs tracking-wider">AUSENTES / FOLGA / FÉRIAS</p>
          <p className="text-5xl font-bold mt-2">{stats.inactive}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 z-0 relative">
        {/* Lista Detalhada */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 flex flex-col h-[500px]">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            Status em Tempo Real
          </h3>
          <p className="text-xs text-gray-500 mb-4">Lista de presença em tempo real.</p>
          
          <div className="overflow-y-auto flex-1 pr-2 space-y-3">
             {details.map(d => (
               <div key={d.id} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedColab(d)}>
                 <div>
                    <div className="font-bold text-gray-800 text-sm">{d.name}</div>
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
                      <div className="text-[10px] text-indigo-500 font-bold uppercase mt-1 tracking-wide">{evt.type}</div>
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
               
               <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Escala Padrão</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                     {Object.entries(selectedColab.schedule).map(([day, sch]: [string, any]) => (
                        <div key={day} className={`flex justify-between p-1.5 rounded ${sch.enabled ? 'bg-indigo-50 text-indigo-800' : 'bg-gray-50 text-gray-400'}`}>
                           <span className="capitalize font-bold">{day}</span>
                           <span>{sch.enabled ? `${sch.start} - ${sch.end}` : 'Folga'}</span>
                        </div>
                     ))}
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
