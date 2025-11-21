
import React, { useState } from 'react';
import { Collaborator, OnCallRecord } from '../types';
import { generateUUID, formatDate, promptForUser } from '../utils/helpers';

interface OnCallProps {
  collaborators: Collaborator[];
  onCalls: OnCallRecord[];
  onAdd: (o: OnCallRecord) => void;
  onUpdate: (o: OnCallRecord) => void;
  onDelete: (id: string) => void;
  showToast: (msg: string, isError?: boolean) => void;
  logAction: (action: string, entity: string, details: string, user: string) => void;
}

const CalendarIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export const OnCall: React.FC<OnCallProps> = ({ collaborators, onCalls, onAdd, onUpdate, onDelete, showToast, logAction }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    collaboratorId: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    observation: ''
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      collaboratorId: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      observation: ''
    });
  };

  const handleEdit = (record: OnCallRecord) => {
    setEditingId(record.id);
    setFormData({
      collaboratorId: record.collaboratorId,
      startDate: record.startDate,
      endDate: record.endDate,
      startTime: record.startTime,
      endTime: record.endTime,
      observation: record.observation
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingId) {
      const newRecord: OnCallRecord = {
        id: generateUUID(),
        ...formData,
        createdAt: new Date().toISOString()
      };
      onAdd(newRecord);
      showToast('Plantão registrado!');
      resetForm();
    } else {
      const user = promptForUser('Editar Plantão');
      if (!user) return;

      onUpdate({
        id: editingId,
        ...formData,
        updatedBy: user,
        lastUpdatedAt: new Date().toISOString()
      } as OnCallRecord);
      
      logAction('update', 'plantao', `Plantão ID ${editingId} atualizado`, user);
      showToast('Plantão atualizado!');
      resetForm();
    }
  };

  const handleDelete = (id: string) => {
    const user = promptForUser('Excluir Plantão');
    if (!user) return;

    if (window.confirm('Excluir este plantão?')) {
      onDelete(id);
      logAction('delete', 'plantao', `Plantão ID ${id} excluído`, user);
      showToast('Plantão excluído.');
    }
  };

  const getColabName = (id: string) => collaborators.find(c => c.id === id)?.name || '---';

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            {editingId ? 'Editar Plantão' : 'Registrar Plantão'}
          </h2>
          {editingId && (
            <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700 underline">
              Cancelar Edição
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="flex flex-col md:col-span-2">
            <label className="text-xs font-semibold text-gray-600 mb-1">Colaborador *</label>
            <select
              required
              className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
              value={formData.collaboratorId}
              onChange={e => setFormData({...formData, collaboratorId: e.target.value})}
              disabled={!!editingId}
            >
              <option value="">Selecione...</option>
              {collaborators.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Data Início *</label>
            <div className="relative">
              <input
                required
                type="date"
                className="w-full border border-gray-300 rounded-lg p-2 pr-10 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700 appearance-none"
                value={formData.startDate}
                onChange={e => setFormData({...formData, startDate: e.target.value})}
                style={{colorScheme: 'light'}}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                 <CalendarIcon />
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Data Fim *</label>
            <div className="relative">
              <input
                required
                type="date"
                className="w-full border border-gray-300 rounded-lg p-2 pr-10 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700 appearance-none"
                value={formData.endDate}
                onChange={e => setFormData({...formData, endDate: e.target.value})}
                style={{colorScheme: 'light'}}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                 <CalendarIcon />
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Hora Início *</label>
            <input
              required
              type="time"
              className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
              value={formData.startTime}
              onChange={e => setFormData({...formData, startTime: e.target.value})}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Hora Fim *</label>
            <input
              required
              type="time"
              className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
              value={formData.endTime}
              onChange={e => setFormData({...formData, endTime: e.target.value})}
            />
          </div>

           <div className="flex flex-col md:col-span-2">
            <label className="text-xs font-semibold text-gray-600 mb-1">Observação</label>
            <input
              type="text"
              className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
              placeholder="Detalhes opcionais..."
              value={formData.observation}
              onChange={e => setFormData({...formData, observation: e.target.value})}
            />
          </div>

          <button type="submit" className="md:col-span-2 bg-[#667eea] hover:bg-[#5a6fd6] text-white font-bold py-2.5 px-6 rounded-lg shadow-md transition-transform active:scale-95">
            {editingId ? 'Salvar Alterações' : 'Registrar Plantão'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Plantões Registrados</h2>
        <div className="space-y-3">
           {onCalls.length === 0 ? <p className="text-gray-400 text-center py-4">Nenhum plantão registrado.</p> : onCalls.map(o => (
             <div key={o.id} className="flex flex-col md:flex-row justify-between items-center p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-all">
               <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-800">{getColabName(o.collaboratorId)}</span>
                    <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded font-bold">Plantão</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatDate(o.startDate)} - {formatDate(o.endDate)} | {o.startTime} às {o.endTime}
                  </div>
                  {o.observation && <div className="text-xs text-gray-400 italic mt-1">{o.observation}</div>}
                  {o.updatedBy && <div className="text-[10px] text-gray-400 mt-1">Modificado por: {o.updatedBy}</div>}
               </div>
               <div className="flex gap-2 mt-3 md:mt-0">
                  <button onClick={() => handleEdit(o)} className="text-blue-500 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded text-sm font-medium transition-colors">Editar</button>
                  <button onClick={() => handleDelete(o.id)} className="text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1 rounded text-sm font-medium transition-colors">Excluir</button>
               </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};
