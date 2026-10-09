import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TabBar } from '../src/components/navigation/TabBar';
import { ProjectSwitcher } from '../src/components/navigation/ProjectSwitcher';
import { useTabStore } from '../src/stores/useTabStore';

// @verifies spec-ft-core-webui-shell::REQ-004
// @verifies spec-ft-core-webui-shell::REQ-005
// @verifies spec-ft-core-webui-shell::REQ-006
describe('TabBar and ProjectSwitcher', () => {
  beforeEach(() => {
    useTabStore.getState().reset();
  });

  it('manages project-scoped tabs and restores tabs on project switch', () => {
    const store = useTabStore.getState();

    // 1. In project-a, open two tabs
    store.setActiveProject('project-a');
    store.openTab('project-a', { id: 'tab-1', title: 'Spec-001', type: 'spec' });
    store.openTab('project-a', { id: 'tab-2', title: 'Plan-001', type: 'plan' });

    expect(useTabStore.getState().getProjectTabs('project-a')).toHaveLength(2);

    // 2. Switch to project-b and open one tab
    store.setActiveProject('project-b');
    store.openTab('project-b', { id: 'tab-3', title: 'Code-001', type: 'code' });
    expect(useTabStore.getState().getProjectTabs('project-b')).toHaveLength(1);

    // 3. Switch back to project-a: tabs must be restored
    store.setActiveProject('project-a');
    const restoredTabs = useTabStore.getState().getProjectTabs('project-a');
    expect(restoredTabs).toHaveLength(2);
    expect(restoredTabs.map(t => t.id)).toEqual(['tab-1', 'tab-2']);
  });

  it('renders tab bar items for active project using canonical id and allows switching active tab', () => {
    const store = useTabStore.getState();
    store.setActiveProject('project-alpha');
    store.openTab('project-alpha', { id: 'tab-overview', title: 'tab-overview', type: 'epic' });
    store.openTab('project-alpha', { id: 'tab-specs', title: 'tab-specs', type: 'spec' });

    render(<TabBar />);

    expect(screen.getByText('tab-overview')).toBeInTheDocument();
    expect(screen.getByText('tab-specs')).toBeInTheDocument();

    const specTab = screen.getByText('tab-specs');
    fireEvent.click(specTab);

    expect(useTabStore.getState().activeTabId).toBe('tab-specs');
  });

  it('supports Open in New Window action in ProjectSwitcher', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ProjectSwitcher
        projects={[
          { id: 'proj-1', name: 'Project One' },
          { id: 'proj-2', name: 'Project Two' },
        ]}
      />
    );

    const projectSelect = screen.getByTestId('project-select-trigger');
    fireEvent.click(projectSelect);

    const detachBtn = screen.getByTestId('detach-window-proj-1');
    fireEvent.click(detachBtn);

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('?project=proj-1&window=detached'),
      '_blank'
    );

    openSpy.mockRestore();
  });

  it('closes tab on middle mouse click and allows reopening closed tab via reopen button', () => {
    const store = useTabStore.getState();
    store.setActiveProject('project-test');
    store.openTab('project-test', { id: 'tab-closable', title: 'tab-closable', type: 'spec' });

    render(<TabBar />);

    const closableTab = screen.getByTestId('tab-tab-closable');
    expect(closableTab).toBeInTheDocument();

    // Middle-click (button 1)
    fireEvent.mouseDown(closableTab, { button: 1 });

    // Closable tab should now be closed
    expect(useTabStore.getState().getProjectTabs('project-test')).toHaveLength(0);

    // Dashboard tab is permanent
    expect(screen.getByTestId('tab-dashboard')).toBeInTheDocument();

    // Reopen closed tab button should be enabled
    const reopenBtn = screen.getByTestId('tab-reopen-btn');
    expect(reopenBtn).not.toBeDisabled();

    // Click reopen button
    fireEvent.click(reopenBtn);

    // Tab should be restored
    expect(useTabStore.getState().getProjectTabs('project-test')).toHaveLength(1);
    expect(useTabStore.getState().activeTabId).toBe('tab-closable');
  });

  it('reorders tabs using reorderTabs action', () => {
    const store = useTabStore.getState();
    store.setActiveProject('project-test');
    store.openTab('project-test', { id: 'tab-1', title: 'tab-1', type: 'spec' });
    store.openTab('project-test', { id: 'tab-2', title: 'tab-2', type: 'plan' });
    store.openTab('project-test', { id: 'tab-3', title: 'tab-3', type: 'epic' });

    expect(store.getProjectTabs('project-test').map((t) => t.id)).toEqual(['tab-1', 'tab-2', 'tab-3']);

    // Reorder tab-3 (index 2) to the front (index 0)
    store.reorderTabs('project-test', 2, 0);

    expect(useTabStore.getState().getProjectTabs('project-test').map((t) => t.id)).toEqual(['tab-3', 'tab-1', 'tab-2']);
  });

  it('shifts other tabs on drag over to provide a live preview before drop', () => {
    const store = useTabStore.getState();
    store.setActiveProject('project-test');
    store.openTab('project-test', { id: 'tab-1', title: 'tab-1', type: 'spec' });
    store.openTab('project-test', { id: 'tab-2', title: 'tab-2', type: 'plan' });
    store.openTab('project-test', { id: 'tab-3', title: 'tab-3', type: 'epic' });

    render(<TabBar />);

    const tab1 = screen.getByTestId('tab-tab-1');
    const tab3 = screen.getByTestId('tab-tab-3');

    // 1. Drag start on tab-1
    fireEvent.dragStart(tab1);

    // 2. Drag over tab-3: should shift tab-1 to tab-3's position
    fireEvent.dragOver(tab3);

    // In the DOM, tab-2 and tab-3 should now precede tab-1 in rendered order!
    const tabs = screen.getAllByTestId(/^tab-tab-/);
    expect(tabs.map((el) => el.getAttribute('data-testid'))).toEqual([
      'tab-tab-2',
      'tab-tab-3',
      'tab-tab-1',
    ]);

    // 3. Drop: should commit the new order to useTabStore
    fireEvent.drop(screen.getByTestId('tab-tab-1'));

    expect(useTabStore.getState().getProjectTabs('project-test').map((t) => t.id)).toEqual([
      'tab-2',
      'tab-3',
      'tab-1',
    ]);
  });

  // @verifies spec-ft-core-ui-visual-consistency::REQ-003
  // @verifies spec-ft-core-ui-visual-consistency::REQ-005
  it('renders feature tabs with purple Package icon and adr tabs with Scale icon', () => {
    const store = useTabStore.getState();
    store.setActiveProject('project-test');
    store.openTab('project-test', { id: 'ft-core-test', title: 'Feature Test', type: 'feature' });
    store.openTab('project-test', { id: 'adr-0001', title: 'ADR Test', type: 'adr' });

    render(<TabBar />);

    const featureTab = screen.getByTestId('tab-ft-core-test');
    const featureSvg = featureTab.querySelector('svg');
    expect(featureSvg).toHaveClass('lucide-package');
    expect(featureSvg).toHaveClass('text-purple-400');

    const adrTab = screen.getByTestId('tab-adr-0001');
    const adrSvg = adrTab.querySelector('svg');
    expect(adrSvg).toHaveClass('lucide-scale');
    expect(adrSvg).toHaveClass('text-amber-400');
  });

  // @verifies spec-ft-terminal-panel-ui::REQ-021
  it('prevents default vertical scroll on mouse wheel and scrolls tab container horizontally', () => {
    const store = useTabStore.getState();
    store.setActiveProject('project-test');
    store.openTab('project-test', { id: 'tab-1', title: 'tab-1', type: 'spec' });

    const { container } = render(<TabBar />);
    const scrollContainer = container.querySelector('.overflow-x-auto');
    expect(scrollContainer).toBeInTheDocument();

    const wheelEvent = new WheelEvent('wheel', { deltaY: 50, cancelable: true });
    scrollContainer!.dispatchEvent(wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(true);
  });
});
