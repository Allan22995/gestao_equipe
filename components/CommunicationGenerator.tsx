
import React, { useState, useEffect, useRef } from 'react';

// Declaração para o html2canvas carregado via CDN
declare global {
  interface Window {
    html2canvas: any;
  }
}

interface TemplateInput {
  id: string;
  label: string;
  type: 'text' | 'date' | 'time' | 'textarea';
  placeholder?: string;
  rows?: number;
  defaultValue?: string;
}

interface TemplateConfig {
  title: string;
  inputs: TemplateInput[];
  generate: (data: any) => { title: string; body: string; footer: string };
}

const TEMPLATES: Record<string, TemplateConfig> = {
  manutencao_inicio: {
    title: 'Janela de Manutenção de Sistemas',
    inputs: [
      { id: 'sistema', label: 'Nome do Sistema/Servidor', type: 'text', placeholder: 'Ex: Servidores Balboa (gemco)' },
      { id: 'data', label: 'Data', type: 'date' },
      { id: 'hora_inicio', label: 'Hora de Início', type: 'time' },
      { id: 'hora_fim', label: 'Hora de Fim', type: 'time' },
      { id: 'info', label: 'Informações Adicionais', type: 'textarea', placeholder: 'Poderá haver instabilidade...' }
    ],
    generate: (data) => ({
      title: 'MANUTENÇÃO',
      body: `Informamos que ocorrerá MANUTENÇÃO SISTÊMICA:\n\n` +
            `Sistema: ${data.sistema || '[...]'}\n` +
            `Data: ${data.data ? new Date(data.data + 'T00:00:00').toLocaleDateString('pt-BR') : '[...]'}\n` +
            `Horário: ${data.hora_inicio || '[...]'} às ${data.hora_fim || '[...]'}\n\n` +
            `${data.info || 'Poderá haver instabilidade.'}`,
      footer: 'Contamos com a colaboração de todos!!'
    })
  },
  manutencao_fim: {
    title: 'Fim de Manutenção',
    inputs: [],
    generate: () => ({
      title: 'MANUTENÇÃO FINALIZADA',
      body: 'Deploy Finalizado.\nOperação Liberada !!',
      footer: 'Obrigado a todos pela compreensão !!'
    })
  },
  instabilidade: {
    title: 'Instabilidade de Sistema',
    inputs: [
      { id: 'sistema', label: 'Nome do Sistema', type: 'text', placeholder: 'Ex: WMS' },
      { id: 'motivo', label: 'Motivo/Ação', type: 'textarea', placeholder: 'Estamos atuando para identificar a origem do problema...' }
    ],
    generate: (data) => ({
      title: 'INSTABILIDADE DE SISTEMA',
      body: `Identificamos instabilidade no sistema ${data.sistema || '[...]'}.\n\n` +
            `${data.motivo || 'Nossas equipes já estão atuando para normalizar a situação.'}`,
      footer: 'Manteremos todos atualizados.'
    })
  },
  normalizado: {
    title: 'Sistema Normalizado',
    inputs: [
      { id: 'sistema', label: 'Nome do Sistema', type: 'text', placeholder: 'Ex: Sandiego' }
    ],
    generate: (data) => ({
      title: 'SISTEMA NORMALIZADO',
      body: `O sistema ${data.sistema || '[...]'} foi normalizado.`,
      footer: 'Agradecemos e estamos a disposição!!'
    })
  },
  comunicado_geral: {
    title: 'Comunicado Geral',
    inputs: [
      { id: 'titulo', label: 'Título do Comunicado', type: 'text', placeholder: 'Ex: Acessos WMS' },
      { id: 'mensagem', label: 'Mensagem', type: 'textarea', placeholder: 'Digite sua mensagem aqui...' }
    ],
    generate: (data) => ({
      title: data.titulo || 'COMUNICADO',
      body: data.mensagem || '[...]',
      footer: 'Ficamos à disposição.'
    })
  },
  horario_atendimento: {
    title: 'Horário de Atendimento',
    inputs: [
      {
        id: 'corpo_mensagem',
        label: 'Corpo da Mensagem',
        type: 'textarea',
        rows: 10,
        defaultValue: 'Informo abaixo os dias e horários de atendimento do time Sistemas Logísticos.\n\n' +
                      'De Sábado 17:00 hs\n' +
                      'até\n' +
                      'Domingo às 22:00 hs\n\n' +
                      'O time atua por acionamento de chamado prioritário.\n\n' +
                      'O acionamento deverá ser feito marcando o @NOC via mensagem no Humand ou Gchat.'
      }
    ],
    generate: (data) => ({
      title: 'Horário de Atendimento',
      body: data.corpo_mensagem,
      footer: 'Ficamos à disposição.'
    })
  }
};

