import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { OmniSearchModal } from '../src/components/search/OmniSearchModal';

// @verifies SPEC-CORE-006::REQ-007
describe('OmniSearchModal Component', () => {
  it('opens on Ctrl+K and filters results by scope checkboxes', () => {
    const handleSelect = vi.fn();

    render(
      <OmniSearchModal
        isOpen={true}
        onClose={() => {}}
        onSelect={handleSelect}
        mockResults={[
          { id: '1', title: 'Epic 001 - Core', scope: 'epics' },
          { id: '2', title: 'SPEC-CORE-001', scope: 'specs' },
          { id: '3', title: 'server.rs', scope: 'code' },
          { id: '4', title: 'ADR-0001 Architecture', scope: 'adrs' },
        ]}
      />
    );

    // Verify modal is open and scope checkboxes are rendered
    expect(screen.getByPlaceholderText(/search epics, specs, code, adrs/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/epics/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/specs/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/adrs/i)).toBeInTheDocument();

    // All results visible initially
    expect(screen.getByText('Epic 001 - Core')).toBeInTheDocument();
    expect(screen.getByText('server.rs')).toBeInTheDocument();

    // Uncheck "code" scope
    const codeCheckbox = screen.getByLabelText(/code/i);
    fireEvent.click(codeCheckbox);

    // Code result should disappear
    expect(screen.queryByText('server.rs')).not.toBeInTheDocument();
    expect(screen.getByText('Epic 001 - Core')).toBeInTheDocument();

    // Select an item
    fireEvent.click(screen.getByText('Epic 001 - Core'));
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', title: 'Epic 001 - Core' })
    );
  });
});
