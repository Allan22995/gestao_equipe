
import React, { useState } from 'react';
import { SystemSettings, EventTypeConfig, EventBehavior } from '../types';
import { generateUUID } from '../utils/helpers';

interface SettingsProps {
  settings: SystemSettings;
  setSettings: (s: SystemSettings) => Promise<void>;
  showToast: (msg: string, isError?: boolean) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, setSettings, showToast }) => {
  // States para inputs
  const [newBranch, setNewBranch] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventBehavior, setNewEventBehavior] = useState<EventBehavior>('neutral');

  // Loading state para feedback visual
  const [isSaving, setIsSaving] = useState(false);

  // Helper wrapper para salvar com loading
  const handleSave = async (newSettings: SystemSettings) => {
    setIsSaving(true);
    try {
      await setSettings(newSettings);
      // Não precisa de toast aqui pois o App.tsx já mostra, mas limpamos os inputs
      return true;
    } catch (error) {
      console.error(error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // --- Handlers Filiais ---
  const addBranch = async () => {
    if (!newBranch.trim()) return;
    if (settings.branches.includes(newBranch.trim())) {
      showToast('Filial já existe', true);
      return;
    }
    const updated = { ...settings, branches: [...settings.branches, newBranch.trim()] };
    const success = await handleSave(updated);
    if (success) setNewBranch('');
  };

  const removeBranch = async (branch: string) => {
    if (window.confirm(`Remover filial "${branch}"?`)) {
      const updated = { ...settings, branches: settings.branches.filter(b => b !== branch) };
      await handleSave(updated);
    }
  };

  // --- Handlers Funções ---
  const addRole = async () => {
    if (!newRole.trim()) return;
    if (settings.roles.includes(newRole.trim())) {
      showToast('Função já existe', true);
      return;
    }
    const updated = { ...settings, roles: [...settings.roles, newRole.trim()] };
    const success = await handleSave(updated);
    if (success) setNewRole('');
  };

  const removeRole = async (role: string) => {
    if (window.confirm(`Remover função "${role}"?`)) {
      const updated = { ...settings, roles: settings.roles.filter(r => r !== role) };
      await handleSave(updated);
    }
  };

  // --- Handlers Eventos ---
  const addEventType = async () => {
    if (!newEventLabel.trim()) return;
    const newType: EventTypeConfig = {
      id: generateUUID(),
      label: newEventLabel.trim(),
      behavior: newEventBehavior
    };
    const updated = { ...settings, eventTypes: [...settings.eventTypes, newType] };
    const success = await handleSave(updated);
    if (success) {
      setNewEventLabel('');
      setNewEventBehavior('neutral');
    }
  };

  const removeEventType = async (id: string) => {
    if (window.confirm('Remover este tipo de evento? Eventos passados manterão o registro mas a opção sumirá para novos.')) {
      const updated = { ...settings, eventTypes: settings.eventTypes.filter(e => e.id !== id) };
      await handleSave(updated);
    }
  };

  const getBehaviorLabel = (b: EventBehavior) => {
    switch (b) {
      case 'neutral': return 'Neutro (Apenas Registro)';
      case 'debit': return 'Debita Saldo (Folga)';
      case 'credit_1x': return 'Credita Saldo (1x)';
      case 'credit_2x': return 'Credita Saldo (2x - Dobra)';
      default: return b;
    }
  };

  return (
    <div className="space-y-8">
      
      {/* FILIAIS */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          Gerenciar Filiais
          {isSaving && <span className="text-xs font-normal text-indigo-500 animate-pulse">(Salvando no banco...)</span>}
        </h2>
        <div className="flex gap-2 mb-4">
          <input 
            type="text" 
            className="flex-1 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Nova Filial..."
            value={newBranch}
            onChange={e => setNewBranch(e.target.value)}
            disabled={isSaving}
          />
          <button 
            onClick={addBranch} 
            disabled={isSaving}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
          >
            {isSaving ? '...' : 'Adicionar'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {settings.branches.map((branch) => (
            <div key={branch} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full flex items-center gap-2 border border-gray-200">
              <span>{branch}</span>
              <button onClick={() => removeBranch(branch)} disabled={isSaving} className="text-red-400 hover:text-red-600 font-bold disabled:opacity-50">×</button>
            </div>
          ))}
          {settings.branches.length === 0 && <span className="text-gray-400 text-sm">Nenhuma filial cadastrada.</span>}
        </div>
      </div>

      {/* FUNÇÕES */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          Gerenciar Funções (Cargos)
          {isSaving && <span className="text-xs font-normal text-indigo-500 animate-pulse">(Salvando no banco...)</span>}
        </h2>
        <div className="flex gap-2 mb-4">
          <input 
            type="text" 
            className="flex-1 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Nova Função..."
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
            disabled={isSaving}
          />
          <button 
            onClick={addRole} 
            disabled={isSaving}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
          >
            {isSaving ? '...' : 'Adicionar'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {settings.roles.map((role) => (
            <div key={role} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full flex items-center gap-2 border border-gray-200">
              <span>{role}</span>
              <button onClick={() => removeRole(role)} disabled={isSaving} className="text-red-400 hover:text-red-600 font-bold disabled:opacity-50">×</button>
            </div>
          ))}
          {settings.roles.length === 0 && <span className="text-gray-400 text-sm">Nenhuma função cadastrada.</span>}
        </div>
      </div>

      {/* TIPOS DE EVENTO */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          Gerenciar Tipos de Evento
          {isSaving && <span className="text-xs font-normal text-indigo-500 animate-pulse">(Salvando no banco...)</span>}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
           <div>
             <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome do Evento</label>
             <input 
              type="text" 
              className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              placeholder="Ex: Atestado Médico"
              value={newEventLabel}
              onChange={e => setNewEventLabel(e.target.value)}
              disabled={isSaving}
            />
           </div>
           <div>
             <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Comportamento de Saldo</label>
             <select 
               className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
               value={newEventBehavior}
               onChange={e => setNewEventBehavior(e.target.value as EventBehavior)}
               disabled={isSaving}
             >
               <option value="neutral">Neutro (Não afeta saldo)</option>
               <option value="debit">Debita (Consome folga)</option>
               <option value="credit_1x">Credita (Ganha 1 dia)</option>
               <option value="credit_2x">Credita Dobrado (Ganha 2 dias)</option>
             </select>
           </div>
           <div className="flex items-end">
             <button 
               onClick={addEventType} 
               disabled={isSaving}
               className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:bg-indigo-400"
             >
               {isSaving ? '...' : 'Adicionar Tipo'}
             </button>
           </div>
        </div>

        <div className="space-y-2">
          {settings.eventTypes.map((type) => (
            <div key={type.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div>
                <span className="font-bold text-gray-800 block">{type.label}</span>
                <span className="text-xs text-gray-500">{getBehaviorLabel(type.behavior)}</span>
              </div>
              <button 
                onClick={() => removeEventType(type.id)} 
                disabled={isSaving}
                className="text-red-500 hover:text-red-700 text-sm font-medium bg-red-50 px-3 py-1 rounded disabled:opacity-50"
              >
                Remover
              </button>
            </div>
          ))}
          {settings.eventTypes.length === 0 && <span className="text-gray-400 text-sm">Nenhum tipo de evento cadastrado.</span>}
        </div>
      </div>

    </div>
  );
};
