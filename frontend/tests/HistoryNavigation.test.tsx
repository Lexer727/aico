import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { HistoryNavButtons } from '../src/components/navigation/HistoryNavButtons';
import { AdrViewer } from '../src/features/adr-viewer/AdrViewer';
import { SpecViewer } from '../src/features/spec-viewer/SpecViewer';
import { useTabStore } from '../src/stores/useTabStore';

// Mock fetchAdr and fetchFeature
vi.mock('../src/features/feature-task-data', () => ({
  fetchAdr: vi.fn().mockImplementation((id: string) =>
    Promise.resolve({
      id,
      title: `${id}: Mock ADR`,
      status: 'Accepted',
      context: 'Mock context',
      decision: 'Mock decision',
      consequences: 'Mock consequences',
    })
  ),
  fetchFeature: vi.fn().mockImplementation((id: string) =>
    Promise.resolve({
      id: 'ft-fast-trace',
      name: 'Fast Traceability Validator',
      status: 'Completed',
      specId: 'spec-ft-fast-trace',
      specTitle: 'Fast Traceability Validator Specification',
      adrs: ['ADR-0010'],
      in_scope: [],
      out_of_scope: [],
      requirements: [],
      test_seams: [],
    })
  ),
}));

// @verifies ft-core-webui-shell::TASK-CORE-006-2::REQ-004
// @verifies ft-core-webui-shell::TASK-CORE-006-7::REQ-005
// @verifies ft-core-webui-shell::TASK-CORE-006-3::REQ-006
describe('History Navigation & NavButtons', () => {
  beforeEach(() => {
    useTabStore.getState().reset();
  });

  it('renders HistoryNavButtons with back and forward buttons disabled initially', () => {
    render(<HistoryNavButtons />);

    const backBtn = screen.getByTestId('history-back-btn');
    const forwardBtn = screen.getByTestId('history-forward-btn');

    expect(backBtn).toBeInTheDocument();
    expect(forwardBtn).toBeInTheDocument();
    expect(backBtn).toBeDisabled();
    expect(forwardBtn).toBeDisabled();
  });

  it('updates history stack when opening tabs and navigates back and forward', () => {
    const { rerender } = render(<HistoryNavButtons />);

    const store = useTabStore.getState();
    act(() => {
      store.setActiveProject('default');
      // Open first tab: spec-ft-fast-trace
      store.openTab('default', {
        id: 'spec-ft-fast-trace',
        title: 'Spec Fast Trace',
        type: 'spec',
      });
    });

    rerender(<HistoryNavButtons />);

    let backBtn = screen.getByTestId('history-back-btn');
    let forwardBtn = screen.getByTestId('history-forward-btn');

    // Back is now enabled (can go back to dashboard)
    expect(backBtn).not.toBeDisabled();
    expect(forwardBtn).toBeDisabled();

    // Open second tab from link: ADR-0010
    act(() => {
      store.openTab('default', {
        id: 'ADR-0010',
        title: 'ADR-0010',
        type: 'adr',
      });
    });

    rerender(<HistoryNavButtons />);

    expect(useTabStore.getState().activeTabId).toBe('ADR-0010');

    // Click back button: should return to spec-ft-fast-trace
    fireEvent.click(screen.getByTestId('history-back-btn'));

    expect(useTabStore.getState().activeTabId).toBe('spec-ft-fast-trace');
    expect(useTabStore.getState().canGoBack).toBe(true);
    expect(useTabStore.getState().canGoForward).toBe(true);

    rerender(<HistoryNavButtons />);
    backBtn = screen.getByTestId('history-back-btn');
    forwardBtn = screen.getByTestId('history-forward-btn');
    expect(backBtn).not.toBeDisabled();
    expect(forwardBtn).not.toBeDisabled();

    // Click forward button: should return to ADR-0010
    fireEvent.click(screen.getByTestId('history-forward-btn'));

    expect(useTabStore.getState().activeTabId).toBe('ADR-0010');
    expect(useTabStore.getState().canGoForward).toBe(false);
  });

  it('does not render redundant in-tab back button in AdrViewer and SpecViewer (top nav only)', async () => {
    const store = useTabStore.getState();
    store.setActiveProject('default');

    store.openTab('default', {
      id: 'spec-ft-fast-trace',
      title: 'spec-ft-fast-trace',
      type: 'spec',
    });
    store.openTab('default', {
      id: 'ADR-0010',
      title: 'ADR-0010',
      type: 'adr',
    });

    await act(async () => {
      render(<AdrViewer adrId="ADR-0010" />);
    });
    // Redundant in-tab back button should NOT be in the document
    expect(screen.queryByTestId('adr-back-btn')).not.toBeInTheDocument();

    await act(async () => {
      render(<SpecViewer specId="spec-ft-fast-trace" />);
    });
    expect(screen.queryByTestId('spec-back-btn')).not.toBeInTheDocument();
  });

  it('cleans closed tab from history on closeTab and keeps history intact', () => {
    const store = useTabStore.getState();
    store.setActiveProject('default');

    // Open tabs: tab1, tab2, tab3
    store.openTab('default', { id: 'tab1', title: 'tab1', type: 'spec' });
    store.openTab('default', { id: 'tab2', title: 'tab2', type: 'plan' });
    store.openTab('default', { id: 'tab3', title: 'tab3', type: 'feature' });

    expect(useTabStore.getState().activeTabId).toBe('tab3');
    expect(useTabStore.getState().history).toEqual(['dashboard', 'tab1', 'tab2', 'tab3']);

    // Close tab2 (not active)
    store.closeTab('default', 'tab2');
    expect(useTabStore.getState().history).toEqual(['dashboard', 'tab1', 'tab3']);
    expect(useTabStore.getState().activeTabId).toBe('tab3');

    // Close active tab tab3: should switch to tab1 and clean tab3 from history
    store.closeTab('default', 'tab3');
    expect(useTabStore.getState().activeTabId).toBe('tab1');
    expect(useTabStore.getState().history).toEqual(['dashboard', 'tab1']);
    expect(useTabStore.getState().canGoBack).toBe(true);

    // Go back: should return to dashboard without hitting closed tabs
    store.goBack();
    expect(useTabStore.getState().activeTabId).toBe(null);

    // Reopen last closed tab (tab3)
    store.reopenLastClosedTab('default');
    expect(useTabStore.getState().activeTabId).toBe('tab3');
    expect(useTabStore.getState().getProjectTabs('default').map((t) => t.id)).toContain('tab3');
  });

  it('persists open tabs, active tab, and history to sessionStorage across reloads (REQ-017)', () => {
    const store = useTabStore.getState();
    act(() => {
      store.setActiveProject('default');
      store.openTab('default', { id: 'ec-core', title: 'ec-core', type: 'epic' });
      store.openTab('default', { id: 'ft-fast-trace', title: 'ft-fast-trace', type: 'feature' });
    });

    expect(useTabStore.getState().activeTabId).toBe('ft-fast-trace');
    expect(useTabStore.getState().getProjectTabs('default')).toHaveLength(2);

    // Verify sessionStorage has persisted data
    const raw = sessionStorage.getItem('aico_tab_store_session_v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.activeTabId).toBe('ft-fast-trace');
    expect(parsed.tabsByProject['default']).toHaveLength(2);
    expect(parsed.history).toContain('ft-fast-trace');
  });
});
