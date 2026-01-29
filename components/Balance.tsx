            <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
            {(filteredLogItems as any[]).map((item: any) => {
                const colab = collaborators.find(c => c.id === item.collaboratorId);
                let text = '';
                let borderClass = 'border-gray-400';
                let bgClass = 'bg-gray-50';

                if (item.logType === 'event') {
                    const eventLabel = item.typeLabel || item.type;
                    const status = item.status || 'aprovado';
                    
                    if (item.daysGained > 0) {
                        text = `registrou "${eventLabel}" (+${item.daysGained} dias).`;
                        borderClass = 'border-emerald-400';
                        bgClass = 'bg-emerald-50/50';
                    } else if (item.daysUsed > 0) {
                        text = `registrou "${eventLabel}" (-${item.daysUsed} dias).`;
                        borderClass = 'border-rose-400';
                        bgClass = 'bg-rose-50/50';
                    } else {
                        if (item.type === 'ferias' || eventLabel.toLowerCase().includes('férias')) {
                            text = `entrou de férias.`;
                        } else {
                            text = `registrou evento: ${eventLabel}.`;
                        }
                        borderClass = 'border-blue-400';
                        bgClass = 'bg-blue-50/50';
                    }

                    if (status !== 'aprovado') {
                        text += ` (Status: ${status})`;
                        borderClass = 'border-gray-300 border-dashed';
                        bgClass = 'bg-gray-50 opacity-70';
                    }

                } else {
                    text = `Ajuste Manual (${item.amount > 0 ? '+' : ''}${item.amount}): ${item.reason}`;
                    borderClass = 'border-purple-400';
                    bgClass = 'bg-purple-50/50';
                }

                return (
                <div key={item.id} className={`text-sm p-3 border-l-4 ${borderClass} ${bgClass} rounded-r-lg transition-all hover:translate-x-1`}>
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-gray-800">{colab?.name || 'Desconhecido'}</span>
                        <div className="text-[10px] text-gray-500">{new Date(item.date).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <span className="text-gray-600 block leading-tight">{text}</span>
                    {item.createdBy && <div className="text-[9px] text-gray-400 mt-1 text-right">Por: {item.createdBy}</div>}
                </div>
                );
            })
            }
            {filteredLogItems.length === 0 && <p className="text-center text-gray-400 py-10 italic">Nenhum registro encontrado.</p>}
            </div>