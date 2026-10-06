import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ShellLayout } from '../src/components/layout/ShellLayout';

// @verifies spec-ft-core-webui-shell::REQ-001
// @verifies spec-ft-core-webui-shell::REQ-002
// @verifies spec-ft-core-webui-shell::REQ-008
// @verifies spec-ft-core-webui-shell::REQ-013
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

  it('renders responsive mobile drawer trigger when viewport is mobile', () => {
    render(
      <ShellLayout isMobile={true}>
        <div>Mobile Canvas</div>
      </ShellLayout>
    );

    // Hamburger trigger should be visible in mobile mode
    const drawerToggle = screen.getByTestId('mobile-drawer-toggle');
    expect(drawerToggle).toBeInTheDocument();

    // Open drawer
    fireEvent.click(drawerToggle);
    const mobileDrawer = screen.getByTestId('mobile-drawer');
    expect(mobileDrawer).toBeInTheDocument();
  });
});
