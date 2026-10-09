import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Terminal,
  Plus,
  X,
  Sparkles,
  ChevronDown,
  Square,
  PanelRight,
  PanelBottom,
  Minimize2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useDockStore } from '../../stores/useDockStore';
import clsx from 'clsx';

export type ShellType = 'powershell' | 'bash' | 'cmd' | 'agy';

export interface TerminalTab {
  id: string;
  name: string;
  shortName: string;
  shell: ShellType;
  history: string[];
  pendingLine?: string;
}

export interface TerminalConsoleProps {
  cwd?: string;
}

export interface AnsiSegment {
  text: string;
  className: string;
}

export interface SlashCommand {
  name: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: '/help', description: 'Show available commands and keybindings' },
  { name: '/skills', description: 'List available AICO skills in workspace' },
  { name: '/agents', description: 'List available custom agents' },
  { name: '/model', description: 'Set or view current LLM model' },
  { name: '/effort', description: 'Set reasoning effort (low, medium, high, max)' },
  { name: '/plan', description: 'Explore and draft execution plan' },
  { name: '/grill-me', description: 'Interactive Socratic design interview' },
  { name: '/clear', description: 'Clear conversation history and terminal screen' },
  { name: '/exit', description: 'Exit the AI session' },
];

// Parses raw text containing ANSI escape color codes into styled text segments
export function parseAnsi(input: string): AnsiSegment[] {
  if (!input) return [];
  const segments: AnsiSegment[] = [];
  const regex = /\u001b\[([0-9;?]*)?([a-zA-Z])/g;
  let lastIndex = 0;
  let currentColor = '';
  let isBold = false;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      const text = input.slice(lastIndex, match.index);
      if (text) {
        const classes = [currentColor, isBold ? 'font-bold' : ''].filter(Boolean).join(' ');
        segments.push({ text, className: classes });
      }
    }
    lastIndex = regex.lastIndex;

    const command = match[2];
    const params = match[1];

    if (command === 'm') {
      const codes = params ? params.split(';').map((s) => (s ? parseInt(s, 10) : 0)) : [0];
      for (const code of codes) {
        if (code === 0) {
          currentColor = '';
          isBold = false;
        } else if (code === 1) {
          isBold = true;
        } else if (code === 30) {
          currentColor = 'text-zinc-600';
        } else if (code === 31 || code === 91) {
          currentColor = 'text-rose-400';
        } else if (code === 32 || code === 92) {
          currentColor = 'text-emerald-400';
        } else if (code === 33 || code === 93) {
          currentColor = 'text-amber-400';
        } else if (code === 34) {
          currentColor = 'text-blue-400';
        } else if (code === 35 || code === 95) {
          currentColor = 'text-purple-400';
        } else if (code === 36 || code === 96) {
          currentColor = 'text-cyan-400';
        } else if (code === 37) {
          currentColor = 'text-zinc-100';
        } else if (code === 90) {
          currentColor = 'text-zinc-500';
        } else if (code === 94) {
          currentColor = 'text-sky-400';
        }
      }
    }
  }

  if (lastIndex < input.length) {
    const text = input.slice(lastIndex);
    if (text) {
      const classes = [currentColor, isBold ? 'font-bold' : ''].filter(Boolean).join(' ');
      segments.push({ text, className: classes });
    }
  }

  return segments;
}

// Authentic Google Antigravity Rainbow Arch Pixel Art Icon
export const AntigravityArchLogo: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 36 36" fill="none" className={className} data-testid="agy-arch-logo">
    {/* Orange / Amber top curve */}
    <rect x="14" y="2" width="8" height="4" rx="0.5" fill="#F97316" />
    <rect x="12" y="6" width="12" height="4" rx="0.5" fill="#F59E0B" />
    {/* Yellow left, Magenta right */}
    <rect x="9" y="10" width="6" height="4" rx="0.5" fill="#EAB308" />
    <rect x="21" y="10" width="6" height="4" rx="0.5" fill="#EC4899" />
    {/* Lime left, Purple right */}
    <rect x="7" y="14" width="5" height="5" rx="0.5" fill="#84CC16" />
    <rect x="24" y="14" width="5" height="5" rx="0.5" fill="#A855F7" />
    {/* Emerald left, Violet right */}
    <rect x="5" y="19" width="5" height="5" rx="0.5" fill="#10B981" />
    <rect x="26" y="19" width="5" height="5" rx="0.5" fill="#8B5CF6" />
    {/* Cyan left, Indigo right */}
    <rect x="3" y="24" width="5" height="5" rx="0.5" fill="#06B6D4" />
    <rect x="28" y="24" width="5" height="5" rx="0.5" fill="#6366F1" />
    {/* Sky feet */}
    <rect x="1" y="29" width="6" height="4" rx="0.5" fill="#38BDF8" />
    <rect x="29" y="29" width="6" height="4" rx="0.5" fill="#3B82F6" />
  </svg>
);

