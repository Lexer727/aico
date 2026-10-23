import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AiStatusMonitor } from '../src/components/layout/AiStatusMonitor';

// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-007::REQ-003
// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-006::REQ-004
// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-007::REQ-005
// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-007::REQ-006
// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-002::REQ-007
// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-005::REQ-008
// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-007::REQ-010
// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-004::REQ-011
describe('AiStatusMonitor Component', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders Gemini Weekly and 5-Hour limits on a single line (Line 1) and omits Claude when only Gemini is connected', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ai_state: 'waiting_for_input',
        account: {
          email: 'dynamic.user@example.com',
          tier: 'Google AI Pro',
        },
        providers: [
          {
            id: 'gemini',
            name: 'Gemini',
            cli: 'agy',
            connected: true,
            weekly_remaining_pct: 7,
            weekly_reset: '2d 12h',
            five_hour_remaining_pct: 9,
            five_hour_reset: '6m',
          },
        ],
      }),
    } as unknown as Response);

    render(<AiStatusMonitor />);

    const geminiRow = await screen.findByTestId('quota-row-gemini');
    expect(geminiRow).toBeInTheDocument();

    // Both Weekly (7%, 2d 12h) and 5-Hour (9%, 6m) limits appear on the same Gemini line
    expect(geminiRow.textContent).toContain('Gemini');
    expect(geminiRow.textContent).toContain('7%');
    expect(geminiRow.textContent).toContain('2d 12h');
    expect(geminiRow.textContent).toContain('9%');
    expect(geminiRow.textContent).toContain('6m');

    // Circular progress SVG rings are rendered inside the Gemini row
    const circles = geminiRow.querySelectorAll('svg circle');
    expect(circles.length).toBeGreaterThanOrEqual(4); // 2 track rings + 2 progress rings

    // Claude row must be omitted when not in providers (REQ-006, REQ-010)
    expect(screen.queryByTestId('quota-row-claude')).not.toBeInTheDocument();

    // Global AI state badge was relocated to per-tab indicators in TerminalConsole (REQ-003)
    expect(screen.queryByTestId('ai-terminal-state-badge')).not.toBeInTheDocument();
  });

  it('renders both Line 1 (Gemini) and Line 2 (Claude) when both CLIs are connected', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ai_state: 'working',
        account: {
          email: 'multi.cli@example.com',
          tier: 'Google AI Pro',
        },
        providers: [
          {
            id: 'gemini',
            name: 'Gemini',
            cli: 'agy',
            connected: true,
            weekly_remaining_pct: 45,
            weekly_reset: '3d 4h',
            five_hour_remaining_pct: 80,
            five_hour_reset: '1h 20m',
          },
          {
            id: 'claude',
            name: 'Claude',
            cli: 'claude',
            connected: true,
            weekly_remaining_pct: 100,
            weekly_reset: '5d 0h',
            five_hour_remaining_pct: 100,
            five_hour_reset: '2h 44m',
          },
        ],
      }),
    } as unknown as Response);

    render(<AiStatusMonitor />);

    const geminiRow = await screen.findByTestId('quota-row-gemini');
    const claudeRow = await screen.findByTestId('quota-row-claude');

    expect(geminiRow).toBeInTheDocument();
    expect(claudeRow).toBeInTheDocument();
    expect(claudeRow.textContent).toContain('Claude');
    expect(claudeRow.textContent).toContain('100%');
  });

  it('renders Argon with only Weekly limit (W) and never renders 5h meter even if five_hour_remaining_pct is present on legacy payloads', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ai_state: 'waiting_for_input',
        account: {
          email: 'argon.user@example.com',
          tier: 'Google AI Pro',
        },
        providers: [
          {
            id: 'gemini',
            name: 'Gemini',
            cli: 'agy',
            connected: true,
            weekly_remaining_pct: 90,
            weekly_reset: '6d 10h',
            five_hour_remaining_pct: 85,
            five_hour_reset: '3h 15m',
            weekly: { remaining_pct: 90, reset_in: '6d 10h' },
            five_hour: { remaining_pct: 85, reset_in: '3h 15m' },
          },
          {
            id: 'argon',
            name: 'Argon',
            cli: 'agy',
            connected: true,
            weekly_remaining_pct: 60,
            weekly_reset: '5d 4h',
            five_hour_remaining_pct: 100, // legacy payload
            weekly: { remaining_pct: 60, reset_in: '5d 4h' },
          },
        ],
      }),
    } as unknown as Response);

    render(<AiStatusMonitor />);

    const geminiRow = await screen.findByTestId('quota-row-gemini');
    const argonRow = await screen.findByTestId('quota-row-argon');

    expect(geminiRow).toBeInTheDocument();
    expect(argonRow).toBeInTheDocument();

    // Gemini shows both W and 5h
    expect(geminiRow.textContent).toContain('Gemini');
    expect(geminiRow.textContent).toContain('W');
    expect(geminiRow.textContent).toContain('5h');
    expect(screen.getByTestId('five-hour-meter-gemini')).toBeInTheDocument();

    // Argon strictly shows W and NEVER shows 5h
    expect(argonRow.textContent).toContain('Argon');
    expect(argonRow.textContent).toContain('W');
    expect(argonRow.textContent).toContain('60%');
    expect(argonRow.textContent).not.toContain('5h');
    expect(screen.queryByTestId('five-hour-meter-argon')).not.toBeInTheDocument();
  });

  it('renders empty state when no AI CLI is connected and never displays hardcoded user email', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ai_state: 'inactive',
        account: null,
        providers: [],
      }),
    } as unknown as Response);

    const { container } = render(<AiStatusMonitor />);

    await waitFor(() => {
      expect(screen.getByTestId('quota-empty-state')).toBeInTheDocument();
    });

    // Must never contain old hardcoded host monitor mocks or hardcoded user email (REQ-011)
    expect(container.textContent).not.toContain('a.staub1307@gmail.com');
    expect(container.textContent).not.toContain('184MB');
    expect(container.textContent).not.toContain('4242 OK');
  });
});

