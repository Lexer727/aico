import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import React from 'react';
import {
  formatTerminalTitle,
  getGlyphForStatus,
  useTerminalTitleSync,
  BRAILLE_SPINNER_FRAMES,
} from '../src/hooks/useTerminalTitleSync';
import { TerminalConsole, type TerminalTab, type AiTabStatus } from '../src/components/terminal/TerminalConsole';
import fs from 'node:fs';
import path from 'node:path';

// Mock xterm & fit addon for TerminalConsole integration tests
interface MockTerminalInstance {
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
      container.appendChild(root);
      this.element = root;
    }

    write(data: string) {
      this.written.push(data);
    }

    clear() {
      this.cleared = true;
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
    activate() {}
    fit() {}
    proposeDimensions() {
      return { cols: 120, rows: 30 };
    }
    dispose() {}
  }
  return { FitAddon };
});

describe('Browser Tab Title Terminal AI Status Indicator (ft-terminal-tab-title-status)', () => {
  beforeEach(() => {
    document.title = 'AICO';
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
    vi.useRealTimers();
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
  });

  // @verifies spec-ft-terminal-tab-title-status::TASK-TITLE-001::REQ-001
  it('verifies static index.html defines title as AICO', () => {
    const indexPath = path.resolve(__dirname, '../index.html');
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain('<title>AICO</title>');
  });

  // @verifies spec-ft-terminal-tab-title-status::TASK-TITLE-002::REQ-002
  it('returns baseline title "AICO" when no tabs or only standard shells are present', () => {
    expect(formatTerminalTitle([], {})).toBe('AICO');

    const standardTabs: TerminalTab[] = [
      { id: 't1', name: 'PowerShell', shortName: 'PS', shell: 'powershell' },
      { id: 't2', name: 'Git Bash', shortName: 'Bash', shell: 'bash' },
      { id: 't3', name: 'CMD', shortName: 'CMD', shell: 'cmd' },
    ];
    expect(formatTerminalTitle(standardTabs, {})).toBe('AICO');
  });

  // @verifies spec-ft-terminal-tab-title-status::TASK-TITLE-002::REQ-003
  it('maps each AI status state to its respective Unicode glyph', () => {
    expect(getGlyphForStatus(undefined)).toBe('🟢');
    expect(getGlyphForStatus({ state: 'finished', reason: 'ready' })).toBe('🟢');
    expect(getGlyphForStatus({ state: 'waiting_for_input', reason: 'prompt' })).toBe('🔵');
    expect(getGlyphForStatus({ state: 'error', reason: 'rate limit' })).toBe('🔴');

    BRAILLE_SPINNER_FRAMES.forEach((expectedFrame, idx) => {
      expect(getGlyphForStatus({ state: 'working', reason: 'thinking' }, idx)).toBe(expectedFrame);
    });
  });

  // @verifies spec-ft-terminal-tab-title-status::TASK-TITLE-002::REQ-004
  it('formats single and dual AI terminal status with fixed priority (Antigravity first, Claude second)', () => {
    const agyOnly: TerminalTab[] = [
      { id: 'agy-1', name: 'Antigravity', shortName: 'AGY', shell: 'agy' },
    ];
    expect(formatTerminalTitle(agyOnly, { 'agy-1': { state: 'finished', reason: '' } })).toBe('AICO 🟢');
    expect(formatTerminalTitle(agyOnly, { 'agy-1': { state: 'waiting_for_input', reason: '' } })).toBe('AICO 🔵');
    expect(formatTerminalTitle(agyOnly, { 'agy-1': { state: 'error', reason: '' } })).toBe('AICO 🔴');
    expect(formatTerminalTitle(agyOnly, { 'agy-1': { state: 'working', reason: '' } }, 0)).toBe(`AICO ${BRAILLE_SPINNER_FRAMES[0]}`);

    const claudeOnly: TerminalTab[] = [
      { id: 'claude-1', name: 'Claude', shortName: 'Claude', shell: 'claude' },
    ];
    expect(formatTerminalTitle(claudeOnly, { 'claude-1': { state: 'finished', reason: '' } })).toBe('AICO 🟢');

    // Dual AI tabs: Claude placed first in array, but title MUST output AGY then Claude
    const dualTabs: TerminalTab[] = [
      { id: 'claude-1', name: 'Claude', shortName: 'Claude', shell: 'claude' },
      { id: 'agy-1', name: 'Antigravity', shortName: 'AGY', shell: 'agy' },
    ];
    const statuses: Record<string, AiTabStatus> = {
      'agy-1': { state: 'finished', reason: '' },
      'claude-1': { state: 'error', reason: '' },
    };
    expect(formatTerminalTitle(dualTabs, statuses)).toBe('AICO 🟢 🔴');

    statuses['agy-1'] = { state: 'working', reason: '' };
    statuses['claude-1'] = { state: 'waiting_for_input', reason: '' };
    expect(formatTerminalTitle(dualTabs, statuses, 2)).toBe(`AICO ${BRAILLE_SPINNER_FRAMES[2]} 🔵`);
  });

  // @verifies spec-ft-terminal-tab-title-status::TASK-TITLE-002::REQ-005
  it('animates braille spinner at 80ms interval while an AI CLI is working, and cleans up when finished or unmounted', () => {
    vi.useFakeTimers();

    const tabs: TerminalTab[] = [
      { id: 'agy-1', name: 'Antigravity', shortName: 'AGY', shell: 'agy' },
    ];
    const aiStatuses: Record<string, AiTabStatus> = {
      'agy-1': { state: 'working', reason: 'thinking' },
    };

    const { unmount, rerender } = renderHook(
      ({ t, s }: { t: TerminalTab[]; s: Record<string, AiTabStatus> }) => useTerminalTitleSync(t, s),
      { initialProps: { t: tabs, s: aiStatuses } }
    );

    expect(document.title).toBe(`AICO ${BRAILLE_SPINNER_FRAMES[0]}`);

    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(document.title).toBe(`AICO ${BRAILLE_SPINNER_FRAMES[1]}`);

    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(document.title).toBe(`AICO ${BRAILLE_SPINNER_FRAMES[2]}`);

    // Transition to finished
    rerender({
      t: tabs,
      s: { 'agy-1': { state: 'finished', reason: 'done' } },
    });
    expect(document.title).toBe('AICO 🟢');

    // Advancing timers should not alter document.title when finished
    act(() => {
      vi.advanceTimersByTime(160);
    });
    expect(document.title).toBe('AICO 🟢');

    // Unmount hook resets title to AICO
    unmount();
    expect(document.title).toBe('AICO');
  });

  // @verifies spec-ft-terminal-tab-title-status::TASK-TITLE-003::REQ-006
  it('reactively updates document.title when AI terminals are launched and closed in TerminalConsole', async () => {
    render(<TerminalConsole />);

    // Default terminal tab is PowerShell, document.title should be AICO
    expect(document.title).toBe('AICO');

    // Launch Antigravity
    const agyBtn = screen.getByTestId('agy-terminal-btn');
    fireEvent.click(agyBtn);

    // Initial state of Antigravity is finished -> title should be AICO 🟢
    expect(document.title).toBe('AICO 🟢');

    // Launch Claude
    const claudeBtn = screen.getByTestId('claude-terminal-btn');
    fireEvent.click(claudeBtn);

    // Both open -> AICO 🟢 🟢
    expect(document.title).toBe('AICO 🟢 🟢');

    // Close Claude tab (find close button for claude tab)
    const closeBtns = screen.getAllByTitle('Close terminal');
    // There are 3 tabs now: PowerShell, Antigravity, Claude
    // Click close on the last tab (Claude)
    fireEvent.click(closeBtns[closeBtns.length - 1]);

    // Back to Antigravity only
    expect(document.title).toBe('AICO 🟢');
  });

  // @verifies spec-ft-terminal-native-hook-gate-bridge::TASK-HOOK-001-4::REQ-001
  // @verifies spec-ft-terminal-native-hook-gate-bridge::TASK-HOOK-001-4::REQ-004
  // @verifies spec-ft-terminal-native-hook-gate-bridge::TASK-HOOK-001-4::REQ-005
  // @verifies spec-ft-terminal-native-hook-gate-bridge::TASK-HOOK-001-4::REQ-007
  it('updates document.title and tab glyph to blue circle on waiting_for_input', () => {
    const agyTabs: TerminalTab[] = [
      { id: 'tab-agy', name: 'Antigravity', shortName: 'AGY', shell: 'agy' },
    ];
    const statuses: Record<string, AiTabStatus> = {
      'tab-agy': { state: 'waiting_for_input', reason: 'Waiting for interactive choice (ask_question)' },
    };

    const title = formatTerminalTitle(agyTabs, statuses);
    expect(title).toBe('AICO 🔵');
    expect(getGlyphForStatus(statuses['tab-agy'])).toBe('🔵');
  });
});
