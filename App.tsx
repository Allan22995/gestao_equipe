

import React, { useState, useEffect } from 'react';
import { TabType, Collaborator, EventRecord, OnCallRecord, BalanceAdjustment, VacationRequest, AuditLog, SystemSettings, UserProfile, RoleConfig, SYSTEM_PERMISSIONS } from './types';
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
  roles: [
    { name: 'Gerente', canViewAllSectors: true, permissions: SYSTEM_PERMISSIONS.map(p => p.id) },
    { name: 'Coordenador', canViewAllSectors: false, permissions: ['tab:calendario', 'tab:dashboard', 'tab:colaboradores', 'tab:eventos', 'tab:plantoes', 'view:phones', 'write:events', 'write:on_calls'] },
    { name: 'Vendedor', canViewAllSectors: false, permissions: ['tab:calendario', 'tab:dashboard'] },
    { name: 'NOC', canViewAllSectors: true, permissions: ['tab:calendario', 'tab:dashboard', 'view:phones'] }
  ],
  sectors: ['Logística', 'TI', 'Vendas', 'RH'],
  accessProfiles: ['admin', 'colaborador', 'noc'],
  eventTypes: [
    { id: 'ferias', label: 'Férias', behavior: 'neutral' },
    { id: 'folga', label: 'Folga', behavior: 'debit' },
    { id: 'trabalhado', label: 'Trabalhado', behavior: 'credit_2x' }
  ],
  scheduleTemplates: [], 
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1mZiuHggQ3L_fS3rESZ9VOs1dizo_Zl5OTqKArwtQBoU/edit?gid=1777395781#gid=1777395781'
};

