
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Collaborator, EventRecord, BalanceAdjustment, UserProfile } from '../types';
import { generateUUID, decimalToTimeStr, getDailyWorkHours } from '../utils/helpers';
import { dbService } from '../services/storage';

interface BalanceProps {
  collaborators: Collaborator[];
  events: EventRecord[];
  adjustments: BalanceAdjustment[];
  onAddAdjustment: (adj: BalanceAdjustment) => void;
  showToast: (msg: string, isError?: boolean) => void;
  logAction: (action: string, entity: string, details: string, user: string) => void;
  currentUserName: string;
  canCreate: boolean;
  currentUserAllowedSectors: string[]; // Novo: Filtro de setor
  currentUserProfile: UserProfile;
  userColabId: string | null;
}

export const Balance: React.FC<BalanceProps> = ({ 
  collaborators, events, adjustments, onAddAdjustment, showToast, logAction, currentUserName, 
  canCreate, 
  currentUserAllowedSectors, currentUserProfile, userColabId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [adjForm, setAdjForm] = useState({
    collaboratorId: '',
    type: 'credit' as 'credit' | 'debit',
    days: '',
    reason: ''
  });

  // Estado para o Dropdown Customizado
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [colabSearch, setColabSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Estados para Importação CSV
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter Collaborators First based on Sector Restrictions and Profile
  const allowedCollaborators = useMemo(() => {
     let filtered = collaborators;

     // 0. Filter Active
     filtered = filtered.filter(c => c.active !== false);

     // 1. Strict Privacy for 'colaborador' profile
     if (currentUserProfile === 'colaborador' && userColabId) {
        return filtered.filter(c => c.id === userColabId);
     }

     // 2. Sector filtering
     if (currentUserAllowedSectors.length > 0) {
         filtered = filtered.filter(c => c.sector && currentUserAllowedSectors.includes(c.sector));
     }

     // Ordenação Alfabética A-Z
     return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [collaborators, currentUserAllowedSectors, currentUserProfile, userColabId]);

  const handleAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    
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
    setAdjForm(prev => ({ ...prev, days: '', reason: '', collaboratorId: '' }));
    setColabSearch('');
  };

  const handleCsvImport = async () => {
      if (!csvFile) {
          showToast('Selecione um arquivo CSV.', true);
          return;
      }
      
      setIsImporting(true);
      const reader = new FileReader();
      
      reader.onload = async (e) => {
          try {
              const text = e.target?.result as string;
              if (!text) return;

              const lines = text.split('\n');
              let updatedCount = 0;
              let errorCount = 0;

              // Identificar delimitador (vírgula ou ponto e vírgula)
              const firstLine = lines[0] || '';
              const separator = firstLine.includes(';') ? ';' : ',';

              for (const line of lines) {
                  const parts = line.trim().split(separator);
                  if (parts.length < 2) continue; // Skip linhas inválidas

                  // Assume ID na primeira coluna e Horas na última
                  const idStr = parts[0].trim();
                  const hoursStr = parts[parts.length - 1].trim();
                  
                  if (!idStr || !hoursStr || idStr.toLowerCase() === 'id') continue; // Header check

                  // Parse Hours (HH:MM or Decimal)
                  let hoursValue = 0;
                  if (hoursStr.includes(':')) {
                      const [h, m] = hoursStr.split(':').map(Number);
                      hoursValue = (h || 0) + ((m || 0) / 60);
                      // Handle negative format "-HH:MM"
                      if (hoursStr.startsWith('-')) hoursValue = -Math.abs(hoursValue);
                  } else {
                      hoursValue = parseFloat(hoursStr.replace(',', '.'));
                  }

                  if (isNaN(hoursValue)) {
                      errorCount++;
                      continue;
                  }

                  // Find Collaborator
                  // Importante: Só atualiza se o colaborador estiver na lista "allowedCollaborators" (filial filtrada)
                  const colab = allowedCollaborators.find(c => c.colabId === idStr);
                  
                  if (colab) {
                      await dbService.updateCollaborator(colab.id, { balanceHours: hoursValue });
                      updatedCount++;
                  }
              }

              showToast(`Importação concluída! ${updatedCount} atualizados. ${errorCount > 0 ? `${errorCount} erros.` : ''}`);
              logAction('update', 'ajuste_saldo', `Importação CSV: ${updatedCount} saldos atualizados.`, currentUserName);
              setCsvFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';

          } catch (err) {
              console.error(err);
              showToast('Erro ao processar arquivo CSV.', true);
          } finally {
              setIsImporting(false);
          }
      };

      reader.readAsText(csvFile);
  };

  // Opções filtradas para o dropdown de busca
  const filteredDropdownOptions = useMemo(() => {
      return allowedCollaborators.filter(c => 
          c.name.toLowerCase().includes(colabSearch.toLowerCase()) ||
          c.colabId.toLowerCase().includes(colabSearch.toLowerCase())
      );
  }, [allowedCollaborators, colabSearch]);

  const selectedCollaboratorName = useMemo(() => {
      return collaborators.find(c => c.id === adjForm.collaboratorId)?.name;
  }, [adjForm.collaboratorId, collaborators]);

  // CALCULO DE SALDOS (Prioriza Importação CSV se existir, senão Cálculo Histórico)
  const balances = useMemo(() => {
    return allowedCollaborators.map(c => {
        // Se existe saldo importado, usa ele como base (Snapshot)
        // Nota: Idealmente somaria eventos POSTERIORES à importação, mas a regra solicitada é "Sobrescreva".
        // Vamos exibir o valor importado diretamente se existir.
        
        let balanceHours = 0;
        let balanceDays = 0;
        const dailyHours = getDailyWorkHours(c.schedule);

        if (c.balanceHours !== undefined) {
            balanceHours = c.balanceHours;
            // Converte horas em dias
            balanceDays = dailyHours > 0 ? parseFloat((balanceHours / dailyHours).toFixed(1)) : 0;
        } else {
            // Cálculo Legado (Eventos em Dias)
            const userEvents = events.filter(e => 
                e.collaboratorId === c.id && 
                (e.status === 'aprovado' || e.status === undefined)
            );
            const userAdjustments = adjustments.filter(a => a.collaboratorId === c.id);
            
            const totalGained = userEvents.reduce((acc, curr) => acc + curr.daysGained, 0);
            const totalUsed = userEvents.reduce((acc, curr) => acc + curr.daysUsed, 0);
            const totalAdjusted = userAdjustments.reduce((acc, curr) => acc + curr.amount, 0);
            
            balanceDays = (totalGained - totalUsed) + totalAdjusted;
            balanceHours = balanceDays * dailyHours;
        }
        
        return { 
            ...c, 
            balanceDays, 
            balanceHours,
            dailyHours
        };
    });
  }, [allowedCollaborators, events, adjustments]);

  const filteredBalances = useMemo(() => {
    return balances.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.colabId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [balances, searchTerm]);

  // Grouping Logic
  const positiveBalances = useMemo(() => filteredBalances.filter(c => c.balanceHours > 0).sort((a,b) => b.balanceHours - a.balanceHours), [filteredBalances]);
  const zeroBalances = useMemo(() => filteredBalances.filter(c => c.balanceHours === 0).sort((a,b) => a.name.localeCompare(b.name)), [filteredBalances]);
  const negativeBalances = useMemo(() => filteredBalances.filter(c => c.balanceHours < 0).sort((a,b) => a.balanceHours - b.balanceHours), [filteredBalances]);

  // Filter Log Items based on Sector, Search Term, and Profile
  const filteredLogItems = useMemo(() => {
     const allLogs = [
        ...events
            .filter(e => e.status === 'aprovado' || e.status === undefined)
            .map(e => ({ ...e, logType: 'event', date: e.createdAt })),
        ...adjustments.map(a => ({ ...a, logType: 'adj', date: a.createdAt }))
     ];

     return allLogs
      .filter(item => {
          const colab = collaborators.find(c => c.id === item.collaboratorId);
          if (!colab) return false;

          // 0. Active Check
          if (colab.active === false) return false;

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
    <div className="space-y-8 animate-fadeIn">
      
      {/* Top Bar: Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  🏦 Banco de Horas
                  {currentUserAllowedSectors.length > 0 && <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">(Setor Filtrado)</span>}
              </h2>
          </div>
          <div className="relative w-full sm:w-80">
              <input 
                type="text" 
                placeholder="🔍 Filtrar funcionários por nome ou ID..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-3 pr-10 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50 focus:bg-white transition-all"
              />
              {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2 text-gray-400 hover:text-gray-600">✕</button>
              )}
          </div>
      </div>

      {/* Seção de Importação CSV */}
      {canCreate && (
      <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-white to-indigo-50">
          <div className="flex-1">
              <h3 className="text-sm font-bold text-indigo-800 uppercase mb-2 flex items-center gap-2">
                  📂 Importar Relatório de Horas (CSV)
              </h3>
              <p className="text-xs text-gray-600 mb-2">
                  Atualize o banco de horas em massa. O arquivo deve conter colunas com <b>ID (Matrícula)</b> e <b>Horas (Saldo)</b>.
                  <br/><i>Nota: Isso sobrescreverá o saldo atual dos colaboradores da filial selecionada.</i>
              </p>
              <div className="flex items-center gap-2">
                  <input 
                      type="file" 
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer"
                  />
                  <button 
                      onClick={handleCsvImport}
                      disabled={!csvFile || isImporting}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
                  >
                      {isImporting ? 'Importando...' : 'Importar CSV'}
                  </button>
              </div>
          </div>
      </div>
      )}

      {/* Cards de Visualização Positivo / Negativo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Positivo */}
          <div className="bg-white rounded-xl shadow-lg border border-emerald-100 flex flex-col h-[400px]">
              <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center rounded-t-xl">
                  <h3 className="text-emerald-800 font-bold flex items-center gap-2">
                      <span className="text-xl">📈</span> Saldo Positivo
                  </h3>
                  <span className="bg-white text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 shadow-sm">
                      {positiveBalances.length} Colaboradores
                  </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
                  {positiveBalances.map(c => (
                      <div key={c.id} className="flex justify-between items-center p-3 bg-white border border-emerald-50 hover:border-emerald-200 rounded-lg shadow-sm hover:shadow-md transition-all">
                          <div>
                              <div className="font-bold text-gray-800 text-sm">{c.name}</div>
                              <div className="text-[10px] text-gray-500 font-mono">ID: {c.colabId}</div>
                          </div>
                          <div className="text-right">
                              <div className="font-bold text-emerald-600 text-sm bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                  {decimalToTimeStr(c.balanceHours)}
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                  ~ {c.balanceDays} dias de folga
                              </div>
                          </div>
                      </div>
                  ))}
                  {positiveBalances.length === 0 && <p className="text-center text-gray-400 py-10 italic">Nenhum saldo positivo.</p>}
              </div>
          </div>

          {/* Card Negativo */}
          <div className="bg-white rounded-xl shadow-lg border border-rose-100 flex flex-col h-[400px]">
              <div className="p-4 bg-rose-50 border-b border-rose-100 flex justify-between items-center rounded-t-xl">
                  <h3 className="text-rose-800 font-bold flex items-center gap-2">
                      <span className="text-xl">📉</span> Saldo Negativo
                  </h3>
                  <span className="bg-white text-rose-700 px-3 py-1 rounded-full text-xs font-bold border border-rose-200 shadow-sm">
                      {negativeBalances.length} Colaboradores
                  </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
                  {negativeBalances.map(c => (
                      <div key={c.id} className="flex justify-between items-center p-3 bg-white border border-rose-50 hover:border-rose-200 rounded-lg shadow-sm hover:shadow-md transition-all">
                          <div>
                              <div className="font-bold text-gray-800 text-sm">{c.name}</div>
                              <div className="text-[10px] text-gray-500 font-mono">ID: {c.colabId}</div>
                          </div>
                          <div className="text-right">
                              <div className="font-bold text-rose-600 text-sm bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                  {decimalToTimeStr(c.balanceHours)}
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                  ~ {Math.abs(c.balanceDays)} dias a pagar
                              </div>
                          </div>
                      </div>
                  ))}
                  {negativeBalances.length === 0 && <p className="text-center text-gray-400 py-10 italic">Nenhum saldo negativo.</p>}
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card Lançamento Manual */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 flex flex-col">
           <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
               📝 Lançamento Manual (Dias)
           </h2>
           {canCreate ? (
           <form onSubmit={handleAdjustmentSubmit} className="space-y-4 flex-1">
             <div className="relative" ref={dropdownRef}>
               <label className="text-xs font-semibold text-gray-600 mb-1 block">Colaborador (Beneficiário) *</label>
               
               {/* Custom Select with Search */}
               <div 
                 onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                 className="w-full border border-gray-300 rounded-lg p-3 bg-white text-gray-700 cursor-pointer flex justify-between items-center focus:ring-2 focus:ring-indigo-500 shadow-sm hover:border-indigo-300 transition-colors"
               >
                  <span className={adjForm.collaboratorId ? "text-gray-900 font-medium" : "text-gray-400"}>
                      {selectedCollaboratorName || "Selecione o colaborador..."}
                  </span>
                  <svg className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
               </div>

               {isDropdownOpen && (
                   <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col animate-fadeIn">
                       <div className="p-2 border-b border-gray-100 bg-gray-50">
                           <input 
                               type="text" 
                               autoFocus
                               placeholder="Buscar por Nome ou ID..." 
                               className="w-full border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-indigo-500"
                               value={colabSearch}
                               onChange={e => setColabSearch(e.target.value)}
                           />
                       </div>
                       <div className="overflow-y-auto flex-1 p-1 space-y-1 custom-scrollbar">
                           {filteredDropdownOptions.map(c => (
                               <div 
                                   key={c.id} 
                                   onClick={() => {
                                       setAdjForm({...adjForm, collaboratorId: c.id});
                                       setIsDropdownOpen(false);
                                       setColabSearch('');
                                   }}
                                   className={`flex items-center justify-between p-2 hover:bg-indigo-50 cursor-pointer rounded text-sm transition-colors ${adjForm.collaboratorId === c.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700'}`}
                               >
                                   <span>{c.name}</span>
                                   <span className="text-xs text-gray-400 font-mono bg-gray-100 px-1 rounded">{c.colabId}</span>
                               </div>
                           ))}
                           {filteredDropdownOptions.length === 0 && (
                               <p className="text-center text-gray-400 text-xs py-2">Nada encontrado</p>
                           )}
                       </div>
                   </div>
               )}
             </div>
             
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="text-xs font-semibold text-gray-600 mb-1 block">Tipo de Ajuste *</label>
                 <select
                    required
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
                    value={adjForm.type}
                    onChange={e => setAdjForm({...adjForm, type: e.target.value as 'credit' | 'debit'})}
                 >
                    <option value="credit">Crédito (+)</option>
                    <option value="debit">Débito (-)</option>
                 </select>
               </div>
               <div>
                 <label className="text-xs font-semibold text-gray-600 mb-1 block">Qtd Dias (Inteiro) *</label>
                 <input
                    required
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="1"
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
                    value={adjForm.days}
                    onChange={(e) => {
                       const val = e.target.value.replace(/\D/g, '');
                       setAdjForm({...adjForm, days: val});
                    }}
                 />
               </div>
             </div>

             <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Motivo / Justificativa *</label>
                <input
                  required
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
                  placeholder="Ex: Erro de lançamento anterior"
                  value={adjForm.reason}
                  onChange={e => setAdjForm({...adjForm, reason: e.target.value})}
                />
             </div>

             <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600 flex justify-between items-center mt-auto">
                <span>Responsável:</span>
                <span className="font-bold text-indigo-600">{currentUserName}</span>
             </div>

             <button type="submit" className="w-full bg-[#667eea] hover:bg-[#5a6fd6] text-white font-bold py-3 px-4 rounded-lg transition-transform active:scale-95 shadow-md flex items-center justify-center gap-2">
                <span>💾</span> Confirmar Ajuste
             </button>
           </form>
           ) : <div className="flex-1 flex items-center justify-center p-10 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-400 italic">Você não tem permissão para realizar ajustes manuais.</div>}
        </div>

        {/* Card Log Geral */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 flex flex-col h-[500px]">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                📜 Log de Movimentações
            </h2>
            <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
            {filteredLogItems.map((item: any) => {
                const colab = collaborators.find(c => c.id === item.collaboratorId);
                let text = '';
                let borderClass = 'border-gray-400';
                let bgClass = 'bg-gray-50';

                if (item.logType === 'event') {
                    const eventLabel = item.typeLabel || item.type;
                    const status = item.status || 'aprovado';
                    
                    if (item.daysGained > 0) {
                        text = `registrou "${eventLabel}" (+${item.daysGained} dias).`;
                        borderClass = 'border-emerald-400';
                        bgClass = 'bg-emerald-50/50';
                    } else if (item.daysUsed > 0) {
                        text = `registrou "${eventLabel}" (-${item.daysUsed} dias).`;
                        borderClass = 'border-rose-400';
                        bgClass = 'bg-rose-50/50';
                    } else {
                        if (item.type === 'ferias' || eventLabel.toLowerCase().includes('férias')) {
                            text = `entrou de férias.`;
                        } else {
                            text = `registrou evento: ${eventLabel}.`;
                        }
                        borderClass = 'border-blue-400';
                        bgClass = 'bg-blue-50/50';
                    }

                    if (status !== 'aprovado') {
                        text += ` (Status: ${status})`;
                        borderClass = 'border-gray-300 border-dashed';
                        bgClass = 'bg-gray-50 opacity-70';
                    }

                } else {
                    text = `Ajuste Manual (${item.amount > 0 ? '+' : ''}${item.amount}): ${item.reason}`;
                    borderClass = 'border-purple-400';
                    bgClass = 'bg-purple-50/50';
                }

                return (
                <div key={item.id} className={`text-sm p-3 border-l-4 ${borderClass} ${bgClass} rounded-r-lg transition-all hover:translate-x-1`}>
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-gray-800">{colab?.name || 'Desconhecido'}</span>
                        <div className="text-[10px] text-gray-500">{new Date(item.date).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <span className="text-gray-600 block leading-tight">{text}</span>
                    {item.createdBy && <div className="text-[9px] text-gray-400 mt-1 text-right">Por: {item.createdBy}</div>}
                </div>
                );
            })
            }
            {filteredLogItems.length === 0 && <p className="text-center text-gray-400 py-10 italic">Nenhum registro encontrado.</p>}
            </div>
        </div>
      </div>
    </div>
  );
};
