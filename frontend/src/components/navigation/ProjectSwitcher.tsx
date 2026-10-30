import React, { useState, useRef, useEffect } from 'react';
import { useTabStore } from '../../stores/useTabStore';
import { ChevronDown, ExternalLink, Briefcase, Plus } from 'lucide-react';
import { ProjectConfigModal } from './ProjectConfigModal';

export interface ProjectInfo {
  id: string;
  name: string;
}

interface ProjectSwitcherProps {
  projects: ProjectInfo[];
  onSelectProject?: (projectId: string) => void;
  onRefreshProjects?: () => Promise<void> | void;
}

// @implements ft-core-webui-shell::TASK-CORE-006-7::REQ-003
// @implements ft-core-webui-shell::TASK-CORE-006-7::REQ-005
// @implements ft-core-webui-shell::TASK-CORE-006-3::REQ-006
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-3::REQ-009
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-20::REQ-026
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-21::REQ-027
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-21::REQ-028
export const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({
  projects,
  onSelectProject,
  onRefreshProjects,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { activeProjectId, setActiveProject } = useTabStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const handleOpenInNewWindow = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    window.open(`?project=${projectId}&window=detached`, '_blank');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProject = async (projectId: string) => {
    setActiveProject(projectId);
    setIsOpen(false);
    try {
      await fetch('/api/v1/projects/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });
    } catch {
      // ignore offline error
    }
    onSelectProject?.(projectId);
  };

  return (
    <div className="flex items-center gap-1.5" ref={dropdownRef}>
      <div className="relative inline-block text-left">
        <button
          type="button"
          data-testid="project-select-trigger"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700/80 rounded-md hover:bg-zinc-800 transition-colors shadow-sm cursor-pointer"
        >
          <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
          <span>{activeProject ? activeProject.name : 'Select Project'}</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </button>

        {isOpen && (
          <div
            data-testid="project-select-dropdown"
            className="absolute left-0 mt-1 w-64 rounded-md bg-zinc-900 border border-zinc-700 shadow-xl z-50 py-1"
          >
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleSelectProject(project.id)}
                className="flex items-center justify-between px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800/80 hover:text-white cursor-pointer transition-colors"
              >
                <span className="font-medium truncate">{project.name}</span>
                <button
                  type="button"
                  data-testid={`detach-window-${project.id}`}
                  onClick={(e) => handleOpenInNewWindow(e, project.id)}
                  title="Open in new window"
                  className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Standalone Add Project Button Next to Project Switcher Dropdown */}
      {/* @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-7::REQ-001 */}
      <button
        type="button"
        data-testid="btn-new-project-trigger"
        onClick={() => {
          setIsOpen(false);
          setIsCreateModalOpen(true);
        }}
        title="Add Project (.aico-project.json)"
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/70 border border-indigo-800/70 rounded-md transition-colors shadow-sm cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5 text-indigo-400" />
        <span className="hidden sm:inline">+ Add Project</span>
      </button>

      <ProjectConfigModal
        isOpen={isCreateModalOpen}
        mode="create"
        existingProjects={projects}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={async (created) => {
          if (onRefreshProjects) {
            await onRefreshProjects();
          }
          await handleSelectProject(created.id);
        }}
      />
    </div>
  );
};
