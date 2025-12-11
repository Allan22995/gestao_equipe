import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Collaborator, EventRecord, SystemSettings, UserProfile, EventStatus } from '../types';
import { generateUUID, calculateDaysBetween, formatDate, promptForUser } from '../utils/helpers';

interface EventsProps {
  collaborators: Collaborator[];
  events: EventRecord[];
  onAdd: (e: EventRecord) => void;
  onUpdate: (e: EventRecord) => void;
  onDelete: (id: string) => void;
  showToast: (msg: string, isError?: boolean) => void;
  logAction: (action: string, entity: string, details: string, user: string) => void;
  settings: SystemSettings;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  currentUserAllowedSectors: string[];
  currentUserProfile: UserProfile;
  userColabId: string | null;
}

const CalendarIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export const Events: React.FC<EventsProps> = ({ 
  collaborators, events, onAdd, onUpdate, onDelete, showToast, logAction, settings, 
  canCreate, canUpdate, canDelete, 
  currentUserAllowedSectors, currentUserProfile, userColabId
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Helper para identificar se é um perfil de liderança/admin
  const isManager = currentUserProfile !== 'colaborador';

  // State para Lançamento em Lote
  const [isMultiMode, setIsMultiMode] = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [multiSearch, setMultiSearch] = useState('');
  const [isMultiDropdownOpen, setIsMultiDropdownOpen] = useState(false);
  const multiDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    collaboratorId: '',
    type: '',
    startDate: '',
    endDate: '',
    observation: '',
    status: 'pendente' as EventStatus
  });

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (multiDropdownRef.current && !multiDropdownRef.current.contains(event.target as Node)) {
        setIsMultiDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Efeito para garantir que, se for colaborador, o formulário já nasça preenchido corretamente
  useEffect(() => {
    if (!isManager && userColabId && !editingId) {
      setFormData(prev => {
        if (prev.collaboratorId !== userColabId || prev.type !== 'folga') {
          return {
            ...prev,
            collaboratorId: userColabId,
            type: 'folga'
          };
        }
        return prev;
      });
    }
  }, [isManager, userColabId, editingId]);

  // Filtrar colaboradores ativos primeiro
  const activeCollaborators = useMemo(() => {
     return collaborators.filter(c => c.active !== false);
  }, [collaborators]);

  // Filter Collaborators for Dropdown
  const allowedCollaborators = useMemo(() => {
     let filtered = activeCollaborators;
     
     // 1. Strict Privacy for 'colaborador' profile
     if (currentUserProfile === 'colaborador' && userColabId) {
        return filtered.filter(c => c.id === userColabId);
     }

     if (currentUserAllowedSectors.length > 0) {
       filtered = filtered.filter(c => c.sector && currentUserAllowedSectors.includes(c.sector));
     }
     
     return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeCollaborators, currentUserAllowedSectors, currentUserProfile, userColabId]);

  // Filter for Multi Select Dropdown
  const filteredMultiOptions = useMemo(() => {
      return allowedCollaborators.filter(c => 
          c.name.toLowerCase().includes(multiSearch.toLowerCase()) ||
          c.role.toLowerCase().includes(multiSearch.toLowerCase())
      );
  }, [allowedCollaborators, multiSearch]);

  // Filter Events History and Sort by Date Descending
  const allowedEvents = useMemo(() => {
     let filtered = events;
     
     // Filter out inactive users events
     filtered = filtered.filter(e => {
        const colab = collaborators.find(c => c.id === e.collaboratorId);
        return colab && colab.active !== false;
     });

     // 1. Strict Privacy for 'colaborador' profile
     if (currentUserProfile === 'colaborador' && userColabId) {
         filtered = filtered.filter(e => e.collaboratorId === userColabId);
     }

     if (currentUserAllowedSectors.length > 0) {
        filtered = filtered.filter(e => {
            const colab = collaborators.find(c => c.id === e.collaboratorId);
            return colab && colab.sector && currentUserAllowedSectors.includes(colab.sector);
        });
     }

     // Sort by startDate descending (newest first), then by creation date
     return [...filtered].sort((a, b) => {
         const dateA = a.startDate || '';
         const dateB = b.startDate || '';
         
         const dateComparison = dateB.localeCompare(dateA);
         if (dateComparison !== 0) return dateComparison;

         const createdA = a.createdAt || '';
         const createdB = b.createdAt || '';
         return createdB.localeCompare(createdA);
     });
  }, [events, collaborators, currentUserAllowedSectors, currentUserProfile, userColabId]);


  const resetForm = () => {
    setEditingId(null);
    setIsMultiMode(false);
    setMultiSelectedIds([]);
    setFormData({
      collaboratorId: (!isManager && userColabId) ? userColabId : '',
      type: (!isManager) ? 'folga' : '', // Default to Folga for collaborator
      startDate: '',
      endDate: '',
      observation: '',
      status: 'pendente'
    });
  };

  const handleEdit = (evt: EventRecord) => {
    if (!canUpdate) return;

    if (!isManager) {
        if (evt.status === 'aprovado') {
            showToast('Eventos aprovados não podem ser editados.', true);
            return;
        }
    }

    setEditingId(evt.id);
    setIsMultiMode(false); // Disable multi mode on edit
    setFormData({
      collaboratorId: evt.collaboratorId,
      type: evt.type,
      startDate: evt.startDate,
      endDate: evt.endDate,
      observation: evt.observation,
      status: evt.status || 'aprovado'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const calculateEffect = (typeId: string, start: string, end: string) => {
      if (!start || !end || !typeId) return { gained: 0, used: 0 };
      
      const days = calculateDaysBetween(start, end);
      const typeConfig = settings.eventTypes.find(t => t.id === typeId);
      
      let behavior = typeConfig?.behavior || 'neutral';
      if (typeId === 'ferias') behavior = 'neutral';
      if (typeId === 'folga') behavior = 'debit';
      if (typeId === 'trabalhado') behavior = 'credit_2x';

      let daysGained = 0;
      let daysUsed = 0;

      if (behavior === 'credit_2x') daysGained = days * 2;
      else if (behavior === 'credit_1x') daysGained = days;
      else if (behavior === 'debit') daysUsed = days;

      return { gained: daysGained, used: daysUsed, label: typeConfig?.label };
  };

  const handleAcceptProposal = (evt: EventRecord) => {
     const user = getColabName(userColabId || '') || 'Usuário';
     onUpdate({
        ...evt,
        status: 'pendente',
        collaboratorAcceptedProposal: true,
        updatedBy: user,
        lastUpdatedAt: new Date().toISOString()
     });
     
     logAction('update', 'evento', `Colaborador aceitou contraproposta do Evento ID ${evt.id}`, user);
     showToast('Proposta aceita! Aguardando confirmação final.');
  };

  const toggleMultiSelect = (id: string) => {
      setMultiSelectedIds(prev => 
          prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      );
  };

  const handleSelectAll = () => {
      if (multiSelectedIds.length === filteredMultiOptions.length) {
          setMultiSelectedIds([]);
      } else {
          setMultiSelectedIds(filteredMultiOptions.map(c => c.id));
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const user = isManager ? 'Gestor/Admin' : (getColabName(userColabId || '') || 'Colaborador');
    
    // --- LÓGICA DE CRIAÇÃO (ADD) ---
    if (!editingId) {
        if (!canCreate) {
            showToast('Você não tem permissão para criar eventos.', true);
            return;
        }

        let finalType = formData.type;
        if (!isManager) finalType = 'folga';

        if (!finalType) {
            showToast("Selecione o tipo de evento.", true);
            return;
        }

        // --- LOTE (MULTI) ---
        if (isMultiMode && isManager) {
            if (multiSelectedIds.length === 0) {
                showToast("Selecione pelo menos um colaborador.", true);
                return;
            }

            const { gained, used, label } = calculateEffect(finalType, formData.startDate, formData.endDate);
            let count = 0;

            multiSelectedIds.forEach(colId => {
                const newEvent: EventRecord = {
                    id: generateUUID(),
                    collaboratorId: colId,
                    type: finalType,
                    typeLabel: label,
                    startDate: formData.startDate,
                    endDate: formData.endDate,
                    observation: formData.observation,
                    daysGained: gained,
                    daysUsed: used,
                    status: formData.status, // Manager defines status
                    createdAt: new Date().toISOString()
                };
                onAdd(newEvent);
                count++;
            });

            logAction('create', 'evento', `Lançamento em Lote: ${count} eventos do tipo ${label}`, user);
            showToast(`${count} eventos registrados com sucesso!`);
            resetForm();
            return;
        }

        // --- INDIVIDUAL (SINGLE) ---
        let finalColabId = formData.collaboratorId;
        if (!isManager && userColabId) finalColabId = userColabId;

        if (!finalColabId) {
            showToast("Selecione o colaborador.", true);
            return;
        }

        let finalStatus: EventStatus = formData.status;
        if (!isManager) finalStatus = 'pendente';

        const { gained, used, label } = calculateEffect(finalType, formData.startDate, formData.endDate);

        const newEvent: EventRecord = {
            id: generateUUID(),
            collaboratorId: finalColabId,
            type: finalType,
            typeLabel: label,
            startDate: formData.startDate,
            endDate: formData.endDate,
            observation: formData.observation,
            daysGained: gained,
            daysUsed: used,
            status: finalStatus,
            createdAt: new Date().toISOString()
        };
        onAdd(newEvent);
        showToast(isManager ? 'Evento registrado!' : 'Solicitação de folga enviada!');
        resetForm();

    } else {
        // --- EDIÇÃO (UPDATE) ---
        if (!canUpdate) {
            showToast('Você não tem permissão para editar eventos.', true);
            return;
        }

        let finalType = formData.type;
        if (!isManager && !finalType) finalType = 'folga';

        let finalStatus: EventStatus = formData.status;
        let acceptedFlag = false;

        if (!isManager) {
            finalStatus = 'pendente'; 
            acceptedFlag = false; 
        } else {
            if (formData.status === 'nova_opcao') acceptedFlag = false;
        }

        const { gained, used, label } = calculateEffect(finalType, formData.startDate, formData.endDate);

        onUpdate({
            id: editingId,
            collaboratorId: formData.collaboratorId,
            type: finalType,
            typeLabel: label,
            startDate: formData.startDate,
            endDate: formData.endDate,
            observation: formData.observation,
            daysGained: gained,
            daysUsed: used,
            status: finalStatus,
            collaboratorAcceptedProposal: acceptedFlag,
            updatedBy: user,
            lastUpdatedAt: new Date().toISOString()
        } as EventRecord);

        logAction('update', 'evento', `Evento ID ${editingId} editado. Status: ${finalStatus}`, user);
        showToast('Evento atualizado!');
        resetForm();
    }
  };

  const handleDelete = (id: string, status?: EventStatus) => {
    if (!canDelete) return;
    
    if (!isManager && (status === 'aprovado' || !status)) { 
         showToast('Você não pode excluir um evento já aprovado.', true);
         return;
    }

    const user = isManager ? promptForUser('Excluir Evento') : 'Colaborador';
    if (!user) return;

    if (window.confirm('Confirmar exclusão?')) {
      onDelete(id);
      logAction('delete', 'evento', `Evento ID ${id} excluído`, user);
      showToast('Evento excluído.');
    }
  };

  const getColabName = (id: string) => collaborators.find(c => c.id === id)?.name || '---';
  
  const getEventLabel = (e: EventRecord) => {
     if (e.typeLabel) return e.typeLabel;
     const found = settings.eventTypes.find(t => t.id === e.type);
     if (found) return found.label;
     if (e.type === 'ferias') return 'Férias';
     if (e.type === 'folga') return 'Folga';
     if (e.type === 'trabalhado') return 'Trabalhado';
     return e.type;
  };

  return (
    <div className="space-y-8">
      {(canCreate || (editingId && canUpdate)) ? (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
             <h2 className="text-xl font-bold text-gray-800">
               {editingId ? 'Editar Evento / Solicitação' : (isManager ? 'Registrar Evento' : 'Solicitar Folga')}
             </h2>
             {isManager && !editingId && (
                <div className="mt-2 flex items-center gap-3">
                   <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={isMultiMode} 
                        onChange={e => setIsMultiMode(e.target.checked)} 
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-2 text-xs font-bold text-gray-600">Lançamento em Lote (Múltiplos)</span>
                   </label>
                </div>
             )}
          </div>
          {editingId && (
            <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700 underline">
              Cancelar Edição
            </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Colaborador(es) *</label>
            
            {/* SINGLE SELECT MODE */}
            {!isMultiMode && (
                <select
                required
                className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700 disabled:bg-gray-100"
                value={formData.collaboratorId}
                onChange={e => setFormData({...formData, collaboratorId: e.target.value})}
                disabled={!!editingId || !isManager}
                >
                <option value="">Selecione...</option>
                {allowedCollaborators.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                </select>
            )}

            {/* MULTI SELECT MODE */}
            {isMultiMode && (
                <div className="relative" ref={multiDropdownRef}>
                    <div 
                      onClick={() => setIsMultiDropdownOpen(!isMultiDropdownOpen)}
                      className="w-full border border-gray-300 rounded-lg p-2 bg-white text-sm cursor-pointer flex justify-between items-center focus:ring-2 focus:ring-indigo-500"
                    >
                        <span className={multiSelectedIds.length === 0 ? "text-gray-400" : "text-gray-700 font-bold"}>
                            {multiSelectedIds.length === 0 ? "Selecione colaboradores..." : `${multiSelectedIds.length} selecionados`}
                        </span>
                        <span className="text-gray-400">▼</span>
                    </div>

                    {isMultiDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col animate-fadeIn">
                            <div className="p-2 border-b border-gray-100 bg-gray-50">
                                <input 
                                    type="text" 
                                    autoFocus
                                    placeholder="Buscar..." 
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-indigo-500"
                                    value={multiSearch}
                                    onChange={e => setMultiSearch(e.target.value)}
                                />
                            </div>
                            <div className="overflow-y-auto flex-1 p-1 space-y-1">
                                <div 
                                    onClick={handleSelectAll}
                                    className="flex items-center gap-2 p-2 hover:bg-indigo-50 cursor-pointer rounded text-xs font-bold text-indigo-700 border-b border-gray-100"
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={multiSelectedIds.length > 0 && multiSelectedIds.length === filteredMultiOptions.length}
                                        readOnly
                                        className="pointer-events-none"
                                    />
                                    Selecionar Todos ({filteredMultiOptions.length})
                                </div>
                                {filteredMultiOptions.map(c => (
                                    <div 
                                        key={c.id} 
                                        onClick={() => toggleMultiSelect(c.id)}
                                        className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer rounded"
                                    >
                                        <input 
                                            type="checkbox" 
                                            checked={multiSelectedIds.includes(c.id)}
                                            readOnly
                                            className="pointer-events-none rounded text-indigo-600"
                                        />
                                        <span className="text-sm text-gray-700 truncate">{c.name}</span>
                                    </div>
                                ))}
                                {filteredMultiOptions.length === 0 && <p className="text-center text-gray-400 text-xs py-2">Nada encontrado</p>}
                            </div>
                        </div>
                    )}
                </div>
            )}
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Tipo de Evento *</label>
            <select
              required
              className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700 disabled:bg-gray-100"
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value})}
              disabled={!isManager} // Colaborador travado em 'folga' (via lógica do state)
            >
              <option value="">Selecione...</option>
              {isManager ? settings.eventTypes.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              )) : (
                 <option value="folga">Folga</option>
              )}
            </select>
            {!isManager && <p className="text-[10px] text-gray-400 mt-1">Colaboradores só podem solicitar Folga.</p>}
          </div>

          {/* Status Field - Only visible/editable for Managers */}
          {isManager && (
            <div className="flex flex-col md:col-span-2">
                <label className="text-xs font-semibold text-gray-600 mb-1">Status *</label>
                <select
                required
                className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as EventStatus})}
                >
                <option value="pendente">Pendente</option>
                <option value="aprovado">Aprovado</option>
                <option value="nova_opcao">Nova Opção (Contraproposta)</option>
                <option value="reprovado">Reprovado</option>
                </select>
            </div>
          )}

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Data Início *</label>
            <div className="relative">
              <input
                required
                type="date"
                className="w-full border border-gray-300 rounded-lg p-2 pr-10 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700 appearance-none"
                value={formData.startDate}
                onChange={e => setFormData({...formData, startDate: e.target.value})}
                style={{colorScheme: 'light'}}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                 <CalendarIcon />
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Data Fim *</label>
            <div className="relative">
              <input
                required
                type="date"
                className="w-full border border-gray-300 rounded-lg p-2 pr-10 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700 appearance-none"
                value={formData.endDate}
                onChange={e => setFormData({...formData, endDate: e.target.value})}
                style={{colorScheme: 'light'}}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                 <CalendarIcon />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:col-span-2">
            <label className="text-xs font-semibold text-gray-600 mb-1">Observação {formData.status === 'nova_opcao' && <span className="text-red-500 font-bold">(Descreva a nova opção aqui)</span>}</label>
            <input
              type="text"
              className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
              placeholder={formData.status === 'nova_opcao' ? "Sugira uma nova data..." : "Detalhes opcionais..."}
              value={formData.observation}
              onChange={e => setFormData({...formData, observation: e.target.value})}
            />
          </div>

          <button type="submit" className="md:col-span-2 bg-[#667eea] hover:bg-[#5a6fd6] text-white font-bold py-2.5 px-6 rounded-lg shadow-md transition-transform active:scale-95">
            {editingId ? (isManager ? 'Salvar Alterações' : 'Atualizar Solicitação') : (isManager ? (isMultiMode ? `Registrar para ${multiSelectedIds.length} Colaboradores` : 'Registrar') : 'Solicitar')}
          </button>
        </form>
      </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center text-blue-800">
          <p className="font-bold">Modo Leitura</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Histórico de Eventos {currentUserAllowedSectors.length > 0 && <span className="text-sm font-normal text-gray-500">(Filtrado por setor)</span>}</h2>
        <div className="space-y-3">
          {allowedEvents.length === 0 ? <p className="text-gray-400 text-center py-4">Nenhum evento registrado.</p> : allowedEvents.map(e => {
            // Determine visual style based on status
            let statusColor = 'bg-gray-100 text-gray-600 border-gray-200';
            let statusLabel = 'Pendente';
            
            // Legacy events without status are Approved
            const evtStatus = e.status || 'aprovado';

            switch(evtStatus) {
                case 'aprovado': statusColor = 'bg-emerald-100 text-emerald-800 border-emerald-200'; statusLabel = 'Aprovado'; break;
                case 'nova_opcao': statusColor = 'bg-blue-100 text-blue-800 border-blue-200'; statusLabel = 'Nova Opção'; break;
                case 'reprovado': statusColor = 'bg-red-100 text-red-800 border-red-200'; statusLabel = 'Reprovado'; break;
                case 'pendente': statusColor = 'bg-gray-100 text-gray-600 border-gray-200'; statusLabel = 'Pendente'; break;
            }

            return (
                <div key={e.id} className={`flex flex-col md:flex-row justify-between items-center p-4 border rounded-lg hover:shadow-sm transition-all ${evtStatus === 'aprovado' ? 'border-gray-200' : 'border-l-4 border-l-amber-400 border-gray-200 bg-gray-50'}`}>
                <div className="flex-1 w-full">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-gray-800">{getColabName(e.collaboratorId)}</span>
                        
                        <span className={`bg-white text-xs px-2 py-0.5 rounded font-bold border border-gray-300`}>
                            {getEventLabel(e)}
                        </span>

                        <span className={`text-xs px-2 py-0.5 rounded font-bold border ${statusColor}`}>
                            {statusLabel}
                        </span>

                        {e.collaboratorAcceptedProposal && e.status === 'pendente' && (
                           <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-bold flex items-center gap-1">
                              ✓ Aceite do Colaborador
                           </span>
                        )}
                    </div>
                    <div className="text-sm text-gray-600">
                        {formatDate(e.startDate)} até {formatDate(e.endDate)}
                        {/* Only show days calc if approved, otherwise it might be confusing */}
                        {evtStatus === 'aprovado' && (
                            <>
                                {e.daysGained > 0 && <span className="ml-2 text-green-600 font-medium">+{e.daysGained} dias</span>}
                                {e.daysUsed > 0 && <span className="ml-2 text-red-500 font-medium">-{e.daysUsed} dias</span>}
                            </>
                        )}
                    </div>
                    {e.observation && <div className="text-xs text-gray-500 italic mt-1 bg-white/50 p-1 rounded inline-block">Obs: {e.observation}</div>}
                    {e.updatedBy && <div className="text-[10px] text-gray-400 mt-1">Modificado por: {e.updatedBy}</div>}
                </div>
                
                <div className="flex gap-2 mt-3 md:mt-0">
                    
                    {/* Botão Aceitar para Colaborador */}
                    {!isManager && evtStatus === 'nova_opcao' && canUpdate && (
                        <button 
                            onClick={() => handleAcceptProposal(e)}
                            className="text-white bg-green-500 hover:bg-green-600 px-3 py-1 rounded text-sm font-bold shadow-sm transition-colors flex items-center gap-1"
                        >
                            <span>✓</span> Aceitar
                        </button>
                    )}

                    {/* Edit Button Logic */}
                    {(canUpdate) && (isManager || evtStatus === 'pendente' || evtStatus === 'nova_opcao') && (
                        <button onClick={() => handleEdit(e)} className="text-blue-500 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded text-sm font-medium transition-colors">
                            {!isManager && evtStatus === 'nova_opcao' ? 'Contrapor / Editar' : 'Editar'}
                        </button>
                    )}

                    {/* Delete Button Logic */}
                    {(canDelete) && (isManager || evtStatus !== 'aprovado') && (
                        <button onClick={() => handleDelete(e.id, e.status)} className="text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1 rounded text-sm font-medium transition-colors">
                           {(!isManager && evtStatus !== 'aprovado') ? 'Cancelar' : 'Excluir'}
                        </button>
                    )}
                </div>
                
                </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};