const SESSION_INITIALIZED_KEY = 'aico_terminal_session_initialized';
const SESSION_TABS_KEY = 'aico_terminal_session_tabs';
const SESSION_ACTIVE_KEY = 'aico_terminal_session_active';

const getInitialTabs = (): TerminalTab[] => {
  if (typeof window === 'undefined') return [];
  try {
    const isInit = sessionStorage.getItem(SESSION_INITIALIZED_KEY);
    if (!isInit) {
      sessionStorage.setItem(SESSION_INITIALIZED_KEY, 'true');
      sessionStorage.removeItem(SESSION_TABS_KEY);
      sessionStorage.removeItem(SESSION_ACTIVE_KEY);
      return [];
    }
    const saved = sessionStorage.getItem(SESSION_TABS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((t) => ({
          ...t,
          history: Array.isArray(t.history) ? t.history : [],
          pendingLine: '',
        }));
      }
    }
  } catch {
    // ignore
  }
  return [];
};

const getInitialActiveTab = (initTabs: TerminalTab[]): string => {
  if (typeof window === 'undefined') return '';
  try {
    const saved = sessionStorage.getItem(SESSION_ACTIVE_KEY);
    if (saved && initTabs.some((t) => t.id === saved)) return saved;
  } catch {
    // ignore
  }
  return initTabs.length > 0 ? initTabs[0].id : '';
};

