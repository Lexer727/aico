import React, { useState, useRef, useEffect } from 'react';
import { useTabStore } from '../../stores/useTabStore';
import { ChevronDown, ExternalLink, Briefcase, Plus } from 'lucide-react';

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
export const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({
  projects,
  onSelectProject,
  onRefreshProjects,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
        setIsCreating(false);
        setCreateError(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProject = (projectId: string) => {
    setActiveProject(projectId);
    onSelectProject?.(projectId);
    setIsOpen(false);
    fetch('/api/v1/projects/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    }).catch(() => {});
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newProjectName.trim();
    if (!trimmed) {
      setCreateError('Project name cannot be empty');
      return;
    }
    if (projects.some((p) => p.name.toLowerCase() === trimmed.toLowerCase() || p.id.toLowerCase() === trimmed.toLowerCase())) {
      setCreateError(`Project "${trimmed}" already exists`);
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        let msg = 'Failed to create project';
        try {
          const errData = await res.json();
          msg = errData.message || errData.error || msg;
        } catch {
          // ignore
        }
        setCreateError(msg);
        return;
      }

      const created = await res.json().catch(() => ({ id: trimmed, name: trimmed }));
      const newProjectId = created.id || created.name || trimmed;

      if (onRefreshProjects) {
        await onRefreshProjects();
      }

      handleSelectProject(newProjectId);
      setIsCreating(false);
      setNewProjectName('');
      setIsOpen(false);
    } catch (err: any) {
      setCreateError(err?.message || 'Network error creating project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        data-testid="project-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700/80 rounded-md hover:bg-zinc-800 transition-colors shadow-sm"
      >
        <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
        <span>{activeProject ? activeProject.name : 'Select Project'}</span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-64 rounded-md bg-zinc-900 border border-zinc-700 shadow-xl z-50 py-1">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleSelectProject(project.id)}
              className="flex items-center justify-between px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800/80 hover:text-white cursor-pointer transition-colors"
            >
              <span className="font-medium truncate">{project.name}</span>
              <button
                data-testid={`detach-window-${project.id}`}
                onClick={(e) => handleOpenInNewWindow(e, project.id)}
                title="Open in new window"
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* New Project Scaffolding Option */}
          <div className="border-t border-zinc-800 my-1" />

          {!isCreating ? (
            <button
              type="button"
              data-testid="btn-new-project-trigger"
              onClick={() => {
                setIsCreating(true);
                setCreateError(null);
                setNewProjectName('');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ New Project</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateProject}
              className="p-2 space-y-2 bg-zinc-950/60 rounded m-1 border border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[11px] font-medium text-zinc-300">New Project Name</div>
              <input
                type="text"
                autoFocus
                data-testid="input-new-project-name"
                value={newProjectName}
                onChange={(e) => {
                  setNewProjectName(e.target.value);
                  if (createError) setCreateError(null);
                }}
                placeholder="e.g. demo-app"
                className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                disabled={isSubmitting}
              />
              {createError && (
                <div data-testid="new-project-error" className="text-[10px] text-rose-400">
                  {createError}
                </div>
              )}
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  data-testid="btn-cancel-create-project"
                  onClick={() => {
                    setIsCreating(false);
                    setCreateError(null);
                  }}
                  disabled={isSubmitting}
                  className="px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="btn-submit-create-project"
                  disabled={isSubmitting || !newProjectName.trim()}
                  className="px-2.5 py-1 text-[11px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
