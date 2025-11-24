

import React, { useState, useEffect } from 'react';
import { Collaborator, Schedule, DaySchedule, SystemSettings, UserProfile } from '../types';
import { generateUUID } from '../utils/helpers';

interface CollaboratorsProps {
  collaborators: Collaborator[];
  onAdd: (c: Collaborator) => void;
  onUpdate: (c: Collaborator) => void;
  onDelete: (id: string) => void;
  showToast: (msg: string, isError?: boolean) => void;
  settings: SystemSettings;
  currentUserProfile: UserProfile;
  canEdit: boolean; // Permissão ACL
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

export const Collaborators: React.FC<CollaboratorsProps> = ({ collaborators, onAdd, onUpdate, onDelete, showToast, settings, currentUserProfile, canEdit }) => {
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
  });
  
  const [schedule, setSchedule] = useState<Schedule>(JSON.parse(JSON.stringify(initialSchedule)));
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

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
    setFormData({ colabId: '', name: '', email: '', phone: '', otherContact: '', profile: 'colaborador', branch: '', role: '', sector: '', allowedSectors: [], login: '', shiftType: '' });
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

    // Clean up allowedSectors if role is not restricted (optional but good for data hygiene)
    const finalAllowedSectors = isRoleRestricted ? formData.allowedSectors : [];

    if (editingId) {
      onUpdate({
        id: editingId,
        ...formData,
        allowedSectors: finalAllowedSectors,
        schedule,
        createdAt: new Date().toISOString(),
      });
      showToast('Colaborador atualizado com sucesso!');
      handleCancelEdit();
    } else {
      const newColab: Collaborator = {
        id: generateUUID(),
        ...formData,
        allowedSectors: finalAllowedSectors,
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

  const daysOrder: (keyof Schedule)[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

  // Helper to check if profile list is available, otherwise fallback
  const profileOptions = settings.accessProfiles && settings.accessProfiles.length > 0 
    ? settings.accessProfiles 
    : ['admin', 'colaborador', 'noc'];

  const sectorOptions = settings.sectors || [];
  const scheduleTemplates = settings.scheduleTemplates || [];

  const filteredCollaborators = collaborators.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.colabId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

            {/* Nome */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Nome Completo *</label>
              <input required type="text" className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="Nome do colaborador" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>

            {/* Email (Vinculo Auth) */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">E-mail Google (Login) *</label>
              <input required type="email" className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="email@gmail.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              <span className="text-[10px] text-gray-400">Usado para autenticação no sistema</span>
            </div>

            {/* Perfil de Acesso */}
             <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Perfil de Acesso *</label>
              <select required className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white capitalize" value={formData.profile} onChange={e => setFormData({...formData, profile: e.target.value as UserProfile})}>
                 {profileOptions.map(p => (
                   <option key={p} value={p}>{p}</option>
                 ))}
              </select>
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

            {/* Outro Contato (Novo) */}
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

            {/* Branch Select */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Filial *</label>
              <select required className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})}>
                 <option value="">Selecione...</option>
                 {settings.branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Role Select */}
             <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Função *</label>
              <select required className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                 <option value="">Selecione...</option>
                 {settings.roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
              </select>
            </div>

            {/* Setor Select (Onde trabalha) */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Setor Principal (Lotação)</label>
              <select className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})}>
                 <option value="">Nenhum</option>
                 {sectorOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Login (Legado/Display) */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Usuário de Rede/Login *</label>
              <input required type="text" className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="Login de rede" value={formData.login} onChange={e => setFormData({...formData, login: e.target.value})} />
            </div>

            {/* Turno */}
            <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-600 mb-1">Turno *</label>
                <select
                  required
                  className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
                  value={formData.shiftType}
                  onChange={e => setFormData({...formData, shiftType: e.target.value})}
                >
                  <option value="">Selecione...</option>
                  <option value="adm">Administrativo</option>
                  <option value="1turno">1° Turno</option>
                  <option value="2turno">2° Turno</option>
                  <option value="3turno">3° Turno</option>
                  <option value="personalizado">Personalizado</option>
                </select>
            </div>
          </div>

          {/* ÁREA DE PERMISSÃO DE SETOR (SÓ APARECE SE A ROLE FOR RESTRITA) */}
          <div className={`p-4 rounded-xl border mb-6 transition-all ${isRoleRestricted ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
            <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
              Permissões de Visualização
              {!isRoleRestricted && <span className="text-[10px] bg-green-200 text-green-800 px-2 py-0.5 rounded">Global</span>}
              {isRoleRestricted && <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded">Restrito</span>}
            </h3>
            
            {!isRoleRestricted ? (
               <p className="text-sm text-gray-500">
                 A função selecionada <b>({formData.role || 'Nenhuma'})</b> tem permissão de visualização global. O usuário verá todos os setores.
               </p>
            ) : (
               <div>
                 <p className="text-sm text-gray-600 mb-3">
                   A função <b>{formData.role}</b> é restrita. Selecione abaixo quais setores este usuário poderá visualizar e gerenciar:
                 </p>
                 <div className="max-h-40 overflow-y-auto bg-white border border-gray-300 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {sectorOptions.length === 0 ? <span className="text-xs text-gray-400">Nenhum setor cadastrado nas configurações.</span> : 
                       sectorOptions.map(sector => (
                         <label key={sector} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                           <input 
                             type="checkbox" 
                             checked={formData.allowedSectors?.includes(sector) || false}
                             onChange={() => toggleAllowedSector(sector)}
                             className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                           />
                           <span className="text-sm text-gray-700">{sector}</span>
                         </label>
                       ))
                    }
                 </div>
                 {(!formData.allowedSectors || formData.allowedSectors.length === 0) && (
                   <p className="text-xs text-red-500 mt-1 font-bold">Selecione pelo menos um setor.</p>
                 )}
               </div>
            )}
          </div>

          <div className={`bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 ${formData.profile === 'noc' ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-gray-700">Jornada Semanal</h3>
              {formData.profile === 'noc' && <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded">Desabilitado para NOC</span>}
            </div>
            
            <div className="flex items-center gap-4 mb-4">
               <label className="text-xs font-semibold text-gray-600">Carregar Modelo:</label>
               <select 
                 className="flex-1 border border-indigo-300 bg-indigo-50 text-indigo-900 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                 value={selectedTemplateId}
                 onChange={e => handleTemplateSelect(e.target.value)}
               >
                 <option value="">-- Selecione para preencher automaticamente --</option>
                 {scheduleTemplates.map(t => (
                   <option key={t.id} value={t.id}>{t.name}</option>
                 ))}
               </select>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Configure os dias trabalhados. Se o turno inicia no dia anterior (Ex: A escala de Segunda começa Domingo às 22:00), marque a caixa <b>"Inicia dia anterior"</b>.
            </p>
            
            <div className="space-y-2">
              {daysOrder.map(day => (
                <div key={day} className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                  <label className="flex items-center gap-2 w-28 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={schedule[day].enabled}
                      onChange={e => handleScheduleChange(day, 'enabled', e.target.checked)}
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
                          disabled={!schedule[day].enabled}
                          value={schedule[day].start}
                          onChange={e => handleScheduleChange(day, 'start', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400 bg-white text-gray-700"
                        />
                         <label className="flex items-center gap-1 cursor-pointer" title="Marque se este horário de início pertence, na verdade, ao dia anterior (ex: 22:00 de ontem)">
                            <input 
                              type="checkbox"
                              disabled={!schedule[day].enabled}
                              checked={schedule[day].startsPreviousDay || false}
                              onChange={e => handleScheduleChange(day, 'startsPreviousDay', e.target.checked)}
                              className="w-3.5 h-3.5 text-red-500 rounded focus:ring-red-400"
                            />
                            <span className={`text-[10px] font-semibold ${schedule[day].startsPreviousDay ? 'text-red-600' : 'text-gray-400'}`}>Inicia -1d</span>
                         </label>
                       </div>
                     </div>

                     <div className="flex flex-col ml-4">
                       <span className="text-[10px] text-gray-400 mb-0.5">Fim</span>
                       <input
                        type="time"
                        disabled={!schedule[day].enabled}
                        value={schedule[day].end}
                        onChange={e => handleScheduleChange(day, 'end', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400 bg-white text-gray-700"
                      />
                     </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className={`font-bold py-2.5 px-6 rounded-lg shadow-md transition-transform active:scale-95 w-full md:w-auto text-white ${editingId ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-[#667eea] hover:bg-[#5a6fd6]'}`}>
            {editingId ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
          </button>
        </form>
      </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center text-blue-800">
          <p className="font-bold">Modo Leitura</p>
          <p className="text-sm">Seu perfil não permite editar colaboradores.</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <h2 className="text-xl font-bold text-gray-800">Colaboradores Cadastrados ({collaborators.length})</h2>
          <input 
            type="text" 
            placeholder="Pesquisar por Nome, ID ou Função..."
            className="border border-gray-300 rounded-lg p-2 text-sm w-full sm:w-64 focus:ring-2 focus:ring-indigo-500 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        {filteredCollaborators.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {collaborators.length === 0 ? 'Nenhum colaborador cadastrado.' : 'Nenhum colaborador encontrado para a busca.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCollaborators.map(colab => {
               const workDays = daysOrder
                .filter(d => colab.schedule[d].enabled)
                .map(d => {
                    const dayName = d.substr(0, 3);
                    const prevDay = colab.schedule[d].startsPreviousDay ? ' (Inicia -1d)' : '';
                    return `${dayName}${prevDay}`;
                })
                .join(', ');

               return (
                <div key={colab.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors group">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded">ID: {colab.colabId}</span>
                      <h3 className="font-bold text-gray-800">{colab.name}</h3>
                      <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded ml-auto md:ml-0">{colab.shiftType}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border uppercase ${colab.profile === 'admin' ? 'bg-red-50 text-red-600 border-red-200' : colab.profile === 'noc' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-gray-50 text-gray-600'}`}>
                        {colab.profile}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 grid grid-cols-1 sm:grid-cols-3 gap-2">
                       <span>🏢 {colab.branch}</span>
                       <span>🔧 {colab.role}</span>
                       <span>🛡️ {colab.sector || 'Sem Setor'}</span>
                    </div>
                    {colab.allowedSectors && colab.allowedSectors.length > 0 && (
                      <div className="text-xs text-indigo-600 mt-1">
                         👁️ Vê: {colab.allowedSectors.join(', ')}
                      </div>
                    )}
                    <div className="text-sm text-gray-600 mt-1">
                       📧 {colab.email || 'Sem e-mail'} | 📞 {canEdit ? (colab.phone || 'Sem telefone') : '***********'}
                       {colab.otherContact && canEdit && <span className="ml-2">| 💬 {colab.otherContact}</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      📅 {workDays || 'Sem escala definida'}
                    </div>
                  </div>
                  
                  {canEdit && (
                    <div className="flex gap-2 mt-4 md:mt-0">
                      <button 
                        onClick={() => handleEdit(colab)}
                        className="text-blue-500 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded text-sm font-medium transition-colors"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={() => handleDelete(colab.id)}
                        className="text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded text-sm font-medium transition-colors"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};