import React from 'react';
import { useDockStore } from '../../stores/useDockStore';
import { PanelBottom, PanelRight, Minimize2 } from 'lucide-react';
import clsx from 'clsx';

interface DockablePanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
  isMobile?: boolean;
}

// @implements ft-core-webui-shell::TASK-CORE-006-9::REQ-010
// @implements ft-core-webui-shell::TASK-CORE-006-9::REQ-011
// @implements ft-core-webui-shell::TASK-CORE-006-37::REQ-025
export const DockablePanel: React.FC<DockablePanelProps> = ({
  title = 'Docked Panel',
  children,
  className,
  hideHeader = false,
  isMobile = false,
}) => {
  const {
    position,
    rightWidth,
    bottomHeight,
    setRightWidth,
    setBottomHeight,
    toggleDock,
  } = useDockStore();

  const isBottom = isMobile ? true : position === 'bottom';

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = rightWidth;
    const startHeight = bottomHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isBottom) {
        const deltaY = startY - moveEvent.clientY;
        setBottomHeight(startHeight + deltaY);
      } else {
        const deltaX = startX - moveEvent.clientX;
        setRightWidth(startWidth + deltaX);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <aside
      data-testid="dockable-panel"
      data-position={position}
      style={
        isMobile
          ? undefined
          : isBottom
            ? { height: `${bottomHeight}px` }
            : { width: `${rightWidth}px` }
      }
      className={clsx(
        'border-zinc-800 bg-zinc-950 flex flex-col z-10 flex-shrink-0 relative',
        isBottom
          ? 'w-full h-64 border-t'
          : 'w-80 md:w-96 h-full border-l',
        className
      )}
    >
      {!isMobile && (
        <div
          data-testid="dockable-panel-resize-handle"
          role="separator"
          aria-orientation={isBottom ? 'horizontal' : 'vertical'}
          aria-label={isBottom ? 'Resize terminal panel height' : 'Resize terminal panel width'}
          onMouseDown={handleResizeStart}
          className={clsx(
            'absolute z-40 transition-colors hover:bg-indigo-500/60 active:bg-indigo-500',
            isBottom
              ? 'top-0 left-0 right-0 h-1.5 cursor-row-resize'
              : 'top-0 bottom-0 left-0 w-1.5 cursor-col-resize'
          )}
        />
      )}
      {/* Panel Header */}
      {!hideHeader && (
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
      )}

      {/* Panel Content */}
      <div
        className={clsx(
          'flex-1 text-zinc-200',
          hideHeader ? 'overflow-hidden flex flex-col p-0' : 'overflow-auto p-3'
        )}
      >
        {children}
      </div>
    </aside>
  );
};
