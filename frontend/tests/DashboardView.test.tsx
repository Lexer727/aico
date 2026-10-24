import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DashboardView } from '../src/features/dashboard/DashboardView';

// @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-1::REQ-001
// @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-1::REQ-007
// @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-2::REQ-006
// @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-7::REQ-009
// @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-7::REQ-010
// @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-8::REQ-011
// @verifies ft-core-epic-hub::TASK-CORE-007-1::REQ-007
describe('DashboardView Component', () => {
  it('renders workspace overview without hardcoded root path and displays zero-mock empty state', () => {
    const onOpenEpic = vi.fn();
    const onOpenSpec = vi.fn();

    render(<DashboardView onOpenEpic={onOpenEpic} onOpenSpec={onOpenSpec} />);

    // REQ-001: Header must not contain hardcoded root path
    expect(screen.getByText('Workspace Overview')).toBeInTheDocument();
    expect(screen.queryByText(/d:\/aico\/aico-specs/i)).toBeNull();
    expect(screen.getByText('Local-First Spec-Driven Development Platform')).toBeInTheDocument();

    // REQ-007: Zero-mock empty state when no epics exist
    expect(screen.getByText('None discovered')).toBeInTheDocument();
    expect(screen.getByText('No epics discovered in active project.')).toBeInTheDocument();
  });

  it('renders project epics with TagBadge navigation, omits spec tag pills, and formats inline markdown', () => {
    const onOpenEpic = vi.fn();
    const onOpenSpec = vi.fn();
    const epics = [
      {
        id: 'ec-core',
        title: 'AICO Core SDD Platform',
        status: 'Completed',
        executive_summary: 'Delivers **local-first** orchestration with `aico-server` and strict EARS contracts.',
        specs_count: 1,
        specs: [{ id: 'spec-ft-core-host-runtime', title: 'spec-ft-core-host-runtime', status: 'Completed', path: '' }],
      },
      {
        id: 'ec-specs',
        title: 'AICO SDD Blueprints & Migration',
        status: 'Completed',
        specs_count: 0,
        specs: [],
      },
    ];

    const { container } = render(<DashboardView onOpenEpic={onOpenEpic} onOpenSpec={onOpenSpec} epics={epics} />);

    // REQ-006: TagBadges are rendered with pointer cursor
    const ecCoreBadge = screen.getByTestId('tag-badge-ec-core');
    expect(ecCoreBadge).toBeInTheDocument();
    expect(ecCoreBadge.className).toContain('cursor-pointer');

    const ecSpecsBadge = screen.getByTestId('tag-badge-ec-specs');
    expect(ecSpecsBadge).toBeInTheDocument();

    // Redundant "Open Epic" button must be absent
    expect(screen.queryByRole('button', { name: /open epic/i })).toBeNull();

    // Clicking TagBadge opens epic
    fireEvent.click(ecCoreBadge);
    expect(onOpenEpic).toHaveBeenCalledWith('ec-core');

    // REQ-009: Spec TagBadges must NOT be rendered inside Project Epics cards
    expect(screen.queryByTestId('tag-badge-spec-ft-core-host-runtime')).toBeNull();
    expect(screen.getByText('Specifications (1)')).toBeInTheDocument();

    // REQ-011: Executive summary inline markdown (**local-first** and `aico-server`) is formatted as HTML
    const strongEl = container.querySelector('strong');
    expect(strongEl?.textContent).toBe('local-first');
    const codeEl = container.querySelector('code');
    expect(codeEl?.textContent).toBe('aico-server');
    expect(screen.queryByText(/\*\*local-first\*\*/)).toBeNull();
  });

  it('renders workspace-wide VisualLineageCanvas on the dashboard and supports full-window popout', () => {
    const onPopoutGraph = vi.fn();
    render(
      <DashboardView
        onOpenEpic={vi.fn()}
        onOpenSpec={vi.fn()}
        projectName="aico"
        onPopoutGraph={onPopoutGraph}
      />
    );

    // REQ-010: Interactive Workspace Lineage Graph section is present on Dashboard
    expect(screen.getByTestId('dashboard-lineage-graph-section')).toBeInTheDocument();
    expect(screen.getByTestId('lineage-graph-canvas')).toBeInTheDocument();

    const popoutBtn = screen.getByTestId('dashboard-popout-graph');
    fireEvent.click(popoutBtn);
    expect(onPopoutGraph).toHaveBeenCalledTimes(1);
  });

  // @verifies spec-ft-storage-aico-graph-and-incremental-cache::TASK-STORAGE-001-1::REQ-005
  it('renders Host Diagnostics with AICO Graph and LanceDB without Kùzu branding', () => {
    render(
      <DashboardView
        onOpenEpic={vi.fn()}
        onOpenSpec={vi.fn()}
        projectName="aico"
      />
    );

    expect(screen.getByText('Host Diagnostics')).toBeInTheDocument();
    expect(screen.getByText('AICO Graph:')).toBeInTheDocument();
    expect(screen.getByText('LanceDB:')).toBeInTheDocument();
    expect(screen.queryByText(/Kùzu/i)).toBeNull();
  });

  // @verifies ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-4::REQ-004
  it('renders live node and vector metrics in Host Diagnostics', () => {
    const mockStats = {
      project_id: 'aico-specs',
      graph_nodes_count: 85,
      graph_edges_count: 120,
      vector_chunks_count: 450,
      cache_state: 'ready',
      storage_dir_bytes: 1048576,
    };

    render(
      <DashboardView
        onOpenEpic={vi.fn()}
        onOpenSpec={vi.fn()}
        projectName="aico"
        storageStats={mockStats}
      />
    );

    expect(screen.getByTestId('host-diag-graph')).toHaveTextContent('AICO Graph:Embedded OK (85 nodes)');
    expect(screen.getByTestId('host-diag-lancedb')).toHaveTextContent('LanceDB:Embedded OK (450 vectors)');
  });

  it('renders Ubiquitous Domain Terminology and allows expanding and searching', () => {
    const customTerms = [
      { term: 'Autonomous Orchestrator', definition: 'Local daemon executing SDD specs' },
      { term: 'Designated Test Seam', definition: 'Public interface contract for regression testing' },
    ];

    render(
      <DashboardView
        onOpenEpic={vi.fn()}
        onOpenSpec={vi.fn()}
        ubiquitousLanguage={customTerms}
      />
    );

    // Header shows term count
    expect(screen.getByText(/Ubiquitous Domain Terminology \(2\)/)).toBeInTheDocument();
    expect(screen.queryByText('Autonomous Orchestrator')).toBeNull();

    // Click toggle to expand
    const toggleBtn = screen.getByTestId('toggle-dashboard-terminology');
    fireEvent.click(toggleBtn);

    // Terms are now visible
    expect(screen.getByText('Autonomous Orchestrator')).toBeInTheDocument();
    expect(screen.getByText('Local daemon executing SDD specs')).toBeInTheDocument();
    expect(screen.getByText('Designated Test Seam')).toBeInTheDocument();

    // Test search filter
    const searchInput = screen.getByTestId('dashboard-terminology-search');
    fireEvent.change(searchInput, { target: { value: 'regression' } });

    expect(screen.queryByText('Autonomous Orchestrator')).toBeNull();
    expect(screen.getByText('Designated Test Seam')).toBeInTheDocument();
  });

  it('allows clicking stat-card-glossary to expand and collapse terminology, and Open Full Page', () => {
    const onOpenGlossary = vi.fn();

    render(
      <DashboardView
        onOpenEpic={vi.fn()}
        onOpenSpec={vi.fn()}
        onOpenGlossary={onOpenGlossary}
      />
    );

    // Click stat card to expand terminology
    const statCard = screen.getByTestId('stat-card-glossary');
    fireEvent.click(statCard);

    // Now expanded, default term visible
    expect(screen.getByText('Codebase Root')).toBeInTheDocument();

    // Click Open Full Page button
    const openFullBtn = screen.getByTestId('open-full-glossary');
    fireEvent.click(openFullBtn);
    expect(onOpenGlossary).toHaveBeenCalledTimes(1);

    // Click stat card again to collapse
    fireEvent.click(statCard);
    expect(screen.queryByText('Codebase Root')).toBeNull();
  });
});
