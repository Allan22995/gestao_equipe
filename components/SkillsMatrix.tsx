
import React, { useState, useMemo, useEffect } from 'react';
import { Collaborator, SystemSettings, SkillLevel, UserProfile } from '../types';
import { MultiSelect } from './ui/MultiSelect';

interface SkillsMatrixProps {
  collaborators: Collaborator[];
  settings: SystemSettings;
  onUpdateCollaborator: (id: string, data: Partial<Collaborator>) => Promise<void>;
  showToast: (msg: string, isError?: boolean) => void;
  currentUserProfile: UserProfile;
  currentUserAllowedSectors: string[];
  canManageSkills: boolean;
  availableBranches: string[];
}

const LEVEL_ORDER: SkillLevel[] = ['Aprendiz', 'Praticante', 'Proficiente', 'Referência'];

const SKILL_CONFIG: Record<string, { icon: string, label: string, color: string, legendColor: string }> = {
    'Aprendiz': { icon: '🌱', label: 'Aprendiz', color: 'text-blue-500', legendColor: 'bg-blue-500' },
    'Praticante': { icon: '🛠️', label: 'Praticante', color: 'text-emerald-500', legendColor: 'bg-emerald-500' },
    'Proficiente': { icon: '🚀', label: 'Proficiente', color: 'text-purple-500', legendColor: 'bg-purple-500' },
    'Referência': { icon: '👑', label: 'Referência', color: 'text-amber-500', legendColor: 'bg-amber-400' }
};

