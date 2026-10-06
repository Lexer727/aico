import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TabBar } from '../src/components/navigation/TabBar';
import { ProjectSwitcher } from '../src/components/navigation/ProjectSwitcher';
import { useTabStore } from '../src/stores/useTabStore';

// @verifies SPEC-CORE-006::REQ-004
// @verifies SPEC-CORE-006::REQ-005
// @verifies SPEC-CORE-006::REQ-006
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

  it('renders tab bar items for active project and allows switching active tab', () => {
    const store = useTabStore.getState();
    store.setActiveProject('project-alpha');
    store.openTab('project-alpha', { id: 'tab-overview', title: 'Overview', type: 'epic' });
    store.openTab('project-alpha', { id: 'tab-specs', title: 'Specs', type: 'spec' });

    render(<TabBar />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Specs')).toBeInTheDocument();

    const specTab = screen.getByText('Specs');
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

  it('closes tab on middle mouse click but protects dashboard tab', () => {
    const store = useTabStore.getState();
    store.setActiveProject('project-test');
    store.openTab('project-test', { id: 'tab-closable', title: 'Closable', type: 'spec' });

    render(<TabBar />);

    const closableTab = screen.getByTestId('tab-tab-closable');
    expect(closableTab).toBeInTheDocument();

    // Middle-click (button 1)
    fireEvent.mouseDown(closableTab, { button: 1 });

    // Closable tab should now be closed
    expect(useTabStore.getState().getProjectTabs('project-test')).toHaveLength(0);

    // Dashboard tab is permanent
    expect(screen.getByTestId('tab-dashboard')).toBeInTheDocument();
  });
});
