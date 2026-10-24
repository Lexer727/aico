import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { VisualLineageCanvas } from '../src/features/epic-hub/VisualLineageCanvas';

// @verifies ft-core-epic-hub::TASK-CORE-007-11::REQ-003
// @verifies ft-core-epic-hub::TASK-CORE-007-4::REQ-010
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-006
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-011
describe('VisualLineageCanvas Component', () => {
  const mockNodes = [
    { id: 'node-epic', type: 'epic', label: 'Epic 001', isFrontier: false },
    { id: 'node-feat', type: 'feature', label: 'Feature 001', isFrontier: false },
    { id: 'node-task', type: 'task', label: 'TASK-001', isFrontier: true },
    { id: 'node-code', type: 'code', label: 'server.rs', isFrontier: false },
  ];

  const mockEdges = [
    { id: 'e1', source: 'node-epic', target: 'node-feat' },
    { id: 'e2', source: 'node-feat', target: 'node-task' },
    { id: 'e3', source: 'node-task', target: 'node-code' },
  ];

  it('renders graph nodes, outlines active frontier, and highlights upstream/downstream edges on selection', () => {
    const onSelectNode = vi.fn();

    render(
      <VisualLineageCanvas
        nodes={mockNodes}
        edges={mockEdges}
        onSelectNode={onSelectNode}
      />
    );

    // Nodes are rendered
    expect(screen.getByText('Epic 001')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature 001')).toBeInTheDocument();

    // Click feature node to drill down and reveal child task
    const featNode = screen.getByTestId('node-Feature 001');
    fireEvent.click(featNode);
    expect(screen.getByText('TASK-001')).toBeInTheDocument();

    // Active frontier task must have glowing outline styling or class
    const frontierNode = screen.getByTestId('node-TASK-001');
    expect(frontierNode.getAttribute('data-frontier')).toBe('true');

    // Click on node-task to select it
    fireEvent.click(frontierNode);
    expect(onSelectNode).toHaveBeenCalledWith('node-task');

    // Canvas should reflect selected state
    expect(frontierNode.getAttribute('data-selected')).toBe('true');
  });

  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-006
  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-011
  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-9::REQ-017
  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-9::REQ-018
  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-11::REQ-020
  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-12::REQ-021
  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-13::REQ-022
  it('renders clean 4-column architectural graph by default, expands 5th TASK column on feature drill-down omitting requirements, and enforces adjacent-tier edges while suppressing bypass edges', () => {
    const fullNodes = [
      { id: 'ADR-0004', type: 'adr', label: 'ADR-0004: React Frontend' },
      { id: 'ec-core', type: 'epic', label: 'Epic ec-core' },
      { id: 'brain-ec-core', type: 'brainstorm', label: 'brain-ec-core: Core Brainstorm' },
      { id: 'deepdive-ec-core', type: 'deepdive', label: 'deepdive-ec-core: Core Deep Dive' },
      { id: 'ft-core-graph', type: 'feature', label: 'Feature ft-core-graph' },
      { id: 'spec-ft-core-graph', type: 'spec', label: 'spec-ft-core-graph: Spec' },
      { id: 'plan-ft-core-graph', type: 'plan', label: 'plan-ft-core-graph: Plan' },
      { id: 'spec-ft-core-graph::REQ-001', type: 'requirement', label: 'REQ-001' },
      { id: 'TASK-CORE-017-5', type: 'task', label: 'TASK-CORE-017-5' },
      { id: 'code:VisualLineageCanvas.tsx', type: 'code', label: 'VisualLineageCanvas.tsx' },
    ];

    const fullEdges = [
      { id: 'e1', source: 'ADR-0004', target: 'ec-core', relation: 'governs' },
      { id: 'e2', source: 'ec-core', target: 'ft-core-graph', relation: 'contains' },
      { id: 'e3', source: 'ft-core-graph', target: 'spec-ft-core-graph', relation: 'specifies' },
      { id: 'e4', source: 'spec-ft-core-graph', target: 'plan-ft-core-graph', relation: 'derives_from' },
      { id: 'e5', source: 'plan-ft-core-graph', target: 'code:VisualLineageCanvas.tsx', relation: 'verifies' },
      { id: 'e6', source: 'spec-ft-core-graph', target: 'spec-ft-core-graph::REQ-001', relation: 'specifies' },
      { id: 'e7', source: 'plan-ft-core-graph', target: 'TASK-CORE-017-5', relation: 'contains' },
      { id: 'e8', source: 'TASK-CORE-017-5', target: 'code:VisualLineageCanvas.tsx', relation: 'verifies' },
    ];

    const onNodeClick = vi.fn();

    const { container } = render(
      <VisualLineageCanvas
        nodes={fullNodes}
        edges={fullEdges}
        onNodeClick={onNodeClick}
      />
    );

    // REQ-020 & REQ-021: Core architectural nodes are visible by default
    expect(screen.getByText('ADR-0004: React Frontend')).toBeInTheDocument();
    expect(screen.getByText('Epic ec-core')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature ft-core-graph')).toBeInTheDocument();
    expect(screen.getByText('VisualLineageCanvas.tsx')).toBeInTheDocument();

    // REQ-020 & REQ-021: Spec, Plan, Brainstorm, DeepDive, and Requirement are omitted from the visual DAG
    expect(screen.queryByText('spec-ft-core-graph: Spec')).toBeNull();
    expect(screen.queryByText('plan-ft-core-graph: Plan')).toBeNull();
    expect(screen.queryByText('brain-ec-core: Core Brainstorm')).toBeNull();
    expect(screen.queryByText('deepdive-ec-core: Core Deep Dive')).toBeNull();
    expect(screen.queryByText('REQ-001')).toBeNull();
    expect(screen.queryByText('TASK-CORE-017-5')).toBeNull();

    // REQ-020 & REQ-021: Default overview headers show only the 4 architectural tiers
    expect(screen.getByText('ADR')).toBeInTheDocument();
    expect(screen.getByText('Epic')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getByText('Verification Seam / Code')).toBeInTheDocument();
    expect(screen.queryByText('Specification')).toBeNull();
    expect(screen.queryByText('Plan')).toBeNull();
    expect(screen.queryByText('Requirement')).toBeNull();
    expect(screen.queryByText('Task')).toBeNull();

    // REQ-022: In default overview mode (Task hidden), Feature -> Code edge IS rendered (adjacent visible columns)
    const overviewFeatToCodeEdge = container.querySelector(
      '[data-source="ft-core-graph"][data-target="code:VisualLineageCanvas.tsx"]'
    );
    expect(overviewFeatToCodeEdge).toBeInTheDocument();

    // REQ-018, REQ-021, REQ-022: Feature drilldown selector expands child TASK column between Feature and Code
    const drilldownSelect = screen.getByTestId('feature-drilldown-select');
    expect(drilldownSelect).toBeInTheDocument();

    fireEvent.change(drilldownSelect, { target: { value: 'ft-core-graph' } });

    // In drilled mode: TASK-CORE-017-5 is now visible in dedicated Task column, while REQ-001 remains omitted
    expect(screen.queryByText('REQ-001')).toBeNull();
    expect(screen.queryByText('Requirement')).toBeNull();
    expect(screen.getByText('TASK-CORE-017-5')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();

    // REQ-022: In drilled mode, adjacent edges Feature -> Task and Task -> Code are rendered
    const featToTaskEdge = container.querySelector(
      '[data-source="ft-core-graph"][data-target="TASK-CORE-017-5"]'
    );
    expect(featToTaskEdge).toBeInTheDocument();

    const taskToCodeEdge = container.querySelector(
      '[data-source="TASK-CORE-017-5"][data-target="code:VisualLineageCanvas.tsx"]'
    );
    expect(taskToCodeEdge).toBeInTheDocument();

    // REQ-022: In drilled mode, multi-tier bypass edge Feature -> Code is SUPPRESSED
    const drilledBypassEdge = container.querySelector(
      '[data-source="ft-core-graph"][data-target="code:VisualLineageCanvas.tsx"]'
    );
    expect(drilledBypassEdge).toBeNull();

    // Drilldown status badge is visible
    expect(screen.getByTestId('drilldown-status-badge')).toHaveTextContent('ft-core-graph');

    // Reset button returns to 4-column Epic overview
    const resetBtn = screen.getByTestId('reset-drilldown-btn');
    fireEvent.click(resetBtn);

    expect(screen.queryByText('REQ-001')).toBeNull();
    expect(screen.queryByText('TASK-CORE-017-5')).toBeNull();
    expect(screen.queryByText('Requirement')).toBeNull();
    expect(screen.queryByText('Task')).toBeNull();

    // After reset, Feature -> Code edge is restored
    expect(
      container.querySelector('[data-source="ft-core-graph"][data-target="code:VisualLineageCanvas.tsx"]')
    ).toBeInTheDocument();

    // Clicking feature node also toggles drilldown
    fireEvent.click(screen.getByTestId('node-Feature ft-core-graph'));
    expect(onNodeClick).toHaveBeenCalled();
    expect(screen.queryByText('REQ-001')).toBeNull();
    expect(screen.getByText('TASK-CORE-017-5')).toBeInTheDocument();
    expect(
      container.querySelector('[data-source="ft-core-graph"][data-target="code:VisualLineageCanvas.tsx"]')
    ).toBeNull();
  });

  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-7::REQ-014
  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-7::REQ-015
  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-8::REQ-016
  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-10::REQ-019
  it('supports invertible multi-select filters, empty view, dynamic column headings, node open buttons, and popout', () => {
    const nodes = [
      { id: 'ADR-0004', type: 'adr', label: 'ADR-0004: React Frontend' },
      { id: 'ec-core', type: 'epic', label: 'Epic ec-core' },
      { id: 'ft-core-1', type: 'feature', label: 'Feature ft-core-1' },
      { id: 'code:server.rs', type: 'code', label: 'server.rs' },
    ];
    const edges = [
      { id: 'e1', source: 'ADR-0004', target: 'ec-core' },
      { id: 'e2', source: 'ec-core', target: 'ft-core-1' },
      { id: 'e3', source: 'ft-core-1', target: 'code:server.rs' },
    ];

    const onOpenNode = vi.fn();
    const onPopoutGraph = vi.fn();

    render(
      <VisualLineageCanvas
        nodes={nodes}
        edges={edges}
        onOpenNode={onOpenNode}
        onPopoutGraph={onPopoutGraph}
      />
    );

    // Initial state: "All" selected -> All pill and all type pills are highlighted/active
    const allPill = screen.getByTestId('filter-pill-all');
    expect(allPill).toHaveClass('bg-indigo-600');
    expect(screen.getByTestId('filter-pill-adr')).toHaveClass('bg-indigo-950/80');
    expect(screen.getByTestId('filter-pill-feature')).toHaveClass('bg-indigo-950/80');

    // Headers for all active columns are visible
    expect(screen.getByText('ADR')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getByText('Verification Seam / Code')).toBeInTheDocument();

    // REQ-019: Clicking an active type pill while "All" is selected UNSELECTS that one thing!
    fireEvent.click(screen.getByTestId('filter-pill-feature'));
    expect(screen.queryByTestId('node-Feature ft-core-1')).toBeNull();
    expect(screen.getByText('ADR-0004: React Frontend')).toBeInTheDocument();
    expect(screen.getByText('server.rs')).toBeInTheDocument();

    // REQ-019: Column heading for Feature should now be dynamically removed!
    expect(screen.queryByText('Feature')).toBeNull();

    // Reset to All
    fireEvent.click(allPill);
    expect(screen.getByTestId('node-Feature ft-core-1')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();

    // REQ-019: Clicking "All" while "All" is active toggles to EMPTY VIEW (all unselected)
    fireEvent.click(allPill);
    expect(allPill).not.toHaveClass('bg-indigo-600');
    expect(screen.queryByText('ADR-0004: React Frontend')).toBeNull();
    expect(screen.queryByTestId('node-Feature ft-core-1')).toBeNull();
    expect(screen.queryByText('server.rs')).toBeNull();
    expect(screen.queryByText('ADR')).toBeNull();
    expect(screen.queryByText('Feature')).toBeNull();

    // REQ-019: Clicking one type pill from empty view selects JUST that one thing!
    fireEvent.click(screen.getByTestId('filter-pill-adr'));
    expect(screen.getByText('ADR-0004: React Frontend')).toBeInTheDocument();
    expect(screen.queryByTestId('node-Feature ft-core-1')).toBeNull();
    expect(screen.queryByText('server.rs')).toBeNull();
    expect(screen.getByText('ADR')).toBeInTheDocument();
    expect(screen.queryByText('Feature')).toBeNull();

    // Multi-select from partial view: click filter-pill-feature to also include Feature
    fireEvent.click(screen.getByTestId('filter-pill-feature'));
    expect(screen.getByText('ADR-0004: React Frontend')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature ft-core-1')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();

    // REQ-015: Left clicking node does not trigger onOpenNode
    fireEvent.click(screen.getByTestId('node-ADR-0004: React Frontend'));
    expect(onOpenNode).not.toHaveBeenCalled();

    // Clicking open icon button triggers onOpenNode
    const openBtn = screen.getByTestId('open-node-ADR-0004');
    fireEvent.click(openBtn);
    expect(onOpenNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'ADR-0004' }));

    // REQ-016: Full-window popout button triggers onPopoutGraph
    const popoutBtn = screen.getByTestId('popout-graph-btn');
    fireEvent.click(popoutBtn);
    expect(onPopoutGraph).toHaveBeenCalledTimes(1);
  });

  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-15::REQ-024
  it('strictly isolates drilled feature subtree without pulling in other features that share verification seams', () => {
    const multiFeatureNodes = [
      { id: 'ADR-0001', type: 'adr', label: 'ADR-0001: Architecture' },
      { id: 'ec-core', type: 'epic', label: 'Epic ec-core' },
      { id: 'ft-search', type: 'feature', label: 'Feature Search' },
      { id: 'ft-hub', type: 'feature', label: 'Feature Hub' },
      { id: 'TASK-SEARCH-01', type: 'task', label: 'TASK-SEARCH-01' },
      { id: 'TASK-HUB-01', type: 'task', label: 'TASK-HUB-01' },
      { id: 'code:SharedTest.tsx', type: 'code', label: 'SharedTest.tsx' },
      { id: 'code:SearchOnly.tsx', type: 'code', label: 'SearchOnly.tsx' },
    ];

    const multiFeatureEdges = [
      { id: 'e1', source: 'ADR-0001', target: 'ec-core' },
      { id: 'e2', source: 'ec-core', target: 'ft-search' },
      { id: 'e3', source: 'ec-core', target: 'ft-hub' },
      { id: 'e4', source: 'ft-search', target: 'TASK-SEARCH-01' },
      { id: 'e5', source: 'ft-hub', target: 'TASK-HUB-01' },
      // Both tasks verify the same shared code seam!
      { id: 'e6', source: 'TASK-SEARCH-01', target: 'code:SharedTest.tsx' },
      { id: 'e7', source: 'TASK-HUB-01', target: 'code:SharedTest.tsx' },
      { id: 'e8', source: 'TASK-SEARCH-01', target: 'code:SearchOnly.tsx' },
    ];

    render(
      <VisualLineageCanvas
        nodes={multiFeatureNodes}
        edges={multiFeatureEdges}
      />
    );

    // Default overview: both features visible
    expect(screen.getByTestId('node-Feature Search')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature Hub')).toBeInTheDocument();

    // Drill down into ft-search
    const drilldownSelect = screen.getByTestId('feature-drilldown-select');
    fireEvent.change(drilldownSelect, { target: { value: 'ft-search' } });

    // REQ-024: ft-search, its task, and its code seams are visible
    expect(screen.getByTestId('node-Feature Search')).toBeInTheDocument();
    expect(screen.getByText('TASK-SEARCH-01')).toBeInTheDocument();
    expect(screen.getByText('SharedTest.tsx')).toBeInTheDocument();
    expect(screen.getByText('SearchOnly.tsx')).toBeInTheDocument();

    // REQ-024: ft-hub and its child task MUST NOT be pulled in even though it shares SharedTest.tsx
    expect(screen.queryByTestId('node-Feature Hub')).toBeNull();
    expect(screen.queryByText('TASK-HUB-01')).toBeNull();
  });

  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-16::REQ-025
  it('focuses workspace lineage graph on selected epic, isolating governing ADRs and child features while omitting unrelated epics, with reset to overview', () => {
    const multiEpicNodes = [
      { id: 'ADR-0001', type: 'adr', label: 'ADR-0001: Core Architecture' },
      { id: 'ADR-0011', type: 'adr', label: 'ADR-0011: Native Storage' },
      { id: 'ec-core', type: 'epic', label: 'Epic ec-core' },
      { id: 'ec-storage', type: 'epic', label: 'Epic ec-storage' },
      { id: 'ft-core-discovery', type: 'feature', label: 'Feature Discovery' },
      { id: 'ft-storage-vector', type: 'feature', label: 'Feature Vector' },
      { id: 'code:core.rs', type: 'code', label: 'core.rs' },
      { id: 'code:vector.rs', type: 'code', label: 'vector.rs' },
    ];

    const multiEpicEdges = [
      { id: 'e1', source: 'ADR-0001', target: 'ec-core' },
      { id: 'e2', source: 'ADR-0011', target: 'ec-storage' },
      { id: 'e3', source: 'ec-core', target: 'ft-core-discovery' },
      { id: 'e4', source: 'ec-storage', target: 'ft-storage-vector' },
      { id: 'e5', source: 'ft-core-discovery', target: 'code:core.rs' },
      { id: 'e6', source: 'ft-storage-vector', target: 'code:vector.rs' },
    ];

    render(
      <VisualLineageCanvas
        nodes={multiEpicNodes}
        edges={multiEpicEdges}
      />
    );

    // Initial Overview: both epics and their features are visible
    expect(screen.getByTestId('node-Epic ec-core')).toBeInTheDocument();
    expect(screen.getByTestId('node-Epic ec-storage')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature Discovery')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature Vector')).toBeInTheDocument();
    expect(screen.getByTestId('epic-focus-select')).toBeInTheDocument();

    // 1. Click on Epic ec-storage node to focus
    const storageEpicNode = screen.getByTestId('node-Epic ec-storage');
    fireEvent.click(storageEpicNode);

    // REQ-025: ec-storage, its governing ADR-0011, child feature, and code seam are isolated
    expect(screen.getByTestId('node-Epic ec-storage')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature Vector')).toBeInTheDocument();
    expect(screen.getByText('vector.rs')).toBeInTheDocument();
    expect(screen.getByText('ADR-0011: Native Storage')).toBeInTheDocument();
    expect(screen.getByTestId('epic-focus-status-badge')).toBeInTheDocument();
    expect(screen.getByTestId('reset-epic-focus-btn')).toBeInTheDocument();

    // REQ-025: Unrelated ec-core and its child features are omitted
    expect(screen.queryByTestId('node-Epic ec-core')).toBeNull();
    expect(screen.queryByTestId('node-Feature Discovery')).toBeNull();
    expect(screen.queryByText('core.rs')).toBeNull();
    expect(screen.queryByText('ADR-0001: Core Architecture')).toBeNull();

    // 2. Reset back to workspace overview via reset button
    const resetEpicBtn = screen.getByTestId('reset-epic-focus-btn');
    fireEvent.click(resetEpicBtn);

    // All epics and features are visible again
    expect(screen.getByTestId('node-Epic ec-core')).toBeInTheDocument();
    expect(screen.getByTestId('node-Epic ec-storage')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature Discovery')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature Vector')).toBeInTheDocument();

    // 3. Test selection via Epic Focus Dropdown
    const epicSelect = screen.getByTestId('epic-focus-select');
    fireEvent.change(epicSelect, { target: { value: 'ec-core' } });

    expect(screen.getByTestId('node-Epic ec-core')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature Discovery')).toBeInTheDocument();
    expect(screen.getByText('core.rs')).toBeInTheDocument();
    expect(screen.getByText('ADR-0001: Core Architecture')).toBeInTheDocument();

    expect(screen.queryByTestId('node-Epic ec-storage')).toBeNull();
    expect(screen.queryByTestId('node-Feature Vector')).toBeNull();
    expect(screen.queryByText('vector.rs')).toBeNull();
  });
});
