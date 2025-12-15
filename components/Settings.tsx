
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

// --- UI COMPONENTS ---

const SectionHeader = ({ title, description }: { title: string, description?: string }) => (
  <div className="mb-6 border-b border-gray-100 pb-2">
    <h3 className="text-lg font-bold text-gray-800">{title}</h3>
    {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
  </div>
);

const Switch = ({ checked, onChange, label, disabled = false }: { checked: boolean, onChange: (checked: boolean) => void, label?: string, disabled?: boolean }) => (
  <label className={`flex items-center group ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
    <div className="relative">
      <input 
        type="checkbox" 
        className="sr-only" 
        checked={checked} 
        onChange={e => !disabled && onChange(e.target.checked)} 
        disabled={disabled}
      />
      <div className={`block w-10 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${checked ? 'transform translate-x-4' : ''}`}></div>
    </div>
    {label && <span className="ml-3 text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition-colors">{label}</span>}
  </label>
);

const IconButton = ({ onClick, icon, colorClass = "text-gray-500 hover:text-indigo-600", title, disabled = false }: any) => (
  <button 
    onClick={onClick} 
    disabled={disabled}
    className={`p-1.5 rounded-full transition-all ${disabled ? 'text-gray-300 cursor-not-allowed' : `hover:bg-gray-100 ${colorClass}`}`} 
    title={disabled ? "Sem permissão para esta ação" : title}
  >
    {icon}
  </button>
);

// Icons
const Icons = {
  Trash: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Edit: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Copy: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  Plus: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  View: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  Create: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  Update: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Delete: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Special: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
};

export const Settings: React.FC<SettingsProps> = ({ settings, setSettings, showToast, hasPermission }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // --- GENERAL STATES ---
  const [newBranch, setNewBranch] = useState('');
  const [newSector, setNewSector] = useState('');
  
  // --- ROLES STATES ---
  const [newRole, setNewRole] = useState('');
  const [newRoleMirrorSource, setNewRoleMirrorSource] = useState(''); 
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
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

  const validate = (field: string, value: string) => {
      if (!value.trim()) {
          setErrors(prev => ({ ...prev, [field]: 'Campo obrigatório' }));
          return false;
      }
      setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
      return true;
  };

  // --- HANDLERS: GENERAL ---
  const addBranch = () => {
    if (!validate('newBranch', newBranch)) return;
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
    if (!validate('newSector', newSector)) return;
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
    if (!validate('newRole', newRole)) return;
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
          moduleActionIds.forEach(id => rolePerms.delete(id));
      } else {
          moduleActionIds.forEach(id => rolePerms.add(id));
      }
      
      const updatedRoles = settings.roles.map(r => r.name === roleName ? { ...r, permissions: Array.from(rolePerms) } : r);
      updateSettings({ ...settings, roles: updatedRoles });
  };

  // --- HANDLERS: EVENTS ---
  const addEventType = () => {
     if (!validate('newEventLabel', newEventLabel)) return;
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
      if (!validate('newRotationLabel', newRotationLabel)) return;
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
      if (!validate('seasonalLabel', newSeasonal.label || '') || !newSeasonal.startDate || !newSeasonal.endDate) { showToast('Preencha todos os campos.', true); return; }
      const newItem: SeasonalEvent = { id: generateUUID(), label: newSeasonal.label!, startDate: newSeasonal.startDate!, endDate: newSeasonal.endDate!, color: newSeasonal.color || '#3B82F6', active: true };
      updateSettings({ ...settings, seasonalEvents: [...(settings.seasonalEvents || []), newItem] });
      setNewSeasonal({ label: '', startDate: '', endDate: '', color: '#3B82F6', active: true });
  };
  const removeSeasonal = (id: string) => updateSettings({ ...settings, seasonalEvents: (settings.seasonalEvents || []).filter(s => s.id !== id) });

  // --- HANDLERS: SYSTEM MSG ---
  const saveSysMsg = () => updateSettings({ ...settings, systemMessage: sysMsg as any });

  const currentModuleDef = PERMISSION_MODULES.find(m => m.id === selectedModule);

  const selectedRoleConfig = useMemo(() => {
      if (!activeRoleForPerms) return null;
      return settings.roles.find(r => r.name === activeRoleForPerms);
  }, [settings.roles, activeRoleForPerms]);

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
            { id: 'general', label: '🏢 Estrutura', icon: '' },
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
                className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap outline-none focus:ring-2 focus:ring-indigo-200 ${activeTab === tab.id ? 'bg-[#667eea] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                  {tab.label}
              </button>
          ))}
       </div>

       {/* --- CONTENT: GENERAL --- */}
       {activeTab === 'general' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
               {/* Branches Card */}
               <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 flex flex-col">
                   <SectionHeader title="Filiais / Unidades" description="Gerencie as unidades físicas da empresa." />
                   
                   <div className="flex gap-2 mb-6">
                       <div className="relative flex-1">
                           <input 
                            type="text" 
                            disabled={!hasPermission('settings:edit_hierarchy')}
                            value={newBranch} 
                            onChange={e => { setNewBranch(e.target.value); validate('newBranch', e.target.value); }} 
                            onKeyDown={e => e.key === 'Enter' && addBranch()}
                            placeholder="Nova Filial..." 
                            className={`w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${errors.newBranch ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-300'} disabled:bg-gray-100 disabled:text-gray-500`} 
                           />
                           {errors.newBranch && <span className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium">{errors.newBranch}</span>}
                       </div>
                       <button 
                        disabled={!hasPermission('settings:edit_hierarchy')}
                        onClick={addBranch} 
                        className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:bg-indigo-700 shadow-sm transition-transform active:scale-95 h-[42px] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
                        title={!hasPermission('settings:edit_hierarchy') ? "Sem permissão para adicionar" : ""}
                       >
                           {Icons.Plus}
                       </button>
                   </div>
                   
                   <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[300px] p-1">
                       {settings.branches.map(b => (
                           <div key={b} className="bg-white text-gray-700 pl-3 pr-2 py-1.5 rounded-full flex items-center gap-2 text-sm border border-gray-200 shadow-sm hover:border-indigo-300 transition-colors group">
                               <span className="font-medium">{b}</span> 
                               <button 
                                disabled={!hasPermission('settings:edit_hierarchy')}
                                onClick={() => removeBranch(b)} 
                                className="text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-full p-1 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:cursor-not-allowed"
                                title={!hasPermission('settings:edit_hierarchy') ? "Sem permissão para remover" : "Remover"}
                               >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                               </button>
                           </div>
                       ))}
                       {settings.branches.length === 0 && <p className="text-gray-400 italic text-sm w-full text-center py-4">Nenhuma filial cadastrada.</p>}
                   </div>
               </div>

               {/* Sectors Card */}
               <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 flex flex-col">
                   <SectionHeader title="Setores Globais" description="Departamentos disponíveis em todas as filiais." />
                   
                   <div className="flex gap-2 mb-6">
                       <div className="relative flex-1">
                           <input 
                            type="text" 
                            disabled={!hasPermission('settings:edit_hierarchy')}
                            value={newSector} 
                            onChange={e => { setNewSector(e.target.value); validate('newSector', e.target.value); }}
                            onKeyDown={e => e.key === 'Enter' && addSector()}
                            placeholder="Novo Setor..." 
                            className={`w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${errors.newSector ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-300'} disabled:bg-gray-100 disabled:text-gray-500`} 
                           />
                           {errors.newSector && <span className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium">{errors.newSector}</span>}
                       </div>
                       <button 
                        disabled={!hasPermission('settings:edit_hierarchy')}
                        onClick={addSector} 
                        className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:bg-indigo-700 shadow-sm transition-transform active:scale-95 h-[42px] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
                        title={!hasPermission('settings:edit_hierarchy') ? "Sem permissão para adicionar" : ""}
                       >
                           {Icons.Plus}
                       </button>
                   </div>
                   
                   <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[300px] p-1">
                       {settings.sectors.map(s => (
                           <div key={s} className="bg-white text-gray-700 pl-3 pr-2 py-1.5 rounded-full flex items-center gap-2 text-sm border border-gray-200 shadow-sm hover:border-indigo-300 transition-colors group">
                               <span className="font-medium">{s}</span> 
                               <button 
                                disabled={!hasPermission('settings:edit_hierarchy')}
                                onClick={() => removeSector(s)} 
                                className="text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-full p-1 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:cursor-not-allowed"
                                title={!hasPermission('settings:edit_hierarchy') ? "Sem permissão para remover" : "Remover"}
                               >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                               </button>
                           </div>
                       ))}
                       {settings.sectors.length === 0 && <p className="text-gray-400 italic text-sm w-full text-center py-4">Nenhum setor cadastrado.</p>}
                   </div>
               </div>
           </div>
       )}

       {/* --- CONTENT: ROLES --- */}
       {activeTab === 'roles' && (
           <div className="space-y-6 animate-fadeIn">
               <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                   <SectionHeader title="Funções e Cargos" description="Defina os cargos e suas permissões de visibilidade." />
                   
                   <div className="flex flex-col md:flex-row gap-4 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200 items-start">
                       <div className="flex-1 w-full">
                           <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome da Função</label>
                           <input 
                            type="text" 
                            disabled={!hasPermission('settings:manage_access')}
                            value={newRole} 
                            onChange={e => { setNewRole(e.target.value); validate('newRole', e.target.value); }} 
                            placeholder="Ex: Supervisor Logístico" 
                            className={`w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${errors.newRole ? 'border-red-300' : 'border-gray-300'} disabled:bg-gray-100`} 
                           />
                       </div>
                       <div className="w-full md:w-64">
                           <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Espelhar Permissões</label>
                           <select 
                            disabled={!hasPermission('settings:manage_access')}
                            value={newRoleMirrorSource} 
                            onChange={e => setNewRoleMirrorSource(e.target.value)} 
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white disabled:bg-gray-100"
                           >
                               <option value="">(Opcional)</option>
                               {settings.roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                           </select>
                       </div>
                       <div className="mt-auto pt-5">
                            <button 
                                disabled={!hasPermission('settings:manage_access')}
                                onClick={addRole} 
                                className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-sm whitespace-nowrap h-[38px] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Adicionar
                            </button>
                       </div>
                   </div>

                   <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm">
                       <table className="w-full text-sm text-left">
                           <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                               <tr>
                                   <th className="p-4">Função</th>
                                   <th className="p-4 text-center">Modo de Visualização</th>
                                   <th className="p-4 text-right">Ações</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100 bg-white">
                               {settings.roles.map(r => (
                                   <tr key={r.name} className="hover:bg-gray-50 group transition-colors">
                                       <td className="p-4 font-bold text-gray-800">{r.name}</td>
                                       <td className="p-4 text-center">
                                           <div className="flex justify-center">
                                               <button 
                                                disabled={!hasPermission('settings:manage_access')}
                                                onClick={() => toggleRoleViewAll(r.name)} 
                                                className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 transition-all ${
                                                    !hasPermission('settings:manage_access') ? 'opacity-50 cursor-not-allowed' : ''
                                                } ${
                                                    r.canViewAllSectors ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                }`}
                                               >
                                                   <span className={`w-2 h-2 rounded-full ${r.canViewAllSectors ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                                   {r.canViewAllSectors ? 'Irrestrito (Vê Tudo)' : 'Restrito ao Setor'}
                                               </button>
                                           </div>
                                       </td>
                                       <td className="p-4 text-right">
                                           <div className="flex justify-end gap-2 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                                               <IconButton disabled={!hasPermission('settings:manage_access')} onClick={() => openMirrorModal(r.name)} icon={Icons.Copy} colorClass="text-blue-500 hover:bg-blue-50" title="Copiar Permissões de outra função" />
                                               <IconButton disabled={!hasPermission('settings:manage_access')} onClick={() => removeRole(r.name)} icon={Icons.Trash} colorClass="text-red-500 hover:bg-red-50" title="Excluir Função" />
                                           </div>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>

               <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                   <SectionHeader title="Matriz de Acessos" description="Configure o que cada função pode fazer em cada módulo." />
                   <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                       {PERMISSION_MODULES.map(mod => (
                           <button 
                            key={mod.id} 
                            onClick={() => setSelectedModule(mod.id)} 
                            className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border border-gray-200 hover:border-indigo-400 hover:shadow-md transition-all group relative overflow-hidden"
                           >
                               <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 transform -translate-y-full group-hover:translate-y-0 transition-transform"></div>
                               <span className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">{mod.icon}</span>
                               <span className="font-bold text-gray-700 text-sm group-hover:text-indigo-600">{mod.label}</span>
                               <span className="text-[10px] text-gray-400 mt-1 bg-gray-50 px-2 py-0.5 rounded-full group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">Configurar</span>
                           </button>
                       ))}
                   </div>
               </div>
           </div>
       )}

       {/* --- CONTENT: EVENTS --- */}
       {activeTab === 'events' && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 animate-fadeIn">
               <SectionHeader title="Tipos de Eventos" description="Configure os motivos de ausência ou trabalho extra." />
               
               <div className="flex flex-col md:flex-row gap-4 mb-8 p-4 bg-gray-50 rounded-xl border border-gray-200 items-end">
                   <div className="flex-1 w-full">
                       <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome do Evento</label>
                       <input 
                        type="text" 
                        disabled={!hasPermission('settings:edit_event_types')}
                        value={newEventLabel} 
                        onChange={e => { setNewEventLabel(e.target.value); validate('newEventLabel', e.target.value); }} 
                        placeholder="Ex: Licença Paternidade" 
                        className={`w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${errors.newEventLabel ? 'border-red-300' : 'border-gray-300'} disabled:bg-gray-100`} 
                       />
                   </div>
                   <div className="w-full md:w-48">
                       <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Comportamento</label>
                       <select 
                        disabled={!hasPermission('settings:edit_event_types')}
                        value={newEventBehavior} 
                        onChange={e => setNewEventBehavior(e.target.value as any)} 
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white disabled:bg-gray-100"
                       >
                           <option value="neutral">Neutro (Apenas Registro)</option>
                           <option value="debit">Débito (Desconta Dias)</option>
                           <option value="credit_1x">Crédito (Soma 1x)</option>
                           <option value="credit_2x">Crédito (Soma 2x)</option>
                       </select>
                   </div>
                   <button 
                    disabled={!hasPermission('settings:edit_event_types')}
                    onClick={addEventType} 
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-sm h-[38px] disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                       Adicionar
                   </button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Eventos Neutros */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Neutros</h4>
                        </div>
                        <div className="space-y-2">
                            {settings.eventTypes.filter(t => t.behavior === 'neutral').map(t => (
                                <div key={t.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                                    <span className="font-bold text-gray-700 text-sm">{t.label}</span>
                                    {!['ferias','folga','trabalhado'].includes(t.id) && <IconButton disabled={!hasPermission('settings:edit_event_types')} onClick={() => removeEventType(t.id)} icon={Icons.Trash} colorClass="text-red-400 hover:bg-red-50" />}
                                </div>
                            ))}
                            {settings.eventTypes.filter(t => t.behavior === 'neutral').length === 0 && <p className="text-xs text-gray-400 italic text-center py-2">Vazio</p>}
                        </div>
                    </div>

                    {/* Eventos Débitos */}
                    <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-200">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider">Débitos (Ausências)</h4>
                        </div>
                        <div className="space-y-2">
                            {settings.eventTypes.filter(t => t.behavior === 'debit').map(t => (
                                <div key={t.id} className="flex justify-between items-center p-3 border border-red-100 rounded-lg bg-white shadow-sm">
                                    <span className="font-bold text-gray-800 text-sm">{t.label}</span>
                                    {!['ferias','folga','trabalhado'].includes(t.id) && <IconButton disabled={!hasPermission('settings:edit_event_types')} onClick={() => removeEventType(t.id)} icon={Icons.Trash} colorClass="text-red-400 hover:bg-red-50" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Eventos Créditos */}
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Créditos (Extras)</h4>
                        </div>
                        <div className="space-y-2">
                            {settings.eventTypes.filter(t => t.behavior.startsWith('credit')).map(t => (
                                <div key={t.id} className="flex justify-between items-center p-3 border border-emerald-100 rounded-lg bg-white shadow-sm relative overflow-hidden">
                                    <span className="font-bold text-gray-800 text-sm">{t.label}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">{t.behavior === 'credit_2x' ? '2x' : '1x'}</span>
                                        {!['ferias','folga','trabalhado'].includes(t.id) && <IconButton disabled={!hasPermission('settings:edit_event_types')} onClick={() => removeEventType(t.id)} icon={Icons.Trash} colorClass="text-red-400 hover:bg-red-50" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
               </div>
           </div>
       )}

       {/* --- CONTENT: ROTATIONS (ESCALAS) --- */}
       {activeTab === 'rotations' && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 animate-fadeIn">
               <SectionHeader title="Escalas de Revezamento" description="Defina os grupos de escala (Ex: Grupo A, B, C) para cálculo automático de folgas." />
               
               <div className="flex gap-2 mb-8 max-w-lg">
                   <div className="relative flex-1">
                       <input 
                        type="text" 
                        disabled={!hasPermission('settings:edit_rotations')}
                        value={newRotationLabel} 
                        onChange={e => { setNewRotationLabel(e.target.value); validate('newRotationLabel', e.target.value); }}
                        placeholder="Nome da Escala (Ex: Grupo Delta)..." 
                        className={`w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${errors.newRotationLabel ? 'border-red-300' : 'border-gray-300'} disabled:bg-gray-100`} 
                       />
                       {errors.newRotationLabel && <span className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium">{errors.newRotationLabel}</span>}
                   </div>
                   <button 
                    disabled={!hasPermission('settings:edit_rotations')}
                    onClick={addRotation} 
                    className="bg-indigo-600 text-white px-6 rounded-lg font-bold hover:bg-indigo-700 shadow-sm transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                       Adicionar
                   </button>
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                   {(settings.shiftRotations || []).map(r => (
                       <div key={r.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg bg-white shadow-sm hover:border-indigo-300 transition-colors group">
                           <div className="flex items-center gap-2">
                               <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-xs border border-indigo-100">{r.label.charAt(0)}</span>
                               <span className="font-bold text-gray-700 text-sm truncate">{r.label}</span>
                           </div>
                           <button 
                            disabled={!hasPermission('settings:edit_rotations')}
                            onClick={() => removeRotation(r.id)} 
                            className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                           >
                               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                           </button>
                       </div>
                   ))}
                   {(settings.shiftRotations || []).length === 0 && <p className="text-gray-400 text-sm italic col-span-full text-center py-4 border-2 border-dashed border-gray-100 rounded-lg">Nenhuma escala cadastrada.</p>}
               </div>
           </div>
       )}

       {/* --- CONTENT: TEMPLATES (JORNADAS) --- */}
       {activeTab === 'templates' && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 animate-fadeIn">
               <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                   <div>
                       <h3 className="text-lg font-bold text-gray-800">Modelos de Jornada</h3>
                       <p className="text-sm text-gray-500">Crie modelos padrão (Ex: 08:00 as 17:00) para agilizar o cadastro.</p>
                   </div>
                   <button 
                    disabled={!hasPermission('settings:edit_templates')}
                    onClick={openNewTemplate} 
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 text-sm shadow-sm flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                       {Icons.Plus} Novo Modelo
                   </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {(settings.scheduleTemplates || []).map(t => (
                       <div key={t.id} className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-all bg-white group">
                           <div className="flex justify-between items-start mb-3">
                               <div className="flex items-center gap-3">
                                   <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">{Icons.View}</div>
                                   <span className="font-bold text-gray-800">{t.name}</span>
                               </div>
                               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <IconButton disabled={!hasPermission('settings:edit_templates')} onClick={() => openEditTemplate(t)} icon={Icons.Edit} colorClass="text-blue-500 hover:bg-blue-50" />
                                   <IconButton disabled={!hasPermission('settings:edit_templates')} onClick={() => removeTemplate(t.id)} icon={Icons.Trash} colorClass="text-red-500 hover:bg-red-50" />
                               </div>
                           </div>
                           <div className="space-y-1">
                               {daysOrder.filter(d => t.schedule[d].enabled).slice(0, 3).map(d => (
                                   <div key={d} className="text-xs flex justify-between text-gray-500 bg-gray-50 px-2 py-1 rounded">
                                       <span className="capitalize font-medium">{d}</span>
                                       <span>{t.schedule[d].start} - {t.schedule[d].end}</span>
                                   </div>
                               ))}
                               {Object.values(t.schedule).filter(d => d.enabled).length > 3 && (
                                   <div className="text-[10px] text-center text-gray-400 italic pt-1">+ dias restantes</div>
                               )}
                           </div>
                       </div>
                   ))}
                   {(settings.scheduleTemplates || []).length === 0 && <p className="text-center text-gray-400 py-12 col-span-full border-2 border-dashed border-gray-100 rounded-xl">Nenhum modelo cadastrado.</p>}
               </div>
           </div>
       )}

       {/* --- CONTENT: INTEGRATIONS (LINKS) --- */}
       {activeTab === 'integrations' && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 animate-fadeIn">
               <SectionHeader title="Visibilidade entre Filiais" description="Permita que líderes de uma filial visualizem colaboradores de outras unidades." />

               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 h-fit">
                       <label className="text-xs font-bold text-gray-500 uppercase block mb-3">1. Filial Principal (Líder)</label>
                       <select 
                           className="w-full border border-gray-300 rounded-lg p-3 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                           value={selectedBranchForLinks}
                           onChange={e => setSelectedBranchForLinks(e.target.value)}
                       >
                           <option value="">Selecione a Filial...</option>
                           {settings.branches.map(b => <option key={b} value={b}>{b}</option>)}
                       </select>
                       <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                           Selecione a filial cujos líderes precisam acessar dados de outras unidades.
                       </p>
                   </div>

                   {selectedBranchForLinks && (
                       <div className="md:col-span-2 bg-white p-6 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
                           <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                           <label className="text-xs font-bold text-gray-500 uppercase block mb-4">2. Marque as filiais visíveis para: <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{selectedBranchForLinks}</span></label>
                           
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                               {settings.branches.filter(b => b !== selectedBranchForLinks).map(b => {
                                   const isLinked = settings.branchLinks?.[selectedBranchForLinks]?.includes(b);
                                   const canEdit = hasPermission('settings:edit_integrations');
                                   
                                   return (
                                       <label key={b} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isLinked ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'hover:bg-gray-50 border-gray-200'} ${!canEdit ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                           <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isLinked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>
                                               {isLinked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                           </div>
                                           <input 
                                               type="checkbox" 
                                               checked={!!isLinked}
                                               onChange={() => canEdit && toggleBranchLink(b)}
                                               disabled={!canEdit}
                                               className="hidden"
                                           />
                                           <span className={`text-sm ${isLinked ? 'font-bold text-indigo-900' : 'text-gray-700'}`}>{b}</span>
                                       </label>
                                   );
                               })}
                           </div>
                           {settings.branches.length <= 1 && <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-lg text-center">Cadastre mais filiais na aba "Estrutura" para configurar integrações.</p>}
                       </div>
                   )}
                   {!selectedBranchForLinks && (
                       <div className="md:col-span-2 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-gray-400 p-10">
                           <span className="text-4xl mb-2 opacity-30">🔗</span>
                           <p>Selecione uma filial à esquerda para começar.</p>
                       </div>
                   )}
               </div>
           </div>
       )}

       {/* --- CONTENT: SEASONAL --- */}
       {activeTab === 'seasonal' && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 animate-fadeIn">
               <SectionHeader title="Eventos Sazonais" description="Períodos especiais (Ex: Natal, Black Friday) que aparecem destacados no calendário." />
               
               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8 p-5 bg-gray-50 rounded-xl border border-gray-200 items-end">
                   <div className="md:col-span-4">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome do Evento</label>
                        <input 
                            type="text" 
                            disabled={!hasPermission('settings:edit_seasonal')}
                            value={newSeasonal.label} 
                            onChange={e => { setNewSeasonal({...newSeasonal, label: e.target.value}); validate('seasonalLabel', e.target.value); }} 
                            className={`w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${errors.seasonalLabel ? 'border-red-300' : 'border-gray-300'} disabled:bg-gray-100`} 
                            placeholder="Ex: Black Friday" 
                        />
                   </div>
                   <div className="md:col-span-3">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Início</label>
                        <input 
                            type="date" 
                            disabled={!hasPermission('settings:edit_seasonal')}
                            value={newSeasonal.startDate} 
                            onChange={e => setNewSeasonal({...newSeasonal, startDate: e.target.value})} 
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm disabled:bg-gray-100" 
                        />
                   </div>
                   <div className="md:col-span-3">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Fim</label>
                        <input 
                            type="date" 
                            disabled={!hasPermission('settings:edit_seasonal')}
                            value={newSeasonal.endDate} 
                            onChange={e => setNewSeasonal({...newSeasonal, endDate: e.target.value})} 
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm disabled:bg-gray-100" 
                        />
                   </div>
                   <div className="md:col-span-1">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Cor</label>
                        <input 
                            type="color" 
                            disabled={!hasPermission('settings:edit_seasonal')}
                            value={newSeasonal.color} 
                            onChange={e => setNewSeasonal({...newSeasonal, color: e.target.value})} 
                            className="h-[38px] w-full border border-gray-300 rounded-lg p-1 bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" 
                        />
                   </div>
                   <div className="md:col-span-1">
                        <button 
                            disabled={!hasPermission('settings:edit_seasonal')}
                            onClick={addSeasonal} 
                            className="w-full bg-indigo-600 text-white h-[38px] rounded-lg font-bold hover:bg-indigo-700 shadow-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {Icons.Plus}
                        </button>
                   </div>
               </div>

               <div className="space-y-3">
                   {(settings.seasonalEvents || []).map(s => (
                       <div key={s.id} className="flex justify-between items-center p-4 border rounded-xl hover:shadow-md transition-all bg-white group" style={{ borderColor: s.color, borderLeftWidth: '6px' }}>
                           <div>
                               <div className="font-bold text-gray-800 text-lg">{s.label}</div>
                               <div className="text-xs text-gray-500 font-medium flex gap-2 mt-1">
                                   <span className="bg-gray-100 px-2 py-0.5 rounded">📅 {new Date(s.startDate).toLocaleDateString()}</span>
                                   <span className="text-gray-400">até</span>
                                   <span className="bg-gray-100 px-2 py-0.5 rounded">📅 {new Date(s.endDate).toLocaleDateString()}</span>
                               </div>
                           </div>
                           <IconButton disabled={!hasPermission('settings:edit_seasonal')} onClick={() => removeSeasonal(s.id)} icon={Icons.Trash} colorClass="text-red-400 hover:bg-red-50" />
                       </div>
                   ))}
                   {(settings.seasonalEvents || []).length === 0 && <p className="text-center text-gray-400 py-8 italic border-2 border-dashed border-gray-100 rounded-xl">Nenhum evento sazonal.</p>}
               </div>
           </div>
       )}

       {/* --- CONTENT: SYSTEM MSG --- */}
       {activeTab === 'system' && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
               <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 flex flex-col h-full">
                   <SectionHeader title="Configuração do Aviso" description="Exibe uma mensagem importante no topo de todas as páginas." />
                   
                   <div className="space-y-6 flex-1">
                       <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                           <span className="font-bold text-gray-700">Ativar Banner</span>
                           <Switch 
                            disabled={!hasPermission('settings:manage_system_msg')}
                            checked={sysMsg.active} 
                            onChange={c => setSysMsg({...sysMsg, active: c})} 
                           />
                       </div>

                       <div>
                           <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nível de Urgência</label>
                           <div className="grid grid-cols-3 gap-3">
                               {['info', 'warning', 'error'].map((lvl) => (
                                   <button 
                                    key={lvl}
                                    disabled={!hasPermission('settings:manage_system_msg')}
                                    onClick={() => setSysMsg({...sysMsg, level: lvl as any})}
                                    className={`py-2 rounded-lg text-sm font-bold border transition-all ${sysMsg.level === lvl ? (lvl === 'error' ? 'bg-red-50 border-red-500 text-red-700' : lvl === 'warning' ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-blue-50 border-blue-500 text-blue-700') : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                   >
                                       {lvl === 'error' ? 'Crítico' : lvl === 'warning' ? 'Alerta' : 'Informativo'}
                                   </button>
                               ))}
                           </div>
                       </div>

                       <div>
                           <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Mensagem</label>
                           <textarea 
                            rows={5} 
                            disabled={!hasPermission('settings:manage_system_msg')}
                            value={sysMsg.message} 
                            onChange={e => setSysMsg({...sysMsg, message: e.target.value})} 
                            className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm leading-relaxed disabled:bg-gray-100" 
                            placeholder="Digite o comunicado aqui..." 
                           />
                       </div>

                       <div className="mt-auto pt-4">
                           <button 
                            disabled={!hasPermission('settings:manage_system_msg')}
                            onClick={saveSysMsg} 
                            className="w-full bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-emerald-700 shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                               Salvar e Publicar
                           </button>
                       </div>
                   </div>
               </div>

               <div className="flex flex-col">
                   <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 flex-1">
                       <SectionHeader title="Pré-visualização em Tempo Real" description="Como o usuário verá o aviso." />
                       
                       <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-xl border-2 border-dashed border-gray-200 p-8 min-h-[300px]">
                           {sysMsg.active ? (
                               <div className={`w-full rounded-lg p-4 shadow-lg flex items-start ${
                                   sysMsg.level === 'error' ? 'bg-red-600 text-white' :
                                   sysMsg.level === 'warning' ? 'bg-amber-600 text-white' :
                                   'bg-blue-600 text-white'
                                 }`}>
                                    <div className="flex gap-3 w-full">
                                       <div className="mt-0.5 text-2xl">
                                         {sysMsg.level === 'error' ? '🚨' : 
                                          sysMsg.level === 'warning' ? '⚠️' : 'ℹ️'}
                                       </div>
                                       <div>
                                           <h3 className="font-bold uppercase text-sm mb-1 tracking-wide">
                                             {sysMsg.level === 'error' ? 'MANUTENÇÃO / ERRO CRÍTICO' : 
                                              sysMsg.level === 'warning' ? 'ATENÇÃO NECESSÁRIA' : 'COMUNICADO'}
                                           </h3>
                                           <p className="text-sm whitespace-pre-wrap leading-relaxed opacity-95 font-medium">
                                               {sysMsg.message || "(Sua mensagem aparecerá aqui)"}
                                           </p>
                                       </div>
                                    </div>
                                 </div>
                           ) : (
                               <div className="text-center opacity-50">
                                   <div className="text-4xl mb-2">👻</div>
                                   <p className="font-bold text-gray-500">O banner está desativado.</p>
                                   <p className="text-xs text-gray-400">Ative para ver o preview.</p>
                               </div>
                           )}
                       </div>
                   </div>
               </div>
           </div>
       )}

       {/* MODALS */}
       
       {/* 1. PERMISSIONS MODAL (MASTER-DETAIL LAYOUT + MATRIX SPLIT) */}
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

                        {/* RIGHT CONTENT: PERMISSIONS MATRIX */}
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

                                    {(() => {
                                        // SPLIT ACTIONS LOGIC
                                        const viewActions = currentModuleDef.actions.filter(a => a.type === 'view');
                                        const manageActions = currentModuleDef.actions.filter(a => a.type !== 'view');
                                        
                                        const renderActionGrid = (actions: typeof viewActions) => (
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                {actions.map(action => {
                                                    const isChecked = selectedRoleConfig.permissions.includes(action.id);
                                                    
                                                    // Determine icon and color based on action type
                                                    let IconComp = Icons.Special;
                                                    let iconBg = 'bg-gray-100 text-gray-500';
                                                    
                                                    if (action.type === 'view') { IconComp = Icons.View; iconBg = 'bg-blue-100 text-blue-600'; }
                                                    if (action.type === 'create') { IconComp = Icons.Create; iconBg = 'bg-green-100 text-green-600'; }
                                                    if (action.type === 'update') { IconComp = Icons.Update; iconBg = 'bg-amber-100 text-amber-600'; }
                                                    if (action.type === 'delete') { IconComp = Icons.Delete; iconBg = 'bg-red-100 text-red-600'; }

                                                    const canEditPerms = hasPermission('settings:manage_access'); // Only Admin/Access Manager can toggle

                                                    return (
                                                        <div 
                                                            key={action.id} 
                                                            onClick={() => canEditPerms && togglePermission(selectedRoleConfig.name, action.id)}
                                                            className={`
                                                                bg-white p-4 rounded-xl border transition-all shadow-sm group flex items-center justify-between
                                                                ${canEditPerms ? 'cursor-pointer hover:shadow-md hover:border-gray-300' : 'cursor-not-allowed opacity-80'}
                                                                ${isChecked ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-gray-200'}
                                                            `}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${isChecked ? 'shadow-sm' : 'opacity-70 grayscale'}`}>
                                                                    {IconComp}
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
                                        );

                                        return (
                                            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-8">
                                                {/* Header Info */}
                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-4">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                                            {currentModuleDef.icon} {currentModuleDef.label}
                                                        </h3>
                                                        <p className="text-sm text-gray-500 mt-1">{currentModuleDef.description}</p>
                                                    </div>
                                                    <button 
                                                        disabled={!hasPermission('settings:manage_access')}
                                                        onClick={() => {
                                                            const moduleActionIds = currentModuleDef.actions.map(a => a.id);
                                                            toggleAllModulePermissionsForRole(selectedRoleConfig.name, moduleActionIds);
                                                        }}
                                                        className="text-xs font-bold bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-50 shadow-sm transition-colors uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {currentModuleDef.actions.every(a => selectedRoleConfig.permissions.includes(a.id)) ? 'Desmarcar Todos' : 'Habilitar Todos'}
                                                    </button>
                                                </div>

                                                {/* VIEW SECTION */}
                                                {viewActions.length > 0 && (
                                                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                                        <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                            Permissões de Visualização (View)
                                                        </h4>
                                                        {renderActionGrid(viewActions)}
                                                    </div>
                                                )}

                                                {/* ACTION SECTION */}
                                                {manageActions.length > 0 && (
                                                    <div className="bg-gray-100/50 p-4 rounded-xl border border-gray-200">
                                                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                            Permissões de Ação (Gestão)
                                                        </h4>
                                                        {renderActionGrid(manageActions)}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
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
               <select 
                value={mirrorSourceRole} 
                onChange={e => setMirrorSourceRole(e.target.value)} 
                className="w-full border p-2 rounded disabled:bg-gray-100"
                disabled={!hasPermission('settings:manage_access')}
               >
                   <option value="">Copiar de...</option>{settings.roles.filter(r => r.name !== mirrorTargetRole).map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
               <div className="flex justify-end gap-2">
                   <button onClick={() => setIsMirrorModalOpen(false)} className="px-4 py-2">Cancelar</button>
                   <button 
                    onClick={executeMirroring} 
                    className="bg-indigo-600 text-white px-4 py-2 rounded font-bold disabled:opacity-50"
                    disabled={!hasPermission('settings:manage_access')}
                   >
                       Confirmar
                   </button>
               </div>
           </div>
       </Modal>

       {/* 3. TEMPLATE EDIT MODAL */}
       <Modal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} title={editingTemplateId ? "Editar Modelo" : "Novo Modelo"} maxWidth="max-w-4xl">
           <div className="space-y-6">
               <div>
                   <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome do Modelo</label>
                   <input 
                    type="text" 
                    value={tempTemplateName} 
                    onChange={e => setTempTemplateName(e.target.value)} 
                    className="w-full border border-gray-300 rounded-lg p-2" 
                    placeholder="Ex: Comercial 08 as 18" 
                    disabled={!hasPermission('settings:edit_templates')}
                   />
               </div>
               <div className="space-y-2">
                   {daysOrder.map(day => (
                       <div key={day} className="flex flex-col md:flex-row md:items-center gap-4 p-2 bg-gray-50 rounded border border-gray-100">
                           <div className="w-24 font-bold capitalize text-sm flex items-center gap-2">
                               <input 
                                type="checkbox" 
                                checked={tempSchedule[day].enabled} 
                                onChange={e => handleTempScheduleChange(day, 'enabled', e.target.checked)} 
                                disabled={!hasPermission('settings:edit_templates')}
                               />
                               {day}
                           </div>
                           <div className={`flex items-center gap-2 flex-1 ${!tempSchedule[day].enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                               <input 
                                type="time" 
                                value={tempSchedule[day].start} 
                                onChange={e => handleTempScheduleChange(day, 'start', e.target.value)} 
                                className="border rounded px-2 py-1 text-sm disabled:bg-gray-100" 
                                disabled={!hasPermission('settings:edit_templates')}
                               />
                               <span className="text-xs text-gray-400">até</span>
                               <input 
                                type="time" 
                                value={tempSchedule[day].end} 
                                onChange={e => handleTempScheduleChange(day, 'end', e.target.value)} 
                                className="border rounded px-2 py-1 text-sm disabled:bg-gray-100" 
                                disabled={!hasPermission('settings:edit_templates')}
                               />
                               <label className="flex items-center gap-1 ml-4 text-xs">
                                   <input 
                                    type="checkbox" 
                                    checked={tempSchedule[day].startsPreviousDay} 
                                    onChange={e => handleTempScheduleChange(day, 'startsPreviousDay', e.target.checked)} 
                                    disabled={!hasPermission('settings:edit_templates')}
                                   /> Inicia dia anterior
                                </label>
                           </div>
                       </div>
                   ))}
               </div>
               <div className="flex justify-end gap-3 pt-4 border-t">
                   <button onClick={() => setIsTemplateModalOpen(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
                   <button 
                    onClick={saveTemplate} 
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!hasPermission('settings:edit_templates')}
                   >
                       Salvar Modelo
                   </button>
               </div>
           </div>
       </Modal>
    </div>
  );
};
