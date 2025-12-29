
export interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
  startsPreviousDay?: boolean;
}

export interface Schedule {
  segunda: DaySchedule;
  terca: DaySchedule;
  quarta: DaySchedule;
  quinta: DaySchedule;
  sexta: DaySchedule;
  sabado: DaySchedule;
  domingo: DaySchedule;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  schedule: Schedule;
  branches?: string[]; // NOVO: Vinculação com filiais
}

export interface RotationRule {
  id: string;
  label: string;
}

export interface RoleConfig {
  name: string;
  canViewAllSectors: boolean;
  permissions: string[]; // Lista de IDs de permissão (ex: 'collaborators:create')
  manageableProfiles?: string[];
}

export interface AccessProfileConfig {
  id: string;
  name: string;
  active: boolean;
}

export type UserProfile = string;

export interface Collaborator {
  id: string;
  colabId: string;
  name: string;
  email: string;
  phone: string;
  otherContact?: string;
  profile: UserProfile;
  branch: string;
  role: string;
  sector?: string;
  allowedSectors?: string[];
  login: string;
  shiftType: string;
  schedule: Schedule;
  hasRotation?: boolean;
  rotationGroup?: string;
  rotationStartDate?: string;
  createdAt: string;
  active?: boolean;
  leaderId?: string;
  // NOVO: Controle de Saldo Importado
  bankBalance?: number;
  lastBalanceImport?: string;
}

export type EventBehavior = 'neutral' | 'debit' | 'credit_1x' | 'credit_2x';

export interface EventTypeConfig {
  id: string;
  label: string;
  behavior: EventBehavior;
}

// NOVO: Interface para Eventos Sazonais
export interface SeasonalEvent {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  color: string; // Hex code
  active: boolean;
}

export interface SystemMessage {
  active: boolean;
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface CoverageRule {
  roleName: string;
  minPeople: number;
  sector?: string; // NOVO: Regra específica por setor
  shift?: string;  // NOVO: Regra específica por turno
}

export interface SystemSettings {
  companies?: string[]; // NOVO: Lista de Empresas
  companyBranches?: Record<string, string[]>; // NOVO: Mapeamento Empresa -> Filiais
  branches: string[];
  sectors: string[]; // Mantido para retrocompatibilidade
  branchSectors?: Record<string, string[]>; // Mapeamento Filial -> Setores
  branchLinks?: Record<string, string[]>; // NOVO: Mapeamento Filial -> Filiais Vinculadas (Líderes visíveis)
  roles: RoleConfig[]; 
  accessProfiles: AccessProfileConfig[]; 
  eventTypes: EventTypeConfig[];
  seasonalEvents?: SeasonalEvent[]; // NOVO: Lista de eventos sazonais
  scheduleTemplates: ScheduleTemplate[]; 
  shiftRotations: RotationRule[];
  spreadsheetUrl?: string;
  systemMessage?: SystemMessage; 
  coverageRules?: CoverageRule[]; 
  approvalEscalationDelay?: number; // NOVO: Prazo em horas para escalonamento automático
  sectorsWithEventTypeSelection?: string[]; // NOVO: Setores que podem selecionar o tipo de evento
}

export type EventType = string; 
export type EventStatus = 'pendente' | 'aprovado' | 'nova_opcao' | 'reprovado';

export interface EscalationLog {
  date: string;
  fromId: string;
  toId: string;
  reason: string;
}

export interface EventRecord {
  id: string;
  collaboratorId: string;
  type: EventType;
  typeLabel?: string;
  startDate: string;
  endDate: string;
  observation: string;
  daysGained: number;
  daysUsed: number;
  status?: EventStatus;
  collaboratorAcceptedProposal?: boolean;
  schedule?: Schedule; // NOVO: Escala temporária para este evento
  createdAt: string;
  createdBy?: string; // NOVO: Quem criou
  updatedBy?: string;
  lastUpdatedAt?: string;
  
