
import { Collaborator } from '../types';

export const generateUUID = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const formatTitleCase = (str: string) => {
  if (!str) return '';
  const exceptions = ['de', 'da', 'do', 'dos', 'das', 'e', 'y'];
  return str.trim().toLowerCase().split(/\s+/).map((word, i) => {
    if (exceptions.includes(word) && i !== 0) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};

export const getFeriados = (ano: number): Record<string, string> => {
  const nacionais = {
    [`${ano}-01-01`]: 'Ano Novo',
    [`${ano}-04-21`]: 'Tiradentes',
    [`${ano}-05-01`]: 'Dia do Trabalho',
    [`${ano}-09-07`]: 'Independência do Brasil',
    [`${ano}-10-12`]: 'Nossa Senhora Aparecida',
    [`${ano}-11-02`]: 'Finados',
    [`${ano}-11-15`]: 'Proclamação da República',
    [`${ano}-11-20`]: 'Dia da Consciência Negra',
    [`${ano}-12-25`]: 'Natal'
  };

  const municipais = {
    [`${ano}-11-28`]: 'Aniversário de Franca (SP)'
  };

  return { ...nacionais, ...municipais };
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

export const calculateDaysBetween = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const diffTime = Math.abs(e.getTime() - s.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

export const weekDayMap: Record<number, string> = {
  0: 'domingo',
  1: 'segunda',
  2: 'terca',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sabado',
};

// Retorna o índice do dia da semana no mês (ex: 1º domingo, 2º domingo)
// 1 a 5
export const getWeekOfMonth = (date: Date): number => {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfWeek = date.getDay(); // 0 (Domingo) a 6 (Sábado)
  
  let count = 0;
  // Itera do dia 1 até o dia atual, contando quantas vezes aquele dia da semana ocorreu
  for (let d = 1; d <= date.getDate(); d++) {
    const tempDate = new Date(date.getFullYear(), date.getMonth(), d);
    if (tempDate.getDay() === dayOfWeek) {
      count++;
    }
  }
  return count;
};

// Verifica se uma data é folga de escala baseada em uma data de referência
// Regra: Trabalha 3 domingos, folga 1 (Ciclo de 4 semanas)
// Se a data de referência for a ÚLTIMA folga, então +4 semanas é a próxima folga.
export const checkRotationDay = (checkDate: Date, referenceDateStr?: string): boolean => {
  if (!referenceDateStr) return false;
  
  // Só aplica para domingos
  if (checkDate.getDay() !== 0) return false;

  const refDate = new Date(referenceDateStr + 'T00:00:00');
  
  // Diferença em milissegundos
  const diffTime = checkDate.getTime() - refDate.getTime();
  
  // Diferença em dias
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  // Diferença em semanas
  const diffWeeks = Math.round(diffDays / 7);

  // Se a diferença de semanas for múltipla de 4, é folga de escala
  // (Ex: 0 semanas = mesma data, 4 semanas = próxima folga, 8 semanas = próxima...)
  return diffWeeks % 4 === 0;
};

export const promptForUser = (action: string): string | null => {
  return window.prompt(`Ação: ${action}\nPor favor, digite seu nome para registro de auditoria:`);
};

// Constrói a cadeia de aprovação subindo a hierarquia
export const buildApprovalChain = (startColabId: string, allCollaborators: Collaborator[]): string[] => {
  const chain: string[] = [];
  let currentId = startColabId;
  const visited = new Set<string>();

  while (true) {
    const currentColab = allCollaborators.find(c => c.id === currentId);
    if (!currentColab || !currentColab.leaderId) break;

    const leaderId = currentColab.leaderId;
    
    // Evita loops infinitos se houver referência circular
    if (visited.has(leaderId)) break;
    visited.add(leaderId);

    // Adiciona o líder à cadeia
    const leader = allCollaborators.find(c => c.id === leaderId);
    if (leader) {
      chain.push(leader.id);
      currentId = leader.id; // Sobe um nível
    } else {
      break;
    }
    
    // Limite de segurança (ex: 10 níveis)
    if (chain.length >= 10) break;
  }

  return chain;
};

// --- NOVOS HELPERS DE TEMPO ---

// Converte string "HH:MM" para horas decimais (ex: "01:30" -> 1.5)
export const timeToDecimal = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours + (minutes / 60);
};

// Converte horas decimais para string "HH:MM" (ex: 1.5 -> "01:30")
export const decimalToTime = (decimal: number): string => {
  const sign = decimal < 0 ? '-' : '';
  const absDecimal = Math.abs(decimal);
  
  const hours = Math.floor(absDecimal);
  const minutes = Math.round((absDecimal - hours) * 60);
  
  // Ajuste se arredondamento der 60 min
  if (minutes === 60) {
    return `${sign}${String(hours + 1).padStart(2, '0')}:00`;
  }
  
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
