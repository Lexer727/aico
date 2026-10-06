import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TerminalConsole } from '../src/components/terminal/TerminalConsole';

// @verifies spec-ft-core-webui-shell::REQ-009
// @verifies spec-ft-core-webui-shell::REQ-010
describe('TerminalConsole Component', () => {
  it('renders terminal session and supports adding new terminal tabs', () => {
    render(<TerminalConsole />);

    expect(screen.getByText('Terminal 1')).toBeInTheDocument();
    expect(screen.getByText(/Embedded Axum Server active/i)).toBeInTheDocument();

    // Click Add Terminal Tab
    const addTabBtn = screen.getByTestId('add-terminal-tab');
    fireEvent.click(addTabBtn);

    expect(screen.getByText('Terminal 2')).toBeInTheDocument();
  });

  it('executes commands and displays response in active terminal', () => {
    render(<TerminalConsole />);

    const input = screen.getByPlaceholderText(/Type command/i);
    fireEvent.change(input, { target: { value: 'help' } });
    fireEvent.submit(input.closest('form')!);

    expect(screen.getByText(/Available commands:/i)).toBeInTheDocument();
  });
});
