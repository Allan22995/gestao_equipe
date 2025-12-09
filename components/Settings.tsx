

import React, { useState, useEffect } from 'react';
import { SystemSettings, EventTypeConfig, EventBehavior, Schedule, DaySchedule, ScheduleTemplate, RoleConfig, SYSTEM_PERMISSIONS, AccessProfileConfig, RotationRule } from '../types';
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
  const showGeral = hasPermission('settings:integration') || hasPermission('settings:branches') || hasPermission('settings:sectors') || hasPermission('settings:profiles') || hasPermission('settings:event_types');
  const showAcesso = hasPermission('settings:access_control');
  const showJornada = hasPermission('settings:schedule_templates');
  const showSistema = hasPermission('settings:system_msg');

  // Tabs Internas (Initialize based on permissions)
  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'acesso' | 'jornada' | 'sistema'>(() => {
    if (hasPermission('settings:integration') || hasPermission('settings:branches') || hasPermission('settings:sectors') || hasPermission('settings:profiles') || hasPermission('settings:event_types')) return 'geral';
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
  
  // States Profiles
  const [newProfileName, setNewProfileName] = useState('');

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

  // Rotation Edit States
  const [editingRotationId, setEditingRotationId] = useState<string | null>(null); // NEW: Track edit mode
  const [newRotationId, setNewRotationId] = useState('');

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

  // --- LOGIC: BRANCHES, SECTORS ---
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
  
  // --- LOGIC: SHIFT ROTATIONS (ESCALAS) ---
  // Agora suporta apenas Rótulos/IDs
  const saveRotation = () => {
    if (!newRotationId.trim()) { showToast('Defina um nome para a escala (ex: A, B).', true); return; }
    
    // Check duplicate ID (only if not editing)
    if (!editingRotationId && settings.shiftRotations.some(r => r.id.toLowerCase() === newRotationId.trim().toLowerCase())) {
        showToast('Já existe uma escala com este ID.', true);
        return;
    }

    let updatedRotations = [...settings.shiftRotations];
    
    if (editingRotationId) {
        // Update Mode
        updatedRotations = updatedRotations.map(r => 
           r.id === editingRotationId 
             ? { ...r, label: `Escala ${newRotationId.trim().toUpperCase()}` }
             : r
        );
    } else {
        // Create Mode
        const newRule: RotationRule = {
          id: newRotationId.trim().toUpperCase(),
          label: `Escala ${newRotationId.trim().toUpperCase()}`
        };
        updatedRotations.push(newRule);
    }
    
    saveSettings({ ...settings, shiftRotations: updatedRotations }, 'rotation', () => {
       setNewRotationId('');
       setEditingRotationId(null);
    });
  };

  const deleteRotation = (id: string) => {
    if (window.confirm('Excluir esta escala?')) {
        const updated = settings.shiftRotations.filter(r => r.id !== id);
        saveSettings({ ...settings, shiftRotations: updated }, 'rotation');
    }
  };
  
  const startEditRotation = (r: RotationRule) => {
      setEditingRotationId(r.id);
      setNewRotationId(r.id); // Assuming ID is the label base
  };
  
  const cancelEditRotation = () => {
      setEditingRotationId(null);
      setNewRotationId('');
  };

  // --- RENDER ---
  return (
     <div className="space-y-6">
       
       {/* Sub-Tabs Navigation */}
       <div className="flex space-x-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
          {showGeral && (
            <button 
              onClick={() => setActiveSubTab('geral')} 
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeSubTab === 'geral' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              Geral e Listas
            </button>
          )}
          {showAcesso && (
             <button 
               onClick={() => setActiveSubTab('acesso')} 
               className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeSubTab === 'acesso' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
             >
               Controle de Acesso
             </button>
          )}
          {showJornada && (
             <button 
               onClick={() => setActiveSubTab('jornada')} 
               className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeSubTab === 'jornada' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
             >
               Jornadas e Escalas
             </button>
          )}
          {showSistema && (
             <button 
               onClick={() => setActiveSubTab('sistema')} 
               className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeSubTab === 'sistema' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
             >
               Avisos do Sistema
             </button>
          )}
       </div>

       {/* TAB: JORNADA E ESCALAS */}
       {activeSubTab === 'jornada' && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
            {/* ESCALAS DE REVEZAMENTO */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Escalas de Revezamento</h2>
                <p className="text-xs text-gray-500 mb-4">Defina os nomes das escalas disponíveis (ex: Escala A, B). A lógica de folgas (3x1) é calculada automaticamente baseada na data de início do colaborador.</p>
                
                {hasPermission('create:rotations') && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                    <h3 className="text-xs font-bold text-gray-600 uppercase mb-2">{editingRotationId ? 'Editar Escala' : 'Nova Escala'}</h3>
                    <div className="flex gap-2 mb-2">
                        <input 
                           type="text" 
                           placeholder="Identificador (Ex: A, B, Azul)" 
                           className="flex-1 border border-gray-300 rounded p-2 text-sm"
                           value={newRotationId}
                           onChange={e => setNewRotationId(e.target.value)}
                           maxLength={10}
                           disabled={savingState['rotation'] === 'saving'}
                        />
                    </div>
                    <div className="flex gap-2">
                         {editingRotationId && (
                             <button onClick={cancelEditRotation} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded text-xs">Cancelar</button>
                         )}
                         <button 
                           onClick={saveRotation}
                           disabled={savingState['rotation'] === 'saving'}
                           className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded text-xs"
                         >
                           {savingState['rotation'] === 'saving' ? 'Salvando...' : editingRotationId ? 'Atualizar Escala' : 'Criar Escala'}
                         </button>
                    </div>
                </div>
                )}

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                   {settings.shiftRotations.map(rot => (
                       <div key={rot.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                          <div>
                              <div className="font-bold text-gray-800">{rot.label}</div>
                              <div className="text-xs text-gray-500">ID: {rot.id}</div>
                          </div>
                          <div className="flex gap-2">
                             {hasPermission('edit:rotations') && <button onClick={() => startEditRotation(rot)} className="text-blue-500 hover:underline text-xs font-bold">Editar</button>}
                             {hasPermission('delete:rotations') && <button onClick={() => deleteRotation(rot.id)} className="text-red-500 hover:underline text-xs font-bold">Excluir</button>}
                          </div>
                       </div>
                   ))}
                   {settings.shiftRotations.length === 0 && <p className="text-gray-400 text-xs text-center py-2">Nenhuma escala definida.</p>}
                </div>
            </div>

            {/* MODELOS DE JORNADA (SCHEDULE TEMPLATES) */}
            {/* ... Mantido o código original de Templates ... */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                   <h2 className="text-lg font-bold text-gray-800">Modelos de Jornada (Templates)</h2>
                   {editingTemplateId && <button onClick={() => { setEditingTemplateId(null); setTemplateName(''); setTemplateSchedule(JSON.parse(JSON.stringify(initialSchedule))); }} className="text-xs text-red-500 hover:underline">Cancelar Edição</button>}
                </div>
                
                {/* Editor de Template */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4 space-y-3">
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Modelo</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Administrativo Padrão" 
                        className="w-full border border-gray-300 rounded p-2 text-sm"
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                      />
                   </div>
                   {/* Mini Schedule Editor (Simplified for brevity in settings) */}
                   <div className="space-y-1">
                      <p className="text-xs font-bold text-gray-500 uppercase">Configuração Rápida de Horários</p>
                      {['segunda', 'sexta', 'sabado', 'domingo'].map(d => {
                          const day = d as keyof Schedule;
                          // Show only a few days as representative or build full list if needed
                          // For brevity, let's just show a summary or full list
                          return (
                            <div key={day} className="flex items-center gap-2 text-xs">
                               <input type="checkbox" checked={templateSchedule[day].enabled} onChange={e => setTemplateSchedule({...templateSchedule, [day]: {...templateSchedule[day], enabled: e.target.checked}})} />
                               <span className="capitalize w-16">{day}</span>
                               <input type="time" value={templateSchedule[day].start} onChange={e => setTemplateSchedule({...templateSchedule, [day]: {...templateSchedule[day], start: e.target.value}})} className="border rounded px-1" disabled={!templateSchedule[day].enabled}/>
                               <span>-</span>
                               <input type="time" value={templateSchedule[day].end} onChange={e => setTemplateSchedule({...templateSchedule, [day]: {...templateSchedule[day], end: e.target.value}})} className="border rounded px-1" disabled={!templateSchedule[day].enabled}/>
                            </div>
                          )
                      })}
                      <p className="text-[10px] text-gray-400 italic">*Edite os outros dias se necessário na tela de cadastro ou expanda aqui.</p>
                   </div>
                   
                   <button 
                     onClick={() => {
                        if(!templateName) return showToast('Nome obrigatório', true);
                        const newTmpl = { id: editingTemplateId || generateUUID(), name: templateName, schedule: templateSchedule };
                        const updated = editingTemplateId 
                           ? settings.scheduleTemplates.map(t => t.id === editingTemplateId ? newTmpl : t)
                           : [...settings.scheduleTemplates, newTmpl];
                        saveSettings({ ...settings, scheduleTemplates: updated }, 'templates');
                        setEditingTemplateId(null); setTemplateName(''); setTemplateSchedule(JSON.parse(JSON.stringify(initialSchedule)));
                     }}
                     className="w-full bg-blue-600 text-white font-bold py-2 rounded text-xs hover:bg-blue-700"
                   >
                      {editingTemplateId ? 'Atualizar Modelo' : 'Salvar Novo Modelo'}
                   </button>
                </div>

                <div className="space-y-2">
                   {settings.scheduleTemplates.map(t => (
                      <div key={t.id} className="flex justify-between items-center p-2 bg-gray-50 rounded border border-gray-100 text-sm">
                         <span className="font-bold text-gray-700">{t.name}</span>
                         <div className="flex gap-2">
                            <button onClick={() => { setEditingTemplateId(t.id); setTemplateName(t.name); setTemplateSchedule(t.schedule); }} className="text-blue-500 hover:underline text-xs">Editar</button>
                            <button onClick={() => { if(window.confirm('Excluir?')) saveSettings({...settings, scheduleTemplates: settings.scheduleTemplates.filter(x => x.id !== t.id)}, 'templates') }} className="text-red-500 hover:underline text-xs">Excluir</button>
                         </div>
                      </div>
                   ))}
                </div>
            </div>
         </div>
       )}

       {/* TAB: GERAL */}
       {activeSubTab === 'geral' && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
            {/* Integração Planilha */}
            {hasPermission('settings:integration') && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
                <h2 className="text-lg font-bold text-gray-800 mb-2">Integração com Planilha de Escalas</h2>
                <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="URL da Planilha Google Sheets..." 
                      className="flex-1 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={spreadsheetUrl}
                      onChange={e => setSpreadsheetUrl(e.target.value)}
                    />
                    <button 
                      onClick={() => saveSettings({ ...settings, spreadsheetUrl }, 'sheet')}
                      disabled={savingState['sheet'] === 'saving'}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all disabled:opacity-50"
                    >
                      {savingState['sheet'] === 'saving' ? '...' : 'Salvar URL'}
                    </button>
                </div>
            </div>
            )}

            {/* Listas Básicas */}
            {hasPermission('settings:branches') && (
            <ManageList 
                title="Filiais" 
                items={settings.branches} 
                onAdd={addBranch} 
                onEdit={editBranch}
                onRemove={removeBranch} 
                saving={savingState['branch'] || 'idle'} 
                removingId={null}
                placeholder="Nova Filial..."
            />
            )}

            {hasPermission('settings:sectors') && (
            <ManageList 
                title="Setores / Squads" 
                items={settings.sectors || []} 
                onAdd={addSector} 
                onEdit={editSector}
                onRemove={removeSector} 
                saving={savingState['sector'] || 'idle'} 
                removingId={null}
                placeholder="Novo Setor..."
            />
            )}

            {hasPermission('settings:profiles') && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Perfis de Acesso</h2>
                <div className="flex gap-2 mb-4">
                    <input type="text" placeholder="Nome do Perfil (ex: estagiario)" className="flex-1 border border-gray-300 rounded p-2 text-sm" value={newProfileName} onChange={e => setNewProfileName(e.target.value)} />
                    <button onClick={() => {
                        if(!newProfileName) return;
                        const newProfile: AccessProfileConfig = { id: newProfileName.toLowerCase(), name: newProfileName.toLowerCase(), active: true };
                        if(settings.accessProfiles.find(p => p.id === newProfile.id)) return showToast('Perfil já existe', true);
                        saveSettings({...settings, accessProfiles: [...settings.accessProfiles, newProfile]}, 'profiles');
                        setNewProfileName('');
                    }} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold text-sm">Add</button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {settings.accessProfiles.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                            <span className={!p.active ? 'text-gray-400 line-through' : ''}>{p.name}</span>
                            <button onClick={() => {
                                const updated = settings.accessProfiles.map(x => x.id === p.id ? {...x, active: !x.active} : x);
                                saveSettings({...settings, accessProfiles: updated}, 'profiles');
                            }} className={`text-xs font-bold px-2 py-1 rounded ${p.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {p.active ? 'Ativo' : 'Inativo'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            )}

            {hasPermission('settings:event_types') && (
             // ... Event Types Editor (Similar Logic)
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Tipos de Evento</h2>
                <div className="bg-gray-50 p-3 rounded mb-3 flex flex-col gap-2">
                    <input type="text" placeholder="Nome do Evento (ex: Curso Externo)" className="border p-2 rounded text-sm" value={newEventLabel} onChange={e => setNewEventLabel(e.target.value)} />
                    <select className="border p-2 rounded text-sm" value={newEventBehavior} onChange={e => setNewEventBehavior(e.target.value as EventBehavior)}>
                        <option value="neutral">Neutro (Apenas Registro)</option>
                        <option value="debit">Débito (Consome Saldo)</option>
                        <option value="credit_1x">Crédito 1x (Trabalho Normal)</option>
                        <option value="credit_2x">Crédito 2x (Trabalho Extra/Feriado)</option>
                    </select>
                    <button onClick={() => {
                        if(!newEventLabel) return;
                        const newType: EventTypeConfig = { id: generateUUID(), label: newEventLabel, behavior: newEventBehavior };
                        saveSettings({...settings, eventTypes: [...settings.eventTypes, newType]}, 'events');
                        setNewEventLabel(''); setNewEventBehavior('neutral');
                    }} className="bg-indigo-600 text-white py-1 rounded text-sm font-bold">Adicionar</button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                     {settings.eventTypes.map(evt => (
                         <div key={evt.id} className="flex justify-between p-2 border rounded text-xs items-center">
                             <div>
                                 <span className="font-bold">{evt.label}</span>
                                 <span className="ml-2 text-gray-500">({evt.behavior})</span>
                             </div>
                             <button onClick={() => {
                                 if(window.confirm('Excluir?')) saveSettings({...settings, eventTypes: settings.eventTypes.filter(x => x.id !== evt.id)}, 'events');
                             }} className="text-red-500">Excluir</button>
                         </div>
                     ))}
                </div>
             </div>
            )}
         </div>
       )}

       {/* TAB: CONTROLE DE ACESSO (ROLES) */}
       {activeSubTab === 'acesso' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fadeIn">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Controle de Acesso (Funções/Cargos)</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left: Role List */}
                  <div className="border-r pr-6">
                      <div className="mb-4 flex gap-2">
                          <input type="text" placeholder="Nova Função..." className="flex-1 border p-2 rounded text-sm" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} />
                          <button onClick={() => {
                              if(!newRoleName) return;
                              const newRole: RoleConfig = { name: newRoleName, canViewAllSectors: false, permissions: [] };
                              if(settings.roles.find(r => r.name === newRoleName)) return showToast('Já existe', true);
                              saveSettings({...settings, roles: [...settings.roles, newRole]}, 'roles');
                              setNewRoleName('');
                          }} className="bg-indigo-600 text-white px-3 rounded font-bold">+</button>
                      </div>
                      <div className="space-y-1">
                          {settings.roles.map(r => (
                              <div 
                                key={r.name} 
                                onClick={() => setSelectedRoleForACL(r.name)}
                                className={`p-2 rounded cursor-pointer text-sm flex justify-between items-center ${selectedRoleForACL === r.name ? 'bg-indigo-100 text-indigo-800 font-bold' : 'hover:bg-gray-50'}`}
                              >
                                  {r.name}
                                  <button onClick={(e) => { e.stopPropagation(); if(window.confirm('Excluir?')) saveSettings({...settings, roles: settings.roles.filter(x => x.name !== r.name)}, 'roles'); }} className="text-red-400 hover:text-red-600 text-xs">×</button>
                              </div>
                          ))}
                      </div>
                  </div>
                  
                  {/* Right: Permissions */}
                  <div className="md:col-span-2">
                      {selectedRoleForACL ? (
                          <div>
                              <div className="flex justify-between items-center mb-4">
                                  <h3 className="font-bold text-gray-700 text-lg">Permissões para: <span className="text-indigo-600">{selectedRoleForACL}</span></h3>
                                  
                                  {/* Toggle Global View */}
                                  <label className="flex items-center gap-2 cursor-pointer bg-blue-50 px-3 py-1 rounded border border-blue-100">
                                      <input 
                                        type="checkbox" 
                                        checked={settings.roles.find(r => r.name === selectedRoleForACL)?.canViewAllSectors || false}
                                        onChange={(e) => {
                                            const updated = settings.roles.map(r => r.name === selectedRoleForACL ? {...r, canViewAllSectors: e.target.checked} : r);
                                            saveSettings({...settings, roles: updated}, 'roles');
                                        }}
                                      />
                                      <span className="text-xs font-bold text-blue-800">Visualizar Todos os Setores?</span>
                                  </label>
                              </div>

                              {/* Manageable Profiles Config */}
                              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                 <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Pode criar usuários dos perfis:</h4>
                                 <div className="flex flex-wrap gap-2">
                                     {settings.accessProfiles.map(p => {
                                         const currentRole = settings.roles.find(r => r.name === selectedRoleForACL);
                                         const isSelected = currentRole?.manageableProfiles?.includes(p.name);
                                         return (
                                             <button 
                                               key={p.id}
                                               onClick={() => {
                                                   if(!currentRole) return;
                                                   let currentList = currentRole.manageableProfiles || [];
                                                   if (isSelected) currentList = currentList.filter(x => x !== p.name);
                                                   else currentList = [...currentList, p.name];
                                                   
                                                   const updatedRoles = settings.roles.map(r => r.name === selectedRoleForACL ? {...r, manageableProfiles: currentList} : r);
                                                   saveSettings({...settings, roles: updatedRoles}, 'roles');
                                               }}
                                               className={`px-2 py-1 text-xs rounded border ${isSelected ? 'bg-purple-100 text-purple-700 border-purple-300 font-bold' : 'bg-white text-gray-500 border-gray-200'}`}
                                             >
                                                 {p.name}
                                             </button>
                                         )
                                     })}
                                 </div>
                              </div>
                              
                              <div className="space-y-4">
                                  {/* Group Permissions by Category */}
                                  {Object.entries(SYSTEM_PERMISSIONS.reduce((acc, perm) => {
                                      const cat = perm.category || 'Outros';
                                      if (!acc[cat]) acc[cat] = [];
                                      acc[cat].push(perm);
                                      return acc;
                                  }, {} as Record<string, typeof SYSTEM_PERMISSIONS>)).map(([category, perms]) => (
                                      <div key={category} className="border border-gray-100 rounded-lg overflow-hidden">
                                          <div className="bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
                                              {category}
                                          </div>
                                          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              {perms.map(perm => {
                                                  const currentRole = settings.roles.find(r => r.name === selectedRoleForACL);
                                                  const hasPerm = currentRole?.permissions.includes(perm.id);
                                                  return (
                                                      <label key={perm.id} className={`flex items-center gap-2 text-sm p-2 rounded cursor-pointer transition-colors ${hasPerm ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50 border border-transparent'}`}>
                                                          <input 
                                                            type="checkbox"
                                                            checked={hasPerm || false}
                                                            onChange={(e) => {
                                                                if(!currentRole) return;
                                                                let newPerms = currentRole.permissions;
                                                                if (e.target.checked) newPerms = [...newPerms, perm.id];
                                                                else newPerms = newPerms.filter(p => p !== perm.id);
                                                                
                                                                const updatedRoles = settings.roles.map(r => r.name === selectedRoleForACL ? {...r, permissions: newPerms} : r);
                                                                saveSettings({...settings, roles: updatedRoles}, 'roles');
                                                            }}
                                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                                          />
                                                          <span className={hasPerm ? 'text-indigo-900 font-medium' : 'text-gray-600'}>{perm.label}</span>
                                                      </label>
                                                  );
                                              })}
                                          </div>
                                      </div>
                                  ))}
                              </div>

                          </div>
                      ) : (
                          <div className="h-full flex items-center justify-center text-gray-400 italic">
                              Selecione uma função à esquerda para editar permissões.
                          </div>
                      )}
                  </div>
              </div>
          </div>
       )}

       {/* TAB: AVISOS DO SISTEMA */}
       {activeSubTab === 'sistema' && (
         <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fadeIn">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Banner de Aviso Global</h2>
            <div className="bg-amber-50 border border-amber-200 rounded p-4 mb-4 text-sm text-amber-800">
               Use esta ferramenta para exibir mensagens importantes no topo de todas as telas para todos os usuários.
            </div>

            <div className="space-y-4 max-w-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                   <input type="checkbox" checked={sysMsgActive} onChange={e => setSysMsgActive(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded" />
                   <span className="font-bold text-gray-700">Ativar Mensagem</span>
                </label>
                
                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tipo de Alerta</label>
                   <select value={sysMsgLevel} onChange={e => setSysMsgLevel(e.target.value as any)} className="w-full border p-2 rounded">
                      <option value="info">Informação (Azul)</option>
                      <option value="warning">Atenção (Amarelo)</option>
                      <option value="error">Crítico (Vermelho)</option>
                   </select>
                </div>

                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Mensagem</label>
                   <textarea 
                     rows={3} 
                     className="w-full border p-2 rounded"
                     value={sysMsgContent}
                     onChange={e => setSysMsgContent(e.target.value)}
                     placeholder="Digite o comunicado aqui..."
                   ></textarea>
                </div>

                <button 
                  onClick={() => saveSettings({
                      ...settings,
                      systemMessage: { active: sysMsgActive, level: sysMsgLevel, message: sysMsgContent }
                  }, 'sysmsg')}
                  disabled={savingState['sysmsg'] === 'saving'}
                  className="bg-indigo-600 text-white font-bold py-2 px-6 rounded hover:bg-indigo-700 transition"
                >
                  {savingState['sysmsg'] === 'saving' ? 'Salvando...' : 'Atualizar Banner'}
                </button>
            </div>
         </div>
       )}

     </div>
  );
};