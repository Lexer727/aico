import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTabStore, type TabItem } from '../../stores/useTabStore';
import {
  X,
  Layers,
  CheckSquare,
  Code2,
  BookOpen,
  Home,
  Package,
  Scale,
  GitFork,
  Undo2,
  FolderArchive,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';

// @implements ft-core-webui-shell::TASK-CORE-006-2::REQ-004
// @implements ft-core-webui-shell::TASK-CORE-006-7::REQ-005
// @implements ft-core-epic-hub::TASK-CORE-007-1::REQ-007
// @implements ft-core-assets-manager::TASK-ASSET-005::REQ-007
export const TabBar: React.FC = () => {
  const {
    activeProjectId,
    getProjectTabs,
    activeTabId,
    setActiveTab,
    closeTab,
    setProjectTabs,
    reopenLastClosedTab,
    recentlyClosedTabs,
  } = useTabStore();
  const tabs = getProjectTabs(activeProjectId);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Live drag preview state
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const draggedTabIdRef = useRef<string | null>(null);
  const [previewTabs, setPreviewTabs] = useState<TabItem[] | null>(null);

  // The active list being rendered: live preview order during drag, or actual tabs
  const renderedTabs = previewTabs || tabs;

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  // @implements ft-terminal-panel-ui::TASK-TERM-002-17::REQ-021
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    checkScroll();

    const handleNativeWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0 || e.deltaX !== 0) {
        e.preventDefault();
        const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        el.scrollLeft += delta;
      }
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('wheel', handleNativeWheel);
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, renderedTabs]);

  const scrollByAmount = (amount: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  // @implements ft-core-ui-visual-consistency::TASK-CORE-010-3::REQ-003
  // @implements ft-core-ui-visual-consistency::TASK-CORE-010-5::REQ-005
  // @implements ft-core-assets-manager::TASK-ASSET-005::REQ-007
  const getIcon = (type: string) => {
    const iconClass = 'w-3.5 h-3.5 shrink-0';
    switch (type) {
      case 'epic':
        return <Layers className={clsx(iconClass, 'text-indigo-400')} />;
      case 'feature':
        return <Package className={clsx(iconClass, 'text-purple-400')} />;
      case 'spec':
        return <BookOpen className={clsx(iconClass, 'text-sky-400')} />;
      case 'plan':
        return <CheckSquare className={clsx(iconClass, 'text-emerald-400')} />;
      case 'brainstorm':
        return <Layers className={clsx(iconClass, 'text-indigo-400')} />;
      case 'deep_dive':
        return <GitFork className={clsx(iconClass, 'text-indigo-400')} />;
      case 'code':
        return <Code2 className={clsx(iconClass, 'text-amber-400')} />;
      case 'adr':
        return <Scale className={clsx(iconClass, 'text-amber-400')} />;
      case 'glossary':
        return <BookOpen className={clsx(iconClass, 'text-amber-400')} />;
      case 'asset':
        return <FolderArchive className={clsx(iconClass, 'text-amber-400')} />;
      default:
        return <Package className={clsx(iconClass, 'text-purple-400')} />;
    }
  };

  const isDashboardActive = activeTabId === null || activeTabId === 'dashboard';

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  const handleDragStart = (e: React.DragEvent, tab: TabItem) => {
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tab.id);
    }
    draggedTabIdRef.current = tab.id;
    setDraggedTabId(tab.id);
    setPreviewTabs([...tabs]);
  };

  // Hovering over another tab dynamically slides other tabs into place
  const handleDragOverTab = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }

    const activeDraggedId = draggedTabIdRef.current || draggedTabId;
    if (!activeDraggedId || targetTabId === activeDraggedId) return;

    setPreviewTabs((current) => {
      const activeList = current ? [...current] : [...tabs];
      const fromIndex = activeList.findIndex((t) => t.id === activeDraggedId);
      const toIndex = activeList.findIndex((t) => t.id === targetTabId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return current;

      const [moved] = activeList.splice(fromIndex, 1);
      activeList.splice(toIndex, 0, moved);
      return activeList;
    });
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }

    // Auto-scroll when dragging near edges
    if (scrollContainerRef.current) {
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const edgeThreshold = 60;
      if (e.clientX - rect.left < edgeThreshold) {
        scrollContainerRef.current.scrollLeft -= 10;
      } else if (rect.right - e.clientX < edgeThreshold) {
        scrollContainerRef.current.scrollLeft += 10;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (previewTabs && previewTabs.length > 0) {
      setProjectTabs(activeProjectId, previewTabs);
    }
    draggedTabIdRef.current = null;
    setDraggedTabId(null);
    setPreviewTabs(null);
  };

  const handleDragEnd = () => {
    draggedTabIdRef.current = null;
    setDraggedTabId(null);
    setPreviewTabs(null);
  };

  const lastClosedTab =
    recentlyClosedTabs.length > 0
      ? recentlyClosedTabs[recentlyClosedTabs.length - 1]
      : null;

  return (
    <div className="flex items-center h-9 min-h-[36px] bg-zinc-900 border-b border-zinc-800 overflow-hidden select-none">
      {/* Scroll Left Button if overflow */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount(-180)}
          className="flex items-center justify-center px-1.5 h-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors shrink-0 border-r border-zinc-800 cursor-pointer"
          title="Scroll tabs left"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Scrollable Tab Strip with Mouse Wheel Support */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        onDragOver={handleContainerDragOver}
        onDrop={handleDrop}
        className="flex items-center h-full flex-1 overflow-x-auto no-scrollbar"
      >
        {/* Permanent Home / Dashboard Tab (Cannot be closed via middle-click or X) */}
        <div
          data-testid="tab-dashboard"
          onClick={() => setActiveTab('dashboard')}
          className={clsx(
            'flex items-center gap-1.5 px-3 h-full min-h-[36px] border-r border-zinc-800 text-xs font-medium cursor-pointer transition-colors shrink-0 whitespace-nowrap',
            isDashboardActive
              ? 'bg-zinc-950 text-indigo-400 border-b-2 border-b-indigo-500'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          )}
        >
          <Home className="w-3.5 h-3.5 shrink-0" />
          <span>Dashboard</span>
        </div>

        {/* Project Opened Tabs (Live preview shift, middle-click closes) */}
        {renderedTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isBeingDragged = tab.id === draggedTabId;
          const displayLabel = tab.id;
          const tooltip =
            tab.title && tab.title !== tab.id
              ? `${tab.title} (${tab.id}) - Drag to reorder, Middle-click to close`
              : `${tab.id} - Drag to reorder, Middle-click to close`;

          return (
            <div
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              draggable
              onDragStart={(e) => handleDragStart(e, tab)}
              onDragOver={(e) => handleDragOverTab(e, tab.id)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onClick={() => {
                if (!draggedTabId) setActiveTab(tab.id);
              }}
              onMouseDown={(e) => {
                // Middle mouse click closes tab
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(activeProjectId, tab.id);
                }
              }}
              title={tooltip}
              className={clsx(
                'group flex items-center gap-2 px-3 h-full min-h-[36px] border-r border-zinc-800 text-xs font-medium cursor-pointer transition-all duration-150 ease-out max-w-[200px] shrink-0 whitespace-nowrap',
                isActive && !isBeingDragged
                  ? 'bg-zinc-950 text-zinc-100 border-b-2 border-b-indigo-500'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40',
                isBeingDragged &&
                  'opacity-60 bg-indigo-950/40 border-2 border-dashed border-indigo-400 text-indigo-300 ring-2 ring-indigo-500/20 scale-[0.98]'
              )}
            >
              <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                {getIcon(tab.type)}
              </span>
              <span className="truncate">{displayLabel}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(activeProjectId, tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-opacity shrink-0 cursor-pointer"
                title="Close tab"
              >
                <X className="w-3 h-3 shrink-0" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Scroll Right Button if overflow */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByAmount(180)}
          className="flex items-center justify-center px-1.5 h-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors shrink-0 border-l border-zinc-800 cursor-pointer"
          title="Scroll tabs right"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Reopen Closed Tab Button (Pinned at right end) */}
      <button
        type="button"
        data-testid="tab-reopen-btn"
        onClick={() => reopenLastClosedTab(activeProjectId)}
        disabled={!lastClosedTab}
        title={
          lastClosedTab
            ? `Reopen closed tab: ${lastClosedTab.id} (Ctrl+Shift+T / Ctrl+Alt+T)`
            : 'No closed tabs to reopen (Ctrl+Shift+T)'
        }
        className={clsx(
          'flex items-center justify-center px-2.5 h-full min-h-[36px] border-l border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 transition-colors shrink-0 cursor-pointer',
          !lastClosedTab && 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-zinc-400'
        )}
      >
        <Undo2 className="w-3.5 h-3.5 shrink-0" />
      </button>
    </div>
  );
};
