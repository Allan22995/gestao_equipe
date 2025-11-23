

import React, { useState, useEffect } from 'react';
import { TabType, Collaborator, EventRecord, OnCallRecord, BalanceAdjustment, VacationRequest, AuditLog, SystemSettings, UserProfile } from './types';
import { dbService } from './services/storage'; 
import { auth } from './services/firebase'; 
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Calendar } from './components/Calendar';
import { Dashboard } from './components/Dashboard';
import { Collaborators } from './components/Collaborators';
import { Events } from './components/Events';
import { OnCall } from './components/OnCall';
import { Balance } from './components/Balance';
import { VacationForecast } from './components/VacationForecast';
import { Settings } from './components/Settings';
import { CommunicationGenerator } from './components/CommunicationGenerator';
import { Login } from './components/Login';
import { generateUUID } from './utils/helpers';

const DEFAULT_SETTINGS: SystemSettings = {
  branches: ['Matriz', 'Filial Norte'],
  roles: ['Gerente', 'Vendedor'],
  sectors: ['Logística', 'TI', 'Vendas', 'RH'],
  accessProfiles: ['admin', 'colaborador', 'noc'],
  eventTypes: [
    { id: 'ferias', label: 'Férias', behavior: 'neutral' },
    { id: 'folga', label: 'Folga', behavior: 'debit' },
    { id: 'trabalhado', label: 'Trabalhado', behavior: 'credit_2x' }
  ],
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1mZiuHggQ3L_fS3rESZ9VOs1dizo_Zl5OTqKArwtQBoU/edit?gid=1777395781#gid=1777395781'
};

