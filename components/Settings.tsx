
import React, { useState } from 'react';
import { SystemSettings, EventTypeConfig, EventBehavior } from '../types';
import { generateUUID } from '../utils/helpers';

interface SettingsProps {
  settings: SystemSettings;
  setSettings: (s: SystemSettings) => void;
  showToast: (msg: string, isError?: boolean) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, setSettings, showToast }) => {
  // States para inputs
  const [newBranch, setNewBranch] = useState('');
  const [newRole, setNewRole] = useState('');
  
  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventBehavior, setNewEventBehavior] = useState<EventBehavior>('neutral');

  // --- Handlers Filiais ---
  const addBranch = () => {
    if (!newBranch.trim()) return;
    if (settings.branches.includes(newBranch.trim())) {
      showToast('Filial já existe', true);
      return;
    }
    const updated = { ...settings, branches: [...settings.branches, newBranch.trim()] };
    setSettings(updated);
    setNewBranch('');
    // showToast é chamado pelo callback do firebase no App.tsx ou aqui? 
    // Como o setSettings agora é assíncrono (void), mostramos o toast aqui para UX imediata ou aguardamos?
    // Vamos assumir sucesso otimista ou confiar no listener.
  };

  const removeBranch = (branch: string) => {
    if (window.confirm(`Remover filial "${branch}"?`)) {
      const updated = { ...settings, branches: settings.branches.filter(b => b !== branch) };
      setSettings(updated);
    }
  };

  // --- Handlers Funções ---
  const addRole = () => {
    if (!newRole.trim()) return;
    if (settings.roles.includes(newRole.trim())) {
      showToast('Função já existe', true);
      return;
    }
    const updated = { ...settings, roles: [...settings.roles, newRole.trim()] };
    setSettings(updated);
    setNewRole('');
  };

  const removeRole = (role: string) => {
    if (window.confirm(`Remover função "${role}"?`)) {
      const updated = { ...settings, roles: settings.roles.filter(r => r !== role) };
      setSettings(updated);
    }
  };

  // --- Handlers Eventos ---
  const addEventType = () => {
    if (!newEventLabel.trim()) return;
    const newType: EventTypeConfig = {
      id: generateUUID(),
      label: newEventLabel.trim(),
      behavior: newEventBehavior
    };
    const updated = { ...settings, eventTypes: [...settings.eventTypes, newType] };
    setSettings(updated);
    setNewEventLabel('');
    setNewEventBehavior('neutral');
  };

  const removeEventType = (id: string) => {
    if (window.confirm('Remover este tipo de evento? Eventos passados manterão o registro mas a opção sumirá para novos.')) {
      const updated = { ...settings, eventTypes: settings.eventTypes.filter(e => e.id !== id) };
      setSettings(updated);
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
        <h2 className="text-xl font-bold text-gray-800 mb-4">Gerenciar Filiais</h2>
        <div className="flex gap-2 mb-4">
          <input 
            type="text" 
            className="flex-1 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Nova Filial..."
            value={newBranch}
            onChange={e => setNewBranch(e.target.value)}
          />
          <button onClick={addBranch} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
            Adicionar
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {settings.branches.map((branch) => (
            <div key={branch} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full flex items-center gap-2 border border-gray-200">
              <span>{branch}</span>
              <button onClick={() => removeBranch(branch)} className="text-red-400 hover:text-red-600 font-bold">×</button>
            </div>
          ))}
          {settings.branches.length === 0 && <span className="text-gray-400 text-sm">Nenhuma filial cadastrada.</span>}
        </div>
      </div>

      {/* FUNÇÕES */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Gerenciar Funções (Cargos)</h2>
        <div className="flex gap-2 mb-4">
          <input 
            type="text" 
            className="flex-1 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Nova Função..."
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
          />
          <button onClick={addRole} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
            Adicionar
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {settings.roles.map((role) => (
            <div key={role} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full flex items-center gap-2 border border-gray-200">
              <span>{role}</span>
              <button onClick={() => removeRole(role)} className="text-red-400 hover:text-red-600 font-bold">×</button>
            </div>
          ))}
          {settings.roles.length === 0 && <span className="text-gray-400 text-sm">Nenhuma função cadastrada.</span>}
        </div>
      </div>

      {/* TIPOS DE EVENTO */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Gerenciar Tipos de Evento</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
           <div>
             <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome do Evento</label>
             <input 
              type="text" 
              className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              placeholder="Ex: Atestado Médico"
              value={newEventLabel}
              onChange={e => setNewEventLabel(e.target.value)}
            />
           </div>
           <div>
             <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Comportamento de Saldo</label>
             <select 
               className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
               value={newEventBehavior}
               onChange={e => setNewEventBehavior(e.target.value as EventBehavior)}
             >
               <option value="neutral">Neutro (Não afeta saldo)</option>
               <option value="debit">Debita (Consome folga)</option>
               <option value="credit_1x">Credita (Ganha 1 dia)</option>
               <option value="credit_2x">Credita Dobrado (Ganha 2 dias)</option>
             </select>
           </div>
           <div className="flex items-end">
             <button onClick={addEventType} className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-semibold">
               Adicionar Tipo
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
              <button onClick={() => removeEventType(type.id)} className="text-red-500 hover:text-red-700 text-sm font-medium bg-red-50 px-3 py-1 rounded">
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
