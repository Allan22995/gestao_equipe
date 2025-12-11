

import React, { useState, useEffect } from 'react';
import { SystemSettings, EventTypeConfig, EventBehavior, Schedule, ScheduleTemplate, RoleConfig, SYSTEM_PERMISSIONS, AccessProfileConfig, RotationRule, PERMISSION_MODULES } from '../types';
import { generateUUID } from '../utils/helpers';
import { Modal } from './ui/Modal';

interface SettingsProps {
  settings: SystemSettings;
  setSettings: (s: SystemSettings) => Promise<void>;
  showToast: (msg: string, isError?: boolean) => void;
  hasPermission: (perm: string) => boolean;
}

const initialSchedule: Schedule = {
  segunda: { enabled: false, start: '', end: '', startsPreviousDay: false },
  terca: { enabled: false, start: '', end: '', startsPreviousDay: false },
  quarta: { enabled: false, start: '', end: '', startsPreviousDay: false },
  quinta: { enabled: false, start: '', end: '', startsPreviousDay: false },
  sexta: { enabled: false, start: '', end: '', startsPreviousDay: false },
  sabado: { enabled: false, start: '', end: '', startsPreviousDay: false },
  domingo: { enabled: false, start: '', end: '', startsPreviousDay: false },
};

const ManageList = ({ 
  title, items, onAdd, onEdit, onRemove, saving, removingId, placeholder 
}: {
  title: string; 
  items: string[]; 
  onAdd: (val: string) => void; 
  onEdit: (oldVal: string, newVal: string) => void; 
  onRemove: (val: string) => void; 
  saving: 'idle' | 'saving' | 'success'; 
  removingId: string | null; 
  placeholder: string;
}) => {
  const [newItem, setNewItem] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const filteredItems = items.filter(i => i.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleAdd = () => { if (newItem.trim()) { onAdd(newItem); setNewItem(''); } };

  const startEdit = (item: string) => {
    setEditingItem(item);
    setEditValue(item);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditValue('');
  };

  const saveEdit = () => {
    if (editingItem && editValue.trim() && editValue !== editingItem) {
      onEdit(editingItem, editValue.trim());
    }
    cancelEdit();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4">{title}</h2>
      
      <div className="flex gap-2 mb-4">
        <input type="text" className="flex-1 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder={placeholder} value={newItem} onChange={e => setNewItem(e.target.value)} disabled={saving === 'saving'} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <button onClick={handleAdd} disabled={saving === 'saving' || !newItem.trim()} className={`${saving === 'success' ? 'bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-4 py-2 rounded-lg transition-all font-semibold min-w-[80px]`}>{saving === 'saving' ? '...' : saving === 'success' ? '✓' : 'Add'}</button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button onClick={() => setIsExpanded(!isExpanded)} className="w-full bg-gray-50 p-3 text-left text-sm font-semibold text-gray-700 flex justify-between items-center hover:bg-gray-100 transition-colors"><span>Ver Itens ({items.length})</span><span className={`transition-transform transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>▼</span></button>
        
        {isExpanded && (
          <div className="bg-white p-3 border-t border-gray-200 animate-fadeIn">
            <input type="text" placeholder="🔍 Pesquisar..." className="w-full border border-gray-300 rounded-md p-2 text-sm mb-3 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {filteredItems.map(item => (
                <div key={item} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded group border-b border-gray-50 last:border-0 min-h-[40px]">
                  
                  {editingItem === item ? (
                    <div className="flex flex-1 items-center gap-2 animate-fadeIn">
                      <input 
                        type="text" 
                        autoFocus
                        className="flex-1 border border-indigo-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <button onClick={saveEdit} className="text-green-600 hover:bg-green-50 p-1 rounded" title="Salvar">✓</button>
                      <button onClick={cancelEdit} className="text-gray-400 hover:bg-gray-100 p-1 rounded" title="Cancelar">✕</button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-gray-700 truncate flex-1">{item}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => startEdit(item)} disabled={!!removingId} className="text-blue-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded transition-colors" title="Editar">
                           <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                         </button>
                         <button onClick={() => onRemove(item)} disabled={removingId === item} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition-colors" title="Excluir">
                           <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                         </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const Settings: React.FC<SettingsProps> = ({ settings, setSettings, showToast, hasPermission }) => {
  const showGeral = hasPermission('settings:manage_general');
  const showAcesso = hasPermission('settings:manage_access');
  const showSistema = hasPermission('settings:view'); 

  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'acesso' | 'sistema'>(() => {
    if (showGeral) return 'geral';
    if (showAcesso) return 'acesso';
    return 'sistema';
  });

  const [spreadsheetUrl, setSpreadsheetUrl] = useState(settings.spreadsheetUrl || '');

  // Filiais e Setores (Master-Detail)
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [newSectorName, setNewSectorName] = useState('');

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventBehavior, setNewEventBehavior] = useState<EventBehavior>('neutral');
  
  const [newProfileName, setNewProfileName] = useState('');

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateSchedule, setTemplateSchedule] = useState<Schedule>(JSON.parse(JSON.stringify(initialSchedule)));
  
  const [newRoleName, setNewRoleName] = useState('');
  const [editingRoleName, setEditingRoleName] = useState<string | null>(null);
  const [editRoleNameInput, setEditRoleNameInput] = useState('');
  
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  const [sysMsgActive, setSysMsgActive] = useState(settings.systemMessage?.active || false);
  const [sysMsgLevel, setSysMsgLevel] = useState<'info' | 'warning' | 'error'>(settings.systemMessage?.level || 'info');
  const [sysMsgContent, setSysMsgContent] = useState(settings.systemMessage?.message || '');

  const [newRotationId, setNewRotationId] = useState('');

  const [savingState, setSavingState] = useState<Record<string, 'idle' | 'saving' | 'success'>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Inicializar seleção de filial
  useEffect(() => {
     if (settings.branches.length > 0 && !selectedBranch) {
        setSelectedBranch(settings.branches[0]);
     }
  }, [settings.branches]);

  useEffect(() => { if (settings.spreadsheetUrl) setSpreadsheetUrl(settings.spreadsheetUrl); }, [settings.spreadsheetUrl]);
  
  useEffect(() => {
    if (settings.systemMessage) {
      setSysMsgActive(settings.systemMessage.active);
      setSysMsgLevel(settings.systemMessage.level);
      setSysMsgContent(settings.systemMessage.message);
    }
  }, [settings.systemMessage]);


  const setSaving = (key: string, state: 'idle' | 'saving' | 'success') => {
    setSavingState(prev => ({ ...prev, [key]: state }));
    if (state === 'success') setTimeout(() => setSavingState(prev => ({ ...prev, [key]: 'idle' })), 2000);
  };

  const saveSettings = async (newSettings: SystemSettings, key: string, callback?: () => void) => {
    setSaving(key, 'saving');
    try { await setSettings(newSettings); setSaving(key, 'success'); if (callback) callback(); } catch (e) { console.error(e); setSaving(key, 'idle'); }
  };

  // --- BRANCH & SECTOR LOGIC ---
  const addBranch = () => {
     if (!newBranchName.trim()) return;
     if (settings.branches.includes(newBranchName)) {
        showToast('Filial já existe.', true);
        return;
     }
     const updatedBranches = [...settings.branches, newBranchName];
     // Initialize sectors for new branch
     const updatedBranchSectors = { ...(settings.branchSectors || {}), [newBranchName]: [] };
     
     saveSettings({ ...settings, branches: updatedBranches, branchSectors: updatedBranchSectors }, 'branch', () => {
         setNewBranchName('');
         setSelectedBranch(newBranchName);
     });
  };

  const removeBranch = (branch: string) => {
     if (window.confirm(`Tem certeza que deseja excluir a filial "${branch}" e todos seus setores?`)) {
        const updatedBranches = settings.branches.filter(b => b !== branch);
        const updatedBranchSectors = { ...(settings.branchSectors || {}) };
        delete updatedBranchSectors[branch];
        
        saveSettings({ ...settings, branches: updatedBranches, branchSectors: updatedBranchSectors }, 'branch', () => {
            if (selectedBranch === branch) setSelectedBranch(updatedBranches[0] || null);
        });
     }
  };

  const addSectorToBranch = () => {
      if (!selectedBranch || !newSectorName.trim()) return;
      
      const currentSectors = settings.branchSectors?.[selectedBranch] || [];
      if (currentSectors.includes(newSectorName)) {
          showToast('Setor já existe nesta filial.', true);
          return;
      }
      
      const updatedSectors = [...currentSectors, newSectorName];
      const updatedBranchSectors = { ...(settings.branchSectors || {}), [selectedBranch]: updatedSectors };
      
      // Also update flat list for compatibility if needed, or ignore it
      const allSectors = new Set([...(settings.sectors || []), newSectorName]);

      saveSettings({ ...settings, branchSectors: updatedBranchSectors, sectors: Array.from(allSectors) }, 'sector', () => {
          setNewSectorName('');
      });
  };

  const removeSectorFromBranch = (sector: string) => {
      if (!selectedBranch) return;
      if (window.confirm(`Excluir setor "${sector}" da filial "${selectedBranch}"?`)) {
          const currentSectors = settings.branchSectors?.[selectedBranch] || [];
          const updatedSectors = currentSectors.filter(s => s !== sector);
          const updatedBranchSectors = { ...(settings.branchSectors || {}), [selectedBranch]: updatedSectors };
          
          saveSettings({ ...settings, branchSectors: updatedBranchSectors }, 'sector');
      }
  };

  const addRotation = () => {
    if (!newRotationId.trim()) { showToast('Defina um nome para a escala (ex: A, B).', true); return; }
    if (settings.shiftRotations.some(r => r.id.toLowerCase() === newRotationId.trim().toLowerCase())) { showToast('Já existe uma escala com este ID.', true); return; }
    const newRule: RotationRule = { id: newRotationId.trim().toUpperCase(), label: `Escala ${newRotationId.trim().toUpperCase()}` };
    saveSettings({ ...settings, shiftRotations: [...settings.shiftRotations, newRule] }, 'rotation', () => { setNewRotationId(''); });
  };

  const removeRotation = (id: string) => {
      if (window.confirm(`Excluir Escala ${id}?`)) saveSettings({ ...settings, shiftRotations: settings.shiftRotations.filter(r => r.id !== id) }, 'rotation');
  };

  const addProfile = () => { 
      const name = newProfileName.trim().toLowerCase();
      if (!name) return;
      if (settings.accessProfiles?.some(p => p.name.toLowerCase() === name)) { showToast('Perfil já existe.', true); return; }
      const newProfile: AccessProfileConfig = { id: name, name: name, active: true };
      saveSettings({ ...settings, accessProfiles: [...(settings.accessProfiles || []), newProfile] }, 'profile', () => setNewProfileName('')); 
  };
  
  const toggleProfileActive = (id: string) => {
      const updatedProfiles = (settings.accessProfiles || []).map(p => p.id === id ? { ...p, active: !p.active } : p);
      saveSettings({ ...settings, accessProfiles: updatedProfiles }, 'profile');
  };

  const removeProfile = (id: string) => { 
      if (['admin', 'colaborador', 'noc'].includes(id)) { showToast('Perfis padrão do sistema não podem ser excluídos.', true); return; }
      if (window.confirm(`Excluir perfil?`)) saveSettings({ ...settings, accessProfiles: (settings.accessProfiles || []).filter(p => p.id !== id) }, 'profile'); 
  };

  const addRole = () => {
    if (!newRoleName.trim()) return;
    if (settings.roles.some(r => r.name.toLowerCase() === newRoleName.toLowerCase())) { showToast('Função já existe', true); return; }
    const newRole: RoleConfig = { name: newRoleName.trim(), canViewAllSectors: true, permissions: ['dashboard:view', 'calendar:view'] };
    saveSettings({ ...settings, roles: [...settings.roles, newRole] }, 'role', () => setNewRoleName(''));
  };

  const startEditRole = (roleName: string) => { setEditingRoleName(roleName); setEditRoleNameInput(roleName); };

  const saveEditRole = () => {
     if (!editingRoleName || !editRoleNameInput.trim()) return;
     if (editRoleNameInput !== editingRoleName && settings.roles.some(r => r.name.toLowerCase() === editRoleNameInput.toLowerCase())) { showToast('Já existe uma função com este nome.', true); return; }
     const updatedRoles = settings.roles.map(r => r.name === editingRoleName ? { ...r, name: editRoleNameInput.trim() } : r);
     saveSettings({ ...settings, roles: updatedRoles }, 'role', () => { setEditingRoleName(null); setEditRoleNameInput(''); });
  };

  const removeRole = (name: string) => {
    if (window.confirm(`Excluir função ${name}?`)) saveSettings({ ...settings, roles: settings.roles.filter(r => r.name !== name) }, 'role');
  };

  const togglePermission = (roleName: string, permId: string) => {
     const role = settings.roles.find(r => r.name === roleName);
     if (!role) return;

     let newPerms = role.permissions || [];
     if (newPerms.includes(permId)) {
       newPerms = newPerms.filter(p => p !== permId);
     } else {
       newPerms = [...newPerms, permId];
     }
     
     const updatedRoles = settings.roles.map(r => r.name === roleName ? { ...r, permissions: newPerms } : r);
     saveSettings({ ...settings, roles: updatedRoles }, 'acl_update');
  };

  const saveEvent = () => {
    if (!newEventLabel.trim()) return;
    if (editingEventId) {
       const updatedEvents = settings.eventTypes.map(e => e.id === editingEventId ? { ...e, label: newEventLabel.trim(), behavior: newEventBehavior } : e);
       saveSettings({ ...settings, eventTypes: updatedEvents }, 'event', () => { setNewEventLabel(''); setNewEventBehavior('neutral'); setEditingEventId(null); });
    } else {
       const newType: EventTypeConfig = { id: generateUUID(), label: newEventLabel.trim(), behavior: newEventBehavior };
       saveSettings({ ...settings, eventTypes: [...settings.eventTypes, newType] }, 'event', () => setNewEventLabel(''));
    }
  };

  const handleEditEvent = (e: EventTypeConfig) => { setEditingEventId(e.id); setNewEventLabel(e.label); setNewEventBehavior(e.behavior); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const cancelEditEvent = () => { setEditingEventId(null); setNewEventLabel(''); setNewEventBehavior('neutral'); };
  const removeEvent = (id: string) => { if (window.confirm('Excluir?')) saveSettings({ ...settings, eventTypes: settings.eventTypes.filter(e => e.id !== id) }, 'event'); };

  const saveTemplate = () => {
    if (!templateName.trim()) { showToast('Nome obrigatório', true); return; }
    if (editingTemplateId) {
        const updatedTemplates = (settings.scheduleTemplates || []).map(t => t.id === editingTemplateId ? { ...t, name: templateName.trim(), schedule: templateSchedule } : t);
        saveSettings({ ...settings, scheduleTemplates: updatedTemplates }, 'template', () => { setTemplateName(''); setTemplateSchedule(JSON.parse(JSON.stringify(initialSchedule))); setEditingTemplateId(null); });
    } else {
        const newT: ScheduleTemplate = { id: generateUUID(), name: templateName.trim(), schedule: templateSchedule };
        saveSettings({ ...settings, scheduleTemplates: [...(settings.scheduleTemplates || []), newT] }, 'template', () => { setTemplateName(''); setTemplateSchedule(JSON.parse(JSON.stringify(initialSchedule))); });
    }
  };

  const loadTemplateForEdit = (t: ScheduleTemplate) => { setEditingTemplateId(t.id); setTemplateName(t.name); setTemplateSchedule(JSON.parse(JSON.stringify(t.schedule))); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const cancelEditTemplate = () => { setEditingTemplateId(null); setTemplateName(''); setTemplateSchedule(JSON.parse(JSON.stringify(initialSchedule))); };
  const removeTemplate = (id: string) => { if (window.confirm('Excluir modelo?')) saveSettings({ ...settings, scheduleTemplates: (settings.scheduleTemplates || []).filter(t => t.id !== id) }, 'template'); };

  const saveSystemMessage = () => { saveSettings({ ...settings, systemMessage: { active: sysMsgActive, level: sysMsgLevel, message: sysMsgContent } }, 'system_msg'); };

  const daysOrder: (keyof Schedule)[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

  const currentModuleDef = PERMISSION_MODULES.find(m => m.id === selectedModule);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Configurações do Sistema</h1>
      
      <div className="flex border-b border-gray-200 gap-1 overflow-x-auto">
        {showGeral && (
          <button onClick={() => setActiveSubTab('geral')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeSubTab === 'geral' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Geral & Cadastros
          </button>
        )}
        {showAcesso && (
          <button onClick={() => setActiveSubTab('acesso')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeSubTab === 'acesso' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Controle de Acesso
          </button>
        )}
        {showSistema && (
          <button onClick={() => setActiveSubTab('sistema')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeSubTab === 'sistema' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Avisos do Sistema
          </button>
        )}
      </div>

      {activeSubTab === 'geral' && showGeral && (
        <div className="animate-fadeIn space-y-8">
           
           <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
             <h2 className="text-lg font-bold text-gray-800 mb-4">Integrações (Links Externos)</h2>
             <div className="flex flex-col gap-2">
               <label className="text-xs font-bold text-gray-500 uppercase">Link Planilha de Plantões</label>
               <div className="flex gap-2">
                 <input type="text" className="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none" value={spreadsheetUrl} onChange={e => setSpreadsheetUrl(e.target.value)} />
                 <button onClick={() => saveSettings({ ...settings, spreadsheetUrl }, 'integration')} disabled={savingState['integration'] === 'saving'} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">Salvar</button>
               </div>
             </div>
           </div>

           {/* --- NOVO LAYOUT DE FILIAIS E SETORES (Mestre-Detalhe) --- */}
           <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-lg font-bold text-gray-800">Gerenciar Filiais e Setores</h2>
                  <p className="text-xs text-gray-500">Selecione uma filial à esquerda para gerenciar seus setores à direita.</p>
               </div>
               
               <div className="flex flex-col md:flex-row h-[500px]">
                  {/* COLUNA ESQUERDA: FILIAIS */}
                  <div className="w-full md:w-1/3 border-r border-gray-200 flex flex-col bg-gray-50/30">
                     <div className="p-4 border-b border-gray-200">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Filiais</label>
                        <div className="flex gap-2">
                           <input 
                              type="text" 
                              className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none bg-white" 
                              placeholder="Nome da Filial..." 
                              value={newBranchName}
                              onChange={e => setNewBranchName(e.target.value)}
                           />
                           <button 
                              onClick={addBranch}
                              disabled={!newBranchName.trim()}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 font-bold text-lg leading-none disabled:opacity-50"
                           >
                              +
                           </button>
                        </div>
                     </div>
                     <div className="overflow-y-auto flex-1 p-2 space-y-1">
                        {settings.branches.map(branch => (
                           <div 
                              key={branch}
                              onClick={() => setSelectedBranch(branch)}
                              className={`group flex justify-between items-center p-3 rounded-lg cursor-pointer transition-all border ${selectedBranch === branch ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-gray-200 hover:border-indigo-300'}`}
                           >
                              <div>
                                 <span className={`font-bold block ${selectedBranch === branch ? 'text-indigo-800' : 'text-gray-700'}`}>{branch}</span>
                                 <span className="text-xs text-gray-400">{(settings.branchSectors?.[branch] || []).length} setores</span>
                              </div>
                              <button 
                                 onClick={(e) => { e.stopPropagation(); removeBranch(branch); }}
                                 className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition-all"
                              >
                                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* COLUNA DIREITA: SETORES DA FILIAL SELECIONADA */}
                  <div className="w-full md:w-2/3 flex flex-col bg-white">
                     {selectedBranch ? (
                        <>
                           <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0">
                              <div>
                                 <h3 className="font-bold text-gray-800 text-lg">Setores: <span className="text-indigo-600 bg-indigo-50 px-2 rounded">{selectedBranch}</span></h3>
                              </div>
                              <div className="flex gap-2 w-1/2">
                                 <input 
                                    type="text" 
                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none" 
                                    placeholder={`Novo Setor em ${selectedBranch}...`} 
                                    value={newSectorName}
                                    onChange={e => setNewSectorName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addSectorToBranch()}
                                 />
                                 <button 
                                    onClick={addSectorToBranch}
                                    disabled={!newSectorName.trim()}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-4 py-2 font-bold text-sm whitespace-nowrap disabled:opacity-50"
                                 >
                                    Adicionar Setor
                                 </button>
                              </div>
                           </div>
                           
                           <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                 {(settings.branchSectors?.[selectedBranch] || []).length === 0 && (
                                    <p className="col-span-full text-center text-gray-400 italic py-10">Nenhum setor cadastrado nesta filial.</p>
                                 )}
                                 {(settings.branchSectors?.[selectedBranch] || []).map(sector => (
                                    <div key={sector} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow group">
                                       <span className="font-medium text-gray-700">{sector}</span>
                                       <button 
                                          onClick={() => removeSectorFromBranch(sector)}
                                          className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                       >
                                          Excluir
                                       </button>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </>
                     ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-10">
                           <svg className="w-16 h-16 mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                           <p className="font-medium">Selecione uma filial para gerenciar seus setores.</p>
                        </div>
                     )}
                  </div>
               </div>
           </div>


           <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
             <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-bold text-gray-800">Tipos de Evento</h2>
                 {editingEventId && <button onClick={cancelEditEvent} className="text-sm text-gray-500 underline">Cancelar Edição</button>}
             </div>
             
             <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 rounded-lg transition-colors ${editingEventId ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50 border border-transparent'}`}>
                <input type="text" placeholder="Nome do Evento" className="border border-gray-300 rounded-lg p-2 text-sm outline-none bg-white" value={newEventLabel} onChange={e => setNewEventLabel(e.target.value)} />
                <select className="border border-gray-300 rounded-lg p-2 text-sm outline-none bg-white" value={newEventBehavior} onChange={e => setNewEventBehavior(e.target.value as EventBehavior)}>
                   <option value="neutral">Neutro</option>
                   <option value="debit">Debita (Folga)</option>
                   <option value="credit_1x">Credita (1x)</option>
                   <option value="credit_2x">Credita (2x)</option>
                </select>
                <button onClick={saveEvent} disabled={!newEventLabel.trim() || savingState['event'] === 'saving'} className={`${editingEventId ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold rounded-lg transition-colors`}>
                    {editingEventId ? 'Atualizar' : 'Adicionar'}
                </button>
             </div>
             <div className="space-y-2">
                {settings.eventTypes.map(e => (
                   <div key={e.id} className={`flex justify-between items-center p-2 border-b last:border-0 transition-colors ${editingEventId === e.id ? 'bg-indigo-50 border-indigo-200' : 'border-gray-100'}`}>
                      <div><span className="font-bold">{e.label}</span> <span className="text-xs text-gray-500 ml-2">({e.behavior})</span></div>
                      <div className="flex gap-2">
                         <button onClick={() => handleEditEvent(e)} className="text-blue-500 text-xs font-bold bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">Editar</button>
                         <button onClick={() => removeEvent(e.id)} className="text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded hover:bg-red-100">Excluir</button>
                      </div>
                   </div>
                ))}
             </div>
           </div>

            <>
              <div className="border-t border-gray-200 my-8"></div>
              <h2 className="text-xl font-bold text-gray-800 mb-6">Modelos de Jornada & Escalas</h2>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800">{editingTemplateId ? 'Editar Modelo de Jornada' : 'Criar Modelo de Jornada'}</h2>
                    {editingTemplateId && <button onClick={cancelEditTemplate} className="text-sm text-gray-500 underline">Cancelar Edição</button>}
                 </div>

                 <div className={`mb-4 flex gap-2 p-3 rounded-lg ${editingTemplateId ? 'bg-blue-50 border border-blue-100' : ''}`}>
                    <input type="text" className="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none bg-white" placeholder="Nome (Ex: Escala 12x36)..." value={templateName} onChange={e => setTemplateName(e.target.value)} />
                    <button onClick={saveTemplate} className={`${editingTemplateId ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-4 py-2 rounded-lg font-bold transition-colors`}>
                       {editingTemplateId ? 'Atualizar Modelo' : 'Salvar Modelo'}
                    </button>
                 </div>
                 
                 <div className="space-y-2 max-w-2xl">
                    {daysOrder.map(day => (
                       <div key={day} className="flex items-center gap-4 bg-gray-50 p-2 rounded border border-gray-100">
                          <label className="w-24 flex items-center gap-2 cursor-pointer">
                             <input type="checkbox" checked={templateSchedule[day].enabled} onChange={e => setTemplateSchedule(prev => ({...prev, [day]: {...prev[day], enabled: e.target.checked}}))} className="rounded text-indigo-600" />
                             <span className="capitalize text-sm font-medium">{day}</span>
                          </label>
                          <input type="time" disabled={!templateSchedule[day].enabled} value={templateSchedule[day].start} onChange={e => setTemplateSchedule(prev => ({...prev, [day]: {...prev[day], start: e.target.value}}))} className="border rounded p-1 text-sm bg-white" />
                          <span className="text-gray-400">-</span>
                          <input type="time" disabled={!templateSchedule[day].enabled} value={templateSchedule[day].end} onChange={e => setTemplateSchedule(prev => ({...prev, [day]: {...prev[day], end: e.target.value}}))} className="border rounded p-1 text-sm bg-white" />
                          <label className="flex items-center gap-1 cursor-pointer ml-auto">
                             <input type="checkbox" disabled={!templateSchedule[day].enabled} checked={templateSchedule[day].startsPreviousDay} onChange={e => setTemplateSchedule(prev => ({...prev, [day]: {...prev[day], startsPreviousDay: e.target.checked}}))} />
                             <span className="text-[10px] text-gray-500">Inicia -1d</span>
                          </label>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-bold text-gray-800 mb-4">Modelos de Jornada Salvos</h2>
                  <div className="flex flex-col gap-2">
                      {(settings.scheduleTemplates || []).map(t => (
                        <div key={t.id} className={`flex justify-between items-center p-3 border border-gray-200 rounded-lg transition-colors ${editingTemplateId === t.id ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' : 'bg-gray-50'}`}>
                            <span className="font-bold text-gray-700 truncate mr-2">{t.name}</span>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => loadTemplateForEdit(t)} className="text-blue-500 bg-blue-50 px-3 py-1 rounded text-xs font-bold hover:bg-blue-100 border border-blue-100">Editar</button>
                              <button onClick={() => removeTemplate(t.id)} className="text-red-500 bg-red-50 px-3 py-1 rounded text-xs font-bold hover:bg-red-100 border border-red-100">Excluir</button>
                            </div>
                        </div>
                      ))}
                      {(settings.scheduleTemplates || []).length === 0 && <p className="text-gray-400 text-sm">Nenhum modelo cadastrado.</p>}
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-bold text-gray-800 mb-2">Escalas de Revezamento</h2>
                  <p className="text-sm text-gray-500 mb-4">Cadastre os nomes das escalas disponíveis para seleção (Ex: Escala A, Azul, Impar).</p>
                  
                  <div className="bg-indigo-50 p-4 rounded-lg mb-4 border border-indigo-100">
                      <div className="flex gap-2">
                         <input 
                           type="text" 
                           className="flex-1 border border-indigo-200 rounded-lg p-2 text-sm outline-none" 
                           placeholder="Nova Escala (ex: A, B)..." 
                           value={newRotationId} 
                           onChange={e => setNewRotationId(e.target.value)} 
                         />
                         <button onClick={addRotation} disabled={savingState['rotation'] === 'saving'} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">Adicionar</button>
                      </div>
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {(settings.shiftRotations || []).map(r => (
                        <div key={r.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50 flex justify-between items-center">
                            <div>
                               <div className="font-bold text-gray-800">{r.label || `Escala ${r.id}`}</div>
                               <div className="text-xs text-gray-500 mt-0.5">ID: {r.id}</div>
                            </div>
                            <button onClick={() => removeRotation(r.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </>
        </div>
      )}

      {activeSubTab === 'acesso' && showAcesso && (
        <div className="animate-fadeIn space-y-8">
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-2">Funções (Roles)</h2>
                    <p className="text-sm text-gray-500 mb-4">Crie grupos para definir permissões.</p>
                    
                    <div className="flex gap-2 mb-4">
                        <input type="text" className="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none" placeholder="Nova Função (Ex: Coordenador)..." value={newRoleName} onChange={e => setNewRoleName(e.target.value)} />
                        <button onClick={addRole} disabled={!newRoleName.trim() || savingState['role'] === 'saving'} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">Add</button>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {[...settings.roles].sort((a, b) => a.name.localeCompare(b.name)).map(r => (
                            <div key={r.name} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group">
                                {editingRoleName === r.name ? (
                                    <div className="flex items-center gap-2 w-full">
                                        <input autoFocus className="flex-1 text-sm border border-indigo-300 rounded px-1 py-0.5 outline-none" value={editRoleNameInput} onChange={e => setEditRoleNameInput(e.target.value)} />
                                        <button onClick={saveEditRole} className="text-green-600 font-bold px-1">✓</button>
                                        <button onClick={() => setEditingRoleName(null)} className="text-gray-400 font-bold px-1">✕</button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="font-bold text-gray-700">{r.name}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEditRole(r.name)} className="text-blue-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded">✎</button>
                                            <button onClick={() => removeRole(r.name)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded">🗑️</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-2">Perfis de Sistema</h2>
                    <p className="text-sm text-gray-500 mb-4">Níveis de acesso técnico.</p>
                    
                    <div className="flex gap-2 mb-4">
                        <input type="text" className="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none" placeholder="Novo Perfil (ex: auditor)..." value={newProfileName} onChange={e => setNewProfileName(e.target.value)} />
                        <button onClick={addProfile} disabled={!newProfileName.trim() || savingState['profile'] === 'saving'} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold min-w-[80px]">Add</button>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {(settings.accessProfiles || []).map(profile => (
                            <div key={profile.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-2">
                                    <span className={`font-medium ${!profile.active ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{profile.name}</span>
                                    {!profile.active && <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded">Oculto</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center cursor-pointer">
                                        <div className="relative">
                                            <input type="checkbox" className="sr-only" checked={profile.active} onChange={() => toggleProfileActive(profile.id)} />
                                            <div className={`block w-8 h-5 rounded-full transition-colors ${profile.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                            <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition transform ${profile.active ? 'translate-x-3' : 'translate-x-0'}`}></div>
                                        </div>
                                    </label>
                                    <button onClick={() => removeProfile(profile.id)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
           </div>

           <div className="mt-8">
               <h2 className="text-xl font-bold text-gray-800 mb-4">Gerenciar Permissões por Tela</h2>
               <p className="text-gray-600 mb-6">Selecione um módulo para configurar quem pode ver, criar, editar ou excluir.</p>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                   {PERMISSION_MODULES.map(module => (
                       <div 
                         key={module.id} 
                         onClick={() => setSelectedModule(module.id)}
                         className="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer hover:shadow-lg hover:border-indigo-300 transition-all group relative overflow-hidden"
                       >
                           <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">{module.icon}</div>
                           <h3 className="text-lg font-bold text-gray-800 mb-1 group-hover:text-indigo-600 transition-colors">{module.label}</h3>
                           <p className="text-xs text-gray-500">{module.description}</p>
                           <div className="absolute top-4 right-4 text-gray-300 group-hover:text-indigo-400">
                               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                           </div>
                       </div>
                   ))}
               </div>
           </div>

           <Modal 
             isOpen={!!selectedModule} 
             onClose={() => setSelectedModule(null)} 
             title={currentModuleDef ? `Permissões: ${currentModuleDef.label}` : ''}
           >
              {currentModuleDef && (
                  <div className="space-y-6">
                      <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <span className="text-3xl">{currentModuleDef.icon}</span>
                          <div>
                              <p className="text-sm text-gray-500">{currentModuleDef.description}</p>
                          </div>
                      </div>

                      <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                              <thead>
                                  <tr className="bg-gray-50 border-b border-gray-200">
                                      <th className="text-left p-3 font-bold text-gray-600">Função</th>
                                      {currentModuleDef.actions.map(action => (
                                          <th key={action.id} className="p-3 text-center font-bold text-gray-600 min-w-[80px]">
                                              {action.type === 'view' ? 'Visualizar' : 
                                               action.type === 'create' ? 'Criar' : 
                                               action.type === 'update' ? 'Editar' : 
                                               action.type === 'delete' ? 'Excluir' : action.label}
                                          </th>
                                      ))}
                                  </tr>
                              </thead>
                              <tbody>
                                  {settings.roles.map(role => (
                                      <tr key={role.name} className="border-b border-gray-100 hover:bg-gray-50">
                                          <td className="p-3 font-medium text-gray-800">{role.name}</td>
                                          {currentModuleDef.actions.map(action => {
                                              const isActive = role.permissions.includes(action.id);
                                              return (
                                                  <td key={action.id} className="p-3 text-center">
                                                      <label className="inline-flex items-center cursor-pointer">
                                                          <div className="relative">
                                                              <input 
                                                                type="checkbox" 
                                                                className="sr-only peer" 
                                                                checked={isActive} 
                                                                onChange={() => togglePermission(role.name, action.id)} 
                                                              />
                                                              <div className={`w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${isActive ? 'peer-checked:bg-indigo-600' : ''}`}></div>
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
      )}
      
      {activeSubTab === 'sistema' && showSistema && (
        <div className="animate-fadeIn">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                 <div>
                    <h2 className="text-lg font-bold text-gray-800">Comunicado em Tempo Real (Banner)</h2>
                    <p className="text-sm text-gray-500">Exiba uma mensagem no topo da tela para todos os usuários logados. Ideal para avisos de manutenção ou deploy.</p>
                 </div>
                 <div className={`px-3 py-1 rounded text-xs font-bold uppercase ${sysMsgActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {sysMsgActive ? 'Ativo' : 'Inativo'}
                 </div>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-6">
                
                <div className="flex items-center gap-4">
                   <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={sysMsgActive} onChange={e => setSysMsgActive(e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-3 text-sm font-medium text-gray-900">Exibir Banner para Usuários</span>
                   </label>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Nível de Urgência</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors flex-1">
                      <input type="radio" name="level" value="info" checked={sysMsgLevel === 'info'} onChange={() => setSysMsgLevel('info')} className="text-blue-600" />
                      <span className="text-blue-600 font-bold">Informação (Azul)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors flex-1">
                      <input type="radio" name="level" value="warning" checked={sysMsgLevel === 'warning'} onChange={() => setSysMsgLevel('warning')} className="text-amber-600" />
                      <span className="text-amber-600 font-bold">Atenção (Amarelo)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors flex-1">
                      <input type="radio" name="level" value="error" checked={sysMsgLevel === 'error'} onChange={() => setSysMsgLevel('error')} className="text-red-600" />
                      <span className="text-red-600 font-bold">Manutenção (Vermelho)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Mensagem</label>
                  <textarea 
                    rows={3} 
                    className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500" 
                    placeholder="Ex: O sistema passará por manutenção às 18:00. Salvem seus dados."
                    value={sysMsgContent}
                    onChange={e => setSysMsgContent(e.target.value)}
                  />
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={saveSystemMessage} 
                    disabled={savingState['system_msg'] === 'saving'}
                    className={`px-6 py-2 rounded-lg font-bold text-white transition-all ${savingState['system_msg'] === 'success' ? 'bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                  >
                    {savingState['system_msg'] === 'saving' ? 'Salvando...' : savingState['system_msg'] === 'success' ? 'Atualizado!' : 'Salvar Aviso'}
                  </button>
                </div>

              </div>
            </div>
        </div>
      )}
    </div>
  );
};
