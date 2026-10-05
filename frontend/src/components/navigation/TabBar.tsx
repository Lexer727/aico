import React from 'react';
import { useTabStore } from '../../stores/useTabStore';
import { X, FileText, Layers, CheckSquare, Code2, BookOpen } from 'lucide-react';
import clsx from 'clsx';

// @implements SPEC-CORE-006::REQ-004
// @implements SPEC-CORE-006::REQ-005
export const TabBar: React.FC = () => {
  const { activeProjectId, getProjectTabs, activeTabId, setActiveTab, closeTab } = useTabStore();
  const tabs = getProjectTabs(activeProjectId);

  const getIcon = (type: string) => {
    switch (type) {
      case 'epic':
        return <Layers className="w-3.5 h-3.5 text-indigo-400" />;
      case 'spec':
        return <BookOpen className="w-3.5 h-3.5 text-sky-400" />;
      case 'plan':
        return <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />;
      case 'code':
        return <Code2 className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className="flex items-center h-9 bg-zinc-900 border-b border-zinc-800 overflow-x-auto select-none no-scrollbar">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'group flex items-center gap-2 px-3 h-full border-r border-zinc-800 text-xs font-medium cursor-pointer transition-colors max-w-[200px]',
              isActive
                ? 'bg-zinc-950 text-zinc-100 border-b-2 border-b-indigo-500'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            )}
          >
            {getIcon(tab.type)}
            <span className="truncate">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(activeProjectId, tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
