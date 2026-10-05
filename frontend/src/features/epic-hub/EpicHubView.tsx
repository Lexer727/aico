import React, { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronRight, Layers, FileText, CheckSquare, GitFork, ShieldCheck, FolderArchive } from 'lucide-react';

export interface EpicData {
  id: string;
  title: string;
  status: string;
  verifiedCount: number;
  totalCount: number;
  sections: {
    overview: string;
    brainstorm: string;
    specifications: string;
    deepDive: string;
    taskPlan: string;
    assets: string;
  };
}

interface EpicHubViewProps {
  epic: EpicData;
  onPopOut?: (epicId: string, section: string) => void;
}

// @implements SPEC-CORE-007::REQ-001
// @implements SPEC-CORE-007::REQ-002
// @implements SPEC-CORE-007::REQ-005
// @implements SPEC-CORE-007::REQ-011
export const EpicHubView: React.FC<EpicHubViewProps> = ({ epic, onPopOut }) => {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const sections = [
    { key: 'overview', title: 'Overview', icon: FileText, content: epic.sections.overview },
    { key: 'brainstorm', title: 'Brainstorm', icon: Layers, content: epic.sections.brainstorm },
    { key: 'specifications', title: 'Specifications', icon: ShieldCheck, content: epic.sections.specifications },
    { key: 'deepDive', title: 'Deep Dive', icon: GitFork, content: epic.sections.deepDive },
    { key: 'taskPlan', title: 'Task Plan', icon: CheckSquare, content: epic.sections.taskPlan },
    { key: 'assets', title: 'Assets', icon: FolderArchive, content: epic.sections.assets },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">{epic.title}</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800">
              {epic.status}
            </span>
            <span className="px-2.5 py-0.5 text-xs font-mono rounded bg-zinc-800 text-zinc-300">
              [{epic.verifiedCount}/{epic.totalCount} Verified]
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1 font-mono">Epic ID: {epic.id}</p>
        </div>
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {sections.map(({ key, title, icon: Icon, content }) => {
          const isCollapsed = !!collapsedSections[key];

          return (
            <div
              key={key}
              className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/50"
            >
              {/* Accordion Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 cursor-pointer select-none">
                <div
                  onClick={() => toggleSection(key)}
                  className="flex items-center gap-2.5 flex-1 font-semibold text-sm text-zinc-200"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  )}
                  <Icon className="w-4 h-4 text-indigo-400" />
                  <span>{title}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    data-testid={`popout-${key}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPopOut?.(epic.id, key);
                    }}
                    title="Open in separate tab"
                    className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Accordion Content */}
              {!isCollapsed && (
                <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30">
                  {content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
