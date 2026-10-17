import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SettingsModal } from '../src/components/settings/SettingsModal';

// @verifies ft-core-webui-shell::TASK-CORE-006-1::REQ-008
// @verifies ft-core-webui-shell::TASK-CORE-006-8::REQ-012
describe('SettingsModal Component', () => {
  it('renders settings dialog and triggers close on close button click', () => {
    const onClose = vi.fn();

    render(<SettingsModal isOpen={true} onClose={onClose} />);

    expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    expect(screen.getByText('Workspace & System Settings')).toBeInTheDocument();
    expect(screen.getByText(/4242 \(Axum Embedded\)/i)).toBeInTheDocument();
    expect(screen.getByText('AICO Skills')).toBeInTheDocument();
    expect(screen.getByText('AICO Skills Version')).toBeInTheDocument();

    const closeBtn = screen.getByTestId('settings-close-btn');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={false} onClose={onClose} />);
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
  });

  // @verifies ft-core-workspace-path-normalization::TASK-CORE-014-3::REQ-006
  it('renders Workspace Architecture & Topology section noting d:/aico as root', () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);

    const topologySection = screen.getByTestId('section-workspace-topology');
    expect(topologySection).toBeInTheDocument();
    expect(screen.getByText('Workspace Architecture & Topology')).toBeInTheDocument();
    expect(screen.getByText('d:/aico')).toBeInTheDocument();
    expect(screen.getByText('d:/aico/*-specs/')).toBeInTheDocument();
    expect(screen.getByText('d:/aico/codebase/*/')).toBeInTheDocument();
  });
});
