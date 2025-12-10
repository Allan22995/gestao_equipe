

import React, { useState, useEffect } from 'react';
import { Collaborator, Schedule, DaySchedule, SystemSettings, UserProfile } from '../types';
import { generateUUID, formatTitleCase } from '../utils/helpers';

interface CollaboratorsProps {
  collaborators: Collaborator[];
  onAdd: (c: Collaborator) => void;
  onUpdate: (c: Collaborator) => void;
  onDelete: (id: string) => void;
  showToast: (msg: string, isError?: boolean) => void;
  settings: SystemSettings;
  currentUserProfile: UserProfile;
  canEdit: boolean; // Permissão ACL
  currentUserAllowedSectors: string[]; // Lista de setores permitidos para visualização
  currentUserRole: string; // Função do usuário logado (para filtrar perfis que podem ser criados)
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

export const Collaborators: React.FC<CollaboratorsProps> = ({ 
  collaborators, onAdd, onUpdate, onDelete, showToast, settings, currentUserProfile, canEdit,
  currentUserAllowedSectors, currentUserRole
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    colabId: '',
    name: '',
    email: '',
    phone: '',
    otherContact: '',
    profile: 'colaborador' as UserProfile,
    branch: '',
    role: '',
    sector: '',
    allowedSectors: [] as string[],
    login: '',
    shiftType: '',
    hasRotation: false,
    rotationGroup: '',
    rotationStartDate: '',
  });
  
