import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SettingsModal } from '../src/components/settings/SettingsModal';

// @verifies SPEC-CORE-006::REQ-008
// @verifies SPEC-CORE-006::REQ-012
describe('SettingsModal Component', () => {
  it('renders settings dialog and triggers close on close button click', () => {
    const onClose = vi.fn();

    render(<SettingsModal isOpen={true} onClose={onClose} />);

    expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    expect(screen.getByText('Workspace & System Settings')).toBeInTheDocument();
    expect(screen.getByText(/4242 \(Axum Embedded\)/i)).toBeInTheDocument();

    const closeBtn = screen.getByTestId('settings-close-btn');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={false} onClose={onClose} />);
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
  });
});
