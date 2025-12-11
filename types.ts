
export interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
  startsPreviousDay?: boolean; // Indica se o turno começa no dia anterior (ex: 22:00 do dia anterior)
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

// Novo: Modelo de Jornada para Configurações
export interface ScheduleTemplate {
  id: string;
  name: string;
  schedule: Schedule;
}

// Novo: Configuração Detalhada de Escala de Revezamento
export interface RotationRule {
  id: string; // ex: 'A', 'B'
  label: string; // ex: 'Escala A'
  // workSundays removido na V4 - Lógica agora é baseada em data de referência (3x1)
}

// Configuração de Função (Role)
export interface RoleConfig {
  name: string;
  canViewAllSectors: boolean; // Se true, vê tudo. Se false, precisa definir quais setores vê.
  permissions: string[]; // Lista de IDs de permissão (ex: 'collaborators:view', 'events:create')
  manageableProfiles?: string[]; // Lista de nomes de perfis que esta role pode atribuir a novos usuários
}

// Configuração de Perfil de Acesso (Novo Objeto)
export interface AccessProfileConfig {
  id: string;
  name: string;
  active: boolean; // Flag para restringir visualização no cadastro
}

// Changed to string to allow dynamic profiles from settings
export type UserProfile = string;

export interface Collaborator {
  id: string;
  colabId: string;
  name: string;
  email: string; // Vinculo com Firebase Auth
  phone: string; // Contato para NOC/Admin
  otherContact?: string; // Novo: Outro contato (Humand, Gchat, etc)
  profile: UserProfile; // Perfil de acesso
  branch: string;
  role: string;
  sector?: string; // Setor onde trabalha
  allowedSectors?: string[]; // Novos: Setores que pode visualizar (se a função for restrita)
  login: string;
  shiftType: string;
  schedule: Schedule;
  hasRotation?: boolean; // Novo: Indica se o funcionário trabalha em escala de revezamento
  rotationGroup?: string; // Novo: Indica qual a escala (A, B, C, D...)
  rotationStartDate?: string; // Novo V4: Data de referência da última folga para cálculo 3x1
  createdAt: string;
  active?: boolean; // Novo: Status do colaborador (Ativo/Inativo)
  leaderId?: string; // Novo: ID do Líder Imediato (Hierarquia)
}

export type EventBehavior = 'neutral' | 'debit' | 'credit_1x' | 'credit_2x';

export interface EventTypeConfig {
  id: string;
  label: string;
  behavior: EventBehavior;
}

// Novo: Mensagem do Sistema (Banner Global)
export interface SystemMessage {
  active: boolean;
  level: 'info' | 'warning' | 'error';
  message: string;
}

// Novo: Regra de Cobertura
export interface CoverageRule {
  roleName: string; // Vinculado ao RoleConfig.name
  minPeople: number;
}

export interface SystemSettings {
  branches: string[];
  roles: RoleConfig[]; 
  sectors: string[]; 
  accessProfiles: AccessProfileConfig[]; 
  eventTypes: EventTypeConfig[];
  scheduleTemplates: ScheduleTemplate[]; 
  shiftRotations: RotationRule[]; // Alterado de string[] para RotationRule[]
  spreadsheetUrl?: string;
  systemMessage?: SystemMessage; 
  coverageRules?: CoverageRule[]; 
}

// Mantemos compatibilidade com string, mas o valor virá do config
export type EventType = string; 

export type EventStatus = 'pendente' | 'aprovado' | 'nova_opcao' | 'reprovado';

export interface EventRecord {
  id: string;
  collaboratorId: string;
  type: EventType; // Agora é o ID do EventTypeConfig ou uma string legada
  typeLabel?: string; // Para facilitar exibição histórica
  startDate: string;
  endDate: string;
  observation: string;
  daysGained: number;
  daysUsed: number;
  status?: EventStatus; // Novo: Status da solicitação (Eventos de Folga)
  collaboratorAcceptedProposal?: boolean; // Novo: Se o colaborador aceitou a contraproposta
  createdAt: string;
  updatedBy?: string;
  lastUpdatedAt?: string;
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
  updatedBy?: string;
  lastUpdatedAt?: string;
}