  const [schedule, setSchedule] = useState<Schedule>(JSON.parse(JSON.stringify(initialSchedule)));
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isFixingNames, setIsFixingNames] = useState(false);

  const handleScheduleChange = (day: keyof Schedule, field: keyof DaySchedule, value: any) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const template = settings.scheduleTemplates?.find(t => t.id === templateId);
    if (template) {
      setSchedule(JSON.parse(JSON.stringify(template.schedule)));
    }
  };

  // Toggle sector in allowed list
  const toggleAllowedSector = (sector: string) => {
    setFormData(prev => {
      const current = prev.allowedSectors || [];
      if (current.includes(sector)) {
        return { ...prev, allowedSectors: current.filter(s => s !== sector) };
      } else {
        return { ...prev, allowedSectors: [...current, sector] };
      }
    });
  };

  // Determine if the currently selected role requires sector restriction
  const selectedRoleConfig = settings.roles.find(r => r.name === formData.role);
  const isRoleRestricted = selectedRoleConfig ? !selectedRoleConfig.canViewAllSectors : false;

  const handleEdit = (colab: Collaborator) => {
    if (!canEdit) return;
    setEditingId(colab.id);
    setFormData({
      colabId: colab.colabId,
      name: colab.name,
      email: colab.email || '',
      phone: colab.phone || '',
      otherContact: colab.otherContact || '',
      profile: colab.profile || 'colaborador',
      branch: colab.branch,
      role: colab.role,
      sector: colab.sector || '',
      allowedSectors: colab.allowedSectors || [],
      login: colab.login,
      shiftType: colab.shiftType,
      hasRotation: colab.hasRotation || false,
      rotationGroup: colab.rotationGroup || '',
      rotationStartDate: colab.rotationStartDate || '',
    });
    
    const safeSchedule = JSON.parse(JSON.stringify(colab.schedule));
    Object.keys(safeSchedule).forEach(key => {
        if (safeSchedule[key].startsPreviousDay === undefined) {
            safeSchedule[key].startsPreviousDay = false;
        }
    });
    setSchedule(safeSchedule);
    setSelectedTemplateId(''); // Reset selection on edit
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ 
      colabId: '', name: '', email: '', phone: '', otherContact: '', profile: 'colaborador', branch: '', role: '', sector: '', allowedSectors: [], login: '', shiftType: '', 
      hasRotation: false, rotationGroup: '', rotationStartDate: ''
    });
    setSchedule(JSON.parse(JSON.stringify(initialSchedule)));
    setSelectedTemplateId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isNoc = formData.profile === 'noc';

    const isDuplicateId = collaborators.some(c => c.colabId === formData.colabId && c.id !== editingId);
    if (isDuplicateId) {
      showToast('Já existe um colaborador com este ID', true);
      return;
    }
    const isDuplicateLogin = collaborators.some(c => c.login === formData.login && c.id !== editingId);
    if (isDuplicateLogin) {
      showToast('Já existe um colaborador com este Login', true);
      return;
    }
    // Check duplicate email
    if (formData.email) {
      const isDuplicateEmail = collaborators.some(c => c.email === formData.email && c.id !== editingId);
      if (isDuplicateEmail) {
        showToast('Já existe um colaborador com este E-mail', true);
        return;
      }
    }

    // Validation for Phone (Not required for NOC)
    if (!formData.phone && !isNoc) {
       showToast('Telefone é obrigatório para este perfil.', true);
       return;
    }

    // Validation for Schedule (Not required for NOC)
    const hasWorkDays = (Object.values(schedule) as DaySchedule[]).some(day => day.enabled && day.start && day.end);
    if (!hasWorkDays && !isNoc) {
      showToast('Defina pelo menos um dia de trabalho com horários', true);
      return;
    }

    // Validation for Restricted Role
    if (isRoleRestricted && (!formData.allowedSectors || formData.allowedSectors.length === 0)) {
       showToast('Esta função exige que pelo menos um setor de visualização seja selecionado.', true);
       return;
    }
    
    // Validation for Rotation
    if (formData.hasRotation) {
        if (!formData.rotationGroup) {
            showToast('Selecione o Grupo de Escala.', true);
            return;
        }
        if (!formData.rotationStartDate) {
            showToast('Informe a data da última folga de escala para cálculo.', true);
            return;
        }
    }

    // Clean up allowedSectors if role is not restricted (optional but good for data hygiene)
    const finalAllowedSectors = isRoleRestricted ? formData.allowedSectors : [];
    
    // Clean up rotation group if hasRotation is false
    const finalRotationGroup = formData.hasRotation ? formData.rotationGroup : '';
    const finalRotationStart = formData.hasRotation ? formData.rotationStartDate : '';

    // Standardize Name (Title Case)
    const standardizedName = formatTitleCase(formData.name);

    if (editingId) {
      onUpdate({
        id: editingId,
        ...formData,
        name: standardizedName,
        allowedSectors: finalAllowedSectors,
        rotationGroup: finalRotationGroup,
        rotationStartDate: finalRotationStart,
        schedule,
        createdAt: new Date().toISOString(),
      });
      showToast('Colaborador atualizado com sucesso!');
      handleCancelEdit();
    } else {
      const newColab: Collaborator = {
        id: generateUUID(),
        ...formData,
        name: standardizedName,
        allowedSectors: finalAllowedSectors,
        rotationGroup: finalRotationGroup,
        rotationStartDate: finalRotationStart,
        schedule,
        createdAt: new Date().toISOString(),
      };

      onAdd(newColab);
      showToast('Colaborador cadastrado com sucesso!');
      handleCancelEdit();
    }
  };

  const handleDelete = (id: string) => {
    if (!canEdit) return;
    if (window.confirm('Tem certeza que deseja excluir?')) {
      onDelete(id);
      showToast('Colaborador removido.');
    }
  };

  const handleFixAllNames = async () => {
    if (!window.confirm('Isso irá padronizar a formatação dos nomes de TODOS os colaboradores (ex: "JOAO SILVA" para "Joao Silva"). Deseja continuar?')) {
      return;
    }
    
    setIsFixingNames(true);
    let count = 0;
    
    try {
      for (const colab of collaborators) {
        // Skip check if user doesn't have permission to edit this specific user (sector restriction)
        if (currentUserAllowedSectors.length > 0) {
           if (!colab.sector || !currentUserAllowedSectors.includes(colab.sector)) continue;
        }

        const formatted = formatTitleCase(colab.name);
        if (formatted !== colab.name) {
          // Precisamos chamar onUpdate (que chama o Firebase)
          // Em um app real, seria melhor um batch update, mas aqui usaremos a função existente
          await onUpdate({ ...colab, name: formatted });
          count++;
        }
      }
      if (count > 0) {
        showToast(`${count} nomes foram padronizados com sucesso!`);
      } else {
        showToast('Todos os nomes já estão no padrão correto.');
      }
    } catch (error) {
      console.error(error);
      showToast('Erro ao padronizar nomes.', true);
    } finally {
      setIsFixingNames(false);
    }
  };

  const daysOrder: (keyof Schedule)[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

  // --- LOGIC: PROFILE OPTIONS ---
  // 1. Get all active profiles from settings
  // 2. Filter by currentUserRole restrictions (if any)
  const profileOptions = React.useMemo(() => {
    // A. Base list: All ACTIVE profiles in settings
    let available = (settings.accessProfiles || [])
       .filter(p => p.active)
       .map(p => p.name);

    if (available.length === 0) {
        // Fallback safety if config is empty
        available = ['colaborador']; 
    }

    // B. Apply Restriction based on Logged User Role
    // If user is Admin (firebase profile), allow all active.
    if (currentUserProfile === 'admin') {
       return available;
    }

    // Otherwise, check RoleConfig for manageableProfiles
    const currentRoleConfig = settings.roles.find(r => r.name === currentUserRole);
    if (currentRoleConfig && currentRoleConfig.manageableProfiles && currentRoleConfig.manageableProfiles.length > 0) {
       // Filter: Only show profiles that are BOTH active AND manageable by this role
       return available.filter(p => currentRoleConfig.manageableProfiles!.includes(p));
    }

    // Default: If no restriction defined for role, show all active (or restrict to basic? let's show all active for backward compat)
    return available;

  }, [settings.accessProfiles, settings.roles, currentUserRole, currentUserProfile]);


  const sectorOptions = settings.sectors || [];
  const scheduleTemplates = settings.scheduleTemplates || [];
  const rotationOptions = settings.shiftRotations || [];

  const filteredCollaborators = collaborators.filter(c => {
    // Security Filter (Respect Restricted View)
    if (currentUserAllowedSectors.length > 0) {
      // If user has allowed sectors, the colab MUST belong to one of them
      if (!c.sector || !currentUserAllowedSectors.includes(c.sector)) {
        return false;
      }
    }
    
    return (
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.colabId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8">
      {/* Formulário visível apenas se canEdit */}
      {canEdit ? (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            {editingId ? 'Editar Colaborador' : 'Cadastrar Colaborador'}
          </h2>
          {editingId && (
            <button onClick={handleCancelEdit} className="text-sm text-gray-500 hover:text-gray-700 underline">
              Cancelar Edição
            </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* ID */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">ID (Matrícula) *</label>
              <input required type="text" className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="Ex: 001" value={formData.colabId} onChange={e => setFormData({...formData, colabId: e.target.value})} />
            </div>

            {/* Login Rede */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Usuário de Rede/Login *</label>
              <input required type="text" className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="nome.sobrenome" value={formData.login} onChange={e => setFormData({...formData, login: e.target.value})} />
            </div>

            {/* Nome */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Nome Completo *</label>
              <input 
                 required 
                 type="text" 
                 className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                 placeholder="Nome do colaborador" 
                 value={formData.name} 
                 onChange={e => setFormData({...formData, name: e.target.value})} 
                 onBlur={() => setFormData(prev => ({ ...prev, name: formatTitleCase(prev.name) }))}
              />
              <span className="text-[10px] text-gray-400">Padronizado automaticamente (Ex: Joao da Silva)</span>
            </div>

            {/* Email (Vinculo Auth) */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">E-mail Google (Login) *</label>
              <input required type="email" className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="email@gmail.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              <span className="text-[10px] text-gray-400">Usado para autenticação no sistema</span>
            </div>

            {/* Telefone */}
             <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Telefone (Celular)</label>
              <input 
                type="text" 
                required={formData.profile !== 'noc'}
                className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white disabled:bg-gray-100" 
                placeholder={formData.profile === 'noc' ? 'Opcional para NOC' : '(XX) 9XXXX-XXXX'} 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
              />
            </div>

            {/* Outro Contato */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Outro Contato</label>
              <input 
                type="text" 
                className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                placeholder="Humand, Gchat ou outro..." 
                value={formData.otherContact} 
                onChange={e => setFormData({...formData, otherContact: e.target.value})} 
              />
            </div>

            {/* Perfil de Acesso */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Perfil de Acesso *</label>
              <select required className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white capitalize" value={formData.profile} onChange={e => setFormData({...formData, profile: e.target.value as UserProfile})}>
                 {profileOptions.length === 0 && <option value="">Nenhum perfil disponível</option>}
                 {profileOptions.map(p => (
                   <option key={p} value={p}>{p}</option>
                 ))}
              </select>
            </div>

            {/* Branch Select */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Filial *</label>
              <select required className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})}>
                 <option value="">Selecione...</option>
                 {settings.branches.map(b => (
                   <option key={b} value={b}>{b}</option>
                 ))}
              </select>
            </div>

            {/* Role Select */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Função *</label>
              <select required className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                 <option value="">Selecione...</option>
                 {settings.roles.map(r => (
                   <option key={r.name} value={r.name}>{r.name}</option>
                 ))}
              </select>
            </div>

            {/* Sector / Squad Select */}
            <div className="flex flex-col md:col-span-2">
              <label className="text-xs font-semibold text-gray-600 mb-1">Setor Principal (Lotação)</label>
              <select 
                 className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                 value={formData.sector} 
                 onChange={e => setFormData({...formData, sector: e.target.value})}
              >
                 <option value="">Selecione (Opcional)...</option>
                 {sectorOptions.map(s => (
                   <option key={s} value={s}>{s}</option>
                 ))}
              </select>
            </div>

            {/* Shift Type (Turno) */}
             <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Turno</label>
              <select className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={formData.shiftType} onChange={e => setFormData({...formData, shiftType: e.target.value})}>
                 <option value="">Selecione...</option>
                 <option value="1º Turno">1º Turno</option>
                 <option value="2º Turno">2º Turno</option>
                 <option value="3º Turno">3º Turno</option>
                 <option value="4º Turno">4º Turno</option>
                 <option value="ADM">ADM</option>
              </select>
            </div>
            
             {/* Permissões de Visualização (Se a função for restrita) */}
             {isRoleRestricted && (
                <div className="md:col-span-3 bg-gray-50 p-4 rounded-lg border border-gray-200 animate-fadeIn">
                   <div className="flex justify-between items-start mb-2">
                      <label className="text-sm font-bold text-gray-700">Permissões de Visualização <span className="text-red-500">*</span></label>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">Função Restrita</span>
                   </div>
                   <p className="text-xs text-gray-500 mb-3">A função selecionada ({formData.role}) tem visualização restrita. Selecione quais setores este usuário pode ver.</p>
                   
                   <div className="flex flex-wrap gap-2">
                      {/* FIX: Use combined set of active sectors AND user's existing sectors to show legacy ones */}
                      {Array.from(new Set([...sectorOptions, ...(formData.allowedSectors || [])]))
                        .sort()
                        .map(sector => (
                        <button
                          key={sector}
                          type="button"
                          onClick={() => toggleAllowedSector(sector)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                             formData.allowedSectors?.includes(sector)
                             ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                             : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                          }`}
                        >
                          {formData.allowedSectors?.includes(sector) && '✓ '}
                          {sector}
                        </button>
                      ))}
                   </div>
                   {(!formData.allowedSectors || formData.allowedSectors.length === 0) && (
                      <p className="text-xs text-red-500 mt-2 font-medium">Selecione pelo menos um setor.</p>
                   )}
                </div>
             )}

             {!isRoleRestricted && formData.role && (
               <div className="md:col-span-3 bg-gray-50 p-3 rounded-lg border border-gray-200 opacity-75">
                  <div className="flex items-center gap-2">
                     <label className="text-sm font-bold text-gray-700">Permissões de Visualização</label>
                     <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded border border-green-200">Global</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">A função selecionada ({formData.role}) tem permissão de visualização global. O usuário verá todos os setores.</p>
               </div>
             )}
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Jornada e Escala</h3>
            
            {/* ESCALA DE REVEZAMENTO - SECTION */}
            <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
               <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                           type="checkbox" 
                           checked={formData.hasRotation}
                           onChange={e => setFormData({...formData, hasRotation: e.target.checked})}
                           className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <span className="font-bold text-gray-700">Possui Escala de Revezamento (Domingos)?</span>
                     </label>
                  </div>

                  {formData.hasRotation && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Grupo de Escala (Label)</label>
                            <select 
                               className="w-full border border-indigo-300 rounded-lg p-2 bg-white text-sm"
                               value={formData.rotationGroup}
                               onChange={e => setFormData({...formData, rotationGroup: e.target.value})}
                            >
                               <option value="">Selecione a Escala...</option>
                               {rotationOptions.map(r => (
                                  <option key={r.id} value={r.id}>
                                    {r.label || `Escala ${r.id}`}
                                  </option>
                               ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Última Folga Dominical (Start)</label>
                            <input 
                                type="date"
                                className="w-full border border-indigo-300 rounded-lg p-2 bg-white text-sm"
                                value={formData.rotationStartDate}
                                onChange={e => setFormData({...formData, rotationStartDate: e.target.value})}
                            />
                            <p className="text-[10px] text-gray-500 mt-1">Informe um domingo que o colaborador folgou. O sistema calculará o ciclo 3x1 (Trabalha 3, Folga 1) a partir desta data.</p>
                        </div>
                     </div>
                  )}
               </div>
            </div>

            {/* Template Selector */}
            {scheduleTemplates.length > 0 && (
              <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                 <span className="text-xs font-bold text-blue-800">Carregar Modelo:</span>
                 <select 
                   value={selectedTemplateId} 
                   onChange={(e) => handleTemplateSelect(e.target.value)}
                   className="flex-1 text-sm border-blue-200 rounded p-1 text-blue-900 bg-white"
                 >
                    <option value="">Selecione um modelo...</option>
                    {scheduleTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                 </select>
              </div>
            )}

            <p className="text-xs text-gray-500 mb-4">Configure os dias trabalhados. Se o turno inicia no dia anterior (Ex: A escala de Segunda começa Domingo às 22:00), marque a caixa "Inicia dia anterior".</p>
            
            <div className="space-y-3">
              {daysOrder.map(day => (
                <div key={day} className="flex flex-col md:flex-row md:items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="w-24">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={schedule[day].enabled} 
                        onChange={e => handleScheduleChange(day, 'enabled', e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="capitalize font-medium text-gray-700 text-sm">{day}</span>
                    </label>
                  </div>
                  
                  <div className={`flex items-center gap-2 flex-1 transition-opacity ${!schedule[day].enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div className="flex flex-col">
                       <span className="text-[10px] text-gray-500 font-bold mb-0.5 uppercase">Início</span>
                       <input 
                        type="time" 
                        value={schedule[day].start} 
                        onChange={e => handleScheduleChange(day, 'start', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                       />
                    </div>
                    
                    <div className="flex flex-col px-2">
                       <span className="text-[10px] text-gray-400 font-bold mb-0.5 opacity-0">.</span>
                       <span className="text-gray-400 font-bold text-xs">até</span>
                    </div>

                    <div className="flex flex-col">
                       <span className="text-[10px] text-gray-500 font-bold mb-0.5 uppercase">Fim</span>
                       <input 
                        type="time" 
                        value={schedule[day].end} 
                        onChange={e => handleScheduleChange(day, 'end', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                       />
                    </div>

                    <div className="flex flex-col ml-4">
                       <span className="text-[10px] text-gray-500 font-bold mb-0.5 uppercase">Virada de Turno</span>
                       <label className="flex items-center gap-1 cursor-pointer bg-white px-2 py-1.5 rounded border border-gray-200 hover:bg-gray-50">
                          <input 
                            type="checkbox" 
                            checked={schedule[day].startsPreviousDay || false} 
                            onChange={e => handleScheduleChange(day, 'startsPreviousDay', e.target.checked)}
                            className="rounded text-indigo-600 w-3 h-3"
                          />
                          <span className="text-xs text-gray-600">Inicia dia anterior (-1d)</span>
                       </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
             {editingId && (
               <button 
                type="button" 
                onClick={handleCancelEdit}
                className="px-6 py-2 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition"
               >
                 Cancelar
               </button>
             )}
             <button 
              type="submit" 
              className="bg-[#667eea] hover:bg-[#5a6fd6] text-white font-bold py-2.5 px-6 rounded-lg shadow-md transition-transform active:scale-95"
             >
               {editingId ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
             </button>
          </div>
        </form>
      </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center text-blue-800">
          <p className="font-bold">Modo Leitura</p>
          <p className="text-sm">Você tem permissão apenas para visualizar a lista de colaboradores.</p>
        </div>
      )}

      {/* Lista de Colaboradores */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
           <h2 className="text-xl font-bold text-gray-800">Equipe Cadastrada</h2>
           
           <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto items-center">
             {canEdit && (
               <button 
                 onClick={handleFixAllNames}
                 disabled={isFixingNames}
                 className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 px-3 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap"
                 title="Padroniza os nomes (Ex: JOAO SILVA -> Joao Silva)"
               >
                 {isFixingNames ? 'Processando...' : '✨ Padronizar Nomes'}
               </button>
             )}

             <div className="w-full md:w-64">
               <input 
                 type="text" 
                 placeholder="Buscar por nome, ID ou função..." 
                 className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
             </div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCollaborators.length === 0 && <p className="text-gray-400 col-span-full text-center py-8">Nenhum colaborador encontrado.</p>}
          
          {filteredCollaborators.map(c => (
            <div key={c.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all bg-white group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-400 to-purple-500"></div>
              
              <div className="flex justify-between items-start mb-2 pl-2">
                <div>
                   <h3 className="font-bold text-gray-800">{c.name}</h3>
                   <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      <span className="font-mono bg-gray-100 px-1 rounded">#{c.colabId}</span>
                      <span>•</span>
                      <span>{c.role}</span>
                   </div>
                </div>
                {canEdit && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                   <button onClick={() => handleEdit(c)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-full transition-colors" title="Editar">
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                   </button>
                   <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors" title="Excluir">
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                   </button>
                </div>
                )}
              </div>

              <div className="pl-2 mt-3 space-y-1">
                 <div className="text-xs text-gray-600 flex items-center gap-2">
                    <span className="text-gray-400">Filial:</span> {c.branch}
                 </div>
                 {c.sector && (
                   <div className="text-xs text-gray-600 flex items-center gap-2">
                      <span className="text-gray-400">Setor:</span> {c.sector}
                   </div>
                 )}
                 <div className="text-xs text-gray-600 flex items-center gap-2">
                    <span className="text-gray-400">Email:</span> {c.email}
                 </div>
                 {c.phone && (
                   <div className="text-xs text-gray-600 flex items-center gap-2">
                      <span className="text-gray-400">Tel:</span> {c.phone}
                   </div>
                 )}
              </div>
              
              <div className="pl-2 mt-3 border-t border-gray-100 pt-2 flex flex-wrap gap-2">
                 {c.shiftType && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-bold">{c.shiftType}</span>}
                 {c.hasRotation && c.rotationGroup && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-bold">Escala: {c.rotationGroup}</span>}
                 {c.role === 'admin' && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-bold">Admin</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};