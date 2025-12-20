
import React, { useState, useEffect, useMemo } from 'react';
import { Collaborator, ImportedHourRecord } from '../types';
import { dbService } from '../services/storage';

interface HourImportControlProps {
  collaborators: Collaborator[];
  availableBranches: string[];
  currentUserAllowedSectors: string[];
  showToast: (msg: string, isError?: boolean) => void;
}

export const HourImportControl: React.FC<HourImportControlProps> = ({ 
  collaborators, 
  availableBranches, 
  currentUserAllowedSectors,
  showToast 
}) => {
  const [selectedBranch, setSelectedBranch] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importedData, setImportedData] = useState<ImportedHourRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar dados existentes
  useEffect(() => {
    const unsubscribe = dbService.subscribeToImportedHours((data) => {
      setImportedData(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Auto-selecionar filial se única
  useEffect(() => {
    if (availableBranches.length === 1) {
      setSelectedBranch(availableBranches[0]);
    }
  }, [availableBranches]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseCSV = async (file: File): Promise<Partial<ImportedHourRecord>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) return resolve([]);

        const lines = text.split('\n');
        const results: Partial<ImportedHourRecord>[] = [];

        // Assume primeira linha é cabeçalho? Não, o prompt diz "ID e última coluna".
        // Vamos iterar todas e tentar validar.
        lines.forEach((line) => {
          const cleanLine = line.trim();
          if (!cleanLine) return;
          
          // Suporta vírgula ou ponto e vírgula
          const cols = cleanLine.split(/[;,]/);
          if (cols.length < 2) return;

          const rawId = cols[0].trim();
          const rawHours = cols[cols.length - 1].trim().replace(',', '.'); // Corrige formato PT-BR

          // Validação básica se é número
          const hours = parseFloat(rawHours);
          
          if (rawId && !isNaN(hours)) {
            results.push({
              collaboratorId: rawId, // Será mapeado depois
              hours: hours
            });
          }
        });
        resolve(results);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  const handleImport = async () => {
    if (!selectedBranch) {
      showToast('Selecione uma filial para importar.', true);
      return;
    }
    if (!file) {
      showToast('Selecione um arquivo CSV.', true);
      return;
    }

    if (!window.confirm(`Isso irá SOBRESCREVER o saldo de horas importado anteriormente para a filial ${selectedBranch}. Confirma?`)) {
      return;
    }

    setIsImporting(true);
    try {
      const rawRecords = await parseCSV(file);
      const validRecords: ImportedHourRecord[] = [];
      let skippedCount = 0;

      // Filtrar colaboradores da filial selecionada
      const branchCollaborators = collaborators.filter(c => c.branch === selectedBranch);

      rawRecords.forEach(rec => {
        // Encontrar colaborador pelo ID (Matrícula)
        const colab = branchCollaborators.find(c => c.colabId === rec.collaboratorId);
        
        if (colab) {
          validRecords.push({
            id: '', // Será gerado no backend
            collaboratorId: colab.id, // Usa o ID interno do sistema
            hours: rec.hours || 0,
            branch: selectedBranch,
            updatedAt: new Date().toISOString()
          });
        } else {
          skippedCount++;
        }
      });

      if (validRecords.length === 0) {
        showToast('Nenhum registro válido encontrado para esta filial no CSV.', true);
        setIsImporting(false);
        return;
      }

      await dbService.saveImportedHours(selectedBranch, validRecords);
      showToast(`Importação concluída! ${validRecords.length} registros atualizados. (${skippedCount} ignorados)`);
      setFile(null); // Reset file input logic handled by key or ref usually, simplest is just state clear but input remains visually populated unless controlled completely.
      
      // Limpar input visualmente (hack simples)
      const input = document.getElementById('csvInput') as HTMLInputElement;
      if (input) input.value = '';

    } catch (error) {
      console.error(error);
      showToast('Erro ao processar arquivo.', true);
    } finally {
      setIsImporting(false);
    }
  };

  // Helper para estimar dias
  const calculateDays = (hours: number, colabId: string) => {
    // Tenta achar colaborador para ver se tem jornada especial (futuro)
    // Por enquanto, usa padrão 8.8h (8h48m) que é comum
    const divisor = 8.8; 
    return (hours / divisor).toFixed(2);
  };

  // Filtragem dos dados para exibição
  const filteredData = useMemo(() => {
    let data = importedData;

    // Filtra por filial selecionada (visualização)
    if (selectedBranch) {
      data = data.filter(d => d.branch === selectedBranch);
    } else if (availableBranches.length > 0) {
      // Se nenhuma selecionada, mostra apenas das permitidas
      data = data.filter(d => availableBranches.includes(d.branch));
    }

    // Filtra por setor (permissão)
    if (currentUserAllowedSectors.length > 0) {
      data = data.filter(d => {
        const c = collaborators.find(col => col.id === d.collaboratorId);
        return c && c.sector && currentUserAllowedSectors.includes(c.sector);
      });
    }

    return data;
  }, [importedData, selectedBranch, availableBranches, currentUserAllowedSectors, collaborators]);

  const positiveRecords = useMemo(() => filteredData.filter(d => d.hours > 0).sort((a,b) => b.hours - a.hours), [filteredData]);
  const negativeRecords = useMemo(() => filteredData.filter(d => d.hours < 0).sort((a,b) => a.hours - b.hours), [filteredData]);

  const getColabInfo = (id: string) => {
    const c = collaborators.find(col => col.id === id);
    return c ? { name: c.name, colabId: c.colabId } : { name: 'Desconhecido', colabId: '???' };
  };

  if (availableBranches.length === 0) return null; // Sem acesso a filiais

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mt-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            ⏱️ Controle de Ponto (Importação CSV)
          </h2>
          <p className="text-sm text-gray-500">Importe o saldo do relógio de ponto para visualização rápida.</p>
        </div>
        
        {/* Controles de Importação */}
        <div className="flex flex-col md:flex-row gap-3 items-end bg-gray-50 p-3 rounded-lg border border-gray-200">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Filial Alvo</label>
            <select 
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="w-full md:w-40 border border-gray-300 rounded p-1.5 text-sm bg-white"
            >
              <option value="">Selecione...</option>
              {availableBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
             <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Arquivo (.csv)</label>
             <input 
               id="csvInput"
               type="file" 
               accept=".csv"
               onChange={handleFileChange}
               className="text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
             />
          </div>
          <button 
            onClick={handleImport}
            disabled={isImporting || !file || !selectedBranch}
            className="bg-indigo-600 text-white font-bold py-1.5 px-4 rounded text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm h-[34px]"
          >
            {isImporting ? 'Lendo...' : 'Importar'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-center text-gray-400 py-8">Carregando dados...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* POSITIVOS */}
          <div className="flex flex-col h-[400px]">
             <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-bold text-emerald-700 flex items-center gap-2">
                   📈 Saldo Positivo <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full">{positiveRecords.length}</span>
                </h3>
             </div>
             <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-2 flex-1 overflow-y-auto custom-scrollbar space-y-2">
                {positiveRecords.map(rec => {
                   const info = getColabInfo(rec.collaboratorId);
                   return (
                     <div key={rec.id} className="bg-white p-3 rounded-lg border-l-4 border-emerald-400 shadow-sm flex justify-between items-center">
                        <div>
                           <div className="font-bold text-gray-800 text-sm">{info.name}</div>
                           <div className="text-xs text-gray-400 font-mono">Mat: {info.colabId}</div>
                        </div>
                        <div className="text-right">
                           <div className="font-bold text-emerald-600 text-sm">+{rec.hours}h</div>
                           <div className="text-[10px] text-gray-500">~{calculateDays(rec.hours, rec.collaboratorId)} dias</div>
                        </div>
                     </div>
                   );
                })}
                {positiveRecords.length === 0 && <p className="text-center text-gray-400 text-sm py-10 italic">Nenhum saldo positivo importado.</p>}
             </div>
          </div>

          {/* NEGATIVOS */}
          <div className="flex flex-col h-[400px]">
             <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-bold text-red-700 flex items-center gap-2">
                   📉 Saldo Negativo <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">{negativeRecords.length}</span>
                </h3>
             </div>
             <div className="bg-red-50/30 border border-red-100 rounded-xl p-2 flex-1 overflow-y-auto custom-scrollbar space-y-2">
                {negativeRecords.map(rec => {
                   const info = getColabInfo(rec.collaboratorId);
                   return (
                     <div key={rec.id} className="bg-white p-3 rounded-lg border-l-4 border-red-400 shadow-sm flex justify-between items-center">
                        <div>
                           <div className="font-bold text-gray-800 text-sm">{info.name}</div>
                           <div className="text-xs text-gray-400 font-mono">Mat: {info.colabId}</div>
                        </div>
                        <div className="text-right">
                           <div className="font-bold text-red-600 text-sm">{rec.hours}h</div>
                           <div className="text-[10px] text-gray-500">~{calculateDays(rec.hours, rec.collaboratorId)} dias</div>
                        </div>
                     </div>
                   );
                })}
                {negativeRecords.length === 0 && <p className="text-center text-gray-400 text-sm py-10 italic">Nenhum saldo negativo importado.</p>}
             </div>
          </div>

        </div>
      )}
    </div>
  );
};
