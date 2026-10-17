import React, { useState, useRef, useEffect } from 'react';
import { Smartphone, ChevronDown, Check } from 'lucide-react';

export interface DesktopWindowInfo {
  windowId: string;
  title?: string;
  tabs?: unknown[];
  activeTabId?: string | null;
  activeProject?: string;
}

export interface DesktopWindowSwitcherProps {
  windows: Record<string, DesktopWindowInfo>;
  targetWindowId: string;
  onSelectWindow: (windowId: string) => void;
}

// @implements ft-core-webui-shell::TASK-CORE-006-26::REQ-020
export const DesktopWindowSwitcher: React.FC<DesktopWindowSwitcherProps> = ({
  windows,
  targetWindowId,
  onSelectWindow,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const windowList = Object.values(windows);
  const activeWindow = windows[targetWindowId] || (targetWindowId ? { windowId: targetWindowId, title: targetWindowId } : null);

  const displayLabel = activeWindow
    ? activeWindow.title
      ? `${activeWindow.windowId} (${activeWindow.title})`
      : activeWindow.windowId
    : 'No Desktop Windows';

  const handleSelect = (winId: string) => {
    onSelectWindow(winId);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} data-testid="mobile-window-switcher-container">
      <button
        type="button"
        data-testid="mobile-window-switcher"
        aria-label="Desktop Window Switcher"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700/80 rounded-md hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer font-mono"
      >
        <Smartphone className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span className="truncate max-w-[140px] sm:max-w-[200px] text-zinc-200">{displayLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          data-testid="mobile-window-dropdown-menu"
          className="absolute left-0 mt-1 w-64 rounded-md bg-zinc-900 border border-zinc-700 shadow-xl z-50 py-1 font-mono text-xs max-h-60 overflow-y-auto"
        >
          {windowList.length === 0 ? (
            <div className="px-3 py-2 text-zinc-500 italic text-xs">
              {targetWindowId ? `Target: ${targetWindowId}` : 'No Desktop Windows'}
            </div>
          ) : (
            windowList.map((w) => {
              const isSelected = w.windowId === targetWindowId;
              return (
                <div
                  key={w.windowId}
                  data-testid={`window-option-${w.windowId}`}
                  onClick={() => handleSelect(w.windowId)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-indigo-950/70 text-indigo-200 font-semibold'
                      : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                  }`}
                >
                  <div className="truncate flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{w.windowId}</span>
                    {w.title && <span className="text-zinc-500 text-[10px] truncate">({w.title})</span>}
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-2" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
