
import React, { useState } from 'react';
import { Collaborator, EventRecord, SystemSettings } from '../types';
import { generateUUID, calculateDaysBetween, formatDate, promptForUser } from '../utils/helpers';

interface EventsProps {
  collaborators: Collaborator[];
  events: EventRecord[];
  onAdd: (e: EventRecord) => void;
  onUpdate: (e: EventRecord) => void;
  onDelete: (id: string) => void;
  showToast: (msg: string, isError?: boolean) => void;
  logAction: (action: string, entity: string, details: string, user: string) => void;
  settings: SystemSettings;
}

const CalendarIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export const Events: React.FC<EventsProps> = ({ collaborators, events, onAdd, onUpdate, onDelete, showToast, logAction, settings }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    collaboratorId: '',
    type: '',
    startDate: '',
    endDate: '',
    observation: ''
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      collaboratorId: '',
      type: '',
      startDate: '',
      endDate: '',
      observation: ''
    });
  };

  const handleEdit = (evt: EventRecord) => {
    setEditingId(evt.id);
    setFormData({
      collaboratorId: evt.collaboratorId,
      type: evt.type,
      startDate: evt.startDate,
      endDate: evt.endDate,
      observation: evt.observation
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const calculateEffect = (typeId: string, start: string, end: string) => {
      if (!start || !end || !typeId) return { gained: 0, used: 0 };
      
      const days = calculateDaysBetween(start, end);
      const typeConfig = settings.eventTypes.find(t => t.id === typeId);
      
      let behavior = typeConfig?.behavior || 'neutral';
      if (typeId === 'ferias') behavior = 'neutral';
      if (typeId === 'folga') behavior = 'debit';
      if (typeId === 'trabalhado') behavior = 'credit_2x';

      let daysGained = 0;
      let daysUsed = 0;

      if (behavior === 'credit_2x') daysGained = days * 2;
      else if (behavior === 'credit_1x') daysGained = days;
      else if (behavior === 'debit') daysUsed = days;

      return { gained: daysGained, used: daysUsed, label: typeConfig?.label };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type) return;

    const { gained, used, label } = calculateEffect(formData.type, formData.startDate, formData.endDate);

    if (!editingId) {
      const newEvent: EventRecord = {
        id: generateUUID(),
        collaboratorId: formData.collaboratorId,
        type: formData.type,
        typeLabel: label,
        startDate: formData.startDate,
        endDate: formData.endDate,
        observation: formData.observation,
        daysGained: gained,
        daysUsed: used,
        createdAt: new Date().toISOString()
      };
      onAdd(newEvent);
      showToast('Evento registrado!');
      resetForm();
    } else {
      const user = promptForUser('Editar Evento');
      if (!user) return;

      onUpdate({
        id: editingId,
        collaboratorId: formData.collaboratorId,
        type: formData.type,
        typeLabel: label,
        startDate: formData.startDate,
        endDate: formData.endDate,
        observation: formData.observation,
        daysGained: gained,
        daysUsed: used,
        updatedBy: user,
        lastUpdatedAt: new Date().toISOString()
        // createdAt is preserved in Firestore by merging, but here we send a partial object basically
      } as EventRecord);

      logAction('update', 'evento', `Evento ID ${editingId} editado`, user);
      showToast('Evento atualizado!');
      resetForm();
    }
  };

  const handleDelete = (id: string) => {
    const user = promptForUser('Excluir Evento');
    if (!user) return;

    if (window.confirm('Confirmar exclusão definitiva?')) {
      onDelete(id);
      logAction('delete', 'evento', `Evento ID ${id} excluído`, user);
      showToast('Evento excluído.');
    }
  };

  const getColabName = (id: string) => collaborators.find(c => c.id === id)?.name || '---';
  
  const getEventLabel = (e: EventRecord) => {
     if (e.typeLabel) return e.typeLabel;
     const found = settings.eventTypes.find(t => t.id === e.type);
     if (found) return found.label;
     if (e.type === 'ferias') return 'Férias';
     if (e.type === 'folga') return 'Folga';
     if (e.type === 'trabalhado') return 'Trabalhado';
     return e.type;
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            {editingId ? 'Editar Evento' : 'Registrar Evento'}
          </h2>
          {editingId && (
            <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700 underline">
              Cancelar Edição
            </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
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
            <label className="text-xs font-semibold text-gray-600 mb-1">Tipo de Evento *</label>
            <select
              required
              className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value})}
            >
              <option value="">Selecione...</option>
              {settings.eventTypes.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
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
            {editingId ? 'Salvar Alterações' : 'Registrar'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Histórico de Eventos</h2>
        <div className="space-y-3">
          {events.length === 0 ? <p className="text-gray-400 text-center py-4">Nenhum evento registrado.</p> : events.map(e => (
            <div key={e.id} className="flex flex-col md:flex-row justify-between items-center p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-all">
              <div className="flex-1">
                 <div className="flex items-center gap-2 mb-1">
                   <span className="font-bold text-gray-800">{getColabName(e.collaboratorId)}</span>
                   <span className="bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded font-bold border border-gray-300">
                     {getEventLabel(e)}
                   </span>
                 </div>
                 <div className="text-sm text-gray-600">
                   {formatDate(e.startDate)} até {formatDate(e.endDate)}
                   {e.daysGained > 0 && <span className="ml-2 text-green-600 font-medium">+{e.daysGained} dias</span>}
                   {e.daysUsed > 0 && <span className="ml-2 text-red-500 font-medium">-{e.daysUsed} dias</span>}
                 </div>
                 {e.observation && <div className="text-xs text-gray-400 italic mt-1">{e.observation}</div>}
                 {e.updatedBy && <div className="text-[10px] text-gray-400 mt-1">Modificado por: {e.updatedBy}</div>}
              </div>
              <div className="flex gap-2 mt-3 md:mt-0">
                  <button onClick={() => handleEdit(e)} className="text-blue-500 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded text-sm font-medium transition-colors">Editar</button>
                  <button onClick={() => handleDelete(e.id)} className="text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1 rounded text-sm font-medium transition-colors">Excluir</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
