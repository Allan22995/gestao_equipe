

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

// Lógica de cálculo de folga de escala (3x1)
// Se a data alvo cair em um domingo que é (StartDate + N * 28 dias), então é folga.
// Ciclo: Folga (0), Trab (7), Trab (14), Trab (21), Folga (28)...
export const isRotationOffDay = (targetDateStr: string, startDateStr?: string): boolean => {
  if (!startDateStr) return false;
  
  // Normalizar datas para evitar problemas de fuso
  const target = new Date(targetDateStr + 'T00:00:00');
  const start = new Date(startDateStr + 'T00:00:00');

  // Precisa ser domingo
  if (target.getDay() !== 0) return false;

  // Se a data alvo é anterior ao início da escala, não consideramos (ou poderíamos projetar para trás, mas seguro ignorar)
  if (target.getTime() < start.getTime()) return false;

  const diffTime = Math.abs(target.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // O ciclo é de 4 semanas (28 dias): 1 Folga + 3 Trabalhados.
  // Se a diferença de dias for múltiplo de 28, cai exatamente no dia de folga do ciclo.
  return diffDays % 28 === 0;
};

export const promptForUser = (action: string): string | null => {
  return window.prompt(`Ação: ${action}\nPor favor, digite seu nome para registro de auditoria:`);
};