function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Current User Context
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userColabId, setUserColabId] = useState<string | null>(null);
  const [currentUserAllowedSectors, setCurrentUserAllowedSectors] = useState<string[]>([]);
  const [currentUserPermissions, setCurrentUserPermissions] = useState<string[]>([]);

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

  // Match Authenticated User with Collaborator Data
  useEffect(() => {
    if (user && collaborators.length > 0) {
      const foundColab = collaborators.find(c => c.email === user.email);
      if (foundColab) {
        setUserProfile(foundColab.profile || 'colaborador');
        setUserColabId(foundColab.id);
        
        // 1. Encontrar a Role Config
        let roleConfig = settings.roles.find(r => r.name === foundColab.role);
        
        // Se for admin hardcoded no profile, dá acesso total independente da role
        if (foundColab.profile === 'admin') {
           setCurrentUserAllowedSectors([]); 
           setCurrentUserPermissions(SYSTEM_PERMISSIONS.map(p => p.id)); // Full access
        } else {
           // 2. Definir Setores Permitidos (Escopo de Dados)
           if (roleConfig && roleConfig.canViewAllSectors) {
              setCurrentUserAllowedSectors([]); 
           } else {
              const allowed = foundColab.allowedSectors && foundColab.allowedSectors.length > 0 
                ? foundColab.allowedSectors 
                : (foundColab.sector ? [foundColab.sector] : []);
              setCurrentUserAllowedSectors(allowed);
           }

           // 3. Definir Permissões (Funcionalidades)
           // Se a role não tem permissões definidas (legado), vamos tentar adivinhar ou dar padrão restrito
           if (roleConfig && roleConfig.permissions) {
              setCurrentUserPermissions(roleConfig.permissions);
           } else {
              // Fallback para NOC (hardcoded logic replacement)
              if (foundColab.profile === 'noc') {
                  setCurrentUserPermissions(['tab:calendario', 'tab:dashboard', 'view:phones']);
              } else {
                  // Default Colaborador: Vê Calendário, Dashboard
                  setCurrentUserPermissions(['tab:calendario', 'tab:dashboard', 'tab:comunicados']);
              }
           }
        }
      } else {
        setUserProfile(null); 
        setCurrentUserAllowedSectors([]);
        setCurrentUserPermissions([]);
      }
    }
  }, [user, collaborators, settings.roles]);

  // Initial Data Loading
  useEffect(() => {
    if (!user) return; 

    console.log('🚀 Inicializando App e Listeners...');

    const unsubColabs = dbService.subscribeToCollaborators(setCollaborators);
    const unsubEvents = dbService.subscribeToEvents(setEvents);
    const unsubOnCalls = dbService.subscribeToOnCalls(setOnCalls);
    const unsubAdjustments = dbService.subscribeToAdjustments(setAdjustments);
    const unsubVacation = dbService.subscribeToVacationRequests(setVacationRequests);
    
    const unsubSettings = dbService.subscribeToSettings(
      (data) => {
        if (data) {
          let loadedSettings = { ...DEFAULT_SETTINGS, ...data };
          
          // Migração de Roles Antigas (String -> Object)
          if (loadedSettings.roles.length > 0 && typeof loadedSettings.roles[0] === 'string') {
             const legacyRoles = loadedSettings.roles as unknown as string[];
             loadedSettings.roles = legacyRoles.map(r => ({ 
               name: r, 
               canViewAllSectors: true,
               permissions: SYSTEM_PERMISSIONS.map(p => p.id) // Default legacy to full? Or restrict?
             }));
          }
          
          // Migração de Roles sem permissões (Object sem array)
          loadedSettings.roles = loadedSettings.roles.map((r: any) => {
            if (!r.permissions) {
                // Default Permissions for legacy objects
                return { ...r, permissions: ['tab:calendario', 'tab:dashboard'] };
            }
            return r;
          });

          setSettings(loadedSettings);
        } else {
          dbService.saveSettings(DEFAULT_SETTINGS).catch(console.error);
          setSettings(DEFAULT_SETTINGS);
        }
      },
      (errorMsg) => showToast(errorMsg, true)
    );

    return () => {
      unsubColabs(); unsubEvents(); unsubOnCalls(); unsubAdjustments(); unsubVacation(); unsubSettings();
    };
  }, [user]);

  // Helpers
  const hasPermission = (perm: string) => {
    // Admin profile always has root access
    if (userProfile === 'admin') return true;
    return currentUserPermissions.includes(perm);
  };

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

  // CRUD Wrappers
  const handleAddCollaborator = async (c: Collaborator) => { try { const { id, ...rest } = c; await dbService.addCollaborator(rest as any); } catch (e) { console.error(e); showToast('Erro ao salvar', true); } };
  const handleUpdateCollaborator = async (c: Collaborator) => { try { await dbService.updateCollaborator(c.id, c); } catch (e) { console.error(e); showToast('Erro ao atualizar', true); } };
  const handleDeleteCollaborator = async (id: string) => { try { await dbService.deleteCollaborator(id); } catch (e) { console.error(e); showToast('Erro ao excluir', true); } };
  const handleAddEvent = async (e: EventRecord) => { try { await dbService.addEvent(e); } catch (err) { showToast('Erro ao criar evento', true); } };
  const handleUpdateEvent = async (e: EventRecord) => { try { await dbService.updateEvent(e.id, e); } catch (err) { showToast('Erro ao atualizar evento', true); } };
  const handleDeleteEvent = async (id: string) => { try { await dbService.deleteEvent(id); } catch (err) { showToast('Erro ao excluir evento', true); } };
  const handleAddOnCall = async (o: OnCallRecord) => { try { await dbService.addOnCall(o); } catch (err) { showToast('Erro ao criar plantão', true); } };
  const handleUpdateOnCall = async (o: OnCallRecord) => { try { await dbService.updateOnCall(o.id, o); } catch (err) { showToast('Erro ao atualizar plantão', true); } };
  const handleDeleteOnCall = async (id: string) => { try { await dbService.deleteOnCall(id); } catch (err) { showToast('Erro ao excluir plantão', true); } };
  const handleAddAdjustment = async (a: BalanceAdjustment) => { try { await dbService.addAdjustment(a); } catch (err) { showToast('Erro ao lançar ajuste', true); } };
  const handleAddVacation = async (v: VacationRequest) => { try { await dbService.addVacationRequest(v); } catch (err) { showToast('Erro ao solicitar férias', true); } };
  const handleUpdateVacation = async (v: VacationRequest) => { try { await dbService.updateVacationRequest(v.id, v); } catch (err) { showToast('Erro ao atualizar solicitação', true); } };
  const handleDeleteVacation = async (id: string) => { try { await dbService.deleteVacationRequest(id); } catch (err) { showToast('Erro ao excluir solicitação', true); } };
  const handleSaveSettings = async (s: SystemSettings) => { try { await dbService.saveSettings(s); showToast('Configurações salvas!'); } catch (err: any) { console.error(err); showToast(err.message || 'Erro ao salvar.', true); throw err; } };

  const currentUserName = userColabId ? (collaborators.find(c => c.id === userColabId)?.name || user?.email) : user?.email || 'Sistema';

  // --- TAB CONTROL LOGIC ---
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

  // Filter tabs based on permissions
  const visibleTabs = allTabs.filter(t => hasPermission(`tab:${t.id}`));

  useEffect(() => {
    if (visibleTabs.length > 0) {
      const isAllowed = visibleTabs.some(t => t.id === activeTab);
      if (!isAllowed) setActiveTab(visibleTabs[0].id);
    }
  }, [currentUserPermissions, visibleTabs]);

  const renderContent = () => {
    if (!userProfile) return null;
    if (!hasPermission(`tab:${activeTab}`)) return <div className="p-8 text-center text-gray-500">Acesso Negado a esta aba.</div>;

    switch (activeTab) {
      case 'calendario':
        return <Calendar 
            collaborators={collaborators} events={events} onCalls={onCalls} vacationRequests={vacationRequests} 
            settings={settings} currentUserProfile={userProfile} currentUserAllowedSectors={currentUserAllowedSectors}
            canViewPhones={hasPermission('view:phones')}
          />;
      case 'dashboard':
        return <Dashboard 
            collaborators={collaborators} events={events} onCalls={onCalls} vacationRequests={vacationRequests} 
            settings={settings} currentUserProfile={userProfile} currentUserAllowedSectors={currentUserAllowedSectors}
            canViewPhones={hasPermission('view:phones')}
          />;
      case 'colaboradores':
        return <Collaborators 
          collaborators={collaborators} onAdd={handleAddCollaborator} onUpdate={handleUpdateCollaborator} onDelete={handleDeleteCollaborator}
          showToast={showToast} settings={settings} currentUserProfile={userProfile}
          canEdit={hasPermission('write:collaborators')}
        />;
      case 'eventos':
        return <Events 
          collaborators={collaborators} events={events} onAdd={handleAddEvent} onUpdate={handleUpdateEvent} onDelete={handleDeleteEvent}
          showToast={showToast} logAction={logAction} settings={settings} 
          canEdit={hasPermission('write:events')}
        />;
      case 'plantoes':
        return <OnCall 
          collaborators={collaborators} onCalls={onCalls} onAdd={handleAddOnCall} onUpdate={handleUpdateOnCall} onDelete={handleDeleteOnCall}
          showToast={showToast} logAction={logAction} settings={settings} 
          canEdit={hasPermission('write:on_calls')}
        />;
      case 'saldo':
        return <Balance 
          collaborators={collaborators} events={events} adjustments={adjustments} onAddAdjustment={handleAddAdjustment}
          showToast={showToast} logAction={logAction} currentUserName={currentUserName as string}
          canEdit={hasPermission('write:balance')}
        />;
      case 'previsao_ferias':
        return <VacationForecast 
          collaborators={collaborators} requests={vacationRequests} onAdd={handleAddVacation} onUpdate={handleUpdateVacation} onDelete={handleDeleteVacation}
          showToast={showToast} logAction={logAction} currentUserProfile={userProfile} currentUserName={currentUserName as string}
          canEdit={hasPermission('write:vacation')}
        />;
      case 'comunicados': return <CommunicationGenerator />;
      case 'configuracoes': return <Settings settings={settings} setSettings={handleSaveSettings} showToast={showToast} />;
      default: return null;
    }
  };

  if (authLoading) return <div className="min-h-screen bg-[#1E90FF] flex items-center justify-center text-white"><div className="animate-pulse text-xl font-bold">Carregando Sistema...</div></div>;
  if (!user) return <Login />;
  
  if (!userProfile && collaborators.length > 0) { 
     return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-xl shadow-xl max-w-md">
          <div className="text-amber-500 mb-4 flex justify-center"><svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acesso Pendente</h2>
          <p className="text-gray-600 mb-6">Seu e-mail <b>{user.email}</b> foi autenticado, mas não consta na base.</p>
          <button onClick={() => signOut(auth)} className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors">Sair / Tentar outra conta</button>
        </div>
      </div>
     );
  }

  if (collaborators.length === 0 && !userProfile) {
      return (
        <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-6">
           <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Configuração Inicial</h2>
              <p className="text-gray-600 mb-6">Não existem colaboradores. Crie manualmente o registro para: <b>{user.email}</b> com perfil <b>admin</b> no Firebase.</p>
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
                  {currentUserAllowedSectors && currentUserAllowedSectors.length > 0 && (
                    <span className="bg-indigo-600 px-2 py-0.5 rounded text-white text-xs" title="Setores Permitidos">{currentUserAllowedSectors.length} Setor(es)</span>
                  )}
                </p>
              </div>
              <button onClick={() => signOut(auth)} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2">Sair <span>➜</span></button>
           </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-4">
           <div className="flex space-x-1 overflow-x-auto pb-0 scrollbar-hide">
             {visibleTabs.map(tab => (
               <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3 rounded-t-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-[#1E90FF] shadow-lg transform translate-y-0.5' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'}`}>
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
        <p>Desenvolvido por <a href="https://app.humand.co/profile/4970892" target="_blank" className="font-bold hover:text-white underline decoration-transparent hover:decoration-white transition-all">Fabio de Moraes</a> e <a href="https://app.humand.co/profile/4968748" target="_blank" className="font-bold hover:text-white underline decoration-transparent hover:decoration-white transition-all">Alan Matheus</a></p>
      </footer>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-lg shadow-2xl text-white font-bold animate-slideIn z-50 ${toast.error ? 'bg-red-500' : 'bg-emerald-500'}`}>{toast.msg}</div>
      )}
      
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
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
