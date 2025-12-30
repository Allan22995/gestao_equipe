
import React, { useState, useEffect, useMemo } from 'react';
import { auth, onAuthStateChanged, signOut } from './services/firebase';
import { dbService } from './services/storage';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Calendar } from './components/Calendar';
import { Collaborators } from './components/Collaborators';
import { Events } from './components/Events';
import { OnCall } from './components/OnCall';
import { Balance } from './components/Balance';
import { VacationForecast } from './components/VacationForecast';
import { Settings } from './components/Settings';
import { Simulator } from './components/Simulator';
import { CommunicationGenerator } from './components/CommunicationGenerator';
import { SkillsMatrix } from './components/SkillsMatrix';
import { 
  Collaborator, EventRecord, OnCallRecord, BalanceAdjustment, 
  VacationRequest, SystemSettings, TabType, UserProfile 
} from './types';

// Default settings
const defaultSettings: SystemSettings = {
  branches: [],
  sectors: [],
  roles: [],
  accessProfiles: [],
  eventTypes: [],
  scheduleTemplates: [],
  shiftRotations: [],
  companyBranches: {},
  companies: [],
  skills: []
};

// Mapeamento de Permissões por Aba
const TAB_PERMISSIONS: Record<TabType, string> = {
  'dashboard': 'dashboard:view',
  'calendario': 'calendar:view',
  'colaboradores': 'collaborators:view',
  'eventos': 'events:view',
  'plantoes': 'on_calls:view',
  'previsao_ferias': 'vacation:view',
  'saldo': 'balance:view',
  'simulador': 'simulator:view',
  'comunicados': 'comms:view',
  'skills_matrix': 'skills_matrix:view',
  'configuracoes': 'settings:view'
};

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Controle do Menu Lateral
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  
  // Data States
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [onCalls, setOnCalls] = useState<OnCallRecord[]>([]);
  const [adjustments, setAdjustments] = useState<BalanceAdjustment[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Responsive Sidebar: Close on resize if small screen
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Data Subscriptions
  useEffect(() => {
    if (!user) return;

    const unsubs = [
      dbService.subscribeToCollaborators(setCollaborators),
      dbService.subscribeToEvents(setEvents),
      dbService.subscribeToOnCalls(setOnCalls),
      dbService.subscribeToAdjustments(setAdjustments),
      dbService.subscribeToVacationRequests(setVacationRequests),
      dbService.subscribeToSettings((data) => {
        if (data) setSettings(data);
      })
    ];

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [user]);

  // Derived User Info
  const currentUserColab = useMemo(() => {
    if (!user || !collaborators.length) return null;
    return collaborators.find(c => c.email === user.email);
  }, [user, collaborators]);

  const userProfile: UserProfile = currentUserColab?.profile || 'colaborador';
  const userRoleName = currentUserColab?.role || '';
  
  // Permissions Logic
  const roleConfig = useMemo(() => {
     return settings.roles.find(r => r.name === userRoleName);
  }, [settings.roles, userRoleName]);

  const hasPermission = (permId: string) => {
      if (userProfile === 'admin') return true;
      if (!roleConfig) return false;
      return roleConfig.permissions.includes(permId);
  };

  // Efeito para validar e redirecionar se a aba atual não for permitida
  useEffect(() => {
    // Só executa se já tivermos carregado o usuário e configurações básicas
    if (loading || !user) return;
    
    // Se ainda não carregou colaboradores ou roles, aguarda para evitar falsos negativos
    if (collaborators.length > 0 && settings.roles.length > 0) {
      const currentPerm = TAB_PERMISSIONS[activeTab];
      
      // Se não tem permissão para a aba atual
      if (!hasPermission(currentPerm)) {
         // Procura a primeira aba permitida
         const availableTabs = Object.keys(TAB_PERMISSIONS) as TabType[];
         const firstAllowed = availableTabs.find(t => hasPermission(TAB_PERMISSIONS[t]));
         
         if (firstAllowed) {
            setActiveTab(firstAllowed);
         }
      }
    }
  }, [activeTab, user, collaborators, settings, loading]);

  const allowedSectors = useMemo(() => {
      if (userProfile === 'admin') return []; 
      if (roleConfig?.canViewAllSectors) return [];
      return currentUserColab?.allowedSectors || [];
  }, [userProfile, roleConfig, currentUserColab]);

  const availableBranches = useMemo(() => {
      if (userProfile === 'admin') return settings.branches;
      if (roleConfig?.canViewAllSectors) return settings.branches;

      if (currentUserColab?.branch) {
          const linked = settings.branchLinks?.[currentUserColab.branch] || [];
          return [currentUserColab.branch, ...linked];
      }
      return [];
  }, [userProfile, roleConfig, settings.branches, currentUserColab, settings.branchLinks]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleTabChange = (tab: TabType) => {
      setActiveTab(tab);
      // No mobile, fecha o menu ao selecionar
      if (window.innerWidth < 1024) {
          setIsSidebarOpen(false);
      }
  };

  const showToast = (msg: string, isError = false) => {
    alert(msg);
  };
  
  const logAction = (action: string, entity: string, details: string, user: string) => {
      dbService.logAudit({
          id: '',
          action: action as any,
          entity: entity as any,
          details,
          performedBy: user,
          timestamp: new Date().toISOString()
      });
  };

  const currentUserName = currentUserColab?.name || user?.email || 'Usuário';

  if (loading) return <div className="flex items-center justify-center h-screen">Carregando...</div>;

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    // Bloqueio de segurança na renderização
    const requiredPerm = TAB_PERMISSIONS[activeTab];
    if (!hasPermission(requiredPerm)) {
       // Se os dados ainda estão carregando, mostra loading, senão mostra acesso negado
       if (collaborators.length === 0) return <div className="p-8 text-center text-gray-500">Carregando perfil...</div>;
       return (
         <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 className="text-lg font-bold text-gray-700">Acesso Restrito</h3>
            <p className="text-sm">Você não tem permissão para acessar esta seção.</p>
         </div>
       );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard 
            collaborators={collaborators} events={events} onCalls={onCalls} vacationRequests={vacationRequests} 
            settings={settings} currentUserProfile={userProfile} currentUserAllowedSectors={allowedSectors}
            canViewPhones={hasPermission('dashboard:view_phones')}
            canViewCharts={hasPermission('dashboard:view_charts')}
            availableBranches={availableBranches}
          />;
      case 'calendario':
        return <Calendar 
            collaborators={collaborators} events={events} onCalls={onCalls} vacationRequests={vacationRequests} 
            settings={settings} currentUserProfile={userProfile} currentUserAllowedSectors={allowedSectors}
            canViewPhones={hasPermission('calendar:view_phones')}
            availableBranches={availableBranches}
            userColabId={currentUserColab?.id || null}
          />;
      case 'colaboradores':
        return <Collaborators 
            collaborators={collaborators} 
            onAdd={(c) => { dbService.addCollaborator(c); logAction('create', 'colaborador', `Criou ${c.name}`, user.email); }}
            onUpdate={(c) => { dbService.updateCollaborator(c.id, c); logAction('update', 'colaborador', `Editou ${c.name}`, user.email); }}
            onDelete={(id) => { dbService.deleteCollaborator(id); logAction('delete', 'colaborador', `Excluiu ID ${id}`, user.email); }}
            showToast={showToast}
            settings={settings}
            currentUserProfile={userProfile}
            canCreate={hasPermission('collaborators:create')}
            canUpdate={hasPermission('collaborators:update')}
            canDelete={hasPermission('collaborators:delete')}
            currentUserAllowedSectors={allowedSectors}
            currentUserRole={userRoleName}
            availableBranches={availableBranches}
        />;
      case 'eventos':
        return <Events 
            collaborators={collaborators} events={events}
            onAdd={(e) => dbService.addEvent({ ...e, createdBy: currentUserName })}
            onUpdate={(e) => dbService.updateEvent(e.id, e)}
            onDelete={(id) => dbService.deleteEvent(id)}
            showToast={showToast}
            logAction={logAction}
            settings={settings}
            canCreate={hasPermission('events:create')}
            canUpdate={hasPermission('events:update')}
            canDelete={hasPermission('events:delete')}
            currentUserAllowedSectors={allowedSectors}
            currentUserProfile={userProfile}
            userColabId={currentUserColab?.id || null}
        />;
      case 'plantoes':
        return <OnCall 
            collaborators={collaborators} onCalls={onCalls}
            onAdd={(o) => dbService.addOnCall({ ...o, createdBy: currentUserName })}
            onUpdate={(o) => dbService.updateOnCall(o.id, o)}
            onDelete={(id) => dbService.deleteOnCall(id)}
            showToast={showToast}
            logAction={logAction}
            settings={settings}
            canCreate={hasPermission('on_calls:create')}
            canUpdate={hasPermission('on_calls:update')}
            canDelete={hasPermission('on_calls:delete')}
            currentUserProfile={userProfile}
            userColabId={currentUserColab?.id || null}
        />;
      case 'saldo':
        return <Balance 
            collaborators={collaborators} events={events} adjustments={adjustments}
            onAddAdjustment={(a) => dbService.addAdjustment(a)}
            onUpdateCollaborator={(id, data) => dbService.updateCollaborator(id, data)}
            showToast={showToast}
            logAction={logAction}
            currentUserName={currentUserName}
            canCreate={hasPermission('balance:create')}
            currentUserAllowedSectors={allowedSectors}
            currentUserProfile={userProfile}
            userColabId={currentUserColab?.id || null}
        />;
      case 'previsao_ferias':
        return <VacationForecast 
            collaborators={collaborators} requests={vacationRequests}
            onAdd={(r) => dbService.addVacationRequest({ ...r, createdBy: currentUserName })}
            onUpdate={(r) => dbService.updateVacationRequest(r.id, r)}
            onDelete={(id) => dbService.deleteVacationRequest(id)}
            showToast={showToast}
            logAction={logAction}
            currentUserProfile={userProfile}
            currentUserName={currentUserName}
            canCreate={hasPermission('vacation:create')}
            canUpdate={hasPermission('vacation:update')}
            canDelete={hasPermission('vacation:delete')}
            canManageStatus={hasPermission('vacation:manage_status')}
            currentUserAllowedSectors={allowedSectors}
            userColabId={currentUserColab?.id || null}
        />;
      case 'simulador':
        return <Simulator 
            collaborators={collaborators} events={events} settings={settings}
            onSaveSettings={(s) => { dbService.saveSettings(s); logAction('update', 'configuracao', 'Atualizou Regras de Cobertura', user.email); }}
            currentUserAllowedSectors={allowedSectors}
            canEditRules={hasPermission('simulator:manage_rules')}
            availableBranches={availableBranches}
        />;
      case 'comunicados':
          return <CommunicationGenerator />;
      case 'skills_matrix':
          return <SkillsMatrix 
              collaborators={collaborators}
              settings={settings}
              onUpdateCollaborator={(id, data) => dbService.updateCollaborator(id, data)}
              showToast={showToast}
              currentUserProfile={userProfile}
              currentUserAllowedSectors={allowedSectors}
              canManageSkills={hasPermission('skills_matrix:manage')}
              availableBranches={availableBranches}
          />;
      case 'configuracoes':
        return <Settings 
            settings={settings} 
            setSettings={async (s) => { await dbService.saveSettings(s); logAction('update', 'configuracao', 'Atualizou Configurações Gerais', user.email); }}
            showToast={showToast}
            hasPermission={hasPermission}
        />;
      default:
        return <div>Em construção</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 flex overflow-hidden">
       {/* MENU LATERAL - Responsivo */}
       {/* Overlay para Mobile */}
       {isSidebarOpen && (
         <div 
           className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
           onClick={() => setIsSidebarOpen(false)}
         ></div>
       )}

       <aside 
         className={`
           bg-indigo-900 text-white flex flex-col fixed h-full z-30 shadow-2xl
           transition-transform duration-300 ease-in-out
           ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
           w-64
         `}
       >
          <div className="p-6 text-center border-b border-indigo-800 flex justify-between items-center">
             <div>
               <h1 className="text-xl font-bold tracking-wider">Nexo</h1>
               <p className="text-xs text-indigo-300 mt-1">Gestão de Equipes</p>
             </div>
             <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-indigo-300 hover:text-white">
                ✕
             </button>
          </div>
          
          {/* User Info */}
          <div className="p-4 border-b border-indigo-800 flex items-center gap-3 bg-indigo-800/50">
             <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center font-bold border-2 border-indigo-500 shadow-sm text-sm">
                 {currentUserColab?.name ? currentUserColab.name.charAt(0) : user.email?.charAt(0).toUpperCase()}
             </div>
             <div className="overflow-hidden">
                 <p className="text-sm font-bold truncate w-32">{currentUserColab?.name || 'Usuário'}</p>
                 <p className="text-[10px] text-indigo-300 truncate uppercase font-medium tracking-wide">{userProfile}</p>
             </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
             <SidebarItem label="Dashboard" icon="📊" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} visible={hasPermission('dashboard:view')} />
             <SidebarItem label="Calendário" icon="📅" active={activeTab === 'calendario'} onClick={() => handleTabChange('calendario')} visible={hasPermission('calendar:view')} />
             <SidebarItem label="Colaboradores" icon="👥" active={activeTab === 'colaboradores'} onClick={() => handleTabChange('colaboradores')} visible={hasPermission('collaborators:view')} />
             <SidebarItem label="Eventos / Folgas" icon="📝" active={activeTab === 'eventos'} onClick={() => handleTabChange('eventos')} visible={hasPermission('events:view')} />
             <SidebarItem label="Plantões" icon="🌙" active={activeTab === 'plantoes'} onClick={() => handleTabChange('plantoes')} visible={hasPermission('on_calls:view')} />
             <SidebarItem label="Férias" icon="✈️" active={activeTab === 'previsao_ferias'} onClick={() => handleTabChange('previsao_ferias')} visible={hasPermission('vacation:view')} />
             <SidebarItem label="Banco de Horas" icon="💰" active={activeTab === 'saldo'} onClick={() => handleTabChange('saldo')} visible={hasPermission('balance:view')} />
             <SidebarItem label="Simulador" icon="🧪" active={activeTab === 'simulador'} onClick={() => handleTabChange('simulador')} visible={hasPermission('simulator:view')} />
             <SidebarItem label="Matrix de Skills" icon="🧩" active={activeTab === 'skills_matrix'} onClick={() => handleTabChange('skills_matrix')} visible={hasPermission('skills_matrix:view')} />
             <SidebarItem label="Gerador Comunicados" icon="📢" active={activeTab === 'comunicados'} onClick={() => handleTabChange('comunicados')} visible={hasPermission('comms:view')} />
             <SidebarItem label="Configurações" icon="⚙️" active={activeTab === 'configuracoes'} onClick={() => handleTabChange('configuracoes')} visible={hasPermission('settings:view')} />
          </nav>
          
          {/* Rodapé / Assinatura */}
          <div className="p-4 border-t border-indigo-800 bg-indigo-900">
             <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-indigo-800 hover:bg-indigo-700 text-white py-2.5 rounded-lg transition-colors border border-indigo-700 shadow-lg">
                <span>🚪</span> <span className="font-semibold text-sm">Sair do Sistema</span>
             </button>
             <div className="text-center mt-4 text-[10px] text-indigo-300 opacity-80 flex flex-col items-center">
                <p>v1.2.0 • Nexo System</p>
                <div className="mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                    <span>Desenvolvido por</span>
                </div>
                <div>
                    <a href="https://www.linkedin.com/in/alan-matheus-91316a109" target="_blank" rel="noopener noreferrer" className="font-bold hover:text-white transition-colors underline decoration-indigo-500">Alan</a>
                    <span className="mx-1">e</span>
                    <a href="https://www.linkedin.com/in/fabio-moraes-3b6897161" target="_blank" rel="noopener noreferrer" className="font-bold hover:text-white transition-colors underline decoration-indigo-500">Fabio</a>
                </div>
             </div>
          </div>
       </aside>

       {/* ÁREA PRINCIPAL */}
       <main 
         className={`
           flex-1 p-4 md:p-8 min-h-screen
           transition-all duration-300 ease-in-out
           ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'} 
           w-full
         `}
       >
          {/* Header da Área Principal (Toggle Button) */}
          <div className="mb-6 flex items-center gap-3">
             <button 
               onClick={() => setIsSidebarOpen(!isSidebarOpen)}
               className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-300 shadow-sm transition-all focus:outline-none"
               title={isSidebarOpen ? "Ocultar Menu" : "Mostrar Menu"}
             >
                {isSidebarOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                )}
             </button>
             {!isSidebarOpen && <h2 className="text-xl font-bold text-gray-800 tracking-tight">Nexo</h2>}
          </div>

          {/* Banner de Comunicado (Sem Botão de Fechar e Cores Densas) */}
          {settings.systemMessage?.active && (
            <div className={`mb-6 rounded-lg p-4 shadow-lg flex items-start animate-fadeIn ${
              settings.systemMessage.level === 'error' ? 'bg-red-600 text-white' :
              settings.systemMessage.level === 'warning' ? 'bg-amber-600 text-white' :
              'bg-blue-600 text-white'
            }`}>
               <div className="flex gap-3 w-full">
                  <div className="mt-0.5 text-2xl">
                    {settings.systemMessage.level === 'error' ? '🚨' : 
                     settings.systemMessage.level === 'warning' ? '⚠️' : 'ℹ️'}
                  </div>
                  <div>
                      <h3 className="font-bold uppercase text-sm mb-1 tracking-wide">
                        {settings.systemMessage.level === 'error' ? 'MANUTENÇÃO / ERRO CRÍTICO' : 
                         settings.systemMessage.level === 'warning' ? 'ATENÇÃO NECESSÁRIA' : 'COMUNICADO'}
                      </h3>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed opacity-95 font-medium">{settings.systemMessage.message}</p>
                  </div>
               </div>
            </div>
          )}

          {/* Conteúdo da Aba */}
          <div className="w-full max-w-full overflow-x-hidden">
            {renderContent()}
          </div>
       </main>
    </div>
  );
}

const SidebarItem = ({ label, icon, active, onClick, visible }: any) => {
    if (!visible) return null;
    return (
        <button 
          onClick={onClick}
          className={`w-full flex items-center gap-3 px-6 py-3 transition-all duration-200 group relative overflow-hidden ${active ? 'bg-indigo-800 text-white border-r-4 border-emerald-400' : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'}`}
        >
            <span className={`text-lg transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
            <span className="font-medium text-sm tracking-wide">{label}</span>
            {active && <div className="absolute inset-0 bg-white/5 pointer-events-none"></div>}
        </button>
    );
};

export default App;
