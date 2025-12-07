
import React, { useState, useMemo, useEffect } from 'react';
import { Collaborator, EventRecord, OnCallRecord, VacationRequest, SystemSettings, UserProfile } from '../types';
import { getFeriados, getWeekOfMonth } from '../utils/helpers';
import { Modal } from './ui/Modal';
import { MultiSelect } from './ui/MultiSelect';

interface CalendarProps {
  collaborators: Collaborator[];
  events: EventRecord[];
  onCalls: OnCallRecord[];
  vacationRequests: VacationRequest[];
  settings?: SystemSettings; // Opcional para compatibilidade, mas idealmente obrigatório
  currentUserProfile: UserProfile;
  currentUserAllowedSectors: string[]; // Lista de setores permitidos para visualização
  canViewPhones: boolean; // Permissão ACL
  availableBranches: string[]; // Lista de filiais permitidas
  userColabId: string | null;
}

export const Calendar: React.FC<CalendarProps> = ({ 
  collaborators, events, onCalls, vacationRequests, settings, currentUserProfile,
  currentUserAllowedSectors, canViewPhones, availableBranches, userColabId
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<{ date: string, dayEvents: any[], holiday?: string } | null>(null);
  
  // Filters (Multi-Select)
  const [filterName, setFilterName] = useState('');
  const [filterBranches, setFilterBranches] = useState<string[]>([]);
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterSectors, setFilterSectors] = useState<string[]>([]);

  // If user is restricted to only 1 sector, force filter.
  useEffect(() => {
    if (currentUserAllowedSectors.length === 1) {
      setFilterSectors([currentUserAllowedSectors[0]]);
    }
  }, [currentUserAllowedSectors]);

  // If user is restricted to only 1 branch, force filter.
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
    // 1. Strict Privacy for 'colaborador' profile
    if (currentUserProfile === 'colaborador' && userColabId) {
        if (colabId !== userColabId) return false;
    }

    const colab = collaborators.find(c => c.id === colabId);
    if (!colab) return false;

    // First check restriction permission (Sector)
    if (currentUserAllowedSectors.length > 0) {
      if (!colab.sector || !currentUserAllowedSectors.includes(colab.sector)) {
        return false;
      }
    }

    const matchesName = filterName ? colab.name.toLowerCase().includes(filterName.toLowerCase()) : true;
    
    // Multi-Select Logic: If filter array is empty, it means "All" (of the available ones), otherwise check inclusion
    const matchesBranch = filterBranches.length > 0 
      ? filterBranches.includes(colab.branch) 
      : (availableBranches.length > 0 ? availableBranches.includes(colab.branch) : true);

    const matchesRole = filterRoles.length > 0 ? filterRoles.includes(colab.role) : true;
    const matchesSector = filterSectors.length > 0 ? (colab.sector && filterSectors.includes(colab.sector)) : true;

    return matchesName && matchesBranch && matchesRole && matchesSector;
  };

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const checkDate = new Date(dateStr + 'T00:00:00');

    // 1. Database Events
    let dayEvents = events.filter(e => {
      const start = new Date(e.startDate + 'T00:00:00');
      const end = new Date(e.endDate + 'T00:00:00');
      return checkDate >= start && checkDate <= end;
    }).map(e => ({ ...e, kind: 'event' as const }));

    // 2. OnCall Shifts
    let dayOnCalls = onCalls.filter(oc => {
      const start = new Date(oc.startDate + 'T00:00:00');
      const end = new Date(oc.endDate + 'T00:00:00');
      return checkDate >= start && checkDate <= end;
    }).map(oc => ({ ...oc, kind: 'plantao' as const }));

    // 3. Vacation Requests
    let dayVacationReqs = vacationRequests.filter(v => {
      const start = new Date(v.startDate + 'T00:00:00');
      const end = new Date(v.endDate + 'T00:00:00');
      return checkDate >= start && checkDate <= end;
    }).map(v => ({ ...v, kind: 'vacation_req' as const }));

    // 4. Dynamic Rotation Rules (Escalas) - VIRTUAL EVENTS
    const virtualRotationEvents: any[] = [];
    
    // Se for Domingo, verifica regras de escala
    if (checkDate.getDay() === 0) { 
        const weekIndex = getWeekOfMonth(checkDate);
        
        collaborators.forEach(c => {
            // Verifica filtros primeiro para não processar desnecessariamente
            if (!matchesFilters(c.id)) return;
            
            // Só aplica se o colaborador tem escala definida
            if (c.hasRotation && c.rotationGroup) {
                const rule = settings?.shiftRotations.find(r => r.id === c.rotationGroup);
                
                // Se existe regra, verifica se é dia de trabalho ou folga
                if (rule) {
                    const isWorkingSunday = rule.workSundays.includes(weekIndex);
                    
                    // Verifica se já existe um evento explícito (ex: Férias, Atestado) que sobrepõe
                    // Se houver, o evento explícito tem precedência visual
                    const hasExplicitEvent = [...dayEvents, ...dayVacationReqs].some(e => e.collaboratorId === c.id);
                    
                    if (!hasExplicitEvent) {
                        if (!isWorkingSunday) {
                            // É DOMINGO DE FOLGA PELA ESCALA
                            virtualRotationEvents.push({
                                id: `rot-off-${c.id}-${dateStr}`,
                                collaboratorId: c.id,
                                kind: 'rotation_off',
                                typeLabel: 'Folga de Escala'
                            });
                        }
                        // NOTA: Domingos trabalhados (isWorkingSunday === true) NÃO são adicionados 
                        // para não poluir o calendário, conforme solicitado.
                    }
                }
            }
        });
    }

    // Apply filters to standard events
    dayEvents = dayEvents.filter(e => matchesFilters(e.collaboratorId));
    dayOnCalls = dayOnCalls.filter(oc => matchesFilters(oc.collaboratorId));
    dayVacationReqs = dayVacationReqs.filter(v => matchesFilters(v.collaboratorId));

    return [...dayEvents, ...dayOnCalls, ...dayVacationReqs, ...virtualRotationEvents];
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
  
  const getCollaboratorPhone = (id: string) => {
    return collaborators.find(c => c.id === id)?.phone || null;
  };

  const getCollaboratorOtherContact = (id: string) => {
    return collaborators.find(c => c.id === id)?.otherContact || null;
  };
  
  const getCollaboratorScaleInfo = (id: string) => {
    const c = collaborators.find(c => c.id === id);
    if (c?.hasRotation && c?.rotationGroup) return `[Escala ${c.rotationGroup}]`;
    return null;
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
                 if(item.status === 'aprovado') colorClass = 'bg-blue-100 text-blue-800 border border-blue-300';
                 else if (item.status === 'nova_opcao') colorClass = 'bg-blue-100 text-blue-800 border border-blue-300';
                 else colorClass = 'bg-gray-100 text-gray-600 border border-dashed border-gray-400';
              } else if (item.kind === 'rotation_off') {
                 colorClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200'; // Folga de Escala
              } else if (item.kind === 'event') {
                // Dynamic colors based on legacy type or default
                if (item.type === 'ferias') colorClass = 'bg-blue-100 text-blue-800';
                else if (item.type === 'folga') colorClass = 'bg-emerald-100 text-emerald-800';
                else if (item.type === 'trabalhado') colorClass = 'bg-red-100 text-red-800';
                else colorClass = 'bg-indigo-100 text-indigo-800'; // Default for custom
              }

              const isReq = item.kind === 'vacation_req';
              const reqLabel = isReq ? (item.status === 'aprovado' ? '(Aprov.)' : item.status === 'nova_opcao' ? '(Opção)' : '(Prev.)') : '';
              
              // Simplifica label para virtual events
              const virtualLabel = (item.kind === 'rotation_off') ? '(Folga Escala)' : '';

              return (
                <div key={idx} className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 truncate ${colorClass}`}>
                  <div className={`w-1.5 h-1.5 rounded-full bg-current shrink-0`}></div>
                  <span className="truncate font-medium">
                    {getCollaboratorName(item.collaboratorId)} {reqLabel} {virtualLabel}
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-lg border border-gray-100 z-20 relative">
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
              <MultiSelect 
                label="Filiais"
                options={availableBranches}
                selected={filterBranches}
                onChange={setFilterBranches}
                placeholder={availableBranches.length > 1 ? 'Todas' : 'Sua Filial'}
                disabled={availableBranches.length === 1}
              />
           </div>

           <div>
              <MultiSelect 
                label="Setor / Squad"
                options={availableSectors}
                selected={filterSectors}
                onChange={setFilterSectors}
                placeholder={currentUserAllowedSectors.length > 0 ? 'Todos Permitidos' : 'Todos'}
                disabled={currentUserAllowedSectors.length === 1}
              />
           </div>

           <div>
              <MultiSelect 
                label="Função"
                options={settings?.roles.map(r => r.name) || []}
                selected={filterRoles}
                onChange={setFilterRoles}
                placeholder="Todas"
              />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2 z-10 relative">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="text-center font-bold text-gray-500 text-xs uppercase py-2 bg-gray-50 rounded-md">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 z-0 relative">
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
              const scaleInfo = getCollaboratorScaleInfo(e.collaboratorId);
              const phone = getCollaboratorPhone(e.collaboratorId);
              const otherContact = getCollaboratorOtherContact(e.collaboratorId);
              let borderClass = '';
              let bgClass = '';
              let title = '';
              
              if (e.kind === 'plantao') {
                borderClass = 'border-orange-400';
                bgClass = 'bg-orange-50';
                title = 'Plantão';
              } else if (e.kind === 'vacation_req') {
                 if(e.status === 'aprovado') { borderClass = 'border-blue-500'; bgClass = 'bg-blue-50'; title = 'Férias Aprovadas'; }
                 else if(e.status === 'nova_opcao') { borderClass = 'border-blue-500'; bgClass = 'bg-blue-50'; title = 'Nova Opção de Férias'; }
                 else { borderClass = 'border-gray-400 border-dashed'; bgClass = 'bg-gray-50'; title = `Previsão (${e.status === 'negociacao' ? 'Em Negociação' : e.status})`; }
              } else if (e.kind === 'rotation_off') {
                 borderClass = 'border-emerald-400';
                 bgClass = 'bg-emerald-50';
                 title = 'Folga de Escala (Domingo)';
              } else if (e.kind === 'event') {
                title = getEventTypeLabel(e);
                if (e.type === 'ferias') { borderClass = 'border-blue-400'; bgClass = 'bg-blue-50'; }
                else if (e.type === 'folga') { borderClass = 'border-emerald-400'; bgClass = 'bg-emerald-50'; }
                else if (e.type === 'trabalhado') { borderClass = 'border-red-400'; bgClass = 'bg-red-50'; }
                else { borderClass = 'border-indigo-400'; bgClass = 'bg-indigo-50'; }
              }

              return (
                <div key={idx} className={`p-3 border-l-4 rounded-r-md ${borderClass} ${bgClass} transition-all hover:shadow-md`}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-gray-800 text-sm leading-snug break-words">{name}</span>
                        {scaleInfo && <span className="text-[10px] font-bold text-purple-700 mt-0.5">{scaleInfo}</span>}
                        
                         {/* Contacts inside the left column to align with name */}
                         {canViewPhones && (phone || otherContact) && (
                            <div className="flex flex-col gap-0.5 mt-1.5">
                               {phone && <div className="text-xs text-gray-600 font-medium flex items-center gap-1">📞 {phone}</div>}
                               {otherContact && <div className="text-xs text-indigo-600 font-medium flex items-center gap-1">💬 {otherContact}</div>}
                            </div>
                         )}
                    </div>
                    
                    <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded bg-white/60 border border-black/5 text-gray-700 shadow-sm text-right max-w-[120px] whitespace-normal leading-tight">
                            {title}
                        </span>
                        {e.kind === 'plantao' && (
                           <span className="text-xs font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                             {e.startTime} - {e.endTime}
                           </span>
                        )}
                    </div>
                  </div>

                  {/* Observations */}
                  {((e.kind === 'vacation_req' && e.notes) || e.observation) && (
                      <div className="mt-2 text-xs text-gray-600 bg-white/50 p-2 rounded border border-black/5">
                          {(e.kind === 'vacation_req' && e.notes) && <div className="italic">Obs: {e.notes}</div>}
                          {e.observation && <div className="italic">Obs: {e.observation}</div>}
                      </div>
                  )}
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
