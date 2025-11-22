

import React, { useState, useEffect } from 'react';
import { TabType, Collaborator, EventRecord, OnCallRecord, BalanceAdjustment, VacationRequest, AuditLog, SystemSettings } from './types';
import { dbService } from './services/storage'; // Note: mudou de storageService para dbService
import { Calendar } from './components/Calendar';
import { Dashboard } from './components/Dashboard';
import { Collaborators } from './components/Collaborators';
import { Events } from './components/Events';
import { OnCall } from './components/OnCall';
import { Balance } from './components/Balance';
import { VacationForecast } from './components/VacationForecast';
import { Settings } from './components/Settings';
import { CommunicationGenerator } from './components/CommunicationGenerator';
import { generateUUID } from './utils/helpers';

const DEFAULT_SETTINGS: SystemSettings = {
  branches: ['Matriz', 'Filial Norte'],
  roles: ['Gerente', 'Vendedor'],
  eventTypes: [
    { id: 'ferias', label: 'Férias', behavior: 'neutral' },
    { id: 'folga', label: 'Folga', behavior: 'debit' },
    { id: 'trabalhado', label: 'Trabalhado', behavior: 'credit_2x' }
  ],
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1mZiuHggQ3L_fS3rESZ9VOs1dizo_Zl5OTqKArwtQBoU/edit?gid=1777395781#gid=1777395781'
};

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('calendario');
  
  // Data State (Realtime from Firestore)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [onCalls, setOnCalls] = useState<OnCallRecord[]>([]);
  const [adjustments, setAdjustments] = useState<BalanceAdjustment[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);

  // Toast Logic
  const [toast, setToast] = useState<{msg: string, error: boolean} | null>(null);
  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3000);
  };

  // Initial Data Loading (Subscribing to Firestore)
  useEffect(() => {
    console.log('🚀 Inicializando App e Listeners...');

    const unsubColabs = dbService.subscribeToCollaborators(setCollaborators);
    const unsubEvents = dbService.subscribeToEvents(setEvents);
    const unsubOnCalls = dbService.subscribeToOnCalls(setOnCalls);
    const unsubAdjustments = dbService.subscribeToAdjustments(setAdjustments);
    const unsubVacation = dbService.subscribeToVacationRequests(setVacationRequests);
    
    // Passamos uma função de erro para capturar problemas de Permissão/Rules
    const unsubSettings = dbService.subscribeToSettings(
      (data) => {
        if (data) {
          // Garantir que spreadsheetUrl exista mesmo em configs antigas
          setSettings({ ...DEFAULT_SETTINGS, ...data });
        } else {
          console.log('⚠️ Sem configurações no banco. Usando Padrão Local e salvando...');
          dbService.saveSettings(DEFAULT_SETTINGS).catch(err => {
            console.error('Erro ao salvar configs padrão:', err);
          });
          setSettings(DEFAULT_SETTINGS);
        }
      },
      (errorMsg) => {
        showToast(errorMsg, true);
      }
    );

    // Cleanup listeners on unmount
    return () => {
      unsubColabs();
      unsubEvents();
      unsubOnCalls();
      unsubAdjustments();
      unsubVacation();
      unsubSettings();
    };
  }, []);

  // --- ACTION HANDLERS ---
  const logAction = (action: string, entity: string, details: string, user: string) => {
    const log: AuditLog = {
      id: generateUUID(),
      action: action as any,
      entity: entity as any,
      details,
      performedBy: user,
      timestamp: new Date().toISOString()
    };
    dbService.logAudit(log);
  };

  // Collaborators
  const handleAddCollaborator = async (c: Collaborator) => {
    try {
      const { id, ...rest } = c; 
      await dbService.addCollaborator(rest as any);
    } catch (e) { console.error(e); showToast('Erro ao salvar', true); }
  };
  const handleUpdateCollaborator = async (c: Collaborator) => {
    try {
      await dbService.updateCollaborator(c.id, c);
    } catch (e) { console.error(e); showToast('Erro ao atualizar', true); }
  };
  const handleDeleteCollaborator = async (id: string) => {
    try {
      await dbService.deleteCollaborator(id);
    } catch (e) { console.error(e); showToast('Erro ao excluir', true); }
  };

  // Events
  const handleAddEvent = async (e: EventRecord) => {
    try { await dbService.addEvent(e); } catch (err) { showToast('Erro ao criar evento', true); }
  };
  const handleUpdateEvent = async (e: EventRecord) => {
    try { await dbService.updateEvent(e.id, e); } catch (err) { showToast('Erro ao atualizar evento', true); }
  };
  const handleDeleteEvent = async (id: string) => {
    try { await dbService.deleteEvent(id); } catch (err) { showToast('Erro ao excluir evento', true); }
  };

  // OnCalls
  const handleAddOnCall = async (o: OnCallRecord) => {
    try { await dbService.addOnCall(o); } catch (err) { showToast('Erro ao criar plantão', true); }
  };
  const handleUpdateOnCall = async (o: OnCallRecord) => {
    try { await dbService.updateOnCall(o.id, o); } catch (err) { showToast('Erro ao atualizar plantão', true); }
  };
  const handleDeleteOnCall = async (id: string) => {
    try { await dbService.deleteOnCall(id); } catch (err) { showToast('Erro ao excluir plantão', true); }
  };

  // Adjustments
  const handleAddAdjustment = async (a: BalanceAdjustment) => {
    try { await dbService.addAdjustment(a); } catch (err) { showToast('Erro ao lançar ajuste', true); }
  };

  // Vacation
  const handleAddVacation = async (v: VacationRequest) => {
    try { await dbService.addVacationRequest(v); } catch (err) { showToast('Erro ao solicitar férias', true); }
  };
  const handleUpdateVacation = async (v: VacationRequest) => {
    try { await dbService.updateVacationRequest(v.id, v); } catch (err) { showToast('Erro ao atualizar solicitação', true); }
  };
  const handleDeleteVacation = async (id: string) => {
    try { await dbService.deleteVacationRequest(id); } catch (err) { showToast('Erro ao excluir solicitação', true); }
  };

  // Settings
  const handleSaveSettings = async (s: SystemSettings) => {
    try { 
      await dbService.saveSettings(s); 
      showToast('Configurações salvas!');
    } catch (err: any) { 
      console.error('Erro App.tsx:', err);
      // Se for erro de permissão, a mensagem já vem formatada do storage.ts ou capturada no listener
      const msg = err.message || 'Erro ao salvar configs.';
      showToast(msg, true); 
      throw err; 
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'calendario':
        return <Calendar collaborators={collaborators} events={events} onCalls={onCalls} vacationRequests={vacationRequests} settings={settings} />;
      case 'dashboard':
        return <Dashboard 
          collaborators={collaborators} 
          events={events} 
          onCalls={onCalls} 
          vacationRequests={vacationRequests}
          settings={settings} 
        />;
      case 'colaboradores':
        return <Collaborators 
          collaborators={collaborators} 
          onAdd={handleAddCollaborator} 
          onUpdate={handleUpdateCollaborator} 
          onDelete={handleDeleteCollaborator}
          showToast={showToast} 
          settings={settings} 
        />;
      case 'eventos':
        return <Events 
          collaborators={collaborators} 
          events={events} 
          onAdd={handleAddEvent}
          onUpdate={handleUpdateEvent}
          onDelete={handleDeleteEvent}
          showToast={showToast} 
          logAction={logAction} 
          settings={settings} 
        />;
      case 'plantoes':
        return <OnCall 
          collaborators={collaborators} 
          onCalls={onCalls} 
          onAdd={handleAddOnCall}
          onUpdate={handleUpdateOnCall}
          onDelete={handleDeleteOnCall}
          showToast={showToast} 
          logAction={logAction} 
          settings={settings} // Passando Settings
        />;
      case 'saldo':
        return <Balance 
          collaborators={collaborators} 
          events={events} 
          adjustments={adjustments} 
          onAddAdjustment={handleAddAdjustment}
          showToast={showToast} 
          logAction={logAction} 
        />;
      case 'previsao_ferias':
        return <VacationForecast 
          collaborators={collaborators} 
          requests={vacationRequests} 
          onAdd={handleAddVacation}
          onUpdate={handleUpdateVacation}
          onDelete={handleDeleteVacation}
          showToast={showToast} 
          logAction={logAction} 
        />;
      case 'comunicados':
        return <CommunicationGenerator />;
      case 'configuracoes':
        return <Settings settings={settings} setSettings={handleSaveSettings} showToast={showToast} />;
      default:
        return null;
    }
  };

  const tabs: {id: TabType, label: string, icon: string}[] = [
    { id: 'calendario', label: 'Calendário', icon: '📆' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'colaboradores', label: 'Colaboradores', icon: '👥' },
    { id: 'eventos', label: 'Eventos', icon: '📅' },
    { id: 'plantoes', label: 'Plantões', icon: '🌙' },
    { id: 'saldo', label: 'Saldo', icon: '💰' },
    { id: 'previsao_ferias', label: 'Prev. Férias', icon: '✈️' },
    { id: 'comunicados', label: 'Comunicados', icon: '📢' },
    { id: 'configuracoes', label: 'Configurações', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-[#1E90FF] font-sans flex flex-col">
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
           <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-sm">Sistema de Gestão de Equipe</h1>
                <p className="text-white/80 text-sm mt-1">Online • Firebase</p>
              </div>
           </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-4">
           <div className="flex space-x-1 overflow-x-auto pb-0 scrollbar-hide">
             {tabs.map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={`
                   px-4 py-3 rounded-t-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2
                   ${activeTab === tab.id 
                     ? 'bg-white text-[#1E90FF] shadow-lg transform translate-y-0.5' 
                     : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'}
                 `}
               >
                 <span>{tab.icon}</span> {tab.label}
               </button>
             ))}
           </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 flex-grow w-full">
        {renderContent()}
      </main>

      <footer className="py-6 text-center text-white/80 text-sm">
        <p>
          Desenvolvido por{' '}
          <a 
            href="https://app.humand.co/profile/4970892" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-bold hover:text-white underline decoration-transparent hover:decoration-white transition-all"
          >
            Fabio de Moraes
          </a>{' '}
          e{' '}
          <a 
            href="https://app.humand.co/profile/4968748" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-bold hover:text-white underline decoration-transparent hover:decoration-white transition-all"
          >
            Alan Matheus
          </a>
        </p>
      </footer>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-lg shadow-2xl text-white font-bold animate-slideIn z-50 ${toast.error ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {toast.msg}
        </div>
      )}
      
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

export default App;