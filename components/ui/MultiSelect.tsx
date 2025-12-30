
import React, { useState, useRef, useEffect } from 'react';

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ 
  label, 
  options, 
  selected, 
  onChange, 
  placeholder = 'Selecione...',
  disabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === filteredOptions.length) {
      onChange([]);
    } else {
      onChange(filteredOptions);
    }
  };

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getButtonLabel = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) return selected[0];
    if (selected.length === options.length && options.length > 0) return 'Todos Selecionados';
    return `${selected.length} selecionados`;
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full border rounded-md p-2 text-sm bg-white text-left flex justify-between items-center focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all ${
          disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-300 text-gray-700'
        } ${isOpen ? 'ring-2 ring-indigo-500 border-transparent' : ''}`}
      >
        <span className="truncate block mr-2 flex-1">{getButtonLabel()}</span>
        <svg 
          className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-2xl max-h-[40vh] overflow-hidden animate-fadeIn flex flex-col">
          <div className="p-2 border-b border-gray-100 bg-gray-50 shrink-0">
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="w-full border border-gray-300 rounded px-2 py-2 text-sm outline-none focus:border-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          
          <div className="overflow-y-auto flex-1 p-1">
            {filteredOptions.length > 0 && (
                <div 
                className="flex items-center gap-2 p-2 hover:bg-indigo-50 cursor-pointer rounded text-xs font-bold text-indigo-700 border-b border-gray-100 mb-1"
                onClick={handleSelectAll}
                >
                <input 
                    type="checkbox" 
                    checked={selected.length > 0 && selected.length === filteredOptions.length}
                    readOnly
                    className="rounded text-indigo-600 focus:ring-indigo-500 pointer-events-none"
                />
                Selecionar Todos
                </div>
            )}

            {filteredOptions.map(option => (
              <div 
                key={option} 
                className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer rounded text-sm text-gray-700"
                onClick={() => toggleOption(option)}
              >
                <input 
                  type="checkbox" 
                  checked={selected.includes(option)} 
                  readOnly 
                  className="rounded text-indigo-600 focus:ring-indigo-500 pointer-events-none"
                />
                <span className="truncate">{option}</span>
              </div>
            ))}
            
            {filteredOptions.length === 0 && (
              <div className="p-3 text-center text-xs text-gray-400 italic">
                Nenhum item encontrado.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
