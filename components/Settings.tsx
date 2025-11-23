

import React, { useState, useEffect } from 'react';
import { SystemSettings, EventTypeConfig, EventBehavior, Schedule, DaySchedule, ScheduleTemplate, RoleConfig } from '../types';
import { generateUUID } from '../utils/helpers';

interface SettingsProps {
  settings: SystemSettings;
  setSettings: (s: SystemSettings) => Promise<void>;
  showToast: (msg: string, isError?: boolean) => void;
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

// Componente Interno para Gerenciar Listas Simples (Filiais, Setores, Perfis)
const ManageList = ({ 
  title, 
  items, 
  onAdd, 
  onRemove, 
  saving, 
  removingId, 
  placeholder 
}: {
  title: string;
  items: string[];
  onAdd: (val: string) => void;
  onRemove: (val: string) => void;
  saving: 'idle' | 'saving' | 'success';
  removingId: string | null;
  placeholder: string;
}) => {
  const [newItem, setNewItem] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredItems = items.filter(i => i.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleAdd = () => {
    if (newItem.trim()) {
      onAdd(newItem);
      setNewItem('');
    }
  };

  const getButtonClass = (state: 'idle' | 'saving' | 'success') => {
    if (state === 'success') return 'bg-emerald-500 hover:bg-emerald-600 text-white';
    if (state === 'saving') return 'bg-indigo-400 text-white cursor-not-allowed';
    return 'bg-indigo-600 text-white hover:bg-indigo-700';
  };

  const getButtonLabel = (state: 'idle' | 'saving' | 'success') => {
    if (state === 'saving') return '...';
    if (state === 'success') return '✓';
    return 'Add';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        {title}
      </h2>
      
      {/* Input de Adição */}
      <div className="flex gap-2 mb-4">
        <input 
          type="text" 
          className="flex-1 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          placeholder={placeholder}
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          disabled={saving === 'saving'}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button 
          onClick={handleAdd} 
          disabled={saving === 'saving' || !newItem.trim()}
          className={`${getButtonClass(saving)} px-4 py-2 rounded-lg transition-all font-semibold min-w-[80px]`}
        >
          {getButtonLabel(saving)}
        </button>
      </div>

      {/* Lista Suspensa / Expansível */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full bg-gray-50 p-3 text-left text-sm font-semibold text-gray-700 flex justify-between items-center hover:bg-gray-100 transition-colors"
        >
          <span>Ver Itens Cadastrados ({items.length})</span>
          <span className={`transition-transform transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
            ▼
          </span>
        </button>

        {isExpanded && (
          <div className="bg-white p-3 border-t border-gray-200 animate-fadeIn">
            {/* Campo de Pesquisa */}
            <input 
              type="text"
              placeholder="🔍 Pesquisar na lista..."
              className="w-full border border-gray-300 rounded-md p-2 text-sm mb-3 focus:ring-1 focus:ring-indigo-500 outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-gray-300">
              {filteredItems.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-2">
                  {items.length === 0 ? 'Nenhum item cadastrado.' : 'Nenhum item encontrado.'}
                </p>
              ) : (
                filteredItems.map(item => (
                  <div key={item} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded group border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">{item}</span>
                    <button 
                      onClick={() => onRemove(item)}
                      disabled={removingId === item}
                      className="text-red-400 hover:text-red-600 text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      title="Remover"
                    >
                      {removingId === item ? '...' : 'Excluir'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const Settings: React.FC<SettingsProps> = ({ settings, setSettings, showToast }) => {
  // States para novos Eventos e Integrações
  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventBehavior, setNewEventBehavior] = useState<EventBehavior>('neutral');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(settings.spreadsheetUrl || '');

  // Loading states
  const [savingBranch, setSavingBranch] = useState<'idle' | 'saving' | 'success'>('idle');
  const [savingRole, setSavingRole] = useState<'idle' | 'saving' | 'success'>('idle');
  const [savingSector, setSavingSector] = useState<'idle' | 'saving' | 'success'>('idle'); 
  const [savingProfile, setSavingProfile] = useState<'idle' | 'saving' | 'success'>('idle');
  const [savingEvent, setSavingEvent] = useState<'idle' | 'saving' | 'success'>('idle');
  const [savingIntegration, setSavingIntegration] = useState<'idle' | 'saving' | 'success'>('idle');
  const [savingTemplate, setSavingTemplate] = useState<'idle' | 'saving' | 'success'>('idle');
  const [removingId, setRemovingId] = useState<string | null>(null);

  // States para Modelos de Jornada
  const [templateName, setTemplateName] = useState('');
  const [templateSchedule, setTemplateSchedule] = useState<Schedule>(JSON.parse(JSON.stringify(initialSchedule)));
  const [isTemplateListExpanded, setIsTemplateListExpanded] = useState(false);

  // States para Funções (Roles)
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleRestricted, setNewRoleRestricted] = useState(false); // checkbox state: restricted = true -> canViewAllSectors = false
  const [isRoleListExpanded, setIsRoleListExpanded] = useState(false);

  // Atualiza o estado local se as configs mudarem
  useEffect(() => {
     if (settings.spreadsheetUrl) setSpreadsheetUrl(settings.spreadsheetUrl);
  }, [settings.spreadsheetUrl]);

  // Reset success states after delay
  useEffect(() => {
    const timers = [
      savingBranch === 'success' && setTimeout(() => setSavingBranch('idle'), 2000),
      savingRole === 'success' && setTimeout(() => setSavingRole('idle'), 2000),
      savingSector === 'success' && setTimeout(() => setSavingSector('idle'), 2000),
      savingProfile === 'success' && setTimeout(() => setSavingProfile('idle'), 2000),
      savingEvent === 'success' && setTimeout(() => setSavingEvent('idle'), 2000),
      savingIntegration === 'success' && setTimeout(() => setSavingIntegration('idle'), 2000),
      savingTemplate === 'success' && setTimeout(() => setSavingTemplate('idle'), 2000),
    ].filter(Boolean);
    return () => timers.forEach(t => t && clearTimeout(t));
  }, [savingBranch, savingRole, savingSector, savingProfile, savingEvent, savingIntegration, savingTemplate]);

  // Wrapper auxiliar
  const performSave = async (
    newSettings: SystemSettings, 
    setStat: React.Dispatch<React.SetStateAction<'idle' | 'saving' | 'success'>>,
    onSuccess?: () => void
  ) => {
    setStat('saving');
    try {
      await setSettings(newSettings);
      setStat('success');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error(error);
      setStat('idle');
    }
  };

  // --- Handlers Filiais ---
  const addBranch = async (val: string) => {
    if (settings.branches.includes(val.trim())) { showToast('Filial já existe', true); return; }
    const updated = { ...settings, branches: [...settings.branches, val.trim()] };
    performSave(updated, setSavingBranch);
  };
  const removeBranch = async (val: string) => {
    if (window.confirm(`Remover filial "${val}"?`)) {
      setRemovingId(val);
      const updated = { ...settings, branches: settings.branches.filter(b => b !== val) };
      try { await setSettings(updated); } catch(e) { console.error(e); } finally { setRemovingId(null); }
    }
  };

  // --- Handlers Funções (Roles) ---
  const addRole = async () => {
    if (!newRoleName.trim()) return;
    const exists = settings.roles.some(r => r.name.toLowerCase() === newRoleName.trim().toLowerCase());
    if (exists) { showToast('Função já existe', true); return; }

    const newRole: RoleConfig = {
      name: newRoleName.trim(),
      canViewAllSectors: !newRoleRestricted // Se restricted is true, canViewAll is false
    };

    const updated = { ...settings, roles: [...settings.roles, newRole] };
    performSave(updated, setSavingRole, () => {
      setNewRoleName('');
      setNewRoleRestricted(false);
    });
  };

  const removeRole = async (roleName: string) => {
    if (window.confirm(`Remover função "${roleName}"?`)) {
      setRemovingId(roleName);
      const updated = { ...settings, roles: settings.roles.filter(r => r.name !== roleName) };
      try { await setSettings(updated); } catch(e) { console.error(e); } finally { setRemovingId(null); }
    }
  };

  // --- Handlers Setores ---
  const addSector = async (val: string) => {
    const currentSectors = settings.sectors || [];
    if (currentSectors.includes(val.trim())) { showToast('Setor já existe', true); return; }
    const updated = { ...settings, sectors: [...currentSectors, val.trim()] };
    performSave(updated, setSavingSector);
  };
  const removeSector = async (val: string) => {
    if (window.confirm(`Remover setor "${val}"?`)) {
      setRemovingId(val);
      const currentSectors = settings.sectors || [];
      const updated = { ...settings, sectors: currentSectors.filter(s => s !== val) };
      try { await setSettings(updated); } catch(e) { console.error(e); } finally { setRemovingId(null); }
    }
  };

  // --- Handlers Perfis ---
  const addProfile = async (val: string) => {
    const v = val.trim().toLowerCase();
    const currentProfiles = settings.accessProfiles || ['admin', 'colaborador', 'noc'];
    if (currentProfiles.includes(v)) { showToast('Perfil já existe', true); return; }
    const updated = { ...settings, accessProfiles: [...currentProfiles, v] };
    performSave(updated, setSavingProfile);
  };
  const removeProfile = async (val: string) => {
    if (['admin', 'colaborador', 'noc'].includes(val)) { showToast('Perfil padrão não pode ser removido.', true); return; }
    if (window.confirm(`Remover perfil "${val}"?`)) {
      setRemovingId(val);
      const currentProfiles = settings.accessProfiles || ['admin', 'colaborador', 'noc'];
      const updated = { ...settings, accessProfiles: currentProfiles.filter(p => p !== val) };
      try { await setSettings(updated); } catch(e) { console.error(e); } finally { setRemovingId(null); }
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
    performSave(updated, setSavingEvent, () => {
      setNewEventLabel('');
      setNewEventBehavior('neutral');
    });
  };
  const removeEventType = async (id: string) => {
    if (window.confirm('Remover este tipo de evento?')) {
      setRemovingId(id);
      const updated = { ...settings, eventTypes: settings.eventTypes.filter(e => e.id !== id) };
      try { await setSettings(updated); } catch(e) { console.error(e); } finally { setRemovingId(null); }
    }
  };

  const saveIntegration = async () => {
    const updated = { ...settings, spreadsheetUrl: spreadsheetUrl.trim() };
    performSave(updated, setSavingIntegration);
  };

  // --- Handlers Modelos de Jornada ---
  const handleTemplateScheduleChange = (day: keyof Schedule, field: keyof DaySchedule, value: any) => {
    setTemplateSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      showToast('Nome do modelo é obrigatório', true);
      return;
    }
    const hasWorkDays = (Object.values(templateSchedule) as DaySchedule[]).some(day => day.enabled && day.start && day.end);
    if (!hasWorkDays) {
      showToast('Defina pelo menos um dia de trabalho', true);
      return;
    }

    const newTemplate: ScheduleTemplate = {
      id: generateUUID(),
      name: templateName.trim(),
      schedule: templateSchedule
    };

    const currentTemplates = settings.scheduleTemplates || [];
    const updated = { ...settings, scheduleTemplates: [...currentTemplates, newTemplate] };
    
    performSave(updated, setSavingTemplate, () => {
      setTemplateName('');
      setTemplateSchedule(JSON.parse(JSON.stringify(initialSchedule)));
      showToast('Modelo de jornada salvo!');
    });
  };

  const removeTemplate = async (id: string) => {
    if (window.confirm('Remover este modelo de jornada?')) {
      setRemovingId(id);
      const currentTemplates = settings.scheduleTemplates || [];
      const updated = { ...settings, scheduleTemplates: currentTemplates.filter(t => t.id !== id) };
      try { await setSettings(updated); } catch(e) { console.error(e); } finally { setRemovingId(null); }
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

  const daysOrder: (keyof Schedule)[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

  return (
    <div className="space-y-8">
      {/* INTEGRAÇÕES */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">Integrações</h2>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Link da Planilha de Plantão (Google Sheets)</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              className="flex-1 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              placeholder="https://docs.google.com/spreadsheets/..."
              value={spreadsheetUrl}
              onChange={e => setSpreadsheetUrl(e.target.value)}
              disabled={savingIntegration === 'saving'}
            />
            <button 
              onClick={saveIntegration} 
              disabled={savingIntegration === 'saving'}
              className={`bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg transition-all font-semibold min-w-[100px] disabled:opacity-50`}
            >
              {savingIntegration === 'saving' ? '...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ManageList 
           title="Gerenciar Filiais" 
           items={settings.branches} 
           onAdd={addBranch} 
           onRemove={removeBranch} 
           saving={savingBranch} 
           removingId={removingId}
           placeholder="Nova Filial..."
        />

        {/* GERENCIAR FUNÇÕES (ROLES) - PERSONALIZADO */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
           <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
             Gerenciar Funções
           </h2>
           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
              <label className="text-xs font-bold text-gray-600 uppercase mb-1">Nome da Função</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm mb-3 bg-white"
                placeholder="Ex: Supervisor"
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                disabled={savingRole === 'saving'}
              />
              
              <div className="flex items-center gap-2 mb-3">
                 <input 
                   type="checkbox" 
                   id="roleRestricted"
                   checked={newRoleRestricted}
                   onChange={e => setNewRoleRestricted(e.target.checked)}
                   className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                 />
                 <label htmlFor="roleRestricted" className="text-sm text-gray-700 select-none cursor-pointer">
                    Restringir visualização a setores específicos?
                 </label>
              </div>
              <p className="text-[10px] text-gray-500 mb-3 ml-6">
                Se marcado, o usuário com esta função precisará ter os setores que ele pode ver definidos no cadastro dele.
              </p>

              <button 
                onClick={addRole} 
                disabled={savingRole === 'saving' || !newRoleName.trim()}
                className={`w-full ${savingRole === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-4 py-2 rounded-lg transition-all font-semibold`}
              >
                {savingRole === 'saving' ? '...' : savingRole === 'success' ? 'Salvo!' : 'Adicionar Função'}
              </button>
           </div>

           <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button 
                onClick={() => setIsRoleListExpanded(!isRoleListExpanded)}
                className="w-full bg-gray-50 p-3 text-left text-sm font-semibold text-gray-700 flex justify-between items-center hover:bg-gray-100 transition-colors"
              >
                <span>Ver Funções Cadastradas ({settings.roles.length})</span>
                <span className={`transition-transform transform ${isRoleListExpanded ? 'rotate-180' : 'rotate-0'}`}>▼</span>
              </button>

              {isRoleListExpanded && (
                <div className="bg-white p-3 border-t border-gray-200 animate-fadeIn max-h-48 overflow-y-auto">
                   {settings.roles.map((role, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded group border-b border-gray-50 last:border-0">
                         <div>
                            <span className="text-sm font-bold text-gray-700 block">{role.name}</span>
                            <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                               {role.canViewAllSectors ? 'Vê Todos os Setores' : 'Restrito (Define no Usuário)'}
                            </span>
                         </div>
                         <button 
                           onClick={() => removeRole(role.name)}
                           disabled={removingId === role.name}
                           className="text-red-400 hover:text-red-600 text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                         >
                           {removingId === role.name ? '...' : 'Excluir'}
                         </button>
                      </div>
                   ))}
                </div>
              )}
           </div>
        </div>

        <ManageList 
           title="Gerenciar Setores / Squads" 
           items={settings.sectors || []} 
           onAdd={addSector} 
           onRemove={removeSector} 
           saving={savingSector} 
           removingId={removingId}
           placeholder="Novo Setor..."
        />

        <ManageList 
           title="Gerenciar Perfis de Acesso" 
           items={settings.accessProfiles || ['admin', 'colaborador', 'noc']} 
           onAdd={addProfile} 
           onRemove={removeProfile} 
           saving={savingProfile} 
           removingId={removingId}
           placeholder="Novo Perfil (ex: supervisor)..."
        />
      </div>

      {/* MODELOS DE JORNADA */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          Modelos de Jornada de Trabalho
        </h2>
        
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
           <div className="mb-4">
             <label className="text-xs font-bold text-gray-600 uppercase mb-1">Nome do Modelo</label>
             <div className="flex gap-2">
               <input 
                 type="text" 
                 className="flex-1 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                 placeholder="Ex: Escala 12x36, Administrativo, etc."
                 value={templateName}
                 onChange={e => setTemplateName(e.target.value)}
                 disabled={savingTemplate === 'saving'}
               />
               <button 
                 onClick={saveTemplate} 
                 disabled={savingTemplate === 'saving' || !templateName.trim()}
                 className={`${savingTemplate === 'success' ? 'bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-4 py-2 rounded-lg transition-all font-bold min-w-[120px] disabled:opacity-50`}
               >
                 {savingTemplate === 'saving' ? 'Salvando...' : savingTemplate === 'success' ? 'Salvo!' : 'Salvar Modelo'}
               </button>
             </div>
           </div>

           <div className="space-y-2">
              {daysOrder.map(day => (
                <div key={day} className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                  <label className="flex items-center gap-2 w-28 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={templateSchedule[day].enabled}
                      onChange={e => handleTemplateScheduleChange(day, 'enabled', e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium capitalize text-gray-700">{day.replace('terca', 'terça').replace('sabado', 'sábado')}</span>
                  </label>
                  
                  <div className="flex items-center gap-2 flex-1">
                     <div className="flex flex-col">
                       <span className="text-[10px] text-gray-400 mb-0.5">Início</span>
                       <div className="flex items-center gap-2">
                         <input
                          type="time"
                          disabled={!templateSchedule[day].enabled}
                          value={templateSchedule[day].start}
                          onChange={e => handleTemplateScheduleChange(day, 'start', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400 bg-white text-gray-700"
                        />
                         <label className="flex items-center gap-1 cursor-pointer" title="Marque se este horário de início pertence, na verdade, ao dia anterior (ex: 22:00 de ontem)">
                            <input 
                              type="checkbox"
                              disabled={!templateSchedule[day].enabled}
                              checked={templateSchedule[day].startsPreviousDay || false}
                              onChange={e => handleTemplateScheduleChange(day, 'startsPreviousDay', e.target.checked)}
                              className="w-3.5 h-3.5 text-red-500 rounded focus:ring-red-400"
                            />
                            <span className={`text-[10px] font-semibold ${templateSchedule[day].startsPreviousDay ? 'text-red-600' : 'text-gray-400'}`}>Inicia -1d</span>
                         </label>
                       </div>
                     </div>

                     <div className="flex flex-col ml-4">
                       <span className="text-[10px] text-gray-400 mb-0.5">Fim</span>
                       <input
                        type="time"
                        disabled={!templateSchedule[day].enabled}
                        value={templateSchedule[day].end}
                        onChange={e => handleTemplateScheduleChange(day, 'end', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400 bg-white text-gray-700"
                      />
                     </div>
                  </div>
                </div>
              ))}
            </div>
        </div>

        {/* Lista de Modelos Salvos */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button 
            onClick={() => setIsTemplateListExpanded(!isTemplateListExpanded)}
            className="w-full bg-gray-50 p-3 text-left text-sm font-semibold text-gray-700 flex justify-between items-center hover:bg-gray-100 transition-colors"
          >
            <span>Ver Modelos Cadastrados ({(settings.scheduleTemplates || []).length})</span>
            <span className={`transition-transform transform ${isTemplateListExpanded ? 'rotate-180' : 'rotate-0'}`}>
              ▼
            </span>
          </button>

          {isTemplateListExpanded && (
            <div className="bg-white p-3 border-t border-gray-200 animate-fadeIn">
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-gray-300">
                {(!settings.scheduleTemplates || settings.scheduleTemplates.length === 0) ? (
                  <p className="text-xs text-gray-400 italic text-center py-2">
                    Nenhum modelo cadastrado.
                  </p>
                ) : (
                  settings.scheduleTemplates.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-3 border border-gray-200 rounded hover:bg-gray-50">
                      <div>
                        <span className="font-bold text-sm text-gray-700 block">{t.name}</span>
                        <span className="text-[10px] text-gray-500">
                          {daysOrder.filter(d => t.schedule[d].enabled).length} dias de trabalho
                        </span>
                      </div>
                      <button 
                        onClick={() => removeTemplate(t.id)}
                        disabled={removingId === t.id}
                        className="text-red-500 hover:text-red-700 text-xs font-bold px-3 py-1.5 bg-red-50 rounded disabled:opacity-50"
                      >
                        {removingId === t.id ? '...' : 'Excluir'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* TIPOS DE EVENTO */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          Gerenciar Tipos de Evento
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
              disabled={savingEvent === 'saving'}
            />
           </div>
           <div>
             <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Comportamento</label>
             <select 
               className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
               value={newEventBehavior}
               onChange={e => setNewEventBehavior(e.target.value as EventBehavior)}
               disabled={savingEvent === 'saving'}
             >
               <option value="neutral">Neutro</option>
               <option value="debit">Debita</option>
               <option value="credit_1x">Credita (1x)</option>
               <option value="credit_2x">Credita (2x)</option>
             </select>
           </div>
           <div className="flex items-end">
             <button 
               onClick={addEventType} 
               disabled={savingEvent === 'saving' || !newEventLabel.trim()}
               className={`w-full px-4 py-2 rounded-lg transition-all font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50`}
             >
                {savingEvent === 'saving' ? '...' : 'Adicionar'}
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
                disabled={removingId === type.id}
                className="text-red-500 hover:text-red-700 text-sm font-medium bg-red-50 px-3 py-1 rounded disabled:opacity-50"
              >
                {removingId === type.id ? '...' : 'Remover'}
              </button>
            </div>
          ))}
          {settings.eventTypes.length === 0 && <span className="text-gray-400 text-sm">Nenhum tipo de evento cadastrado.</span>}
        </div>
      </div>
    </div>
  );
};
