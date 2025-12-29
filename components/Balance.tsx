import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Collaborator, EventRecord, BalanceAdjustment, UserProfile } from '../types';
import { generateUUID } from '../utils/helpers';
import { Modal } from './ui/Modal';

interface BalanceProps {
  collaborators: Collaborator[];
  events: EventRecord[];
  adjustments: BalanceAdjustment[];
  onAddAdjustment: (adj: BalanceAdjustment) => void;
  onUpdateCollaborator: (id: string, data: Partial<Collaborator>) => void;
  showToast: (msg: string, isError?: boolean) => void;
  logAction: (action: string, entity: string, details: string, user: string) => void;
  currentUserName: string;
  canCreate: boolean;
  currentUserAllowedSectors: string[];
  currentUserProfile: UserProfile;
  userColabId: string | null;
}

export const Balance: React.FC<BalanceProps> = ({ 
  collaborators, events, adjustments, onAddAdjustment, onUpdateCollaborator, showToast, logAction, currentUserName, 
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

  // --- HTML IMPORT STATES ---
  const [isProcessing, setIsProcessing] = useState(false);
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

  // Filter Collaborators
  const allowedCollaborators = useMemo(() => {
     let filtered = collaborators;
     filtered = filtered.filter(c => c.active !== false);

     if (currentUserProfile === 'colaborador' && userColabId) {
        return filtered.filter(c => c.id === userColabId);
     }

     if (currentUserAllowedSectors.length > 0) {
         filtered = filtered.filter(c => c.sector && currentUserAllowedSectors.includes(c.sector));
     }

     return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [collaborators, currentUserAllowedSectors, currentUserProfile, userColabId]);

  // Dropdown options
  const filteredDropdownOptions = useMemo(() => {
      return allowedCollaborators.filter(c => 
          c.name.toLowerCase().includes(colabSearch.toLowerCase()) ||
          c.colabId.toLowerCase().includes(colabSearch.toLowerCase())
      );
  }, [allowedCollaborators, colabSearch]);

  const selectedCollaboratorName = useMemo(() => {
      return collaborators.find(c => c.id === adjForm.collaboratorId)?.name;
  }, [adjForm.collaboratorId, collaborators]);

  // --- BALANCE CALCULATIONS ---
  const balances = useMemo(() => {
    return allowedCollaborators.map(c => {
        const userEvents = events.filter(e => 
            e.collaboratorId === c.id && 
            (e.status === 'aprovado' || e.status === undefined)
        );
        const userAdjustments = adjustments.filter(a => a.collaboratorId === c.id);
        
        const totalGained = userEvents.reduce((acc, curr) => acc + curr.daysGained, 0);
        const totalUsed = userEvents.reduce((acc, curr) => acc + curr.daysUsed, 0);
        const totalAdjusted = userAdjustments.reduce((acc, curr) => acc + curr.amount, 0);
        
        const balance = (totalGained - totalUsed) + totalAdjusted;
        
        return { ...c, balance };
    });
  }, [allowedCollaborators, events, adjustments]);

  const filteredBalances = useMemo(() => {
    return balances.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.colabId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [balances, searchTerm]);

  // System Balances (Cards Top)
  const positiveBalances = useMemo(() => filteredBalances.filter(c => c.balance > 0).sort((a,b) => b.balance - a.balance), [filteredBalances]);
  const zeroBalances = useMemo(() => filteredBalances.filter(c => c.balance === 0).sort((a,b) => a.name.localeCompare(b.name)), [filteredBalances]);
  const negativeBalances = useMemo(() => filteredBalances.filter(c => c.balance < 0).sort((a,b) => a.balance - b.balance), [filteredBalances]);

  // Imported Balances (Cards Bottom) - Bank Balance IS NOW MINUTES
  const importedPositive = useMemo(() => filteredBalances.filter(c => (c.bankBalance || 0) > 0).sort((a,b) => (b.bankBalance || 0) - (a.bankBalance || 0)), [filteredBalances]);
  const importedNegative = useMemo(() => filteredBalances.filter(c => (c.bankBalance || 0) < 0).sort((a,b) => (a.bankBalance || 0) - (b.bankBalance || 0)), [filteredBalances]);
  
  // Totals for Imported (Minutes)
  const totalImportedPositiveMinutes = importedPositive.reduce((acc, c) => acc + (c.bankBalance || 0), 0);
  const totalImportedNegativeMinutes = importedNegative.reduce((acc, c) => acc + (c.bankBalance || 0), 0);

  // Helper to format minutes to HH:MM
  const formatMinutesToHHMM = (totalMinutes: number) => {
      // Garante que -0 seja tratado como 0 visualmente
      if (totalMinutes === 0) return "00:00";
      
      const sign = totalMinutes < 0 ? '-' : '';
      const abs = Math.abs(totalMinutes);
      const h = Math.floor(abs / 60);
      const m = Math.round(abs % 60);
      return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const filteredLogItems = useMemo(() => {
     const allLogs = [
        ...events.filter(e => e.status === 'aprovado' || e.status === undefined).map(e => ({ ...e, logType: 'event', date: e.createdAt })),
        ...adjustments.map(a => ({ ...a, logType: 'adj', date: a.createdAt }))
     ];
     return allLogs
      .filter(item => {
          const colab = collaborators.find(c => c.id === item.collaboratorId);
          if (!colab) return false;
          if (colab.active === false) return false;
          if (currentUserProfile === 'colaborador' && userColabId && colab.id !== userColabId) return false;
          if (currentUserAllowedSectors.length > 0 && (!colab.sector || !currentUserAllowedSectors.includes(colab.sector))) return false;
          if (searchTerm) {
             const term = searchTerm.toLowerCase();
             return colab.name.toLowerCase().includes(term) || colab.colabId.toLowerCase().includes(term);
          }
          return true;
      })
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50);
  }, [events, adjustments, collaborators, currentUserAllowedSectors, searchTerm, currentUserProfile, userColabId]);

  // --- HTML PARSING LOGIC ---

  const parseHourStringToMinutes = (str: string): number => {
    if (!str) return 0;
    // Remove qualquer sinal e espaços
    const cleanStr = str.replace(/[^0-9:]/g, '');
    const parts = cleanStr.split(':');
    if (parts.length < 2) return 0;
    
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
  };

  const handleHtmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsProcessing(true);
      const reader = new FileReader();

      reader.onload = async (event) => {
          try {
              const htmlContent = event.target?.result as string;
              if (!htmlContent) throw new Error("Arquivo vazio");

              const parser = new DOMParser();
              const doc = parser.parseFromString(htmlContent, 'text/html');
              const rows = Array.from(doc.querySelectorAll('tr'));
              
              let idCol = -1;
              let hoursCol = -1;
              let headerRowIndex = -1;

              // 1. Find Headers
              for (let i = 0; i < Math.min(rows.length, 50); i++) {
                  const cells = Array.from(rows[i].querySelectorAll('td, th'));
                  cells.forEach((cell, idx) => {
                      const text = cell.textContent?.toLowerCase().trim() || '';
                      if (text === 'id' || text === 'matrícula' || text === 'matricula') idCol = idx;
                      if (text.includes('horas acumuladas') || text.includes('saldo')) hoursCol = idx;
                  });
                  if (idCol !== -1 && hoursCol !== -1) {
                      headerRowIndex = i;
                      break;
                  }
              }

              if (headerRowIndex === -1) {
                  throw new Error("Colunas 'ID' e 'Horas Acumuladas' não encontradas. Verifique o arquivo.");
              }

              let updatedCount = 0;
              let ignoredCount = 0;
              const now = new Date().toISOString();
              
              // Set of allowed Colab IDs (Matrículas) for fast lookup
              const allowedIds = new Set(allowedCollaborators.map(c => c.colabId));

              // 2. Process Rows
              for (let i = headerRowIndex + 1; i < rows.length; i++) {
                  const cells = Array.from(rows[i].querySelectorAll('td'));
                  if (cells.length <= Math.max(idCol, hoursCol)) continue;

                  const idVal = cells[idCol].textContent?.trim();
                  const hoursVal = cells[hoursCol].textContent?.trim();
                  
                  // Color Detection logic
                  const styleAttr = cells[hoursCol].getAttribute('style') || '';
                  const cellHtml = cells[hoursCol].outerHTML; // Fallback to check raw HTML if needed
                  
                  // Check for specific hex codes defined in requirements
                  // Green: #b5f9b5, Red: #ffb6c1
                  const isGreen = styleAttr.includes('#b5f9b5') || cellHtml.includes('#b5f9b5');
                  const isRed = styleAttr.includes('#ffb6c1') || cellHtml.includes('#ffb6c1');

                  if (!idVal || !hoursVal) continue;

                  if (!allowedIds.has(idVal)) {
                      ignoredCount++; // Valid row but user doesn't have permission or user doesn't exist
                      continue;
                  }

                  let sign = 0;
                  if (isGreen) sign = 1;
                  else if (isRed) sign = -1;
                  
                  // Ignore rows without the specific colors (white/neutral)
                  if (sign === 0) continue;

                  const minutes = parseHourStringToMinutes(hoursVal);
                  const totalMinutes = minutes * sign;

                  // Find and Update
                  const targetColab = allowedCollaborators.find(c => c.colabId === idVal);
                  if (targetColab) {
                      onUpdateCollaborator(targetColab.id, {
                          bankBalance: totalMinutes,
                          lastBalanceImport: now
                      });
                      updatedCount++;
                  }
              }

              showToast(`Importação concluída: ${updatedCount} atualizados. (${ignoredCount} ignorados/fora da hierarquia)`);
              logAction('update', 'ajuste_saldo', `Importação HTML: ${updatedCount} registros atualizados.`, currentUserName);

          } catch (err: any) {
              console.error("HTML Parse Error:", err);
              showToast(`Erro ao processar arquivo: ${err.message}`, true);
          } finally {
              setIsProcessing(false);
              if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
          }
      };

      reader.onerror = () => {
          showToast("Erro ao ler o arquivo.", true);
          setIsProcessing(false);
      };

      reader.readAsText(file);
  };

  const triggerFileUpload = () => {
      fileInputRef.current?.click();
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Top Bar: Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  🏦 Banco de Horas (Sistema)
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

      {/* Top 3 Cards (Calculated) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* POSITIVE */}
         <div className="bg-gradient-to-b from-white to-emerald-50/50 border border-emerald-100 rounded-xl shadow-lg flex flex-col h-[350px] overflow-hidden">
            <div className="p-4 bg-emerald-100/80 border-b border-emerald-200 flex justify-between items-center">
                <div>
                    <h3 className="text-emerald-900 font-bold flex items-center gap-2 text-lg">🚀 Folguistas</h3>
                    <p className="text-emerald-700 text-xs">Saldo Calculado (Eventos)</p>
                </div>
                <span className="bg-white text-emerald-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">{positiveBalances.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
                {positiveBalances.map(c => (
                    <div key={c.id} className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm flex justify-between items-center hover:shadow-md transition-all">
                        <div className="flex flex-col flex-1 pr-2">
                            <span className="font-bold text-gray-800 text-sm leading-tight mb-0.5">{c.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono mb-1">ID: {c.colabId}</span>
                        </div>
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold text-sm">+{c.balance}</span>
                    </div>
                ))}
            </div>
         </div>

         {/* ZERO */}
         <div className="bg-gradient-to-b from-white to-slate-50/50 border border-slate-200 rounded-xl shadow-lg flex flex-col h-[350px] overflow-hidden">
            <div className="p-4 bg-slate-100/80 border-b border-slate-200 flex justify-between items-center">
                <div>
                    <h3 className="text-slate-800 font-bold flex items-center gap-2 text-lg">⚖️ Zerados</h3>
                    <p className="text-slate-600 text-xs">Saldo Calculado (Eventos)</p>
                </div>
                <span className="bg-white text-slate-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">{zeroBalances.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
                {zeroBalances.map(c => (
                    <div key={c.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center hover:shadow-md transition-all opacity-80 hover:opacity-100">
                        <div className="flex flex-col flex-1 pr-2">
                            <span className="font-bold text-gray-700 text-sm leading-tight mb-0.5">{c.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono mb-1">ID: {c.colabId}</span>
                        </div>
                        <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold text-sm">0</span>
                    </div>
                ))}
            </div>
         </div>

         {/* NEGATIVE */}
         <div className="bg-gradient-to-b from-white to-rose-50/50 border border-rose-100 rounded-xl shadow-lg flex flex-col h-[350px] overflow-hidden">
            <div className="p-4 bg-rose-100/80 border-b border-rose-200 flex justify-between items-center">
                <div>
                    <h3 className="text-rose-900 font-bold flex items-center gap-2 text-lg">📉 A Recuperar</h3>
                    <p className="text-rose-700 text-xs">Saldo Calculado (Eventos)</p>
                </div>
                <span className="bg-white text-rose-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">{negativeBalances.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
                {negativeBalances.map(c => (
                    <div key={c.id} className="bg-white p-3 rounded-lg border border-rose-100 shadow-sm flex justify-between items-center hover:shadow-md transition-all">
                        <div className="flex flex-col flex-1 pr-2">
                            <span className="font-bold text-gray-800 text-sm leading-tight mb-0.5">{c.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono mb-1">ID: {c.colabId}</span>
                        </div>
                        <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded font-bold text-sm">{c.balance}</span>
                    </div>
                ))}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card Lançamento Manual */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 flex flex-col">
           <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
               📝 Lançamento Manual (Ajuste)
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
                    if (item.daysGained > 0) { text = `registrou "${eventLabel}" (+${item.daysGained} dias).`; borderClass = 'border-emerald-400'; bgClass = 'bg-emerald-50/50'; } 
                    else if (item.daysUsed > 0) { text = `registrou "${eventLabel}" (-${item.daysUsed} dias).`; borderClass = 'border-rose-400'; bgClass = 'bg-rose-50/50'; } 
                    else { text = `registrou evento: ${eventLabel}.`; borderClass = 'border-blue-400'; bgClass = 'bg-blue-50/50'; }
                    if (status !== 'aprovado') { text += ` (Status: ${status})`; borderClass = 'border-gray-300 border-dashed'; bgClass = 'bg-gray-50 opacity-70'; }
                } else {
                    text = `Ajuste Manual (${item.amount > 0 ? '+' : ''}${item.amount}): ${item.reason}`; borderClass = 'border-purple-400'; bgClass = 'bg-purple-50/50';
                }

                return (
                <div key={item.id} className={`text-sm p-3 border-l-4 ${borderClass} ${bgClass} rounded-r-lg transition-all`}>
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-gray-800">{colab?.name || 'Desconhecido'}</span>
                        <div className="text-[10px] text-gray-500">{new Date(item.date).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <span className="text-gray-600 block leading-tight">{text}</span>
                    {item.createdBy && <div className="text-[9px] text-gray-400 mt-1 text-right">Por: {item.createdBy}</div>}
                </div>
                );
            })}
            {filteredLogItems.length === 0 && <p className="text-center text-gray-400 py-10 italic">Nenhum registro encontrado.</p>}
            </div>
        </div>
      </div>

      {/* --- IMPORTAÇÃO HTML --- */}
      {canCreate && (
          <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
                  <span className="text-indigo-600">📥</span> Controle de Saldo (Importar HTML)
              </h2>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8 shadow-inner">
                  <div className="flex flex-col md:flex-row items-center gap-4">
                      <div className="flex-1 w-full">
                          <input 
                              type="file" 
                              accept=".html"
                              ref={fileInputRef}
                              className="hidden"
                              onChange={handleHtmlUpload}
                          />
                          <button 
                            onClick={triggerFileUpload}
                            disabled={isProcessing}
                            className="w-full h-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                          >
                              {isProcessing ? (
                                  <span className="flex items-center gap-2 font-bold text-indigo-600 animate-pulse">
                                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                      Processando arquivo...
                                  </span>
                              ) : (
                                  <>
                                      <span className="font-bold text-sm">Clique para selecionar o arquivo .html</span>
                                      <span className="text-xs">Exportado do Google Sheets (Página Web)</span>
                                  </>
                              )}
                          </button>
                      </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 flex flex-wrap gap-4">
                      <div className="flex items-center gap-1"><span className="w-3 h-3 bg-[#b5f9b5] border border-gray-300 rounded-sm"></span> Células Verdes = Positivo</div>
                      <div className="flex items-center gap-1"><span className="w-3 h-3 bg-[#ffb6c1] border border-gray-300 rounded-sm"></span> Células Vermelhas = Negativo</div>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Imported Positive Balance Card */}
                  <div className="bg-white rounded-xl shadow-lg border border-emerald-100 flex flex-col h-[400px] overflow-hidden">
                      <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
                          <div>
                              <h3 className="text-emerald-800 font-bold flex items-center gap-2">
                                  <span>📈</span> Horas Positivas (Importado)
                              </h3>
                              <p className="text-[10px] text-emerald-600">Saldo Oficial</p>
                          </div>
                          <span className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-sm font-bold shadow-sm">
                              Total: +{formatMinutesToHHMM(totalImportedPositiveMinutes)}
                          </span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                          <table className="w-full text-sm text-left">
                              <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                                  <tr>
                                      <th className="px-3 py-2">ID</th>
                                      <th className="px-3 py-2">Nome</th>
                                      <th className="px-3 py-2 text-right">Saldo</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {importedPositive.map(c => (
                                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                          <td className="px-3 py-2 font-mono text-gray-500 text-xs">{c.colabId}</td>
                                          <td className="px-3 py-2 font-bold text-gray-800 truncate max-w-[150px]">{c.name}</td>
                                          <td className="px-3 py-2 text-right font-bold text-emerald-600">+{formatMinutesToHHMM(c.bankBalance || 0)}</td>
                                      </tr>
                                  ))}
                                  {importedPositive.length === 0 && (
                                      <tr><td colSpan={3} className="text-center py-4 text-gray-400 italic">Nenhum saldo positivo importado.</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                      <div className="bg-gray-50 p-2 text-[10px] text-center text-gray-400 border-t border-gray-100">
                          {importedPositive[0]?.lastBalanceImport ? `Última importação: ${new Date(importedPositive[0].lastBalanceImport).toLocaleString()}` : 'Sem dados.'}
                      </div>
                  </div>

                  {/* Imported Negative Balance Card */}
                  <div className="bg-white rounded-xl shadow-lg border border-rose-100 flex flex-col h-[400px] overflow-hidden">
                      <div className="p-4 bg-rose-50 border-b border-rose-100 flex justify-between items-center">
                          <div>
                              <h3 className="text-rose-800 font-bold flex items-center gap-2">
                                  <span>📉</span> Horas Negativas (Importado)
                              </h3>
                              <p className="text-[10px] text-rose-600">Saldo Oficial</p>
                          </div>
                          <span className="bg-rose-600 text-white px-3 py-1 rounded-lg text-sm font-bold shadow-sm">
                              Total: {formatMinutesToHHMM(totalImportedNegativeMinutes)}
                          </span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                          <table className="w-full text-sm text-left">
                              <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                                  <tr>
                                      <th className="px-3 py-2">ID</th>
                                      <th className="px-3 py-2">Nome</th>
                                      <th className="px-3 py-2 text-right">Saldo</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {importedNegative.map(c => (
                                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                          <td className="px-3 py-2 font-mono text-gray-500 text-xs">{c.colabId}</td>
                                          <td className="px-3 py-2 font-bold text-gray-800 truncate max-w-[150px]">{c.name}</td>
                                          <td className="px-3 py-2 text-right font-bold text-rose-600">{formatMinutesToHHMM(c.bankBalance || 0)}</td>
                                      </tr>
                                  ))}
                                  {importedNegative.length === 0 && (
                                      <tr><td colSpan={3} className="text-center py-4 text-gray-400 italic">Nenhum saldo negativo importado.</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                      <div className="bg-gray-50 p-2 text-[10px] text-center text-gray-400 border-t border-gray-100">
                          {importedNegative[0]?.lastBalanceImport ? `Última importação: ${new Date(importedNegative[0].lastBalanceImport).toLocaleString()}` : 'Sem dados.'}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};