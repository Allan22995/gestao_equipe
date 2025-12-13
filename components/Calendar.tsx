import React, { useState, useMemo, useEffect } from 'react';
import { Collaborator, EventRecord, OnCallRecord, VacationRequest, SystemSettings, UserProfile } from '../types';
import { getFeriados, checkRotationDay } from '../utils/helpers';
import { Modal } from './ui/Modal';
import { MultiSelect } from './ui/MultiSelect';

interface CalendarProps {
  collaborators: Collaborator[];
  events: EventRecord[];
  onCalls: OnCallRecord[];
  vacationRequests: VacationRequest[];
  settings?: SystemSettings;
  currentUserProfile: UserProfile;
  currentUserAllowedSectors: string[];
  canViewPhones: boolean;
  availableBranches: string[];
  userColabId: string | null;
}

// Paleta de cores para eventos personalizados (Dinâmicos)
const DYNAMIC_COLORS = [
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-lime-100 text-lime-800 border-lime-200',
  'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-violet-100 text-violet-800 border-violet-200',
];

export const Calendar: React.FC<CalendarProps> = ({ 
  collaborators, events, onCalls, vacationRequests, settings, currentUserProfile,
  currentUserAllowedSectors, canViewPhones, availableBranches, userColabId
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<{ date: string, dayEvents: any[], holiday?: string } | null>(null);
  
  // State para o filtro da legenda (Tipo de evento)
  const [legendFilter, setLegendFilter] = useState<string | null>(null);

  // Filters (Multi-Select)
  const [filterName, setFilterName] = useState('');
  const [filterBranches, setFilterBranches] = useState<string[]>([]);
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterSectors, setFilterSectors] = useState<string[]>([]);

  // Filtrar colaboradores ativos primeiro
  const activeCollaborators = useMemo(() => {
     return collaborators.filter(c => c.active !== false);
  }, [collaborators]);

  // Force filters based on permissions
  useEffect(() => {
    if (currentUserAllowedSectors.length === 1) setFilterSectors([currentUserAllowedSectors[0]]);
    if (availableBranches.length === 1) setFilterBranches([availableBranches[0]]);
  }, [currentUserAllowedSectors, availableBranches]);

  // Available sectors logic
  const availableSectors = useMemo(() => {
    if (!settings) return [];
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

  // Reset sector filter
  useEffect(() => {
      if (filterSectors.length > 0) {
          const validSectors = filterSectors.filter(s => availableSectors.includes(s));
          if (validSectors.length !== filterSectors.length) {
              setFilterSectors(validSectors);
          }
      }
  }, [availableSectors, filterSectors]);

  // Available Roles logic
  const availableRoles = useMemo(() => {
    let filtered = activeCollaborators;
    if (currentUserAllowedSectors.length > 0) {
      filtered = filtered.filter(c => c.sector && currentUserAllowedSectors.includes(c.sector));
    }
    if (filterBranches.length > 0) {
        filtered = filtered.filter(c => filterBranches.includes(c.branch));
    } else if (availableBranches.length > 0) {
        filtered = filtered.filter(c => availableBranches.includes(c.branch));
    }
    if (filterSectors.length > 0) {
      filtered = filtered.filter(c => c.sector && filterSectors.includes(c.sector));
    }
    if (filterBranches.length > 0 || filterSectors.length > 0 || availableBranches.length > 0 || currentUserAllowedSectors.length > 0) {
       const rolesInUse = new Set(filtered.map(c => c.role));
       return Array.from(rolesInUse).sort();
    }
    return settings?.roles.map(r => r.name).sort() || [];
  }, [activeCollaborators, filterBranches, filterSectors, currentUserAllowedSectors, settings?.roles, availableBranches]);

  useEffect(() => {
     if (filterRoles.length > 0) {
        const validRoles = filterRoles.filter(r => availableRoles.includes(r));
        if (validRoles.length !== filterRoles.length) {
           setFilterRoles(validRoles);
        }
     }
  }, [availableRoles, filterRoles]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const holidays = useMemo(() => getFeriados(year), [year]);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // --- HELPER: Cores e Estilos ---
  const getEventStyle = (typeId: string, kind: string, status?: string) => {
      // 1. Status Pendente (Visual diferenciado)
      if (status && status !== 'aprovado') {
          return 'bg-gray-100 text-gray-500 border border-dashed border-gray-400';
      }

      // 2. Tipos Fixos do Sistema
      if (kind === 'plantao') return 'bg-orange-100 text-orange-800 border border-orange-200';
      if (kind === 'rotation_off') return 'bg-teal-100 text-teal-800 border border-teal-200'; // Folga Escala distinct color
      if (kind === 'vacation_req') return 'bg-blue-100 text-blue-800 border border-blue-200'; // Solicitacao de ferias aprovada vira 'ferias' visualmente

      // 3. Mapeamento de Tipos de Eventos (Configurações)
      if (typeId === 'ferias') return 'bg-blue-100 text-blue-800 border border-blue-200';
      if (typeId === 'folga') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      if (typeId === 'trabalhado') return 'bg-red-100 text-red-800 border border-red-200';

      // 4. Cores Dinâmicas para Tipos Personalizados
      // Tenta encontrar o índice do tipo nas configurações para atribuir uma cor consistente
      const customIndex = settings?.eventTypes.filter(t => !['ferias', 'folga', 'trabalhado'].includes(t.id)).findIndex(t => t.id === typeId);
      
      if (customIndex !== undefined && customIndex >= 0) {
          return DYNAMIC_COLORS[customIndex % DYNAMIC_COLORS.length];
      }

      // Fallback
      return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
  };

  const matchesFilters = (colabId: string) => {
    if (currentUserProfile === 'colaborador' && userColabId) {
        if (colabId !== userColabId) return false;
    }
    const colab = activeCollaborators.find(c => c.id === colabId);
    if (!colab) return false;

    if (currentUserAllowedSectors.length > 0) {
      if (!colab.sector || !currentUserAllowedSectors.includes(colab.sector)) return false;
    }

    const matchesName = filterName ? colab.name.toLowerCase().includes(filterName.toLowerCase()) : true;
    const matchesBranch = filterBranches.length > 0 ? filterBranches.includes(colab.branch) : (availableBranches.length > 0 ? availableBranches.includes(colab.branch) : true);
    const matchesRole = filterRoles.length > 0 ? filterRoles.includes(colab.role) : true;
    const matchesSector = filterSectors.length > 0 ? (colab.sector && filterSectors.includes(colab.sector)) : true;

    return matchesName && matchesBranch && matchesRole && matchesSector;
  };

  // --- CALCULAR TIPOS ATIVOS NO MÊS (PARA A LEGENDA DINÂMICA) ---
  const activeTypesInMonth = useMemo(() => {
      const types = new Set<string>();
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0);
      
      // Helper para checar sobreposição de datas
      const overlaps = (startStr: string, endStr: string) => {
          const s = new Date(startStr + 'T00:00:00');
          const e = new Date(endStr + 'T00:00:00');
          return s <= endOfMonth && e >= startOfMonth;
      };

      // 1. Events
      events.forEach(e => {
          if (e.status === 'reprovado') return;
          if (overlaps(e.startDate, e.endDate) && matchesFilters(e.collaboratorId)) {
              types.add(e.type);
              if (e.status && e.status !== 'aprovado') types.add('pendente');
          }
      });

      // 2. Vacation Requests (Mapeia para 'ferias' na legenda para consistência)
      vacationRequests.forEach(v => {
          if (overlaps(v.startDate, v.endDate) && matchesFilters(v.collaboratorId)) {
              types.add('ferias'); 
              if (v.status !== 'aprovado') types.add('pendente');
          }
      });

      // 3. OnCalls
      onCalls.forEach(o => {
          if (overlaps(o.startDate, o.endDate) && matchesFilters(o.collaboratorId)) {
              types.add('plantao');
          }
      });

      // 4. Rotations (Check Sundays)
      const sundays: Date[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(year, month, d);
          if (date.getDay() === 0) sundays.push(date);
      }
      
      if (sundays.length > 0) {
           activeCollaborators.forEach(c => {
              if (!matchesFilters(c.id)) return;
              if (c.hasRotation && c.rotationGroup) {
                  const hasOff = sundays.some(sunday => checkRotationDay(sunday, c.rotationStartDate));
                  if (hasOff) types.add('rotation_off');
              }
          });
      }

      // 5. Holidays
      const holidayDates = Object.keys(holidays);
      const hasHoliday = holidayDates.some(dateStr => {
           const d = new Date(dateStr + 'T00:00:00');
           return d.getMonth() === month && d.getFullYear() === year;
      });
      if (hasHoliday) types.add('feriado');

      return types;
  }, [events, vacationRequests, onCalls, activeCollaborators, year, month, holidays, filterName, filterBranches, filterRoles, filterSectors]);

  // --- CALCULAR EVENTOS SAZONAIS ATIVOS NO MÊS ---
  const activeSeasonalInMonth = useMemo(() => {
      if (!settings?.seasonalEvents) return [];
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0);

      // Filtra apenas eventos ativos que se sobrepõem ao mês atual
      return settings.seasonalEvents.filter(s => {
          if (!s.active) return false;
          const sStart = new Date(s.startDate + 'T00:00:00');
          const sEnd = new Date(s.endDate + 'T00:00:00');
          return sStart <= endOfMonth && sEnd >= startOfMonth;
      });
  }, [settings?.seasonalEvents, year, month]);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const checkDate = new Date(dateStr + 'T00:00:00');

    // 1. Database Events
    let dayEvents = events.filter(e => {
      if (e.status === 'reprovado') return false;
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

    // 4. Dynamic Rotation Rules (Escalas)
    const virtualRotationEvents: any[] = [];
    if (checkDate.getDay() === 0) { 
        activeCollaborators.forEach(c => {
            if (!matchesFilters(c.id)) return;
            if (c.hasRotation && c.rotationGroup) {
                const isRotationOff = checkRotationDay(checkDate, c.rotationStartDate);
                if (isRotationOff) {
                    const hasExplicitEvent = [...dayEvents, ...dayVacationReqs].some(e => e.collaboratorId === c.id);
                    if (!hasExplicitEvent) {
                         virtualRotationEvents.push({
                             id: `rot-off-${c.id}-${dateStr}`,
                             collaboratorId: c.id,
                             kind: 'rotation_off',
                             typeLabel: 'Folga de Escala',
                             rotationGroup: c.rotationGroup
                         });
                    }
                }
            }
        });
    }

    // Apply User Filters
    dayEvents = dayEvents.filter(e => matchesFilters(e.collaboratorId));
    dayOnCalls = dayOnCalls.filter(oc => matchesFilters(oc.collaboratorId));
    dayVacationReqs = dayVacationReqs.filter(v => matchesFilters(v.collaboratorId));

    return [...dayEvents, ...dayOnCalls, ...dayVacationReqs, ...virtualRotationEvents];
  };

  // --- FILTRO DE LEGENDA ---
  const filterEventsByLegend = (eventsList: any[], holiday: string | undefined, seasonalEventId?: string) => {
      if (!legendFilter) return eventsList; // Sem filtro, retorna tudo

      // Se o filtro selecionado for um evento sazonal
      if (legendFilter.startsWith('seasonal-')) {
          // A lógica de filtragem para sazonais é visual (não esconde eventos do dia, apenas destaca os dias do evento)
          // Mas se quisermos ser estritos:
          // Se o filtro for um sazonal e o dia atual pertencer a ele, mostramos os eventos.
          // Se não, não mostramos nada?
          // Melhor abordagem: O filtro de legenda afeta a OPACIDADE do dia.
          // Aqui retornamos a lista normal para que a modal funcione.
          return eventsList;
      }

      // Filtro especial para Feriado
      if (legendFilter === 'feriado') {
          return holiday ? eventsList : []; // Se for dia de feriado, mostra os eventos do dia (ou apenas o feriado)
      }

      return eventsList.filter(item => {
          // Filtro por Pendente
          if (legendFilter === 'pendente') {
              return (item.status && item.status !== 'aprovado');
          }
          
          // Filtro por Plantão
          if (legendFilter === 'plantao') {
              return item.kind === 'plantao';
          }

          // Filtro por Folga de Escala
          if (legendFilter === 'rotation_off') {
              return item.kind === 'rotation_off';
          }

          // Filtro por Tipo Genérico (Eventos e Férias)
          // Se for 'ferias', pega tanto evento type='ferias' quanto vacation_req
          if (legendFilter === 'ferias') {
              return item.type === 'ferias' || item.kind === 'vacation_req';
          }

          // Filtros Específicos (Custom Types)
          if (item.kind === 'event') {
              // Se o filtro for igual ao ID do tipo do evento
              return item.type === legendFilter;
          }

          return false;
      });
  };

  // Verifica se o dia cai num evento sazonal
  const getSeasonalInfo = (dateStr: string) => {
      if (!activeSeasonalInMonth.length) return null;
      const d = new Date(dateStr + 'T00:00:00');
      // Retorna o primeiro evento sazonal que cobre esta data
      return activeSeasonalInMonth.find(s => {
          const start = new Date(s.startDate + 'T00:00:00');
          const end = new Date(s.endDate + 'T00:00:00');
          return d >= start && d <= end;
      });
  };

  const handleDayClick = (day: number, dayEvents: any[], holiday?: string) => {
    // Filtra os eventos da modal também
    const filteredForModal = filterEventsByLegend(dayEvents, holiday);
    
    // Se tiver filtro de feriado ativo e for feriado, abre. Se não, verifica se tem eventos.
    // Ajuste: Se tiver filtro de sazonal, permite clicar nos dias do sazonal mesmo sem eventos
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const seasonal = getSeasonalInfo(dateStr);
    const isSeasonalActive = legendFilter === `seasonal-${seasonal?.id}`;

    if ((legendFilter === 'feriado' && holiday) || filteredForModal.length > 0 || (holiday && !legendFilter) || (isSeasonalActive)) {
      setSelectedDay({ date: dateStr, dayEvents: filteredForModal, holiday });
    }
  };

  const getCollaboratorName = (id: string) => activeCollaborators.find(c => c.id === id)?.name || 'Desconhecido';
  const getCollaboratorPhone = (id: string) => activeCollaborators.find(c => c.id === id)?.phone || null;
  const getCollaboratorOtherContact = (id: string) => activeCollaborators.find(c => c.id === id)?.otherContact || null;
  
  const getCollaboratorScaleInfo = (id: string) => {
    const c = activeCollaborators.find(c => c.id === id);
    if (c?.hasRotation && c?.rotationGroup) return `[Escala ${c.rotationGroup}]`;
    return null;
  };

  const getEventTypeLabel = (evt: any) => {
    if (evt.kind === 'plantao') return 'Plantão';
    if (evt.kind === 'rotation_off') return 'Folga de Escala';
    if (evt.kind === 'vacation_req') return 'Férias (Prev.)';
    
    if (evt.typeLabel) return evt.typeLabel;
    const found = settings?.eventTypes.find(t => t.id === evt.type);
    return found ? found.label : formatLabel(evt.type);
  };

  const formatLabel = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  // --- LEGEND ITEMS GENERATION ---
  const legendItems = useMemo(() => {
      const items = [];
      
      // 1. Tipos Padrão e Customizados do Settings (Apenas se existirem no mês)
      if (settings?.eventTypes) {
          settings.eventTypes.forEach(t => {
              // Verifica se o tipo existe no Set de tipos ativos
              if (activeTypesInMonth.has(t.id)) {
                  items.push({ 
                      id: t.id, 
                      label: t.label, 
                      colorClass: getEventStyle(t.id, 'event', 'aprovado') 
                  });
              }
          });
      } 

      // 2. Tipos Fixos Extras (Apenas se existirem no mês)
      if (activeTypesInMonth.has('plantao')) {
          items.push({ id: 'plantao', label: 'Plantão', colorClass: getEventStyle('', 'plantao') });
      }
      if (activeTypesInMonth.has('rotation_off')) {
          items.push({ id: 'rotation_off', label: 'Folga de Escala', colorClass: getEventStyle('', 'rotation_off') });
      }
      if (activeTypesInMonth.has('pendente')) {
          items.push({ id: 'pendente', label: 'Pendente / Previsão', colorClass: getEventStyle('', 'event', 'pendente') });
      }
      if (activeTypesInMonth.has('feriado')) {
          items.push({ id: 'feriado', label: 'Feriado', colorClass: 'bg-amber-100 text-amber-800 border-amber-300' });
      }

      // 3. Eventos Sazonais (Se existirem no mês)
      activeSeasonalInMonth.forEach(s => {
          items.push({
              id: `seasonal-${s.id}`,
              label: s.label,
              // Usamos style inline no render para a cor da borda, aqui simulamos uma classe ou passamos style custom
              customStyle: { borderColor: s.color, borderWidth: '2px', borderStyle: 'solid', backgroundColor: '#fff' }
          });
      });

      return items;
  }, [settings?.eventTypes, activeTypesInMonth, activeSeasonalInMonth]);

  const renderCalendarGrid = () => {
    const grid = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      grid.push(<div key={`empty-${i}`} className="min-h-[100px] bg-gray-50 border border-gray-200/50"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const holiday = holidays[dateStr];
      const allDayEvents = getEventsForDay(day);
      
      const seasonal = getSeasonalInfo(dateStr);

      // Aplicar filtro da legenda AQUI
      const filteredEvents = filterEventsByLegend(allDayEvents, holiday, seasonal?.id);
      
      // Lógica de destaque/opacidade com base no filtro
      let isDimmed = false;
      if (legendFilter) {
          if (legendFilter.startsWith('seasonal-')) {
              // Se o filtro é sazonal, destaca se o dia pertence ao evento sazonal
              isDimmed = `seasonal-${seasonal?.id}` !== legendFilter;
          } else {
              // Se o filtro é de evento, destaca se tem eventos filtrados ou feriado (se filtro for feriado)
              const hasFilteredEvents = filteredEvents.length > 0;
              const matchesHoliday = legendFilter === 'feriado' && holiday;
              isDimmed = !hasFilteredEvents && !matchesHoliday;
          }
      }

      // Lógica de exibição de background/cursor
      const hasEvents = filteredEvents.length > 0 || (holiday && (!legendFilter || legendFilter === 'feriado'));
      const showHoliday = holiday && (!legendFilter || legendFilter === 'feriado');

      // Estilo da borda sazonal
      const borderStyle: React.CSSProperties = {};
      if (seasonal) {
          borderStyle.borderColor = seasonal.color;
          borderStyle.borderWidth = '2px';
          // Opcional: Adicionar um leve background tint se desejar
      } else {
          // Borda padrão
          borderStyle.borderColor = '#e5e7eb'; // gray-200
          borderStyle.borderWidth = '1px';
      }

      grid.push(
        <div
          key={day}
          onClick={() => handleDayClick(day, allDayEvents, holiday)}
          style={borderStyle}
          className={`min-h-[100px] p-2 rounded-lg transition-all relative ${
            hasEvents || (seasonal && !isDimmed) ? 'bg-white hover:shadow-md cursor-pointer' : 'bg-white'
          } ${showHoliday ? 'bg-amber-50' : ''} ${isDimmed ? 'opacity-30 grayscale' : ''}`}
        >
          <div className={`text-sm font-bold mb-1 flex justify-between items-center ${showHoliday ? 'text-amber-700' : 'text-gray-700'}`}>
              <span>{day}</span>
          </div>
          
          {showHoliday && (
            <div className="mb-1 text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md inline-block truncate w-full border border-amber-200">
              🎉 {holiday}
            </div>
          )}

          {/* Label Sazonal (Opcional, apenas se não tiver filtro ou se for o filtro ativo) */}
          {seasonal && (!legendFilter || legendFilter === `seasonal-${seasonal.id}`) && (
              <div className="mb-1 text-[9px] font-bold uppercase tracking-wider px-1 rounded text-white truncate" style={{ backgroundColor: seasonal.color }}>
                  {seasonal.label}
              </div>
          )}

          <div className="space-y-1">
            {filteredEvents.slice(0, 3).map((item: any, idx) => {
              const status = item.status || 'aprovado';
              const colorClass = getEventStyle(item.type, item.kind, status);
              
              const isReq = item.kind === 'vacation_req';
              const reqLabel = isReq ? (item.status === 'aprovado' ? '(Aprov.)' : item.status === 'nova_opcao' ? '(Opção)' : '(Prev.)') : '';
              const isEvent = item.kind === 'event';
              const eventLabel = isEvent && item.status && item.status !== 'aprovado' ? `(${item.status === 'nova_opcao' ? 'Opção' : 'Pend.'})` : '';
              const virtualLabel = (item.kind === 'rotation_off') ? '(Folga)' : '';

              return (
                <div key={idx} className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 truncate border ${colorClass}`}>
                  <div className={`w-1.5 h-1.5 rounded-full bg-current shrink-0`}></div>
                  <span className="truncate font-medium">
                    {getCollaboratorName(item.collaboratorId)} {reqLabel} {eventLabel} {virtualLabel}
                  </span>
                </div>
              );
            })}
            {filteredEvents.length > 3 && (
               <div className="text-[10px] text-gray-500 font-medium pl-1">
                 +{filteredEvents.length - 3} mais...
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
                placeholder={filterBranches.length === 0 ? 'Selecione a Filial' : 'Todos'}
                disabled={currentUserAllowedSectors.length === 1}
              />
           </div>

           <div>
              <MultiSelect 
                label="Função"
                options={availableRoles}
                selected={filterRoles}
                onChange={setFilterRoles}
                placeholder="Todas"
              />
           </div>
        </div>
      </div>

      {/* Grid Calendário */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
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
        </div>
      </div>

      {/* Legenda Interativa */}
      {legendItems.length > 0 ? (
      <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
        <p className="text-xs font-bold text-gray-500 uppercase mb-3 flex justify-between items-center">
            Legenda Interativa (Clique para filtrar)
            {legendFilter && (
                <button onClick={() => setLegendFilter(null)} className="text-indigo-600 hover:underline cursor-pointer">
                    Limpar Filtro ✕
                </button>
            )}
        </p>
        <div className="flex flex-wrap gap-2">
            {legendItems.map((item: any) => {
                const isActive = legendFilter === item.id;
                const isInactive = legendFilter && !isActive;
                return (
                    <button
                        key={item.id}
                        onClick={() => setLegendFilter(isActive ? null : item.id)}
                        style={item.customStyle ? item.customStyle : {}}
                        className={`text-[10px] px-3 py-1.5 rounded-full font-bold flex items-center gap-2 border transition-all duration-200 transform active:scale-95 ${item.colorClass || ''} ${isActive ? 'ring-2 ring-offset-1 ring-indigo-400 scale-105 shadow-md' : ''} ${isInactive ? 'opacity-40 grayscale-[50%]' : 'hover:shadow-sm'}`}
                    >
                        {/* Simular bolinha colorida usando cor do texto se não for customStyle */}
                        {!item.customStyle && <div className="w-2 h-2 rounded-full bg-current opacity-70"></div>}
                        {item.label}
                    </button>
                );
            })}
        </div>
      </div>
      ) : (
          <div className="mt-6 text-center text-xs text-gray-400 bg-gray-50 p-2 rounded">
              Nenhum evento registrado neste mês para os filtros selecionados.
          </div>
      )}

      {/* Modal de Detalhes do Dia */}
      <Modal 
        isOpen={!!selectedDay} 
        onClose={() => setSelectedDay(null)} 
        title={selectedDay ? `Detalhes - ${new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
      >
        <div className="space-y-3">
           {selectedDay && (
               (() => {
                   const seasonal = getSeasonalInfo(selectedDay.date);
                   if (seasonal) {
                       return (
                           <div className="p-3 rounded-lg border-l-4 mb-3" style={{ backgroundColor: '#f9fafb', borderColor: seasonal.color }}>
                               <div className="font-bold text-gray-800 flex items-center gap-2">
                                   <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seasonal.color }}></span>
                                   {seasonal.label}
                               </div>
                               <div className="text-xs text-gray-500">Período Sazonal Ativo</div>
                           </div>
                       );
                   }
                   return null;
               })()
           )}

           {selectedDay?.holiday && (!legendFilter || legendFilter === 'feriado') && (
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
              
              const title = getEventTypeLabel(e);
              const colorClass = getEventStyle(e.type, e.kind, e.status);

              return (
                <div key={idx} className={`p-3 border-l-4 rounded-r-md transition-all hover:shadow-md border ${colorClass.replace('bg-', 'bg-opacity-20 ')}`}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-gray-800 text-sm leading-snug break-words">{name}</span>
                        {scaleInfo && <span className="text-[10px] font-bold text-purple-700 mt-0.5">{scaleInfo}</span>}
                        
                         {canViewPhones && (phone || otherContact) && (
                            <div className="flex flex-col gap-0.5 mt-1.5">
                               {phone && <div className="text-xs text-gray-600 font-medium flex items-center gap-1">📞 {phone}</div>}
                               {otherContact && <div className="text-xs text-indigo-600 font-medium flex items-center gap-1">💬 {otherContact}</div>}
                            </div>
                         )}
                    </div>
                    
                    <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border shadow-sm text-right max-w-[120px] whitespace-normal leading-tight ${colorClass}`}>
                            {title}
                        </span>
                        {e.kind === 'plantao' && (
                           <span className="text-xs font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                             {e.startTime} - {e.endTime}
                           </span>
                        )}
                        {e.status && e.status !== 'aprovado' && (
                            <span className="text-[9px] text-gray-500 font-medium bg-gray-100 px-1 rounded border border-gray-300">
                                {e.status === 'nova_opcao' ? 'Contraproposta' : 'Aguardando'}
                            </span>
                        )}
                    </div>
                  </div>

                  {/* Observations */}
                  {((e.kind === 'vacation_req' && e.notes) || e.observation) && (
                      <div className="mt-2 text-xs text-gray-600 bg-white/60 p-2 rounded border border-black/5">
                          {(e.kind === 'vacation_req' && e.notes) && <div className="italic">Obs: {e.notes}</div>}
                          {e.observation && <div className="italic">Obs: {e.observation}</div>}
                      </div>
                  )}
                </div>
              );
           })}

           {!selectedDay?.holiday && selectedDay?.dayEvents.length === 0 && (
             <div className="text-center text-gray-500 py-4">
                 {legendFilter ? 'Nenhum evento deste tipo neste dia.' : 'Nenhum evento filtrado neste dia.'}
             </div>
           )}
        </div>
      </Modal>
    </div>
  );
};