import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Terminal,
  Plus,
  X,
  CornerDownLeft,
  Sparkles,
  ChevronDown,
  Trash2,
  PanelRight,
  PanelBottom,
  Minimize2,
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
}

export interface TerminalConsoleProps {
  cwd?: string;
}

export interface AnsiSegment {
  text: string;
  className: string;
}

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
export const TerminalConsole: React.FC<TerminalConsoleProps> = ({ cwd }) => {
  const { position, toggleDock } = useDockStore();
  const isBottom = position === 'bottom';

  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'term-1', name: 'PowerShell', shortName: 'ps', shell: 'powershell', history: [] },
  ]);
  const [activeTabId, setActiveTabId] = useState('term-1');
  const [inputVal, setInputVal] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const socketsRef = useRef<Record<string, WebSocket>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const connectSocket = useCallback(
    (tabId: string, shell: ShellType) => {
      if (socketsRef.current[tabId]) return;

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
              cwd: cwd || undefined,
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'output' && msg.data) {
              const incomingLines = msg.data.split(/\r?\n/);
              if (incomingLines.length > 1 && incomingLines[incomingLines.length - 1] === '') {
                incomingLines.pop();
              }
              setTabs((prev) =>
                prev.map((t) =>
                  t.id === tabId
                    ? {
                        ...t,
                        history: [...t.history, ...incomingLines],
                      }
                    : t
                )
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
          delete socketsRef.current[tabId];
        };
      } catch (err) {
        console.error('Failed to create WebSocket for terminal tab', err);
      }
    },
    [cwd]
  );

  // Initialize first socket connection on mount and cleanup on unmount
  useEffect(() => {
    connectSocket('term-1', 'powershell');

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
  }, [connectSocket]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Auto-scroll output log on new lines
  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab?.history]);

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
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    connectSocket(newId, shell);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();

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
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, history: [] } : t))
    );
  };

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTabId) return;
    const cmd = inputVal.trim();
    if (!cmd) return;

    const ws = socketsRef.current[activeTabId];
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'input', data: `${cmd}\r\n` }));
    }

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              history: [...t.history, `$ ${cmd}`],
            }
          : t
      )
    );
    setInputVal('');
  };

  return (
    <div className="flex flex-col h-full font-mono text-xs text-zinc-300 bg-zinc-950">
      {/* 1. Header Row (Same row as TERMINALS) */}
      <header className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/80 bg-zinc-900/50 select-none shrink-0">
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
              className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-colors bg-purple-900/40 text-purple-300 border border-purple-700/50 hover:bg-purple-800/50 hover:text-purple-100 shrink-0"
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
                className="p-1 text-zinc-300 hover:text-zinc-100 transition-colors"
                title="New Terminal (PowerShell)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                data-testid="shell-dropdown-btn"
                className="p-1 text-zinc-400 hover:text-zinc-200 border-l border-zinc-700/60 transition-colors"
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
                  className="w-full text-left px-3 py-1.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
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
                  className="w-full text-left px-3 py-1.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
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
                  className="w-full text-left px-3 py-1.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  <span>Command Prompt</span>
                </button>
              </div>
            )}

            {/* Clear Output Button */}
            <button
              onClick={handleClearTerminal}
              disabled={tabs.length === 0}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors rounded hover:bg-zinc-800/60 disabled:opacity-30 disabled:pointer-events-none shrink-0 ml-0.5"
              title="Clear Terminal Output"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Dock position toggle + Minimize */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            data-testid="dock-toggle-button"
            onClick={toggleDock}
            title={isBottom ? 'Dock to right' : 'Dock to bottom'}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            {isBottom ? <PanelRight className="w-3.5 h-3.5" /> : <PanelBottom className="w-3.5 h-3.5" />}
          </button>
          <button
            title="Minimize"
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* 2. Dedicated Tab Bar Row (Styled like TabBar.tsx) */}
      <div className="flex items-center h-8 bg-zinc-900/40 border-b border-zinc-800 px-1 select-none overflow-x-auto no-scrollbar shrink-0">
        {tabs.length === 0 ? (
          <div className="px-3 text-xs text-zinc-500 italic">No open terminals</div>
        ) : (
          tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isAgy = tab.shell === 'agy';

            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                title={`${tab.name} (${tab.shortName})`}
                className={clsx(
                  'group flex items-center gap-2 px-3 h-full min-h-[32px] border-r border-zinc-800 text-xs font-medium cursor-pointer transition-colors max-w-[200px] shrink-0 whitespace-nowrap',
                  isActive
                    ? isAgy
                      ? 'bg-zinc-950 text-purple-300 border-b-2 border-b-purple-500 font-semibold'
                      : 'bg-zinc-950 text-zinc-100 border-b-2 border-b-indigo-500 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                )}
              >
                {isAgy ? (
                  <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                ) : (
                  <Terminal className="w-3 h-3 text-indigo-400 shrink-0" />
                )}
                <span className="hidden sm:inline">{tab.name}</span>
                <span className="sm:hidden">{tab.shortName}</span>
                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="p-0.5 rounded hover:text-red-400 hover:bg-zinc-800 transition-colors ml-1"
                  title="Close terminal"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded font-medium border border-zinc-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Terminal</span>
            </button>
            <button
              onClick={() => handleAddTab('agy', 'AI (agy)', 'agy')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-900/40 hover:bg-purple-800/50 text-purple-300 text-xs rounded font-medium border border-purple-700/50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Launch AI (agy)</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto space-y-1 p-3 font-mono text-xs select-text"
          onClick={() => inputRef.current?.focus()}
        >
          {activeTab?.history.map((line, idx) => {
            const isCommand = line.startsWith('$');
            if (isCommand) {
              return (
                <div key={idx} className="leading-relaxed break-all text-indigo-400 font-bold">
                  {line}
                </div>
              );
            }

            const segments = parseAnsi(line);
            return (
              <div key={idx} className="leading-relaxed break-all text-zinc-300 min-h-[1.2em]">
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
          <div ref={bottomRef} />
        </div>
      )}

      {/* 4. Terminal Input Bar */}
      <form
        onSubmit={handleCommand}
        className="flex items-center gap-2 px-3 py-2 border-t border-zinc-800/80 bg-zinc-950 shrink-0"
      >
        <span className="text-emerald-400 font-semibold select-none">
          {tabs.length === 0
            ? '---'
            : activeTab?.shell === 'agy'
            ? 'agy@local:~$ '
            : activeTab?.shell === 'bash'
            ? 'bash@local:~$ '
            : activeTab?.shell === 'cmd'
            ? 'cmd@local:~$ '
            : 'aico@local:~$ '}
        </span>
        <input
          ref={inputRef}
          type="text"
          disabled={tabs.length === 0}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={
            tabs.length === 0
              ? 'Open a terminal tab to enter commands...'
              : "Type command ('help', 'status', 'test', 'dir')..."
          }
          className="flex-1 bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-600 font-mono text-xs disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={tabs.length === 0}
          className="p-1 rounded text-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-40"
          title="Run"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
