import React, { useState, useRef, useEffect } from 'react';
import { useTabStore } from '../../stores/useTabStore';
import { ChevronDown, ExternalLink, Briefcase } from 'lucide-react';

export interface ProjectInfo {
  id: string;
  name: string;
}

interface ProjectSwitcherProps {
  projects: ProjectInfo[];
}

// @implements ft-core-webui-shell::TASK-CORE-006-7::REQ-003
// @implements ft-core-webui-shell::TASK-CORE-006-7::REQ-005
// @implements ft-core-webui-shell::TASK-CORE-006-3::REQ-006
export const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({ projects }) => {
  const [isOpen, setIsOpen] = useState(false);
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

  const handleSelectProject = (projectId: string) => {
    setActiveProject(projectId);
    setIsOpen(false);
    fetch('/api/v1/projects/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    }).catch(() => {});
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
        </div>
      )}
    </div>
  );
};
