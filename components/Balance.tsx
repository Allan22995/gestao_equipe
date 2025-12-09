

import React, { useState, useMemo } from 'react';
import { Collaborator, EventRecord, BalanceAdjustment, UserProfile } from '../types';
import { generateUUID } from '../utils/helpers';

interface BalanceProps {
  collaborators: Collaborator[];
  events: EventRecord[];
  adjustments: BalanceAdjustment[];
  onAddAdjustment: (adj: BalanceAdjustment) => void;
  showToast: (msg: string, isError?: boolean) => void;
  logAction: (action: string, entity: string, details: string, user: string) => void;
  currentUserName: string;
  canEdit: boolean; // Permissão ACL
  currentUserAllowedSectors: string[]; // Novo: Filtro de setor
  currentUserProfile: UserProfile;
  userColabId: string | null;
}

export const Balance: React.FC<BalanceProps> = ({ 
  collaborators, events, adjustments, onAddAdjustment, showToast, logAction, currentUserName, canEdit, currentUserAllowedSectors, currentUserProfile, userColabId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [adjForm, setAdjForm] = useState({
    collaboratorId: '',
    type: 'credit' as 'credit' | 'debit',
    days: '',
    reason: ''
  });

  const handleAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    
    if (!adjForm.collaboratorId) {
        showToast('Erro: Selecione um colaborador.', true);
        return;
    }

    const daysVal = Number(adjForm.days);

    if (!adjForm.days || !Number.isInteger(daysVal) || daysVal <= 0) {
        showToast('Erro: A quantidade de dias deve ser um número inteiro maior que zero.', true);
        return;
    }

    if (!adjForm.reason.trim()) {
        showToast('Erro: O motivo é obrigatório.', true);
        return;
    }

    const amount = daysVal * (adjForm.type === 'debit' ? -1 : 1);
    const user = currentUserName;
    
    const newAdj: BalanceAdjustment = {
      id: generateUUID(),
      collaboratorId: adjForm.collaboratorId,
      amount,
      reason: adjForm.reason.trim(),
      createdAt: new Date().toISOString(),
      createdBy: user
    };

    onAddAdjustment(newAdj);
    
    logAction(
      'create', 
      'ajuste_saldo', 
      `Ajuste manual: ${amount > 0 ? '+' : ''}${amount} dias. Motivo: ${adjForm.reason}`, 
      user
    );
    
    showToast('Ajuste lançado com sucesso!');
    setAdjForm(prev => ({ ...prev, days: '', reason: '' }));
  };

  // Filter Collaborators First based on Sector Restrictions and Profile
  const allowedCollaborators = useMemo(() => {
     let filtered = collaborators;

     // 1. Strict Privacy for 'colaborador' profile
     if (currentUserProfile === 'colaborador' && userColabId) {
        return filtered.filter(c => c.id === userColabId);
     }

     // 2. Sector filtering
     if (currentUserAllowedSectors.length > 0) {
         filtered = filtered.filter(c => c.sector && currentUserAllowedSectors.includes(c.sector));
     }

     return filtered;
  }, [collaborators, currentUserAllowedSectors, currentUserProfile, userColabId]);

  // Then calculate balances for allowed collaborators
  const balances = allowedCollaborators.map(c => {
    // IMPORTANTE: Filtrar apenas eventos APROVADOS ou LEGADOS (sem status)
    const userEvents = events.filter(e => 
        e.collaboratorId === c.id && 
        (e.status === 'aprovado' || e.status === undefined)
    );
    const userAdjustments = adjustments.filter(a => a.collaboratorId === c.id);
    
    const totalGained = userEvents.reduce((acc, curr) => acc + curr.daysGained, 0);
    const totalUsed = userEvents.reduce((acc, curr) => acc + curr.daysUsed, 0);
    const totalAdjusted = userAdjustments.reduce((acc, curr) => acc + curr.amount, 0);
    
    const balance = (totalGained - totalUsed) + totalAdjusted;
    
    return { ...c, balance, totalGained, totalUsed, totalAdjusted };
  }).sort((a, b) => b.balance - a.balance);

  const filteredBalances = balances.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.colabId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter Log Items based on Sector, Search Term, and Profile
  const filteredLogItems = useMemo(() => {
     const allLogs = [
        ...events
            .filter(e => e.status === 'aprovado' || e.status === undefined) // Mostrar apenas aprovados no log de saldo? Ou mostrar todos com indicação? Vamos mostrar todos, mas indicar status se não aprovado
            .map(e => ({ ...e, logType: 'event', date: e.createdAt })),
        ...adjustments.map(a => ({ ...a, logType: 'adj', date: a.createdAt }))
     ];

     return allLogs
      .filter(item => {
          const colab = collaborators.find(c => c.id === item.collaboratorId);
          if (!colab) return false;

          // 1. Strict Privacy Check for Log
          if (currentUserProfile === 'colaborador' && userColabId) {
              if (colab.id !== userColabId) return false;
          }
          
          // 2. Sector Check
          if (currentUserAllowedSectors.length > 0) {
             if (!colab.sector || !currentUserAllowedSectors.includes(colab.sector)) return false;
          }

          // 3. Search Term Check
          if (searchTerm) {
             const term = searchTerm.toLowerCase();
             return colab.name.toLowerCase().includes(term) || colab.colabId.toLowerCase().includes(term);
          }
          
          return true;
      })
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50);

  }, [events, adjustments, collaborators, currentUserAllowedSectors, searchTerm, currentUserProfile, userColabId]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card Saldo */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Saldo de Folgas {currentUserAllowedSectors.length > 0 && <span className="text-sm font-normal text-gray-500">(Filtrado por setor)</span>}</h2>
          
          {/* Search Input */}
          <div className="mb-4 relative">
            <input 
              type="text" 
              placeholder="🔍 Filtrar por Nome ou ID..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
            />
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {filteredBalances.length === 0 ? (
              <p className="text-gray-400 text-center text-sm py-4">
                {balances.length === 0 ? 'Nenhum colaborador na área de atuação.' : 'Nenhum colaborador encontrado.'}
              </p>
            ) : filteredBalances.map(c => {
              let badgeColor = 'bg-blue-100 text-blue-800';
              if (c.balance > 0) badgeColor = 'bg-emerald-100 text-emerald-800';
              if (c.balance < 0) badgeColor = 'bg-red-100 text-red-800';

              return (
                <div key={c.id} className="flex flex-col sm:flex-row items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50/50 hover:border-indigo-300 transition-colors">
                  <div className="mb-2 sm:mb-0 text-center sm:text-left">
                    <div className="font-bold text-gray-800 flex items-center justify-center sm:justify-start gap-2">
                      {c.name}
                      <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">ID: {c.colabId}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Ganho: {c.totalGained} | Usado: {c.totalUsed} | Ajustes: {c.totalAdjusted > 0 ? '+' : ''}{c.totalAdjusted}
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-lg font-bold ${badgeColor}`}>
                    Saldo: {c.balance} dias
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card Lançamento Manual */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
           <h2 className="text-xl font-bold text-gray-800 mb-6">Lançamento Manual</h2>
           {canEdit ? (
           <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
             <div>
               <label className="text-xs font-semibold text-gray-600 mb-1">Colaborador (Beneficiário) *</label>
               <select
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
                  value={adjForm.collaboratorId}
                  onChange={e => setAdjForm({...adjForm, collaboratorId: e.target.value})}
               >
                  <option value="">Selecione...</option>
                  {allowedCollaborators.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
               </select>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="text-xs font-semibold text-gray-600 mb-1">Tipo *</label>
                 <select
                    required
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
                    value={adjForm.type}
                    onChange={e => setAdjForm({...adjForm, type: e.target.value as 'credit' | 'debit'})}
                 >
                    <option value="credit">Crédito (+)</option>
                    <option value="debit">Débito (-)</option>
                 </select>
               </div>
               <div>
                 <label className="text-xs font-semibold text-gray-600 mb-1">Qtd Dias (Inteiro) *</label>
                 <input
                    required
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="1"
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
                    value={adjForm.days}
                    onChange={(e) => {
                       const val = e.target.value.replace(/\D/g, '');
                       setAdjForm({...adjForm, days: val});
                    }}
                 />
               </div>
             </div>

             <div>
                <label className="text-xs font-semibold text-gray-600 mb-1">Motivo *</label>
                <input
                  required
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
                  placeholder="Ex: Erro de lançamento anterior"
                  value={adjForm.reason}
                  onChange={e => setAdjForm({...adjForm, reason: e.target.value})}
                />
             </div>

             <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600 flex justify-between items-center">
                <span>Responsável pelo ajuste:</span>
                <span className="font-bold text-indigo-600">{currentUserName}</span>
             </div>

             <button type="submit" className="w-full bg-[#667eea] hover:bg-[#5a6fd6] text-white font-bold py-2.5 px-4 rounded-lg transition-transform active:scale-95 shadow-md">
                Lançar Ajuste
             </button>
           </form>
           ) : <p className="text-gray-500 text-center italic">Você não tem permissão para realizar ajustes manuais.</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Log Geral de Movimentações {(searchTerm || currentUserAllowedSectors.length > 0) && <span className="text-sm font-normal text-gray-500">(Filtrado)</span>}</h2>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filteredLogItems.map((item: any) => {
             const colab = collaborators.find(c => c.id === item.collaboratorId);
             let text = '';
             let borderClass = 'border-gray-400';

             if (item.logType === 'event') {
                const eventLabel = item.typeLabel || item.type;
                const status = item.status || 'aprovado';
                
                // Lógica de exibição baseada no ganho/perda de dias, e não apenas no ID string
                if (item.daysGained > 0) {
                   text = `registrou "${eventLabel}" (+${item.daysGained} dias).`;
                   borderClass = 'border-green-400';
                } else if (item.daysUsed > 0) {
                   text = `registrou "${eventLabel}" (-${item.daysUsed} dias).`;
                   borderClass = 'border-red-400';
                } else {
                   // Evento neutro (sem ganho nem perda de saldo), ex: Férias (neste sistema)
                   if (item.type === 'ferias' || eventLabel.toLowerCase().includes('férias')) {
                       text = `entrou de férias.`;
                   } else {
                       text = `registrou evento: ${eventLabel}.`;
                   }
                   borderClass = 'border-blue-400';
                }

                if (status !== 'aprovado') {
                     text += ` (Status: ${status})`;
                     borderClass = 'border-gray-300 border-dashed opacity-75';
                }

             } else {
                text = `Ajuste Manual (${item.amount > 0 ? '+' : ''}${item.amount}): ${item.reason} (Resp: ${item.createdBy})`;
                borderClass = 'border-purple-400';
             }

             return (
               <div key={item.id} className={`text-sm p-3 border-l-4 ${borderClass} bg-gray-50 rounded-r`}>
                 <div className="text-xs text-gray-400 mb-1">{new Date(item.date).toLocaleString('pt-BR')}</div>
                 <span className="font-bold text-gray-700">{colab?.name || 'Desconhecido'}</span> <span className="text-gray-600">{text}</span>
               </div>
             );
           })
          }
          {filteredLogItems.length === 0 && <p className="text-center text-gray-400">Nenhum registro encontrado.</p>}
        </div>
      </div>
    </div>
  );
};