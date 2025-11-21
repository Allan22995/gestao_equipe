
import React, { useState } from 'react';
import { Collaborator, Schedule, DaySchedule, SystemSettings } from '../types';
import { generateUUID } from '../utils/helpers';

interface CollaboratorsProps {
  collaborators: Collaborator[];
  onAdd: (c: Collaborator) => void;
  onUpdate: (c: Collaborator) => void;
  onDelete: (id: string) => void;
  showToast: (msg: string, isError?: boolean) => void;
  settings: SystemSettings;
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

export const Collaborators: React.FC<CollaboratorsProps> = ({ collaborators, onAdd, onUpdate, onDelete, showToast, settings }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    colabId: '',
    name: '',
    branch: '',
    role: '',
    login: '',
    shiftType: '',
  });
  
  const [schedule, setSchedule] = useState<Schedule>(JSON.parse(JSON.stringify(initialSchedule)));

  const handleScheduleChange = (day: keyof Schedule, field: keyof DaySchedule, value: any) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const handleEdit = (colab: Collaborator) => {
    setEditingId(colab.id);
    setFormData({
      colabId: colab.colabId,
      name: colab.name,
      branch: colab.branch,
      role: colab.role,
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ colabId: '', name: '', branch: '', role: '', login: '', shiftType: '' });
    setSchedule(JSON.parse(JSON.stringify(initialSchedule)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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

    const hasWorkDays = (Object.values(schedule) as DaySchedule[]).some(day => day.enabled && day.start && day.end);
    if (!hasWorkDays) {
      showToast('Defina pelo menos um dia de trabalho com horários', true);
      return;
    }

    if (editingId) {
      onUpdate({
        id: editingId,
        ...formData,
        schedule,
        createdAt: new Date().toISOString(), // Keep original? Firestore ignores this usually if we don't pass it, but we are passing full obj
      });
      showToast('Colaborador atualizado com sucesso!');
      handleCancelEdit();
    } else {
      const newColab: Collaborator = {
        id: generateUUID(), // Frontend ID, Firestore will rewrite it if we used addDoc properly, but here we pass it
        ...formData,
        schedule,
        createdAt: new Date().toISOString(),
      };

      onAdd(newColab);
      showToast('Colaborador cadastrado com sucesso!');
      handleCancelEdit();
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir?')) {
      onDelete(id);
      showToast('Colaborador removido.');
    }
  };

  const daysOrder: (keyof Schedule)[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

  return (
    <div className="space-y-8">
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
                 {settings.roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Login */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Login *</label>
              <input required type="text" className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="Login de acesso" value={formData.login} onChange={e => setFormData({...formData, login: e.target.value})} />
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

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
            <h3 className="font-bold text-gray-700 mb-2">Jornada Semanal</h3>
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
                            <span className={`text-[10px] font-semibold ${schedule[day].startsPreviousDay ? 'text-red-600' : 'text-gray-400'}`}>Inicia dia anterior</span>
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

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Colaboradores Cadastrados ({collaborators.length})</h2>
        
        {collaborators.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Nenhum colaborador cadastrado.</div>
        ) : (
          <div className="space-y-3">
            {collaborators.map(colab => {
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
                    </div>
                    <div className="text-sm text-gray-600 grid grid-cols-1 sm:grid-cols-3 gap-2">
                       <span>🏢 {colab.branch}</span>
                       <span>🔧 {colab.role}</span>
                       <span>👤 {colab.login}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      📅 {workDays}
                    </div>
                  </div>
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
