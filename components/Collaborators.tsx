
import React, { useState, useEffect, useMemo } from 'react';
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
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  currentUserAllowedSectors: string[];
  currentUserRole: string; 
  availableBranches: string[]; // Recebe as filiais permitidas para o usuário logado
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
  collaborators, onAdd, onUpdate, onDelete, showToast, settings, currentUserProfile, canCreate, canUpdate, canDelete,
  currentUserAllowedSectors, currentUserRole, availableBranches
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
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
    leaderId: '', 
    allowedSectors: [] as string[],
    login: '',
    shiftType: '',
    hasRotation: false,
    rotationGroup: '',
    rotationStartDate: '',
    active: true,
  });
  
  const [schedule, setSchedule] = useState<Schedule>(JSON.parse(JSON.stringify(initialSchedule)));
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isFixingNames, setIsFixingNames] = useState(false);

  const isFormActive = showForm || editingId;

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

  const selectedRoleConfig = settings.roles.find(r => r.name === formData.role);
  const isRoleRestricted = selectedRoleConfig ? !selectedRoleConfig.canViewAllSectors : false;

  const handleAddNew = () => {
    if (!canCreate) return;
    setShowForm(true);
    setEditingId(null);
    
    // Auto-select branch if restricted
    const initialBranch = availableBranches.length === 1 ? availableBranches[0] : '';

    setFormData({ 
      colabId: '', name: '', email: '', phone: '', otherContact: '', profile: 'colaborador', 
      branch: initialBranch, 
      role: '', sector: '', leaderId: '', allowedSectors: [], login: '', shiftType: '', 
      hasRotation: false, rotationGroup: '', rotationStartDate: '', active: true
    });
    setSchedule(JSON.parse(JSON.stringify(initialSchedule)));
  };

  const handleEdit = (colab: Collaborator) => {
    if (!canUpdate) return;
    setEditingId(colab.id);
    setShowForm(true);
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
      leaderId: colab.leaderId || '',
      allowedSectors: colab.allowedSectors || [],
      login: colab.login,
      shiftType: colab.shiftType,
      hasRotation: colab.hasRotation || false,
      rotationGroup: colab.rotationGroup || '',
      rotationStartDate: colab.rotationStartDate || '',
      active: colab.active ?? true,
    });
    
    const safeSchedule = JSON.parse(JSON.stringify(colab.schedule));
    Object.keys(safeSchedule).forEach(key => {
        if (safeSchedule[key].startsPreviousDay === undefined) {
            safeSchedule[key].startsPreviousDay = false;
        }
    });
    setSchedule(safeSchedule);
    setSelectedTemplateId('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setShowForm(false);
    setFormData({ 
      colabId: '', name: '', email: '', phone: '', otherContact: '', profile: 'colaborador', branch: '', role: '', sector: '', leaderId: '', allowedSectors: [], login: '', shiftType: '', 
      hasRotation: false, rotationGroup: '', rotationStartDate: '', active: true
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
    if (formData.email) {
      const isDuplicateEmail = collaborators.some(c => c.email === formData.email && c.id !== editingId);
      if (isDuplicateEmail) {
        showToast('Já existe um colaborador com este E-mail', true);
        return;
      }
    }

    if (!formData.phone && !isNoc) {
       showToast('Telefone é obrigatório para este perfil.', true);
       return;
    }

    const hasWorkDays = (Object.values(schedule) as DaySchedule[]).some(day => day.enabled && day.start && day.end);
    if (!hasWorkDays && !isNoc && formData.active) {
      showToast('Defina pelo menos um dia de trabalho com horários (ou inative o colaborador).', true);
      return;
    }

    if (isRoleRestricted && (!formData.allowedSectors || formData.allowedSectors.length === 0)) {
       showToast('Esta função exige que pelo menos um setor de visualização seja selecionado.', true);
       return;
    }
    
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

    const finalAllowedSectors = isRoleRestricted ? formData.allowedSectors : [];
    
    const finalRotationGroup = formData.hasRotation ? formData.rotationGroup : '';
    const finalRotationStart = formData.hasRotation ? formData.rotationStartDate : '';

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
    if (!canDelete) return;
    if (window.confirm('Tem certeza que deseja excluir?')) {
      onDelete(id);
      showToast('Colaborador removido.');
    }
  };

  const handleFixAllNames = async () => {
    if (!window.confirm('Isso irá padronizar a formatação dos nomes de TODOS os colaboradores. Deseja continuar?')) {
      return;
    }
    
    setIsFixingNames(true);
    let count = 0;
    
    try {
      for (const colab of collaborators) {
        if (currentUserAllowedSectors.length > 0) {
           if (!colab.sector || !currentUserAllowedSectors.includes(colab.sector)) continue;
        }

        const formatted = formatTitleCase(colab.name);
        if (formatted !== colab.name) {
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

  const profileOptions = React.useMemo(() => {
    let available = (settings.accessProfiles || [])
       .filter(p => p.active)
       .map(p => p.name);

    if (available.length === 0) {
        available = ['colaborador']; 
    }

    if (currentUserProfile === 'admin') {
       return available;
    }

    const currentRoleConfig = settings.roles.find(r => r.name === currentUserRole);
    if (currentRoleConfig && currentRoleConfig.manageableProfiles && currentRoleConfig.manageableProfiles.length > 0) {
       return available.filter(p => currentRoleConfig.manageableProfiles!.includes(p));
    }

    return available;

  }, [settings.accessProfiles, settings.roles, currentUserRole, currentUserProfile]);

  const potentialLeaders = useMemo(() => {
    const leadershipKeywords = ['líder', 'lider', 'supervisor', 'coordenador', 'gerente', 'diretor', 'head', 'encarregado', 'ceo', 'presidência'];

    return collaborators
      .filter(c => {
         if (c.active === false) return false;
         if (c.id === editingId) return false;
         if (formData.branch && c.branch !== formData.branch) return false;
         const roleName = c.role.toLowerCase();
         const isLeaderRole = leadershipKeywords.some(k => roleName.includes(k));
         const isAdminOrManager = ['admin', 'gerente'].includes(roleName);
         return isLeaderRole || isAdminOrManager;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [collaborators, editingId, formData.branch]);

  const getLeaderName = (leaderId?: string) => {
    if (!leaderId) return null;
    const leader = collaborators.find(c => c.id === leaderId);
    return leader ? leader.name : 'Não encontrado';
  };

  // --- SECTORS LOGIC (DEPENDS ON BRANCH AND PERMISSIONS) ---
  const sectorOptions = useMemo(() => {
      if (!formData.branch) return [];
      
      // Use branch-specific sectors if available, otherwise fallback to global
      let branchSectors: string[] = [];
      if (settings.branchSectors && settings.branchSectors[formData.branch]) {
          branchSectors = settings.branchSectors[formData.branch];
      } else {
          branchSectors = settings.sectors || [];
      }

      // NOVO: Filtrar se o usuário tiver restrição de setor (currentUserAllowedSectors)
      // Se a lista de setores permitidos não estiver vazia, retornamos apenas a interseção
      if (currentUserAllowedSectors && currentUserAllowedSectors.length > 0) {
          return branchSectors.filter(s => currentUserAllowedSectors.includes(s));
      }

      return branchSectors;
  }, [formData.branch, settings.branchSectors, settings.sectors, currentUserAllowedSectors]);

  const scheduleTemplates = settings.scheduleTemplates || [];
  const rotationOptions = settings.shiftRotations || [];

  const filteredCollaborators = collaborators.filter(c => {
    // 1. Filtrar por Setor Permitido (Visualização)
    if (currentUserAllowedSectors.length > 0) {
      if (!c.sector || !currentUserAllowedSectors.includes(c.sector)) {
        return false;
      }
    }
    
    // 2. Filtrar por Filial Permitida (Visualização) - NOVO
    // Se o usuário só pode ver certas filiais, não mostre colaboradores de outras
    if (availableBranches.length > 0 && !availableBranches.includes(c.branch)) {
        return false;
    }

    return (
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.colabId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8">
      {isFormActive && (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            {editingId ? 'Editar Colaborador' : 'Cadastrar Colaborador'}
          </h2>
          <button onClick={handleCancelEdit} className="text-sm text-gray-500 hover:text-gray-700 underline">
            Cancelar
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          {editingId && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between animate-fadeIn">
              <span className="text-sm font-bold text-gray-700">Status do Colaborador</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={e => setFormData({...formData, active: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                <span className={`ml-3 text-sm font-bold ${formData.active ? 'text-green-600' : 'text-gray-500'}`}>
                  {formData.active ? 'Ativo' : 'Inativo'}
                </span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">ID (Matrícula) *</label>
              <input required type="text" className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="Ex: 001" value={formData.colabId} onChange={e => setFormData({...formData, colabId: e.target.value})} />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Usuário de Rede/Login *</label>
              <input required type="text" className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="nome.sobrenome" value={formData.login} onChange={e => setFormData({...formData, login: e.target.value})} />
            </div>

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

            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">E-mail Google (Login) *</label>
              <input required type="email" className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="email@gmail.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              <span className="text-[10px] text-gray-400">Usado para autenticação no sistema</span>
            </div>

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

            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Perfil de Acesso *</label>
              <select required className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white capitalize" value={formData.profile} onChange={e => setFormData({...formData, profile: e.target.value as UserProfile})}>
                 {profileOptions.length === 0 && <option value="">Nenhum perfil disponível</option>}
                 {profileOptions.map(p => (
                   <option key={p} value={p}>{p}</option>
                 ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Filial *</label>
              <select 
                required 
                className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                value={formData.branch} 
                onChange={e => setFormData({...formData, branch: e.target.value, leaderId: '', sector: ''})}
                // Se só existe uma filial disponível (restrição), desabilita a troca ou apenas exibe essa.
                // Como filtramos o map abaixo, o usuário só verá as permitidas. 
                // Se tiver apenas 1, já estará selecionada.
              >
                 <option value="">Selecione...</option>
                 {availableBranches.map(b => (
                   <option key={b} value={b}>{b}</option>
                 ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Função *</label>
              <select required className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                 <option value="">Selecione...</option>
                 {settings.roles.map(r => (
                   <option key={r.name} value={r.name}>{r.name}</option>
                 ))}
              </select>
            </div>

            <div className="flex flex-col md:col-span-2">
              <label className="text-xs font-semibold text-gray-600 mb-1">Setor Principal (Lotação)</label>
              <select 
                 className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white disabled:bg-gray-100"
                 value={formData.sector} 
                 onChange={e => setFormData({...formData, sector: e.target.value})}
                 disabled={!formData.branch}
              >
                 <option value="">{formData.branch ? 'Selecione (Opcional)...' : 'Selecione a Filial primeiro'}</option>
                 {sectorOptions.map(s => (
                   <option key={s} value={s}>{s}</option>
                 ))}
              </select>
            </div>

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

            <div className="flex flex-col md:col-span-1">
              <label className="text-xs font-semibold text-gray-600 mb-1">Líder Imediato</label>
              <select 
                 className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                 value={formData.leaderId} 
                 onChange={e => setFormData({...formData, leaderId: e.target.value})}
                 disabled={!formData.branch}
              >
                 <option value="">Sem Líder (Topo Hierarquia)</option>
                 {potentialLeaders.map(l => (
                   <option key={l.id} value={l.id}>{l.name} - {l.role} {l.sector ? `(${l.sector})` : ''}</option>
                 ))}
              </select>
              <span className="text-[10px] text-gray-400">
                 {!formData.branch 
                    ? "Selecione a Filial para carregar os líderes." 
                    : "Exibindo apenas líderes da mesma filial."}
              </span>
            </div>
            
             {isRoleRestricted && (
                <div className="md:col-span-3 bg-gray-50 p-4 rounded-lg border border-gray-200 animate-fadeIn">
                   <div className="flex justify-between items-start mb-2">
                      <label className="text-sm font-bold text-gray-700">Permissões de Visualização <span className="text-red-500">*</span></label>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">Função Restrita</span>
                   </div>
                   <p className="text-xs text-gray-500 mb-3">A função selecionada ({formData.role}) tem visualização restrita. Selecione quais setores este usuário pode ver.</p>
                   
                   {!formData.branch ? (
                       <p className="text-sm text-red-500 font-bold">Selecione uma filial para ver os setores disponíveis.</p>
                   ) : (
                   <div className="flex flex-wrap gap-2">
                      {sectorOptions.length === 0 && <p className="text-xs text-gray-400">Nenhum setor disponível nesta filial.</p>}
                      {sectorOptions.map(sector => (
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
                   )}
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
             <button 
              type="button" 
              onClick={handleCancelEdit}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition"
             >
               Cancelar
             </button>
             <button 
              type="submit" 
              className="bg-[#667eea] hover:bg-[#5a6fd6] text-white font-bold py-2.5 px-6 rounded-lg shadow-md transition-transform active:scale-95"
             >
               {editingId ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
             </button>
          </div>
        </form>
      </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
           <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-gray-800">Equipe Cadastrada</h2>
              {canCreate && !isFormActive && (
                <button 
                  onClick={handleAddNew}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2 px-4 rounded-lg shadow-md transition-transform active:scale-95 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Novo Colaborador
                </button>
              )}
           </div>
           
           <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto items-center">
             {canUpdate && (
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
          
          {filteredCollaborators.map(c => {
            const leaderName = getLeaderName(c.leaderId);
            return (
            <div key={c.id} className={`border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all bg-white group relative overflow-hidden ${c.active === false ? 'opacity-60 bg-gray-50' : ''}`}>
              <div className={`absolute top-0 left-0 w-1 h-full ${c.active === false ? 'bg-gray-400' : 'bg-gradient-to-b from-indigo-400 to-purple-500'}`}></div>
              
              <div className="flex justify-between items-start mb-2 pl-2">
                <div>
                   <h3 className="font-bold text-gray-800">{c.name}</h3>
                   <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      <span className="font-mono bg-gray-100 px-1 rounded">#{c.colabId}</span>
                      <span>•</span>
                      <span>{c.role}</span>
                      {c.active === false && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-bold text-[10px] uppercase">
                             Inativo
                          </span>
                      )}
                   </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                   {canUpdate && (
                   <button onClick={() => handleEdit(c)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-full transition-colors" title="Editar">
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                   </button>
                   )}
                   {canDelete && (
                   <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors" title="Excluir">
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                   </button>
                   )}
                </div>
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
                 {leaderName && (
                   <div className="text-xs text-gray-600 flex items-center gap-2">
                      <span className="text-gray-400">Líder:</span> <span className="font-medium text-indigo-600">{leaderName}</span>
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
          );
          })}
        </div>
      </div>
    </div>
  );
};
