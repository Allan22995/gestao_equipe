import React, { useState, useEffect, useMemo } from 'react';
import { Collaborator, Schedule, DaySchedule, SystemSettings, UserProfile } from '../types';
import { generateUUID, formatTitleCase, weekDayMap } from '../utils/helpers';
import { MultiSelect } from './ui/MultiSelect';

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
  collaborators, onAdd, onUpdate, onDelete, showToast, settings, currentUserProfile, canEdit, currentUserAllowedSectors, currentUserRole
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterName, setFilterName] = useState('');
  const [filterBranches, setFilterBranches] = useState<string[]>([]);
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterSectors, setFilterSectors] = useState<string[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    colabId: '',
    name: '',
    email: '',
    phone: '',
    otherContact: '',
    profile: 'colaborador' as UserProfile,
    branch: settings.branches[0] || '',
    role: '',
    sector: '',
    shiftType: '',
    schedule: JSON.parse(JSON.stringify(initialSchedule)) as Schedule,
    hasRotation: false,
    rotationGroup: '',
    rotationStartDate: '',
    active: true,
    leaderId: ''
  });

  // Calculate available filters/options based on permissions
  const availableBranches = useMemo(() => {
     // If user is restricted to a branch (logic handled in parent), we might only see that one.
     // But here we rely on settings mostly. In a real scenario, this might need stricter filtering if `collaborators` prop isn't already filtered.
     return settings.branches;
  }, [settings.branches]);

  const availableSectors = useMemo(() => {
     let sectors = settings.sectors;
     // Filter sectors by selected branches if any
     if (formData.branch) {
        sectors = sectors.filter(s => s.branch === formData.branch);
     }
     return sectors.map(s => s.name);
  }, [settings.sectors, formData.branch]);

  // Profiles allowed to be assigned by current user
  const allowedProfilesToAssign = useMemo(() => {
      if (currentUserProfile === 'admin') return settings.accessProfiles.filter(p => p.active);
      
      const currentRoleConfig = settings.roles.find(r => r.name === currentUserRole);
      if (currentRoleConfig && currentRoleConfig.manageableProfiles) {
          return settings.accessProfiles.filter(p => p.active && currentRoleConfig.manageableProfiles?.includes(p.id));
      }
      return [];
  }, [currentUserProfile, currentUserRole, settings.roles, settings.accessProfiles]);

  // List Filtering
  const filteredCollaborators = useMemo(() => {
    return collaborators.filter(c => {
      // 1. Sector Restriction
      if (currentUserAllowedSectors.length > 0) {
         if (!c.sector || !currentUserAllowedSectors.includes(c.sector)) return false;
      }

      // 2. Name Filter
      if (filterName && !c.name.toLowerCase().includes(filterName.toLowerCase())) return false;

      // 3. Branch Filter
      if (filterBranches.length > 0 && !filterBranches.includes(c.branch)) return false;

      // 4. Role Filter
      if (filterRoles.length > 0 && !filterRoles.includes(c.role)) return false;

      // 5. Sector Filter
      if (filterSectors.length > 0 && (!c.sector || !filterSectors.includes(c.sector))) return false;

      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [collaborators, filterName, filterBranches, filterRoles, filterSectors, currentUserAllowedSectors]);

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      colabId: '',
      name: '',
      email: '',
      phone: '',
      otherContact: '',
      profile: 'colaborador',
      branch: settings.branches[0] || '',
      role: '',
      sector: '',
      shiftType: '',
      schedule: JSON.parse(JSON.stringify(initialSchedule)),
      hasRotation: false,
      rotationGroup: '',
      rotationStartDate: '',
      active: true,
      leaderId: ''
    });
  };

  const handleEdit = (c: Collaborator) => {
    setEditingId(c.id);
    setFormData({
      colabId: c.colabId,
      name: c.name,
      email: c.email,
      phone: c.phone || '',
      otherContact: c.otherContact || '',
      profile: c.profile,
      branch: c.branch,
      role: c.role,
      sector: c.sector || '',
      shiftType: c.shiftType,
      schedule: c.schedule || JSON.parse(JSON.stringify(initialSchedule)),
      hasRotation: !!c.hasRotation,
      rotationGroup: c.rotationGroup || '',
      rotationStartDate: c.rotationStartDate || '',
      active: c.active !== false,
      leaderId: c.leaderId || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyTemplate = (templateId: string) => {
    if (!templateId) return;
    const template = settings.scheduleTemplates.find(t => t.id === templateId);
    if (template) {
       setFormData(prev => ({
          ...prev,
          schedule: JSON.parse(JSON.stringify(template.schedule))
       }));
       showToast(`Jornada "${template.name}" aplicada!`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.role || !formData.branch) {
        showToast('Preencha os campos obrigatórios (Nome, Email, Função, Filial).', true);
        return;
    }

    // Validation for Rotation
    if (formData.hasRotation) {
        if (!formData.rotationGroup) {
            showToast('Para escala de revezamento, selecione o Grupo (A, B, C...).', true);
            return;
        }
        if (!formData.rotationStartDate) {
            showToast('Para escala 3x1, informe a data da última folga (referência).', true);
            return;
        }
    }

    const colabData: any = {
      colabId: formData.colabId || 'AUTO',
      name: formatTitleCase(formData.name),
      email: formData.email.toLowerCase(),
      phone: formData.phone,
      otherContact: formData.otherContact,
      profile: formData.profile,
      branch: formData.branch,
      role: formData.role,
      sector: formData.sector,
      shiftType: formData.shiftType,
      schedule: formData.schedule,
      hasRotation: formData.hasRotation,
      rotationGroup: formData.hasRotation ? formData.rotationGroup : undefined,
      rotationStartDate: formData.hasRotation ? formData.rotationStartDate : undefined,
      active: formData.active,
      leaderId: formData.leaderId,
      login: formData.email.toLowerCase() // Legacy field
    };

    if (editingId) {
       onUpdate({ id: editingId, ...colabData, createdAt: collaborators.find(c => c.id === editingId)?.createdAt || new Date().toISOString() });
       showToast('Colaborador atualizado!');
    } else {
       onAdd({ ...colabData, createdAt: new Date().toISOString() });
       showToast('Colaborador adicionado!');
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
      if (window.confirm('Tem certeza que deseja excluir este colaborador?')) {
          onDelete(id);
          showToast('Colaborador excluído.');
      }
  };

  // Helper for Days of Week
  const days: (keyof Schedule)[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

  return (
    <div className="space-y-8">
      {/* FORM SECTION */}
      {canEdit ? (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
         <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Editar Colaborador' : 'Novo Colaborador'}</h2>
            {editingId && <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700 underline">Cancelar</button>}
         </div>

         <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-1">
                   <label className="text-xs font-semibold text-gray-600 mb-1 block">ID / Matrícula</label>
                   <input type="text" className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={formData.colabId} onChange={e => setFormData({...formData, colabId: e.target.value})} placeholder="Opcional" />
                </div>
                <div className="lg:col-span-2">
                   <label className="text-xs font-semibold text-gray-600 mb-1 block">Nome Completo *</label>
                   <input type="text" required className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nome do colaborador" />
                </div>
                <div className="lg:col-span-1">
                   <label className="text-xs font-semibold text-gray-600 mb-1 block">E-mail (Login) *</label>
                   <input type="email" required className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@empresa.com" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                   <label className="text-xs font-semibold text-gray-600 mb-1 block">Telefone / WhatsApp</label>
                   <input type="text" className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(00) 00000-0000" />
                </div>
                <div>
                   <label className="text-xs font-semibold text-gray-600 mb-1 block">Outro Contato</label>
                   <input type="text" className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={formData.otherContact} onChange={e => setFormData({...formData, otherContact: e.target.value})} placeholder="Gchat, Slack..." />
                </div>
                <div>
                   <label className="text-xs font-semibold text-gray-600 mb-1 block">Status</label>
                   <select className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={formData.active ? 'true' : 'false'} onChange={e => setFormData({...formData, active: e.target.value === 'true'})}>
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                   </select>
                </div>
                <div>
                   <label className="text-xs font-semibold text-gray-600 mb-1 block">Perfil de Acesso</label>
                   <select 
                     className="w-full border border-gray-300 rounded-lg p-2 text-sm" 
                     value={formData.profile} 
                     onChange={e => setFormData({...formData, profile: e.target.value as UserProfile})}
                     disabled={allowedProfilesToAssign.length === 0}
                   >
                      {allowedProfilesToAssign.length > 0 ? (
                          allowedProfilesToAssign.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                      ) : (
                          <option value={formData.profile}>{formData.profile} (Sem permissão para alterar)</option>
                      )}
                   </select>
                </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
               <h3 className="text-sm font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">Lotação e Função</h3>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                     <label className="text-xs font-semibold text-gray-600 mb-1 block">Filial *</label>
                     <select required className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value, sector: ''})}>
                        <option value="">Selecione...</option>
                        {settings.branches.map(b => <option key={b} value={b}>{b}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="text-xs font-semibold text-gray-600 mb-1 block">Setor</label>
                     <select className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})}>
                        <option value="">Selecione...</option>
                        {availableSectors.map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="text-xs font-semibold text-gray-600 mb-1 block">Função (Role) *</label>
                     <select required className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                        <option value="">Selecione...</option>
                        {settings.roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                     </select>
                  </div>
               </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
               <div className="flex flex-wrap justify-between items-center mb-3 border-b border-gray-200 pb-2">
                  <h3 className="text-sm font-bold text-gray-700">Jornada de Trabalho</h3>
                  <div className="flex items-center gap-2">
                     <span className="text-xs text-gray-500">Aplicar Modelo:</span>
                     <select className="border border-gray-300 rounded p-1 text-xs" onChange={(e) => applyTemplate(e.target.value)} defaultValue="">
                        <option value="" disabled>Selecione...</option>
                        {settings.scheduleTemplates
                           .filter(t => !t.branch || t.branch === formData.branch)
                           .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                        }
                     </select>
                  </div>
               </div>

               {/* Shift Rotation Toggle */}
               <div className="mb-4 flex flex-col md:flex-row gap-4 items-start md:items-center bg-white p-3 rounded border border-indigo-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                     <input type="checkbox" className="rounded text-indigo-600" checked={formData.hasRotation} onChange={e => setFormData({...formData, hasRotation: e.target.checked})} />
                     <span className="text-sm font-bold text-indigo-900">Trabalha em Escala de Revezamento?</span>
                  </label>
                  
                  {formData.hasRotation && (
                     <div className="flex gap-4 flex-1 animate-fadeIn">
                        <div className="flex-1">
                           <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Grupo da Escala</label>
                           <select className="w-full border border-indigo-200 rounded p-1.5 text-sm" value={formData.rotationGroup} onChange={e => setFormData({...formData, rotationGroup: e.target.value})}>
                              <option value="">Selecione...</option>
                              {settings.shiftRotations.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                           </select>
                        </div>
                        <div className="flex-1">
                           <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Data Última Folga (Domingo Ref.)</label>
                           <input type="date" className="w-full border border-indigo-200 rounded p-1.5 text-sm" value={formData.rotationStartDate} onChange={e => setFormData({...formData, rotationStartDate: e.target.value})} />
                        </div>
                     </div>
                  )}
               </div>

               <div className="space-y-2">
                  {days.map(day => (
                     <div key={day} className="flex items-center gap-2 md:gap-4 bg-white p-2 rounded border border-gray-100">
                        <label className="w-24 flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded text-indigo-600" checked={formData.schedule[day].enabled} onChange={e => setFormData({...formData, schedule: {...formData.schedule, [day]: {...formData.schedule[day], enabled: e.target.checked}}})} />
                            <span className="text-sm capitalize font-medium">{day}</span>
                        </label>
                        <input type="time" disabled={!formData.schedule[day].enabled} value={formData.schedule[day].start} onChange={e => setFormData({...formData, schedule: {...formData.schedule, [day]: {...formData.schedule[day], start: e.target.value}}})} className="border rounded p-1 text-sm w-24" />
                        <span className="text-gray-400">-</span>
                        <input type="time" disabled={!formData.schedule[day].enabled} value={formData.schedule[day].end} onChange={e => setFormData({...formData, schedule: {...formData.schedule, [day]: {...formData.schedule[day], end: e.target.value}}})} className="border rounded p-1 text-sm w-24" />
                        
                        <label className="ml-auto flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" disabled={!formData.schedule[day].enabled} checked={formData.schedule[day].startsPreviousDay} onChange={e => setFormData({...formData, schedule: {...formData.schedule, [day]: {...formData.schedule[day], startsPreviousDay: e.target.checked}}})} />
                            <span className="text-[10px] text-gray-500">Inicia -1d</span>
                        </label>
                     </div>
                  ))}
               </div>
            </div>

            <div className="flex justify-end pt-4">
               <button type="submit" className="bg-[#667eea] hover:bg-[#5a6fd6] text-white font-bold py-3 px-8 rounded-lg shadow-md transition-transform active:scale-95">
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
               </button>
            </div>
         </form>
      </div>
      ) : (
         <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center text-blue-800">
            <p className="font-bold">Modo Leitura</p>
         </div>
      )}

      {/* LIST SECTION */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
         <h2 className="text-xl font-bold text-gray-800 mb-6">Lista de Colaboradores</h2>
         
         {/* FILTERS */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded-lg z-20 relative">
            <div>
               <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Buscar Nome</label>
               <input type="text" className="w-full border border-gray-300 rounded p-2 text-sm" placeholder="Nome..." value={filterName} onChange={e => setFilterName(e.target.value)} />
            </div>
            <div>
               <MultiSelect label="Filiais" options={settings.branches} selected={filterBranches} onChange={setFilterBranches} placeholder="Todas" />
            </div>
            <div>
               <MultiSelect 
                  label="Setores" 
                  options={Array.from(new Set(settings.sectors.map(s => s.name)))} 
                  selected={filterSectors} 
                  onChange={setFilterSectors} 
                  placeholder="Todos" 
               />
            </div>
            <div>
               <MultiSelect 
                  label="Funções" 
                  options={settings.roles.map(r => r.name)} 
                  selected={filterRoles} 
                  onChange={setFilterRoles} 
                  placeholder="Todas" 
               />
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                     <th className="p-3 rounded-tl-lg">Nome / Email</th>
                     <th className="p-3">Filial / Setor</th>
                     <th className="p-3">Função / Perfil</th>
                     <th className="p-3">Status</th>
                     {canEdit && <th className="p-3 rounded-tr-lg text-right">Ações</th>}
                  </tr>
               </thead>
               <tbody className="text-sm divide-y divide-gray-100">
                  {filteredCollaborators.length === 0 ? (
                     <tr>
                        <td colSpan={5} className="p-6 text-center text-gray-400">Nenhum colaborador encontrado.</td>
                     </tr>
                  ) : filteredCollaborators.map(c => (
                     <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3">
                           <div className="font-bold text-gray-800">{c.name}</div>
                           <div className="text-xs text-gray-500">{c.email}</div>
                           {c.phone && <div className="text-[10px] text-gray-400 mt-0.5">📞 {c.phone}</div>}
                        </td>
                        <td className="p-3">
                           <div className="text-gray-700">{c.branch}</div>
                           <div className="text-xs text-gray-500">{c.sector || '-'}</div>
                        </td>
                        <td className="p-3">
                           <div className="font-medium text-indigo-600">{c.role}</div>
                           <div className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded inline-block mt-1">{c.profile}</div>
                        </td>
                        <td className="p-3">
                           {c.active !== false ? (
                              <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">Ativo</span>
                           ) : (
                              <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded">Inativo</span>
                           )}
                           {c.hasRotation && <div className="mt-1 text-[10px] font-bold text-purple-600">Escala {c.rotationGroup}</div>}
                        </td>
                        {canEdit && (
                           <td className="p-3 text-right">
                              <button onClick={() => handleEdit(c)} className="text-blue-500 hover:text-blue-700 font-bold text-xs mr-3">Editar</button>
                              <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700 font-bold text-xs">Excluir</button>
                           </td>
                        )}
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};
