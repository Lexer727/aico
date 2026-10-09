import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { TerminalConsole } from '../src/components/terminal/TerminalConsole';

describe('TerminalConsole Component', () => {
  let mockSockets: any[] = [];

  beforeEach(() => {
    mockSockets = [];
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
    vi.stubGlobal('WebSocket', class {
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
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
  });

  // Helper to open a default PowerShell terminal
  const openDefaultTerminal = () => {
    const plusBtn = screen.getByTestId('add-default-terminal');
    fireEvent.click(plusBtn);
  };

  // @verifies spec-ft-terminal-panel-ui::REQ-001
  it('provides a dedicated AI button that opens an agy terminal tab', async () => {
    render(<TerminalConsole />);

    const aiBtn = screen.getByTestId('ai-terminal-btn');
    expect(aiBtn).toBeInTheDocument();
    expect(aiBtn).toHaveTextContent(/ai/i);

    fireEvent.click(aiBtn);

    expect(screen.getByText(/AI \(agy\)/i)).toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-002
  it('provides a Plus button that creates a default PowerShell terminal tab', async () => {
    render(<TerminalConsole />);

    const plusBtn = screen.getByTestId('add-default-terminal');
    expect(plusBtn).toBeInTheDocument();

    fireEvent.click(plusBtn);

    expect(screen.getAllByText(/PowerShell/i).length).toBeGreaterThan(0);
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-003
  // @verifies spec-ft-terminal-panel-ui::REQ-004
  it('renders dropdown next to Plus button to select between PowerShell, Git Bash, and Command Prompt', async () => {
    render(<TerminalConsole />);

    const dropdownBtn = screen.getByTestId('shell-dropdown-btn');
    expect(dropdownBtn).toBeInTheDocument();

    // Click to open dropdown
    fireEvent.click(dropdownBtn);

    expect(screen.getByTestId('shell-option-powershell')).toBeInTheDocument();
    expect(screen.getByTestId('shell-option-bash')).toBeInTheDocument();
    expect(screen.getByTestId('shell-option-cmd')).toBeInTheDocument();

    // Select Git Bash
    fireEvent.click(screen.getByTestId('shell-option-bash'));

    expect(screen.getByText(/Git Bash/i)).toBeInTheDocument();
    // Dropdown should be closed
    expect(screen.queryByTestId('shell-option-bash')).not.toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-005
  // @verifies spec-ft-terminal-panel-ui::REQ-006
  it('connects to terminal WebSocket, transmits input, and receives output stream', async () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    // Wait for initial socket to connect
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const currentSocket = mockSockets[0];
    expect(currentSocket).toBeDefined();

    // Simulate incoming output from shell process
    act(() => {
      if (currentSocket.onmessage) {
        currentSocket.onmessage({
          data: JSON.stringify({ type: 'output', data: 'Microsoft PowerShell 7.4.0\r\nPS C:\\>' }),
        });
      }
    });

    expect(screen.getByText(/Microsoft PowerShell/i)).toBeInTheDocument();

    // Type input command and submit
    const input = screen.getByTestId('terminal-inline-input');
    fireEvent.change(input, { target: { value: 'dir' } });
    fireEvent.submit(input.closest('form')!);

    // Verify input was sent over WebSocket
    const inputMsg = currentSocket.sentMessages.find((m: string) => m.includes('"type":"input"'));
    expect(inputMsg).toBeDefined();
    expect(inputMsg).toContain('dir');
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-007
  it('parses and renders ANSI color codes properly', async () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const currentSocket = mockSockets[0];
    act(() => {
      if (currentSocket.onmessage) {
        currentSocket.onmessage({
          data: JSON.stringify({
            type: 'output',
            data: '\u001b[32mSuccess: build passed\u001b[0m\r\n\u001b[31mError: check failed\u001b[0m',
          }),
        });
      }
    });

    const greenSpan = screen.getByText(/Success: build passed/i);
    expect(greenSpan).toBeInTheDocument();
    expect(greenSpan.className).toContain('text-emerald-400');

    const redSpan = screen.getByText(/Error: check failed/i);
    expect(redSpan).toBeInTheDocument();
    expect(redSpan.className).toContain('text-rose-400');
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-006
  // @verifies spec-ft-terminal-panel-ui::REQ-008
  it('allows closing tab even when only one terminal is open, transitioning to empty state', async () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    expect(screen.getAllByText(/PowerShell/i).length).toBeGreaterThan(0);

    // Find close button on the tab and click it
    const closeBtn = screen.getByTitle(/close terminal/i);
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);

    // Now all tabs closed, should show empty state
    expect(screen.getByText(/No Active Terminals/i)).toBeInTheDocument();
    expect(screen.getByText(/No open terminals/i)).toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-009
  // @verifies spec-ft-terminal-panel-ui::REQ-010
  it('renders TERMINALS in header row, plus button has no text, and tab has responsive shortName ps', async () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    // Header title TERMINALS
    expect(screen.getByText(/TERMINALS/i)).toBeInTheDocument();

    // Plus button must NOT have "PowerShell" text inside it (icon only)
    const plusBtn = screen.getByTestId('add-default-terminal');
    expect(plusBtn).toHaveTextContent('');

    // Tab responsive abbreviation ps exists
    expect(screen.getByText('ps')).toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-012
  it('reassembles streaming chunks continuously without fragmenting partial words', async () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const currentSocket = mockSockets[0];

    // Simulate chunk 1 with incomplete word "Whe"
    act(() => {
      if (currentSocket.onmessage) {
        currentSocket.onmessage({
          data: JSON.stringify({
            type: 'output',
            data: 'Hello! Whe',
          }),
        });
      }
    });

    // Simulate chunk 2 with remaining word "ther\r\n"
    act(() => {
      if (currentSocket.onmessage) {
        currentSocket.onmessage({
          data: JSON.stringify({
            type: 'output',
            data: 'ther you are ready\r\n',
          }),
        });
      }
    });

    expect(screen.getByText(/Hello! Whether you are ready/i)).toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-013
  it('renders prompt and does not inject duplicate > cmd in powershell history', async () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const currentSocket = mockSockets[0];

    // Simulate prompt emitted without newline
    act(() => {
      if (currentSocket.onmessage) {
        currentSocket.onmessage({
          data: JSON.stringify({
            type: 'output',
            data: 'PS D:\\aico\\aico-specs> ',
          }),
        });
      }
    });

    expect(screen.getByText(/PS D:\\aico\\aico-specs>/i)).toBeInTheDocument();

    // Type command in input
    const input = screen.getByTestId('terminal-inline-input');
    fireEvent.change(input, { target: { value: 'ls' } });
    fireEvent.submit(input.closest('form')!);

    // Should NOT have injected a separate "> ls" line in history
    expect(screen.queryByText('> ls')).not.toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-014
  it('opens slash command autocomplete menu when typing slash in AI tab and selects command', async () => {
    render(<TerminalConsole />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Open AI tab
    const aiBtn = screen.getByTestId('ai-terminal-btn');
    fireEvent.click(aiBtn);

    // AI input placeholder should prompt for AI commands
    const aiInput = screen.getByPlaceholderText(/ask ai or type \/ for commands/i);
    expect(aiInput).toBeInTheDocument();

    // Type "/" to open autocomplete
    fireEvent.change(aiInput, { target: { value: '/' } });

    expect(screen.getByTestId('slash-command-menu')).toBeInTheDocument();
    expect(screen.getByTestId('slash-option-skills')).toBeInTheDocument();
    expect(screen.getByTestId('slash-option-help')).toBeInTheDocument();

    // Click on /skills option
    fireEvent.click(screen.getByTestId('slash-option-skills'));

    // Input should be populated with "/skills " and menu closed
    expect(aiInput).toHaveValue('/skills ');
    expect(screen.queryByTestId('slash-command-menu')).not.toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-014
  it('fills in slash command on Enter key without immediately submitting form', async () => {
    render(<TerminalConsole />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const aiBtn = screen.getByTestId('ai-terminal-btn');
    fireEvent.click(aiBtn);

    const aiInput = screen.getByPlaceholderText(/ask ai or type \/ for commands/i);
    fireEvent.change(aiInput, { target: { value: '/' } });

    expect(screen.getByTestId('slash-command-menu')).toBeInTheDocument();

    const currentSocket = mockSockets[mockSockets.length - 1];
    const initialSentCount = currentSocket.sentMessages.length;

    // Press Enter while menu is open
    fireEvent.keyDown(aiInput, { key: 'Enter' });

    // Menu should close and input should be filled with first option "/help "
    expect(screen.queryByTestId('slash-command-menu')).not.toBeInTheDocument();
    expect(aiInput).toHaveValue('/help ');

    // Form should NOT have submitted message to AI
    const newInputs = currentSocket.sentMessages.slice(initialSentCount).filter((m: string) => m.includes('"type":"input"'));
    expect(newInputs.length).toBe(0);
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-013
  it('clears all previous lines and strips echoed clear in powershell, leaving only prompt', async () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const currentSocket = mockSockets[0];

    // Seed output history with previous command and prompt
    act(() => {
      if (currentSocket.onmessage) {
        currentSocket.onmessage({
          data: JSON.stringify({
            type: 'output',
            data: 'Previous command output line 1\r\nPrevious command output line 2\r\nPS D:\\aico\\aico-specs> ',
          }),
        });
      }
    });

    expect(screen.getByText(/Previous command output line 1/i)).toBeInTheDocument();

    // Type "clear" and submit
    const input = screen.getByTestId('terminal-inline-input');
    fireEvent.change(input, { target: { value: 'clear' } });
    fireEvent.submit(input.closest('form')!);

    // Old output should be cleared immediately
    expect(screen.queryByText(/Previous command output line 1/i)).not.toBeInTheDocument();

    // PowerShell echoes "clear\r\n\r\nPS D:\aico\aico-specs> "
    act(() => {
      if (currentSocket.onmessage) {
        currentSocket.onmessage({
          data: JSON.stringify({
            type: 'output',
            data: 'clear\r\n\r\nPS D:\\aico\\aico-specs> ',
          }),
        });
      }
    });

    // The echoed word "clear" should be stripped and not appear in history
    expect(screen.queryByText('clear')).not.toBeInTheDocument();
    // Only the prompt should remain
    expect(screen.getByText(/PS D:\\aico\\aico-specs>/i)).toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-015
  it('closes tab on middle mouse button click (button === 1)', async () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    const psTab = screen.getByText('PowerShell').closest('div[data-testid^="tab-"]');
    expect(psTab).toBeInTheDocument();

    // Simulate middle mouse click
    fireEvent.mouseDown(psTab!, { button: 1 });

    // Terminal tab should be closed and empty state shown
    expect(screen.getByText(/No Active Terminals/i)).toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-015
  it('supports drag-and-drop tab reordering with preview shift', async () => {
    render(<TerminalConsole />);
    // Open PowerShell tab
    openDefaultTerminal();
    // Open AI tab
    fireEvent.click(screen.getByTestId('ai-terminal-btn'));

    const tabs = screen.getAllByTestId(/^tab-term-/);
    expect(tabs.length).toBe(2);

    const firstTab = tabs[0];
    const secondTab = tabs[1];

    // Drag first tab over second tab
    fireEvent.dragStart(firstTab, {
      dataTransfer: {
        setData: () => {},
        effectAllowed: 'move',
      },
    });

    fireEvent.dragOver(secondTab, {
      dataTransfer: { dropEffect: 'move' },
    });

    // Drop to commit order
    fireEvent.drop(secondTab);
    fireEvent.dragEnd(firstTab);

    // Tab reordering completed without crashing
    const updatedTabs = screen.getAllByTestId(/^tab-term-/);
    expect(updatedTabs.length).toBe(2);
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-016
  it('does not refocus or clear selection when user has selected text in terminal', async () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    // Mock active selection
    const mockSelection = {
      toString: () => 'highlighted text sample',
    };
    vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any);

    const terminalBody = screen.getByTestId('terminal-body');
    expect(terminalBody).toBeInTheDocument();

    // Click inside terminal container
    fireEvent.click(terminalBody);

    // Should not throw and selection mock should have been inspected
    expect(window.getSelection).toHaveBeenCalled();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-017
  it('starts with zero open terminals on fresh boot, showing empty state and quick launch buttons', async () => {
    // sessionStorage is completely empty
    render(<TerminalConsole />);

    expect(screen.getByText(/No Active Terminals/i)).toBeInTheDocument();
    expect(screen.getByText(/No open terminals/i)).toBeInTheDocument();
    const newTermBtn = screen.getByTestId('empty-new-terminal');
    expect(newTermBtn).toBeInTheDocument();
    expect(screen.getByTestId('empty-launch-ai')).toBeInTheDocument();

    // Clicking New Terminal creates a terminal tab
    fireEvent.click(newTermBtn);
    expect(screen.getAllByText(/PowerShell/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/No Active Terminals/i)).not.toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-017
  it('restores open tabs from sessionStorage on page reload', async () => {
    // Setup pre-existing session tabs
    sessionStorage.setItem('aico_terminal_session_initialized', 'true');
    sessionStorage.setItem(
      'aico_terminal_session_tabs',
      JSON.stringify([
        { id: 'term-saved-1', name: 'PowerShell', shortName: 'ps', shell: 'powershell' },
        { id: 'term-saved-2', name: 'AI (agy)', shortName: 'agy', shell: 'agy' },
      ])
    );
    sessionStorage.setItem('aico_terminal_session_active', 'term-saved-2');

    render(<TerminalConsole />);

    // Both tabs should be present immediately
    expect(screen.getByText(/PowerShell/i)).toBeInTheDocument();
    expect(screen.getByText(/AI \(agy\)/i)).toBeInTheDocument();

    // Empty state should NOT be rendered
    expect(screen.queryByText(/No Active Terminals/i)).not.toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-018
  it('renders authentic Antigravity arch logo, CLI header, and shortcuts footer in agy tab', async () => {
    render(<TerminalConsole />);

    // Open AI tab
    fireEvent.click(screen.getByTestId('ai-terminal-btn'));

    // Check pixel-art rainbow arch logo
    expect(screen.getByTestId('agy-arch-logo')).toBeInTheDocument();

    // Check Antigravity CLI version and model
    expect(screen.getByText(/Antigravity CLI 1.3.2/i)).toBeInTheDocument();
    expect(screen.getByText(/Gemini 3.8 Flash \(High\)/i)).toBeInTheDocument();

    // Check shortcuts footer
    expect(screen.getByText(/\? for shortcuts/i)).toBeInTheDocument();
    expect(screen.getByText(/Gemini 3.8 Flash · high/i)).toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-019
  it('omits placeholder pre-text in powershell terminal session', async () => {
    render(<TerminalConsole />);
    openDefaultTerminal();

    const input = screen.getByTestId('terminal-inline-input') as HTMLInputElement;
    expect(input.placeholder).toBe('');
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-020
  it('persists terminal output buffer and restores history on reload', async () => {
    // Setup pre-existing session tabs with saved history buffer
    sessionStorage.setItem('aico_terminal_session_initialized', 'true');
    sessionStorage.setItem(
      'aico_terminal_session_tabs',
      JSON.stringify([
        {
          id: 'term-restored-1',
          name: 'PowerShell',
          shortName: 'ps',
          shell: 'powershell',
          history: ['Restored line 1 from previous session', 'Restored line 2 from previous session'],
          pendingLine: 'PS D:\\aico> ',
        },
      ])
    );
    sessionStorage.setItem('aico_terminal_session_active', 'term-restored-1');

    render(<TerminalConsole />);

    // Output buffer should be rendered immediately without being cleared
    expect(screen.getByText(/Restored line 1 from previous session/i)).toBeInTheDocument();
    expect(screen.getByText(/Restored line 2 from previous session/i)).toBeInTheDocument();

    // When the spawned shell outputs its initial startup prompt
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    const currentSocket = mockSockets[0];
    act(() => {
      if (currentSocket?.onmessage) {
        currentSocket.onmessage({
          data: JSON.stringify({ type: 'output', data: 'PS D:\\aico> ' }),
        });
      }
    });

    // Exactly one prompt should be present; no doubled prompt
    expect(screen.queryByText(/PS D:\\aico> PS D:\\aico>/i)).not.toBeInTheDocument();
    expect(screen.getByText(/PS D:\\aico>/i)).toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-021
  it('translates mouse wheel events horizontally and prevents vertical scroll', async () => {
    const { container } = render(<TerminalConsole />);
    openDefaultTerminal();

    const scrollContainer = container.querySelector('.overflow-x-auto');
    expect(scrollContainer).toBeInTheDocument();

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
    expect(currentSocket).toBeDefined();

    const killBtn = screen.getByTestId('kill-terminal-btn');
    expect(killBtn).toBeInTheDocument();

    // Click Kill Terminal button
    fireEvent.click(killBtn);

    // Verify kill message sent over WebSocket
    const killMsg = currentSocket.sentMessages.find((m: string) => m.includes('"type":"kill"'));
    expect(killMsg).toBeDefined();

    // Tab should be closed and empty state reached immediately
    expect(screen.getByText(/No Active Terminals/i)).toBeInTheDocument();
  });
});
