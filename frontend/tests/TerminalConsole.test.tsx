import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { TerminalConsole } from '../src/components/terminal/TerminalConsole';

describe('TerminalConsole Component', () => {
  let mockSockets: any[] = [];

  beforeEach(() => {
    mockSockets = [];
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
  });

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
    const input = screen.getByPlaceholderText(/type command/i);
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
});
