

import React, { useEffect, useState } from 'react';
import { Collaborator, EventRecord, OnCallRecord, Schedule, SystemSettings } from '../types';
import { weekDayMap } from '../utils/helpers';

interface DashboardProps {
  collaborators: Collaborator[];
  events: EventRecord[];
  onCalls: OnCallRecord[];
  settings: SystemSettings;
}

export const Dashboard: React.FC<DashboardProps> = ({ collaborators, events, onCalls, settings }) => {
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [details, setDetails] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterRole, setFilterRole] = useState('');

  // Helpers para navegação de dias
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
    const todayStr = now.toISOString().split('T')[0];
    
    // Converter hora atual para minutos para comparações
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const currentDayIndex = now.getDay();
    const currentDayKey = weekDayMap[currentDayIndex] as keyof Schedule;
    const prevDayKey = getPrevDayKey(currentDayIndex);
    const nextDayKey = getNextDayKey(currentDayIndex);

    let activeCount = 0;
    let inactiveCount = 0;
    const tempDetails: any[] = [];

    // Apply filters to collaborators first
    const filteredCollaborators = collaborators.filter(c => {
      const matchesName = filterName ? c.name.toLowerCase().includes(filterName.toLowerCase()) : true;
      const matchesBranch = filterBranch ? c.branch === filterBranch : true;
      const matchesRole = filterRole ? c.role === filterRole : true;
      return matchesName && matchesBranch && matchesRole;
    });

    filteredCollaborators.forEach(c => {
      // 1. Checar Eventos (Prioridade máxima: Férias, Folga)
      const todayEvent = events.find(e => {
        const start = new Date(e.startDate + 'T00:00:00');
        const end = new Date(e.endDate + 'T00:00:00');
        const check = new Date(todayStr + 'T00:00:00');
        return e.collaboratorId === c.id && check >= start && check <= end;
      });

      // 2. Checar Plantões
      const todayOnCall = onCalls.find(oc => {
        const start = new Date(oc.startDate + 'T00:00:00');
        const end = new Date(oc.endDate + 'T00:00:00');
        const check = new Date(todayStr + 'T00:00:00');
        
        if (oc.collaboratorId === c.id && check >= start && check <= end) {
           const [sh, sm] = oc.startTime.split(':').map(Number);
           const [eh, em] = oc.endTime.split(':').map(Number);
           const startMins = sh * 60 + sm;
           const endMins = eh * 60 + em;
           
           if (startMins < endMins) {
               if (currentMinutes >= startMins && currentMinutes <= endMins) return true;
           } else {
               if (currentMinutes >= startMins || currentMinutes <= endMins) return true;
           }
        }
        return false;
      });

      // 3. Checar Escala
      let isWorkingShift = false;

      const isShiftActive = (scheduleDay: any, context: 'today' | 'yesterday' | 'tomorrow') => {
         if (!scheduleDay.enabled || !scheduleDay.start || !scheduleDay.end) return false;

         const [sh, sm] = scheduleDay.start.split(':').map(Number);
         const [eh, em] = scheduleDay.end.split(':').map(Number);
         const startMins = sh * 60 + sm;
         const endMins = eh * 60 + em;
         const startsPreviousDay = !!scheduleDay.startsPreviousDay;

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

      if (isShiftActive(c.schedule[prevDayKey], 'yesterday')) isWorkingShift = true;
      if (!isWorkingShift && isShiftActive(c.schedule[currentDayKey], 'today')) isWorkingShift = true;
      if (!isWorkingShift && isShiftActive(c.schedule[nextDayKey], 'tomorrow')) isWorkingShift = true;

      // Definir Status
      let status = 'Fora do Horário';
      let statusColor = 'bg-blue-100 text-blue-800';
      let isActive = false;

      if (todayEvent) {
        const evtType = settings.eventTypes.find(t => t.id === todayEvent.type);
        const isHolidayLike = todayEvent.type === 'ferias' || (evtType && evtType.behavior === 'neutral');
        const isOffLike = todayEvent.type === 'folga' || (evtType && evtType.behavior === 'debit');
        
        if (isHolidayLike) {
          status = todayEvent.typeLabel || evtType?.label || 'Férias/Ausência';
          statusColor = 'bg-purple-100 text-purple-800';
          inactiveCount++;
        } else if (isOffLike) {
          status = todayEvent.typeLabel || evtType?.label || 'Folga';
          statusColor = 'bg-emerald-100 text-emerald-800';
          inactiveCount++;
        } else {
          status = isWorkingShift ? 'Trabalhando (Extra)' : 'Dia Extra (Fora Horário)';
          statusColor = 'bg-red-100 text-red-800';
          if (isWorkingShift) { activeCount++; isActive = true; }
          else inactiveCount++;
        }
      } else if (todayOnCall) {
        status = 'Plantão';
        statusColor = 'bg-orange-100 text-orange-800';
        activeCount++;
        isActive = true;
      } else {
        if (isWorkingShift) {
          status = 'Trabalhando';
          statusColor = 'bg-green-100 text-green-800';
          activeCount++;
          isActive = true;
        } else {
          inactiveCount++;
        }
      }

      tempDetails.push({
        name: c.name,
        role: c.role,
        shift: c.shiftType,
        branch: c.branch,
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

    setDetails(tempDetails.sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1)));

    // Upcoming: Filter based on the selected collaborators too
    const filteredIds = filteredCollaborators.map(c => c.id);
    const nextEvents = [...events.map(e => ({...e, k: 'evt'})), ...onCalls.map(o => ({...o, k: 'oc'}))]
      .filter(x => filteredIds.includes(x.collaboratorId) && new Date(x.startDate) >= new Date(todayStr))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5);
    
    setUpcoming(nextEvents);

  }, [collaborators, events, onCalls, settings, filterName, filterBranch, filterRole]);

  return (
    <div className="space-y-6">
       {/* Filter Bar */}
       <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
          <div className="text-xs font-bold text-gray-500 mb-2 uppercase">Filtros do Dashboard</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
             <input 
               type="text" 
               placeholder="Buscar por nome..." 
               className="w-full border border-gray-300 rounded-md p-2 text-sm"
               value={filterName}
               onChange={e => setFilterName(e.target.value)}
             />
             <select 
               className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white"
               value={filterBranch}
               onChange={e => setFilterBranch(e.target.value)}
             >
               <option value="">Todas as Filiais</option>
               {settings.branches.map(b => <option key={b} value={b}>{b}</option>)}
             </select>
             <select 
               className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white"
               value={filterRole}
               onChange={e => setFilterRole(e.target.value)}
             >
               <option value="">Todas as Funções</option>
               {settings.roles.map(r => <option key={r} value={r}>{r}</option>)}
             </select>
          </div>
       </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 text-white shadow-lg">
          <div className="text-sm font-medium opacity-90 uppercase tracking-wide mb-1">Total (Filtrado)</div>
          <div className="text-4xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
          <div className="text-sm font-medium opacity-90 uppercase tracking-wide mb-1">Trabalhando Agora</div>
          <div className="text-4xl font-bold">{stats.active}</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="text-sm font-medium opacity-90 uppercase tracking-wide mb-1">Ausentes / Folga</div>
          <div className="text-4xl font-bold">{stats.inactive}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
           <h3 className="text-lg font-bold text-gray-800 mb-4">Status em Tempo Real</h3>
           <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
             {details.length === 0 && <p className="text-gray-400 text-sm">Nenhum colaborador encontrado com os filtros atuais.</p>}
             {details.map((d, i) => (
               <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                 <div>
                   <div className="font-bold text-gray-800 text-sm">{d.name}</div>
                   <div className="text-xs text-gray-500">{d.role} • {d.branch}</div>
                 </div>
                 <span className={`text-xs font-bold px-2 py-1 rounded-full ${d.statusColor}`}>
                   {d.status}
                 </span>
               </div>
             ))}
           </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
           <h3 className="text-lg font-bold text-gray-800 mb-4">Próximos Eventos (Filtrados)</h3>
           <div className="space-y-3">
             {upcoming.length === 0 && <p className="text-gray-400 text-sm">Nada previsto.</p>}
             {upcoming.map((u, i) => {
               const colabName = collaborators.find(c => c.id === u.collaboratorId)?.name || '???';
               const dateStr = new Date(u.startDate + 'T00:00:00').toLocaleDateString('pt-BR');
               
               // Resolve Label
               let typeLabel = 'Evento';
               if (u.k === 'oc') typeLabel = 'Plantão';
               else {
                   const typeConfig = settings.eventTypes.find(t => t.id === u.type);
                   typeLabel = u.typeLabel || typeConfig?.label || u.type;
               }

               return (
                 <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                   <div className="bg-white border border-gray-200 p-2 rounded text-center min-w-[50px]">
                     <div className="text-xs font-bold text-gray-500">{dateStr.split('/')[0]}</div>
                     <div className="text-[10px] text-gray-400">{dateStr.split('/')[1]}</div>
                   </div>
                   <div>
                     <div className="text-sm font-bold text-gray-800">{colabName}</div>
                     <div className="text-xs text-gray-500">{typeLabel}</div>
                   </div>
                 </div>
               );
             })}
           </div>
        </div>
      </div>
    </div>
  );
};
