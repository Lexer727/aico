import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Plus, X, CornerDownLeft, Sparkles, ChevronDown, Trash2 } from 'lucide-react';

export type ShellType = 'powershell' | 'bash' | 'cmd' | 'agy';

export interface TerminalTab {
  id: string;
  name: string;
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
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'term-1', name: 'PowerShell', shell: 'powershell', history: [] },
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

  const handleAddTab = (shell: ShellType, baseName: string) => {
    const existingSameShell = tabs.filter((t) => t.shell === shell);
    const count = existingSameShell.length + 1;
    const name = count === 1 ? baseName : `${baseName} ${count}`;
    const newId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newTab: TerminalTab = {
      id: newId,
      name,
      shell,
      history: [],
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    connectSocket(newId, shell);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;

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
      setActiveTabId(remaining[0].id);
    }
  };

  const handleClearTerminal = () => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, history: [] } : t))
    );
  };

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="flex flex-col h-full font-mono text-xs text-zinc-300">
      {/* Terminal Tabs Strip */}
      <div className="flex items-center gap-1 border-b border-zinc-800 pb-2 mb-2 select-none overflow-x-auto no-scrollbar relative">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isAgy = tab.shell === 'agy';

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-2 px-2.5 py-1 rounded cursor-pointer transition-colors text-xs shrink-0 ${
                isActive
                  ? isAgy
                    ? 'bg-purple-950/60 text-purple-200 font-semibold border border-purple-700/60 shadow-sm'
                    : 'bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              {isAgy ? (
                <Sparkles className="w-3 h-3 text-purple-400" />
              ) : (
                <Terminal className="w-3 h-3 text-indigo-400" />
              )}
              <span>{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="hover:text-red-400 p-0.5 rounded transition-colors ml-1"
                  title="Close tab"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}

        {/* Actions Group */}
        <div className="flex items-center gap-1 ml-1 relative shrink-0" ref={dropdownRef}>
          {/* Dedicated AI Button */}
          <button
            onClick={() => handleAddTab('agy', 'AI (agy)')}
            data-testid="ai-terminal-btn"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors bg-purple-900/30 text-purple-300 border border-purple-700/50 hover:bg-purple-800/40 hover:text-purple-100"
            title="Launch Antigravity AI Terminal (agy)"
          >
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>AI</span>
          </button>

          {/* Plus (PowerShell) + Dropdown Selector */}
          <div className="flex items-center rounded bg-zinc-800/80 border border-zinc-700/60 hover:border-zinc-600 transition-colors">
            <button
              onClick={() => handleAddTab('powershell', 'PowerShell')}
              data-testid="add-default-terminal"
              className="flex items-center gap-1 px-2 py-1 text-zinc-300 hover:text-zinc-100 text-xs transition-colors"
              title="New Terminal (PowerShell)"
            >
              <Plus className="w-3 h-3" />
              <span className="hidden sm:inline">PowerShell</span>
            </button>

            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              data-testid="shell-dropdown-btn"
              className="px-1.5 py-1 text-zinc-400 hover:text-zinc-200 border-l border-zinc-700/60 transition-colors"
              title="Select Shell Type"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Shell Dropdown Menu */}
          {dropdownOpen && (
            <div
              className="absolute top-full left-14 mt-1 w-44 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1 z-50 text-xs"
              role="menu"
            >
              <button
                onClick={() => {
                  handleAddTab('powershell', 'PowerShell');
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
                  handleAddTab('bash', 'Git Bash');
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
                  handleAddTab('cmd', 'Command Prompt');
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
        </div>

        {/* Clear Button on far right */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleClearTerminal}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors rounded hover:bg-zinc-800/60"
            title="Clear Terminal Output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output Log */}
      <div
        className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-xs select-text"
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

      {/* Terminal Input Bar */}
      <form onSubmit={handleCommand} className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
        <span className="text-emerald-400 font-semibold select-none">
          {activeTab?.shell === 'agy'
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
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Type command ('help', 'status', 'test', 'dir')..."
          className="flex-1 bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-600 font-mono text-xs"
        />
        <button
          type="submit"
          className="p-1 rounded text-zinc-500 hover:text-zinc-200 transition-colors"
          title="Run"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
