import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { OmniSearchModal } from '../src/components/search/OmniSearchModal';

describe('OmniSearchModal Component', () => {
  // @verifies ft-core-webui-shell::TASK-CORE-006-11::REQ-007
  // @verifies ft-core-omni-search-fulltext::TASK-CORE-009-3::REQ-005
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

  // @verifies ft-core-omni-search-fulltext::TASK-CORE-009-3::REQ-006
  // @verifies ft-core-omni-search-fulltext::TASK-CORE-009-3::REQ-007
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

  // @verifies ft-core-ui-visual-consistency::TASK-CORE-010-3::REQ-003
  // @verifies ft-core-ui-visual-consistency::TASK-CORE-010-5::REQ-005
  it('renders features with purple Package icon and ADRs with amber Scale icon', () => {
    render(
      <OmniSearchModal
        isOpen={true}
        onClose={() => {}}
        onSelect={() => {}}
        mockResults={[
          { id: 'ft-1', title: 'Feature One', scope: 'features' },
          { id: 'adr-1', title: 'ADR One', scope: 'adrs' },
        ]}
      />
    );

    const featResult = screen.getByTestId('search-result-ft-1');
    const featSvg = featResult.querySelector('svg');
    expect(featSvg).toHaveClass('lucide-package');
    expect(featSvg).toHaveClass('text-purple-400');

    const adrResult = screen.getByTestId('search-result-adr-1');
    const adrSvg = adrResult.querySelector('svg');
    expect(adrSvg).toHaveClass('lucide-scale');
    expect(adrSvg).toHaveClass('text-amber-400');
  });

  // @verifies ft-core-code-path-simplification-and-omnisearch::TASK-CORE-015-2::REQ-004
  it('renders code search hits with repository-relative path in font-mono style', () => {
    render(
      <OmniSearchModal
        isOpen={true}
        onClose={() => {}}
        onSelect={() => {}}
        mockResults={[
          {
            id: 'crates/aico-server/src/server.rs',
            title: 'crates/aico-server/src/server.rs',
            scope: 'code',
            subtitle: 'Line 42: ...fn main()...',
          },
        ]}
      />
    );

    const codeResult = screen.getByTestId('search-result-crates/aico-server/src/server.rs');
    expect(codeResult).toBeInTheDocument();
    const titleSpan = screen.getByText('crates/aico-server/src/server.rs');
    expect(titleSpan).toBeInTheDocument();
    expect(titleSpan).toHaveClass('font-mono');
    expect(screen.getByText('Line 42: ...fn main()...')).toBeInTheDocument();
  });

  // @verifies ft-core-multirepo-code-path-normalization::TASK-CORE-016-2::REQ-003
  // @verifies ft-core-multirepo-code-path-normalization::TASK-CORE-016-2::REQ-005
  it('renders multi-repo code search hits with repository folder prefix in font-mono style', () => {
    render(
      <OmniSearchModal
        isOpen={true}
        onClose={() => {}}
        onSelect={() => {}}
        mockResults={[
          {
            id: 'aico/crates/aico-server/src/server.rs',
            title: 'aico/crates/aico-server/src/server.rs',
            scope: 'code',
            subtitle: 'Line 42: ...fn main()...',
          },
          {
            id: 'aico-standalone/src/main.rs',
            title: 'aico-standalone/src/main.rs',
            scope: 'code',
            subtitle: 'Line 1: ...fn main()...',
          },
        ]}
      />
    );

    const aicoResult = screen.getByTestId('search-result-aico/crates/aico-server/src/server.rs');
    expect(aicoResult).toBeInTheDocument();
    const aicoTitle = screen.getByText('aico/crates/aico-server/src/server.rs');
    expect(aicoTitle).toBeInTheDocument();
    expect(aicoTitle).toHaveClass('font-mono');

    const standaloneResult = screen.getByTestId('search-result-aico-standalone/src/main.rs');
    expect(standaloneResult).toBeInTheDocument();
    const standaloneTitle = screen.getByText('aico-standalone/src/main.rs');
    expect(standaloneTitle).toBeInTheDocument();
    expect(standaloneTitle).toHaveClass('font-mono');
  });
});