// Novo: Ajuste Manual de Saldo
export interface BalanceAdjustment {
  id: string;
  collaboratorId: string;
  amount: number; // Positivo para crédito, negativo para débito
  reason: string;
  createdAt: string;
  createdBy: string;
}

// Novo: Previsão de Férias
export type VacationStatus = 'pendente' | 'aprovado' | 'negociacao' | 'nova_opcao';

export interface VacationRequest {
  id: string;
  collaboratorId: string;
  startDate: string;
  endDate: string;
  status: VacationStatus;
  notes: string; // Para observações ou contra-proposta
  collaboratorAcceptedProposal?: boolean; // Indica se o colaborador aceitou a contraproposta
  createdAt: string;
  updatedBy?: string;
  lastUpdatedAt?: string;
}

// Novo: Log de Auditoria
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

export interface PermissionModule {
  id: string;
  label: string;
  description: string;
  icon: string;
  actions: {
    id: string;
    label: string;
    type: 'view' | 'create' | 'update' | 'delete' | 'special';
  }[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Visão geral, métricas e status em tempo real.',
    icon: '📊',
    actions: [
      { id: 'dashboard:view', label: 'Visualizar Tela', type: 'view' },
      { id: 'dashboard:view_phones', label: 'Ver Telefones/Contatos', type: 'special' }
    ]
  },
  {
    id: 'calendar',
    label: 'Calendário',
    description: 'Visualização mensal de escalas e eventos.',
    icon: '📆',
    actions: [
      { id: 'calendar:view', label: 'Visualizar Tela', type: 'view' },
      { id: 'calendar:view_phones', label: 'Ver Telefones/Contatos', type: 'special' }
    ]
  },
  {
    id: 'collaborators',
    label: 'Colaboradores',
    description: 'Gestão do cadastro de funcionários e perfis.',
    icon: '👥',
    actions: [
      { id: 'collaborators:view', label: 'Visualizar Lista', type: 'view' },
      { id: 'collaborators:create', label: 'Cadastrar Novo', type: 'create' },
      { id: 'collaborators:update', label: 'Editar Dados', type: 'update' },
      { id: 'collaborators:delete', label: 'Excluir/Inativar', type: 'delete' }
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
    description: 'Controle de previsões e solicitações de férias.',
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
    description: 'Visualização de saldo e ajustes manuais.',
    icon: '💰',
    actions: [
      { id: 'balance:view', label: 'Visualizar Saldo', type: 'view' },
      { id: 'balance:create', label: 'Lançar Ajuste Manual', type: 'create' }
    ]
  },
  {
    id: 'simulator',
    label: 'Simulador',
    description: 'Simulação de escalas futuras e regras.',
    icon: '🧪',
    actions: [
      { id: 'simulator:view', label: 'Acessar Simulador', type: 'view' },
      { id: 'simulator:manage_rules', label: 'Configurar Regras', type: 'special' }
    ]
  },
  {
    id: 'comms',
    label: 'Comunicados',
    description: 'Gerador de imagens para comunicados.',
    icon: '📢',
    actions: [
      { id: 'comms:view', label: 'Acessar Gerador', type: 'view' }
    ]
  },
  {
    id: 'settings',
    label: 'Configurações',
    description: 'Administração do sistema.',
    icon: '⚙️',
    actions: [
      { id: 'settings:view', label: 'Acessar Configurações', type: 'view' },
      { id: 'settings:manage_general', label: 'Gerenciar Cadastros', type: 'update' },
      { id: 'settings:manage_access', label: 'Controle de Acesso', type: 'special' }
    ]
  }
];

export const SYSTEM_PERMISSIONS = PERMISSION_MODULES.flatMap(m => m.actions);
