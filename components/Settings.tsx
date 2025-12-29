import React, { useState, useMemo, useEffect } from 'react';
import { SystemSettings, RoleConfig, EventTypeConfig, SeasonalEvent, PERMISSION_MODULES, ScheduleTemplate, Schedule, RotationRule, DaySchedule } from '../types';
import { generateUUID } from '../utils/helpers';
import { Modal } from './ui/Modal';
import { MultiSelect } from './ui/MultiSelect';

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

// --- CONFIGURAÇÃO DAS ABAS (COM PERMISSÕES MÚLTIPLAS) ---
const SETTINGS_TABS = [
  { id: 'general', label: '🏢 Estrutura', reqPerms: ['settings:view_branches', 'settings:view_sectors'] },
  { id: 'roles', label: '👥 Funções', reqPerms: ['settings:view_roles_list', 'settings:view_permissions_matrix'] },
  { id: 'events', label: '📅 Eventos', reqPerms: ['settings:view_event_types'] },
  { id: 'rotations', label: '🔄 Escalas', reqPerms: ['settings:view_rotations'] },
  { id: 'templates', label: '⏰ Jornadas', reqPerms: ['settings:view_templates'] },
  { id: 'integrations', label: '🔗 Integrações', reqPerms: ['settings:view_integrations'] },
  { id: 'seasonal', label: '🎉 Sazonais', reqPerms: ['settings:view_seasonal'] },
  { id: 'system', label: '📢 Avisos', reqPerms: ['settings:view_system_msg'] },
];