export const SkillsMatrix: React.FC<SkillsMatrixProps> = ({
  collaborators,
  settings,
  onUpdateCollaborator,
  showToast,
  currentUserAllowedSectors,
  canManageSkills,
  availableBranches
}) => {
  const [filterName, setFilterName] = useState('');
  const [filterSectors, setFilterSectors] = useState<string[]>([]);
  const [filterBranches, setFilterBranches] = useState<string[]>([]);

  // Init branch filter
  useEffect(() => {
      if (availableBranches.length > 0) {
          setFilterBranches(availableBranches);
      }
  }, [availableBranches]);

  // Force Sector Filter
  useEffect(() => {
    if (currentUserAllowedSectors.length === 1) {
      setFilterSectors([currentUserAllowedSectors[0]]);
    }
  }, [currentUserAllowedSectors]);

  // --- FILTERING ---
  const filteredCollaborators = useMemo(() => {
      return collaborators.filter(c => {
          if (c.active === false) return false;
          if (availableBranches.length > 0 && !availableBranches.includes(c.branch)) return false;
          if (currentUserAllowedSectors.length > 0) {
              if (!c.sector || !currentUserAllowedSectors.includes(c.sector)) return false;
          }

          const matchesName = filterName ? c.name.toLowerCase().includes(filterName.toLowerCase()) : true;
          const matchesBranch = filterBranches.length > 0 ? filterBranches.includes(c.branch) : true;
          const matchesSector = filterSectors.length > 0 ? (c.sector && filterSectors.includes(c.sector)) : true;

          return matchesName && matchesBranch && matchesSector;
      }).sort((a, b) => a.name.localeCompare(b.name));
  }, [collaborators, filterName, filterBranches, filterSectors, currentUserAllowedSectors, availableBranches]);

  const filteredSkills = useMemo(() => {
      const allSkills = settings.skills || [];
      if (filterBranches.length === 0) return [];
      return allSkills.filter(skill => {
          if (!skill.branches || skill.branches.length === 0) return false;
          return skill.branches.some(b => filterBranches.includes(b));
      }).sort((a, b) => a.name.localeCompare(b.name));
  }, [settings.skills, filterBranches]);

  // --- ACTIONS ---
  const handleCycleLevel = async (colabId: string, skillId: string, currentLevel?: string) => {
      if (!canManageSkills) return;

      const colab = collaborators.find(c => c.id === colabId);
      if (!colab) return;

      let nextLevel: SkillLevel | undefined;
      
      if (!currentLevel) {
          nextLevel = LEVEL_ORDER[0]; // First level
      } else {
          const idx = LEVEL_ORDER.indexOf(currentLevel as SkillLevel);
          if (idx >= 0 && idx < LEVEL_ORDER.length - 1) {
              nextLevel = LEVEL_ORDER[idx + 1];
          } else {
              nextLevel = undefined; // Cycle back to empty
          }
      }

      const currentSkills = colab.skills || {};
      const newSkills = { ...currentSkills };
      
      if (nextLevel) {
          newSkills[skillId] = nextLevel;
      } else {
          delete newSkills[skillId];
      }

      // Optimistic update handled by React state if props update fast enough, 
      // but showing toast/loading might be too noisy. We just update.
      await onUpdateCollaborator(colabId, { skills: newSkills });
  };

  const getInitials = (name: string) => {
      return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  const availableSectors = useMemo(() => {
      const sectorsSet = new Set<string>(settings.sectors || []);
      if (settings.branchSectors) {
          filterBranches.forEach(b => {
              settings.branchSectors?.[b]?.forEach(s => sectorsSet.add(s));
          });
      }
      let result = Array.from(sectorsSet);
      if (currentUserAllowedSectors.length > 0) {
          result = result.filter(s => currentUserAllowedSectors.includes(s));
      }
      return result.sort();
  }, [settings, filterBranches, currentUserAllowedSectors]);

  return (
    <div className="space-y-6 animate-fadeIn h-full flex flex-col">
       {/* HEADER & FILTERS */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 shrink-0">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
               {/* Search Bar */}
               <div className="relative w-full md:w-96">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                   </div>
                   <input 
                       type="text" 
                       placeholder="Filtrar colaborador..." 
                       className="w-full border border-gray-300 rounded-full py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow shadow-sm"
                       value={filterName}
                       onChange={e => setFilterName(e.target.value)}
                   />
               </div>

               {/* Legend */}
               <div className="flex flex-wrap gap-4 items-center">
                   {Object.values(SKILL_CONFIG).map((conf) => (
                       <div key={conf.label} className="flex items-center gap-2">
                           <span className={`w-2.5 h-2.5 rounded-full ${conf.legendColor}`}></span>
                           <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{conf.label}</span>
                       </div>
                   ))}
               </div>
           </div>

           {/* Secondary Filters */}
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
               <MultiSelect 
                   label="Filiais"
                   options={availableBranches}
                   selected={filterBranches}
                   onChange={setFilterBranches}
                   placeholder="Selecione..."
                   disabled={availableBranches.length === 1}
               />
               <MultiSelect 
                   label="Setor"
                   options={availableSectors}
                   selected={filterSectors}
                   onChange={setFilterSectors}
                   placeholder="Todos"
                   disabled={currentUserAllowedSectors.length === 1}
               />
           </div>
       </div>

       {/* MATRIX GRID CONTAINER */}
       <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex-1 flex flex-col overflow-hidden relative">
           
           <div className="flex-1 overflow-auto custom-scrollbar">
               <table className="w-full text-sm border-separate border-spacing-0">
                   <thead className="bg-gray-50 z-20">
                       <tr>
                           {/* Sticky Collaborator Column Header */}
                           <th className="sticky top-0 left-0 z-30 bg-gray-50 p-4 text-left font-bold text-gray-400 uppercase text-xs tracking-wider border-b border-r border-gray-200 w-[280px] h-[100px] align-bottom">
                               COLABORADOR
                           </th>
                           
                           {/* Skill Headers */}
                           {filteredSkills.map(skill => (
                               <th key={skill.id} className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 h-[100px] min-w-[50px] align-bottom pb-2 group relative">
                                   <div className="flex flex-col items-center justify-end h-full">
                                       <div className="writing-mode-vertical rotate-180 text-gray-600 font-semibold text-xs whitespace-nowrap tracking-wide py-2">
                                           {skill.name}
                                       </div>
                                   </div>
                                   {skill.description && (
                                       <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-800 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center font-normal">
                                           {skill.description}
                                           <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                                       </div>
                                   )}
                               </th>
                           ))}
                           
                           {filteredSkills.length === 0 && (
                               <th className="p-8 text-gray-400 font-normal italic w-full border-b border-gray-200">
                                   Nenhuma skill configurada.
                               </th>
                           )}
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                       {filteredCollaborators.map(colab => (
                           <tr key={colab.id} className="group hover:bg-gray-50 transition-colors">
                               {/* Collaborator Row Header (Sticky) */}
                               <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 p-3 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                   <div className="flex items-center gap-3">
                                       <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm shrink-0">
                                           {getInitials(colab.name)}
                                       </div>
                                       <div className="min-w-0">
                                           <div className="font-bold text-gray-800 text-sm truncate">{colab.name}</div>
                                           <div className="text-[10px] text-gray-500 uppercase tracking-wide truncate">{colab.role}</div>
                                       </div>
                                   </div>
                               </td>

                               {/* Skill Cells */}
                               {filteredSkills.map(skill => {
                                   const currentLevel = colab.skills?.[skill.id] as string | undefined;
                                   const config = currentLevel ? SKILL_CONFIG[currentLevel] : null;
                                   
                                   return (
                                       <td key={skill.id} className="p-2 border-r border-gray-50 last:border-r-0 text-center">
                                           <div className="flex justify-center items-center h-full">
                                               <button
                                                   onClick={() => handleCycleLevel(colab.id, skill.id, currentLevel)}
                                                   disabled={!canManageSkills}
                                                   className={`
                                                       w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all duration-200
                                                       ${config ? 'bg-white shadow-sm scale-100' : 'bg-gray-100 shadow-inner scale-90'}
                                                       ${canManageSkills ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-default'}
                                                   `}
                                                   title={config ? config.label : 'Não avaliado'}
                                               >
                                                   {config ? config.icon : <div className="w-2.5 h-2.5 rounded-full bg-gray-300 shadow-inner"></div>}
                                               </button>
                                           </div>
                                       </td>
                                   );
                               })}
                               {filteredSkills.length === 0 && <td></td>}
                           </tr>
                       ))}
                       {filteredCollaborators.length === 0 && (
                           <tr>
                               <td colSpan={filteredSkills.length + 1} className="p-12 text-center text-gray-400 italic">
                                   Nenhum colaborador encontrado com os filtros atuais.
                               </td>
                           </tr>
                       )}
                   </tbody>
               </table>
           </div>
       </div>
       
       <style>{`
         .writing-mode-vertical {
           writing-mode: vertical-rl;
         }
       `}</style>
    </div>
  );
};
