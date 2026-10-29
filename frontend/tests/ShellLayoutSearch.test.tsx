import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ShellLayout } from '../src/components/layout/ShellLayout';
import type { DiscoveredEpic, DiscoveredFeature } from '../src/features/feature-task-data';

describe('ShellLayoutSearch: Sidebar Tree Fuzzy Filtering & Section Auto-Expansion', () => {
  const mockEpics: DiscoveredEpic[] = [
    {
      id: 'ec-core',
      title: 'AICO Core SDD Platform',
      status: 'Completed',
      executive_summary: 'Axum server runtime and web daemon.',
      specs: [
        { id: 'spec-ft-core-host-runtime', title: 'spec-ft-core-host-runtime', status: 'Completed', path: '' },
      ],
    },
  ];

  const mockFeatures: DiscoveredFeature[] = [
    {
      id: 'ft-core-host-runtime',
      name: 'Host Runtime Daemon',
      epic_id: 'ec-core',
      status: 'Completed',
      description: 'Axum server lifecycle daemon.',
      tasks: [
        { id: 'TASK-001', title: 'Graceful Listener', description: 'Graceful listener shutdown drain', status: 'Done' }
      ],
    },
  ];

  // @verifies ft-core-omni-search-fulltext::TASK-CORE-009-2::REQ-003
  it('auto-expands matching accordion sections and finds items via fuzzy typo and task description', () => {
    render(
      <ShellLayout
        fullEpics={mockEpics}
        fullFeatures={mockFeatures}
      >
        <div>Content</div>
      </ShellLayout>
    );

    const searchInput = screen.getByTestId('sidebar-search-input');

    // Enter a search term with a typo for the feature id: 'ft-cor-host-runtime'
    fireEvent.change(searchInput, { target: { value: 'ft-cor-host-runtime' } });

    // The Features accordion section must automatically expand to display the matching feature
    expect(screen.getByTestId('nav-feature-ft-core-host-runtime')).toBeInTheDocument();

    // Now search for a term that only exists in a child task description: 'shutdown drain'
    fireEvent.change(searchInput, { target: { value: 'shutdown drain' } });

    // The feature should still match and be visible!
    expect(screen.getByTestId('nav-feature-ft-core-host-runtime')).toBeInTheDocument();
  });

  // @verifies ft-core-omni-search-fulltext::TASK-CORE-009-2::REQ-004
  it('honors active scope checkboxes when filtering search results', () => {
    render(
      <ShellLayout
        fullEpics={mockEpics}
        fullFeatures={mockFeatures}
      >
        <div>Content</div>
      </ShellLayout>
    );

    const searchInput = screen.getByTestId('sidebar-search-input');
    fireEvent.change(searchInput, { target: { value: 'host' } });

    // Both feature and spec should be found initially
    expect(screen.getByTestId('nav-feature-ft-core-host-runtime')).toBeInTheDocument();

    // Uncheck "Features" scope checkbox
    const featureScopeCheckbox = screen.getByRole('checkbox', { name: /features/i });
    fireEvent.click(featureScopeCheckbox);

    // Feature should now be hidden because its scope is disabled
    expect(screen.queryByTestId('nav-feature-ft-core-host-runtime')).not.toBeInTheDocument();
  });

  // @verifies ft-core-ui-visual-consistency::TASK-CORE-010-5::REQ-001
  it('does not render a duplicate omnisearch trigger button in the sidebar header', () => {
    const handleOpenOmniSearch = vi.fn();
    render(
      <ShellLayout
        fullEpics={mockEpics}
        fullFeatures={mockFeatures}
        onOpenOmniSearch={handleOpenOmniSearch}
      >
        <div>Content</div>
      </ShellLayout>
    );

    // Primary search trigger belongs only in top header (App.tsx), not in sidebar header next to version
    expect(screen.queryByTestId('sidebar-omnisearch-btn')).not.toBeInTheDocument();
  });

  // @verifies ft-core-ui-visual-consistency::TASK-CORE-010-3::REQ-003
  // @verifies ft-core-ui-visual-consistency::TASK-CORE-010-5::REQ-005
  it('renders features header icon with purple Package and ADRs header icon with amber Scale', () => {
    render(
      <ShellLayout
        fullEpics={mockEpics}
        fullFeatures={mockFeatures}
      >
        <div>Content</div>
      </ShellLayout>
    );

    const toggleFeaturesBtn = screen.getByTestId('toggle-features');
    const featureSvg = toggleFeaturesBtn.querySelector('svg');
    expect(featureSvg).toHaveClass('lucide-package');
    expect(featureSvg).toHaveClass('text-purple-400');

    const toggleAdrsBtn = screen.getByTestId('toggle-adrs');
    const adrSvg = toggleAdrsBtn.querySelector('svg');
    expect(adrSvg).toHaveClass('lucide-scale');
    expect(adrSvg).toHaveClass('text-amber-400');
  });

  // @verifies ft-core-omni-search-fulltext::TASK-CORE-009-7::REQ-010
  it('renders discovered codebase files with implements count badge in tree view', () => {
    const handleSelectCode = vi.fn();
    const mockCodeFiles = [
      {
        path: 'crates/aico-server/src/server.rs',
        relative_path: 'crates/aico-server/src/server.rs',
        name: 'server.rs',
        extension: 'rs',
        implements_count: 5,
      },
    ];

    render(
      <ShellLayout
        fullEpics={mockEpics}
        fullFeatures={mockFeatures}
        codeFiles={mockCodeFiles}
        onSelectCode={handleSelectCode}
      >
        <div>Content</div>
      </ShellLayout>
    );

    const codeItem = screen.getByTestId('nav-code-crates/aico-server/src/server.rs');
    expect(codeItem).toBeInTheDocument();
    expect(screen.getByText('5 @impl')).toBeInTheDocument();

    fireEvent.click(codeItem);
    expect(handleSelectCode).toHaveBeenCalledWith('crates/aico-server/src/server.rs');
  });

  // @verifies ft-specs-traceability-syntax-evolution::TASK-SPECS-006-5::REQ-008
  it('renders both @impl and @ver badges for code and test files in tree view', () => {
    const mockCodeFiles = [
      {
        path: 'crates/aico-core/tests/human_gate_test.rs',
        relative_path: 'crates/aico-core/tests/human_gate_test.rs',
        name: 'human_gate_test.rs',
        extension: 'rs',
        implements_count: 0,
        verifies_count: 3,
      },
      {
        path: 'crates/aico-server/src/server.rs',
        relative_path: 'crates/aico-server/src/server.rs',
        name: 'server.rs',
        extension: 'rs',
        implements_count: 4,
        verifies_count: 2,
      },
    ];

    render(
      <ShellLayout
        fullEpics={mockEpics}
        fullFeatures={mockFeatures}
        codeFiles={mockCodeFiles}
      >
        <div>Content</div>
      </ShellLayout>
    );

    expect(screen.getByText('3 @ver')).toBeInTheDocument();
    expect(screen.getByText('4 @impl')).toBeInTheDocument();
    expect(screen.getByText('2 @ver')).toBeInTheDocument();
  });

  // @verifies ft-core-code-navigation-and-search::TASK-CORE-013-2::REQ-005
  it('filters code files via client-side search index matching annotation target tokens', () => {
    const mockCodeFiles = [
      {
        path: 'crates/aico-server/src/server.rs',
        relative_path: 'crates/aico-server/src/server.rs',
        name: 'server.rs',
        extension: 'rs',
        implements_count: 1,
        annotations: [
          {
            kind: 'implements',
            target: 'ft-core-host-runtime::TASK-CORE-001-1::REQ-001',
            line: 12,
            task: 'TASK-CORE-001-1',
            req: 'REQ-001',
          },
        ],
      },
      {
        path: 'crates/aico-storage/src/embedded.rs',
        relative_path: 'crates/aico-storage/src/embedded.rs',
        name: 'embedded.rs',
        extension: 'rs',
        implements_count: 1,
        annotations: [
          {
            kind: 'implements',
            target: 'ft-core-local-storage::TASK-STORAGE-003::REQ-004',
            line: 5,
            task: 'TASK-STORAGE-003',
            req: 'REQ-004',
          },
        ],
      },
    ];

    render(
      <ShellLayout
        fullEpics={mockEpics}
        fullFeatures={mockFeatures}
        codeFiles={mockCodeFiles}
      >
        <div>Content</div>
      </ShellLayout>
    );

    const searchInput = screen.getByTestId('sidebar-search-input');
    fireEvent.change(searchInput, { target: { value: 'TASK-CORE-001-1' } });

    // server.rs should match via annotation target in search index
    expect(screen.getByTestId('nav-code-crates/aico-server/src/server.rs')).toBeInTheDocument();
    // embedded.rs should not match
    expect(screen.queryByTestId('nav-code-crates/aico-storage/src/embedded.rs')).not.toBeInTheDocument();
  });

  // @verifies ft-core-code-navigation-and-search::TASK-CORE-013-2::REQ-004
  it('integrates backend full-text search to display code files matching content query', async () => {
    const mockCodeFiles = [
      {
        path: 'crates/aico-server/src/server.rs',
        relative_path: 'crates/aico-server/src/server.rs',
        name: 'server.rs',
        extension: 'rs',
        implements_count: 2,
      },
      {
        path: 'crates/aico-storage/src/embedded.rs',
        relative_path: 'crates/aico-storage/src/embedded.rs',
        name: 'embedded.rs',
        extension: 'rs',
        implements_count: 1,
      },
    ];

    vi.spyOn(global, 'fetch').mockImplementation((url: any) => {
      if (typeof url === 'string' && url.includes('/api/v1/search?q=')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              {
                id: 'code-1',
                scope: 'code',
                path: 'crates/aico-server/src/server.rs',
                target: 'crates/aico-server/src/server.rs',
              },
            ],
          }),
        } as any);
      }
      return Promise.resolve({ ok: false } as any);
    });

    render(
      <ShellLayout
        fullEpics={mockEpics}
        fullFeatures={mockFeatures}
        codeFiles={mockCodeFiles}
      >
        <div>Content</div>
      </ShellLayout>
    );

    const searchInput = screen.getByTestId('sidebar-search-input');
    fireEvent.change(searchInput, { target: { value: 'pub async fn bind(&mut self)' } });

    await waitFor(() => {
      expect(screen.getByTestId('nav-code-crates/aico-server/src/server.rs')).toBeInTheDocument();
      expect(screen.queryByTestId('nav-code-crates/aico-storage/src/embedded.rs')).not.toBeInTheDocument();
    });
  });

  // @verifies ft-core-workspace-path-normalization::TASK-CORE-014-2::REQ-003
  // @verifies ft-core-code-path-simplification-and-omnisearch::TASK-CORE-015-3::REQ-006
  // @verifies ft-core-multirepo-code-path-normalization::TASK-CORE-016-3::REQ-005
  it('renders and selects repository-relative path in tree view', () => {
    const handleSelectCode = vi.fn();
    const mockCodeFiles = [
      {
        path: 'aico/crates/aico-server/src/server.rs',
        relative_path: 'aico/crates/aico-server/src/server.rs',
        name: 'server.rs',
        extension: 'rs',
        implements_count: 3,
      },
    ];

    render(
      <ShellLayout
        fullEpics={mockEpics}
        fullFeatures={mockFeatures}
        codeFiles={mockCodeFiles}
        onSelectCode={handleSelectCode}
      >
        <div>Content</div>
      </ShellLayout>
    );

    const codeItem = screen.getByTestId('nav-code-aico/crates/aico-server/src/server.rs');
    expect(codeItem).toBeInTheDocument();
    expect(codeItem).toHaveTextContent('aico/crates/aico-server/src/server.rs');

    fireEvent.click(codeItem);
    expect(handleSelectCode).toHaveBeenCalledWith('aico/crates/aico-server/src/server.rs');
  });

  // @verifies spec-ft-core-omni-search-fulltext::TASK-CORE-009-11::REQ-013
  it('renders clear (X) button in Search workspace bar when query is non-empty and resets query on click or Escape', () => {
    render(
      <ShellLayout
        fullEpics={mockEpics}
        fullFeatures={mockFeatures}
      >
        <div>Content</div>
      </ShellLayout>
    );

    const searchInput = screen.getByTestId('sidebar-search-input') as HTMLInputElement;

    // Initially empty -> clear button is hidden
    expect(screen.queryByTestId('sidebar-search-clear-btn')).not.toBeInTheDocument();

    // Type a non-matching query -> clear button appears and tree shows "No matches"
    fireEvent.change(searchInput, { target: { value: 'nonexistent-query-xyz' } });
    expect(searchInput.value).toBe('nonexistent-query-xyz');
    expect(screen.queryByTestId('nav-feature-ft-core-host-runtime')).not.toBeInTheDocument();

    const clearBtn = screen.getByTestId('sidebar-search-clear-btn');
    expect(clearBtn).toBeInTheDocument();
    expect(clearBtn).toHaveAttribute('aria-label', 'Clear search');

    // Click clear button -> resets input value and restores tree items
    fireEvent.click(clearBtn);
    expect(searchInput.value).toBe('');
    expect(screen.queryByTestId('sidebar-search-clear-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-feature-ft-core-host-runtime')).toBeInTheDocument();

    // Type again and press Escape inside input -> also clears search query
    fireEvent.change(searchInput, { target: { value: 'nonexistent-query-xyz' } });
    expect(screen.getByTestId('sidebar-search-clear-btn')).toBeInTheDocument();
    fireEvent.keyDown(searchInput, { key: 'Escape' });
    expect(searchInput.value).toBe('');
    expect(screen.queryByTestId('sidebar-search-clear-btn')).not.toBeInTheDocument();
  });
});


