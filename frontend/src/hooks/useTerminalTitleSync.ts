import { useEffect, useRef } from 'react';
import type { TerminalTab, AiTabStatus } from '../components/terminal/TerminalConsole';

export const BRAILLE_SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

/**
 * Returns the status indicator glyph corresponding to an AI tab's active state.
 * Default (or 'finished') is '🟢', 'waiting_for_input' is '🔵', 'error' is '🔴',
 * and 'working' returns the animated braille frame at the given index.
 */
export function getGlyphForStatus(status?: AiTabStatus, spinnerFrameIndex = 0): string {
  const state = status?.state || 'finished';
  switch (state) {
    case 'working': {
      const idx = Math.abs(spinnerFrameIndex) % BRAILLE_SPINNER_FRAMES.length;
      return BRAILLE_SPINNER_FRAMES[idx];
    }
    case 'waiting_for_input':
      return '🔵';
    case 'error':
      return '🔴';
    case 'finished':
    default:
      return '🟢';
  }
}

/**
 * Pure formatter for the browser document.title.
 * Formats as:
 * - 'AICO' when no AI CLI tabs (agy / claude) are open.
 * - 'AICO <agy_glyph>' when only Antigravity is open.
 * - 'AICO <claude_glyph>' when only Claude Code is open.
 * - 'AICO <agy_glyph> <claude_glyph>' when both are open (fixed priority).
 */
export function formatTerminalTitle(
  tabs: TerminalTab[],
  aiTabStatuses: Record<string, AiTabStatus>,
  spinnerFrameIndex = 0
): string {
  const agyTab = tabs.find((t) => t.shell === 'agy');
  const claudeTab = tabs.find((t) => t.shell === 'claude');

  if (!agyTab && !claudeTab) {
    return 'AICO';
  }

  if (agyTab && claudeTab) {
    const agyGlyph = getGlyphForStatus(aiTabStatuses[agyTab.id], spinnerFrameIndex);
    const claudeGlyph = getGlyphForStatus(aiTabStatuses[claudeTab.id], spinnerFrameIndex);
    return `AICO ${agyGlyph} ${claudeGlyph}`;
  }

  if (agyTab) {
    const agyGlyph = getGlyphForStatus(aiTabStatuses[agyTab.id], spinnerFrameIndex);
    return `AICO ${agyGlyph}`;
  }

  const claudeGlyph = getGlyphForStatus(aiTabStatuses[claudeTab!.id], spinnerFrameIndex);
  return `AICO ${claudeGlyph}`;
}

// @implements spec-ft-terminal-tab-title-status::TASK-TITLE-002::REQ-002
// @implements spec-ft-terminal-tab-title-status::TASK-TITLE-002::REQ-003
// @implements spec-ft-terminal-tab-title-status::TASK-TITLE-002::REQ-004
// @implements spec-ft-terminal-tab-title-status::TASK-TITLE-002::REQ-005
export function useTerminalTitleSync(
  tabs: TerminalTab[],
  aiTabStatuses: Record<string, AiTabStatus>
): void {
  const frameRef = useRef(0);

  const agyTab = tabs.find((t) => t.shell === 'agy');
  const claudeTab = tabs.find((t) => t.shell === 'claude');

  const isAnyWorking =
    (Boolean(agyTab) && aiTabStatuses[agyTab!.id]?.state === 'working') ||
    (Boolean(claudeTab) && aiTabStatuses[claudeTab!.id]?.state === 'working');

  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (!isAnyWorking) {
      document.title = formatTerminalTitle(tabs, aiTabStatuses, 0);
      return;
    }

    // Set immediate initial working frame
    document.title = formatTerminalTitle(tabs, aiTabStatuses, frameRef.current);

    const intervalId = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % BRAILLE_SPINNER_FRAMES.length;
      document.title = formatTerminalTitle(tabs, aiTabStatuses, frameRef.current);
    }, 80);

    return () => {
      clearInterval(intervalId);
    };
  }, [tabs, aiTabStatuses, isAnyWorking]);

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.title = 'AICO';
      }
    };
  }, []);
}