export const CommunicationGenerator: React.FC = () => {
  const [templateKey, setTemplateKey] = useState('manutencao_inicio');
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const previewRef = useRef<HTMLDivElement>(null);

  // Atualiza valores iniciais quando muda o template
  useEffect(() => {
    const config = TEMPLATES[templateKey];
    const initialValues: Record<string, string> = {};
    
    config.inputs.forEach(input => {
      if (input.defaultValue) {
        initialValues[input.id] = input.defaultValue;
      } else if (input.type === 'date') {
        initialValues[input.id] = new Date().toISOString().split('T')[0];
      } else {
        initialValues[input.id] = '';
      }
    });
    
    setFormValues(initialValues);
    setGeneratedImage(null);
  }, [templateKey]);

  const handleInputChange = (id: string, value: string) => {
    setFormValues(prev => ({ ...prev, [id]: value }));
  };

  const handleGenerateImage = async () => {
    if (!previewRef.current || !window.html2canvas) {
      alert('Erro: Biblioteca html2canvas não carregada.');
      return;
    }

    setIsGenerating(true);
    try {
      const canvas = await window.html2canvas(previewRef.current, {
        useCORS: true,
        scale: 2 // Melhor resolução
      });
      const imgData = canvas.toDataURL('image/png');
      setGeneratedImage(imgData);
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      alert('Ocorreu um erro ao gerar a imagem.');
    } finally {
      setIsGenerating(false);
    }
  };

  const currentTemplate = TEMPLATES[templateKey];
  const previewContent = currentTemplate.generate(formValues);

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <header className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#667eea]">Gerador de Comunicados</h1>
            <p className="text-gray-600 mt-2">Selecione, preencha, gere a imagem e envie para os grupos.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna de Controles */}
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">1. Escolha o tipo de comunicado:</label>
              <select 
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
              >
                <option value="manutencao_inicio">Início de Manutenção</option>
                <option value="manutencao_fim">Fim de Manutenção</option>
                <option value="instabilidade">Instabilidade de Sistema</option>
                <option value="normalizado">Sistema Normalizado</option>
                <option value="comunicado_geral">Comunicado Geral</option>
                <option value="horario_atendimento">Horário de Atendimento</option>
              </select>
            </div>

            <div className="space-y-4">
              {currentTemplate.inputs.length === 0 ? (
                <p className="text-gray-500 text-sm italic">Este modelo não precisa de informações adicionais.</p>
              ) : (
                currentTemplate.inputs.map(input => (
                  <div key={input.id}>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">{input.label}</label>
                    {input.type === 'textarea' ? (
                      <textarea
                        rows={input.rows || 3}
                        value={formValues[input.id] || ''}
                        onChange={(e) => handleInputChange(input.id, e.target.value)}
                        placeholder={input.placeholder}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
                      />
                    ) : (
                      <input
                        type={input.type}
                        value={formValues[input.id] || ''}
                        onChange={(e) => handleInputChange(input.id, e.target.value)}
                        placeholder={input.placeholder}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            <button 
              onClick={handleGenerateImage}
              disabled={isGenerating}
              className="mt-8 w-full bg-[#667eea] text-white font-bold py-3 px-4 rounded-lg hover:bg-[#5a6fd6] transition-transform active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Gerando...' : 'Gerar Imagem do Comunicado'}
            </button>

            {generatedImage && (
              <div className="mt-6 text-center animate-fadeIn">
                <p className="text-gray-500 text-sm mb-2">Imagem Gerada (Clique para baixar):</p>
                <img src={generatedImage} alt="Comunicado Gerado" className="w-full rounded-lg border-2 border-indigo-200 shadow-sm mb-3" />
                <a 
                  href={generatedImage} 
                  download="comunicado.png"
                  className="inline-block bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-emerald-700 transition shadow"
                >
                  Baixar Imagem
                </a>
              </div>
            )}
          </div>

          {/* Coluna de Preview */}
          <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-gray-800 mb-3">2. Pré-visualização</h2>
                {/* Container que será convertido em imagem */}
                <div 
                  ref={previewRef}
                  className="bg-[#0086FF] text-white p-8 rounded-lg w-full aspect-[16/9] flex flex-col justify-between shadow-xl relative overflow-hidden"
                  style={{ fontFamily: 'Arial, sans-serif' }}
                >
                    {/* Conteúdo do Template */}
                    <div className="relative z-10">
                         <div className="absolute top-0 right-0 text-right">
                            <p className="font-bold text-xl leading-none">sou</p>
                            <p className="font-bold text-3xl leading-none -mt-1 text-yellow-300">Magalu</p>
                         </div>
                         <p className="text-lg font-semibold text-center mt-2">Squad - Sistemas Logísticos</p>
                         <h3 className="text-2xl font-bold mt-6 uppercase text-center tracking-wide">
                            {previewContent.title}
                         </h3>
                    </div>
                    <div className="text-xl whitespace-pre-wrap text-center my-4 font-medium leading-relaxed px-4">
                        {previewContent.body}
                    </div>
                    <div className="text-center font-semibold opacity-90 border-t border-white/20 pt-4 mt-auto">
                        {previewContent.footer}
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                 <h3 className="text-sm font-bold text-gray-600 uppercase mb-3">3. Enviar para os grupos:</h3>
                 <div className="flex flex-col sm:flex-row gap-3">
                    <a href="https://app.humand.co/conversations/01K2MF1AJQN9X9CAFHG7T2DV4N" target="_blank" rel="noreferrer" className="flex-1 text-center bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-800 transition text-xs sm:text-sm">
                        Labs Resolve Fiscal
                    </a>
                    <a href="https://app.humand.co/conversations/01K2J8PYEMPJA9VCQMYVBXV76J" target="_blank" rel="noreferrer" className="flex-1 text-center bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-800 transition text-xs sm:text-sm">
                        TI CD Online CD300
                    </a>
                    <a href="https://app.humand.co/conversations/01JYP8FF0V01EEK0G000000000" target="_blank" rel="noreferrer" className="flex-1 text-center bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-800 transition text-xs sm:text-sm">
                        TI Cds Online Epoca
                    </a>
                 </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
