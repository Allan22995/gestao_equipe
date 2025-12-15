import React, { useState, useMemo } from 'react';
import { SystemSettings, RoleConfig, EventTypeConfig, SeasonalEvent, PERMISSION_MODULES, ScheduleTemplate, Schedule, RotationRule } from '../types';
import { generateUUID } from '../utils/helpers';
import { Modal } from './ui/Modal';

interface SettingsProps {
  settings: SystemSettings;
  setSettings: (s: SystemSettings) => Promise<void>;
  showToast: (msg: string, isError?: boolean) => void;
  hasPermission: (perm: string) => boolean;
}

const initialSchedule: Schedule = {
  segunda: { enabled: true, start: '08:00', end: '17:00', startsPreviousDay: false },
  terca: { enabled: true, start: '08:00', end: '17:00', startsPreviousDay: false },
  quarta: { enabled: true, start: '08:00', end: '17:00', startsPreviousDay: false },
  quinta: { enabled: true, start: '08:00', end: '17:00', startsPreviousDay: false },
  sexta: { enabled: true, start: '08:00', end: '17:00', startsPreviousDay: false },
  sabado: { enabled: false, start: '', end: '', startsPreviousDay: false },
  domingo: { enabled: false, start: '', end: '', startsPreviousDay: false },
};

