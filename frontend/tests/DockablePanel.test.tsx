import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DockablePanel } from '../src/components/layout/DockablePanel';
import { useDockStore } from '../src/stores/useDockStore';

// @verifies spec-ft-core-webui-shell::REQ-010
// @verifies spec-ft-core-webui-shell::REQ-011
describe('DockablePanel Component', () => {
  beforeEach(() => {
    localStorage.clear();
    useDockStore.getState().reset();
  });

  it('toggles dock position between bottom and right and persists to store', () => {
    render(
      <DockablePanel title="Auxiliary Terminal">
        <div>Terminal Logs</div>
      </DockablePanel>
    );

    const panel = screen.getByTestId('dockable-panel');
    expect(panel).toBeInTheDocument();

    // Default dock position is bottom
    expect(useDockStore.getState().position).toBe('bottom');
    expect(panel.getAttribute('data-position')).toBe('bottom');

    // Click toggle button
    const toggleBtn = screen.getByTestId('dock-toggle-button');
    fireEvent.click(toggleBtn);

    // Should now be docked right
    expect(useDockStore.getState().position).toBe('right');
    expect(panel.getAttribute('data-position')).toBe('right');
  });

  it('constrains bottom panel within canvas boundaries', () => {
    render(
      <DockablePanel title="Auxiliary Terminal">
        <div>Terminal Logs</div>
      </DockablePanel>
    );

    const panel = screen.getByTestId('dockable-panel');
    // Bottom dock must have canvas-bounded styling
    expect(panel.className).toContain('w-full');
  });
});
