import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  Plus,
  X,
  ChevronDown,
  Square,
  PanelRight,
  PanelBottom,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  WifiOff,
} from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useDockStore } from '../../stores/useDockStore';
import { useWebSocket } from '../../context/WebSocketContext';
import { getWindowId } from '../../stores/useTabStore';
import { useTerminalTitleSync } from '../../hooks/useTerminalTitleSync';
import clsx from 'clsx';

export type ShellType = 'powershell' | 'bash' | 'cmd' | 'agy' | 'claude';

export type AiTabStatusState = 'working' | 'waiting_for_input' | 'finished' | 'error';

export interface AiTabStatus {
  state: AiTabStatusState;
  reason: string;
}

export interface TerminalTab {
  id: string;
  name: string;
  shortName: string;
  shell: ShellType;
}

export interface TerminalConsoleProps {
  cwd?: string;
  onWorkspaceRefresh?: () => void;
  isMobile?: boolean;
  targetWindowId?: string;
}

// @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-002
// @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-004
// @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-007
// @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-3::REQ-005
export const stripAnsi = (input: string): string =>
  // eslint-disable-next-line no-control-regex
  input.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\x1b\][^\x07]*(\x07|\x1b\\)/g, '');

// @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-002
// @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-004
// @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-007
export function detectGateOrWaitingState(text: string): boolean {
  if (!text) return false;
  const clean = stripAnsi(text);
  const patterns = [
    /\[aico gate/i,
    /waiting for confirmation/i,
    /awaiting confirmation/i,
    /awaiting spec sign-off/i,
    /halt for implementation confirmation/i,
    /post-spec confirmation/i,
    /proceed with implementation\?/i,
    /reply to confirm/i,
    /please review and confirm/i,
    /\[y\/n\]/i,
    /\(y\/n\)/i,
    /allow .* to/i,
    /allow once/i,
    /approve\?/i,
    /do you want to proceed/i,
    /use arrow keys/i,
    /select an option/i,
    /press enter to confirm/i,
  ];
  return patterns.some((p) => p.test(clean));
}

// @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-002
// @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-004
// @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-007
export function analyzeAiOutputChunk(
  rawChunk: string,
  recentBuffer: string = ''
): 'working' | 'waiting_for_input' | 'finished' | null {
  const cleanChunk = stripAnsi(rawChunk);
  const combined = (recentBuffer + cleanChunk).slice(-2000);

  // 1. Check for Gate or Waiting for input
  if (detectGateOrWaitingState(combined)) {
    return 'waiting_for_input';
  }

  // 2. Active LLM working / spinner / streaming output
  const hasSpinnerOrThinking = /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏✻]|thinking|working\.\.\.|generating/i.test(cleanChunk);
  if (hasSpinnerOrThinking) {
    return 'working';
  }

  return null;
}

// @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-3::REQ-005
export function triggerDesktopPopupNotification(
  tabLabel: string,
  nextStatus: 'finished' | 'waiting_for_input'
) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (window.localStorage.getItem('aico-desktop-notifications-enabled') === 'false') {
        return;
      }
    }

    const title = nextStatus === 'waiting_for_input' ? 'AICO: Waiting for Input' : 'AICO: Task Finished';
    const message = `${tabLabel} is ${nextStatus === 'waiting_for_input' ? 'waiting for your confirmation' : 'done'}.`;

    // 1. Backend OS notification endpoint
    fetch('/api/v1/notifications/popup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        message,
        status: nextStatus,
      }),
    }).catch(() => {
      // Ignore network errors if backend notification service is unavailable
    });

    // 2. Web Notification fallback if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }
  } catch {
    // Silent fallback
  }
}

const AntigravityIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="agy-arch-grad" x1="2" y1="20" x2="22" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="28%" stopColor="#34d399" />
        <stop offset="50%" stopColor="#fb923c" />
        <stop offset="72%" stopColor="#ec4899" />
        <stop offset="100%" stopColor="#6366f1" />
      </linearGradient>
    </defs>
    <path
      d="M12 3L4 20h4.2l1.7-4h4.2l1.7 4H20L12 3zm-1.1 9.5L12 9.6l1.1 2.9h-2.2z"
      fill="url(#agy-arch-grad)"
    />
  </svg>
);

const ClaudeIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M12 2.25v19.5M2.25 12h19.5M5.1 5.1l13.8 13.8M18.9 5.1L5.1 18.9M8.27 3.01l7.46 17.98M15.73 3.01L8.27 20.99M3.01 8.27l17.98 7.46M20.99 8.27L3.01 15.73"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="2.6" fill="currentColor" />
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
        const seenAiShells = new Set<ShellType>();
        const restored: TerminalTab[] = [];
        for (const t of parsed) {
          const shell = t.shell as ShellType;
          if (shell === 'agy' || shell === 'claude') {
            if (seenAiShells.has(shell)) continue;
            seenAiShells.add(shell);
          }
          restored.push({
            id: String(t.id),
            name: String(t.name),
            shortName: String(t.shortName),
            shell,
          });
        }
        return restored;
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