  // NOVO: Fluxo de Aprovação
  approverChain?: string[]; // IDs dos líderes na cadeia
  currentApproverId?: string; // ID de quem deve aprovar agora
  escalationHistory?: EscalationLog[];
}

export interface OnCallRecord {
  id: string;
  collaboratorId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  observation: string;
  createdAt: string;
  createdBy?: string; // NOVO
  updatedBy?: string;
  lastUpdatedAt?: string;
}

export interface BalanceAdjustment {
  id: string;
  collaboratorId: string;
  amount: number;
  reason: string;
  createdAt: string;
  createdBy: string;
}

export type VacationStatus = 'pendente' | 'aprovado' | 'negociacao' | 'nova_opcao';

export interface VacationRequest {
  id: string;
  collaboratorId: string;
  startDate: string;
  endDate: string;
  status: VacationStatus;
  notes: string;
  collaboratorAcceptedProposal?: boolean;
  createdAt: string;
  createdBy?: string; // NOVO
  updatedBy?: string;
  lastUpdatedAt?: string;
}

export interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'delete';
  entity: 'evento' | 'plantao' | 'colaborador' | 'ajuste_saldo' | 'previsao_ferias' | 'configuracao';
  details: string;
  performedBy: string;
  timestamp: string;
}

export type TabType = 'calendario' | 'dashboard' | 'simulador' | 'colaboradores' | 'eventos' | 'plantoes' | 'saldo' | 'previsao_ferias' | 'configuracoes' | 'comunicados';

// --- NOVA DEFINIÇÃO DE PERMISSÕES GRANULARES ---

export interface PermissionAction {
  id: string;
  label: string;
  type: 'view' | 'create' | 'update' | 'delete' | 'special';
}

