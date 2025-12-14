import React, { useState } from 'react';
import { SystemSettings, RoleConfig, EventTypeConfig, SeasonalEvent, PERMISSION_MODULES, PermissionModule } from '../types';
import { generateUUID } from '../utils/helpers';
import { Modal } from './ui/Modal';

interface SettingsProps {
  settings: SystemSettings;
  setSettings: (s: SystemSettings) => Promise<void>;
  showToast: (msg: string, isError?: boolean) => void;
  hasPermission: (perm: string) => boolean;
}

export const Settings: React.FC<SettingsProps> = ({ settings, setSettings, showToast, hasPermission }) => {
  const [activeTab, setActiveTab] = useState('general');
  
  // Local states for inputs to avoid saving on every keystroke
  const [newBranch, setNewBranch] = useState('');
  const [newSector, setNewSector] = useState('');
  const [newRole, setNewRole] = useState('');
  
  // Modal states
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  
  // Helper to update settings
  const updateSettings = async (newSettings: SystemSettings) => {
    try {
      await setSettings(newSettings);
      showToast('Configurações salvas!');
    } catch (error) {
      console.error(error);
      showToast('Erro ao salvar configurações.', true);
    }
  };

  // --- GENERAL HANDLERS ---
  const addBranch = () => {
    if (!newBranch.trim()) return;
    if (settings.branches.includes(newBranch.trim())) {
      showToast('Filial já existe.', true);
      return;
    }
    updateSettings({ ...settings, branches: [...settings.branches, newBranch.trim()] });
    setNewBranch('');
  };

  const removeBranch = (branch: string) => {
    if (window.confirm(`Remover filial ${branch}?`)) {
      updateSettings({ ...settings, branches: settings.branches.filter(b => b !== branch) });
    }
  };

  const addSector = () => {
    if (!newSector.trim()) return;
    if (settings.sectors.includes(newSector.trim())) {
      showToast('Setor já existe.', true);
      return;
    }
    updateSettings({ ...settings, sectors: [...settings.sectors, newSector.trim()] });
    setNewSector('');
  };

  const removeSector = (sector: string) => {
    if (window.confirm(`Remover setor ${sector}?`)) {
      updateSettings({ ...settings, sectors: settings.sectors.filter(s => s !== sector) });
    }
  };

  // --- ROLES HANDLERS ---
  const addRole = () => {
    if (!newRole.trim()) return;
    if (settings.roles.some(r => r.name === newRole.trim())) {
      showToast('Função já existe.', true);
      return;
    }
    const newRoleObj: RoleConfig = {
      name: newRole.trim(),
      canViewAllSectors: false,
      permissions: []
    };
    updateSettings({ ...settings, roles: [...settings.roles, newRoleObj] });
    setNewRole('');
  };

  const removeRole = (roleName: string) => {
    if (window.confirm(`Remover função ${roleName}?`)) {
      updateSettings({ ...settings, roles: settings.roles.filter(r => r.name !== roleName) });
    }
  };

  const toggleRoleViewAll = (roleName: string) => {
    const updatedRoles = settings.roles.map(r => {
      if (r.name === roleName) return { ...r, canViewAllSectors: !r.canViewAllSectors };
      return r;
    });
    updateSettings({ ...settings, roles: updatedRoles });
  };

  // --- PERMISSIONS HANDLERS ---
  const currentModuleDef = PERMISSION_MODULES.find(m => m.id === selectedModule);

  const togglePermission = (roleName: string, permissionId: string) => {
    const updatedRoles = settings.roles.map(r => {
      if (r.name !== roleName) return r;
      
      const hasPerm = r.permissions.includes(permissionId);
      let newPerms = [...r.permissions];
      if (hasPerm) {
        newPerms = newPerms.filter(p => p !== permissionId);
      } else {
        newPerms.push(permissionId);
      }
      return { ...r, permissions: newPerms };
    });
    updateSettings({ ...settings, roles: updatedRoles });
  };
  
  // --- EVENT TYPES HANDLERS ---
  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventBehavior, setNewEventBehavior] = useState<'neutral' | 'debit' | 'credit_1x' | 'credit_2x'>('neutral');

  const addEventType = () => {
     if (!newEventLabel.trim()) return;
     const id = newEventLabel.toLowerCase().replace(/\s+/g, '_');
     if (settings.eventTypes.some(t => t.id === id)) {
        showToast('Já existe um tipo com este nome/ID.', true);
        return;
     }
     const newType: EventTypeConfig = {
         id,
         label: newEventLabel.trim(),
         behavior: newEventBehavior
     };
     updateSettings({ ...settings, eventTypes: [...settings.eventTypes, newType] });
     setNewEventLabel('');
  };

  const removeEventType = (id: string) => {
      if (['ferias', 'folga', 'trabalhado'].includes(id)) {
          showToast('Não é possível remover tipos padrão do sistema.', true);
          return;
      }
      if (window.confirm('Remover este tipo de evento?')) {
          updateSettings({ ...settings, eventTypes: settings.eventTypes.filter(t => t.id !== id) });
      }
  };

  // --- SEASONAL EVENTS HANDLERS ---
  const [newSeasonal, setNewSeasonal] = useState<Partial<SeasonalEvent>>({
      label: '', startDate: '', endDate: '', color: '#3B82F6', active: true
  });

  const addSeasonal = () => {
      if (!newSeasonal.label || !newSeasonal.startDate || !newSeasonal.endDate) {
          showToast('Preencha todos os campos.', true);
          return;
      }
      const newItem: SeasonalEvent = {
          id: generateUUID(),
          label: newSeasonal.label!,
          startDate: newSeasonal.startDate!,
          endDate: newSeasonal.endDate!,
          color: newSeasonal.color || '#3B82F6',
          active: true
      };
      updateSettings({ 
          ...settings, 
          seasonalEvents: [...(settings.seasonalEvents || []), newItem] 
      });
      setNewSeasonal({ label: '', startDate: '', endDate: '', color: '#3B82F6', active: true });
  };

  const removeSeasonal = (id: string) => {
      updateSettings({ 
          ...settings, 
          seasonalEvents: (settings.seasonalEvents || []).filter(s => s.id !== id) 
      });
  };

  // --- SYSTEM MESSAGE ---
  const [sysMsg, setSysMsg] = useState({
      active: settings.systemMessage?.active || false,
      level: settings.systemMessage?.level || 'info',
      message: settings.systemMessage?.message || ''
  });

  const saveSysMsg = () => {
      updateSettings({ 
          ...settings, 
          systemMessage: sysMsg as any 
      });
  };

  return (
    <div className="space-y-6">
       {/* TABS HEADER */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex overflow-x-auto">
          {['general', 'roles', 'events', 'seasonal', 'system'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 px-6 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === tab ? 'bg-[#667eea] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                  {tab === 'general' && '🏢 Geral'}
                  {tab === 'roles' && '👥 Funções & Permissões'}
                  {tab === 'events' && '📅 Tipos de Evento'}
                  {tab === 'seasonal' && '🎉 Sazonais'}
                  {tab === 'system' && '📢 Avisos'}
              </button>
          ))}
       </div>

       {/* CONTENT - GENERAL */}
       {activeTab === 'general' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* FILIAIS */}
               <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                   <h3 className="text-lg font-bold text-gray-800 mb-4">Filiais</h3>
                   <div className="flex gap-2 mb-4">
                       <input 
                         type="text" 
                         value={newBranch} 
                         onChange={e => setNewBranch(e.target.value)}
                         placeholder="Nova Filial..."
                         className="flex-1 border border-gray-300 rounded-lg p-2 text-sm"
                       />
                       <button onClick={addBranch} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700">+</button>
                   </div>
                   <div className="flex flex-wrap gap-2">
                       {settings.branches.map(b => (
                           <div key={b} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full flex items-center gap-2 text-sm border border-gray-200">
                               {b}
                               <button onClick={() => removeBranch(b)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                           </div>
                       ))}
                   </div>
               </div>

               {/* SETORES */}
               <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                   <h3 className="text-lg font-bold text-gray-800 mb-4">Setores (Globais)</h3>
                   <div className="flex gap-2 mb-4">
                       <input 
                         type="text" 
                         value={newSector} 
                         onChange={e => setNewSector(e.target.value)}
                         placeholder="Novo Setor..."
                         className="flex-1 border border-gray-300 rounded-lg p-2 text-sm"
                       />
                       <button onClick={addSector} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700">+</button>
                   </div>
                   <div className="flex flex-wrap gap-2">
                       {settings.sectors.map(s => (
                           <div key={s} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full flex items-center gap-2 text-sm border border-gray-200">
                               {s}
                               <button onClick={() => removeSector(s)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                           </div>
                       ))}
                   </div>
               </div>
           </div>
       )}

       {/* CONTENT - ROLES */}
       {activeTab === 'roles' && (
           <div className="space-y-6">
               <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                   <h3 className="text-lg font-bold text-gray-800 mb-4">Funções e Cargos</h3>
                   <div className="flex gap-2 mb-6">
                       <input 
                         type="text" 
                         value={newRole} 
                         onChange={e => setNewRole(e.target.value)}
                         placeholder="Nova Função (Ex: Coordenador)..."
                         className="flex-1 border border-gray-300 rounded-lg p-2 text-sm"
                       />
                       <button onClick={addRole} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700">Adicionar Função</button>
                   </div>

                   <div className="overflow-x-auto">
                       <table className="w-full text-sm text-left">
                           <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                               <tr>
                                   <th className="p-3">Função</th>
                                   <th className="p-3 text-center">Visualização Global</th>
                                   <th className="p-3 text-right">Ações</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                               {settings.roles.map(r => (
                                   <tr key={r.name} className="hover:bg-gray-50">
                                       <td className="p-3 font-medium text-gray-800">{r.name}</td>
                                       <td className="p-3 text-center">
                                           <button 
                                             onClick={() => toggleRoleViewAll(r.name)}
                                             className={`px-3 py-1 rounded-full text-xs font-bold border ${r.canViewAllSectors ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                                           >
                                               {r.canViewAllSectors ? 'Irrestrito' : 'Restrito ao Setor'}
                                           </button>
                                       </td>
                                       <td className="p-3 text-right">
                                           <button onClick={() => removeRole(r.name)} className="text-red-500 hover:text-red-700 font-bold text-xs px-2">Excluir</button>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>

               <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                   <h3 className="text-lg font-bold text-gray-800 mb-4">Matriz de Permissões</h3>
                   <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                       {PERMISSION_MODULES.map(mod => (
                           <button 
                             key={mod.id}
                             onClick={() => setSelectedModule(mod.id)}
                             className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                           >
                               <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">{mod.icon}</span>
                               <span className="font-bold text-gray-700 text-sm">{mod.label}</span>
                               <span className="text-[10px] text-gray-400 mt-1">Configurar Acessos</span>
                           </button>
                       ))}
                   </div>
               </div>
           </div>
       )}

       {/* CONTENT - EVENT TYPES */}
       {activeTab === 'events' && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
               <h3 className="text-lg font-bold text-gray-800 mb-4">Tipos de Eventos Personalizados</h3>
               
               <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                   <div className="flex-1">
                       <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Rótulo</label>
                       <input 
                         type="text" 
                         value={newEventLabel} 
                         onChange={e => setNewEventLabel(e.target.value)}
                         placeholder="Ex: Licença Maternidade"
                         className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                       />
                   </div>
                   <div className="w-full md:w-48">
                       <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Comportamento</label>
                       <select 
                         value={newEventBehavior}
                         onChange={e => setNewEventBehavior(e.target.value as any)}
                         className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                       >
                           <option value="neutral">Neutro (Apenas registro)</option>
                           <option value="debit">Débito (Desconta dia)</option>
                           <option value="credit_1x">Crédito (1x)</option>
                           <option value="credit_2x">Crédito (2x - Dobra)</option>
                       </select>
                   </div>
                   <div className="flex items-end">
                       <button onClick={addEventType} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 h-10">Adicionar</button>
                   </div>
               </div>

               <div className="space-y-2">
                   {settings.eventTypes.map(t => (
                       <div key={t.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                           <div className="flex items-center gap-3">
                               <span className="font-bold text-gray-800">{t.label}</span>
                               <span className="text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-600 font-mono">{t.id}</span>
                               <span className={`text-xs px-2 py-0.5 rounded font-bold border ${
                                   t.behavior === 'neutral' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                   t.behavior === 'debit' ? 'bg-red-100 text-red-600 border-red-200' :
                                   'bg-green-100 text-green-600 border-green-200'
                               }`}>
                                   {t.behavior === 'neutral' ? 'Neutro' : t.behavior === 'debit' ? 'Debita Saldo' : t.behavior === 'credit_1x' ? 'Crédito (1x)' : 'Crédito (2x)'}
                               </span>
                           </div>
                           {!['ferias', 'folga', 'trabalhado'].includes(t.id) && (
                               <button onClick={() => removeEventType(t.id)} className="text-red-500 hover:text-red-700 font-bold text-sm">Excluir</button>
                           )}
                       </div>
                   ))}
               </div>
           </div>
       )}

       {/* CONTENT - SEASONAL */}
       {activeTab === 'seasonal' && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
               <h3 className="text-lg font-bold text-gray-800 mb-4">Eventos Sazonais (Black Friday, Natal, etc.)</h3>
               
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                   <div className="md:col-span-1">
                       <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome</label>
                       <input type="text" value={newSeasonal.label} onChange={e => setNewSeasonal({...newSeasonal, label: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" placeholder="Ex: Black Friday" />
                   </div>
                   <div>
                       <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Início</label>
                       <input type="date" value={newSeasonal.startDate} onChange={e => setNewSeasonal({...newSeasonal, startDate: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" />
                   </div>
                   <div>
                       <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Fim</label>
                       <input type="date" value={newSeasonal.endDate} onChange={e => setNewSeasonal({...newSeasonal, endDate: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" />
                   </div>
                   <div className="flex items-end">
                       <input type="color" value={newSeasonal.color} onChange={e => setNewSeasonal({...newSeasonal, color: e.target.value})} className="h-9 w-12 border border-gray-300 rounded mr-2 p-1 bg-white" />
                       <button onClick={addSeasonal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 flex-1">Adicionar</button>
                   </div>
               </div>

               <div className="space-y-3">
                   {(settings.seasonalEvents || []).map(s => (
                       <div key={s.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50" style={{ borderLeftWidth: '4px', borderLeftColor: s.color }}>
                           <div>
                               <div className="font-bold text-gray-800">{s.label}</div>
                               <div className="text-xs text-gray-500">{new Date(s.startDate).toLocaleDateString()} até {new Date(s.endDate).toLocaleDateString()}</div>
                           </div>
                           <button onClick={() => removeSeasonal(s.id)} className="text-red-500 hover:text-red-700 font-bold text-sm">Excluir</button>
                       </div>
                   ))}
               </div>
           </div>
       )}

       {/* CONTENT - SYSTEM MESSAGE */}
       {activeTab === 'system' && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
               <h3 className="text-lg font-bold text-gray-800 mb-4">Comunicado Geral do Sistema</h3>
               
               <div className="space-y-4">
                   <div className="flex items-center gap-2">
                       <input type="checkbox" id="sysActive" checked={sysMsg.active} onChange={e => setSysMsg({...sysMsg, active: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded" />
                       <label htmlFor="sysActive" className="font-bold text-gray-700">Ativar Comunicado</label>
                   </div>

                   <div>
                       <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nível</label>
                       <select value={sysMsg.level} onChange={e => setSysMsg({...sysMsg, level: e.target.value as any})} className="w-full border border-gray-300 rounded-lg p-2 text-sm">
                           <option value="info">Informação (Azul)</option>
                           <option value="warning">Atenção (Laranja)</option>
                           <option value="error">Crítico (Vermelho)</option>
                       </select>
                   </div>

                   <div>
                       <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Mensagem</label>
                       <textarea 
                           rows={4}
                           value={sysMsg.message}
                           onChange={e => setSysMsg({...sysMsg, message: e.target.value})}
                           className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                           placeholder="Digite a mensagem que aparecerá no topo do dashboard..."
                       />
                   </div>

                   <button onClick={saveSysMsg} className="bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg shadow hover:bg-emerald-700">
                       Salvar e Publicar
                   </button>
               </div>
           </div>
       )}

       {/* MODAL DE PERMISSÕES */}
       <Modal 
             isOpen={!!selectedModule} 
             onClose={() => setSelectedModule(null)} 
             title={currentModuleDef ? `Permissões: ${currentModuleDef.label}` : ''}
             maxWidth="max-w-[95vw] md:max-w-[85vw] lg:max-w-7xl"
       >
              {currentModuleDef && (
                  <div className="space-y-6 h-full flex flex-col">
                      <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200 shrink-0">
                          <span className="text-3xl">{currentModuleDef.icon}</span>
                          <div>
                              <p className="text-sm text-gray-500">{currentModuleDef.description}</p>
                          </div>
                      </div>

                      <div className="overflow-auto border border-gray-200 rounded-lg flex-1 max-h-[65vh]">
                          <table className="w-full text-sm border-collapse">
                              <thead className="sticky top-0 z-20 bg-gray-100 shadow-sm">
                                  <tr>
                                      <th className="text-left p-3 font-bold text-gray-700 bg-gray-100 sticky left-0 z-30 border-b border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Função</th>
                                      {currentModuleDef.actions.map(action => (
                                          <th key={action.id} className="p-3 text-center font-bold text-gray-700 min-w-[160px] border-b border-gray-200 align-middle bg-gray-100">
                                              {action.type === 'view' ? 'Visualizar' : 
                                               action.type === 'create' ? 'Criar' : 
                                               action.type === 'update' ? 'Editar' : 
                                               action.type === 'delete' ? 'Excluir' : action.label}
                                          </th>
                                      ))}
                                  </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-100">
                                  {settings.roles.map(role => (
                                      <tr key={role.name} className="hover:bg-gray-50 transition-colors">
                                          <td className="p-3 font-medium text-gray-800 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-gray-100">
                                              {role.name}
                                          </td>
                                          {currentModuleDef.actions.map(action => {
                                              const isActive = role.permissions.includes(action.id);
                                              return (
                                                  <td key={action.id} className="p-3 text-center">
                                                      <label className="inline-flex items-center cursor-pointer justify-center w-full h-full">
                                                          <div className="relative">
                                                              <input 
                                                                type="checkbox" 
                                                                className="sr-only peer" 
                                                                checked={isActive} 
                                                                onChange={() => togglePermission(role.name, action.id)} 
                                                              />
                                                              <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${isActive ? 'peer-checked:bg-indigo-600' : ''}`}></div>
                                                          </div>
                                                      </label>
                                                  </td>
                                              );
                                          })}
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}
       </Modal>
    </div>
  );
};