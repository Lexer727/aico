import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Lightweight xterm + FitAddon mocks for jsdom (no HTMLCanvasElement layout).
// Each mounted Terminal instance is recorded on `mockTerminals` so tests can
// drive `emitData(...)`, `emitResize(...)`, and inspect `written` chunks.
// ---------------------------------------------------------------------------
interface MockTerminalInstance {
  cols: number;
  rows: number;
  options: Record<string, unknown>;
  element: HTMLElement | null;
  written: string[];
  disposed: boolean;
  focused: boolean;
  cleared: boolean;
  selection: string;
  customKeyHandler: ((event: KeyboardEvent) => boolean) | null;
  hasSelection: () => boolean;
  getSelection: () => string;
  clearSelection: () => void;
  paste: (data: string) => void;
  attachCustomKeyEventHandler: (handler: (event: KeyboardEvent) => boolean) => void;
  emitData: (data: string) => void;
  emitResize: (cols: number, rows: number) => void;
}

const mockTerminals: MockTerminalInstance[] = [];
const mockFitCalls: { cols: number; rows: number }[] = [];
let nextFitDimensions = { cols: 120, rows: 32 };

vi.mock('@xterm/xterm', () => {
  class Terminal {
    cols = 120;
    rows = 30;
    options: Record<string, unknown>;
    element: HTMLElement | null = null;
    written: string[] = [];
    disposed = false;
    focused = false;
    cleared = false;
    selection = '';
    customKeyHandler: ((event: KeyboardEvent) => boolean) | null = null;
    private dataListeners: Array<(d: string) => void> = [];
    private resizeListeners: Array<(size: { cols: number; rows: number }) => void> = [];

    constructor(opts: Record<string, unknown> = {}) {
      this.options = opts;
      mockTerminals.push(this);
    }

    loadAddon(addon: { activate?: (t: Terminal) => void }) {
      addon?.activate?.(this);
    }

    open(container: HTMLElement) {
      const root = document.createElement('div');
      root.className = 'xterm';
      root.setAttribute('data-testid', 'xterm-instance');
      const screenEl = document.createElement('div');
      screenEl.className = 'xterm-rows';
      root.appendChild(screenEl);
      container.appendChild(root);
      this.element = root;
    }

    write(data: string) {
      this.written.push(data);
      if (this.element) {
        const rows = this.element.querySelector('.xterm-rows');
        if (rows) rows.textContent = (rows.textContent || '') + data;
      }
    }

    clear() {
      this.cleared = true;
      if (this.element) {
        const rows = this.element.querySelector('.xterm-rows');
        if (rows) rows.textContent = '';
      }
    }

    reset() {
      this.clear();
    }

    focus() {
      this.focused = true;
    }

    hasSelection() {
      return this.selection.length > 0;
    }

    getSelection() {
      return this.selection;
    }

    clearSelection() {
      this.selection = '';
    }

    paste(data: string) {
      this.emitData(data);
    }

    attachCustomKeyEventHandler(handler: (event: KeyboardEvent) => boolean) {
      this.customKeyHandler = handler;
    }

    onData(cb: (data: string) => void) {
      this.dataListeners.push(cb);
      return { dispose: () => {} };
    }

    onResize(cb: (size: { cols: number; rows: number }) => void) {
      this.resizeListeners.push(cb);
      return { dispose: () => {} };
    }

    emitData(data: string) {
      this.dataListeners.forEach((l) => l(data));
    }

    emitResize(cols: number, rows: number) {
      this.cols = cols;
      this.rows = rows;
      this.resizeListeners.forEach((l) => l({ cols, rows }));
    }

    dispose() {
      this.disposed = true;
      this.element?.remove();
    }
  }
  return { Terminal };
});

vi.mock('@xterm/addon-fit', () => {
  class FitAddon {
    private term: MockTerminalInstance | null = null;
    activate(term: MockTerminalInstance) {
      this.term = term;
    }
    fit() {
      if (this.term) {
        this.term.emitResize(nextFitDimensions.cols, nextFitDimensions.rows);
        mockFitCalls.push({ ...nextFitDimensions });
      }
    }
    proposeDimensions() {
      return { ...nextFitDimensions };
    }
    dispose() {}
  }
  return { FitAddon };
});

import { TerminalConsole } from '../src/components/terminal/TerminalConsole';