export interface PermissionModule {
  id: string;
  label: string;
  description: string;
  icon: string;
  actions: PermissionAction[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Visão geral, métricas e status em tempo real.',
    icon: '📊',
    actions: [
      { id: 'dashboard:view', label: 'Visualizar Tela', type: 'view' },
      { id: 'dashboard:view_phones', label: 'Ver Telefones', type: 'special' },
      { id: 'dashboard:view_charts', label: 'Ver Gráficos Distribuição', type: 'special' }
    ]
  },
  {
    id: 'calendar',
    label: 'Calendário',
    description: 'Visualização mensal de escalas e eventos.',
    icon: '📆',
    actions: [
      { id: 'calendar:view', label: 'Visualizar Tela', type: 'view' },
      { id: 'calendar:view_phones', label: 'Ver Telefones', type: 'special' }
    ]
  },
  {
    id: 'collaborators',
    label: 'Colaboradores',
    description: 'Gestão do cadastro de funcionários.',
    icon: '👥',
    actions: [
      { id: 'collaborators:view', label: 'Visualizar Lista', type: 'view' },
      { id: 'collaborators:create', label: 'Cadastrar Novo', type: 'create' },
      { id: 'collaborators:update', label: 'Editar Dados', type: 'update' },
      { id: 'collaborators:delete', label: 'Excluir', type: 'delete' }
    ]
  },
  {
    id: 'events',
    label: 'Eventos (Folgas)',
    description: 'Lançamento de folgas, faltas e abonos.',
    icon: '📅',
    actions: [
      { id: 'events:view', label: 'Visualizar Histórico', type: 'view' },
      { id: 'events:create', label: 'Lançar Evento', type: 'create' },
      { id: 'events:update', label: 'Editar Evento', type: 'update' },
      { id: 'events:delete', label: 'Excluir Evento', type: 'delete' }
    ]
  },
  {
    id: 'on_calls',
    label: 'Plantões',
    description: 'Gestão de horários de plantão extra.',
    icon: '🌙',
    actions: [
      { id: 'on_calls:view', label: 'Visualizar Plantões', type: 'view' },
      { id: 'on_calls:create', label: 'Criar Plantão', type: 'create' },
      { id: 'on_calls:update', label: 'Editar Plantão', type: 'update' },
      { id: 'on_calls:delete', label: 'Excluir Plantão', type: 'delete' }
    ]
  },
  {
    id: 'vacation',
    label: 'Férias',
    description: 'Controle de previsões e solicitações.',
    icon: '✈️',
    actions: [
      { id: 'vacation:view', label: 'Visualizar Previsões', type: 'view' },
      { id: 'vacation:create', label: 'Solicitar Férias', type: 'create' },
      { id: 'vacation:update', label: 'Editar Solicitação', type: 'update' },
      { id: 'vacation:delete', label: 'Excluir Solicitação', type: 'delete' },
      { id: 'vacation:manage_status', label: 'Aprovar/Reprovar', type: 'special' }
    ]
  },
  {
    id: 'balance',
    label: 'Banco de Horas',
    description: 'Saldo e ajustes manuais.',
    icon: '💰',
    actions: [
      { id: 'balance:view', label: 'Visualizar Saldo', type: 'view' },
      { id: 'balance:create', label: 'Lançar Ajuste Manual', type: 'create' }
    ]
  },
  {
    id: 'simulator',
    label: 'Simulador',
    description: 'Simulação de escalas e regras.',
    icon: '🧪',
    actions: [
      { id: 'simulator:view', label: 'Acessar Simulador', type: 'view' },
      { id: 'simulator:manage_rules', label: 'Configurar Regras', type: 'special' }
    ]
  },
  {
    id: 'comms',
    label: 'Comunicados',
    description: 'Gerador de imagens.',
    icon: '📢',
    actions: [
      { id: 'comms:view', label: 'Acessar Gerador', type: 'view' }
    ]
  },
  {
    id: 'settings',
    label: 'Configurações',
    description: 'Administração granular do sistema.',
    icon: '⚙️',
    actions: [
      { id: 'settings:view', label: 'Acesso Geral à Aba', type: 'view' },
      
      // 1. Estrutura (Subníveis)
      { id: 'settings:view_branches', label: 'Ver Filiais', type: 'view' },
      { id: 'settings:edit_branches', label: 'Gerenciar Filiais', type: 'special' },
      { id: 'settings:view_sectors', label: 'Ver Setores', type: 'view' },
      { id: 'settings:edit_sectors', label: 'Gerenciar Setores', type: 'special' },
      
      // 2. Funções (Subníveis)
      { id: 'settings:view_roles_list', label: 'Ver Lista Funções', type: 'view' },
      { id: 'settings:manage_roles_list', label: 'Criar/Excluir Funções', type: 'special' },
      { id: 'settings:view_permissions_matrix', label: 'Ver Matriz Permissões', type: 'view' },
      { id: 'settings:manage_permissions_matrix', label: 'Editar Permissões', type: 'special' },
      
      // 3. Tipos de Evento
      { id: 'settings:view_event_types', label: 'Ver Tipos de Evento', type: 'view' },
      { id: 'settings:edit_event_types', label: 'Editar Tipos de Evento', type: 'special' },
      
      // 4. Escalas
      { id: 'settings:view_rotations', label: 'Ver Escalas', type: 'view' },
      { id: 'settings:edit_rotations', label: 'Editar Escalas', type: 'special' },
      
      // 5. Modelos Jornada
      { id: 'settings:view_templates', label: 'Ver Modelos de Jornada', type: 'view' },
      { id: 'settings:edit_templates', label: 'Editar Modelos de Jornada', type: 'special' },
      
      // 6. Integrações
      { id: 'settings:view_integrations', label: 'Ver Integrações', type: 'view' },
      { id: 'settings:edit_integrations', label: 'Editar Integrações', type: 'special' },
      
      // 7. Sazonais
      { id: 'settings:view_seasonal', label: 'Ver Sazonais', type: 'view' },
      { id: 'settings:edit_seasonal', label: 'Editar Sazonais', type: 'special' },

      // 8. Avisos
      { id: 'settings:view_system_msg', label: 'Ver Config de Avisos', type: 'view' },
      { id: 'settings:manage_system_msg', label: 'Editar Avisos', type: 'special' }
    ]
  }
];

export const SYSTEM_PERMISSIONS = PERMISSION_MODULES.flatMap(m => m.actions);