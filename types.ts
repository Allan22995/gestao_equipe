


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

// Configuração de Função (Role)
export interface RoleConfig {
  name: string;
  canViewAllSectors: boolean; // Se true, vê tudo. Se false, precisa definir quais setores vê.
  permissions: string[]; // Lista de IDs de permissão (ex: 'tab:dashboard', 'action:edit_events')
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
  createdAt: string;
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
  roles: RoleConfig[]; // Alterado de string[] para RoleConfig[]
  sectors: string[]; 
  accessProfiles: string[]; 
  eventTypes: EventTypeConfig[];
  scheduleTemplates: ScheduleTemplate[]; // Novo: Lista de Modelos de Jornada
  spreadsheetUrl?: string;
  systemMessage?: SystemMessage; // Novo: Mensagem global do sistema
  coverageRules?: CoverageRule[]; // Novo: Regras de cobertura mínima
}

// Mantemos compatibilidade com string, mas o valor virá do config
export type EventType = string; 

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

// --- DEFINIÇÃO DE PERMISSÕES DO SISTEMA ---
export const SYSTEM_PERMISSIONS = [
  // Acesso as Abas
  { id: 'tab:calendario', label: 'Aba: Calendário', category: 'Navegação' },
  { id: 'tab:dashboard', label: 'Aba: Dashboard', category: 'Navegação' },
  { id: 'tab:simulador', label: 'Aba: Simulador', category: 'Navegação' },
  { id: 'tab:colaboradores', label: 'Aba: Colaboradores', category: 'Navegação' },
  { id: 'tab:eventos', label: 'Aba: Eventos', category: 'Navegação' },
  { id: 'tab:plantoes', label: 'Aba: Plantões', category: 'Navegação' },
  { id: 'tab:saldo', label: 'Aba: Saldo', category: 'Navegação' },
  { id: 'tab:previsao_ferias', label: 'Aba: Prev. Férias', category: 'Navegação' },
  { id: 'tab:comunicados', label: 'Aba: Comunicados', category: 'Navegação' },
  { id: 'tab:configuracoes', label: 'Aba: Configurações', category: 'Navegação' },
  
  // Ações Específicas
  { id: 'view:phones', label: 'Visualizar Contatos (Tel/Outros)', category: 'Privacidade' },
  { id: 'write:collaborators', label: 'Editar/Excluir Colaboradores', category: 'Edição' },
  { id: 'write:events', label: 'Editar/Excluir Eventos', category: 'Edição' },
  { id: 'write:on_calls', label: 'Editar/Excluir Plantões', category: 'Edição' },
  { id: 'write:vacation', label: 'Gerenciar Férias', category: 'Edição' },
  { id: 'write:balance', label: 'Ajuste Manual de Saldo', category: 'Edição' },
  { id: 'write:coverage_rules', label: 'Configurar Regras de Cobertura', category: 'Configuração' },

  // Novas Permissões Granulares de Configuração
  { id: 'settings:integration', label: 'Config: Integrações (Planilha)', category: 'Configuração (Detalhes)' },
  { id: 'settings:lists', label: 'Config: Filiais, Setores e Perfis', category: 'Configuração (Detalhes)' },
  { id: 'settings:event_types', label: 'Config: Tipos de Evento', category: 'Configuração (Detalhes)' },
  { id: 'settings:access_control', label: 'Config: Controle de Acesso (Roles)', category: 'Configuração (Detalhes)' },
  { id: 'settings:schedule_templates', label: 'Config: Modelos de Jornada', category: 'Configuração (Detalhes)' },
  { id: 'settings:system_msg', label: 'Config: Avisos do Sistema', category: 'Configuração (Detalhes)' },
];
