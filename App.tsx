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
  companies: []
};

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [onCalls, setOnCalls] = useState<OnCallRecord[]>([]);
  const [adjustments, setAdjustments] = useState<BalanceAdjustment[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [systemMsgClosed, setSystemMsgClosed] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
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

  if (loading) return <div className="flex items-center justify-center h-screen">Carregando...</div>;

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
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
            onAdd={(e) => dbService.addEvent(e)}
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
            onAdd={(o) => dbService.addOnCall(o)}
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
            showToast={showToast}
            logAction={logAction}
            currentUserName={currentUserColab?.name || user.email}
            canCreate={hasPermission('balance:create')}
            currentUserAllowedSectors={allowedSectors}
            currentUserProfile={userProfile}
            userColabId={currentUserColab?.id || null}
        />;
      case 'previsao_ferias':
        return <VacationForecast 
            collaborators={collaborators} requests={vacationRequests}
            onAdd={(r) => dbService.addVacationRequest(r)}
            onUpdate={(r) => dbService.updateVacationRequest(r.id, r)}
            onDelete={(id) => dbService.deleteVacationRequest(id)}
            showToast={showToast}
            logAction={logAction}
            currentUserProfile={userProfile}
            currentUserName={currentUserColab?.name || user.email}
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
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 flex">
       <aside className="w-64 bg-indigo-900 text-white flex flex-col fixed h-full z-30">
          <div className="p-6 text-center border-b border-indigo-800">
             <h1 className="text-xl font-bold tracking-wider">Nexo</h1>
             <p className="text-xs text-indigo-300 mt-1">Gestão de Equipes</p>
          </div>
          
          <div className="p-4 border-b border-indigo-800 flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center font-bold">
                 {currentUserColab?.name ? currentUserColab.name.charAt(0) : user.email?.charAt(0).toUpperCase()}
             </div>
             <div className="overflow-hidden">
                 <p className="text-sm font-bold truncate">{currentUserColab?.name || 'Usuário'}</p>
                 <p className="text-xs text-indigo-300 truncate">{userProfile}</p>
             </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-4">
             <SidebarItem label="Dashboard" icon="📊" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} visible={hasPermission('dashboard:view')} />
             <SidebarItem label="Calendário" icon="📅" active={activeTab === 'calendario'} onClick={() => setActiveTab('calendario')} visible={hasPermission('calendar:view')} />
             <SidebarItem label="Colaboradores" icon="👥" active={activeTab === 'colaboradores'} onClick={() => setActiveTab('colaboradores')} visible={hasPermission('collaborators:view')} />
             <SidebarItem label="Eventos / Folgas" icon="📝" active={activeTab === 'eventos'} onClick={() => setActiveTab('eventos')} visible={hasPermission('events:view')} />
             <SidebarItem label="Plantões" icon="🌙" active={activeTab === 'plantoes'} onClick={() => setActiveTab('plantoes')} visible={hasPermission('on_calls:view')} />
             <SidebarItem label="Férias" icon="✈️" active={activeTab === 'previsao_ferias'} onClick={() => setActiveTab('previsao_ferias')} visible={hasPermission('vacation:view')} />
             <SidebarItem label="Banco de Horas" icon="💰" active={activeTab === 'saldo'} onClick={() => setActiveTab('saldo')} visible={hasPermission('balance:view')} />
             <SidebarItem label="Simulador" icon="🧪" active={activeTab === 'simulador'} onClick={() => setActiveTab('simulador')} visible={hasPermission('simulator:view')} />
             <SidebarItem label="Gerador Comunicados" icon="📢" active={activeTab === 'comunicados'} onClick={() => setActiveTab('comunicados')} visible={hasPermission('comms:view')} />
             <SidebarItem label="Configurações" icon="⚙️" active={activeTab === 'configuracoes'} onClick={() => setActiveTab('configuracoes')} visible={hasPermission('settings:view')} />
          </nav>
          
          <div className="p-4 border-t border-indigo-800">
             <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-indigo-800 hover:bg-indigo-700 text-white py-2 rounded-lg transition-colors">
                <span>🚪</span> Sair
             </button>
          </div>
       </aside>

       <main className="flex-1 ml-64 p-8">
          {settings.systemMessage?.active && !systemMsgClosed && (
            <div className={`mb-6 rounded-lg p-4 flex justify-between items-start shadow-sm border-l-4 ${
              settings.systemMessage.level === 'error' ? 'bg-red-50 border-red-500 text-red-800' :
              settings.systemMessage.level === 'warning' ? 'bg-amber-50 border-amber-500 text-amber-800' :
              'bg-blue-50 border-blue-500 text-blue-800'
            }`}>
               <div>
                  <h3 className="font-bold uppercase text-sm mb-1 flex items-center gap-2">
                     {settings.systemMessage.level === 'error' ? '🚨 MANUTENÇÃO / ERRO' : 
                      settings.systemMessage.level === 'warning' ? '⚠️ ATENÇÃO' : 'ℹ️ INFORMAÇÃO'}
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">{settings.systemMessage.message}</p>
               </div>
               <button onClick={() => setSystemMsgClosed(true)} className="text-current opacity-60 hover:opacity-100">✕</button>
            </div>
          )}
          {renderContent()}
       </main>
    </div>
  );
}

const SidebarItem = ({ label, icon, active, onClick, visible }: any) => {
    if (!visible) return null;
    return (
        <button 
          onClick={onClick}
          className={`w-full flex items-center gap-3 px-6 py-3 transition-colors ${active ? 'bg-indigo-800 text-white border-r-4 border-emerald-400' : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'}`}
        >
            <span className="text-lg">{icon}</span>
            <span className="font-medium text-sm">{label}</span>
        </button>
    );
};

export default App;