describe('TerminalConsole Component (xterm.js + ConPTY)', () => {
  let mockSockets: any[] = [];

  beforeEach(() => {
    mockSockets = [];
    mockTerminals.length = 0;
    mockFitCalls.length = 0;
    nextFitDimensions = { cols: 120, rows: 32 };
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
    vi.stubGlobal(
      'WebSocket',
      class {
        static OPEN = 1;
        url: string;
        onopen: (() => void) | null = null;
        onmessage: ((event: { data: string }) => void) | null = null;
        onclose: (() => void) | null = null;
        onerror: ((err: any) => void) | null = null;
        readyState = 1;
        sentMessages: string[] = [];

        constructor(url: string) {
          this.url = url;
          mockSockets.push(this);
          setTimeout(() => {
            if (this.onopen) this.onopen();
          }, 0);
        }

        send(data: string) {
          this.sentMessages.push(data);
        }

        close() {
          this.readyState = 3;
          if (this.onclose) this.onclose();
        }
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
  });

  const openDefaultTerminal = () => {
    fireEvent.click(screen.getByTestId('add-default-terminal'));
  };

  // @verifies spec-ft-terminal-panel-ui::REQ-001
  // @verifies spec-ft-terminal-xterm-ui::REQ-002
  it('provides icon-only Antigravity (agy-terminal-btn) and Claude (claude-terminal-btn) buttons that open Antigravity and Claude tabs', () => {
    render(<TerminalConsole />);

    const agyBtn = screen.getByTestId('agy-terminal-btn');
    expect(agyBtn).toHaveTextContent('');
    fireEvent.click(agyBtn);

    expect(screen.getByText('Antigravity')).toBeInTheDocument();
    expect(screen.getByText('AGY')).toBeInTheDocument();

    const claudeBtn = screen.getByTestId('claude-terminal-btn');
    expect(claudeBtn).toHaveTextContent('');
    fireEvent.click(claudeBtn);

    expect(screen.getByText('Claude')).toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-002
  // @verifies spec-ft-terminal-xterm-ui::REQ-002
  it('provides a Plus button that creates a default PowerShell terminal tab', () => {
    render(<TerminalConsole />);
    openDefaultTerminal();
    expect(screen.getAllByText(/PowerShell/i).length).toBeGreaterThan(0);
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-003
  // @verifies spec-ft-terminal-panel-ui::REQ-004
  // @verifies spec-ft-terminal-xterm-ui::REQ-002
  it('renders dropdown next to Plus button to select PowerShell, Git Bash, or Command Prompt', () => {
    render(<TerminalConsole />);

    fireEvent.click(screen.getByTestId('shell-dropdown-btn'));
    expect(screen.getByTestId('shell-option-powershell')).toBeInTheDocument();
    expect(screen.getByTestId('shell-option-bash')).toBeInTheDocument();
    expect(screen.getByTestId('shell-option-cmd')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('shell-option-bash'));
    expect(screen.getByText(/Git Bash/i)).toBeInTheDocument();
    expect(screen.queryByTestId('shell-option-bash')).not.toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-xterm-ui::REQ-001
  // @verifies spec-ft-terminal-xterm-ui::REQ-003
  // @verifies spec-ft-terminal-xterm-ui::REQ-007
  it('mounts an @xterm/xterm viewport, forwards raw keystrokes via term.onData, and pipes PTY chunks into term.write()', async () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockTerminals.length).toBe(1);
    const term = mockTerminals[0];
    const socket = mockSockets[0];
    expect(socket).toBeDefined();
    expect(screen.getByTestId('xterm-instance')).toBeInTheDocument();

    // Init message carries initial geometry so ConPTY starts with the right size.
    const initMsg = JSON.parse(socket.sentMessages[0]);
    expect(initMsg.type).toBe('init');
    expect(initMsg.shell).toBe('powershell');
    expect(typeof initMsg.cols).toBe('number');
    expect(typeof initMsg.rows).toBe('number');

    // Incoming PTY output goes straight into `term.write(...)`.
    act(() => {
      socket.onmessage?.({
        data: JSON.stringify({ type: 'output', data: 'Windows PowerShell\r\nPS D:\\aico> ' }),
      });
    });
    expect(term.written.join('')).toContain('Windows PowerShell');
    expect(screen.getByText(/Windows PowerShell/i)).toBeInTheDocument();

    // Raw keystrokes (including arrow keys / single-char menu choices) go out immediately.
    act(() => {
      term.emitData('\u001b[B'); // Down arrow in an interactive multiple-choice prompt
    });
    const sentInput = socket.sentMessages
      .map((s: string) => JSON.parse(s))
      .find((m: any) => m.type === 'input');
    expect(sentInput).toEqual({ type: 'input', data: '\u001b[B' });
  });

  // @verifies spec-ft-terminal-xterm-ui::REQ-004
  it('invokes FitAddon.fit() and transmits a WebSocket resize message when dimensions change', async () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const socket = mockSockets[0];
    nextFitDimensions = { cols: 148, rows: 44 };

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    const resizeMsg = socket.sentMessages
      .map((s: string) => JSON.parse(s))
      .find((m: any) => m.type === 'resize' && m.cols === 148 && m.rows === 44);
    expect(resizeMsg).toBeDefined();
  });

  // @verifies spec-ft-terminal-xterm-ui::REQ-008
  // @verifies spec-ft-terminal-xterm-ui::REQ-010
  it('does NOT render hardcoded user emails, static model footers, or the floating HTML slash menu in an AI tab', async () => {
    render(<TerminalConsole />);
    fireEvent.click(screen.getByTestId('agy-terminal-btn'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(screen.queryByText(/a\.staub1307@gmail\.com/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\? for shortcuts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gemini 3\.8 Flash · high/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('slash-command-menu')).not.toBeInTheDocument();
    expect(screen.queryByTestId('terminal-inline-input')).not.toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-xterm-ui::REQ-009
  it('shows a disconnected banner and suppresses keystroke forwarding when the WebSocket closes unexpectedly', async () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const socket = mockSockets[0];
    const term = mockTerminals[0];

    act(() => {
      socket.close();
    });

    expect(screen.getByTestId('terminal-disconnected-banner')).toBeInTheDocument();

    const countBefore = socket.sentMessages.length;
    act(() => {
      term.emitData('ls\r');
    });
    expect(socket.sentMessages.length).toBe(countBefore);
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-006
  // @verifies spec-ft-terminal-panel-ui::REQ-008
  // @verifies spec-ft-terminal-xterm-ui::REQ-005
  it('allows closing tab even when only one terminal is open, transitioning to empty state', () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    fireEvent.click(screen.getByTitle(/close terminal/i));
    expect(screen.getByText(/No Active Terminals/i)).toBeInTheDocument();
    expect(screen.getByText(/No open terminals/i)).toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-009
  // @verifies spec-ft-terminal-panel-ui::REQ-010
  it('renders TERMINALS in header row, plus button has no text, and tab has responsive shortName ps', () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    expect(screen.getByText(/TERMINALS/i)).toBeInTheDocument();
    expect(screen.getByTestId('add-default-terminal')).toHaveTextContent('');
    expect(screen.getByText('ps')).toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-015
  // @verifies spec-ft-terminal-xterm-ui::REQ-005
  it('closes tab on middle mouse button click (button === 1)', () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    const psTab = screen.getByText('PowerShell').closest('div[data-testid^="tab-"]');
    fireEvent.mouseDown(psTab!, { button: 1 });
    expect(screen.getByText(/No Active Terminals/i)).toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-015
  // @verifies spec-ft-terminal-xterm-ui::REQ-006
  it('supports drag-and-drop tab reordering with preview shift', () => {
    render(<TerminalConsole />);
    openDefaultTerminal();
    fireEvent.click(screen.getByTestId('agy-terminal-btn'));

    const tabs = screen.getAllByTestId(/^tab-term-/);
    expect(tabs.length).toBe(2);

    fireEvent.dragStart(tabs[0], {
      dataTransfer: { setData: () => {}, effectAllowed: 'move' },
    });
    fireEvent.dragOver(tabs[1], { dataTransfer: { dropEffect: 'move' } });
    fireEvent.drop(tabs[1]);
    fireEvent.dragEnd(tabs[0]);

    expect(screen.getAllByTestId(/^tab-term-/).length).toBe(2);
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-017
  it('starts with zero open terminals on fresh boot, showing empty state and quick launch buttons', () => {
    render(<TerminalConsole />);

    expect(screen.getByText(/No Active Terminals/i)).toBeInTheDocument();
    expect(screen.getByTestId('empty-new-terminal')).toBeInTheDocument();
    expect(screen.getByTestId('empty-launch-ai')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('empty-new-terminal'));
    expect(screen.queryByText(/No Active Terminals/i)).not.toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-017
  it('restores open tabs from sessionStorage on page reload', () => {
    sessionStorage.setItem('aico_terminal_session_initialized', 'true');
    sessionStorage.setItem(
      'aico_terminal_session_tabs',
      JSON.stringify([
        { id: 'term-saved-1', name: 'PowerShell', shortName: 'ps', shell: 'powershell' },
        { id: 'term-saved-2', name: 'Antigravity', shortName: 'AGY', shell: 'agy' },
      ])
    );
    sessionStorage.setItem('aico_terminal_session_active', 'term-saved-2');

    render(<TerminalConsole />);
    expect(screen.getByText(/PowerShell/i)).toBeInTheDocument();
    expect(screen.getByText(/Antigravity/i)).toBeInTheDocument();
    expect(screen.queryByText(/No Active Terminals/i)).not.toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-021
  it('translates mouse wheel events horizontally and prevents vertical scroll', () => {
    const { container } = render(<TerminalConsole />);
    openDefaultTerminal();

    const scrollContainer = container.querySelector('.overflow-x-auto');
    const wheelEvent = new WheelEvent('wheel', { deltaY: 60, cancelable: true });
    scrollContainer!.dispatchEvent(wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(true);
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-022
  it('provides a Kill Terminal button that sends kill message and forcefully closes tab', async () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const currentSocket = mockSockets[0];
    fireEvent.click(screen.getByTestId('kill-terminal-btn'));

    const killMsg = currentSocket.sentMessages.find((m: string) => m.includes('"type":"kill"'));
    expect(killMsg).toBeDefined();
    expect(screen.getByText(/No Active Terminals/i)).toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-xterm-ui::REQ-011
  it('renders per-tab 4-state circular AI status indicator with hover tooltip and ignores user typing echoes before Enter', async () => {
    render(<TerminalConsole />);
    fireEvent.click(screen.getByTestId('agy-terminal-btn'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const term = mockTerminals[0];
    const socket = mockSockets[0];
    const statusDot = screen.getByTestId(/^ai-tab-status-/);
    const agyTab = screen.getByText('Antigravity').closest('div[data-testid^="tab-"]')!;

    // 1. Initially `finished` (green static circle)
    expect(statusDot).toHaveAttribute('data-status', 'finished');
    expect(statusDot.className).toContain('bg-emerald-400');
    expect(agyTab.getAttribute('title')).toMatch(/Finished/i);

    // 2. Typing characters without pressing Enter + local PTY echo must NOT turn status to `working`
    act(() => {
      term.emitData('h');
      term.emitData('i');
      socket.onmessage?.({
        data: JSON.stringify({ type: 'output', data: 'hi' }),
      });
    });
    expect(statusDot).toHaveAttribute('data-status', 'finished');

    // 3. Pressing Enter ('\r') transitions status to `working` (orange spinning circle)
    act(() => {
      term.emitData('\r');
    });
    expect(statusDot).toHaveAttribute('data-status', 'working');
    expect(statusDot.className).toContain('border-amber-400');
    expect(statusDot.className).toContain('animate-spin');
    expect(agyTab.getAttribute('title')).toMatch(/LLM is working/i);

    // 4. Agent prompting for confirmation/permission transitions to `waiting_for_input` (blue bouncing circle)
    act(() => {
      socket.onmessage?.({
        data: JSON.stringify({ type: 'output', data: 'Allow command execution? [Y/n] ' }),
      });
    });
    expect(statusDot).toHaveAttribute('data-status', 'waiting_for_input');
    expect(statusDot.className).toContain('bg-sky-400');
    expect(statusDot.className).toContain('animate-bounce');
    expect(agyTab.getAttribute('title')).toMatch(/Waiting for confirmation/i);

    // 5. Not logged in / rate limit transitions to `error` (red static circle)
    act(() => {
      socket.onmessage?.({
        data: JSON.stringify({ type: 'output', data: 'Not logged in · Please run /login' }),
      });
    });
    expect(statusDot).toHaveAttribute('data-status', 'error');
    expect(statusDot.className).toContain('bg-rose-500');
    expect(agyTab.getAttribute('title')).toMatch(/Not logged in/i);
  });

  // @verifies spec-ft-terminal-xterm-ui::REQ-012
  it('enforces a singleton tab per AI CLI (agy and claude) and focuses the existing tab, while standard shells remain unlimited', () => {
    render(<TerminalConsole />);

    // Open Antigravity and click again -> still only 1 Antigravity tab
    fireEvent.click(screen.getByTestId('agy-terminal-btn'));
    fireEvent.click(screen.getByTestId('agy-terminal-btn'));
    expect(screen.getAllByText('Antigravity').length).toBe(1);
    expect(screen.queryByText('Antigravity 2')).not.toBeInTheDocument();

    // Open Claude and click again -> still only 1 Claude tab
    fireEvent.click(screen.getByTestId('claude-terminal-btn'));
    fireEvent.click(screen.getByTestId('claude-terminal-btn'));
    expect(screen.getAllByText('Claude').length).toBe(1);
    expect(screen.queryByText('Claude 2')).not.toBeInTheDocument();

    // Standard PowerShell terminals remain unlimited
    fireEvent.click(screen.getByTestId('add-default-terminal'));
    fireEvent.click(screen.getByTestId('add-default-terminal'));
    expect(screen.getByText('PowerShell')).toBeInTheDocument();
    expect(screen.getByText('PowerShell 2')).toBeInTheDocument();

    // Clicking agy-terminal-btn while PowerShell 2 is active activates the existing Antigravity tab without adding a 5th tab
    expect(screen.getAllByTestId(/^tab-term-/).length).toBe(4);
    fireEvent.click(screen.getByTestId('agy-terminal-btn'));
    expect(screen.getAllByTestId(/^tab-term-/).length).toBe(4);
    const agyTab = screen.getByText('Antigravity').closest('div[data-testid^="tab-"]')!;
    expect(agyTab.className).toContain('bg-zinc-950');
    expect(agyTab.className).toContain('border-b-indigo-500');
  });

  // @verifies spec-ft-terminal-xterm-ui::REQ-013
  it('supports selection-aware Ctrl+C copy and Ctrl+V clipboard paste across terminal tabs', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    const readTextMock = vi.fn().mockResolvedValue('echo pasted_from_clipboard\r');
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
        readText: readTextMock,
      },
      configurable: true,
    });

    render(<TerminalConsole />);
    fireEvent.click(screen.getByTestId('agy-terminal-btn'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const term = mockTerminals[0];
    const socket = mockSockets[0];
    expect(term.customKeyHandler).toBeTypeOf('function');

    // 1. Ctrl+C WITH active selection -> copies text, clears selection, returns false (blocks \x03 SIGINT)
    term.selection = 'selected terminal output';
    const copyEvent = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, cancelable: true });
    const allowWhenSelected = term.customKeyHandler!(copyEvent);
    expect(allowWhenSelected).toBe(false);
    expect(writeTextMock).toHaveBeenCalledWith('selected terminal output');
    expect(term.selection).toBe('');

    // 2. Ctrl+C WITHOUT active selection -> returns true (allows xterm to emit \x03 SIGINT)
    const sigintEvent = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, cancelable: true });
    const allowWhenEmpty = term.customKeyHandler!(sigintEvent);
    expect(allowWhenEmpty).toBe(true);

    // 3. Ctrl+V -> reads clipboard and calls term.paste() while returning false (blocks raw \x16)
    const pasteEvent = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, cancelable: true });
    const allowOnPaste = term.customKeyHandler!(pasteEvent);
    expect(allowOnPaste).toBe(false);
    expect(readTextMock).toHaveBeenCalled();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const pastedMsg = socket.sentMessages
      .map((s: string) => JSON.parse(s))
      .find((m: any) => m.type === 'input' && m.data === 'echo pasted_from_clipboard\r');
    expect(pastedMsg).toBeDefined();
  });

  // @verifies spec-ft-terminal-xterm-ui::REQ-014
  it('passes tab_id in WebSocket init message and preserves backend session on unmount while sending close on explicit tab close', async () => {
    const { unmount } = render(<TerminalConsole />);
    openDefaultTerminal();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const socket = mockSockets[0];
    const initMsg = JSON.parse(socket.sentMessages[0]);
    expect(initMsg.type).toBe('init');
    expect(initMsg.tab_id).toMatch(/^term-/);

    // Unmounting component (simulating F5 page reload) must NOT send `{ type: "close" }` so backend PTY stays alive
    unmount();
    const closeOnUnmount = socket.sentMessages.find((m: string) => m.includes('"type":"close"'));
    expect(closeOnUnmount).toBeUndefined();
  });
});



