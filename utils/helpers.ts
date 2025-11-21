
export const generateUUID = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
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

export const promptForUser = (action: string): string | null => {
  return window.prompt(`Ação: ${action}\nPor favor, digite seu nome para registro de auditoria:`);
};
