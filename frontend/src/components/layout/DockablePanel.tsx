import React from 'react';
import { useDockStore } from '../../stores/useDockStore';
import { PanelBottom, PanelRight, Minimize2 } from 'lucide-react';
import clsx from 'clsx';

interface DockablePanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

// @implements SPEC-CORE-006::REQ-010
// @implements SPEC-CORE-006::REQ-011
export const DockablePanel: React.FC<DockablePanelProps> = ({
  title = 'Docked Panel',
  children,
  className,
}) => {
  const { position, toggleDock } = useDockStore();

  const isBottom = position === 'bottom';

  return (
    <aside
      data-testid="dockable-panel"
      data-position={position}
      className={clsx(
        'border-zinc-800 bg-zinc-950 flex flex-col transition-all duration-200 z-10 flex-shrink-0',
        isBottom
          ? 'w-full h-64 border-t'
          : 'w-80 md:w-96 h-full border-l',
        className
      )}
    >
      {/* Panel Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            data-testid="dock-toggle-button"
            onClick={toggleDock}
            title={isBottom ? 'Dock to right' : 'Dock to bottom'}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            {isBottom ? (
              <PanelRight className="w-4 h-4" />
            ) : (
              <PanelBottom className="w-4 h-4" />
            )}
          </button>
          <button
            title="Minimize"
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Panel Content */}
      <div className="flex-1 overflow-auto p-3 text-zinc-200">
        {children}
      </div>
    </aside>
  );
};
