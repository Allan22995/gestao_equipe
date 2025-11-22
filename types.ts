

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

export type UserProfile = 'admin' | 'colaborador' | 'noc';

export interface Collaborator {
  id: string;
  colabId: string;
  name: string;
  email: string; // Vinculo com Firebase Auth
  phone: string; // Contato para NOC/Admin
  profile: UserProfile; // Perfil de acesso
  branch: string;
  role: string;
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

export interface SystemSettings {
  branches: string[];
  roles: string[];
  eventTypes: EventTypeConfig[];
  spreadsheetUrl?: string; // Novo campo para link da planilha
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

export type TabType = 'calendario' | 'dashboard' | 'colaboradores' | 'eventos' | 'plantoes' | 'saldo' | 'previsao_ferias' | 'configuracoes' | 'comunicados';