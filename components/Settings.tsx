import React, { useState, useEffect, useMemo } from 'react';
import { SystemSettings, EventTypeConfig, EventBehavior, Schedule, ScheduleTemplate, RoleConfig, SYSTEM_PERMISSIONS, AccessProfileConfig, RotationRule, PERMISSION_MODULES, SeasonalEvent } from '../types';
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

// Cores predefinidas para eventos sazonais
const SEASONAL_COLORS = [
  { label: 'Preto (Black Friday)', value: '#000000' },
  { label: 'Vermelho (Natal)', value: '#EF4444' },
  { label: 'Dourado (Ano Novo)', value: '#EAB308' },
  { label: 'Azul', value: '#3B82F6' },
  { label: 'Roxo', value: '#A855F7' },
  { label: 'Verde', value: '#22C55E' },
  { label: 'Laranja', value: '#F97316' },
];

export const Settings: React.FC<SettingsProps> = ({ settings, setSettings, showToast, hasPermission }) => {
  // --- GRANULAR PERMISSIONS ---
  const canManageIntegrations = hasPermission('settings:manage_integrations');
  const canManageSeasonal = hasPermission('settings:manage_seasonal');
  const canManageHierarchy = hasPermission('settings:manage_hierarchy');
  const canManageEventTypes = hasPermission('settings:manage_event_types');
  const canCreateTemplate = hasPermission('settings:create_template');
  const canViewTemplates = hasPermission('settings:view_templates');
  const canManageRotations = hasPermission('settings:manage_rotations');

  // The 'Geral' tab is visible if ANY of the sub-sections are permitted
  const showGeral = canManageIntegrations || canManageSeasonal || canManageHierarchy || canManageEventTypes || canCreateTemplate || canViewTemplates || canManageRotations;
  
  const showAcesso = hasPermission('settings:manage_access');
  const showSistema = hasPermission('settings:manage_system_msg'); 

  // Define a aba ativa inicial baseada na primeira permissão disponível
  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'acesso' | 'sistema'>(() => {
    if (showGeral) return 'geral';
    if (showAcesso) return 'acesso';
    if (showSistema) return 'sistema';
    return 'geral'; // Fallback
  });

  const [spreadsheetUrl, setSpreadsheetUrl] = useState(settings.spreadsheetUrl || '');

  // --- HIERARCHY STATE ---
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newSectorName, setNewSectorName] = useState('');

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventBehavior, setNewEventBehavior] = useState<EventBehavior>('neutral');
  
  // Seasonal Events State
  const [seasonLabel, setSeasonLabel] = useState('');
  const [seasonStart, setSeasonStart] = useState('');
  const [seasonEnd, setSeasonEnd] = useState('');
  const [seasonColor, setSeasonColor] = useState(SEASONAL_COLORS[0].value);

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

  // Inicializar seleção
  useEffect(() => {
     // Se não tiver empresa selecionada, tenta selecionar a primeira
     if (settings.companies && settings.companies.length > 0 && !selectedCompany) {
         setSelectedCompany(settings.companies[0]);
     }
  }, [settings.companies]);

  // Derived state for Orphaned Branches (Branches not assigned to any company)
  const orphanedBranches = useMemo(() => {
      const allLinked = Object.values(settings.companyBranches || {}).flat();
      return settings.branches.filter(b => !allLinked.includes(b));
  }, [settings.branches, settings.companyBranches]);

  // Derived branches for current selection
  const currentBranchesList = useMemo(() => {
      if (!selectedCompany) return [];
      if (selectedCompany === 'Sem Empresa') return orphanedBranches;
      return settings.companyBranches?.[selectedCompany] || [];
  }, [selectedCompany, settings.companyBranches, orphanedBranches]);

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

  // --- HIERARCHY LOGIC (Companies -> Branches -> Sectors) ---

  const addCompany = () => {
      if (!newCompanyName.trim()) return;
      if (settings.companies?.includes(newCompanyName.trim())) {
          showToast('Empresa já existe.', true);
          return;
      }
      const updatedCompanies = [...(settings.companies || []), newCompanyName.trim()];
      const updatedCompanyBranches = { ...(settings.companyBranches || {}), [newCompanyName.trim()]: [] };
      
      saveSettings({ ...settings, companies: updatedCompanies, companyBranches: updatedCompanyBranches }, 'company', () => {
          setNewCompanyName('');
          setSelectedCompany(newCompanyName.trim());
      });
  };

  const removeCompany = (company: string) => {
      if (company === 'Sem Empresa') return;
      if (window.confirm(`Excluir empresa "${company}"? As filiais vinculadas ficarão "Sem Empresa".`)) {
          const updatedCompanies = (settings.companies || []).filter(c => c !== company);
          const updatedCompanyBranches = { ...(settings.companyBranches || {}) };
          delete updatedCompanyBranches[company];
          
          saveSettings({ ...settings, companies: updatedCompanies, companyBranches: updatedCompanyBranches }, 'company', () => {
              setSelectedCompany(null);
          });
      }
  };

  const addBranch = () => {
     if (!newBranchName.trim()) return;
     if (settings.branches.includes(newBranchName)) {
        showToast('Filial já existe (verifique se já está em outra empresa).', true);
        return;
     }
     
     if (!selectedCompany) {
         showToast('Selecione uma empresa antes de adicionar a filial.', true);
         return;
     }

     const updatedBranches = [...settings.branches, newBranchName];
     // Initialize sectors for new branch
     const updatedBranchSectors = { ...(settings.branchSectors || {}), [newBranchName]: [] };
     
     // Link to Company
     let updatedCompanyBranches = { ...(settings.companyBranches || {}) };
     if (selectedCompany !== 'Sem Empresa') {
         const existing = updatedCompanyBranches[selectedCompany] || [];
         updatedCompanyBranches[selectedCompany] = [...existing, newBranchName];
     }
     
     saveSettings({ ...settings, branches: updatedBranches, branchSectors: updatedBranchSectors, companyBranches: updatedCompanyBranches }, 'branch', () => {
         setNewBranchName('');
         setSelectedBranch(newBranchName);
     });
  };

  const removeBranch = (branch: string) => {
     if (window.confirm(`Tem certeza que deseja excluir a filial "${branch}" e todos seus setores?`)) {
        const updatedBranches = settings.branches.filter(b => b !== branch);
        const updatedBranchSectors = { ...(settings.branchSectors || {}) };
        delete updatedBranchSectors[branch];
        
        // Remove links
        const updatedBranchLinks = { ...(settings.branchLinks || {}) };
        delete updatedBranchLinks[branch];
        
        // Remove from Companies
        let updatedCompanyBranches = { ...(settings.companyBranches || {}) };
        Object.keys(updatedCompanyBranches).forEach(comp => {
            updatedCompanyBranches[comp] = updatedCompanyBranches[comp].filter(b => b !== branch);
        });

        saveSettings({ ...settings, branches: updatedBranches, branchSectors: updatedBranchSectors, branchLinks: updatedBranchLinks, companyBranches: updatedCompanyBranches }, 'branch', () => {
            if (selectedBranch === branch) setSelectedBranch(null);
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

  const toggleBranchLink = (targetBranch: string) => {
      if (!selectedBranch) return;
      
      const currentLinks = settings.branchLinks?.[selectedBranch] || [];
      let updatedLinks = [];
      
      if (currentLinks.includes(targetBranch)) {
          updatedLinks = currentLinks.filter(b => b !== targetBranch);
      } else {
          updatedLinks = [...currentLinks, targetBranch];
      }
      
      const updatedBranchLinks = { 
          ...(settings.branchLinks || {}), 
          [selectedBranch]: updatedLinks 
      };
      
      saveSettings({ ...settings, branchLinks: updatedBranchLinks }, 'branch_link');
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

     let currentPerms = role.permissions || [];
     const legacyPrefixes = ['tab:', 'write:', 'view:phones'];
     currentPerms = currentPerms.filter(p => {
       if (p === permId) return true;
       if (legacyPrefixes.some(prefix => p.startsWith(prefix))) return false;
       return true;
     });

     if (currentPerms.includes(permId)) {
       currentPerms = currentPerms.filter(p => p !== permId);
     } else {
       currentPerms = [...currentPerms, permId];
     }
     
     const updatedRoles = settings.roles.map(r => r.name === roleName ? { ...r, permissions: currentPerms } : r);
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

  // --- SEASONAL EVENTS LOGIC ---
  const saveSeasonalEvent = () => {
      if (!seasonLabel.trim() || !seasonStart || !seasonEnd) {
          showToast('Preencha nome, início e fim do evento.', true);
          return;
      }
      if (seasonStart > seasonEnd) {
          showToast('Data final deve ser maior que data inicial.', true);
          return;
      }

      const newEvent: SeasonalEvent = {
          id: generateUUID(),
          label: seasonLabel.trim(),
          startDate: seasonStart,
          endDate: seasonEnd,
          color: seasonColor,
          active: true
      };

      saveSettings({ ...settings, seasonalEvents: [...(settings.seasonalEvents || []), newEvent] }, 'seasonal', () => {
          setSeasonLabel('');
          setSeasonStart('');
          setSeasonEnd('');
          setSeasonColor(SEASONAL_COLORS[0].value);
      });
  };

  const removeSeasonalEvent = (id: string) => {
      if (window.confirm('Excluir evento sazonal?')) {
          saveSettings({ ...settings, seasonalEvents: (settings.seasonalEvents || []).filter(s => s.id !== id) }, 'seasonal');
      }
  };

  const toggleSeasonalEvent = (id: string) => {
      const updated = (settings.seasonalEvents || []).map(s => s.id === id ? { ...s, active: !s.active } : s);
      saveSettings({ ...settings, seasonalEvents: updated }, 'seasonal');
  };

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

  const groupedEvents = useMemo(() => {
      const neutros = settings.eventTypes.filter(e => e.behavior === 'neutral');
      const debitos = settings.eventTypes.filter(e => e.behavior === 'debit');
      const creditos = settings.eventTypes.filter(e => e.behavior === 'credit_1x' || e.behavior === 'credit_2x');
      return { neutros, debitos, creditos };
  }, [settings.eventTypes]);

  const renderEventList = (events: EventTypeConfig[], emptyText: string) => {
      if (events.length === 0) return <p className="text-gray-400 text-xs italic p-2">{emptyText}</p>;
      
      return events.map(e => (
          <div key={e.id} className={`flex justify-between items-center p-2 border-b last:border-0 bg-white rounded mb-1 transition-colors ${editingEventId === e.id ? 'bg-indigo-50 border-indigo-200' : 'border-gray-100'}`}>
              <div className="flex flex-col">
                  <span className="font-bold text-sm text-gray-700">{e.label}</span>
                  <span className="text-[10px] text-gray-400">{e.behavior === 'credit_2x' ? 'Crédito (2x)' : e.behavior === 'credit_1x' ? 'Crédito (1x)' : e.behavior === 'debit' ? 'Débito' : 'Neutro'}</span>
              </div>
              <div className="flex gap-2">
                  <button onClick={() => handleEditEvent(e)} className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50" title="Editar">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => removeEvent(e.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50" title="Excluir">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
              </div>
          </div>
      ));
  };

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
           
           {canManageIntegrations && (
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

           {/* --- SEÇÃO EVENTOS SAZONAIS --- */}
           {canManageSeasonal && (
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                 <h2 className="text-lg font-bold text-gray-800 mb-2">Eventos Sazonais (Calendário)</h2>
                 <p className="text-sm text-gray-500 mb-4">Cadastre períodos especiais (Ex: Black Friday). O calendário exibirá uma borda colorida nestas datas.</p>
                 
                 <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4 p-4 rounded-lg bg-gray-50 border border-gray-100">
                     <div className="md:col-span-2">
                         <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome do Evento</label>
                         <input 
                             type="text" 
                             className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none bg-white" 
                             placeholder="Ex: Black Friday" 
                             value={seasonLabel}
                             onChange={e => setSeasonLabel(e.target.value)}
                         />
                     </div>
                     <div>
                         <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Início</label>
                         <input 
                             type="date" 
                             className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none bg-white" 
                             value={seasonStart}
                             onChange={e => setSeasonStart(e.target.value)}
                         />
                     </div>
                     <div>
                         <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Fim</label>
                         <input 
                             type="date" 
                             className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none bg-white" 
                             value={seasonEnd}
                             onChange={e => setSeasonEnd(e.target.value)}
                         />
                     </div>
                     <div>
                         <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Cor da Borda</label>
                         <select 
                             className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none bg-white"
                             value={seasonColor}
                             onChange={e => setSeasonColor(e.target.value)}
                         >
                             {SEASONAL_COLORS.map(c => (
                                 <option key={c.value} value={c.value}>{c.label}</option>
                             ))}
                         </select>
                     </div>
                     <div className="md:col-span-5 flex justify-end">
                         <button 
                             onClick={saveSeasonalEvent}
                             disabled={savingState['seasonal'] === 'saving'}
                             className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
                         >
                             Adicionar Período
                         </button>
                     </div>
                 </div>

                 <div className="space-y-2">
                     {(settings.seasonalEvents || []).map(s => (
                         <div key={s.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg bg-white">
                             <div className="flex items-center gap-3">
                                 <div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: s.color }}></div>
                                 <div>
                                     <div className="font-bold text-gray-700">{s.label}</div>
                                     <div className="text-xs text-gray-500">
                                         {new Date(s.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} até {new Date(s.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                                     </div>
                                 </div>
                             </div>
                             <div className="flex items-center gap-3">
                                 <label className="flex items-center cursor-pointer">
                                     <span className="text-xs font-bold text-gray-500 mr-2">{s.active ? 'Ativo' : 'Inativo'}</span>
                                     <div className="relative">
                                         <input type="checkbox" className="sr-only" checked={s.active} onChange={() => toggleSeasonalEvent(s.id)} />
                                         <div className={`block w-8 h-5 rounded-full transition-colors ${s.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                         <div className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition transform ${s.active ? 'translate-x-3' : 'translate-x-0'}`}></div>
                                     </div>
                                 </label>
                                 <button onClick={() => removeSeasonalEvent(s.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-full">
                                     🗑️
                                 </button>
                             </div>
                         </div>
                     ))}
                     {(settings.seasonalEvents || []).length === 0 && (
                         <p className="text-center text-gray-400 py-2">Nenhum evento sazonal cadastrado.</p>
                     )}
                 </div>
             </div>
           )}

           {/* --- NOVO LAYOUT DE FILIAIS E SETORES (Empresa -> Filial -> Setor) --- */}
           {canManageHierarchy && (
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                 <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800">Gerenciar Filiais e Setores</h2>
                    <p className="text-xs text-gray-500">Estrutura Hierárquica: Empresa {'>'} Filial {'>'} Setor.</p>
                 </div>
                 
                 <div className="flex flex-col lg:flex-row h-[600px]">
                    
                    {/* COLUNA 1: EMPRESAS */}
                    <div className="w-full lg:w-1/4 border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col bg-gray-50/50">
                       <div className="p-4 border-b border-gray-200">
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">1. Empresas</label>
                          <div className="flex gap-2">
                             <input 
                                type="text" 
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none bg-white" 
                                placeholder="Nova Empresa..." 
                                value={newCompanyName}
                                onChange={e => setNewCompanyName(e.target.value)}
                             />
                             <button onClick={addCompany} disabled={!newCompanyName.trim()} className="bg-gray-700 hover:bg-gray-800 text-white rounded-lg px-3 py-2 font-bold disabled:opacity-50">+</button>
                          </div>
                       </div>
                       <div className="overflow-y-auto flex-1 p-2 space-y-1">
                          {/* EMPRESA VIRTUAL: SEM EMPRESA */}
                          <div 
                             onClick={() => setSelectedCompany('Sem Empresa')}
                             className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-all border ${selectedCompany === 'Sem Empresa' ? 'bg-amber-50 border-amber-400 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300 opacity-70'}`}
                          >
                             <div>
                                <span className={`font-bold block text-sm ${selectedCompany === 'Sem Empresa' ? 'text-amber-800' : 'text-gray-600'}`}>Sem Empresa</span>
                                <span className="text-[10px] text-gray-400">{orphanedBranches.length} filiais órfãs</span>
                             </div>
                          </div>

                          {(settings.companies || []).map(company => (
                             <div 
                                key={company}
                                onClick={() => setSelectedCompany(company)}
                                className={`group flex justify-between items-center p-3 rounded-lg cursor-pointer transition-all border ${selectedCompany === company ? 'bg-slate-100 border-slate-400 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                             >
                                <div>
                                   <span className={`font-bold block text-sm ${selectedCompany === company ? 'text-slate-800' : 'text-gray-700'}`}>{company}</span>
                                   <span className="text-[10px] text-gray-400">
                                       {(settings.companyBranches?.[company] || []).length} filiais
                                   </span>
                                </div>
                                <button 
                                   onClick={(e) => { e.stopPropagation(); removeCompany(company); }}
                                   className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition-all"
                                >
                                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                             </div>
                          ))}
                       </div>
                    </div>

                    {/* COLUNA 2: FILIAIS DA EMPRESA SELECIONADA */}
                    <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col bg-white">
                       <div className="p-4 border-b border-gray-200 bg-gray-50/20">
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">2. Filiais {selectedCompany && <span className="text-slate-600 font-normal">({selectedCompany})</span>}</label>
                          <div className="flex gap-2">
                             <input 
                                type="text" 
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none bg-white disabled:bg-gray-100" 
                                placeholder={selectedCompany ? "Nova Filial..." : "Selecione Empresa..."}
                                value={newBranchName}
                                onChange={e => setNewBranchName(e.target.value)}
                                disabled={!selectedCompany || selectedCompany === 'Sem Empresa'}
                             />
                             <button 
                                onClick={addBranch}
                                disabled={!newBranchName.trim() || !selectedCompany || selectedCompany === 'Sem Empresa'}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 font-bold disabled:opacity-50"
                             >
                                +
                             </button>
                          </div>
                       </div>
                       <div className="overflow-y-auto flex-1 p-2 space-y-1">
                          {!selectedCompany ? (
                              <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm p-4 text-center">
                                  <span className="text-2xl mb-2">🏢</span>
                                  Selecione uma empresa para ver suas filiais.
                              </div>
                          ) : (
                              <>
                                  {currentBranchesList.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Nenhuma filial nesta empresa.</p>}
                                  {currentBranchesList.map(branch => (
                                     <div 
                                        key={branch}
                                        onClick={() => setSelectedBranch(branch)}
                                        className={`group flex justify-between items-center p-3 rounded-lg cursor-pointer transition-all border ${selectedBranch === branch ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-gray-200 hover:border-indigo-300'}`}
                                     >
                                        <div>
                                           <span className={`font-bold block text-sm ${selectedBranch === branch ? 'text-indigo-800' : 'text-gray-700'}`}>{branch}</span>
                                           <span className="text-[10px] text-gray-400">
                                               {(settings.branchSectors?.[branch] || []).length} setores
                                           </span>
                                        </div>
                                        <div className="flex items-center">
                                            {/* Se estiver "Sem Empresa", botão para mover (se tiver empresas) */}
                                            {selectedCompany === 'Sem Empresa' && settings.companies && settings.companies.length > 0 && (
                                                <select 
                                                  className="text-[10px] border border-gray-300 rounded p-1 mr-2 bg-white"
                                                  onChange={(e) => {
                                                      const targetCompany = e.target.value;
                                                      if(targetCompany) {
                                                          const updatedCompanyBranches = { ...(settings.companyBranches || {}) };
                                                          updatedCompanyBranches[targetCompany] = [...(updatedCompanyBranches[targetCompany] || []), branch];
                                                          saveSettings({ ...settings, companyBranches: updatedCompanyBranches }, 'move_branch');
                                                      }
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                  value=""
                                                >
                                                    <option value="">Mover para...</option>
                                                    {settings.companies.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            )}

                                            <button 
                                               onClick={(e) => { e.stopPropagation(); removeBranch(branch); }}
                                               className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition-all"
                                            >
                                               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                     </div>
                                  ))}
                              </>
                          )}
                       </div>
                    </div>

                    {/* COLUNA 3: SETORES DA FILIAL SELECIONADA */}
                    <div className="w-full lg:w-5/12 flex flex-col bg-white">
                       {selectedBranch ? (
                          <div className="p-4 space-y-6 overflow-y-auto h-full">
                             {/* SECTION SECTORS */}
                             <div>
                                 <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-gray-800 text-sm">3. Setores: <span className="text-indigo-600 bg-indigo-50 px-2 rounded">{selectedBranch}</span></h3>
                                    <div className="flex gap-2 w-1/2">
                                       <input 
                                          type="text" 
                                          className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none" 
                                          placeholder={`Novo Setor...`} 
                                          value={newSectorName}
                                          onChange={e => setNewSectorName(e.target.value)}
                                          onKeyDown={e => e.key === 'Enter' && addSectorToBranch()}
                                       />
                                       <button 
                                          onClick={addSectorToBranch}
                                          disabled={!newSectorName.trim()}
                                          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-3 py-2 font-bold text-sm whitespace-nowrap disabled:opacity-50"
                                       >
                                          Add
                                       </button>
                                    </div>
                                 </div>
                                 
                                 <div className="bg-gray-50/50 rounded-lg border border-gray-100 p-3 max-h-60 overflow-y-auto">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                       {(settings.branchSectors?.[selectedBranch] || []).length === 0 && (
                                          <p className="col-span-full text-center text-gray-400 italic py-4 text-xs">Nenhum setor cadastrado nesta filial.</p>
                                       )}
                                       {(settings.branchSectors?.[selectedBranch] || []).map(sector => (
                                          <div key={sector} className="flex justify-between items-center p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow group">
                                             <span className="font-medium text-gray-700 text-xs truncate mr-2" title={sector}>{sector}</span>
                                             <button 
                                                onClick={() => removeSectorFromBranch(sector)}
                                                className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                             >
                                                ×
                                             </button>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                             </div>

                             {/* SECTION LINKED BRANCHES (NEW) */}
                             <div className="pt-4 border-t border-gray-100">
                                 <h3 className="font-bold text-gray-800 text-sm mb-2">Filiais Vinculadas (Gestão Multilocal)</h3>
                                 <p className="text-[10px] text-gray-500 mb-4">
                                     Selecione quais filiais estão conectadas à <b>{selectedBranch}</b>. 
                                     Isso permitirá que colaboradores desta filial visualizem líderes das filiais marcadas.
                                 </p>
                                 
                                 <div className="bg-indigo-50/30 rounded-lg border border-indigo-100 p-4">
                                     <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                                         {settings.branches.filter(b => b !== selectedBranch).map(b => {
                                             const isLinked = settings.branchLinks?.[selectedBranch]?.includes(b);
                                             return (
                                                 <label key={b} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${isLinked ? 'bg-white border-indigo-300 shadow-sm' : 'border-transparent hover:bg-white hover:border-gray-200'}`}>
                                                     <input 
                                                         type="checkbox" 
                                                         checked={!!isLinked}
                                                         onChange={() => toggleBranchLink(b)}
                                                         className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                                                     />
                                                     <span className={`text-xs font-bold ${isLinked ? 'text-indigo-800' : 'text-gray-600'}`}>{b}</span>
                                                 </label>
                                             );
                                         })}
                                         {settings.branches.length <= 1 && (
                                             <p className="text-gray-400 text-xs italic">Cadastre mais filiais para criar vínculos.</p>
                                         )}
                                     </div>
                                 </div>
                             </div>
                          </div>
                       ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-10 text-center">
                             <svg className="w-12 h-12 mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                             <p className="font-medium text-sm">Selecione uma filial para gerenciar.</p>
                          </div>
                       )}
                    </div>
                 </div>
             </div>
           )}


           {canManageEventTypes && (
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
               <div className="flex justify-between items-center mb-4">
                   <h2 className="text-lg font-bold text-gray-800">Tipos de Evento</h2>
                   {editingEventId && <button onClick={cancelEditEvent} className="text-sm text-gray-500 underline">Cancelar Edição</button>}
               </div>
               
               <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 rounded-lg transition-colors ${editingEventId ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50 border border-gray-200'}`}>
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

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   {/* BLOCO 1: NEUTROS */}
                   <div className="bg-gray-50/50 rounded-lg border border-gray-200 p-3">
                       <h3 className="font-bold text-sm text-gray-700 mb-3 border-b border-gray-200 pb-2 flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-gray-400"></span> Eventos Neutros
                       </h3>
                       <div className="space-y-1">
                           {renderEventList(groupedEvents.neutros, 'Nenhum evento neutro.')}
                       </div>
                   </div>

                   {/* BLOCO 2: DÉBITOS */}
                   <div className="bg-red-50/50 rounded-lg border border-red-200 p-3">
                       <h3 className="font-bold text-sm text-red-800 mb-3 border-b border-red-200 pb-2 flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-red-500"></span> Eventos Débitos
                       </h3>
                       <div className="space-y-1">
                           {renderEventList(groupedEvents.debitos, 'Nenhum evento de débito.')}
                       </div>
                   </div>

                   {/* BLOCO 3: CRÉDITOS */}
                   <div className="bg-emerald-50/50 rounded-lg border border-emerald-200 p-3">
                       <h3 className="font-bold text-sm text-emerald-800 mb-3 border-b border-emerald-200 pb-2 flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Eventos Créditos
                       </h3>
                       <div className="space-y-1">
                           {renderEventList(groupedEvents.creditos, 'Nenhum evento de crédito.')}
                       </div>
                   </div>
               </div>
             </div>
           )}

            {(canCreateTemplate || canViewTemplates || canManageRotations) && (
              <>
                <div className="border-t border-gray-200 my-8"></div>
                <h2 className="text-xl font-bold text-gray-800 mb-6">Modelos de Jornada & Escalas</h2>

                {canCreateTemplate && (
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
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {canViewTemplates && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h2 className="text-lg font-bold text-gray-800 mb-4">Modelos de Jornada Salvos</h2>
                      <div className="flex flex-col gap-2">
                          {(settings.scheduleTemplates || []).map(t => (
                            <div key={t.id} className={`flex justify-between items-center p-3 border border-gray-200 rounded-lg transition-colors ${editingTemplateId === t.id ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' : 'bg-gray-50'}`}>
                                <span className="font-bold text-gray-700 truncate mr-2">{t.name}</span>
                                {canCreateTemplate && (
                                  <div className="flex gap-2 shrink-0">
                                    <button onClick={() => loadTemplateForEdit(t)} className="text-blue-500 bg-blue-50 px-3 py-1 rounded text-xs font-bold hover:bg-blue-100 border border-blue-100">Editar</button>
                                    <button onClick={() => removeTemplate(t.id)} className="text-red-500 bg-red-50 px-3 py-1 rounded text-xs font-bold hover:bg-red-100 border border-red-100">Excluir</button>
                                  </div>
                                )}
                            </div>
                          ))}
                          {(settings.scheduleTemplates || []).length === 0 && <p className="text-gray-400 text-sm">Nenhum modelo cadastrado.</p>}
                      </div>
                    </div>
                  )}
                  
                  {canManageRotations && (
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
                  )}
                </div>
              </>
            )}
        </div>
      )}

      {/* ... (rest of the file remains the same) ... */}
      {activeSubTab === 'acesso' && showAcesso && (
        <div className="animate-fadeIn space-y-8">
           {/* ... conteúdo da aba acesso mantido ... */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-2">Funções (Roles)</h2>
                    {/* ... */}
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
                    {/* ... */}
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
            {/* ... mantido ... */}
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
