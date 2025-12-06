
import React, { useState, useEffect } from 'react';
import { SystemSettings, EventTypeConfig, EventBehavior, Schedule, DaySchedule, ScheduleTemplate, RoleConfig, SYSTEM_PERMISSIONS } from '../types';
import { generateUUID } from '../utils/helpers';

interface SettingsProps {
  settings: SystemSettings;
  setSettings: (s: SystemSettings) => Promise<void>;
  showToast: (msg: string, isError?: boolean) => void;
  hasPermission: (perm: string) => boolean;
}

// Initial state for schedule logic
const initialSchedule: Schedule = {
  segunda: { enabled: false, start: '', end: '', startsPreviousDay: false },
  terca: { enabled: false, start: '', end: '', startsPreviousDay: false },
  quarta: { enabled: false, start: '', end: '', startsPreviousDay: false },
  quinta: { enabled: false, start: '', end: '', startsPreviousDay: false },
  sexta: { enabled: false, start: '', end: '', startsPreviousDay: false },
  sabado: { enabled: false, start: '', end: '', startsPreviousDay: false },
  domingo: { enabled: false, start: '', end: '', startsPreviousDay: false },
};

// --- COMPONENTE INTERNO: LISTAS SIMPLES COM EDIÇÃO ---
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
  
  // Edit State
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
      
      {/* Input de Adição */}
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
  // Determine tab visibility based on permissions
  const showGeral = hasPermission('settings:integration') || hasPermission('settings:lists') || hasPermission('settings:profiles') || hasPermission('settings:event_types');
  const showAcesso = hasPermission('settings:access_control');
  const showJornada = hasPermission('settings:schedule_templates');
  const showSistema = hasPermission('settings:system_msg');

  // Tabs Internas (Initialize based on permissions)
  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'acesso' | 'jornada' | 'sistema'>(() => {
    if (hasPermission('settings:integration') || hasPermission('settings:lists') || hasPermission('settings:profiles') || hasPermission('settings:event_types')) return 'geral';
    if (hasPermission('settings:access_control')) return 'acesso';
    if (hasPermission('settings:schedule_templates')) return 'jornada';
    if (hasPermission('settings:system_msg')) return 'sistema';
    return 'geral';
  });

  // Ensure active tab is valid (Redirect if permissions change or URL state is invalid)
  useEffect(() => {
    if (activeSubTab === 'geral' && !showGeral) {
        if (showAcesso) setActiveSubTab('acesso');
        else if (showJornada) setActiveSubTab('jornada');
        else if (showSistema) setActiveSubTab('sistema');
    } else if (activeSubTab === 'acesso' && !showAcesso) {
        if (showGeral) setActiveSubTab('geral');
        else if (showJornada) setActiveSubTab('jornada');
        else if (showSistema) setActiveSubTab('sistema');
    } else if (activeSubTab === 'jornada' && !showJornada) {
         if (showGeral) setActiveSubTab('geral');
         else if (showAcesso) setActiveSubTab('acesso');
         else if (showSistema) setActiveSubTab('sistema');
    } else if (activeSubTab === 'sistema' && !showSistema) {
         if (showGeral) setActiveSubTab('geral');
         else if (showAcesso) setActiveSubTab('acesso');
         else if (showJornada) setActiveSubTab('jornada');
    }
  }, [activeSubTab, showGeral, showAcesso, showJornada, showSistema]);

  // States Geral
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(settings.spreadsheetUrl || '');

  // States Eventos
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventBehavior, setNewEventBehavior] = useState<EventBehavior>('neutral');

  // States Jornada
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateSchedule, setTemplateSchedule] = useState<Schedule>(JSON.parse(JSON.stringify(initialSchedule)));
  
  // States Roles
  const [newRoleName, setNewRoleName] = useState('');
  const [editingRoleName, setEditingRoleName] = useState<string | null>(null); // Nome original da role sendo editada
  const [editRoleNameInput, setEditRoleNameInput] = useState(''); // Input de edição
  const [selectedRoleForACL, setSelectedRoleForACL] = useState<string>('');
  
  // System Message State
  const [sysMsgActive, setSysMsgActive] = useState(settings.systemMessage?.active || false);
  const [sysMsgLevel, setSysMsgLevel] = useState<'info' | 'warning' | 'error'>(settings.systemMessage?.level || 'info');
  const [sysMsgContent, setSysMsgContent] = useState(settings.systemMessage?.message || '');

  // Loading States
  const [savingState, setSavingState] = useState<Record<string, 'idle' | 'saving' | 'success'>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => { if (settings.spreadsheetUrl) setSpreadsheetUrl(settings.spreadsheetUrl); }, [settings.spreadsheetUrl]);
  
  // Sync System Message state when settings change remotely
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

  // --- LOGIC: BRANCHES, SECTORS, PROFILES ---
  const updateList = (listKey: keyof SystemSettings, oldVal: string, newVal: string, saveKey: string) => {
      const currentList = settings[listKey] as string[];
      if (currentList.includes(newVal)) {
          showToast('Este valor já existe na lista.', true);
          return;
      }
      const newList = currentList.map(item => item === oldVal ? newVal : item);
      saveSettings({ ...settings, [listKey]: newList }, saveKey);
  };

  const addBranch = (v: string) => { if (settings.branches.includes(v)) return; saveSettings({ ...settings, branches: [...settings.branches, v] }, 'branch'); };
  const editBranch = (oldVal: string, newVal: string) => updateList('branches', oldVal, newVal, 'branch');
  const removeBranch = (v: string) => { if (window.confirm(`Excluir ${v}?`)) saveSettings({ ...settings, branches: settings.branches.filter(b => b !== v) }, 'branch'); };
  
  const addSector = (v: string) => { if (settings.sectors?.includes(v)) return; saveSettings({ ...settings, sectors: [...(settings.sectors || []), v] }, 'sector'); };
  const editSector = (oldVal: string, newVal: string) => updateList('sectors', oldVal, newVal, 'sector');
  const removeSector = (v: string) => { if (window.confirm(`Excluir ${v}?`)) saveSettings({ ...settings, sectors: (settings.sectors || []).filter(s => s !== v) }, 'sector'); };
  
  const addProfile = (v: string) => { const p = v.toLowerCase(); if (settings.accessProfiles?.includes(p)) return; saveSettings({ ...settings, accessProfiles: [...(settings.accessProfiles || []), p] }, 'profile'); };
  const editProfile = (oldVal: string, newVal: string) => updateList('accessProfiles', oldVal, newVal.toLowerCase(), 'profile');
  const removeProfile = (v: string) => { if (['admin', 'colaborador', 'noc'].includes(v)) return; if (window.confirm(`Excluir ${v}?`)) saveSettings({ ...settings, accessProfiles: (settings.accessProfiles || []).filter(p => p !== v) }, 'profile'); };

  // --- LOGIC: ROLES & ACL ---
  const addRole = () => {
    if (!newRoleName.trim()) return;
    if (settings.roles.some(r => r.name.toLowerCase() === newRoleName.toLowerCase())) { showToast('Função já existe', true); return; }
    const newRole: RoleConfig = { name: newRoleName.trim(), canViewAllSectors: true, permissions: ['tab:calendario', 'tab:dashboard'] };
    saveSettings({ ...settings, roles: [...settings.roles, newRole] }, 'role', () => setNewRoleName(''));
  };

  const startEditRole = (roleName: string) => {
    setEditingRoleName(roleName);
    setEditRoleNameInput(roleName);
  };

  const saveEditRole = () => {
     if (!editingRoleName || !editRoleNameInput.trim()) return;
     
     // Check duplicidade (exceto o proprio)
     if (editRoleNameInput !== editingRoleName && settings.roles.some(r => r.name.toLowerCase() === editRoleNameInput.toLowerCase())) {
        showToast('Já existe uma função com este nome.', true);
        return;
     }

     const updatedRoles = settings.roles.map(r => r.name === editingRoleName ? { ...r, name: editRoleNameInput.trim() } : r);
     
     // Se a role estava selecionada na tela de permissoes, atualizar a seleção também
     if (selectedRoleForACL === editingRoleName) setSelectedRoleForACL(editRoleNameInput.trim());

     saveSettings({ ...settings, roles: updatedRoles }, 'role', () => {
        setEditingRoleName(null);
        setEditRoleNameInput('');
     });
  };

  const removeRole = (name: string) => {
    if (window.confirm(`Excluir função ${name}?`)) saveSettings({ ...settings, roles: settings.roles.filter(r => r.name !== name) }, 'role');
    if (selectedRoleForACL === name) setSelectedRoleForACL('');
  };

  const toggleRoleRestriction = (roleName: string) => {
     const updatedRoles = settings.roles.map(r => r.name === roleName ? { ...r, canViewAllSectors: !r.canViewAllSectors } : r);
     saveSettings({ ...settings, roles: updatedRoles }, 'role_restriction');
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

  // --- LOGIC: EVENTS ---
  const saveEvent = () => {
    if (!newEventLabel.trim()) return;
    
    if (editingEventId) {
       // Update existing
       const updatedEvents = settings.eventTypes.map(e => e.id === editingEventId ? { ...e, label: newEventLabel.trim(), behavior: newEventBehavior } : e);
       saveSettings({ ...settings, eventTypes: updatedEvents }, 'event', () => {
          setNewEventLabel('');
          setNewEventBehavior('neutral');
          setEditingEventId(null);
       });
    } else {
       // Add new
       const newType: EventTypeConfig = { id: generateUUID(), label: newEventLabel.trim(), behavior: newEventBehavior };
       saveSettings({ ...settings, eventTypes: [...settings.eventTypes, newType] }, 'event', () => setNewEventLabel(''));
    }
  };

  const handleEditEvent = (e: EventTypeConfig) => {
      setEditingEventId(e.id);
      setNewEventLabel(e.label);
      setNewEventBehavior(e.behavior);
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top to see inputs
  };

  const cancelEditEvent = () => {
      setEditingEventId(null);
      setNewEventLabel('');
      setNewEventBehavior('neutral');
  };

  const removeEvent = (id: string) => { if (window.confirm('Excluir?')) saveSettings({ ...settings, eventTypes: settings.eventTypes.filter(e => e.id !== id) }, 'event'); };

  // --- LOGIC: TEMPLATES ---
  const saveTemplate = () => {
    if (!templateName.trim()) { showToast('Nome obrigatório', true); return; }
    
    if (editingTemplateId) {
        // Update
        const updatedTemplates = (settings.scheduleTemplates || []).map(t => 
            t.id === editingTemplateId ? { ...t, name: templateName.trim(), schedule: templateSchedule } : t
        );
        saveSettings({ ...settings, scheduleTemplates: updatedTemplates }, 'template', () => { 
            setTemplateName(''); 
            setTemplateSchedule(JSON.parse(JSON.stringify(initialSchedule)));
            setEditingTemplateId(null);
        });
    } else {
        // Create
        const newT: ScheduleTemplate = { id: generateUUID(), name: templateName.trim(), schedule: templateSchedule };
        saveSettings({ ...settings, scheduleTemplates: [...(settings.scheduleTemplates || []), newT] }, 'template', () => { 
            setTemplateName(''); 
            setTemplateSchedule(JSON.parse(JSON.stringify(initialSchedule))); 
        });
    }
  };

  const loadTemplateForEdit = (t: ScheduleTemplate) => {
      setEditingTemplateId(t.id);
      setTemplateName(t.name);
      setTemplateSchedule(JSON.parse(JSON.stringify(t.schedule)));
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditTemplate = () => {
      setEditingTemplateId(null);
      setTemplateName('');
      setTemplateSchedule(JSON.parse(JSON.stringify(initialSchedule)));
  };

  const removeTemplate = (id: string) => { if (window.confirm('Excluir modelo?')) saveSettings({ ...settings, scheduleTemplates: (settings.scheduleTemplates || []).filter(t => t.id !== id) }, 'template'); };

  // --- LOGIC: SYSTEM MESSAGE ---
  const saveSystemMessage = () => {
    saveSettings({
      ...settings,
      systemMessage: {
        active: sysMsgActive,
        level: sysMsgLevel,
        message: sysMsgContent
      }
    }, 'system_msg');
  };

  // --- UI HELPERS ---
  const daysOrder: (keyof Schedule)[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  
  // Group Permissions
  const groupedPermissions = SYSTEM_PERMISSIONS.reduce((acc, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {} as Record<string, typeof SYSTEM_PERMISSIONS>);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Configurações do Sistema</h1>
      
      {/* SUB-TABS NAVIGATION */}
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
        {showJornada && (
          <button onClick={() => setActiveSubTab('jornada')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeSubTab === 'jornada' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Jornada de Trabalho
          </button>
        )}
        {showSistema && (
          <button onClick={() => setActiveSubTab('sistema')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeSubTab === 'sistema' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Avisos do Sistema
          </button>
        )}
      </div>

      {(!showGeral && !showAcesso && !showJornada && !showSistema) && (
          <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200 mt-6">
              Você não possui permissões para acessar as configurações.
          </div>
      )}

      {/* --- TAB: GERAL & CADASTROS --- */}
      {activeSubTab === 'geral' && showGeral && (
        <div className="animate-fadeIn space-y-8">
           
           {/* Integrações */}
           {hasPermission('settings:integration') && (
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
           )}

           {/* Filiais e Setores */}
           {hasPermission('settings:lists') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <ManageList 
                  title="Filiais" 
                  items={settings.branches} 
                  onAdd={addBranch} 
                  onEdit={editBranch}
                  onRemove={removeBranch} 
                  saving={savingState['branch'] || 'idle'} 
                  removingId={removingId} 
                  placeholder="Nova Filial..." 
                />
                <ManageList 
                  title="Setores / Squads" 
                  items={settings.sectors || []} 
                  onAdd={addSector} 
                  onEdit={editSector}
                  onRemove={removeSector} 
                  saving={savingState['sector'] || 'idle'} 
                  removingId={removingId} 
                  placeholder="Novo Setor..." 
                />
            </div>
           )}

           {/* Perfis de Acesso (Separado) */}
           {hasPermission('settings:profiles') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <ManageList 
                  title="Perfis de Acesso (Sistema)" 
                  items={settings.accessProfiles || ['admin', 'colaborador', 'noc']} 
                  onAdd={addProfile} 
                  onEdit={editProfile}
                  onRemove={removeProfile} 
                  saving={savingState['profile'] || 'idle'} 
                  removingId={removingId} 
                  placeholder="Novo Perfil (ex: supervisor)..." 
                />
            </div>
           )}

           {/* Tipos de Evento */}
           {hasPermission('settings:event_types') && (
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
           )}

           {!hasPermission('settings:integration') && !hasPermission('settings:lists') && !hasPermission('settings:profiles') && !hasPermission('settings:event_types') && (
              <p className="text-gray-500 italic text-center py-8">Você não tem permissão para visualizar itens desta seção.</p>
           )}
        </div>
      )}

      {/* --- TAB: CONTROLE DE ACESSO --- */}
      {activeSubTab === 'acesso' && showAcesso && (
        <div className="animate-fadeIn space-y-8">
           {hasPermission('settings:access_control') ? (
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
               <h2 className="text-lg font-bold text-gray-800 mb-2">Gerenciar Funções (Roles)</h2>
               <p className="text-sm text-gray-500 mb-6">Crie funções para categorizar colaboradores e atribua permissões específicas.</p>
               
               {/* Adicionar Role */}
               <div className="flex gap-2 mb-6 max-w-md">
                 <input type="text" className="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none" placeholder="Nova Função (Ex: Coordenador)..." value={newRoleName} onChange={e => setNewRoleName(e.target.value)} />
                 <button onClick={addRole} disabled={!newRoleName.trim() || savingState['role'] === 'saving'} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">Adicionar</button>
               </div>

               {/* Seletor de Role para Editar Permissões */}
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="col-span-1 border-r border-gray-200 pr-4">
                     <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Selecione uma Função</h3>
                     <div className="space-y-1">
                        {settings.roles.map(r => (
                          <div 
                            key={r.name} 
                            className={`flex justify-between items-center p-3 rounded-lg transition-colors group ${selectedRoleForACL === r.name ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 border border-transparent cursor-pointer'}`}
                            onClick={() => setSelectedRoleForACL(r.name)}
                          >
                            {editingRoleName === r.name ? (
                               <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                                  <input 
                                    autoFocus 
                                    className="flex-1 text-sm border border-indigo-300 rounded px-1 py-0.5 outline-none" 
                                    value={editRoleNameInput} 
                                    onChange={e => setEditRoleNameInput(e.target.value)} 
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') saveEditRole();
                                        if (e.key === 'Escape') setEditingRoleName(null);
                                    }}
                                  />
                                  <button onClick={saveEditRole} className="text-green-600 font-bold px-1">✓</button>
                                  <button onClick={() => setEditingRoleName(null)} className="text-gray-400 font-bold px-1">✕</button>
                               </div>
                            ) : (
                               <>
                                  <span className={`font-medium truncate ${selectedRoleForACL === r.name ? 'text-indigo-700' : 'text-gray-700'}`}>{r.name}</span>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                     <button 
                                        onClick={() => startEditRole(r.name)}
                                        className="text-blue-400 hover:text-blue-600 p-1 hover:bg-blue-50 rounded"
                                        title="Renomear"
                                     >
                                        ✎
                                     </button>
                                     <button 
                                        onClick={() => removeRole(r.name)}
                                        className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
                                        title="Excluir"
                                     >
                                        🗑️
                                     </button>
                                  </div>
                               </>
                            )}
                          </div>
                        ))}
                     </div>
                  </div>

                  <div className="col-span-2">
                     {selectedRoleForACL ? (
                       <div className="animate-fadeIn">
                          <div className="flex justify-between items-center mb-4 bg-gray-50 p-4 rounded-lg">
                             <div>
                                <h3 className="text-lg font-bold text-gray-800">Editando: <span className="text-indigo-600">{selectedRoleForACL}</span></h3>
                                <p className="text-xs text-gray-500">Defina o que esta função pode ver e fazer.</p>
                             </div>
                             
                             {/* Config de Restrição de Setor (Visualização) */}
                             <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">Acesso aos Dados:</span>
                                <button 
                                  onClick={() => toggleRoleRestriction(selectedRoleForACL)}
                                  className={`px-3 py-1 rounded text-xs font-bold transition-colors ${settings.roles.find(r => r.name === selectedRoleForACL)?.canViewAllSectors ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
                                >
                                  {settings.roles.find(r => r.name === selectedRoleForACL)?.canViewAllSectors ? 'GLOBAL (Tudo)' : 'RESTRITO (Por Usuário)'}
                                </button>
                             </div>
                          </div>

                          {/* Matriz de Permissões */}
                          <div className="space-y-6">
                             {Object.entries(groupedPermissions).map(([category, perms]) => (
                                <div key={category}>
                                   <h4 className="text-xs font-bold text-gray-500 uppercase border-b border-gray-100 pb-1 mb-3">{category}</h4>
                                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {perms.map(perm => {
                                        const role = settings.roles.find(r => r.name === selectedRoleForACL);
                                        const isActive = role?.permissions?.includes(perm.id) || false;

                                        return (
                                          <label key={perm.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isActive ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                                             <div className={`w-5 h-5 rounded flex items-center justify-center border ${isActive ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>
                                                {isActive && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                             </div>
                                             <input 
                                               type="checkbox" 
                                               className="hidden" 
                                               checked={isActive} 
                                               onChange={() => togglePermission(selectedRoleForACL, perm.id)} 
                                             />
                                             <span className={`text-sm ${isActive ? 'text-indigo-800 font-medium' : 'text-gray-600'}`}>{perm.label}</span>
                                          </label>
                                        );
                                      })}
                                   </div>
                                </div>
                             ))}
                          </div>
                       </div>
                     ) : (
                       <div className="h-full flex flex-col items-center justify-center text-gray-400">
                          <span className="text-4xl mb-2">👈</span>
                          <p>Selecione uma função à esquerda para configurar permissões.</p>
                       </div>
                     )}
                  </div>
               </div>
             </div>
           ) : (
             <p className="text-gray-500 italic text-center py-8">Você não tem permissão para gerenciar funções e acessos.</p>
           )}
        </div>
      )}

      {/* --- TAB: JORNADA DE TRABALHO --- */}
      {activeSubTab === 'jornada' && showJornada && (
        <div className="animate-fadeIn">
            {hasPermission('settings:schedule_templates') ? (
              <>
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

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                   <h2 className="text-lg font-bold text-gray-800 mb-4">Modelos Salvos</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(settings.scheduleTemplates || []).map(t => (
                         <div key={t.id} className={`flex justify-between items-center p-3 border border-gray-200 rounded-lg transition-colors ${editingTemplateId === t.id ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' : 'bg-gray-50'}`}>
                            <span className="font-bold text-gray-700 truncate mr-2">{t.name}</span>
                            <div className="flex gap-2 shrink-0">
                               <button onClick={() => loadTemplateForEdit(t)} className="text-blue-500 bg-blue-50 px-3 py-1 rounded text-xs font-bold hover:bg-blue-100 border border-blue-100">Editar</button>
                               <button onClick={() => removeTemplate(t.id)} className="text-red-500 bg-red-50 px-3 py-1 rounded text-xs font-bold hover:bg-red-100 border border-red-100">Excluir</button>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
              </>
            ) : (
               <p className="text-gray-500 italic text-center py-8">Você não tem permissão para gerenciar modelos de jornada.</p>
            )}
        </div>
      )}
      
      {/* --- TAB: AVISOS DO SISTEMA --- */}
      {activeSubTab === 'sistema' && showSistema && (
        <div className="animate-fadeIn">
          {hasPermission('settings:system_msg') ? (
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
          ) : (
             <p className="text-gray-500 italic text-center py-8">Você não tem permissão para gerenciar avisos do sistema.</p>
          )}
        </div>
      )}
    </div>
  );
};
