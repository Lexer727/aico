import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DockablePanel } from '../src/components/layout/DockablePanel';
import { useDockStore } from '../src/stores/useDockStore';

// @verifies ft-core-webui-shell::TASK-CORE-006-9::REQ-010
// @verifies ft-core-webui-shell::TASK-CORE-006-9::REQ-011
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

  // @verifies ft-core-webui-shell::TASK-CORE-006-37::REQ-025
  it('supports resizing height in bottom horizontal mode and resizing width in right sidebar mode', () => {
    render(
      <DockablePanel title="Auxiliary Terminal">
        <div>Terminal Logs</div>
      </DockablePanel>
    );

    const panel = screen.getByTestId('dockable-panel');
    const resizeHandle = screen.getByTestId('dockable-panel-resize-handle');
    expect(resizeHandle).toBeInTheDocument();

    // Default bottom position: drag top handle up by 60px (from clientY 500 to 440) -> height increases from 256 to 316
    expect(panel.style.height).toBe('256px');
    fireEvent.mouseDown(resizeHandle, { clientY: 500 });
    fireEvent.mouseMove(window, { clientY: 440 });
    fireEvent.mouseUp(window);
    expect(panel.style.height).toBe('316px');
    expect(useDockStore.getState().bottomHeight).toBe(316);

    // Toggle to right position: drag left handle left by 80px (from clientX 800 to 720) -> width increases from 384 to 464
    fireEvent.click(screen.getByTestId('dock-toggle-button'));
    expect(panel.getAttribute('data-position')).toBe('right');
    expect(panel.style.width).toBe('384px');

    const rightHandle = screen.getByTestId('dockable-panel-resize-handle');
    fireEvent.mouseDown(rightHandle, { clientX: 800 });
    fireEvent.mouseMove(window, { clientX: 720 });
    fireEvent.mouseUp(window);
    expect(panel.style.width).toBe('464px');
    expect(useDockStore.getState().rightWidth).toBe(464);
  });
});
