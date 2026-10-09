import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { OmniSearchModal } from '../src/components/search/OmniSearchModal';

describe('OmniSearchModal Component', () => {
  // @verifies spec-ft-core-webui-shell::REQ-007
  // @verifies spec-ft-core-omni-search-fulltext::REQ-005
  it('opens and filters results by scope checkboxes and matches query', () => {
    const handleSelect = vi.fn();

    render(
      <OmniSearchModal
        isOpen={true}
        onClose={() => {}}
        onSelect={handleSelect}
        mockResults={[
          { id: '1', title: 'Epic 001 - Core', scope: 'epics' },
          { id: '2', title: 'spec-ft-core-host-runtime', scope: 'specs' },
          { id: '3', title: 'server.rs', scope: 'code' },
          { id: '4', title: 'ADR-0001 Architecture', scope: 'adrs' },
          { id: '5', title: 'ft-core-host-runtime', scope: 'features' },
        ]}
      />
    );

    // Verify modal is open and scope checkboxes are rendered
    expect(screen.getByPlaceholderText(/search across all projects/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/epics/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/features/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/specs/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/adrs/i)).toBeInTheDocument();

    // All results visible initially
    expect(screen.getByText('Epic 001 - Core')).toBeInTheDocument();
    expect(screen.getByText('server.rs')).toBeInTheDocument();
    expect(screen.getByText('ft-core-host-runtime')).toBeInTheDocument();

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

  // @verifies spec-ft-core-omni-search-fulltext::REQ-006
  // @verifies spec-ft-core-omni-search-fulltext::REQ-007
  it('displays project badges for cross-project search results and passes project ID on selection', () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <OmniSearchModal
        isOpen={true}
        onClose={handleClose}
        onSelect={handleSelect}
        mockResults={[
          {
            id: 'ec-core',
            title: 'Core Platform',
            scope: 'epics',
            projectId: 'aico-core',
            projectName: 'AICO Core SDD',
          },
          {
            id: 'ec-skills',
            title: 'Skills Evolution',
            scope: 'epics',
            projectId: 'aico-skills',
            projectName: 'AICO Skills Suite',
          },
        ]}
      />
    );

    // Verify project badges are visible
    expect(screen.getByText('AICO Core SDD')).toBeInTheDocument();
    expect(screen.getByText('AICO Skills Suite')).toBeInTheDocument();

    // Select item from second project
    fireEvent.click(screen.getByText('Skills Evolution'));
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ec-skills',
        projectId: 'aico-skills',
      })
    );
    expect(handleClose).toHaveBeenCalled();
  });
});