export const Settings: React.FC<SettingsProps> = ({ settings, setSettings, showToast, hasPermission }) => {
  const [activeTab, setActiveTab] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // --- GENERAL STATES ---
  const [newBranch, setNewBranch] = useState('');
  const [newSector, setNewSector] = useState('');
  const [escalationDelay, setEscalationDelay] = useState(settings.approvalEscalationDelay || 0);
  
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
  const [selectedAllowedSectors, setSelectedAllowedSectors] = useState<string[]>(settings.sectorsWithEventTypeSelection || []);

  // --- ROTATIONS STATES ---
  const [newRotationLabel, setNewRotationLabel] = useState('');

  // --- TEMPLATES STATES ---
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tempTemplateName, setTempTemplateName] = useState('');
  const [tempSchedule, setTempSchedule] = useState<Schedule>(initialSchedule);
  const [tempTemplateBranches, setTempTemplateBranches] = useState<string[]>([]); // New state for branches

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

  // Filter Tabs based on Permissions (Show if has AT LEAST ONE of the required perms)
  const allowedTabs = useMemo(() => {
      return SETTINGS_TABS.filter(tab => tab.reqPerms.some(perm => hasPermission(perm)));
  }, [hasPermission]);

  // Set initial active tab
  useEffect(() => {
      if (allowedTabs.length > 0 && !allowedTabs.find(t => t.id === activeTab)) {
          setActiveTab(allowedTabs[0].id);
      }
  }, [allowedTabs, activeTab]);

  useEffect(() => {
      setSelectedAllowedSectors(settings.sectorsWithEventTypeSelection || []);
  }, [settings.sectorsWithEventTypeSelection]);

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
  const saveEscalationDelay = () => {
      updateSettings({ ...settings, approvalEscalationDelay: escalationDelay });
  };

  // Re-declare Handlers for missing context in XML replacement
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
    setNewRole(''); setNewRoleMirrorSource('');
  };
  const removeRole = (roleName: string) => { if (window.confirm(`Remover função ${roleName}?`)) updateSettings({ ...settings, roles: settings.roles.filter(r => r.name !== roleName) }); };
  const toggleRoleViewAll = (roleName: string) => { const updatedRoles = settings.roles.map(r => r.name === roleName ? { ...r, canViewAllSectors: !r.canViewAllSectors } : r); updateSettings({ ...settings, roles: updatedRoles }); };
  const openMirrorModal = (targetRole: string) => { setMirrorTargetRole(targetRole); setMirrorSourceRole(''); setIsMirrorModalOpen(true); };
  const executeMirroring = () => { if (!mirrorTargetRole || !mirrorSourceRole) return; const sourceRoleConfig = settings.roles.find(r => r.name === mirrorSourceRole); if (!sourceRoleConfig) return; const updatedRoles = settings.roles.map(r => r.name === mirrorTargetRole ? { ...r, permissions: [...sourceRoleConfig.permissions], canViewAllSectors: sourceRoleConfig.canViewAllSectors } : r); updateSettings({ ...settings, roles: updatedRoles }); setIsMirrorModalOpen(false); showToast(`Permissões copiadas!`); };
  const togglePermission = (roleName: string, permissionId: string) => { const updatedRoles = settings.roles.map(r => { if (r.name !== roleName) return r; const hasPerm = r.permissions.includes(permissionId); return { ...r, permissions: hasPerm ? r.permissions.filter(p => p !== permissionId) : [...r.permissions, permissionId] }; }); updateSettings({ ...settings, roles: updatedRoles }); };
  const toggleAllModulePermissionsForRole = (roleName: string, moduleActionIds: string[]) => { const role = settings.roles.find(r => r.name === roleName); if (!role) return; const rolePerms = new Set(role.permissions); const allEnabled = moduleActionIds.every(id => rolePerms.has(id)); if (allEnabled) { moduleActionIds.forEach(id => rolePerms.delete(id)); } else { moduleActionIds.forEach(id => rolePerms.add(id)); } const updatedRoles = settings.roles.map(r => r.name === roleName ? { ...r, permissions: Array.from(rolePerms) } : r); updateSettings({ ...settings, roles: updatedRoles }); };
  const addEventType = () => { if (!validate('newEventLabel', newEventLabel)) return; const id = newEventLabel.toLowerCase().replace(/\s+/g, '_'); if (settings.eventTypes.some(t => t.id === id)) { showToast('Já existe.', true); return; } updateSettings({ ...settings, eventTypes: [...settings.eventTypes, { id, label: newEventLabel.trim(), behavior: newEventBehavior }] }); setNewEventLabel(''); };
  const removeEventType = (id: string) => { if (['ferias', 'folga', 'trabalhado'].includes(id)) return; if (window.confirm('Remover?')) updateSettings({ ...settings, eventTypes: settings.eventTypes.filter(t => t.id !== id) }); };
  const addRotation = () => { if (!validate('newRotationLabel', newRotationLabel)) return; const id = newRotationLabel.trim().toUpperCase().replace(/\s+/g, '_'); if (settings.shiftRotations?.some(r => r.id === id)) { showToast('Escala já existe.', true); return; } const newRot: RotationRule = { id, label: newRotationLabel.trim() }; updateSettings({ ...settings, shiftRotations: [...(settings.shiftRotations || []), newRot] }); setNewRotationLabel(''); };
  const removeRotation = (id: string) => { if (window.confirm('Remover escala?')) updateSettings({ ...settings, shiftRotations: (settings.shiftRotations || []).filter(r => r.id !== id) }); };
  
  const openNewTemplate = () => { 
      setEditingTemplateId(null); 
      setTempTemplateName(''); 
      setTempSchedule(JSON.parse(JSON.stringify(initialSchedule))); 
      setTempTemplateBranches([]); // Init branches
      setIsTemplateModalOpen(true); 
  };
  
  const openEditTemplate = (tpl: ScheduleTemplate) => { 
      setEditingTemplateId(tpl.id); 
      setTempTemplateName(tpl.name); 
      setTempSchedule(JSON.parse(JSON.stringify(tpl.schedule))); 
      setTempTemplateBranches(tpl.branches || []); // Load branches
      setIsTemplateModalOpen(true); 
  };
  
  const saveTemplate = () => { 
      if (!tempTemplateName.trim()) { showToast('Nome obrigatório', true); return; } 
      if (tempTemplateBranches.length === 0) { showToast('Selecione pelo menos uma filial.', true); return; }

      const newTpl: ScheduleTemplate = { 
          id: editingTemplateId || generateUUID(), 
          name: tempTemplateName, 
          schedule: tempSchedule,
          branches: tempTemplateBranches
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
  
  const removeTemplate = (id: string) => { if (window.confirm('Excluir modelo?')) updateSettings({ ...settings, scheduleTemplates: (settings.scheduleTemplates || []).filter(t => t.id !== id) }); };
  const handleTempScheduleChange = (day: keyof Schedule, field: string, val: any) => { setTempSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } })); };
  const toggleBranchLink = (targetBranch: string) => { if (!selectedBranchForLinks) return; const currentLinks = settings.branchLinks?.[selectedBranchForLinks] || []; let newLinks; if (currentLinks.includes(targetBranch)) newLinks = currentLinks.filter(b => b !== targetBranch); else newLinks = [...currentLinks, targetBranch]; updateSettings({ ...settings, branchLinks: { ...settings.branchLinks, [selectedBranchForLinks]: newLinks } }); };
  const addSeasonal = () => { if (!validate('seasonalLabel', newSeasonal.label || '') || !newSeasonal.startDate || !newSeasonal.endDate) { showToast('Preencha todos os campos.', true); return; } const newItem: SeasonalEvent = { id: generateUUID(), label: newSeasonal.label!, startDate: newSeasonal.startDate!, endDate: newSeasonal.endDate!, color: newSeasonal.color || '#3B82F6', active: true }; updateSettings({ ...settings, seasonalEvents: [...(settings.seasonalEvents || []), newItem] }); setNewSeasonal({ label: '', startDate: '', endDate: '', color: '#3B82F6', active: true }); };
  const removeSeasonal = (id: string) => updateSettings({ ...settings, seasonalEvents: (settings.seasonalEvents || []).filter(s => s.id !== id) });
  const saveSysMsg = () => updateSettings({ ...settings, systemMessage: sysMsg as any });
  
  // Handler for Sectors with Event Selection
  const updateAllowedSectors = (newSelected: string[]) => {
      setSelectedAllowedSectors(newSelected);
      updateSettings({ ...settings, sectorsWithEventTypeSelection: newSelected });
  };

  const currentModuleDef = PERMISSION_MODULES.find(m => m.id === selectedModule);
  const selectedRoleConfig = useMemo(() => { if (!activeRoleForPerms) return null; return settings.roles.find(r => r.name