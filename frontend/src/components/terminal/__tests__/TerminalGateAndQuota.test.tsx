import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  detectGateOrWaitingState,
  analyzeAiOutputChunk,
  triggerDesktopPopupNotification,
} from '../TerminalConsole';
import { AiStatusMonitor } from '../../layout/AiStatusMonitor';
import { SettingsModal } from '../../settings/SettingsModal';

// @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-1::REQ-006
// @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-002
// @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-004
// @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-007
// @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-3::REQ-005
describe('TerminalGateAndQuota Seam Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-002
  // @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-004
  it('detects [AICO GATE: Waiting for Confirmation] and transitions status to waiting_for_input', () => {
    const rawChunk = '\u001b[33m[AICO GATE: Waiting for Confirmation]\u001b[0m Please review the spec.';
    expect(detectGateOrWaitingState(rawChunk)).toBe(true);

    const state = analyzeAiOutputChunk(rawChunk);
    expect(state).toBe('waiting_for_input');
  });

  // @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-004
  // @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-007
  it('detects gate markers within accumulated buffer even if current chunk is a spinner frame', () => {
    const bufferWithGate = 'The spec has been generated.\n[AICO GATE: Waiting for Confirmation]\n';
    const trailingSpinnerChunk = '⠋ Thinking...';

    // Current chunk alone is working
    expect(analyzeAiOutputChunk(trailingSpinnerChunk, '')).toBe('working');

    // With gate in recent buffer, gate takes precedence and returns waiting_for_input
    expect(analyzeAiOutputChunk(trailingSpinnerChunk, bufferWithGate)).toBe('waiting_for_input');
  });

  // @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-2::REQ-004
  it('detects diverse human review gate phrases case-insensitively', () => {
    expect(detectGateOrWaitingState('Awaiting confirmation from user')).toBe(true);
    expect(detectGateOrWaitingState('Halt for implementation confirmation')).toBe(true);
    expect(detectGateOrWaitingState('Proceed with implementation?')).toBe(true);
    expect(detectGateOrWaitingState('Please review and confirm before we continue')).toBe(true);
    expect(detectGateOrWaitingState('Reply to confirm')).toBe(true);
    expect(detectGateOrWaitingState('Do you want to proceed? [y/n]')).toBe(true);
    expect(detectGateOrWaitingState('Regular output from build task')).toBe(false);
  });

  // @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-3::REQ-005
  it('dispatches native Windows popup notification endpoint on state transition when enabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'sent' }), { status: 200 })
    );

    triggerDesktopPopupNotification('Tab 1 - Gemini', 'waiting_for_input');

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/notifications/popup',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'AICO: Waiting for Input',
          message: 'Tab 1 - Gemini is waiting for your confirmation.',
          status: 'waiting_for_input',
        }),
      })
    );

    triggerDesktopPopupNotification('Tab 1 - Gemini', 'finished');

    expect(fetchSpy).toHaveBeenLastCalledWith(
      '/api/v1/notifications/popup',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'AICO: Task Finished',
          message: 'Tab 1 - Gemini is done.',
          status: 'finished',
        }),
      })
    );
  });

  // @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-3::REQ-005
  it('suppresses desktop notifications when disabled in settings / localStorage', async () => {
    localStorage.setItem('aico-desktop-notifications-enabled', 'false');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    triggerDesktopPopupNotification('Tab 1', 'finished');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-1::REQ-006
  it('renders Weekly and 5h meters for Gemini, but only Weekly meter for Argon where five_hour is null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ai_state: 'inactive',
        account: { email: 'developer@example.com', tier: 'Google AI Pro' },
        providers: [
          {
            id: 'gemini',
            name: 'Gemini',
            cli: 'agy',
            connected: true,
            weekly_remaining_pct: 90,
            weekly_reset: '6d 18h',
            five_hour_remaining_pct: 95,
            five_hour_reset: '4h 30m',
            weekly: { remaining_pct: 90, reset_in: '6d 18h' },
            five_hour: { remaining_pct: 95, reset_in: '4h 30m' },
          },
          {
            id: 'argon',
            name: 'Argon',
            cli: 'agy',
            connected: true,
            weekly_remaining_pct: 80,
            weekly_reset: '5d 12h',
            five_hour_remaining_pct: 100,
            five_hour_reset: '',
            weekly: { remaining_pct: 80, reset_in: '5d 12h' },
            five_hour: null, // REQ-006: Argon has no 5h bucket
          },
        ],
      }),
    } as unknown as Response);

    render(<AiStatusMonitor />);

    // Wait for providers to render
    const geminiRow = await screen.findByTestId('quota-row-gemini');
    const argonRow = await screen.findByTestId('quota-row-argon');

    expect(geminiRow).toBeInTheDocument();
    expect(argonRow).toBeInTheDocument();

    // Gemini row has both Weekly and 5h meters
    expect(geminiRow.textContent).toContain('Gemini');
    expect(geminiRow.textContent).toContain('W');
    expect(geminiRow.textContent).toContain('90%');
    expect(geminiRow.textContent).toContain('5h');
    expect(geminiRow.textContent).toContain('95%');
    expect(screen.getByTestId('five-hour-meter-gemini')).toBeInTheDocument();

    // Argon row has Weekly meter but strictly OMITS 5h meter (REQ-006)
    expect(argonRow.textContent).toContain('Argon');
    expect(argonRow.textContent).toContain('W');
    expect(argonRow.textContent).toContain('80%');
    expect(argonRow.textContent).not.toContain('5h');
    expect(screen.queryByTestId('five-hour-meter-argon')).not.toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-1::REQ-006
  it('strictly omits 5h meter for Argon even with legacy payload where five_hour is undefined and five_hour_remaining_pct is 100', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ai_state: 'inactive',
        account: { email: 'developer@example.com', tier: 'Google AI Pro' },
        providers: [
          {
            id: 'argon',
            name: 'Argon',
            cli: 'agy',
            connected: true,
            weekly_remaining_pct: 75,
            weekly_reset: '4d 2h',
            five_hour_remaining_pct: 100, // legacy payload with five_hour_remaining_pct defined
            // five_hour is omitted (undefined)
          },
        ],
      }),
    } as unknown as Response);

    render(<AiStatusMonitor />);

    const argonRow = await screen.findByTestId('quota-row-argon');
    expect(argonRow).toBeInTheDocument();
    expect(argonRow.textContent).toContain('Argon');
    expect(argonRow.textContent).toContain('W');
    expect(argonRow.textContent).toContain('75%');
    expect(argonRow.textContent).not.toContain('5h');
    expect(screen.queryByTestId('five-hour-meter-argon')).not.toBeInTheDocument();
  });

  // @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-3::REQ-005
  it('toggles desktop notification preference in SettingsModal and updates localStorage', async () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);

    const toggle = screen.getByTestId('toggle-desktop-notifications');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    // Click toggle to disable
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('aico-desktop-notifications-enabled')).toBe('false');

    // Click toggle to re-enable
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('aico-desktop-notifications-enabled')).toBe('true');
  });
});
