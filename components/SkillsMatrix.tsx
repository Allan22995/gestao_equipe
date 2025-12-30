
import React, { useState, useMemo, useEffect } from 'react';
import { Collaborator, SkillDefinition, SystemSettings, SkillLevel, UserProfile } from '../types';
import { MultiSelect } from './ui/MultiSelect';

interface SkillsMatrixProps {
  collaborators: Collaborator[];
  settings: SystemSettings;
  onUpdateCollaborator: (id: string, data: Partial<Collaborator>) => Promise<void>;
  showToast: (msg: string, isError?: boolean) => void;
  currentUserProfile: UserProfile;
  currentUserAllowedSectors: string[];
  canManageSkills: boolean; // Permission to edit skill levels
  availableBranches: string[];
}

const SKILL_LEVELS: { id: SkillLevel, label: string, color: string }[] = [
    { id: 'Aprendiz', label: 'Aprendiz', color: 'bg-gray-100 text-gray-600 border-gray-200' },
    { id: 'Praticante', label: 'Praticante', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'Proficiente', label: 'Proficiente', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { id: 'Referência', label: 'Referência', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
];

export const SkillsMatrix: React.FC<SkillsMatrixProps> = ({
  collaborators,
  settings,
  onUpdateCollaborator,
  showToast,
  currentUserProfile,
  currentUserAllowedSectors,
  canManageSkills,
  availableBranches
}) => {
  const [filterName, setFilterName] = useState('');
  const [filterSectors, setFilterSectors] = useState<string[]>([]);
  const [filterBranches, setFilterBranches] = useState<string[]>([]);

  // Init branch filter with available branches
  useEffect(() => {
      if (availableBranches.length > 0) {
          setFilterBranches(availableBranches);
      }
  }, [availableBranches]);

  // Force Sector Filter if Restricted
  useEffect(() => {
    if (currentUserAllowedSectors.length === 1) {
      setFilterSectors([currentUserAllowedSectors[0]]);
    }
  }, [currentUserAllowedSectors]);

  // --- 1. FILTER COLLABORATORS ---
  const filteredCollaborators = useMemo(() => {
      return collaborators.filter(c => {
          if (c.active === false) return false;

          // Branch Restriction
          if (availableBranches.length > 0 && !availableBranches.includes(c.branch)) return false;

          // Sector Restriction
          if (currentUserAllowedSectors.length > 0) {
              if (!c.sector || !currentUserAllowedSectors.includes(c.sector)) return false;
          }

          // UI Filters
          const matchesName = filterName ? c.name.toLowerCase().includes(filterName.toLowerCase()) : true;
          const matchesBranch = filterBranches.length > 0 ? filterBranches.includes(c.branch) : true;
          const matchesSector = filterSectors.length > 0 ? (c.sector && filterSectors.includes(c.sector)) : true;

          return matchesName && matchesBranch && matchesSector;
      }).sort((a, b) => a.name.localeCompare(b.name));
  }, [collaborators, filterName, filterBranches, filterSectors, currentUserAllowedSectors, availableBranches]);

  // --- 2. FILTER SKILLS (By Branch Context) ---
  const filteredSkills = useMemo(() => {
      const allSkills = settings.skills || [];
      if (filterBranches.length === 0) return []; // If no branch selected/available, show nothing? Or show all global? Assuming filterBranches is populated by default.

      // Show skills that are linked to ANY of the currently filtered branches
      return allSkills.filter(skill => {
          // If skill has no branches defined, maybe show it? Let's assume strict linkage.
          if (!skill.branches || skill.branches.length === 0) return false;
          
          return skill.branches.some(b => filterBranches.includes(b));
      }).sort((a, b) => a.name.localeCompare(b.name));
  }, [settings.skills, filterBranches]);

  const handleLevelChange = async (colabId: string, skillId: string, level: string) => {
      if (!canManageSkills) return;

      const colab = collaborators.find(c => c.id === colabId);
      if (!colab) return;

      const currentSkills = colab.skills || {};
      
      // If empty level selected, remove the key
      if (!level) {
          const newSkills = { ...currentSkills };
          delete newSkills[skillId];
          await onUpdateCollaborator(colabId, { skills: newSkills });
      } else {
          const newSkills = { ...currentSkills, [skillId]: level as SkillLevel };
          await onUpdateCollaborator(colabId, { skills: newSkills });
      }
  };

  // --- Available Sectors for Filter ---
  const availableSectors = useMemo(() => {
      // (Simplified logic from Dashboard)
      const sectorsSet = new Set<string>(settings.sectors || []);
      // Add specific
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
    <div className="space-y-6 animate-fadeIn">
       {/* FILTROS */}
       <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div>
                   <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Colaborador</label>
                   <input 
                       type="text" 
                       placeholder="Buscar por nome..." 
                       className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                       value={filterName}
                       onChange={e => setFilterName(e.target.value)}
                   />
               </div>
               <div>
                   <MultiSelect 
                       label="Filiais (Contexto)"
                       options={availableBranches}
                       selected={filterBranches}
                       onChange={setFilterBranches}
                       placeholder="Selecione..."
                       disabled={availableBranches.length === 1}
                   />
               </div>
               <div>
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
       </div>

       {/* MATRIX GRID */}
       <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
           <div className="overflow-x-auto custom-scrollbar flex-1">
               <table className="w-full text-sm border-collapse min-w-[800px]">
                   <thead>
                       <tr className="bg-gray-50 border-b border-gray-200">
                           <th className="p-4 text-left font-bold text-gray-700 w-64 sticky left-0 bg-gray-50 z-10 shadow-sm">
                               Colaborador
                           </th>
                           {filteredSkills.map(skill => (
                               <th key={skill.id} className="p-3 text-center min-w-[140px] border-l border-gray-100 group relative">
                                   <div className="flex flex-col items-center">
                                       <span className="font-bold text-gray-800">{skill.name}</span>
                                       {skill.description && (
                                           <span className="text-[10px] text-gray-400 font-normal truncate max-w-[120px] group-hover:whitespace-normal group-hover:absolute group-hover:bg-black/80 group-hover:text-white group-hover:p-2 group-hover:rounded group-hover:z-20 group-hover:top-full">
                                               {skill.description}
                                           </span>
                                       )}
                                   </div>
                               </th>
                           ))}
                           {filteredSkills.length === 0 && (
                               <th className="p-4 text-center text-gray-400 font-normal italic w-full">
                                   Nenhuma skill configurada para as filiais selecionadas.
                               </th>
                           )}
                       </tr>
                   </thead>
                   <tbody>
                       {filteredCollaborators.map(colab => (
                           <tr key={colab.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                               <td className="p-4 sticky left-0 bg-white hover:bg-gray-50 z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                   <div>
                                       <div className="font-bold text-gray-800">{colab.name}</div>
                                       <div className="text-xs text-gray-500">{colab.role}</div>
                                       <div className="text-[10px] text-gray-400">{colab.branch}</div>
                                   </div>
                               </td>
                               {filteredSkills.map(skill => {
                                   const currentLevel = colab.skills?.[skill.id] as SkillLevel | undefined;
                                   const levelConfig = SKILL_LEVELS.find(l => l.id === currentLevel);
                                   
                                   return (
                                       <td key={skill.id} className="p-2 border-l border-gray-100 text-center">
                                           {canManageSkills ? (
                                               <select 
                                                   value={currentLevel || ''} 
                                                   onChange={(e) => handleLevelChange(colab.id, skill.id, e.target.value)}
                                                   className={`w-full text-xs border-0 rounded-lg py-1.5 px-2 cursor-pointer font-medium outline-none focus:ring-2 focus:ring-indigo-100 transition-colors appearance-none text-center ${levelConfig ? levelConfig.color : 'text-gray-400 bg-gray-50'}`}
                                               >
                                                   <option value="">-</option>
                                                   {SKILL_LEVELS.map(lvl => (
                                                       <option key={lvl.id} value={lvl.id}>{lvl.label}</option>
                                                   ))}
                                               </select>
                                           ) : (
                                               levelConfig ? (
                                                   <span className={`px-2 py-1 rounded text-xs font-bold border ${levelConfig.color}`}>
                                                       {levelConfig.label}
                                                   </span>
                                               ) : <span className="text-gray-300">-</span>
                                           )}
                                       </td>
                                   );
                               })}
                               {filteredSkills.length === 0 && <td className="p-4"></td>}
                           </tr>
                       ))}
                       {filteredCollaborators.length === 0 && (
                           <tr>
                               <td colSpan={filteredSkills.length + 1} className="p-8 text-center text-gray-400 italic">
                                   Nenhum colaborador encontrado com os filtros atuais.
                               </td>
                           </tr>
                       )}
                   </tbody>
               </table>
           </div>
       </div>
    </div>
  );
};