const daysOrder: (keyof Schedule)[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

// Helper Icon Components
const IconView = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
const IconCreate = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const IconUpdate = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const IconDelete = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const IconSpecial = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;

export const Settings: React.FC<SettingsProps> = ({ settings, setSettings, showToast, hasPermission }) => {
  const [activeTab, setActiveTab] = useState('general');
  
  // --- GENERAL STATES ---
  const [newBranch, setNewBranch] = useState('');
  const [newSector, setNewSector] = useState('');
  
  // --- ROLES STATES ---
  const [newRole, setNewRole] = useState('');
  const [newRoleMirrorSource, setNewRoleMirrorSource] = useState(''); 
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  
  // Permission Modal UI States
  const [activeRoleForPerms, setActiveRoleForPerms] = useState<string | null>(null);
  const [permRoleSearch, setPermRoleSearch] = useState('');

  const [isMirrorModalOpen, setIsMirrorModalOpen] = useState(false);
  const [mirrorTargetRole, setMirrorTargetRole] = useState('');
  const [mirrorSourceRole, setMirrorSourceRole] = useState('');

  // --- EVENTS STATES ---
  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventBehavior, setNewEventBehavior] = useState<'neutral' | 'debit' | 'credit_1x' | 'credit_2x'>('neutral');

  // --- ROTATIONS STATES ---
  const [newRotationLabel, setNewRotationLabel] = useState('');

  // --- TEMPLATES STATES ---
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tempTemplateName, setTempTemplateName] = useState('');
  const [tempSchedule, setTempSchedule] = useState<Schedule>(initialSchedule);

  // --- INTEGRATIONS STATES ---
  const [selectedBranchForLinks, setSelectedBranchForLinks] = useState('');

  // --- SEASONAL STATES ---
  const [newSeasonal, setNewSeasonal] = useState<Partial<SeasonalEvent>>({
      label: '', startDate: '', endDate: '', color: '#3B82F6', active: true
  });

  // --- SYSTEM MSG STATE ---
  const [sysMsg, setSysMsg] = useState({
      active: settings.systemMessage?.active || false,
      level: settings.systemMessage?.level || 'info',
      message: settings.systemMessage?.message || ''
  });

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

  // --- HANDLERS: GENERAL ---
  const addBranch = () => {
    if (!newBranch.trim()) return;
    if (settings.branches.includes(newBranch.trim())) { showToast('Filial já existe.', true); return; }
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
    if (settings.sectors.includes(newSector.trim())) { showToast('Setor já existe.', true); return; }
    updateSettings({ ...settings, sectors: [...settings.sectors, newSector.trim()] });
    setNewSector('');
  };
  const removeSector = (sector: string) => {
    if (window.confirm(`Remover setor ${sector}?`)) {
      updateSettings({ ...settings, sectors: settings.sectors.filter(s => s !== sector) });
    }
  };

  // --- HANDLERS: ROLES & MIRRORING ---
  const addRole = () => {
    if (!newRole.trim()) return;
    if (settings.roles.some(r => r.name === newRole.trim())) { showToast('Função já existe.', true); return; }
    
    let initialPermissions: string[] = [];
    let initialViewAll = false;
    if (newRoleMirrorSource) {
        const sourceRole = settings.roles.find(r => r.name === newRoleMirrorSource);
        if (sourceRole) {
            initialPermissions = [...sourceRole.permissions];
            initialViewAll = sourceRole.canViewAllSectors;
        }
    }
    const newRoleObj: RoleConfig = { name: newRole.trim(), canViewAllSectors: initialViewAll, permissions: initialPermissions };
    updateSettings({ ...settings, roles: [...settings.roles, newRoleObj] });
    setNewRole('');
    setNewRoleMirrorSource('');
    if (newRoleMirrorSource) showToast(`Função criada espelhando ${newRoleMirrorSource}!`);
  };
  const removeRole = (roleName: string) => {
    if (window.confirm(`Remover função ${roleName}?`)) {
      updateSettings({ ...settings, roles: settings.roles.filter(r => r.name !== roleName) });
    }
  };
  const toggleRoleViewAll = (roleName: string) => {
    const updatedRoles = settings.roles.map(r => r.name === roleName ? { ...r, canViewAllSectors: !r.canViewAllSectors } : r);
    updateSettings({ ...settings, roles: updatedRoles });
  };
  const openMirrorModal = (targetRole: string) => {
      setMirrorTargetRole(targetRole); setMirrorSourceRole(''); setIsMirrorModalOpen(true);
  };
  const executeMirroring = () => {
      if (!mirrorTargetRole || !mirrorSourceRole) return;
      const sourceRoleConfig = settings.roles.find(r => r.name === mirrorSourceRole);
      if (!sourceRoleConfig) return;
      const updatedRoles = settings.roles.map(r => r.name === mirrorTargetRole ? { ...r, permissions: [...sourceRoleConfig.permissions], canViewAllSectors: sourceRoleConfig.canViewAllSectors } : r);
      updateSettings({ ...settings, roles: updatedRoles });
      setIsMirrorModalOpen(false);
      showToast(`Permissões copiadas!`);
  };
  
  const togglePermission = (roleName: string, permissionId: string) => {
    const updatedRoles = settings.roles.map(r => {
      if (r.name !== roleName) return r;
      const hasPerm = r.permissions.includes(permissionId);
      return { ...r, permissions: hasPerm ? r.permissions.filter(p => p !== permissionId) : [...r.permissions, permissionId] };
    });
    updateSettings({ ...settings, roles: updatedRoles });
  };

  const toggleAllModulePermissionsForRole = (roleName: string, moduleActionIds: string[]) => {
      const role = settings.roles.find(r => r.name === roleName);
      if (!role) return;
      
      const rolePerms = new Set(role.permissions);
      const allEnabled = moduleActionIds.every(id => rolePerms.has(id));
      
      if (allEnabled) {
          moduleActionIds.forEach(id => rolePerms.delete(id)); // Desmarca tudo
      } else {
          moduleActionIds.forEach(id => rolePerms.add(id)); // Marca tudo
      }
      
      const updatedRoles = settings.roles.map(r => r.name === roleName ? { ...r, permissions: Array.from(rolePerms) } : r);
      updateSettings({ ...settings, roles: updatedRoles });
  };

  // --- HANDLERS: EVENTS ---
  const addEventType = () => {
     if (!newEventLabel.trim()) return;
     const id = newEventLabel.toLowerCase().replace(/\s+/g, '_');
     if (settings.eventTypes.some(t => t.id === id)) { showToast('Já existe.', true); return; }
     updateSettings({ ...settings, eventTypes: [...settings.eventTypes, { id, label: newEventLabel.trim(), behavior: newEventBehavior }] });
     setNewEventLabel('');
  };
  const removeEventType = (id: string) => {
      if (['ferias', 'folga', 'trabalhado'].includes(id)) return;
      if (window.confirm('Remover?')) updateSettings({ ...settings, eventTypes: settings.eventTypes.filter(t => t.id !== id) });
  };

  // --- HANDLERS: ROTATIONS (ESCALAS) ---
  const addRotation = () => {
      if (!newRotationLabel.trim()) return;
      const id = newRotationLabel.trim().toUpperCase().replace(/\s+/g, '_');
      if (settings.shiftRotations?.some(r => r.id === id)) { showToast('Escala já existe.', true); return; }
      const newRot: RotationRule = { id, label: newRotationLabel.trim() };
      updateSettings({ ...settings, shiftRotations: [...(settings.shiftRotations || []), newRot] });
      setNewRotationLabel('');
  };
  const removeRotation = (id: string) => {
      if (window.confirm('Remover escala?')) {
          updateSettings({ ...settings, shiftRotations: (settings.shiftRotations || []).filter(r => r.id !== id) });
      }
  };

  // --- HANDLERS: TEMPLATES (JORNADAS) ---
  const openNewTemplate = () => {
      setEditingTemplateId(null); setTempTemplateName(''); setTempSchedule(JSON.parse(JSON.stringify(initialSchedule))); setIsTemplateModalOpen(true);
  };
  const openEditTemplate = (tpl: ScheduleTemplate) => {
      setEditingTemplateId(tpl.id); setTempTemplateName(tpl.name); setTempSchedule(JSON.parse(JSON.stringify(tpl.schedule))); setIsTemplateModalOpen(true);
  };
  const saveTemplate = () => {
      if (!tempTemplateName.trim()) { showToast('Nome obrigatório', true); return; }
      const newTpl: ScheduleTemplate = {
          id: editingTemplateId || generateUUID(),
          name: tempTemplateName,
          schedule: tempSchedule
      };
      let newTemplates = [...(settings.scheduleTemplates || [])];
      if (editingTemplateId) {
          newTemplates = newTemplates.map(t => t.id === editingTemplateId ? newTpl : t);
      } else {
          newTemplates.push(newTpl);
      }
      updateSettings({ ...settings, scheduleTemplates: newTemplates });
      setIsTemplateModalOpen(false);
  };
  const removeTemplate = (id: string) => {
      if (window.confirm('Excluir modelo?')) updateSettings({ ...settings, scheduleTemplates: (settings.scheduleTemplates || []).filter(t => t.id !== id) });
  };
  const handleTempScheduleChange = (day: keyof Schedule, field: string, val: any) => {
      setTempSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }));
  };

  // --- HANDLERS: INTEGRATIONS (LINKS) ---
  const toggleBranchLink = (targetBranch: string) => {
      if (!selectedBranchForLinks) return;
      const currentLinks = settings.branchLinks?.[selectedBranchForLinks] || [];
      let newLinks;
      if (currentLinks.includes(targetBranch)) newLinks = currentLinks.filter(b => b !== targetBranch);
      else newLinks = [...currentLinks, targetBranch];
      
      updateSettings({
          ...settings,
          branchLinks: { ...settings.branchLinks, [selectedBranchForLinks]: newLinks }
      });
  };

  // --- HANDLERS: SEASONAL ---
  const addSeasonal = () => {
      if (!newSeasonal.label || !newSeasonal.startDate || !newSeasonal.endDate) { showToast('Preencha tudo.', true); return; }
      const newItem: SeasonalEvent = { id: generateUUID(), label: newSeasonal.label!, startDate: newSeasonal.startDate!, endDate: newSeasonal.endDate!, color: newSeasonal.color || '#3B82F6', active: true };
      updateSettings({ ...settings, seasonalEvents: [...(settings.seasonalEvents || []), newItem] });
      setNewSeasonal({ label: '', startDate: '', endDate: '', color: '#3B82F6', active: true });
  };
  const removeSeasonal = (id: string) => updateSettings({ ...settings, seasonalEvents: (settings.seasonalEvents || []).filter(s => s.id !== id) });

  // --- HANDLERS: SYSTEM MSG ---
  const saveSysMsg = () => updateSettings({ ...settings, systemMessage: sysMsg as any });

  const currentModuleDef = PERMISSION_MODULES.find(m => m.id === selectedModule);

  // --- MEMOS FOR PERMISSIONS ---
  const filteredRolesForPerms = useMemo(() => {
      return settings.roles.filter(r => r.name.toLowerCase().includes(permRoleSearch.toLowerCase()));
  }, [settings.roles, permRoleSearch]);

  const selectedRoleConfig = useMemo(() => {
      if (!activeRoleForPerms) return null;
      return settings.roles.find(r => r.name === activeRoleForPerms);
  }, [settings.roles, activeRoleForPerms]);

  // Set default active role when opening module if none selected
  React.useEffect(() => {
      if (selectedModule && !activeRoleForPerms && settings.roles.length > 0) {
          setActiveRoleForPerms(settings.roles[0].name);
      }
  }, [selectedModule, activeRoleForPerms, settings.roles]);

  return (
    <div className="space-y-6">
       {/* TABS HEADER */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex overflow-x-auto custom-scrollbar">
          {[
            { id: 'general', label: '🏢 Geral', icon: '' },
            { id: 'roles', label: '👥 Funções', icon: '' },
            { id: 'events', label: '📅 Eventos', icon: '' },
            { id: 'rotations', label: '🔄 Escalas', icon: '' },
            { id: 'templates', label: '⏰ Jornadas', icon: '' },
            { id: 'integrations', label: '🔗 Integrações', icon: '' },
            { id: 'seasonal', label: '🎉 Sazonais', icon: '' },
            { id: 'system', label: '📢 Avisos', icon: '' },
          ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#667eea] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                  {tab.label}
              </button>
          ))}
       </div>

       {/* --- CONTENT: GENERAL --- */}
       {activeTab === 'general' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                   <h3 className="text-lg font-bold text-gray-800 mb-4">Filiais</h3>
                   <div className="flex gap-2 mb-4">
                       <input type="text" value={newBranch} onChange={e => setNewBranch(e.target.value)} placeholder="Nova Filial..." className="flex-1 border border-gray-300 rounded-lg p-2 text-sm" />
                       <button onClick={addBranch} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700">+</button>
                   </div>
                   <div className="flex flex-wrap gap-2">
                       {settings.branches.map(b => (
                           <div key={b} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full flex items-center gap-2 text-sm border border-gray-200">
                               {b} <button onClick={() => removeBranch(b)} className="text-red-500 font-bold">×</button>
                           </div>
                       ))}
                   </div>
               </div>
               <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                   <h3 className="text-lg font-bold text-gray-800 mb-4">Setores (Globais)</h3>
                   <div className="flex gap-2 mb-4">
                       <input type="text" value={newSector} onChange={e => setNewSector(e.target.value)} placeholder="Novo Setor..." className="flex-1 border border-gray-300 rounded-lg p-2 text-sm" />
                       <button onClick={addSector} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700">+</button>
                   </div>
                   <div className="flex flex-wrap gap-2">
                       {settings.sectors.map(s => (
                           <div key={s} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full flex items-center gap-2 text-sm border border-gray-200">
                               {s} <button onClick={() => removeSector(s)} className="text-red-500 font-bold">×</button>
                           </div>
                       ))}
                   </div>
               </div>
           </div>
       )}

       {/* --- CONTENT: ROLES --- */}
       {activeTab === 'roles' && (
           <div className="space-y-6">
               <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                   <h3 className="text-lg font-bold text-gray-800 mb-4">Funções e Cargos</h3>
                   <div className="flex flex-col md:flex-row gap-2 mb-6">
                       <input type="text" value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Nova Função..." className="flex-1 border border-gray-300 rounded-lg p-2 text-sm" />
                       <div className="md:w-64">
                           <select value={newRoleMirrorSource} onChange={e => setNewRoleMirrorSource(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white">
                               <option value="">Espelhar de (Opcional)...</option>
                               {settings.roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                           </select>
                       </div>
                       <button onClick={addRole} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 whitespace-nowrap">Adicionar</button>
                   </div>
                   <div className="overflow-x-auto">
                       <table className="w-full text-sm text-left">
                           <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                               <tr><th className="p-3">Função</th><th className="p-3 text-center">Visualização Global</th><th className="p-3 text-right">Ações</th></tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                               {settings.roles.map(r => (
                                   <tr key={r.name} className="hover:bg-gray-50 group">
                                       <td className="p-3 font-medium text-gray-800">{r.name}</td>
                                       <td className="p-3 text-center">
                                           <button onClick={() => toggleRoleViewAll(r.name)} className={`px-3 py-1 rounded-full text-xs font-bold border ${r.canViewAllSectors ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{r.canViewAllSectors ? 'Irrestrito' : 'Restrito ao Setor'}</button>
                                       </td>
                                       <td className="p-3 text-right">
                                           <div className="flex justify-end gap-2">
                                               <button onClick={() => openMirrorModal(r.name)} className="text-blue-500 hover:bg-blue-50 p-1 rounded" title="Espelhar">📄</button>
                                               <button onClick={() => removeRole(r.name)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="Excluir">🗑️</button>
                                           </div>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>
               <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                   <h3 className="text-lg font-bold text-gray-800 mb-4">Matriz de Permissões</h3>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {PERMISSION_MODULES.map(mod => (
                           <button key={mod.id} onClick={() => setSelectedModule(mod.id)} className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-indigo-300 transition-all group">
                               <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">{mod.icon}</span>
                               <span className="font-bold text-gray-700 text-sm group-hover:text-indigo-600">{mod.label}</span>
                               <span className="text-[10px] text-gray-400 mt-1">Gerenciar Acessos</span>
                           </button>
                       ))}
                   </div>
               </div>
           </div>
       )}

       {/* --- CONTENT: EVENTS --- */}
       {activeTab === 'events' && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
               <h3 className="text-lg font-bold text-gray-800 mb-4">Tipos de Eventos</h3>
               <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                   <input type="text" value={newEventLabel} onChange={e => setNewEventLabel(e.target.value)} placeholder="Ex: Licença Maternidade" className="flex-1 border border-gray-300 rounded-lg p-2 text-sm" />
                   <select value={newEventBehavior} onChange={e => setNewEventBehavior(e.target.value as any)} className="w-full md:w-48 border border-gray-300 rounded-lg p-2 text-sm">
                       <option value="neutral">Neutro</option><option value="debit">Débito</option><option value="credit_1x">Crédito (1x)</option><option value="credit_2x">Crédito (2x)</option>
                   </select>
                   <button onClick={addEventType} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700">Adicionar</button>
               </div>
               
               <div className="grid grid-cols-1 gap-6">
                    {/* Eventos Neutros */}
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider border-b pb-1">Eventos Neutros</h4>
                        <div className="space-y-2">
                            {settings.eventTypes.filter(t => t.behavior === 'neutral').map(t => (
                                <div key={t.id} className="flex justify-between p-3 border border-gray-200 rounded-lg bg-white">
                                    <div className="flex gap-3 items-center"><span className="font-bold">{t.label}</span><span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{t.behavior}</span></div>
                                    {!['ferias','folga','trabalhado'].includes(t.id) && <button onClick={() => removeEventType(t.id)} className="text-red-500 text-sm font-bold">Excluir</button>}
                                </div>
                            ))}
                            {settings.eventTypes.filter(t => t.behavior === 'neutral').length === 0 && <p className="text-xs text-gray-400 italic">Nenhum evento neutro.</p>}
                        </div>
                    </div>

                    {/* Eventos Débitos */}
                    <div>
                        <h4 className="text-xs font-bold text-red-500 uppercase mb-2 tracking-wider border-b border-red-100 pb-1">Eventos Débitos</h4>
                        <div className="space-y-2">
                            {settings.eventTypes.filter(t => t.behavior === 'debit').map(t => (
                                <div key={t.id} className="flex justify-between p-3 border border-gray-200 rounded-lg bg-white">
                                    <div className="flex gap-3 items-center"><span className="font-bold">{t.label}</span><span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100">{t.behavior}</span></div>
                                    {!['ferias','folga','trabalhado'].includes(t.id) && <button onClick={() => removeEventType(t.id)} className="text-red-500 text-sm font-bold">Excluir</button>}
                                </div>
                            ))}
                            {settings.eventTypes.filter(t => t.behavior === 'debit').length === 0 && <p className="text-xs text-gray-400 italic">Nenhum evento de débito.</p>}
                        </div>
                    </div>

                    {/* Eventos Créditos */}
                    <div>
                        <h4 className="text-xs font-bold text-emerald-500 uppercase mb-2 tracking-wider border-b border-emerald-100 pb-1">Eventos Créditos</h4>
                        <div className="space-y-2">
                            {settings.eventTypes.filter(t => t.behavior.startsWith('credit')).map(t => (
                                <div key={t.id} className="flex justify-between p-3 border border-gray-200 rounded-lg bg-white">
                                    <div className="flex gap-3 items-center"><span className="font-bold">{t.label}</span><span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">{t.behavior}</span></div>
                                    {!['ferias','folga','trabalhado'].includes(t.id) && <button onClick={() => removeEventType(t.id)} className="text-red-500 text-sm font-bold">Excluir</button>}
                                </div>
                            ))}
                            {settings.eventTypes.filter(t => t.behavior.startsWith('credit')).length === 0 && <p className="text-xs text-gray-400 italic">Nenhum evento de crédito.</p>}
                        </div>
                    </div>
               </div>
           </div>
       )}

       {/* --- CONTENT: ROTATIONS (ESCALAS) --- */}
       {activeTab === 'rotations' && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
               <h3 className="text-lg font-bold text-gray-800 mb-4">Escalas de Revezamento</h3>
               <p className="text-sm text-gray-500 mb-4">Defina os identificadores para grupos de escala (Ex: Grupo A, Grupo B). Isso habilita a funcionalidade de escala no cadastro de colaboradores.</p>
               
               <div className="flex gap-2 mb-6">
                   <input type="text" value={newRotationLabel} onChange={e => setNewRotationLabel(e.target.value)} placeholder="Nome da Escala (Ex: Grupo C)..." className="flex-1 border border-gray-300 rounded-lg p-2 text-sm" />
                   <button onClick={addRotation} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700">Adicionar Escala</button>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                   {(settings.shiftRotations || []).map(r => (
                       <div key={r.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg bg-gray-50">
                           <span className="font-bold text-gray-700">{r.label}</span>
                           <button onClick={() => removeRotation(r.id)} className="text-red-500 hover:text-red-700 p-1">🗑️</button>
                       </div>
                   ))}
                   {(settings.shiftRotations || []).length === 0 && <p className="text-gray-400 text-sm italic col-span-3">Nenhuma escala cadastrada.</p>}
               </div>
           </div>
       )}

       {/* --- CONTENT: TEMPLATES (JORNADAS) --- */}
       {activeTab === 'templates' && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
               <div className="flex justify-between items-center mb-6">
                   <div>
                       <h3 className="text-lg font-bold text-gray-800">Modelos de Jornada de Trabalho</h3>
                       <p className="text-sm text-gray-500">Crie modelos padrão (Ex: 08:00 as 17:00) para agilizar o cadastro.</p>
                   </div>
                   <button onClick={openNewTemplate} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 text-sm shadow-sm">
                       + Novo Modelo
                   </button>
               </div>

               <div className="space-y-3">
                   {(settings.scheduleTemplates || []).map(t => (
                       <div key={t.id} className="flex justify-between items-center p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white">
                           <div className="flex items-center gap-3">
                               <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">⏰</div>
                               <span className="font-bold text-gray-800">{t.name}</span>
                           </div>
                           <div className="flex gap-2">
                               <button onClick={() => openEditTemplate(t)} className="text-blue-600 bg-blue-50 px-3 py-1 rounded text-xs font-bold hover:bg-blue-100">Editar</button>
                               <button onClick={() => removeTemplate(t.id)} className="text-red-600 bg-red-50 px-3 py-1 rounded text-xs font-bold hover:bg-red-100">Excluir</button>
                           </div>
                       </div>
                   ))}
                   {(settings.scheduleTemplates || []).length === 0 && <p className="text-center text-gray-400 py-8">Nenhum modelo cadastrado.</p>}
               </div>
           </div>
       )}

       {/* --- CONTENT: INTEGRATIONS (LINKS) --- */}
       {activeTab === 'integrations' && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
               <h3 className="text-lg font-bold text-gray-800 mb-4">Integração entre Filiais (Visão da Liderança)</h3>
               <p className="text-sm text-gray-500 mb-6">Permita que a liderança de uma filial visualize colaboradores de outras filiais vinculadas.</p>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                       <label className="text-xs font-bold text-gray-500 uppercase block mb-2">1. Selecione a Filial Principal (Quem vê)</label>
                       <select 
                           className="w-full border border-gray-300 rounded-lg p-2.5 bg-white shadow-sm"
                           value={selectedBranchForLinks}
                           onChange={e => setSelectedBranchForLinks(e.target.value)}
                       >
                           <option value="">Selecione...</option>
                           {settings.branches.map(b => <option key={b} value={b}>{b}</option>)}
                       </select>
                   </div>

                   {selectedBranchForLinks && (
                       <div className="md:col-span-2 bg-white p-4 rounded-lg border border-indigo-100 shadow-sm">
                           <label className="text-xs font-bold text-gray-500 uppercase block mb-3">2. Marque as filiais visíveis para {selectedBranchForLinks}</label>
                           <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                               {settings.branches.filter(b => b !== selectedBranchForLinks).map(b => {
                                   const isLinked = settings.branchLinks?.[selectedBranchForLinks]?.includes(b);
                                   return (
                                       <label key={b} className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${isLinked ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-gray-50 border-gray-200'}`}>
                                           <input 
                                               type="checkbox" 
                                               checked={!!isLinked}
                                               onChange={() => toggleBranchLink(b)}
                                               className="rounded text-indigo-600 focus:ring-indigo-500"
                                           />
                                           <span className={`text-sm ${isLinked ? 'font-bold text-indigo-800' : 'text-gray-700'}`}>{b}</span>
                                       </label>
                                   );
                               })}
                           </div>
                           {settings.branches.length <= 1 && <p className="text-sm text-gray-400 italic">Cadastre mais filiais na aba Geral para configurar integrações.</p>}
                       </div>
                   )}
               </div>
           </div>
       )}

       {/* --- CONTENT: SEASONAL --- */}
       {activeTab === 'seasonal' && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
               <h3 className="text-lg font-bold text-gray-800 mb-4">Eventos Sazonais</h3>
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                   <div className="md:col-span-1"><input type="text" value={newSeasonal.label} onChange={e => setNewSeasonal({...newSeasonal, label: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" placeholder="Nome (Ex: Natal)" /></div>
                   <div><input type="date" value={newSeasonal.startDate} onChange={e => setNewSeasonal({...newSeasonal, startDate: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" /></div>
                   <div><input type="date" value={newSeasonal.endDate} onChange={e => setNewSeasonal({...newSeasonal, endDate: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" /></div>
                   <div className="flex items-center"><input type="color" value={newSeasonal.color} onChange={e => setNewSeasonal({...newSeasonal, color: e.target.value})} className="h-9 w-12 border border-gray-300 rounded mr-2 p-1 bg-white" /><button onClick={addSeasonal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 flex-1">Adicionar</button></div>
               </div>
               <div className="space-y-3">
                   {(settings.seasonalEvents || []).map(s => (
                       <div key={s.id} className="flex justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50" style={{ borderLeftWidth: '4px', borderLeftColor: s.color }}>
                           <div><div className="font-bold">{s.label}</div><div className="text-xs text-gray-500">{new Date(s.startDate).toLocaleDateString()} - {new Date(s.endDate).toLocaleDateString()}</div></div>
                           <button onClick={() => removeSeasonal(s.id)} className="text-red-500 text-sm">Excluir</button>
                       </div>
                   ))}
               </div>
           </div>
       )}

       {/* --- CONTENT: SYSTEM MSG --- */}
       {activeTab === 'system' && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
               <h3 className="text-lg font-bold text-gray-800 mb-4">Avisos do Sistema</h3>
               <div className="space-y-4">
                   <div className="flex items-center gap-2"><input type="checkbox" checked={sysMsg.active} onChange={e => setSysMsg({...sysMsg, active: e.target.checked})} /><label className="font-bold">Ativar</label></div>
                   <select value={sysMsg.level} onChange={e => setSysMsg({...sysMsg, level: e.target.value as any})} className="w-full border border-gray-300 rounded-lg p-2"><option value="info">Info</option><option value="warning">Alerta</option><option value="error">Crítico</option></select>
                   <textarea rows={4} value={sysMsg.message} onChange={e => setSysMsg({...sysMsg, message: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2" placeholder="Mensagem..." />
                   <button onClick={saveSysMsg} className="bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg">Salvar</button>
               </div>
           </div>
       )}

       {/* MODALS */}
       
       {/* 1. PERMISSIONS MODAL (MASTER-DETAIL LAYOUT) */}
       <Modal 
            isOpen={!!selectedModule} 
            onClose={() => setSelectedModule(null)} 
            title={currentModuleDef ? `Permissões: ${currentModuleDef.label}` : ''} 
            maxWidth="max-w-[95vw] lg:max-w-6xl h-[85vh] flex flex-col"
        >
            {currentModuleDef && (
                <div className="flex flex-col h-full bg-gray-50 rounded-lg overflow-hidden">
                    <div className="flex flex-col md:flex-row h-full">
                        
                        {/* LEFT SIDEBAR: ROLES LIST */}
                        <div className={`w-full md:w-1/3 lg:w-1/4 bg-white border-r border-gray-200 flex flex-col ${activeRoleForPerms && 'hidden md:flex'}`}>
                            <div className="p-4 border-b border-gray-100">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Selecione uma Função</h4>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Buscar função..." 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={permRoleSearch}
                                        onChange={e => setPermRoleSearch(e.target.value)}
                                    />
                                    <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-1 custom-scrollbar">
                                {settings.roles.length === 0 && <p className="p-4 text-sm text-gray-400 text-center">Nenhuma função cadastrada.</p>}
                                {settings.roles
                                    .filter(r => r.name.toLowerCase().includes(permRoleSearch.toLowerCase()))
                                    .map(role => {
                                        const isActive = role.name === activeRoleForPerms;
                                        // Count active permissions for this module
                                        const activeCount = currentModuleDef.actions.filter(a => role.permissions.includes(a.id)).length;
                                        const totalCount = currentModuleDef.actions.length;
                                        
                                        return (
                                            <div 
                                                key={role.name}
                                                onClick={() => setActiveRoleForPerms(role.name)}
                                                className={`p-4 border-b border-gray-50 cursor-pointer transition-all hover:bg-gray-50 flex justify-between items-center ${isActive ? 'bg-indigo-50 border-r-4 border-r-indigo-600' : ''}`}
                                            >
                                                <div>
                                                    <p className={`font-bold text-sm ${isActive ? 'text-indigo-900' : 'text-gray-700'}`}>{role.name}</p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">{activeCount} de {totalCount} permissões</p>
                                                </div>
                                                <svg className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        </div>

                        {/* RIGHT CONTENT: PERMISSIONS */}
                        <div className={`flex-1 bg-gray-50 flex flex-col h-full ${!activeRoleForPerms && 'hidden md:flex'}`}>
                            {selectedRoleConfig ? (
                                <>
                                    {/* Mobile Header Back Button */}
                                    <div className="md:hidden p-4 bg-white border-b border-gray-200 flex items-center gap-3">
                                        <button onClick={() => setActiveRoleForPerms(null)} className="p-1 rounded hover:bg-gray-100">
                                            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <span className="font-bold text-gray-800">{selectedRoleConfig.name}</span>
                                    </div>

                                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                                    {currentModuleDef.icon} {currentModuleDef.label}
                                                </h3>
                                                <p className="text-sm text-gray-500 mt-1">{currentModuleDef.description}</p>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    const moduleActionIds = currentModuleDef.actions.map(a => a.id);
                                                    toggleAllModulePermissionsForRole(selectedRoleConfig.name, moduleActionIds);
                                                }}
                                                className="text-xs font-bold bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-50 shadow-sm transition-colors uppercase tracking-wide"
                                            >
                                                {currentModuleDef.actions.every(a => selectedRoleConfig.permissions.includes(a.id)) ? 'Desmarcar Todos' : 'Habilitar Todos'}
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {currentModuleDef.actions.map(action => {
                                                const isChecked = selectedRoleConfig.permissions.includes(action.id);
                                                
                                                // Determine icon and color based on action type
                                                let IconComp = IconSpecial;
                                                let iconBg = 'bg-gray-100 text-gray-500';
                                                
                                                if (action.type === 'view') { IconComp = IconView; iconBg = 'bg-blue-100 text-blue-600'; }
                                                if (action.type === 'create') { IconComp = IconCreate; iconBg = 'bg-green-100 text-green-600'; }
                                                if (action.type === 'update') { IconComp = IconUpdate; iconBg = 'bg-amber-100 text-amber-600'; }
                                                if (action.type === 'delete') { IconComp = IconDelete; iconBg = 'bg-red-100 text-red-600'; }

                                                return (
                                                    <div 
                                                        key={action.id} 
                                                        onClick={() => togglePermission(selectedRoleConfig.name, action.id)}
                                                        className={`
                                                            bg-white p-4 rounded-xl border transition-all cursor-pointer shadow-sm group hover:shadow-md flex items-center justify-between
                                                            ${isChecked ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-gray-200 hover:border-gray-300'}
                                                        `}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${isChecked ? 'shadow-sm' : 'opacity-70 grayscale'}`}>
                                                                <IconComp />
                                                            </div>
                                                            <div>
                                                                <p className={`font-bold text-sm ${isChecked ? 'text-gray-900' : 'text-gray-500'}`}>{action.label}</p>
                                                                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{action.type}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Custom Toggle Switch */}
                                                        <div className={`w-12 h-6 rounded-full transition-colors relative duration-300 ${isChecked ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                                                            <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-0.5 transition-transform duration-300 ${isChecked ? 'left-[26px]' : 'left-0.5'}`}></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                                    <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    <p>Selecione uma função à esquerda para gerenciar as permissões.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Modal>

       {/* 2. MIRRORING MODAL */}
       <Modal isOpen={isMirrorModalOpen} onClose={() => setIsMirrorModalOpen(false)} title="Espelhar Permissões">
           <div className="space-y-4">
               <p className="text-sm bg-amber-50 p-3 rounded text-amber-800">Isso substituirá todas as permissões de <b>{mirrorTargetRole}</b>.</p>
               <select value={mirrorSourceRole} onChange={e => setMirrorSourceRole(e.target.value)} className="w-full border p-2 rounded"><option value="">Copiar de...</option>{settings.roles.filter(r => r.name !== mirrorTargetRole).map(r => <option key={r.name} value={r.name}>{r.name}</option>)}</select>
               <div className="flex justify-end gap-2"><button onClick={() => setIsMirrorModalOpen(false)} className="px-4 py-2">Cancelar</button><button onClick={executeMirroring} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Confirmar</button></div>
           </div>
       </Modal>

       {/* 3. TEMPLATE EDIT MODAL */}
       <Modal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} title={editingTemplateId ? "Editar Modelo" : "Novo Modelo"} maxWidth="max-w-4xl">
           <div className="space-y-6">
               <div>
                   <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome do Modelo</label>
                   <input type="text" value={tempTemplateName} onChange={e => setTempTemplateName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2" placeholder="Ex: Comercial 08 as 18" />
               </div>
               <div className="space-y-2">
                   {daysOrder.map(day => (
                       <div key={day} className="flex flex-col md:flex-row md:items-center gap-4 p-2 bg-gray-50 rounded border border-gray-100">
                           <div className="w-24 font-bold capitalize text-sm flex items-center gap-2">
                               <input type="checkbox" checked={tempSchedule[day].enabled} onChange={e => handleTempScheduleChange(day, 'enabled', e.target.checked)} />
                               {day}
                           </div>
                           <div className={`flex items-center gap-2 flex-1 ${!tempSchedule[day].enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                               <input type="time" value={tempSchedule[day].start} onChange={e => handleTempScheduleChange(day, 'start', e.target.value)} className="border rounded px-2 py-1 text-sm" />
                               <span className="text-xs text-gray-400">até</span>
                               <input type="time" value={tempSchedule[day].end} onChange={e => handleTempScheduleChange(day, 'end', e.target.value)} className="border rounded px-2 py-1 text-sm" />
                               <label className="flex items-center gap-1 ml-4 text-xs"><input type="checkbox" checked={tempSchedule[day].startsPreviousDay} onChange={e => handleTempScheduleChange(day, 'startsPreviousDay', e.target.checked)} /> Inicia dia anterior</label>
                           </div>
                       </div>
                   ))}
               </div>
               <div className="flex justify-end gap-3 pt-4 border-t">
                   <button onClick={() => setIsTemplateModalOpen(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
                   <button onClick={saveTemplate} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-indigo-700">Salvar Modelo</button>
               </div>
           </div>
       </Modal>
    </div>
  );
};