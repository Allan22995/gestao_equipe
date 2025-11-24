

import React, { useEffect, useState, useMemo } from 'react';
import { Collaborator, EventRecord, OnCallRecord, Schedule, SystemSettings, VacationRequest, UserProfile } from '../types';
import { weekDayMap } from '../utils/helpers';
import { Modal } from './ui/Modal';

interface DashboardProps {
  collaborators: Collaborator[];
  events: EventRecord[];
  onCalls: OnCallRecord[];
  vacationRequests: VacationRequest[];
  settings: SystemSettings;
  currentUserProfile: UserProfile;
  currentUserAllowedSectors: string[];
  canViewPhones: boolean; // Permissão ACL
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  collaborators, events, onCalls, vacationRequests, settings, currentUserProfile,
  currentUserAllowedSectors, canViewPhones
}) => {
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [details, setDetails] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [selectedColab, setSelectedColab] = useState<any | null>(null);

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterSector, setFilterSector] = useState('');

  // Force Sector Filter if Restricted (single sector)
  useEffect(() => {
    if (currentUserAllowedSectors.length === 1) {
      setFilterSector(currentUserAllowedSectors[0]);
    }
  }, [currentUserAllowedSectors]);

  // Available sectors for filter dropdown
  const availableSectors = useMemo(() => {
    if (!settings?.sectors) return [];
    if (currentUserAllowedSectors.length === 0) return settings.sectors; // All
    return settings.sectors.filter(s => currentUserAllowedSectors.includes(s));
  }, [settings?.sectors, currentUserAllowedSectors]);

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
    
    // CORREÇÃO: Usar data local para evitar problemas de fuso horário (UTC vs Local)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
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
      // Security Filter (Allowed Sectors)
      if (currentUserAllowedSectors.length > 0) {
        if (!c.sector || !currentUserAllowedSectors.includes(c.sector)) return false;
      }

      const matchesName = filterName ? c.name.toLowerCase().includes(filterName.toLowerCase()) : true;
      const matchesBranch = filterBranch ? c.branch === filterBranch : true;
      const matchesRole = filterRole ? c.role === filterRole : true;
      const matchesSector = filterSector ? c.sector === filterSector : true;
      return matchesName && matchesBranch && matchesRole && matchesSector;
    });

    filteredCollaborators.forEach(c => {
      // 0. Checar Previsão de Férias Aprovada (PRIORIDADE MÁXIMA)
      const approvedVacation = vacationRequests.find(v => {
        if (v.collaboratorId !== c.id || v.status !== 'aprovado') return false;
        const start = new Date(v.startDate + 'T00:00:00');
        const end = new Date(v.endDate + 'T00:00:00');
        const check = new Date(todayStr + 'T00:00:00');
        return check >= start && check <= end;
      });

      // 1. Checar Plantões (PRIORIDADE SOBRE EVENTOS DE FOLGA)
      const todayOnCall = onCalls.find(oc => {
        if (oc.collaboratorId !== c.id) return false;

        const start = new Date(oc.startDate + 'T00:00:00');
        const end = new Date(oc.endDate + 'T00:00:00');
        const check = new Date(todayStr + 'T00:00:00');

        // Verifica se a data de hoje está dentro do intervalo do plantão
        if (check >= start && check <= end) {
           const [sh, sm] = oc.startTime.split(':').map(Number);
           const [eh, em] = oc.endTime.split(':').map(Number);
           const startMins = sh * 60 + sm;
           const endMins = eh * 60 + em;
           
           // Turno no mesmo dia (ex: 08:00 as 18:00)
           if (startMins < endMins) {
               return currentMinutes >= startMins && currentMinutes <= endMins;
           } 
           // Turno que vira a noite (ex: 22:00 as 06:00)
           else {
               const isStartDay = check.getTime() === start.getTime();
               const isEndDay = check.getTime() === end.getTime();

               if (isStartDay && isEndDay) {
                   // Caso raro de iniciar e terminar no mesmo dia com hora invertida (normalmente erro de cadastro ou cobre 24h)
                   return currentMinutes >= startMins || currentMinutes <= endMins;
               }

               if (isStartDay) {
                   // Se for o dia de início, tem que ser DEPOIS do horário de início
                   return currentMinutes >= startMins;
               }
               if (isEndDay) {
                   // Se for o dia do fim, tem que ser ANTES do horário de fim
                   return currentMinutes <= endMins;
               }
               // Se for um dia no meio (nem inicio nem fim), está de plantão o dia todo
               return true;
           }
        }
        return false;
      });

      // 2. Checar Eventos (Legado)
      const todayEvent = events.find(e => {
        const start = new Date(e.startDate + 'T00:00:00');
        const end = new Date(e.endDate + 'T00:00:00');
        const check = new Date(todayStr + 'T00:00:00');
        return e.collaboratorId === c.id && check >= start && check <= end;
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

      // Lógica de Prioridade Ajustada:
      // 1. Férias Aprovadas (Ausente)
      // 2. Plantão (Ativo - SOBREPOE FOLGAS)
      // 3. Outros Eventos (Folga, Férias Pendentes, etc)
      // 4. Escala Normal

      if (approvedVacation) {
        status = 'Férias (Aprovadas)';
        statusColor = 'bg-purple-100 text-purple-800';
        inactiveCount++;
        isActive = false;
      } else if (todayOnCall) {
        status = 'Plantão (Ativo)';
        statusColor = 'bg-orange-100 text-orange-800';
        activeCount++;
        isActive = true;
      } else if (todayEvent) {
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
          // Tipo "trabalhado" ou outros que contam como presença
          status = isWorkingShift ? 'Trabalhando (Extra)' : 'Dia Extra (Fora Horário)';
          statusColor = 'bg-red-100 text-red-800';
          if (isWorkingShift) { activeCount++; isActive = true; }
          else inactiveCount++;
        }
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
        id: c.id,
        name: c.name,
        phone: c.phone,
        role: c.role,
        sector: c.sector,
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

    // Upcoming Logic
    const filteredIds = filteredCollaborators.map(c => c.id);
    
    const vacationEvents = vacationRequests
      .filter(v => v.status === 'aprovado')
      .map(v => ({
        collaboratorId: v.collaboratorId,
        startDate: v.startDate,
        endDate: v.endDate,
        k: 'vacation',
        typeLabel: 'Férias (Aprovadas)',
        type: 'ferias_aprovadas'
      }));

    const allUpcoming = [
      ...events.map(e => ({...e, k: 'evt'})),
      ...onCalls.map(o => ({...o, k: 'oc'})),
      ...vacationEvents
    ];

    const nextEvents = allUpcoming
      .filter(x => filteredIds.includes(x.collaboratorId) && new Date(x.startDate) >= new Date(todayStr))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5);
    
    setUpcoming(nextEvents);

  }, [collaborators, events, onCalls, vacationRequests, settings, filterName, filterBranch, filterRole, filterSector, currentUserAllowedSectors]);

  return (
    <div className="space-y-6">
       {/* Filter Bar */}
       <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
          <div className="text-xs font-bold text-gray-500 mb-2 uppercase">Filtros do Dashboard</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
               className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-500"
               value={filterSector}
               onChange={e => setFilterSector(e.target.value)}
               disabled={currentUserAllowedSectors.length === 1}
             >
               <option value="">{currentUserAllowedSectors.length > 0 ? 'Todos Permitidos' : 'Todos os Setores'}</option>
               {availableSectors.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
             <select 
               className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white"
               value={filterRole}
               onChange={e => setFilterRole(e.target.value)}
             >
               <option value="">Todas as Funções</option>
               {settings.roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
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
          <div className="text-sm font-medium opacity-90 uppercase tracking-wide mb-1">Ausentes / Folga / Férias</div>
          <div className="text-4xl font-bold">{stats.inactive}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
           <h3 className="text-lg font-bold text-gray-800 mb-4">Status em Tempo Real</h3>
           <p className="text-xs text-gray-500 mb-3">
             {canViewPhones ? 'Clique no colaborador para ver detalhes de contato.' : 'Lista de presença em tempo real.'}
           </p>
           <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
             {details.length === 0 && <p className="text-gray-400 text-sm">Nenhum colaborador encontrado com os filtros atuais.</p>}
             {details.map((d, i) => (
               <div 
                 key={i} 
                 onClick={() => canViewPhones && setSelectedColab(d)}
                 className={`flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 transition-colors ${canViewPhones ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-200' : ''}`}
               >
                 <div>
                   <div className="font-bold text-gray-800 text-sm">{d.name}</div>
                   <div className="text-xs text-gray-500">
                      {d.role} • {d.branch}
                      {d.sector && <span className="ml-1 text-indigo-600">• {d.sector}</span>}
                   </div>
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
               else if (u.k === 'vacation') typeLabel = u.typeLabel;
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

      <Modal 
        isOpen={!!selectedColab} 
        onClose={() => setSelectedColab(null)} 
        title="Detalhes do Colaborador"
      >
        <div className="space-y-4">
           <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl">
               {selectedColab?.name.charAt(0)}
             </div>
             <div>
               <h3 className="font-bold text-lg text-gray-800">{selectedColab?.name}</h3>
               <p className="text-sm text-gray-500">{selectedColab?.role} • {selectedColab?.branch}</p>
               {selectedColab?.sector && <p className="text-sm text-indigo-600 font-medium">Setor: {selectedColab.sector}</p>}
             </div>
           </div>

           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
             <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Status Atual</label>
             <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${selectedColab?.statusColor}`}>
               {selectedColab?.status}
             </span>
           </div>

           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Contato</label>
              {selectedColab?.phone ? (
                 <a href={`tel:${selectedColab.phone}`} className="flex items-center gap-2 text-lg font-bold text-indigo-600 hover:underline">
                   📞 {selectedColab.phone}
                 </a>
              ) : (
                 <p className="text-gray-500 italic">Telefone não cadastrado.</p>
              )}
           </div>

           <div className="flex justify-end">
             <button 
               onClick={() => setSelectedColab(null)}
               className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
             >
               Fechar
             </button>
           </div>
        </div>
      </Modal>
    </div>
  );
};