const XTERM_THEME = {
  background: '#09090b',
  foreground: '#e4e4e7',
  cursor: '#e4e4e7',
  cursorAccent: '#09090b',
  selectionBackground: '#3f3f46',
  black: '#18181b',
  red: '#fb7185',
  green: '#34d399',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#f4f4f5',
  brightBlack: '#71717a',
  brightRed: '#fda4af',
  brightGreen: '#6ee7b7',
  brightYellow: '#fcd34d',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#ffffff',
};

interface XtermSessionHandle {
  term: Terminal;
  fit: FitAddon;
  container: HTMLDivElement;
}

// @implements ft-core-webui-shell::TASK-CORE-006-5::REQ-009
// @implements ft-core-webui-shell::TASK-CORE-006-9::REQ-010
// @implements ft-core-webui-shell::TASK-CORE-006-9::REQ-011
// @implements ft-terminal-panel-ui::TASK-TERM-002-7::REQ-001
// @implements ft-terminal-panel-ui::TASK-TERM-002-1::REQ-002
// @implements ft-terminal-panel-ui::TASK-TERM-002-1::REQ-003
// @implements ft-terminal-panel-ui::TASK-TERM-002-1::REQ-004
// @implements ft-terminal-panel-ui::TASK-TERM-002-2::REQ-005
// @implements ft-terminal-panel-ui::TASK-TERM-002-2::REQ-006
// @implements ft-terminal-panel-ui::TASK-TERM-002-6::REQ-008
// @implements ft-terminal-panel-ui::TASK-TERM-002-5::REQ-009
// @implements ft-terminal-panel-ui::TASK-TERM-002-6::REQ-010
// @implements ft-terminal-panel-ui::TASK-TERM-002-11::REQ-015
// @implements ft-terminal-panel-ui::TASK-TERM-002-13::REQ-017
// @implements ft-terminal-panel-ui::TASK-TERM-002-17::REQ-021
// @implements ft-terminal-panel-ui::TASK-TERM-002-18::REQ-022
// @implements ft-terminal-xterm-ui::TASK-XTERM-005::REQ-001
// @implements ft-terminal-xterm-ui::TASK-XTERM-006::REQ-002
// @implements ft-terminal-xterm-ui::TASK-XTERM-005::REQ-003
// @implements ft-terminal-xterm-ui::TASK-XTERM-005::REQ-004
// @implements ft-terminal-xterm-ui::TASK-XTERM-005::REQ-005
// @implements ft-terminal-xterm-ui::TASK-XTERM-002::REQ-006
// @implements ft-terminal-xterm-ui::TASK-XTERM-003::REQ-007
// @implements ft-terminal-xterm-ui::TASK-XTERM-004::REQ-008
// @implements ft-terminal-xterm-ui::TASK-XTERM-003::REQ-009
// @implements ft-terminal-xterm-ui::TASK-XTERM-004::REQ-010
// @implements ft-terminal-xterm-ui::TASK-XTERM-007::REQ-011
// @implements ft-terminal-xterm-ui::TASK-XTERM-008::REQ-012
// @implements ft-terminal-xterm-ui::TASK-XTERM-009::REQ-013
// @implements ft-terminal-xterm-ui::TASK-XTERM-009::REQ-014
// @implements ft-terminal-xterm-ui::TASK-XTERM-012::REQ-015
export const TerminalConsole: React.FC<TerminalConsoleProps> = ({
  cwd,
  onWorkspaceRefresh,
  isMobile = false,
  targetWindowId,
}) => {
  const { position, toggleDock } = useDockStore();
  const { status, sendMessage, lastMessage } = useWebSocket();
  const isBottom = isMobile ? true : position === 'bottom';

  const [tabs, setTabs] = useState<TerminalTab[]>(getInitialTabs);
  const [activeTabId, setActiveTabId] = useState<string>(() => getInitialActiveTab(tabs));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [disconnectedTabs, setDisconnectedTabs] = useState<Record<string, boolean>>({});
  const [aiTabStatuses, setAiTabStatuses] = useState<Record<string, AiTabStatus>>({});

  // @implements spec-ft-terminal-tab-title-status::TASK-TITLE-003::REQ-006
  useTerminalTitleSync(tabs, aiTabStatuses);

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

  const onWorkspaceRefreshRef = useRef(onWorkspaceRefresh);
  useEffect(() => {
    onWorkspaceRefreshRef.current = onWorkspaceRefresh;
  }, [onWorkspaceRefresh]);

  const viewportHostRef = useRef<HTMLDivElement>(null);
  const xtermsRef = useRef<Record<string, XtermSessionHandle>>({});
  const socketsRef = useRef<Record<string, WebSocket>>({});
  const initializedRef = useRef<Record<string, boolean>>({});
  const intentionalCloseRef = useRef<Record<string, boolean>>({});
  const awaitingAiResponseRef = useRef<Record<string, boolean>>({});
  const lastUserKeystrokeAtRef = useRef<Record<string, number>>({});
  const recentOutputRef = useRef<Record<string, string>>({});
  const workingTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const waitingGateLockRef = useRef<Record<string, boolean>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || (tabs.length > 0 ? tabs[0] : null);

  // Persist open tab descriptors across reloads.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(SESSION_TABS_KEY, JSON.stringify(tabs));
      sessionStorage.setItem(SESSION_ACTIVE_KEY, activeTabId);
    } catch {
      // ignore
    }
  }, [tabs, activeTabId]);

  // @implements ft-terminal-xterm-ui::TASK-XTERM-012::REQ-015
  // Desktop: Broadcast terminal tabs and active tab to companion clients periodically and on tab change
  useEffect(() => {
    if (isMobile) return;
    const winId = getWindowId();
    const broadcastTerminals = () => {
      sendMessage('companion_terminals_sync', {
        windowId: winId,
        tabs,
        activeTabId,
      });
    };
    broadcastTerminals();
    const interval = setInterval(broadcastTerminals, 3000);
    return () => clearInterval(interval);
  }, [isMobile, tabs, activeTabId, sendMessage]);

  // @implements ft-terminal-xterm-ui::TASK-XTERM-012::REQ-015
  // Desktop: Respond to companion requests and remote active tab selections
  useEffect(() => {
    if (isMobile || !lastMessage || typeof lastMessage !== 'object') return;
    const msg = lastMessage as { topic?: string; payload?: unknown };
    if (msg.topic === 'request_companion_terminals') {
      try {
        const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
        const winId = getWindowId();
        if (!payload?.targetWindowId || payload.targetWindowId === winId) {
          sendMessage('companion_terminals_sync', {
            windowId: winId,
            tabs,
            activeTabId,
          });
        }
      } catch {
        // ignore
      }
    } else if (msg.topic === 'companion_terminals_update') {
      try {
        const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
        const winId = getWindowId();
        if (payload?.targetWindowId === winId) {
          if (payload?.killTabId) {
            disposeTabResources(payload.killTabId, 'kill');
          } else if (payload?.closeTabId) {
            disposeTabResources(payload.closeTabId, 'close');
          }
          if (Array.isArray(payload.tabs)) {
            setTabs(payload.tabs);
          }
          if (payload?.activeTabId !== undefined) {
            setActiveTabId(payload.activeTabId);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [isMobile, lastMessage, tabs, activeTabId, sendMessage]);

  // @implements ft-terminal-xterm-ui::TASK-XTERM-012::REQ-015
  // Mobile Companion: Request terminal state from targeted desktop window on connect or window switch
  useEffect(() => {
    if (!isMobile || !targetWindowId || status !== 'connected') return;
    sendMessage('request_companion_terminals', { targetWindowId });
  }, [isMobile, targetWindowId, status, sendMessage]);

  // @implements ft-terminal-xterm-ui::TASK-XTERM-012::REQ-015
  // Mobile Companion: Mirror terminal tabs and active tab from target desktop window
  useEffect(() => {
    if (!isMobile || !lastMessage || typeof lastMessage !== 'object') return;
    const msg = lastMessage as { topic?: string; payload?: unknown };
    if (msg.topic === 'companion_terminals_sync') {
      try {
        const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
        if (payload && (!targetWindowId || payload.windowId === targetWindowId)) {
          if (Array.isArray(payload.tabs)) {
            setTabs(payload.tabs);
          }
          if (payload.activeTabId) {
            setActiveTabId(payload.activeTabId);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [isMobile, lastMessage, targetWindowId]);

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
    scrollContainerRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
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

  const scheduleWorkingToFinished = useCallback((tabId: string, delayMs = 1200) => {
    if (workingTimerRef.current[tabId]) {
      clearTimeout(workingTimerRef.current[tabId]);
    }
    workingTimerRef.current[tabId] = setTimeout(() => {
      const wasWorking = awaitingAiResponseRef.current[tabId];
      awaitingAiResponseRef.current[tabId] = false;

      // REQ-004 & REQ-007: check if waitingGateLockRef is active OR if detectGateOrWaitingState is true
      const recent = recentOutputRef.current[tabId] || '';
      const isGate = waitingGateLockRef.current[tabId] || detectGateOrWaitingState(recent);

      if (isGate) {
        waitingGateLockRef.current[tabId] = true;
        setAiTabStatuses((prev) => {
          const cur = prev[tabId];
          if (!cur || cur.state !== 'waiting_for_input') {
            const tab = tabs.find((t) => t.id === tabId);
            triggerDesktopPopupNotification(tab?.name || 'AI Terminal', 'waiting_for_input');
            return {
              ...prev,
              [tabId]: { state: 'waiting_for_input', reason: 'Waiting for confirmation / input' },
            };
          }
          return prev;
        });
        return;
      }

      setAiTabStatuses((prev) => {
        const cur = prev[tabId];
        if (!cur || cur.state === 'working') {
          const tab = tabs.find((t) => t.id === tabId);
          triggerDesktopPopupNotification(tab?.name || 'AI Terminal', 'finished');
          return {
            ...prev,
            [tabId]: { state: 'finished', reason: 'Finished — ready for prompt' },
          };
        }
        return prev;
      });
      if (wasWorking) {
        onWorkspaceRefreshRef.current?.();
      }
    }, delayMs);
  }, [tabs]);

  const handleAiOutputChunk = useCallback(
    (tabId: string, rawChunk: string) => {
      const clean = stripAnsi(rawChunk);
      if (!clean.trim()) return;

      const combined = ((recentOutputRef.current[tabId] || '') + clean).slice(-2000);
      recentOutputRef.current[tabId] = combined;

      // 1. Error / Not logged in / Out of tokens checks (Red static circle)
      if (/not logged in|please run \/login|auth login|authentication failed|login required/i.test(combined)) {
        if (workingTimerRef.current[tabId]) clearTimeout(workingTimerRef.current[tabId]);
        awaitingAiResponseRef.current[tabId] = false;
        waitingGateLockRef.current[tabId] = false;
        setAiTabStatuses((prev) => ({
          ...prev,
          [tabId]: { state: 'error', reason: 'Not logged in' },
        }));
        return;
      }

      if (/rate limit|quota exceeded|out of tokens|insufficient_quota|429 too many requests/i.test(combined)) {
        if (workingTimerRef.current[tabId]) clearTimeout(workingTimerRef.current[tabId]);
        awaitingAiResponseRef.current[tabId] = false;
        waitingGateLockRef.current[tabId] = false;
        setAiTabStatuses((prev) => ({
          ...prev,
          [tabId]: { state: 'error', reason: 'Out of tokens / rate limit' },
        }));
        return;
      }

      if (/\[Process Error\]|unhandled error|fatal error/i.test(combined)) {
        if (workingTimerRef.current[tabId]) clearTimeout(workingTimerRef.current[tabId]);
        awaitingAiResponseRef.current[tabId] = false;
        waitingGateLockRef.current[tabId] = false;
        setAiTabStatuses((prev) => ({
          ...prev,
          [tabId]: { state: 'error', reason: 'Error in AI session' },
        }));
        return;
      }

      // 2. Waiting for user permission / confirmation / AICO Gate (Blue bouncing circle) (REQ-002, REQ-004)
      if (detectGateOrWaitingState(combined)) {
        if (workingTimerRef.current[tabId]) clearTimeout(workingTimerRef.current[tabId]);
        awaitingAiResponseRef.current[tabId] = false;
        waitingGateLockRef.current[tabId] = true;
        setAiTabStatuses((prev) => {
          const cur = prev[tabId];
          if (!cur || cur.state !== 'waiting_for_input') {
            const tab = tabs.find((t) => t.id === tabId);
            triggerDesktopPopupNotification(tab?.name || 'AI Terminal', 'waiting_for_input');
            return {
              ...prev,
              [tabId]: { state: 'waiting_for_input', reason: 'Waiting for confirmation / input' },
            };
          }
          return prev;
        });
        return;
      }

      // 3. If locked in waiting_for_input, ignore trailing TUI redraws/spinners until user types (REQ-007)
      if (waitingGateLockRef.current[tabId]) {
        return;
      }

      // 4. Ignore local keystroke echo when the user is simply typing at the prompt before pressing Enter
      const sinceKeystroke = Date.now() - (lastUserKeystrokeAtRef.current[tabId] || 0);
      if (!awaitingAiResponseRef.current[tabId] && sinceKeystroke < 250) {
        return;
      }

      // 5. Active LLM working / spinner / streaming output (Orange spinning circle)
      const analyzed = analyzeAiOutputChunk(rawChunk, recentOutputRef.current[tabId] || '');
      const hasSpinnerOrThinking = /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏✻]|thinking|working\.\.\.|generating/i.test(clean);
      if (awaitingAiResponseRef.current[tabId] || hasSpinnerOrThinking || analyzed === 'working') {
        setAiTabStatuses((prev) => ({
          ...prev,
          [tabId]: { state: 'working', reason: 'LLM is working' },
        }));
        scheduleWorkingToFinished(tabId, 1200);
      }
    },
    [tabs, scheduleWorkingToFinished]
  );

  // Mount (or retrieve) the xterm instance for `tabId` and wire its WebSocket.
  const ensureSession = useCallback(
    (tabId: string, shell: ShellType) => {
      const host = viewportHostRef.current;
      if (!host) return;

      const isAiShell = shell === 'agy' || shell === 'claude';
      if (isAiShell) {
        setAiTabStatuses((prev) =>
          prev[tabId]
            ? prev
            : { ...prev, [tabId]: { state: 'finished', reason: 'Finished — ready for prompt' } }
        );
      }

      let handle = xtermsRef.current[tabId];
      if (!handle) {
        const container = document.createElement('div');
        container.className = 'w-full h-full';
        container.dataset.tabId = tabId;
        host.appendChild(container);

        const term = new Terminal({
          cursorBlink: true,
          fontSize: 12,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          scrollback: 5000,
          convertEol: false,
          theme: XTERM_THEME,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(container);
        try {
          fit.fit();
        } catch {
          // Container may have zero size in headless tests.
        }

        // @implements ft-terminal-xterm-ui::TASK-XTERM-009::REQ-013
        term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
          if (event.type !== 'keydown') return true;
          const isMod = event.ctrlKey || event.metaKey;
          if (!isMod || event.altKey) return true;

          const key = event.key.toLowerCase();
          if (key === 'c') {
            if (term.hasSelection()) {
              const selected = term.getSelection();
              if (selected && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(selected).catch(() => {});
              }
              term.clearSelection();
              event.preventDefault();
              return false;
            }
            if (event.shiftKey) {
              event.preventDefault();
              return false;
            }
            return true;
          }

          if (key === 'v') {
            event.preventDefault();
            event.stopPropagation();
            if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
              navigator.clipboard
                .readText()
                .then((text) => {
                  if (text) {
                    term.paste(text);
                  }
                })
                .catch(() => {});
            }
            return false;
          }

          return true;
        });

        term.onData((data) => {
          waitingGateLockRef.current[tabId] = false;
          if (isAiShell) {
            if (data.includes('\r') || data.includes('\n')) {
              awaitingAiResponseRef.current[tabId] = true;
              recentOutputRef.current[tabId] = '';
              setAiTabStatuses((prev) => ({
                ...prev,
                [tabId]: { state: 'working', reason: 'LLM is working' },
              }));
              scheduleWorkingToFinished(tabId, 1500);
            } else {
              // User is typing at the prompt — record timestamp so local echo never triggers `working`
              lastUserKeystrokeAtRef.current[tabId] = Date.now();
            }
          }

          const ws = socketsRef.current[tabId];
          if (ws && ws.readyState === 1 && initializedRef.current[tabId]) {
            ws.send(JSON.stringify({ type: 'input', data }));
          }
        });

        term.onResize(({ cols, rows }) => {
          const ws = socketsRef.current[tabId];
          if (ws && ws.readyState === 1 && initializedRef.current[tabId]) {
            ws.send(JSON.stringify({ type: 'resize', cols, rows }));
          }
        });

        handle = { term, fit, container };
        xtermsRef.current[tabId] = handle;
      }

      const existingWs = socketsRef.current[tabId];
      if (existingWs && existingWs.readyState <= 1) return;

      const protocol =
        typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost =
        typeof window !== 'undefined' && window.location.host ? window.location.host : '127.0.0.1:4242';
      const wsUrl = `${protocol}//${wsHost}/api/v1/terminal/ws`;

      try {
        intentionalCloseRef.current[tabId] = false;
        initializedRef.current[tabId] = false;
        const ws = new WebSocket(wsUrl);
        socketsRef.current[tabId] = ws;

        // @implements ft-terminal-xterm-ui::TASK-XTERM-009::REQ-014
        ws.onopen = () => {
          setDisconnectedTabs((prev) => ({ ...prev, [tabId]: false }));
          const currentHandle = xtermsRef.current[tabId];
          try {
            currentHandle?.fit.fit();
          } catch {
            // ignore
          }
          ws.send(
            JSON.stringify({
              type: 'init',
              tab_id: tabId,
              shell,
              cwd: cwdRef.current || undefined,
              cols: currentHandle?.term.cols || 120,
              rows: currentHandle?.term.rows || 30,
            })
          );
          initializedRef.current[tabId] = true;
        };

        ws.onmessage = (event) => {
          const currentHandle = xtermsRef.current[tabId];
          if (!currentHandle) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'output' && typeof msg.data === 'string') {
              currentHandle.term.write(msg.data);
              if (isAiShell) {
                handleAiOutputChunk(tabId, msg.data);
              }
            } else if (msg.type === 'error' && msg.message) {
              currentHandle.term.write(`\r\n\u001b[31m[Process Error] ${msg.message}\u001b[0m\r\n`);
              if (isAiShell) {
                setAiTabStatuses((prev) => ({
                  ...prev,
                  [tabId]: { state: 'error', reason: `Error: ${msg.message}` },
                }));
              }
            } else if (msg.type === 'exit') {
              currentHandle.term.write(
                `\r\n\u001b[90m[Process exited with code ${msg.code ?? 0}]\u001b[0m\r\n`
              );
              if (isAiShell && msg.code && msg.code !== 0) {
                setAiTabStatuses((prev) => ({
                  ...prev,
                  [tabId]: { state: 'error', reason: `Exited with code ${msg.code}` },
                }));
              }
            }
          } catch {
            currentHandle.term.write(String(event.data));
          }
        };

        ws.onclose = () => {
          if (socketsRef.current[tabId] === ws) {
            delete socketsRef.current[tabId];
          }
          if (!intentionalCloseRef.current[tabId]) {
            setDisconnectedTabs((prev) => ({ ...prev, [tabId]: true }));
            if (isAiShell) {
              setAiTabStatuses((prev) => ({
                ...prev,
                [tabId]: { state: 'error', reason: 'Disconnected' },
              }));
            }
          }
        };

        ws.onerror = () => {
          // `onclose` handles user-visible state.
        };
      } catch {
        setDisconnectedTabs((prev) => ({ ...prev, [tabId]: true }));
      }
    },
    [handleAiOutputChunk, scheduleWorkingToFinished]
  );

  // Show only the active tab's xterm container and ensure its session is running.
  useEffect(() => {
    if (activeTab) {
      ensureSession(activeTab.id, activeTab.shell);
    }
    Object.entries(xtermsRef.current).forEach(([id, h]) => {
      const isVisible = activeTab?.id === id;
      h.container.style.display = isVisible ? 'block' : 'none';
      if (isVisible) {
        try {
          h.fit.fit();
          h.term.focus();
        } catch {
          // ignore
        }
      }
    });
  }, [activeTab, ensureSession]);

  // Refit active terminal when the window or dock position changes.
  useEffect(() => {
    const refitActive = () => {
      if (!activeTab) return;
      const h = xtermsRef.current[activeTab.id];
      if (!h) return;
      try {
        h.fit.fit();
      } catch {
        // ignore
      }
    };

    window.addEventListener('resize', refitActive);
    refitActive();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && viewportHostRef.current) {
      observer = new ResizeObserver(refitActive);
      observer.observe(viewportHostRef.current);
    }
    return () => {
      window.removeEventListener('resize', refitActive);
      observer?.disconnect();
    };
  }, [activeTab, position]);

  // Cleanup all sockets and xterm instances on unmount (preserve backend PTY sessions across F5 reload).
  // @implements ft-terminal-xterm-ui::TASK-XTERM-009::REQ-014
  useEffect(() => {
    return () => {
      Object.values(workingTimerRef.current).forEach((t) => clearTimeout(t));
      workingTimerRef.current = {};
      Object.entries(socketsRef.current).forEach(([id, ws]) => {
        intentionalCloseRef.current[id] = true;
        try {
          ws.close();
        } catch {
          // ignore
        }
      });
      socketsRef.current = {};
      Object.values(xtermsRef.current).forEach((h) => {
        try {
          h.term.dispose();
        } catch {
          // ignore
        }
      });
      xtermsRef.current = {};
    };
  }, []);

  // Close shell dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const disposeTabResources = (tabId: string, msgType: 'close' | 'kill') => {
    intentionalCloseRef.current[tabId] = true;
    if (workingTimerRef.current[tabId]) {
      clearTimeout(workingTimerRef.current[tabId]);
      delete workingTimerRef.current[tabId];
    }
    delete awaitingAiResponseRef.current[tabId];
    delete lastUserKeystrokeAtRef.current[tabId];
    delete recentOutputRef.current[tabId];
    const ws = socketsRef.current[tabId];
    if (ws) {
      try {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: msgType }));
        }
        ws.close();
      } catch {
        // ignore
      }
      delete socketsRef.current[tabId];
    }
    const handle = xtermsRef.current[tabId];
    if (handle) {
      try {
        handle.term.dispose();
      } catch {
        // ignore
      }
      handle.container.remove();
      delete xtermsRef.current[tabId];
    }
    setDisconnectedTabs((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    setAiTabStatuses((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
  };

  const handleAddTab = (shell: ShellType, baseName: string, baseShortName: string) => {
    const existingSameShell = tabs.filter((t) => t.shell === shell);
    if ((shell === 'agy' || shell === 'claude') && existingSameShell.length > 0) {
      const existingId = existingSameShell[0].id;
      setActiveTabId(existingId);
      xtermsRef.current[existingId]?.term.focus();
      if (isMobile && targetWindowId) {
        sendMessage('companion_terminals_update', {
          targetWindowId,
          activeTabId: existingId,
        });
      }
      return;
    }
    const count = existingSameShell.length + 1;
    const name = count === 1 ? baseName : `${baseName} ${count}`;
    const shortName = count === 1 ? baseShortName : `${baseShortName} ${count}`;
    const newId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newTab: TerminalTab = { id: newId, name, shortName, shell };
    if (shell === 'agy' || shell === 'claude') {
      setAiTabStatuses((prev) => ({
        ...prev,
        [newId]: { state: 'finished', reason: 'Finished — ready for prompt' },
      }));
    }
    const nextTabs = [...tabs, newTab];
    setTabs(nextTabs);
    setActiveTabId(newId);
    if (isMobile && targetWindowId) {
      sendMessage('companion_terminals_update', {
        targetWindowId,
        tabs: nextTabs,
        activeTabId: newId,
      });
    }
  };

  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    disposeTabResources(tabId, 'close');
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    const nextActiveId = activeTabId === tabId ? (remaining.length > 0 ? remaining[0].id : '') : activeTabId;
    if (activeTabId === tabId) {
      setActiveTabId(nextActiveId);
    }
    if (isMobile && targetWindowId) {
      sendMessage('companion_terminals_update', {
        targetWindowId,
        tabs: remaining,
        activeTabId: nextActiveId,
        closeTabId: tabId,
      });
    }
  };

  const handleKillTerminal = () => {
    if (!activeTab) return;
    const targetId = activeTab.id;
    disposeTabResources(targetId, 'kill');
    const remaining = tabs.filter((t) => t.id !== targetId);
    const nextActiveId = remaining.length > 0 ? remaining[0].id : '';
    setTabs(remaining);
    setActiveTabId(nextActiveId);
    if (isMobile && targetWindowId) {
      sendMessage('companion_terminals_update', {
        targetWindowId,
        tabs: remaining,
        activeTabId: nextActiveId,
        killTabId: targetId,
      });
    }
  };

  const activeDisconnected = Boolean(activeTab && disconnectedTabs[activeTab.id]);

  return (
    <div className="flex flex-col h-full font-mono text-xs text-zinc-300 bg-zinc-950 overflow-hidden select-none">
      {/* 1. Header Row */}
      <header className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/80 bg-zinc-900/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0 text-zinc-300">
            <TerminalIcon className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">
              TERMINALS
            </span>
          </div>

          <div className="h-3.5 w-px bg-zinc-800 mx-0.5 shrink-0" />

          <div className="flex items-center gap-1 relative shrink-0" ref={dropdownRef}>
            {/* Icon-only Antigravity (agy) launcher button */}
            <button
              onClick={() => handleAddTab('agy', 'Antigravity', 'AGY')}
              data-testid="agy-terminal-btn"
              aria-label="Launch Antigravity Terminal"
              className="flex items-center justify-center p-1 rounded transition-colors bg-indigo-950/60 hover:bg-indigo-900/70 text-indigo-300 border border-indigo-700/60 shrink-0 cursor-pointer"
              title="Open Antigravity Terminal (agy)"
            >
              <AntigravityIcon className="w-3.5 h-3.5 shrink-0" />
            </button>

            {/* Icon-only Claude launcher button */}
            <button
              onClick={() => handleAddTab('claude', 'Claude', 'claude')}
              data-testid="claude-terminal-btn"
              aria-label="Launch Claude Terminal"
              className="flex items-center justify-center p-1 rounded transition-colors bg-[#d97757]/15 hover:bg-[#d97757]/30 text-[#e88b6d] border border-[#d97757]/45 shrink-0 cursor-pointer"
              title="Open Claude Terminal (claude)"
            >
              <ClaudeIcon className="w-3.5 h-3.5 shrink-0" />
            </button>

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

            {dropdownOpen && (
              <div
                className="absolute top-full left-16 mt-1 w-44 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1 z-50 text-xs"
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
                  <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />
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
                  <TerminalIcon className="w-3.5 h-3.5 text-emerald-400" />
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
                  <TerminalIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Command Prompt</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleKillTerminal}
              disabled={tabs.length === 0}
              data-testid="kill-terminal-btn"
              className="p-1.5 sm:p-1 min-w-[28px] min-h-[28px] flex items-center justify-center text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors rounded disabled:opacity-30 disabled:pointer-events-none shrink-0 ml-0.5 cursor-pointer"
              title="Kill Terminal (Force Terminate & Close Tab)"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>
        </div>

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

      {/* 2. Tab Strip */}
      <div className="flex items-center h-8 bg-zinc-900/60 border-b border-zinc-800 overflow-hidden shrink-0">
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
              const isAgy = tab.shell === 'agy';
              const isClaude = tab.shell === 'claude';
              const tabIsAi = isAgy || isClaude;
              const isBeingDragged = tab.id === draggedTabId;
              const tabStatus: AiTabStatus = aiTabStatuses[tab.id] || {
                state: 'finished',
                reason: 'Finished — ready for prompt',
              };

              const tabTitle = tabIsAi
                ? `${tab.name} — ${tabStatus.reason}`
                : `${tab.name} (${tab.shortName}) - Drag to reorder, Middle-click to close`;

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
                    if (!draggedTabId) {
                      setActiveTabId(tab.id);
                      if (isMobile && targetWindowId) {
                        sendMessage('companion_terminals_update', {
                          targetWindowId,
                          activeTabId: tab.id,
                        });
                      }
                    }
                  }}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      handleCloseTab(tab.id, e);
                    }
                  }}
                  title={tabTitle}
                  className={clsx(
                    'group flex items-center gap-2 px-3 h-full min-h-[32px] border-r border-zinc-800 text-xs font-medium cursor-pointer transition-all duration-150 ease-out max-w-[220px] shrink-0 whitespace-nowrap',
                    isActive && !isBeingDragged
                      ? isAgy
                        ? 'bg-zinc-950 text-indigo-300 border-b-2 border-b-indigo-500 font-semibold'
                        : isClaude
                          ? 'bg-zinc-950 text-[#e88b6d] border-b-2 border-b-[#d97757] font-semibold'
                          : 'bg-zinc-950 text-zinc-100 border-b-2 border-b-indigo-500 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40',
                    isBeingDragged &&
                      'opacity-60 bg-indigo-950/40 border-2 border-dashed border-indigo-400 text-indigo-300 ring-2 ring-indigo-500/20 scale-[0.98]'
                  )}
                >
                  {isAgy ? (
                    <AntigravityIcon className="w-3.5 h-3.5 shrink-0" />
                  ) : isClaude ? (
                    <ClaudeIcon className="w-3.5 h-3.5 text-[#d97757] shrink-0" />
                  ) : (
                    <TerminalIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  )}
                  <span className="hidden sm:inline truncate">{tab.name}</span>
                  <span className="sm:hidden">{tab.shortName}</span>

                  {/* Per-tab 4-state circular AI status indicator (REQ-011) */}
                  {tabIsAi && (
                    <span
                      data-testid={`ai-tab-status-${tab.id}`}
                      data-status={tabStatus.state}
                      title={tabStatus.reason}
                      className={clsx(
                        'rounded-full shrink-0 inline-block',
                        tabStatus.state === 'working' &&
                          'w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent animate-spin',
                        tabStatus.state === 'waiting_for_input' &&
                          'w-2 h-2 bg-sky-400 animate-bounce',
                        tabStatus.state === 'finished' && 'w-2 h-2 bg-emerald-400',
                        tabStatus.state === 'error' && 'w-2 h-2 bg-rose-500'
                      )}
                    />
                  )}

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

      {/* 3. Disconnected Banner (REQ-009) */}
      {activeDisconnected && (
        <div
          data-testid="terminal-disconnected-banner"
          className="flex items-center justify-between px-3 py-1 bg-rose-950/70 border-b border-rose-800/60 text-rose-200 text-[11px] font-sans shrink-0"
        >
          <span className="flex items-center gap-1.5">
            <WifiOff className="w-3 h-3 text-rose-400" />
            Terminal session disconnected. Input is disabled until reconnected.
          </span>
          <button
            type="button"
            onClick={() => activeTab && ensureSession(activeTab.id, activeTab.shell)}
            className="px-2 py-0.5 rounded bg-rose-900/60 hover:bg-rose-800/80 text-rose-100 font-medium cursor-pointer"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* 4. Terminal Body: xterm Viewport Host or Empty State */}
      {tabs.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
            <TerminalIcon className="w-6 h-6 text-zinc-500" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-1">No Active Terminals</h3>
          <p className="text-xs text-zinc-500 max-w-xs mb-4">
            Open a new terminal shell or launch Antigravity or Claude to run commands.
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
              onClick={() => handleAddTab('agy', 'Antigravity', 'AGY')}
              data-testid="empty-launch-ai"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/70 text-indigo-300 text-xs rounded font-medium border border-indigo-700/60 transition-colors cursor-pointer"
            >
              <AntigravityIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Antigravity</span>
            </button>
            <button
              onClick={() => handleAddTab('claude', 'Claude', 'claude')}
              data-testid="empty-launch-claude"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d97757]/15 hover:bg-[#d97757]/30 text-[#e88b6d] text-xs rounded font-medium border border-[#d97757]/45 transition-colors cursor-pointer"
            >
              <ClaudeIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Claude</span>
            </button>
          </div>
        </div>
      )}

      <div
        ref={viewportHostRef}
        data-testid="terminal-body"
        className={clsx('flex-1 w-full overflow-hidden p-1 bg-zinc-950 select-text', tabs.length === 0 && 'hidden')}
      />
    </div>
  );
};
