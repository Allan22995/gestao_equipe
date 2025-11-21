

import React, { useState, useMemo } from 'react';
import { Collaborator, EventRecord, OnCallRecord, VacationRequest, SystemSettings } from '../types';
import { getFeriados } from '../utils/helpers';
import { Modal } from './ui/Modal';

interface CalendarProps {
  collaborators: Collaborator[];
  events: EventRecord[];
  onCalls: OnCallRecord[];
  vacationRequests: VacationRequest[];
  settings?: SystemSettings; // Opcional para compatibilidade, mas idealmente obrigatório
}

export const Calendar: React.FC<CalendarProps> = ({ collaborators, events, onCalls, vacationRequests, settings }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<{ date: string, dayEvents: any[], holiday?: string } | null>(null);
  
  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const holidays = useMemo(() => getFeriados(year), [year]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Helper to check filters against a collaborator ID
  const matchesFilters = (colabId: string) => {
    const colab = collaborators.find(c => c.id === colabId);
    if (!colab) return false;

    const matchesName = filterName ? colab.name.toLowerCase().includes(filterName.toLowerCase()) : true;
    const matchesBranch = filterBranch ? colab.branch === filterBranch : true;
    const matchesRole = filterRole ? colab.role === filterRole : true;

    return matchesName && matchesBranch && matchesRole;
  };

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const checkDate = new Date(dateStr + 'T00:00:00');

    let dayEvents = events.filter(e => {
      const start = new Date(e.startDate + 'T00:00:00');
      const end = new Date(e.endDate + 'T00:00:00');
      return checkDate >= start && checkDate <= end;
    }).map(e => ({ ...e, kind: 'event' as const }));

    let dayOnCalls = onCalls.filter(oc => {
      const start = new Date(oc.startDate + 'T00:00:00');
      const end = new Date(oc.endDate + 'T00:00:00');
      return checkDate >= start && checkDate <= end;
    }).map(oc => ({ ...oc, kind: 'plantao' as const }));

    let dayVacationReqs = vacationRequests.filter(v => {
      const start = new Date(v.startDate + 'T00:00:00');
      const end = new Date(v.endDate + 'T00:00:00');
      return checkDate >= start && checkDate <= end;
    }).map(v => ({ ...v, kind: 'vacation_req' as const }));

    // Apply filters
    dayEvents = dayEvents.filter(e => matchesFilters(e.collaboratorId));
    dayOnCalls = dayOnCalls.filter(oc => matchesFilters(oc.collaboratorId));
    dayVacationReqs = dayVacationReqs.filter(v => matchesFilters(v.collaboratorId));

    return [...dayEvents, ...dayOnCalls, ...dayVacationReqs];
  };

  const handleDayClick = (day: number, dayEvents: any[], holiday?: string) => {
    if (dayEvents.length > 0 || holiday) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      setSelectedDay({ date: dateStr, dayEvents, holiday });
    }
  };

  const getCollaboratorName = (id: string) => {
    return collaborators.find(c => c.id === id)?.name || 'Desconhecido';
  };

  const getEventTypeLabel = (evt: EventRecord) => {
    if (evt.typeLabel) return evt.typeLabel;
    // Fallback for legacy
    if (evt.type === 'ferias') return 'Férias';
    if (evt.type === 'folga') return 'Folga';
    if (evt.type === 'trabalhado') return 'Trabalhado';
    // Try to find in settings
    const found = settings?.eventTypes.find(t => t.id === evt.type);
    return found ? found.label : evt.type;
  };

  const renderCalendarGrid = () => {
    const grid = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      grid.push(<div key={`empty-${i}`} className="min-h-[100px] bg-gray-50 border border-gray-200/50"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const holiday = holidays[dateStr];
      const dayEvents = getEventsForDay(day);
      const hasEvents = dayEvents.length > 0 || holiday;

      grid.push(
        <div
          key={day}
          onClick={() => handleDayClick(day, dayEvents, holiday)}
          className={`min-h-[100px] p-2 border border-gray-200 rounded-lg transition-all ${
            hasEvents ? 'bg-white hover:shadow-md cursor-pointer' : 'bg-white'
          } ${holiday ? 'bg-amber-50 border-amber-200' : ''}`}
        >
          <div className={`text-sm font-bold mb-1 ${holiday ? 'text-amber-700' : 'text-gray-700'}`}>{day}</div>
          
          {holiday && (
            <div className="mb-1 text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md inline-block truncate w-full">
              🎉 {holiday}
            </div>
          )}

          <div className="space-y-1">
            {dayEvents.slice(0, 3).map((item: any, idx) => {
              let colorClass = '';
              
              if (item.kind === 'plantao') {
                colorClass = 'bg-orange-100 text-orange-800';
              } else if (item.kind === 'vacation_req') {
                 if(item.status === 'aprovado') colorClass = 'bg-green-100 text-green-800 border border-green-300';
                 else if (item.status === 'nova_opcao') colorClass = 'bg-blue-100 text-blue-800 border border-blue-300';
                 else colorClass = 'bg-gray-100 text-gray-600 border border-dashed border-gray-400';
              } else if (item.kind === 'event') {
                // Dynamic colors based on legacy type or default
                if (item.type === 'ferias') colorClass = 'bg-blue-100 text-blue-800';
                else if (item.type === 'folga') colorClass = 'bg-emerald-100 text-emerald-800';
                else if (item.type === 'trabalhado') colorClass = 'bg-red-100 text-red-800';
                else colorClass = 'bg-indigo-100 text-indigo-800'; // Default for custom
              }

              const isReq = item.kind === 'vacation_req';
              const reqLabel = isReq ? (item.status === 'aprovado' ? '(Aprov.)' : item.status === 'nova_opcao' ? '(Opção)' : '(Prev.)') : '';

              return (
                <div key={idx} className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 truncate ${colorClass}`}>
                  <div className={`w-1.5 h-1.5 rounded-full bg-current shrink-0`}></div>
                  <span className="truncate font-medium">
                    {getCollaboratorName(item.collaboratorId)} {reqLabel}
                  </span>
                </div>
              );
            })}
            {dayEvents.length > 3 && (
               <div className="text-[10px] text-gray-500 font-medium pl-1">
                 +{dayEvents.length - 3} mais...
               </div>
            )}
          </div>
        </div>
      );
    }
    return grid;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
      {/* Header e Filtros */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
           <h2 className="text-xl font-bold text-gray-800">Calendário</h2>
           <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg">
            <button onClick={prevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600">
               ←
            </button>
            <h3 className="text-lg font-bold text-gray-800 w-40 text-center">
              {monthNames[month]} {year}
            </h3>
            <button onClick={nextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600">
               →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
           <div>
             <label className="text-xs font-semibold text-gray-500 block mb-1">Nome do Colaborador</label>
             <input 
               type="text" 
               placeholder="Buscar por nome..." 
               className="w-full border border-gray-300 rounded-md p-1.5 text-sm"
               value={filterName}
               onChange={e => setFilterName(e.target.value)}
             />
           </div>
           <div>
             <label className="text-xs font-semibold text-gray-500 block mb-1">Filial</label>
             <select 
               className="w-full border border-gray-300 rounded-md p-1.5 text-sm bg-white"
               value={filterBranch}
               onChange={e => setFilterBranch(e.target.value)}
             >
               <option value="">Todas</option>
               {settings?.branches.map(b => <option key={b} value={b}>{b}</option>)}
             </select>
           </div>
           <div>
             <label className="text-xs font-semibold text-gray-500 block mb-1">Função</label>
             <select 
               className="w-full border border-gray-300 rounded-md p-1.5 text-sm bg-white"
               value={filterRole}
               onChange={e => setFilterRole(e.target.value)}
             >
               <option value="">Todas</option>
               {settings?.roles.map(r => <option key={r} value={r}>{r}</option>)}
             </select>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="text-center font-bold text-gray-500 text-xs uppercase py-2 bg-gray-50 rounded-md">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {renderCalendarGrid()}
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-600 bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center gap-2">
           <span className="w-3 h-3 rounded-full bg-blue-500"></span> Férias
        </div>
        <div className="flex items-center gap-2">
           <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Folga
        </div>
        <div className="flex items-center gap-2">
           <span className="w-3 h-3 rounded-full bg-red-500"></span> Trabalhado
        </div>
        <div className="flex items-center gap-2">
           <span className="w-3 h-3 rounded-full bg-indigo-500"></span> Outros
        </div>
        <div className="flex items-center gap-2">
           <span className="w-3 h-3 rounded-full bg-orange-500"></span> Plantão
        </div>
        <div className="flex items-center gap-2">
           <span className="w-3 h-3 rounded border border-gray-400 border-dashed bg-gray-100"></span> Prev. Férias
        </div>
        <div className="flex items-center gap-2">
           <span className="w-3 h-3 rounded bg-amber-200 border border-amber-500"></span> Feriado
        </div>
      </div>

      <Modal 
        isOpen={!!selectedDay} 
        onClose={() => setSelectedDay(null)} 
        title={selectedDay ? `Detalhes - ${new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
      >
        <div className="space-y-3">
           {selectedDay?.holiday && (
             <div className="p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-md">
               <div className="font-bold text-amber-800">🎉 {selectedDay.holiday}</div>
               <div className="text-xs text-amber-600">Feriado</div>
             </div>
           )}

           {selectedDay?.dayEvents.map((e: any, idx) => {
              const name = getCollaboratorName(e.collaboratorId);
              let borderClass = '';
              let bgClass = '';
              let title = '';
              
              if (e.kind === 'plantao') {
                borderClass = 'border-orange-400';
                bgClass = 'bg-orange-50';
                title = 'Plantão';
              } else if (e.kind === 'vacation_req') {
                 if(e.status === 'aprovado') { borderClass = 'border-green-500'; bgClass = 'bg-green-50'; title = 'Férias Aprovadas'; }
                 else if(e.status === 'nova_opcao') { borderClass = 'border-blue-500'; bgClass = 'bg-blue-50'; title = 'Nova Opção de Férias'; }
                 else { borderClass = 'border-gray-400 border-dashed'; bgClass = 'bg-gray-50'; title = `Previsão (${e.status === 'negociacao' ? 'Em Negociação' : e.status})`; }
              } else if (e.kind === 'event') {
                title = getEventTypeLabel(e);
                if (e.type === 'ferias') { borderClass = 'border-blue-400'; bgClass = 'bg-blue-50'; }
                else if (e.type === 'folga') { borderClass = 'border-emerald-400'; bgClass = 'bg-emerald-50'; }
                else if (e.type === 'trabalhado') { borderClass = 'border-red-400'; bgClass = 'bg-red-50'; }
                else { borderClass = 'border-indigo-400'; bgClass = 'bg-indigo-50'; }
              }

              return (
                <div key={idx} className={`p-3 border-l-4 rounded-r-md ${borderClass} ${bgClass}`}>
                  <div className="font-bold text-gray-800 flex justify-between">
                    <span>{name}</span>
                    <span className="text-xs font-normal opacity-75 uppercase tracking-wider">{title}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {e.kind === 'plantao' ? `${e.startTime} - ${e.endTime}` : ''}
                    {(e.kind === 'vacation_req' && e.notes) ? <span className="block mt-1 italic text-xs">Obs: {e.notes}</span> : ''}
                    {e.observation && <span className="block mt-1 italic text-xs">Obs: {e.observation}</span>}
                  </div>
                </div>
              );
           })}

           {!selectedDay?.holiday && selectedDay?.dayEvents.length === 0 && (
             <div className="text-center text-gray-500 py-4">Nenhum evento filtrado neste dia.</div>
           )}
        </div>
      </Modal>
    </div>
  );
};