function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Current User Context
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userColabId, setUserColabId] = useState<string | null>(null);
  const [currentUserSector, setCurrentUserSector] = useState<string | undefined>(undefined);
  const [currentUserRestricted, setCurrentUserRestricted] = useState<boolean>(false);

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

  // Listen for Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Match Authenticated User with Collaborator Data to determine Role and Restrictions
  useEffect(() => {
    if (user && collaborators.length > 0) {
      const foundColab = collaborators.find(c => c.email === user.email);
      if (foundColab) {
        setUserProfile(foundColab.profile || 'colaborador');
        setUserColabId(foundColab.id);
        setCurrentUserSector(foundColab.sector);
        setCurrentUserRestricted(foundColab.isRestrictedSector || false);
      } else {
        // Email autenticado no Google mas não cadastrado na base
        setUserProfile(null); 
        setCurrentUserSector(undefined);
        setCurrentUserRestricted(false);
      }
    }
  }, [user, collaborators]);

  // Initial Data Loading (Subscribing to Firestore)
  useEffect(() => {
    if (!user) return; // Only load data if logged in

    console.log('🚀 Inicializando App e Listeners...');

    const unsubColabs = dbService.subscribeToCollaborators(setCollaborators);
    const unsubEvents = dbService.subscribeToEvents(setEvents);
    const unsubOnCalls = dbService.subscribeToOnCalls(setOnCalls);
    const unsubAdjustments = dbService.subscribeToAdjustments(setAdjustments);
    const unsubVacation = dbService.subscribeToVacationRequests(setVacationRequests);
    
    const unsubSettings = dbService.subscribeToSettings(
      (data) => {
        if (data) {
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

    return () => {
      unsubColabs();
      unsubEvents();
      unsubOnCalls();
      unsubAdjustments();
      unsubVacation();
      unsubSettings();
    };
  }, [user]); // Run when user logs in

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
      const msg = err.message || 'Erro ao salvar configs.';
      showToast(msg, true); 
      throw err; 
    }
  };

  // Helper to get the display name of current user
  const getCurrentUserName = () => {
    if (userColabId) {
      const colab = collaborators.find(c => c.id === userColabId);
      if (colab) return colab.name;
    }
    return user?.displayName || user?.email || 'Sistema';
  };

  const currentUserName = getCurrentUserName();

  // --- ACCESS CONTROL LOGIC ---
  const getVisibleTabs = (): {id: TabType, label: string, icon: string}[] => {
    if (!userProfile) return [];

    const allTabs: {id: TabType, label: string, icon: string}[] = [
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

    if (userProfile === 'admin') return allTabs;
    
    if (userProfile === 'noc') {
      // NOC: Calendário e Dashboard apenas
      return allTabs.filter(t => ['calendario', 'dashboard'].includes(t.id));
    }

    // If userProfile is 'colaborador' OR any other custom profile created in Settings,
    // they get the default view (everything except Config).
    return allTabs.filter(t => t.id !== 'configuracoes');
  };

  const visibleTabs = getVisibleTabs();

  // Redirect if current tab is not allowed
  useEffect(() => {
    if (visibleTabs.length > 0) {
      const isAllowed = visibleTabs.some(t => t.id === activeTab);
      if (!isAllowed) setActiveTab(visibleTabs[0].id);
    }
  }, [userProfile, visibleTabs]);

  const renderContent = () => {
    if (!userProfile) return null;

    switch (activeTab) {
      case 'calendario':
        return (
          <Calendar 
            collaborators={collaborators} 
            events={events} 
            onCalls={onCalls} 
            vacationRequests={vacationRequests} 
            settings={settings} 
            currentUserProfile={userProfile} 
            currentUserSector={currentUserSector}
            currentUserRestricted={currentUserRestricted}
          />
        );
      case 'dashboard':
        return (
          <Dashboard 
            collaborators={collaborators} 
            events={events} 
            onCalls={onCalls} 
            vacationRequests={vacationRequests} 
            settings={settings} 
            currentUserProfile={userProfile}
            currentUserSector={currentUserSector}
            currentUserRestricted={currentUserRestricted} 
          />
        );
      case 'colaboradores':
        return <Collaborators 
          collaborators={collaborators} 
          onAdd={handleAddCollaborator} 
          onUpdate={handleUpdateCollaborator} 
          onDelete={handleDeleteCollaborator}
          showToast={showToast} 
          settings={settings} 
          currentUserProfile={userProfile}
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
          settings={settings} 
        />;
      case 'saldo':
        return <Balance 
          collaborators={collaborators} 
          events={events} 
          adjustments={adjustments} 
          onAddAdjustment={handleAddAdjustment}
          showToast={showToast} 
          logAction={logAction}
          currentUserName={currentUserName}
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
          currentUserProfile={userProfile}
          currentUserName={currentUserName}
        />;
      case 'comunicados':
        return <CommunicationGenerator />;
      case 'configuracoes':
        return userProfile === 'admin' ? <Settings settings={settings} setSettings={handleSaveSettings} showToast={showToast} /> : <div>Acesso Negado</div>;
      default:
        return null;
    }
  };

  // LOADING STATE
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#1E90FF] flex items-center justify-center text-white">
        <div className="animate-pulse text-xl font-bold">Carregando Sistema...</div>
      </div>
    );
  }

  // NOT LOGGED IN
  if (!user) {
    return <Login />;
  }

  // LOGGED IN BUT NO PROFILE (Not in DB)
  if (!userProfile && collaborators.length > 0) { 
     return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-xl shadow-xl max-w-md">
          <div className="text-amber-500 mb-4 flex justify-center">
             <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
             </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acesso Pendente</h2>
          <p className="text-gray-600 mb-6">
            Seu e-mail <b>{user.email}</b> foi autenticado com sucesso, mas não encontramos seu cadastro na base de colaboradores.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Solicite a um <b>Administrador</b> para cadastrar seu e-mail no sistema.
          </p>
          <button onClick={() => signOut(auth)} className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors">
            Sair / Tentar outra conta
          </button>
        </div>
      </div>
     );
  }

  // Fallback if DB is empty (First Run)
  if (collaborators.length === 0 && !userProfile) {
      return (
        <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-6">
           <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Configuração Inicial</h2>
              <p className="text-gray-600 mb-6">Não existem colaboradores cadastrados. Como você é o primeiro usuário, acesse o banco de dados do Firebase e crie manualmente o primeiro registro para o email: <b>{user.email}</b> com perfil <b>admin</b>.</p>
              <button onClick={() => signOut(auth)} className="text-indigo-600 underline">Sair</button>
           </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#1E90FF] font-sans flex flex-col">
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
           <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl md:text-3xl font-bold text-white drop-shadow-sm">Sistema de Gestão</h1>
                <p className="text-white/80 text-xs md:text-sm mt-1 flex items-center gap-2">
                  <span className="bg-white/20 px-2 py-0.5 rounded text-white font-mono">{userProfile?.toUpperCase()}</span>
                  {user.email}
                  {currentUserSector && <span className="bg-indigo-600 px-2 py-0.5 rounded text-white text-xs">{currentUserSector}</span>}
                </p>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
              >
                Sair <span>➜</span>
              </button>
           </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-4">
           <div className="flex space-x-1 overflow-x-auto pb-0 scrollbar-hide">
             {visibleTabs.map(tab => (
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