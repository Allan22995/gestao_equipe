
import React, { useState, useMemo, useEffect } from 'react';
import { Collaborator, Skill, SystemSettings } from '../types';
import { generateUUID } from '../utils/helpers';
import { MultiSelect } from './ui/MultiSelect';

interface SkillsMatrixProps {
  collaborators: Collaborator[];
  skills: Skill[];
  onAddSkill: (s: Skill) => void;
  onUpdateSkill: (s: Skill) => void;
  onDeleteSkill: (id: string) => void;
  onUpdateCollaborator: (c: Collaborator) => void;
  showToast: (msg: string, isError?: boolean) => void;
  logAction: (action: string, entity: string, details: string, user: string) => void;
  settings: SystemSettings;
  availableBranches: string[];
  canManage: boolean;
  userEmail: string;
  currentUserAllowedSectors: string[];
}

const LEVEL_CONFIG = [
  { value: 0, label: 'N/A', color: 'bg-gray-100 text-gray-400', fullColor: '#f3f4f6' },
  { value: 1, label: 'Básico', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', fullColor: '#fef3c7' },
  { value: 2, label: 'Intermediário', color: 'bg-blue-100 text-blue-800 border-blue-200', fullColor: '#dbeafe' },
  { value: 3, label: 'Avançado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', fullColor: '#d1fae5' },
  { value: 4, label: 'Especialista', color: 'bg-purple-100 text-purple-800 border-purple-200', fullColor: '#f3e8ff' },
];

export const SkillsMatrix: React.FC<SkillsMatrixProps> = ({
  collaborators, skills, onAddSkill, onUpdateSkill, onDeleteSkill, onUpdateCollaborator,
  showToast, logAction, settings, availableBranches, canManage, userEmail, currentUserAllowedSectors
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'manage'>('matrix');
  const [selectedBranch, setSelectedBranch] = useState(availableBranches.length === 1 ? availableBranches[0] : '');
  
  // Matrix Filters
  const [filterRole, setFilterRole] = useState('');
  const [filterName, setFilterName] = useState('');
  
  // Manage Skills State
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  useEffect(() => {
      if (availableBranches.length === 1) {
          setSelectedBranch(availableBranches[0]);
      }
  }, [availableBranches]);

  // --- FILTERS & DATA PREP ---

  const activeCollaborators = useMemo(() => collaborators.filter(c => c.active !== false), [collaborators]);

  const filteredSkills = useMemo(() => {
      if (!selectedBranch) return [];
      return skills.filter(s => s.branch === selectedBranch).sort((a,b) => a.name.localeCompare(b.name));
  }, [skills, selectedBranch]);

  const filteredCollaborators = useMemo(() => {
      if (!selectedBranch) return [];
      return activeCollaborators.filter(c => {
          if (c.branch !== selectedBranch) return false;
          if (filterRole && c.role !== filterRole) return false;
          if (filterName && !c.name.toLowerCase().includes(filterName.toLowerCase())) return false;
          if (currentUserAllowedSectors.length > 0 && c.sector && !currentUserAllowedSectors.includes(c.sector)) return false;
          return true;
      }).sort((a,b) => a.name.localeCompare(b.name));
  }, [activeCollaborators, selectedBranch, filterRole, filterName, currentUserAllowedSectors]);

  const availableRoles = useMemo(() => {
      if (!selectedBranch) return [];
      const roles = new Set(activeCollaborators.filter(c => c.branch === selectedBranch).map(c => c.role));
      return Array.from(roles).sort();
  }, [activeCollaborators, selectedBranch]);

  // --- HANDLERS ---

  const handleSaveSkill = (e: React.FormEvent) => {
      e.preventDefault();
      if (!canManage) return;
      if (!selectedBranch) { showToast('Selecione uma filial primeiro.', true); return; }
      if (!newSkillName.trim()) { showToast('Nome da skill obrigatório.', true); return; }

      if (editingSkillId) {
          onUpdateSkill({
              id: editingSkillId,
              name: newSkillName,
              description: newSkillDesc,
              branch: selectedBranch,
              createdAt: new Date().toISOString() // Keep original date ideally, but this works for simple update
          } as Skill);
          showToast('Skill atualizada.');
      } else {
          const newSkill: Skill = {
              id: generateUUID(),
              name: newSkillName,
              description: newSkillDesc,
              branch: selectedBranch,
              createdAt: new Date().toISOString()
          };
          onAddSkill(newSkill);
          logAction('create', 'skill', `Criou skill "${newSkillName}" na filial ${selectedBranch}`, userEmail);
          showToast('Skill criada com sucesso.');
      }
      setNewSkillName('');
      setNewSkillDesc('');
      setEditingSkillId(null);
  };

  const handleEditSkill = (skill: Skill) => {
      setEditingSkillId(skill.id);
      setNewSkillName(skill.name);
      setNewSkillDesc(skill.description || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSkill = (skillId: string) => {
      if (!canManage) return;
      // Check usage
      const inUseCount = activeCollaborators.filter(c => c.skills && c.skills[skillId] && c.skills[skillId] > 0).length;
      
      if (inUseCount > 0) {
          if (!window.confirm(`Esta skill está atribuída a ${inUseCount} colaboradores. Tem certeza que deseja excluir?`)) return;
      } else {
          if (!window.confirm('Excluir skill?')) return;
      }

      onDeleteSkill(skillId);
      logAction('delete', 'skill', `Excluiu skill ID ${skillId}`, userEmail);
      showToast('Skill removida.');
  };

  const handleLevelChange = (colab: Collaborator, skillId: string) => {
      if (!canManage) return;
      
      const currentLevel = colab.skills?.[skillId] || 0;
      const nextLevel = currentLevel >= 4 ? 0 : currentLevel + 1; // Cycle: 0 -> 1 -> 2 -> 3 -> 4 -> 0

      const updatedSkills = { ...(colab.skills || {}), [skillId]: nextLevel };
      if (nextLevel === 0) delete updatedSkills[skillId]; // Clean up if 0

      onUpdateCollaborator({ ...colab, skills: updatedSkills });
      // Log action is too verbose for every click, maybe throttle or omit
  };

  const exportToCSV = () => {
      if (!selectedBranch) return;
      
      const header = ['ID', 'Nome', 'Cargo', ...filteredSkills.map(s => s.name)];
      const rows = filteredCollaborators.map(c => {
          const row = [c.colabId, c.name, c.role];
          filteredSkills.forEach(s => {
              const level = c.skills?.[s.id] || 0;
              const levelLabel = LEVEL_CONFIG.find(l => l.value === level)?.label || 'N/A';
              row.push(levelLabel);
          });
          return row.join(';');
      });

      const csvContent = "data:text/csv;charset=utf-8," + [header.join(';'), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `matriz_skills_${selectedBranch}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
        
        {/* Header Controls */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        🎓 Matriz de Skills
                    </h2>
                    <p className="text-sm text-gray-500">Gestão de competências e polivalência por filial.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setActiveTab('matrix')}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'matrix' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        Visualizar Matriz
                    </button>
                    {canManage && (
                        <button 
                            onClick={() => setActiveTab('manage')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'manage' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            Gerenciar Skills
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="md:col-span-1">
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Filial (Obrigatório)</label>
                    <select 
                        value={selectedBranch}
                        onChange={e => setSelectedBranch(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                        disabled={availableBranches.length === 1}
                    >
                        <option value="">Selecione...</option>
                        {availableBranches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                
                {activeTab === 'matrix' && (
                    <>
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Filtrar por Cargo</label>
                            <select 
                                value={filterRole}
                                onChange={e => setFilterRole(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white"
                                disabled={!selectedBranch}
                            >
                                <option value="">Todos</option>
                                {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Buscar Colaborador</label>
                            <input 
                                type="text" 
                                placeholder="Nome..." 
                                value={filterName}
                                onChange={e => setFilterName(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                disabled={!selectedBranch}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>

        {/* TAB 1: MATRIX */}
        {activeTab === 'matrix' && selectedBranch && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div className="flex gap-4 items-center">
                        <h3 className="font-bold text-gray-700">Matriz de Competências - {selectedBranch}</h3>
                        <div className="flex gap-2">
                            {LEVEL_CONFIG.slice(1).map(l => (
                                <div key={l.value} className={`text-[10px] px-2 py-0.5 rounded border font-bold ${l.color}`}>
                                    {l.label} ({l.value})
                                </div>
                            ))}
                        </div>
                    </div>
                    <button 
                        onClick={exportToCSV}
                        className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded hover:bg-emerald-100 transition flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Exportar CSV
                    </button>
                </div>

                <div className="overflow-auto custom-scrollbar max-h-[600px]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-100 text-gray-600 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 border-b border-r border-gray-200 min-w-[200px] z-20 sticky left-0 bg-gray-100">Colaborador</th>
                                <th className="p-3 border-b border-r border-gray-200 min-w-[150px]">Cargo</th>
                                {filteredSkills.map(skill => (
                                    <th key={skill.id} className="p-3 border-b border-gray-200 min-w-[100px] text-center font-bold" title={skill.description}>
                                        <div className="flex flex-col items-center">
                                            <span>{skill.name}</span>
                                        </div>
                                    </th>
                                ))}
                                {filteredSkills.length === 0 && <th className="p-4 text-center text-gray-400 font-normal italic">Nenhuma skill cadastrada nesta filial.</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredCollaborators.map(colab => (
                                <tr key={colab.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-3 border-r border-gray-200 font-bold text-gray-800 sticky left-0 bg-white group-hover:bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        {colab.name}
                                    </td>
                                    <td className="p-3 border-r border-gray-200 text-gray-500 text-xs truncate max-w-[150px]">
                                        {colab.role}
                                    </td>
                                    {filteredSkills.map(skill => {
                                        const level = colab.skills?.[skill.id] || 0;
                                        const config = LEVEL_CONFIG.find(l => l.value === level) || LEVEL_CONFIG[0];
                                        
                                        return (
                                            <td 
                                                key={skill.id} 
                                                className={`p-1 border-r border-gray-100 text-center cursor-pointer transition-colors hover:opacity-80`}
                                                style={{ backgroundColor: config.value > 0 ? config.fullColor : '#ffffff' }}
                                                onClick={() => handleLevelChange(colab, skill.id)}
                                                title={canManage ? "Clique para alterar nível" : "Nível de competência"}
                                            >
                                                {level > 0 && (
                                                    <span className={`inline-block w-6 h-6 leading-6 rounded-full text-xs font-bold ${config.color} border shadow-sm`}>
                                                        {level}
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            {filteredCollaborators.length === 0 && (
                                <tr>
                                    <td colSpan={filteredSkills.length + 2} className="p-8 text-center text-gray-400 italic">
                                        Nenhum colaborador encontrado com os filtros atuais.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* TAB 2: MANAGE SKILLS */}
        {activeTab === 'manage' && selectedBranch && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white rounded-xl shadow-lg border border-gray-100 p-6 h-fit">
                    <h3 className="font-bold text-gray-800 mb-4">{editingSkillId ? 'Editar Skill' : 'Nova Skill'}</h3>
                    <form onSubmit={handleSaveSkill} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome da Competência</label>
                            <input 
                                type="text" 
                                required
                                value={newSkillName}
                                onChange={e => setNewSkillName(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Ex: Operação de Empilhadeira"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Descrição (Opcional)</label>
                            <textarea 
                                rows={3}
                                value={newSkillDesc}
                                onChange={e => setNewSkillDesc(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Detalhes sobre a competência..."
                            />
                        </div>
                        <div className="pt-2 flex gap-2">
                            {editingSkillId && (
                                <button 
                                    type="button" 
                                    onClick={() => { setEditingSkillId(null); setNewSkillName(''); setNewSkillDesc(''); }}
                                    className="flex-1 bg-gray-100 text-gray-600 font-bold py-2 rounded-lg hover:bg-gray-200 transition"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button 
                                type="submit" 
                                className="flex-1 bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm"
                            >
                                {editingSkillId ? 'Salvar' : 'Adicionar'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <h3 className="font-bold text-gray-800 mb-4">Skills Cadastradas em {selectedBranch}</h3>
                    <div className="space-y-2">
                        {filteredSkills.map(skill => (
                            <div key={skill.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-sm transition-all group">
                                <div>
                                    <div className="font-bold text-gray-800">{skill.name}</div>
                                    {skill.description && <div className="text-xs text-gray-500 mt-0.5">{skill.description}</div>}
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleEditSkill(skill)}
                                        className="p-1.5 text-blue-500 hover:bg-blue-100 rounded transition"
                                        title="Editar"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteSkill(skill.id)}
                                        className="p-1.5 text-red-500 hover:bg-red-100 rounded transition"
                                        title="Excluir"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {filteredSkills.length === 0 && <p className="text-gray-400 italic text-center py-4">Nenhuma skill cadastrada.</p>}
                    </div>
                </div>
            </div>
        )}

        {!selectedBranch && (
            <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-gray-400 text-lg">Selecione uma filial acima para começar.</p>
            </div>
        )}
    </div>
  );
};
