import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Collaborator, EventRecord, BalanceAdjustment, UserProfile } from '../types';
import { generateUUID } from '../utils/helpers';
import { Modal } from './ui/Modal';
import { auth, googleProvider, signInWithPopup } from '../services/firebase';
import { GoogleAuthProvider } from 'firebase/auth';

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

// --- GOOGLE SHEETS HELPER TYPES ---
type GoogleCell = {
  formattedValue?: string;
  userEnteredFormat?: {
    backgroundColor?: { red?: number; green?: number; blue?: number };
  };
};
type GoogleRow = { values: GoogleCell[] };

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

  // --- GOOGLE SHEETS STATES ---
  const [sheetUrl, setSheetUrl] = useState('');
  const [oauthToken, setOauthToken] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{success: number, errors: number, message: string} | null>(null);
  const [authError, setAuthError] = useState(false);

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

  // --- GOOGLE SHEETS SYNC LOGIC ---

  const extractSpreadsheetId = (url: string) => {
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      return match ? match[1] : null;
  };

  const parseHourStringToMinutes = (str: string): number => {
    const parts = str.split(':');
    if (parts.length < 2) return 0;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
  };

  // Function to grant Google Permission via Popup
  const grantPermission = async () => {
      try {
          const provider = new GoogleAuthProvider();
          provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
          
          const result = await signInWithPopup(auth, provider);
          const credential = GoogleAuthProvider.credentialFromResult(result);
          const token = credential?.accessToken;
          
          if (token) {
              setOauthToken(token);
              setAuthError(false);
              // Retry Sync immediately
              handleSync(token);
          } else {
              showToast("Falha ao obter token de acesso.", true);
          }
      } catch (err) {
          console.error("Erro na autenticação:", err);
          showToast("Erro na autenticação. Verifique o console.", true);
      }
  };

  const handleSync = async (overrideToken?: string) => {
      setSyncResult(null);
      setAuthError(false);
      
      const spreadsheetId = extractSpreadsheetId(sheetUrl);
      if (!spreadsheetId) {
          showToast("Link da planilha inválido. Verifique o formato.", true);
          return;
      }

      setIsSyncing(true);

      try {
          const tokenToUse = overrideToken || oauthToken;
          
          if (!tokenToUse) {
              // Try to perform a public fetch first, but likely will need auth for private sheets or detailed data
              // If we fail here with no token, we prompt auth
          }

          const headers: any = {};
          if (tokenToUse) headers['Authorization'] = `Bearer ${tokenToUse}`;

          const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=true&ranges=A1:E100`, {
              headers
          });

          if (!response.ok) {
              if (response.status === 401 || response.status === 403) {
                  setAuthError(true); // Trigger UI to show Auth Button
                  throw new Error("Permissão necessária.");
              }
              throw new Error(`Erro na API Google Sheets: ${response.statusText}`);
          }

          const data = await response.json();
          const sheet = data.sheets?.[0];
          if (!sheet) throw new Error("Nenhuma aba encontrada na planilha.");

          const rowData = sheet.data?.[0]?.rowData as GoogleRow[];
          if (!rowData || rowData.length === 0) throw new Error("Planilha vazia.");

          // --- SMART PARSING (HEADER DETECTION) ---
          let headerRowIndex = -1;
          let idColIndex = -1;
          let hoursColIndex = -1; // "Horas Acumuladas"

          // Search in first 20 rows
          for (let i = 0; i < Math.min(rowData.length, 20); i++) {
              const row = rowData[i];
              if (!row.values) continue;
              
              row.values.forEach((cell, colIdx) => {
                  const val = cell.formattedValue?.toLowerCase().trim() || '';
                  if (val === 'id' || val === 'matrícula' || val === 'matricula') idColIndex = colIdx;
                  if (val.includes('horas acumuladas') || val.includes('saldo de horas') || val === 'saldo') hoursColIndex = colIdx;
              });

              if (idColIndex !== -1 && hoursColIndex !== -1) {
                  headerRowIndex = i;
                  break;
              }
          }

          if (headerRowIndex === -1) {
              throw new Error("Colunas obrigatórias ('ID' e 'Horas Acumuladas') não encontradas nas primeiras 20 linhas.");
          }

          // --- DATA PROCESSING ---
          let successCount = 0;
          let ignoredCount = 0;
          const allowedIds = new Set(allowedCollaborators.map(c => c.colabId));
          const now = new Date().toISOString();

          // Iterate rows after header
          for (let i = headerRowIndex + 1; i < rowData.length; i++) {
              const row = rowData[i];
              if (!row.values) continue;

              const idVal = row.values[idColIndex]?.formattedValue?.trim();
              const hoursVal = row.values[hoursColIndex]?.formattedValue?.trim();
              const color = row.values[hoursColIndex]?.userEnteredFormat?.backgroundColor;

              if (!idVal || !hoursVal) continue;

              // Check Hierarchy (Silently Ignore)
              if (!allowedIds.has(idVal)) {
                  ignoredCount++; // Just for internal stats, no user error
                  continue;
              }

              // Determine Sign based on Color
              let sign = 0;
              // Red > 0.8 & Green < 0.5 => Negative
              if ((color?.red || 0) > 0.8 && (color?.green || 0) < 0.5) sign = -1;
              // Green > 0.8 & Red < 0.5 => Positive
              else if ((color?.green || 0) > 0.8 && (color?.red || 0) < 0.5) sign = 1;
              
              // Ignore if no color match (Sign 0)
              if (sign === 0) continue;

              // Parse Minutes
              const minutes = parseHourStringToMinutes(hoursVal);
              const totalMinutes = minutes * sign;

              // Find DB ID
              const targetColab = allowedCollaborators.find(c => c.colabId === idVal);
              if (targetColab) {
                  onUpdateCollaborator(targetColab.id, {
                      bankBalance: totalMinutes, // STORE AS MINUTES
                      lastBalanceImport: now
                  });
                  successCount++;
              }
          }

          setSyncResult({
              success: successCount,
              errors: ignoredCount,
              message: `Sincronização concluída: ${successCount} atualizados.`
          });
          showToast(`Sincronização: ${successCount} atualizados.`);

      } catch (error: any) {
          if (error.message !== "Permissão necessária.") {
             console.error(error);
             setSyncResult({ success: 0, errors: 0, message: error.message });
             showToast(error.message, true);
          }
      } finally {
          setIsSyncing(false);
      }
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

      {/* --- GOOGLE SHEETS IMPORT --- */}
      {canCreate && (
          <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
                  <span className="text-green-600">📊</span> Controle de Saldo (Google Sheets)
              </h2>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8 shadow-inner">
                  <div className="flex flex-col gap-4">
                      <div className="flex flex-col md:flex-row gap-4 items-center">
                          <input 
                              type="text" 
                              value={sheetUrl}
                              onChange={e => setSheetUrl(e.target.value)}
                              placeholder="Insira o Link da Planilha Google (Ex: https://docs.google.com/spreadsheets/d/...)"
                              className="flex-1 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none w-full"
                          />
                          
                          {authError ? (
                              <button 
                                  onClick={grantPermission}
                                  className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2 justify-center"
                              >
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                                  Conceder Permissão
                              </button>
                          ) : (
                              <button 
                                  onClick={() => handleSync()}
                                  disabled={isSyncing || !sheetUrl}
                                  className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-green-700 transition-all active:scale-95 flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                  {isSyncing ? (
                                      <>
                                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                          Sincronizando...
                                      </>
                                  ) : (
                                      <>
                                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                          Sincronizar Agora
                                      </>
                                  )}
                              </button>
                          )}
                      </div>
                      
                      {syncResult && (
                          <div className={`p-3 rounded-lg text-sm border ${syncResult.errors > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                              {syncResult.message}
                          </div>
                      )}
                      
                      <p className="text-xs text-gray-500">
                          <strong>Smart Parsing:</strong> O sistema buscará as colunas "ID" e "Horas Acumuladas" nas primeiras 20 linhas.
                          <br />
                          <strong>Cores:</strong> Células <span className="text-red-500 font-bold">Vermelhas</span> são consideradas saldo negativo. <span className="text-green-600 font-bold">Verdes</span> são positivo.
                      </p>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Imported Positive Balance Card */}
                  <div className="bg-white rounded-xl shadow-lg border border-emerald-100 flex flex-col h-[400px] overflow-hidden">
                      <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
                          <div>
                              <h3 className="text-emerald-800 font-bold flex items-center gap-2">
                                  <span>📈</span> Horas Positivas (Google)
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
                                      <tr><td colSpan={3} className="text-center py-4 text-gray-400 italic">Nenhum saldo positivo.</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                      <div className="bg-gray-50 p-2 text-[10px] text-center text-gray-400 border-t border-gray-100">
                          {importedPositive[0]?.lastBalanceImport ? `Última sincronização: ${new Date(importedPositive[0].lastBalanceImport).toLocaleString()}` : 'Sem dados.'}
                      </div>
                  </div>

                  {/* Imported Negative Balance Card */}
                  <div className="bg-white rounded-xl shadow-lg border border-rose-100 flex flex-col h-[400px] overflow-hidden">
                      <div className="p-4 bg-rose-50 border-b border-rose-100 flex justify-between items-center">
                          <div>
                              <h3 className="text-rose-800 font-bold flex items-center gap-2">
                                  <span>📉</span> Horas Negativas (Google)
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
                                      <tr><td colSpan={3} className="text-center py-4 text-gray-400 italic">Nenhum saldo negativo.</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                      <div className="bg-gray-50 p-2 text-[10px] text-center text-gray-400 border-t border-gray-100">
                          {importedNegative[0]?.lastBalanceImport ? `Última sincronização: ${new Date(importedNegative[0].lastBalanceImport).toLocaleString()}` : 'Sem dados.'}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};