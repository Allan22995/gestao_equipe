

import React, { useState, useMemo } from 'react';
import { Collaborator, VacationRequest, VacationStatus, UserProfile } from '../types';
import { generateUUID, formatDate } from '../utils/helpers';

interface VacationForecastProps {
  collaborators: Collaborator[];
  requests: VacationRequest[];
  onAdd: (r: VacationRequest) => void;
  onUpdate: (r: VacationRequest) => void;
  onDelete: (id: string) => void;
  showToast: (msg: string, isError?: boolean) => void;
  logAction: (action: string, entity: string, details: string, user: string) => void;
  currentUserProfile: UserProfile;
  currentUserName: string;
  canEdit: boolean; // Permissão ACL
  canManageStatus: boolean; // Nova Permissão: Aprovar/Rejeitar
  currentUserAllowedSectors: string[]; // Novo: Filtro de setor
  userColabId: string | null;
}

const CalendarIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export const VacationForecast: React.FC<VacationForecastProps> = ({ 
  collaborators, requests, onAdd, onUpdate, onDelete, showToast, logAction, currentUserProfile, currentUserName, canEdit, canManageStatus, currentUserAllowedSectors, userColabId
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    collaboratorId: '',
    startDate: '',
    endDate: '',
    status: 'pendente' as VacationStatus,
    notes: ''
  });

  // Filtrar colaboradores ativos primeiro (Legacy undefined = true)
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

  // Filter Requests History
  const allowedRequests = useMemo(() => {
     let filtered = requests;

     // Filter out inactive users events
     filtered = filtered.filter(r => {
        const colab = collaborators.find(c => c.id === r.collaboratorId);
        return colab && colab.active !== false;
     });

     // 1. Strict Privacy for 'colaborador' profile
     if (currentUserProfile === 'colaborador' && userColabId) {
         filtered = filtered.filter(r => r.collaboratorId === userColabId);
     }

     if (currentUserAllowedSectors.length > 0) {
        filtered = filtered.filter(r => {
            const colab = collaborators.find(c => c.id === r.collaboratorId);
            return colab && colab.sector && currentUserAllowedSectors.includes(colab.sector);
        });
     }
     
     return filtered;
  }, [requests, collaborators, currentUserAllowedSectors, currentUserProfile, userColabId]);

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      collaboratorId: '',
      startDate: '',
      endDate: '',
      status: 'pendente',
      notes: ''
    });
  };

  // Helper para verificar se o usuário pode interagir (Editar/Excluir) com a solicitação
  const canInteractWithRequest = (req: VacationRequest) => {
    // Se for gestor/admin com permissão de status, pode sempre
    if (canManageStatus) return true;

    // Se for colaborador
    if (currentUserProfile === 'colaborador') {
       // Só pode editar se for 'nova_opcao' (para aceitar ou contrapropor)
       // Se for 'pendente' ou 'aprovado', está bloqueado aguardando o líder
       return req.status === 'nova_opcao';
    }
    
    return canEdit; // Fallback para outras regras
  };

  const handleEdit = (req: VacationRequest) => {
    if (!canInteractWithRequest(req)) {
       showToast('Você não pode editar esta solicitação no momento.', true);
       return;
    }
    setEditingId(req.id);
    setFormData({
      collaboratorId: req.collaboratorId,
      startDate: req.startDate,
      endDate: req.endDate,
      status: req.status,
      notes: req.notes
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string, reqStatus: VacationStatus) => {
    if (!canEdit) return;

    // Regra de bloqueio para colaborador
    if (currentUserProfile === 'colaborador' && reqStatus !== 'nova_opcao') {
      showToast('Aguarde a análise da liderança. Você não pode excluir solicitações pendentes.', true);
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir esta previsão de férias?')) {
      onDelete(id);
      logAction('delete', 'previsao_ferias', `Previsão ID ${id} excluída`, currentUserName);
      showToast('Previsão removida com sucesso.');
    }
  };

  const handleAcceptProposal = (req: VacationRequest) => {
    const user = currentUserName;
    onUpdate({
      ...req,
      status: 'pendente', // Volta para pendente para o líder aprovar final
      collaboratorAcceptedProposal: true, // Marca que o colab aceitou
      updatedBy: user,
      lastUpdatedAt: new Date().toISOString()
    });
    logAction('update', 'previsao_ferias', `Colaborador aceitou contraproposta ID ${req.id}`, user);
    showToast('Proposta aceita! Enviado para aprovação final da liderança.');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    
    if (!formData.collaboratorId) {
      showToast('Selecione um colaborador.', true);
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      showToast('Defina as datas de início e fim.', true);
      return;
    }

    const user = currentUserName;

    if (!editingId) {
      // CRIAÇÃO
      // Se tiver permissão de gerenciar status, permite criar já aprovado, senão padrão 'pendente'
      const initialStatus = canManageStatus ? formData.status : 'pendente';

      const newReq: VacationRequest = {
        id: generateUUID(),
        collaboratorId: formData.collaboratorId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: initialStatus,
        notes: formData.notes,
        createdAt: new Date().toISOString(),
        updatedBy: user
      };
      onAdd(newReq);
      
      logAction('create', 'previsao_ferias', `Nova previsão criada para colab ${formData.collaboratorId}`, user);
      showToast('Previsão de férias registrada! Aguarde aprovação.');
      resetForm();
    } else {
      // ATUALIZAÇÃO
      let nextStatus = formData.status;
      let acceptedFlag = false;

      // Se for colaborador editando, significa que ele está negociando/rejeitando uma 'nova_opcao'
      // ou apenas corrigindo algo se o sistema permitisse (mas bloqueamos 'pendente').
      // Então se ele edita, volta para 'pendente' e remove a flag de aceite.
      if (currentUserProfile === 'colaborador') {
         nextStatus = 'pendente';
         acceptedFlag = false;
      } else {
         // Se for líder, mantém o status escolhido no form, mas preserva a flag se ele não mudou nada relevante?
         // Simplificação: Lider define o estado final. Se líder muda, limpa a flag de aceite do colab pois mudou a proposta.
         acceptedFlag = false; 
      }

      onUpdate({
        id: editingId,
        collaboratorId: formData.collaboratorId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: nextStatus,
        notes: formData.notes,
        collaboratorAcceptedProposal: acceptedFlag,
        updatedBy: user,
        lastUpdatedAt: new Date().toISOString()
      } as VacationRequest);
      
      logAction('update', 'previsao_ferias', `Previsão ID ${editingId} atualizada. Status: ${nextStatus}`, user);
      showToast('Previsão atualizada com sucesso!');
      resetForm();
    }
  };

  const getColabName = (id: string) => collaborators.find(c => c.id === id)?.name || '---';

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            {editingId ? 'Editar Previsão / Contraproposta' : 'Nova Previsão de Férias'}
          </h2>
          {editingId && (
            <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700 underline">
              Cancelar Edição
            </button>
          )}
        </div>

        {canEdit ? (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col md:col-span-2">
            <label className="text-xs font-semibold text-gray-600 mb-1">Colaborador *</label>
            <select
              required
              className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700 disabled:bg-gray-100 disabled:text-gray-500"
              value={formData.collaboratorId}
              onChange={e => setFormData({...formData, collaboratorId: e.target.value})}
              disabled={!!editingId} 
            >
              <option value="">Selecione...</option>
              {allowedCollaborators.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {editingId && <p className="text-[10px] text-gray-400 mt-1">O colaborador não pode ser alterado na edição.</p>}
          </div>

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

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Status *</label>
            <select
              required
              className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700 disabled:bg-gray-100 disabled:text-gray-500"
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value as VacationStatus})}
              disabled={!canManageStatus} // Permite alteração se tiver a permissão (Líder)
            >
              <option value="pendente">Pendente</option>
              <option value="aprovado">Aprovado {(!canManageStatus && formData.status !== 'aprovado') ? '(Restrito)' : ''}</option>
              <option value="negociacao">Em Negociação</option>
              <option value="nova_opcao">Nova Opção (Contraproposta)</option>
            </select>
            {!canManageStatus && <p className="text-[10px] text-gray-400 mt-1">Apenas a liderança pode alterar o status.</p>}
          </div>

          <div className="flex flex-col md:col-span-2">
            <label className="text-xs font-semibold text-gray-600 mb-1">Observações / Detalhes</label>
            <input
              type="text"
              className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
              placeholder="Ex: Aguardando aprovação da diretoria..."
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />
          </div>

          <div className="md:col-span-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600 flex justify-between items-center">
              <span>Responsável pelo registro:</span>
              <span className="font-bold text-indigo-600">{currentUserName}</span>
           </div>

          <button type="submit" className="md:col-span-2 bg-[#667eea] hover:bg-[#5a6fd6] text-white font-bold py-2.5 px-6 rounded-lg shadow-md transition-transform active:scale-95">
            {editingId ? (currentUserProfile === 'colaborador' ? 'Enviar para Aprovação' : 'Salvar Alterações') : 'Registrar Previsão'}
          </button>
        </form>
        ) : <p className="text-center text-gray-500 italic">Modo Leitura: Você não tem permissão para gerenciar férias.</p>}
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Previsões Registradas {currentUserAllowedSectors.length > 0 && <span className="text-sm font-normal text-gray-500">(Filtrado por setor)</span>}</h2>
        <div className="space-y-3">
          {allowedRequests.length === 0 ? <p className="text-gray-400 text-center py-4">Nenhuma previsão registrada.</p> : allowedRequests.map(r => {
            let statusColor = 'bg-gray-100 text-gray-600';
            let statusLabel = 'Pendente';
            
            switch(r.status) {
              case 'aprovado': statusColor = 'bg-emerald-100 text-emerald-800'; statusLabel = 'Aprovado'; break;
              case 'negociacao': statusColor = 'bg-amber-100 text-amber-800'; statusLabel = 'Em Negociação'; break;
              case 'nova_opcao': statusColor = 'bg-blue-100 text-blue-800'; statusLabel = 'Nova Opção'; break;
            }

            const canAction = canInteractWithRequest(r);

            return (
              <div key={r.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-all">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-800">{getColabName(r.collaboratorId)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${statusColor}`}>{statusLabel}</span>
                    
                    {r.collaboratorAcceptedProposal && r.status === 'pendente' && (
                       <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-bold flex items-center gap-1">
                          ✓ Aceite do Colaborador
                       </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatDate(r.startDate)} até {formatDate(r.endDate)}
                  </div>
                  {r.notes && <div className="text-xs text-gray-500 italic mt-1">Obs: {r.notes}</div>}
                  {r.updatedBy && <div className="text-[10px] text-gray-400 mt-1">Atualizado por: {r.updatedBy}</div>}
                </div>
                
                {canEdit && (
                  <div className="flex gap-2 mt-3 md:mt-0">
                    {/* Botão de Aceite para Colaborador */}
                    {currentUserProfile === 'colaborador' && r.status === 'nova_opcao' && (
                      <button 
                         onClick={() => handleAcceptProposal(r)}
                         className="text-white bg-green-500 hover:bg-green-600 px-3 py-1 rounded text-sm font-bold shadow-sm transition-colors flex items-center gap-1"
                      >
                         <span>✓</span> Aceitar
                      </button>
                    )}

                    {/* Botões de Edição/Exclusão */}
                    {canAction ? (
                        <>
                          <button 
                            onClick={() => handleEdit(r)} 
                            className="text-blue-500 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded text-sm font-medium transition-colors"
                          >
                            {currentUserProfile === 'colaborador' && r.status === 'nova_opcao' ? 'Editar / Contrapor' : 'Editar'}
                          </button>
                          <button 
                            onClick={() => handleDelete(r.id, r.status)} 
                            className="text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1 rounded text-sm font-medium transition-colors"
                          >
                            Excluir
                          </button>
                        </>
                    ) : (
                        // Se não pode agir, mostra status para o colaborador
                        currentUserProfile === 'colaborador' && r.status !== 'aprovado' && (
                           <span className="text-xs text-gray-400 italic px-2 py-1 bg-gray-50 rounded">Aguardando Liderança...</span>
                        )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};