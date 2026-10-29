import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ShellLayout } from '../src/components/layout/ShellLayout';

// @verifies ft-core-webui-shell::TASK-CORE-006-6::REQ-001
// @verifies ft-core-webui-shell::TASK-CORE-006-11::REQ-002
// @verifies ft-core-webui-shell::TASK-CORE-006-1::REQ-008
// @verifies ft-core-webui-shell::TASK-CORE-006-22::REQ-013
// @verifies ft-core-webui-shell::TASK-CORE-006-29::REQ-016
describe('ShellLayout Component', () => {
  it('renders full-height left sidebar and accordion navigation items', () => {
    render(
      <ShellLayout>
        <div>Main Canvas Content</div>
      </ShellLayout>
    );

    // Sidebar must exist with full-height 100vh constraint
    const sidebar = screen.getByTestId('left-sidebar');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar.className).toContain('h-screen');

    // Navigation sections should be present
    expect(screen.getAllByText(/epics/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/specifications/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/code/i).length).toBeGreaterThanOrEqual(1);

    // Sidebar search, activity monitor and settings should be present
    expect(screen.getByTestId('sidebar-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('activity-monitor')).toBeInTheDocument();
    expect(screen.getByTestId('settings-button')).toBeInTheDocument();

    // Accordion toggle behavior
    const epicToggle = screen.getByTestId('toggle-epics');
    fireEvent.click(epicToggle);
    // Tree node toggle should occur without reloading or altering outer layout
    expect(screen.getByText(/Main Canvas Content/i)).toBeInTheDocument();
  });

  // @verifies ft-core-webui-shell::TASK-CORE-006-22::REQ-013
  // @verifies ft-core-webui-shell::TASK-CORE-006-20::REQ-021
  it('renders fixed mobile bottom navbar and supports full-screen view swapping and tree auto-transition', () => {
    const onMobileViewChange = vi.fn();
    const onSelectEpic = vi.fn();

    const { rerender } = render(
      <ShellLayout
        isMobile={true}
        activeMobileView="main"
        onMobileViewChange={onMobileViewChange}
        onSelectEpic={onSelectEpic}
      >
        <div>Mobile Canvas Content</div>
      </ShellLayout>
    );

    // Floating drawer trigger must NOT be rendered
    expect(screen.queryByTestId('mobile-drawer-toggle')).not.toBeInTheDocument();

    // Bottom navigation bar must be present with Tree, Main, Terminal tabs
    const navbar = screen.getByTestId('mobile-bottom-navbar');
    expect(navbar).toBeInTheDocument();
    expect(navbar.className).toContain('pb-[env(safe-area-inset-bottom,0px)]');
    expect(screen.getByTestId('mobile-tab-tree')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-tab-main')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-tab-terminal')).toBeInTheDocument();

    // In 'main' view, main canvas content is rendered
    expect(screen.getByText('Mobile Canvas Content')).toBeInTheDocument();

    // Switch to 'tree' view
    fireEvent.click(screen.getByTestId('mobile-tab-tree'));
    expect(onMobileViewChange).toHaveBeenCalledWith('tree');

    // Re-render with activeMobileView="tree"
    rerender(
      <ShellLayout
        isMobile={true}
        activeMobileView="tree"
        onMobileViewChange={onMobileViewChange}
        onSelectEpic={onSelectEpic}
      >
        <div>Mobile Canvas Content</div>
      </ShellLayout>
    );

    // Full-screen tree view should be displayed
    expect(screen.getByTestId('mobile-tree-view')).toBeInTheDocument();
    expect(screen.queryByText('Mobile Canvas Content')).not.toBeInTheDocument();

    // Click an epic in the tree view: must invoke onSelectEpic and auto-transition to 'main'
    const epicNode = screen.getByTestId('nav-epic-ec-core');
    fireEvent.click(epicNode);

    expect(onSelectEpic).toHaveBeenCalledWith('ec-core');
    expect(onMobileViewChange).toHaveBeenCalledWith('main');
  });

  it('does not render redundant workspace refresh button in sidebar header, preserving v0.1.1 version badge (REQ-016)', () => {
    render(
      <ShellLayout>
        <div>Workspace Canvas</div>
      </ShellLayout>
    );

    expect(screen.queryByTestId('refresh-workspace-btn')).not.toBeInTheDocument();
    expect(screen.getByText('v0.1.1')).toBeInTheDocument();
  });

  // @verifies ft-core-webui-shell::TASK-CORE-006-36::REQ-025
  it('supports resizing desktop left sidebar width via drag handle and persists width in localStorage', () => {
    localStorage.clear();
    render(
      <ShellLayout>
        <div>Workspace Canvas</div>
      </ShellLayout>
    );

    const sidebar = screen.getByTestId('left-sidebar');
    const resizeHandle = screen.getByTestId('left-sidebar-resize-handle');
    expect(resizeHandle).toBeInTheDocument();
    expect(sidebar.style.width).toBe('256px');

    fireEvent.mouseDown(resizeHandle, { clientX: 256 });
    fireEvent.mouseMove(window, { clientX: 340 });
    fireEvent.mouseUp(window);

    expect(sidebar.style.width).toBe('340px');
    expect(localStorage.getItem('aico-left-sidebar-width')).toBe('340');
  });
});

