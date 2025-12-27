
import React, { useState, useMemo, useEffect } from 'react';
import { Collaborator, Skill, SystemSettings, UserProfile } from '../types';
import { MultiSelect } from './ui/MultiSelect';

interface SkillsMatrixProps {
  collaborators: Collaborator[];
  skills: Skill[];
  onUpdateCollaborator: (c: Collaborator) => Promise<void>;
  logAction: (action: string, entity: string, details: string, user: string) => void;
  settings: SystemSettings;
  currentUserProfile: UserProfile;
  canGrade: boolean;
  currentUserAllowedSectors: string[];
  availableBranches: string[];
  currentUserName: string;
}

// Level Definitions
const LEVELS = [
  { value: 0, label: 'Nenhum', color: 'bg-gray-100 border-gray-200 text-gray-300' },
  { value: 1, label: 'Aprendiz', color: 'bg-blue-50 border-blue-200 text-blue-500' },
  { value: 2, label: 'Praticante', color: 'bg-emerald-50 border-emerald-200 text-emerald-500' },
  { value: 3, label: 'Proficiente', color: 'bg-purple-50 border-purple-200 text-purple-600' },
  { value: 4, label: 'Referência', color: 'bg-amber-50 border-amber-200 text-amber-600' },
];

export const SkillsMatrix: React.FC<SkillsMatrixProps> = ({
  collaborators,
  skills,
  onUpdateCollaborator,
  logAction,
  settings,
  canGrade,
  currentUserAllowedSectors,
  availableBranches,
  currentUserName
}) => {
  // Filters
  const [filterBranches, setFilterBranches] = useState<string[]>([]);
  const [filterSectors, setFilterSectors] = useState<string[]>([]);
  const [filterName, setFilterName] = useState('');
  const [filterSkill, setFilterSkill] = useState('');

  // Initial Filter Setup
  useEffect(() => {
    if (availableBranches.length === 1) setFilterBranches([availableBranches[0]]);
    if (currentUserAllowedSectors.length === 1) setFilterSectors([currentUserAllowedSectors[0]]);
  }, [availableBranches, currentUserAllowedSectors]);

  // --- DATA FILTERING ---

  // 1. Filtered Collaborators
  const filteredCollaborators = useMemo(() => {
    return collaborators.filter(c => {
      if (c.active === false) return false;
      
      // Permissions Checks
      if (currentUserAllowedSectors.length > 0 && (!c.sector || !currentUserAllowedSectors.includes(c.sector))) return false;
      if (availableBranches.length > 0 && !availableBranches.includes(c.branch)) return false;

      // UI Filters
      if (filterBranches.length > 0 && !filterBranches.includes(c.branch)) return false;
      if (filterSectors.length > 0 && (!c.sector || !filterSectors.includes(c.sector))) return false;
      if (filterName && !c.name.toLowerCase().includes(filterName.toLowerCase())) return false;

      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [collaborators, currentUserAllowedSectors, availableBranches, filterBranches, filterSectors, filterName]);

  // 2. Filtered Skills (Based on branch/sector availability + search)
  const filteredSkills = useMemo(() => {
    return skills.filter(s => {
      // Check Name Filter
      if (filterSkill && !s.name.toLowerCase().includes(filterSkill.toLowerCase())) return false;

      // Check Relevance: Only show skills linked to the visible branches/sectors context
      // If the USER has restricted branches, only show skills for those branches
      if (availableBranches.length > 0) {
         const hasCommonBranch = s.branches.some(b => availableBranches.includes(b));
         if (!hasCommonBranch) return false;
      }

      // If Filter Branch is active, narrow down
      if (filterBranches.length > 0) {
         const hasCommonBranch = s.branches.some(b => filterBranches.includes(b));
         if (!hasCommonBranch) return false;
      }

      // If Filter Sector is active, narrow down
      if (filterSectors.length > 0) {
         const hasCommonSector = s.sectors.some(sec => filterSectors.includes(sec));
         if (!hasCommonSector) return false;
      }

      return true;
    }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [skills, filterSkill, availableBranches, filterBranches, filterSectors]);

  // Group Skills by Category
  const groupedSkills = useMemo(() => {
    const groups: Record<string, Skill[]> = {};
    filteredSkills.forEach(s => {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    });
    return groups;
  }, [filteredSkills]);

  // --- STATS ---
  const stats = useMemo(() => {
    let totalCompetencies = 0;
    let refCount = 0;
    const skillCounts: Record<string, number> = {};

    filteredCollaborators.forEach(c => {
      if (!c.skills) return;
      Object.entries(c.skills).forEach(([skillId, level]) => {
        if (level > 0) {
          totalCompetencies++;
          skillCounts[skillId] = (skillCounts[skillId] || 0) + 1;
        }
        if (level === 4) refCount++;
      });
    });

    let topSkillName = '-';
    let maxCount = 0;
    Object.entries(skillCounts).forEach(([id, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topSkillName = skills.find(s => s.id === id)?.name || id;
      }
    });

    return { totalCompetencies, refCount, topSkillName };
  }, [filteredCollaborators, skills]);

  // --- HANDLERS ---

  const handleLevelChange = async (colab: Collaborator, skillId: string) => {
    if (!canGrade) return;

    const currentLevel = colab.skills?.[skillId] || 0;
    const nextLevel = currentLevel >= 4 ? 0 : currentLevel + 1; // Cycle 0-4

    const updatedSkills = { ...(colab.skills || {}), [skillId]: nextLevel };
    
    // Optimistic Update handled by parent re-render from Firestore subscription usually, 
    // but here we just call the update function.
    await onUpdateCollaborator({ ...colab, skills: updatedSkills });
    
    // Log only if level changed significantly (optional, maybe too noisy)
    // logAction('update', 'skill', `Alterou skill ${skillId} de ${colab.name} para nível ${nextLevel}`, currentUserName);
  };

  // Helper for available sectors dropdown
  const availableSectorsOptions = useMemo(() => {
      // Simplification: Union of all sectors from filtered collaborators
      const s = new Set<string>();
      filteredCollaborators.forEach(c => c.sector && s.add(c.sector));
      return Array.from(s).sort();
  }, [filteredCollaborators]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
           <div className="relative z-10">
             <h3 className="text-indigo-100 font-bold uppercase text-xs tracking-wider">Total de Competências</h3>
             <p className="text-5xl font-bold mt-2">{stats.totalCompetencies}</p>
           </div>
           <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
             <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>
           </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 flex flex-col justify-center items-center text-center">
           <div className="mb-2 text-3xl">👑</div>
           <p className="text-3xl font-bold text-gray-800">{stats.refCount}</p>
           <p className="text-xs text-gray-500 uppercase font-bold mt-1">Nível Referência</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 flex flex-col justify-center items-center text-center">
           <div className="mb-2 text-3xl">🔥</div>
           <p className="text-xl font-bold text-gray-800 line-clamp-1">{stats.topSkillName}</p>
           <p className="text-xs text-gray-500 uppercase font-bold mt-1">Skill Mais Popular</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 z-20 relative">
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
               <input 
                 type="text" 
                 placeholder="🔍 Filtrar colaborador..." 
                 className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                 value={filterName}
                 onChange={e => setFilterName(e.target.value)}
               />
            </div>
            <div>
               <MultiSelect 
                 label="Filial"
                 options={availableBranches}
                 selected={filterBranches}
                 onChange={setFilterBranches}
                 placeholder={availableBranches.length === 1 ? availableBranches[0] : "Todas"}
                 disabled={availableBranches.length === 1}
               />
            </div>
            <div>
               <MultiSelect 
                 label="Setor"
                 options={availableSectorsOptions}
                 selected={filterSectors}
                 onChange={setFilterSectors}
                 placeholder="Todos"
               />
            </div>
            <div>
               <input 
                 type="text" 
                 placeholder="🔍 Filtrar skill..." 
                 className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none mt-5 md:mt-0 h-[38px]" // Align with multiselect
                 value={filterSkill}
                 onChange={e => setFilterSkill(e.target.value)}
               />
            </div>
         </div>
         
         {/* Level Legend */}
         <div className="flex flex-wrap gap-4 mt-6 justify-end border-t border-gray-100 pt-4">
            {LEVELS.map(l => (
               <div key={l.value} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full border ${l.color.split(' ')[0]} ${l.color.split(' ')[1]}`}></div>
                  <span className="text-xs text-gray-500 font-medium">{l.label}</span>
               </div>
            ))}
         </div>
      </div>

      {/* MATRIX */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
         <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse">
               <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                     <th className="p-3 text-left font-bold min-w-[250px] sticky left-0 bg-gray-50 z-10 border-r border-gray-200 shadow-sm">
                        Colaborador
                     </th>
                     {Object.keys(groupedSkills).map(cat => (
                        <th key={cat} colSpan={groupedSkills[cat].length} className="p-2 text-center border-l border-gray-200 font-bold bg-gray-100 text-gray-700">
                           {cat}
                        </th>
                     ))}
                  </tr>
                  <tr className="bg-white border-b border-gray-200 text-[10px] text-gray-500 font-medium">
                     <th className="p-2 sticky left-0 bg-white z-10 border-r border-gray-200"></th>
                     {Object.keys(groupedSkills).map(cat => (
                        groupedSkills[cat].map(skill => (
                           <th key={skill.id} className="p-2 text-center border-l border-gray-100 min-w-[100px] max-w-[120px] h-32 align-bottom pb-4 relative group hover:bg-gray-50 transition-colors">
                              <div className="writing-vertical transform rotate-180 w-full h-full flex items-center justify-center">
                                 <span className="truncate block w-full">{skill.name}</span>
                              </div>
                              {skill.description && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-white text-[9px] p-2 rounded shadow-lg z-20 w-40 normal-case font-normal">
                                   {skill.description}
                                </div>
                              )}
                           </th>
                        ))
                     ))}
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {filteredCollaborators.map(colab => (
                     <tr key={colab.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3 sticky left-0 bg-white z-10 border-r border-gray-200 shadow-sm group-hover:bg-gray-50">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-200">
                                 {colab.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                 <p className="text-sm font-bold text-gray-800 truncate">{colab.name}</p>
                                 <p className="text-[10px] text-gray-500 truncate">{colab.role}</p>
                              </div>
                           </div>
                        </td>
                        {Object.keys(groupedSkills).map(cat => (
                           groupedSkills[cat].map(skill => {
                              const level = colab.skills?.[skill.id] || 0;
                              const levelDef = LEVELS.find(l => l.value === level) || LEVELS[0];
                              
                              return (
                                 <td key={skill.id} className="p-2 text-center border-l border-gray-100">
                                    <button
                                       onClick={() => handleLevelChange(colab, skill.id)}
                                       disabled={!canGrade}
                                       className={`
                                          w-6 h-6 rounded-full border flex items-center justify-center mx-auto transition-all transform active:scale-95
                                          ${levelDef.color}
                                          ${level === 0 ? 'bg-white border-dashed' : 'shadow-sm'}
                                          ${!canGrade ? 'cursor-default opacity-80' : 'cursor-pointer hover:shadow-md hover:ring-2 hover:ring-indigo-100'}
                                       `}
                                       title={`${skill.name}: ${levelDef.label}`}
                                    >
                                       {level === 4 && <span className="text-[10px]">👑</span>}
                                       {level > 0 && level < 4 && <span className="w-2 h-2 rounded-full bg-current opacity-60"></span>}
                                    </button>
                                 </td>
                              );
                           })
                        ))}
                     </tr>
                  ))}
                  {filteredCollaborators.length === 0 && (
                     <tr><td colSpan={100} className="p-8 text-center text-gray-400 italic">Nenhum colaborador encontrado com os filtros atuais.</td></tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};