// @implements spec-ft-core-webui-shell::REQ-009
// @implements spec-ft-core-webui-shell::REQ-010
// @implements spec-ft-core-webui-shell::REQ-011
// @implements spec-ft-terminal-panel-ui::REQ-001
// @implements spec-ft-terminal-panel-ui::REQ-002
// @implements spec-ft-terminal-panel-ui::REQ-003
// @implements spec-ft-terminal-panel-ui::REQ-004
// @implements spec-ft-terminal-panel-ui::REQ-005
// @implements spec-ft-terminal-panel-ui::REQ-006
// @implements spec-ft-terminal-panel-ui::REQ-007
// @implements spec-ft-terminal-panel-ui::REQ-008
// @implements spec-ft-terminal-panel-ui::REQ-009
// @implements spec-ft-terminal-panel-ui::REQ-010
// @implements spec-ft-terminal-panel-ui::REQ-011
// @implements spec-ft-terminal-panel-ui::REQ-012
// @implements spec-ft-terminal-panel-ui::REQ-013
// @implements spec-ft-terminal-panel-ui::REQ-014
// @implements spec-ft-terminal-panel-ui::REQ-015
// @implements spec-ft-terminal-panel-ui::REQ-016
// @implements spec-ft-terminal-panel-ui::REQ-017
// @implements spec-ft-terminal-panel-ui::REQ-018
// @implements spec-ft-terminal-panel-ui::REQ-019
// @implements spec-ft-terminal-panel-ui::REQ-020
// @implements spec-ft-terminal-panel-ui::REQ-021
// @implements spec-ft-terminal-panel-ui::REQ-022
export const TerminalConsole: React.FC<TerminalConsoleProps> = ({ cwd }) => {
  const { position, toggleDock } = useDockStore();
  const isBottom = position === 'bottom';

  const [tabs, setTabs] = useState<TerminalTab[]>(getInitialTabs);
  const [activeTabId, setActiveTabId] = useState<string>(() => getInitialActiveTab(tabs));
  const [inputVal, setInputVal] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);

  // Tab Strip Scroll & Overflow states
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Tab Drag and Drop states
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const draggedTabIdRef = useRef<string | null>(null);
  const [previewTabs, setPreviewTabs] = useState<TerminalTab[] | null>(null);

  const renderedTabs = previewTabs || tabs;

  const cwdRef = useRef(cwd);
  useEffect(() => {
    cwdRef.current = cwd;
  }, [cwd]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const socketsRef = useRef<Record<string, WebSocket>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const clearingTabsRef = useRef<Record<string, boolean>>({});

  const activeTab = tabs.find((t) => t.id === activeTabId) || (tabs.length > 0 ? tabs[0] : null);
  const isAgy = activeTab?.shell === 'agy';

  const filteredCommands = SLASH_COMMANDS.filter((cmd) =>
    cmd.name.toLowerCase().startsWith(inputVal.toLowerCase())
  );

  // Save session tabs to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(
          SESSION_TABS_KEY,
          JSON.stringify(
            tabs.map((t) => ({
              id: t.id,
              name: t.name,
              shortName: t.shortName,
              shell: t.shell,
              history: t.history.slice(-500),
              pendingLine: t.pendingLine || '',
            }))
          )
        );
        sessionStorage.setItem(SESSION_ACTIVE_KEY, activeTabId);
      } catch {
        // ignore
      }
    }
  }, [tabs, activeTabId]);

  // Tab strip overflow check
  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

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

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  // Drag and Drop handlers matching TabBar.tsx
  const handleDragStart = (e: React.DragEvent, tab: TerminalTab) => {
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tab.id);
    }
    draggedTabIdRef.current = tab.id;
    setDraggedTabId(tab.id);
    setPreviewTabs([...tabs]);
  };

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
      setTabs(previewTabs);
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

  const connectSocket = useCallback(
    (tabId: string, shell: ShellType) => {
      const existing = socketsRef.current[tabId];
      if (existing && existing.readyState <= 1) return;

      const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = typeof window !== 'undefined' && window.location.host ? window.location.host : '127.0.0.1:4242';
      const wsUrl = `${protocol}//${host}/api/v1/terminal/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        socketsRef.current[tabId] = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: 'init',
              shell,
              cwd: cwdRef.current || undefined,
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'output' && msg.data) {
              setTabs((prev) =>
                prev.map((t) => {
                  if (t.id !== tabId) return t;

                  let data = msg.data;
                  let history = [...t.history];
                  let pending = t.pendingLine || '';

                  // If this tab was recently cleared, strip the echoed clear/cls command
                  if (clearingTabsRef.current[tabId]) {
                    data = data.replace(/^\s*(clear|cls)\s*(\r?\n)+/i, '');
                    if (data.trim() !== '') {
                      clearingTabsRef.current[tabId] = false;
                    }
                  }

                  // Handle ANSI clear screen sequence (\x1b[2J)
                  if (data.includes('\u001b[2J')) {
                    const clearParts = data.split('\u001b[2J');
                    data = clearParts[clearParts.length - 1];
                    history = [];
                    pending = '';
                  }

                  // Prevent duplicate prompt strings when reconnecting or re-emitting prompt (e.g. "PS D:\...> PS D:\...>")
                  if (pending && data) {
                    const trimmedPending = pending.trim();
                    const trimmedData = data.trim();
                    if (
                      (trimmedPending.startsWith('PS ') && trimmedPending.endsWith('>')) ||
                      trimmedPending.endsWith('$') ||
                      trimmedPending.endsWith('>')
                    ) {
                      if (trimmedData.startsWith(trimmedPending) || trimmedPending === trimmedData) {
                        pending = '';
                      }
                    }
                  }

                  const combined = pending + data;
                  const normalized = combined.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                  const parts = normalized.split('\n');
                  const newPending = parts.pop() ?? '';
                  const newCompleted = [...history, ...parts];

                  return {
                    ...t,
                    history: newCompleted,
                    pendingLine: newPending,
                  };
                })
              );
            } else if (msg.type === 'error' && msg.message) {
              setTabs((prev) =>
                prev.map((t) =>
                  t.id === tabId
                    ? {
                        ...t,
                        history: [...t.history, `\u001b[31m[Process Error] ${msg.message}\u001b[0m`],
                      }
                    : t
                )
              );
            } else if (msg.type === 'exit') {
              setTabs((prev) =>
                prev.map((t) =>
                  t.id === tabId
                    ? {
                        ...t,
                        history: [...t.history, `\u001b[90m[Process exited with code ${msg.code ?? 0}]\u001b[0m`],
                      }
                    : t
                )
              );
            }
          } catch {
            setTabs((prev) =>
              prev.map((t) =>
                t.id === tabId ? { ...t, history: [...t.history, event.data] } : t
              )
            );
          }
        };

        ws.onclose = () => {
          if (socketsRef.current[tabId] === ws) {
            delete socketsRef.current[tabId];
          }
        };

        ws.onerror = (err) => {
          console.error(`WebSocket error on tab ${tabId}`, err);
        };
      } catch (err) {
        console.error('Failed to create WebSocket for terminal tab', err);
      }
    },
    []
  );

  // Connect active tab socket when switching or after reload
  useEffect(() => {
    if (activeTabId && activeTab) {
      connectSocket(activeTabId, activeTab.shell);
    }
  }, [activeTabId, activeTab, connectSocket]);

  // Cleanup all sockets on unmount
  useEffect(() => {
    return () => {
      Object.values(socketsRef.current).forEach((ws) => {
        try {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'close' }));
          }
          ws.close();
        } catch {
          // ignore
        }
      });
      socketsRef.current = {};
    };
  }, []);

  // Close dropdown or slash menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (slashMenuRef.current && !slashMenuRef.current.contains(event.target as Node)) {
        setSlashMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-scroll output log on new lines or pending updates
  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab?.history, activeTab?.pendingLine]);

  const handleAddTab = (shell: ShellType, baseName: string, baseShortName: string) => {
    const existingSameShell = tabs.filter((t) => t.shell === shell);
    const count = existingSameShell.length + 1;
    const name = count === 1 ? baseName : `${baseName} ${count}`;
    const shortName = count === 1 ? baseShortName : `${baseShortName} ${count}`;
    const newId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newTab: TerminalTab = {
      id: newId,
      name,
      shortName,
      shell,
      history: [],
      pendingLine: '',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    connectSocket(newId, shell);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const ws = socketsRef.current[tabId];
    if (ws) {
      try {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'close' }));
        }
        ws.close();
      } catch {
        // ignore
      }
      delete socketsRef.current[tabId];
    }

    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      setActiveTabId(remaining.length > 0 ? remaining[0].id : '');
    }
  };

  const handleClearTerminal = () => {
    if (!activeTabId) return;
    clearingTabsRef.current[activeTabId] = true;
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, history: [], pendingLine: '' } : t))
    );
  };

  const handleKillTerminal = () => {
    if (!activeTabId) return;
    const targetId = activeTabId;
    const ws = socketsRef.current[targetId];
    if (ws) {
      try {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'kill' }));
        }
        ws.close();
      } catch {
        // ignore
      }
      delete socketsRef.current[targetId];
    }

    const remaining = tabs.filter((t) => t.id !== targetId);
    setTabs(remaining);
    if (activeTabId === targetId) {
      setActiveTabId(remaining.length > 0 ? remaining[0].id : '');
    }
  };

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTabId || !activeTab) return;
    const cmd = inputVal.trim();
    if (!cmd) return;

    if (cmd === 'clear' || cmd === 'cls') {
      clearingTabsRef.current[activeTabId] = true;
      handleClearTerminal();
    }

    let ws = socketsRef.current[activeTabId];
    if (!ws || ws.readyState !== 1) {
      connectSocket(activeTabId, activeTab.shell);
      ws = socketsRef.current[activeTabId];
    }

    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'input', data: `${cmd}\r\n` }));
    }

    if (cmd === 'clear' || cmd === 'cls') {
      setInputVal('');
      setSlashMenuOpen(false);
      return;
    }

    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;

        // In agy AI mode, display user turn in history
        if (t.shell === 'agy') {
          return {
            ...t,
            history: [...t.history, `> ${cmd}`],
          };
        }

        // Standard shells (PowerShell, Bash, CMD) echo command on stdout into pendingLine
        return t;
      })
    );

    setInputVal('');
    setSlashMenuOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputVal(val);
    if (activeTab?.shell === 'agy' && val.startsWith('/')) {
      setSlashMenuOpen(true);
      setSlashIndex(0);
    } else {
      setSlashMenuOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (slashMenuOpen && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      // Enter or Tab in slash menu fills in the command without immediately submitting the form
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        handleSelectSlashCommand(filteredCommands[slashIndex].name);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenuOpen(false);
        return;
      }
    }
  };

  const handleSelectSlashCommand = (cmdName: string) => {
    setInputVal(`${cmdName} `);
    setSlashMenuOpen(false);
    inputRef.current?.focus();
  };

  // Preserve text selection on mouseup so copying is effortless
  const handleTerminalClick = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full font-mono text-xs text-zinc-300 bg-zinc-950 overflow-hidden select-none">
      {/* 1. Header Row (Same row as TERMINALS) */}
      <header className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/80 bg-zinc-900/50 shrink-0">
        {/* Left: Terminal icon + TERMINALS title + action buttons */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0 text-zinc-300">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">
              TERMINALS
            </span>
          </div>

          <div className="h-3.5 w-px bg-zinc-800 mx-0.5 shrink-0" />

          {/* Action buttons group */}
          <div className="flex items-center gap-1 relative shrink-0" ref={dropdownRef}>
            {/* Dedicated AI Button */}
            <button
              onClick={() => handleAddTab('agy', 'AI (agy)', 'agy')}
              data-testid="ai-terminal-btn"
              className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-colors bg-purple-900/40 text-purple-300 border border-purple-700/50 hover:bg-purple-800/50 hover:text-purple-100 shrink-0 cursor-pointer"
              title="Launch Antigravity AI Assistant (agy)"
            >
              <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
              <span>AI</span>
            </button>

            {/* Split Button: Plus (PowerShell) + Dropdown trigger */}
            <div className="flex items-center rounded bg-zinc-800/80 border border-zinc-700/60 hover:border-zinc-600 transition-colors shrink-0">
              <button
                onClick={() => handleAddTab('powershell', 'PowerShell', 'ps')}
                data-testid="add-default-terminal"
                className="p-1 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
                title="New Terminal (PowerShell)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                data-testid="shell-dropdown-btn"
                className="p-1 text-zinc-400 hover:text-zinc-200 border-l border-zinc-700/60 transition-colors cursor-pointer"
                title="Select Shell Type"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Shell Dropdown Menu */}
            {dropdownOpen && (
              <div
                className="absolute top-full left-10 mt-1 w-44 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1 z-50 text-xs"
                role="menu"
              >
                <button
                  onClick={() => {
                    handleAddTab('powershell', 'PowerShell', 'ps');
                    setDropdownOpen(false);
                  }}
                  data-testid="shell-option-powershell"
                  className="w-full text-left px-3 py-1.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-sky-400" />
                  <span>PowerShell</span>
                </button>

                <button
                  onClick={() => {
                    handleAddTab('bash', 'Git Bash', 'bash');
                    setDropdownOpen(false);
                  }}
                  data-testid="shell-option-bash"
                  className="w-full text-left px-3 py-1.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Git Bash</span>
                </button>

                <button
                  onClick={() => {
                    handleAddTab('cmd', 'Command Prompt', 'cmd');
                    setDropdownOpen(false);
                  }}
                  data-testid="shell-option-cmd"
                  className="w-full text-left px-3 py-1.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  <span>Command Prompt</span>
                </button>
              </div>
            )}

            {/* Kill Terminal Button */}
            <button
              onClick={handleKillTerminal}
              disabled={tabs.length === 0}
              data-testid="kill-terminal-btn"
              className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors rounded disabled:opacity-30 disabled:pointer-events-none shrink-0 ml-0.5 cursor-pointer"
              title="Kill Terminal (Force Terminate & Close Tab)"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>
        </div>

        {/* Right: Dock position toggle + Minimize */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            data-testid="dock-toggle-button"
            onClick={toggleDock}
            title={isBottom ? 'Dock to right' : 'Dock to bottom'}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {isBottom ? <PanelRight className="w-3.5 h-3.5" /> : <PanelBottom className="w-3.5 h-3.5" />}
          </button>
          <button
            title="Minimize"
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* 2. Dedicated Tab Bar Row (Matching TabBar.tsx with Drag-and-Drop & Overflow Navigation) */}
      <div className="flex items-center h-8 bg-zinc-900/60 border-b border-zinc-800 overflow-hidden shrink-0">
        {/* Scroll Left Button if overflow */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByAmount(-180)}
            className="flex items-center justify-center px-1 h-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0 border-r border-zinc-800 cursor-pointer z-10"
            title="Scroll tabs left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Scrollable Tab Strip with Mouse Wheel & Drag Reorder */}
        <div
          ref={scrollContainerRef}
          onWheel={handleWheel}
          onDragOver={handleContainerDragOver}
          onDrop={handleDrop}
          className="flex items-center h-full flex-1 overflow-x-auto no-scrollbar"
        >
          {tabs.length === 0 ? (
            <div className="px-3 text-xs text-zinc-500 italic">No open terminals</div>
          ) : (
            renderedTabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const tabIsAgy = tab.shell === 'agy';
              const isBeingDragged = tab.id === draggedTabId;

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
                    if (!draggedTabId) setActiveTabId(tab.id);
                  }}
                  onMouseDown={(e) => {
                    // Middle mouse click closes tab
                    if (e.button === 1) {
                      e.preventDefault();
                      handleCloseTab(tab.id, e);
                    }
                  }}
                  title={`${tab.name} (${tab.shortName}) - Drag to reorder, Middle-click to close`}
                  className={clsx(
                    'group flex items-center gap-2 px-3 h-full min-h-[32px] border-r border-zinc-800 text-xs font-medium cursor-pointer transition-all duration-150 ease-out max-w-[200px] shrink-0 whitespace-nowrap',
                    isActive && !isBeingDragged
                      ? tabIsAgy
                        ? 'bg-zinc-950 text-purple-300 border-b-2 border-b-purple-500 font-semibold'
                        : 'bg-zinc-950 text-zinc-100 border-b-2 border-b-indigo-500 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40',
                    isBeingDragged &&
                      'opacity-60 bg-indigo-950/40 border-2 border-dashed border-indigo-400 text-indigo-300 ring-2 ring-indigo-500/20 scale-[0.98]'
                  )}
                >
                  {tabIsAgy ? (
                    <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  ) : (
                    <Terminal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  )}
                  <span className="hidden sm:inline truncate">{tab.name}</span>
                  <span className="sm:hidden">{tab.shortName}</span>
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 hover:bg-zinc-800 transition-opacity ml-1 cursor-pointer shrink-0"
                    title="Close terminal"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Scroll Right Button if overflow */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByAmount(180)}
            className="flex items-center justify-center px-1 h-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0 border-l border-zinc-800 cursor-pointer z-10"
            title="Scroll tabs right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 3. Terminal Body: Output Log or Empty State */}
      {tabs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
            <Terminal className="w-6 h-6 text-zinc-500" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-1">No Active Terminals</h3>
          <p className="text-xs text-zinc-500 max-w-xs mb-4">
            Open a new terminal shell or launch the Antigravity AI Assistant to run commands.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAddTab('powershell', 'PowerShell', 'ps')}
              data-testid="empty-new-terminal"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded font-medium border border-zinc-700 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Terminal</span>
            </button>
            <button
              onClick={() => handleAddTab('agy', 'AI (agy)', 'agy')}
              data-testid="empty-launch-ai"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-900/40 hover:bg-purple-800/50 text-purple-300 text-xs rounded font-medium border border-purple-700/50 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Launch AI (agy)</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          data-testid="terminal-body"
          className="flex-1 overflow-y-auto overflow-x-hidden p-3 font-mono text-xs select-text whitespace-pre-wrap break-words leading-5 flex flex-col justify-between"
          onClick={handleTerminalClick}
        >
          <div>
            {/* Authentic Antigravity CLI Banner Header when in agy tab */}
            {isAgy && (
              <div className="mb-3 select-none">
                <div className="flex items-center gap-4 py-1">
                  <AntigravityArchLogo className="w-10 h-10 shrink-0" />
                  <div className="flex flex-col justify-center">
                    <div className="font-semibold text-sky-400 text-xs tracking-wide">
                      Antigravity CLI 1.3.2
                    </div>
                    <div className="text-zinc-400 text-[11px]">
                      a.staub1307@gmail.com (Google AI Pro)
                    </div>
                    <div className="text-zinc-400 text-[11px]">
                      Gemini 3.8 Flash (High)
                    </div>
                    <div className="text-zinc-500 text-[11px] font-mono">
                      {cwd || '~'}
                    </div>
                  </div>
                </div>
                <div className="border-b border-zinc-800/80 my-2 w-full" />
              </div>
            )}

            {/* Completed Output Lines */}
            {activeTab?.history.map((line, idx) => {
              const isCommand = line.startsWith('>') || line.startsWith('$');
              if (isCommand) {
                return (
                  <div key={idx} className="font-semibold text-sky-400 whitespace-pre-wrap break-words leading-5 my-0.5">
                    {line}
                  </div>
                );
              }

              const segments = parseAnsi(line);
              return (
                <div key={idx} className="text-zinc-300 min-h-[1.25em] whitespace-pre-wrap break-words leading-5">
                  {segments.length > 0 ? (
                    segments.map((seg, sIdx) => (
                      <span key={sIdx} className={seg.className || undefined}>
                        {seg.text}
                      </span>
                    ))
                  ) : (
                    <span>&nbsp;</span>
                  )}
                </div>
              );
            })}

            {/* Active Inline Prompt Line + Typing directly at Prompt */}
            {activeTab && (
              <div className="text-zinc-300 min-h-[1.25em] whitespace-pre-wrap break-words leading-5 flex items-baseline flex-wrap gap-x-1 relative my-0.5">
                {activeTab.pendingLine ? (
                  parseAnsi(activeTab.pendingLine).map((seg, sIdx) => (
                    <span key={sIdx} className={seg.className || undefined}>
                      {seg.text}
                    </span>
                  ))
                ) : isAgy ? (
                  <span className="text-sky-400 font-bold select-none">&gt;&nbsp;</span>
                ) : null}

                {/* Slash autocomplete menu floating directly above active input */}
                {slashMenuOpen && isAgy && filteredCommands.length > 0 && (
                  <div
                    ref={slashMenuRef}
                    data-testid="slash-command-menu"
                    className="absolute bottom-full left-0 mb-1 w-96 max-h-60 overflow-y-auto bg-zinc-900 border border-purple-500/40 rounded-lg shadow-2xl p-1 z-50 text-xs font-sans"
                  >
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1 border-b border-zinc-800">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>Available Slash Commands</span>
                    </div>
                    <div className="py-1">
                      {filteredCommands.map((cmd, idx) => {
                        const isSelected = idx === slashIndex;
                        return (
                          <button
                            key={cmd.name}
                            type="button"
                            data-testid={`slash-option-${cmd.name.slice(1)}`}
                            onClick={() => handleSelectSlashCommand(cmd.name)}
                            onMouseEnter={() => setSlashIndex(idx)}
                            className={clsx(
                              'w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between gap-2 transition-colors cursor-pointer',
                              isSelected
                                ? 'bg-purple-950/70 text-purple-100 border border-purple-700/50'
                                : 'text-zinc-300 hover:bg-zinc-800/60'
                            )}
                          >
                            <span className="font-mono font-bold text-purple-300">{cmd.name}</span>
                            <span className="text-[11px] text-zinc-400 truncate">{cmd.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Inline form directly inside terminal prompt */}
                <form onSubmit={handleCommand} className="inline-flex items-center flex-1 min-w-[120px]">
                  <input
                    ref={inputRef}
                    data-testid="terminal-inline-input"
                    type="text"
                    value={inputVal}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={isAgy ? 'Ask AI or type / for commands...' : ''}
                    className="bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-700 font-mono text-xs flex-1 min-w-[80px]"
                  />
                </form>
                <span className="inline-block w-1.5 h-3.5 bg-zinc-400 animate-pulse ml-0.5 align-middle self-center select-none" />
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Authentic Antigravity Status Footer in AGY Tab */}
          {isAgy && (
            <div className="flex items-center justify-between pt-2 mt-4 border-t border-zinc-800/60 text-[11px] text-zinc-500 select-none font-sans shrink-0">
              <span className="text-zinc-400">? for shortcuts</span>
              <span className="text-zinc-400">Gemini 3.8 Flash · high</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
