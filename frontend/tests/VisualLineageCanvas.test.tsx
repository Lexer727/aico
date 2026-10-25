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

    // REQ-018, REQ-021, REQ-022, REQ-025: Clicking Feature node drills down and expands child TASK column between Feature and Code
    const featNode = screen.getByTestId('node-Feature ft-core-graph');
    fireEvent.click(featNode);

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

    // Reset focus button returns to 4-column Epic overview
    const resetBtn = screen.getByTestId('reset-focus-btn');
    fireEvent.click(resetBtn);

    expect(screen.queryByText('REQ-001')).toBeNull();
    expect(screen.queryByText('TASK-CORE-017-5')).toBeNull();
    expect(screen.queryByText('Requirement')).toBeNull();
    expect(screen.queryByText('Task')).toBeNull();

    // After reset, Feature -> Code edge is restored
    expect(
      container.querySelector('[data-source="ft-core-graph"][data-target="code:VisualLineageCanvas.tsx"]')
    ).toBeInTheDocument();

    // Clicking feature node again toggles drilldown on
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

    // Drill down into ft-search by clicking feature node
    const searchFeatNode = screen.getByTestId('node-Feature Search');
    fireEvent.click(searchFeatNode);

    // REQ-024: ft-search, its task, and its code seams are visible
    expect(screen.getByTestId('node-Feature Search')).toBeInTheDocument();
    expect(screen.getByText('TASK-SEARCH-01')).toBeInTheDocument();
    expect(screen.getByText('SharedTest.tsx')).toBeInTheDocument();
    expect(screen.getByText('SearchOnly.tsx')).toBeInTheDocument();

    // REQ-024 & REQ-025: ft-hub remains visible as a same-tier node, but its child task MUST NOT be pulled in
    expect(screen.getByTestId('node-Feature Hub')).toBeInTheDocument();
    expect(screen.queryByText('TASK-HUB-01')).toBeNull();
  });

  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-16::REQ-025
  it('focuses workspace lineage graph on selected epic, preserving upstream and same-tier nodes while filtering downstream tiers to connected nodes and isolating edges', () => {
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

    const { container } = render(
      <VisualLineageCanvas
        nodes={multiEpicNodes}
        edges={multiEpicEdges}
      />
    );

    // Initial Overview: all ADRs, epics, features, and code seams are visible
    expect(screen.getByText('ADR-0001: Core Architecture')).toBeInTheDocument();
    expect(screen.getByText('ADR-0011: Native Storage')).toBeInTheDocument();
    expect(screen.getByTestId('node-Epic ec-core')).toBeInTheDocument();
    expect(screen.getByTestId('node-Epic ec-storage')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature Discovery')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature Vector')).toBeInTheDocument();
    expect(screen.getByText('core.rs')).toBeInTheDocument();
    expect(screen.getByText('vector.rs')).toBeInTheDocument();
    expect(screen.queryByTestId('epic-focus-select')).toBeNull();
    expect(screen.queryByTestId('feature-drilldown-select')).toBeNull();

    // In Overview: all adjacent edges are rendered
    expect(container.querySelector('[data-source="ADR-0001"][data-target="ec-core"]')).toBeInTheDocument();
    expect(container.querySelector('[data-source="ADR-0011"][data-target="ec-storage"]')).toBeInTheDocument();

    // 1. Click on Epic ec-storage node to focus
    const storageEpicNode = screen.getByTestId('node-Epic ec-storage');
    fireEvent.click(storageEpicNode);

    // REQ-025: Upstream and same-tier nodes (tier <= 1) remain visible:
    // ADRs (tier 0) and both Epics (tier 1) stay in place!
    expect(screen.getByText('ADR-0001: Core Architecture')).toBeInTheDocument();
    expect(screen.getByText('ADR-0011: Native Storage')).toBeInTheDocument();
    expect(screen.getByTestId('node-Epic ec-core')).toBeInTheDocument();
    expect(screen.getByTestId('node-Epic ec-storage')).toBeInTheDocument();

    // REQ-025: Downstream tiers (tier > 1) strictly display only connected nodes:
    // Only ec-storage's child feature and code are shown; ec-core's child feature and code are omitted!
    expect(screen.getByTestId('node-Feature Vector')).toBeInTheDocument();
    expect(screen.getByText('vector.rs')).toBeInTheDocument();
    expect(screen.queryByTestId('node-Feature Discovery')).toBeNull();
    expect(screen.queryByText('core.rs')).toBeNull();

    // Status badge and reset button in breadcrumb are present
    expect(screen.getByTestId('epic-focus-status-badge')).toBeInTheDocument();
    expect(screen.getByTestId('reset-focus-btn')).toBeInTheDocument();

    // REQ-025: Edge isolation: only connections linked to ec-storage are rendered
    expect(container.querySelector('[data-source="ADR-0011"][data-target="ec-storage"]')).toBeInTheDocument();
    expect(container.querySelector('[data-source="ec-storage"][data-target="ft-storage-vector"]')).toBeInTheDocument();
    expect(container.querySelector('[data-source="ft-storage-vector"][data-target="code:vector.rs"]')).toBeInTheDocument();
    // Unrelated edges (e.g. ADR-0001 -> ec-core) are suppressed completely!
    expect(container.querySelector('[data-source="ADR-0001"][data-target="ec-core"]')).toBeNull();

    // 2. Click on child feature to focus: [Feature Vector]
    const featVectorNode = screen.getByTestId('node-Feature Vector');
    fireEvent.click(featVectorNode);

    // Both the parent Epic and child Feature are selected in the cascading path
    expect(screen.getByTestId('node-Epic ec-storage').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('node-Feature Vector').getAttribute('data-selected')).toBe('true');

    // Upstream nodes (tier <= 2: ADRs, Epics) remain visible
    expect(screen.getByText('ADR-0001: Core Architecture')).toBeInTheDocument();
    expect(screen.getByText('ADR-0011: Native Storage')).toBeInTheDocument();
    expect(screen.getByTestId('node-Epic ec-core')).toBeInTheDocument();
    expect(screen.getByTestId('node-Epic ec-storage')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature Vector')).toBeInTheDocument();
    // REQ-025: Feature column stays strictly focused on ec-storage's child features! ft-core-discovery remains excluded!
    expect(screen.queryByTestId('node-Feature Discovery')).toBeNull();

    // Downstream of feature (tier 4: Code): strictly vector.rs is visible, core.rs is omitted
    expect(screen.getByText('vector.rs')).toBeInTheDocument();
    expect(screen.queryByText('core.rs')).toBeNull();

    // 3a. Pan dragging on canvas viewport does NOT unselect the active node or clear downstream filtering
    const viewport = screen.getByTestId('lineage-canvas-viewport');
    fireEvent.mouseDown(viewport, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(viewport, { clientX: 160, clientY: 160 }); // delta > 4px
    fireEvent.mouseUp(viewport);
    fireEvent.click(viewport);

    // Selected state and filtered downstream view must be retained after pan drag!
    expect(screen.getByTestId('node-Feature Vector').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('node-Epic ec-storage').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('node-Feature Vector')).toBeInTheDocument();
    expect(screen.getByText('vector.rs')).toBeInTheDocument();
    expect(screen.queryByText('core.rs')).toBeNull();

    // 3b. Stationary click on canvas background ("clicking nothing" without drag) DOES unselect and restore overview
    fireEvent.mouseDown(viewport, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(viewport);
    fireEvent.click(viewport);

    // All epics, features, and code seams are restored to overview
    expect(screen.getByTestId('node-Epic ec-core')).toBeInTheDocument();
    expect(screen.getByTestId('node-Epic ec-storage')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature Discovery')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature Vector')).toBeInTheDocument();
    expect(screen.getByText('core.rs')).toBeInTheDocument();
    expect(screen.getByText('vector.rs')).toBeInTheDocument();

    // Normal edges are restored
    expect(container.querySelector('[data-source="ADR-0001"][data-target="ec-core"]')).toBeInTheDocument();

    // 4. Test clicking the same node again to toggle off selection
    const coreEpicNode = screen.getByTestId('node-Epic ec-core');
    fireEvent.click(coreEpicNode); // select ec-core
    expect(screen.queryByTestId('node-Feature Vector')).toBeNull(); // downstream vector omitted

    fireEvent.click(coreEpicNode); // toggle off
    expect(screen.getByTestId('node-Feature Vector')).toBeInTheDocument(); // overview restored

    // 5. Test cascading selection and upstream switching directly via node clicks
    fireEvent.click(coreEpicNode); // select ec-core at Tier 1

    // Upstream and same-tier nodes stay visible
    expect(screen.getByText('ADR-0001: Core Architecture')).toBeInTheDocument();
    expect(screen.getByText('ADR-0011: Native Storage')).toBeInTheDocument();
    expect(screen.getByTestId('node-Epic ec-core')).toBeInTheDocument();
    expect(screen.getByTestId('node-Epic ec-storage')).toBeInTheDocument();

    // Downstream strictly filters to ec-core's feature and code
    expect(screen.getByTestId('node-Feature Discovery')).toBeInTheDocument();
    expect(screen.getByText('core.rs')).toBeInTheDocument();
    expect(screen.queryByTestId('node-Feature Vector')).toBeNull();
    expect(screen.queryByText('vector.rs')).toBeNull();

    // Reset focus button in breadcrumb restores overview
    const resetFocusBtn = screen.getByTestId('reset-focus-btn');
    fireEvent.click(resetFocusBtn);

    expect(screen.getByTestId('node-Feature Discovery')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature Vector')).toBeInTheDocument();
    expect(screen.getByText('core.rs')).toBeInTheDocument();
    expect(screen.getByText('vector.rs')).toBeInTheDocument();
  });

  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-17::REQ-016
  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-17::REQ-025
  it('differentiates between pan drag and stationary click, and anchors wheel zoom dynamically around mouse cursor', () => {
    const nodes = [
      { id: 'epic-1', type: 'epic', label: 'Epic 1' },
      { id: 'feat-1', type: 'feature', label: 'Feature 1' },
      { id: 'code-1', type: 'code', label: 'file.rs' },
    ];
    const edges = [
      { id: 'e1', source: 'epic-1', target: 'feat-1' },
      { id: 'e2', source: 'feat-1', target: 'code-1' },
    ];

    render(
      <VisualLineageCanvas nodes={nodes} edges={edges} />
    );

    const viewport = screen.getByTestId('lineage-canvas-viewport');
    const transformContainer = viewport.querySelector('div[style*="transform"]') as HTMLElement;
    expect(transformContainer).toBeInTheDocument();
    expect(transformContainer.style.transform).toBe('translate(0px, 0px) scale(1)');

    // 1. Wheel scroll zoom around mouse cursor at clientX: 200, clientY: 100
    // In jsdom getBoundingClientRect returns zeros by default, so mouseX = 200, mouseY = 100
    // deltaY: -100 => zoomDelta = 0.15 => nextZoom = 1.15
    // scaleFactor = 1.15 / 1 = 1.15
    // nextPanX = 200 - (200 - 0) * 1.15 = 200 - 230 = -30
    // nextPanY = 100 - (100 - 0) * 1.15 = 100 - 115 = -15
    fireEvent.wheel(viewport, { clientX: 200, clientY: 100, deltaY: -100 });

    expect(screen.getByText('115%')).toBeInTheDocument();
    expect(transformContainer.style.transform).toBe('translate(-30px, -15px) scale(1.15)');

    // 2. Toolbar zoom reset button resets zoom and pan
    const resetZoomBtn = screen.getByTestId('zoom-reset-btn');
    fireEvent.click(resetZoomBtn);

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(transformContainer.style.transform).toBe('translate(0px, 0px) scale(1)');

    // 3. Pan dragging moves pan coordinates and preserves node selection
    const featNode = screen.getByTestId('node-Feature 1');
    fireEvent.click(featNode);
    expect(featNode.getAttribute('data-selected')).toBe('true');

    // Pan drag
    fireEvent.mouseDown(viewport, { clientX: 50, clientY: 50 });
    fireEvent.mouseMove(viewport, { clientX: 120, clientY: 140 }); // delta > 4px
    fireEvent.mouseUp(viewport);
    fireEvent.click(viewport);

    // Feature node remains selected
    expect(featNode.getAttribute('data-selected')).toBe('true');
    // Pan offset updated: pan = (70, 90)
    expect(transformContainer.style.transform).toBe('translate(70px, 90px) scale(1)');

    // 4. Stationary click on empty viewport deselects node
    fireEvent.mouseDown(viewport, { clientX: 200, clientY: 200 });
    fireEvent.mouseUp(viewport);
    fireEvent.click(viewport);

    // Feature node is deselected
    expect(featNode.getAttribute('data-selected')).toBe('false');
  });

  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-18::REQ-025
  it('supports full multi-tier cascading selection from ADR through Epic, Feature, and Task to Code, resetting downstream on upstream change', () => {
    const cascadeNodes = [
      { id: 'ADR-1', type: 'adr', label: 'ADR-1' },
      { id: 'ADR-2', type: 'adr', label: 'ADR-2' },
      { id: 'ec-1', type: 'epic', label: 'Epic 1' },
      { id: 'ec-2', type: 'epic', label: 'Epic 2' },
      { id: 'ft-1a', type: 'feature', label: 'Feature 1A' },
      { id: 'ft-1b', type: 'feature', label: 'Feature 1B' },
      { id: 'ft-2a', type: 'feature', label: 'Feature 2A' },
      { id: 'task-1a1', type: 'task', label: 'Task 1A1' },
      { id: 'task-1a2', type: 'task', label: 'Task 1A2' },
      { id: 'code-1a1', type: 'code', label: 'file1a1.rs' },
      { id: 'code-1a2', type: 'code', label: 'file1a2.rs' },
      { id: 'code-2a', type: 'code', label: 'file2a.rs' },
    ];

    const cascadeEdges = [
      { id: 'e1', source: 'ADR-1', target: 'ec-1' },
      { id: 'e2', source: 'ADR-2', target: 'ec-2' },
      { id: 'e3', source: 'ec-1', target: 'ft-1a' },
      { id: 'e4', source: 'ec-1', target: 'ft-1b' },
      { id: 'e5', source: 'ec-2', target: 'ft-2a' },
      { id: 'e6', source: 'ft-1a', target: 'task-1a1' },
      { id: 'e7', source: 'ft-1a', target: 'task-1a2' },
      { id: 'e8', source: 'task-1a1', target: 'code-1a1' },
      { id: 'e9', source: 'task-1a2', target: 'code-1a2' },
      { id: 'e10', source: 'ft-2a', target: 'code-2a' },
    ];

    render(<VisualLineageCanvas nodes={cascadeNodes} edges={cascadeEdges} />);

    // Step 1: Click ADR-1 (Tier 0)
    fireEvent.click(screen.getByTestId('node-ADR-1'));
    expect(screen.getByTestId('node-ADR-1').getAttribute('data-selected')).toBe('true');
    // Epics: only ec-1 is downstream of ADR-1; ec-2 is omitted
    expect(screen.getByTestId('node-Epic 1')).toBeInTheDocument();
    expect(screen.queryByTestId('node-Epic 2')).toBeNull();
    // Features: ft-1a and ft-1b visible; ft-2a omitted
    expect(screen.getByTestId('node-Feature 1A')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature 1B')).toBeInTheDocument();
    expect(screen.queryByTestId('node-Feature 2A')).toBeNull();

    // Step 2: Click Epic 1 (Tier 1)
    fireEvent.click(screen.getByTestId('node-Epic 1'));
    // Both ADR-1 and Epic 1 are selected and highlighted
    expect(screen.getByTestId('node-ADR-1').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('node-Epic 1').getAttribute('data-selected')).toBe('true');
    // Features of Epic 1 remain visible
    expect(screen.getByTestId('node-Feature 1A')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature 1B')).toBeInTheDocument();

    // Step 3: Click Feature 1A (Tier 2)
    fireEvent.click(screen.getByTestId('node-Feature 1A'));
    // ADR-1, Epic 1, and Feature 1A are all selected
    expect(screen.getByTestId('node-ADR-1').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('node-Epic 1').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('node-Feature 1A').getAttribute('data-selected')).toBe('true');
    // Sibling Feature 1B of Epic 1 stays visible in the feature column
    expect(screen.getByTestId('node-Feature 1B')).toBeInTheDocument();
    // Tasks: child tasks of Feature 1A are expanded!
    expect(screen.getByTestId('node-Task 1A1')).toBeInTheDocument();
    expect(screen.getByTestId('node-Task 1A2')).toBeInTheDocument();

    // Step 4: Click Task 1A1 (Tier 3)
    fireEvent.click(screen.getByTestId('node-Task 1A1'));
    // All 4 nodes are selected
    expect(screen.getByTestId('node-Task 1A1').getAttribute('data-selected')).toBe('true');
    // Code: strictly file1a1.rs is visible; file1a2.rs is omitted
    expect(screen.getByText('file1a1.rs')).toBeInTheDocument();
    expect(screen.queryByText('file1a2.rs')).toBeNull();

    // Step 5: Upstream switch - Click Feature 1B (Tier 2)
    fireEvent.click(screen.getByTestId('node-Feature 1B'));
    // Feature 1B is selected; Task 1A1 selection is reset
    expect(screen.getByTestId('node-Feature 1B').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('node-Feature 1A').getAttribute('data-selected')).toBe('false');
    expect(screen.queryByTestId('node-Task 1A1')).toBeNull();

    // Step 6: Upstream switch - Click ADR-2 (Tier 0)
    fireEvent.click(screen.getByTestId('node-ADR-2'));
    // ADR-2 is selected; all downstream tiers are reset to ADR-2's lineage
    expect(screen.getByTestId('node-ADR-2').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('node-Epic 2')).toBeInTheDocument();
    expect(screen.queryByTestId('node-Epic 1')).toBeNull();
    expect(screen.getByTestId('node-Feature 2A')).toBeInTheDocument();
    expect(screen.queryByTestId('node-Feature 1A')).toBeNull();
    expect(screen.getByText('file2a.rs')).toBeInTheDocument();
    expect(screen.queryByText('file1a1.rs')).toBeNull();

    // Step 7: Clear via reset button in toolbar breadcrumb
    const resetBtn = screen.getByTestId('reset-focus-btn');
    fireEvent.click(resetBtn);
    // Overview restored: all ADRs and Epics visible
    expect(screen.getByTestId('node-ADR-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-ADR-2')).toBeInTheDocument();
    expect(screen.getByTestId('node-Epic 1')).toBeInTheDocument();
    expect(screen.getByTestId('node-Epic 2')).toBeInTheDocument();
    expect(screen.getByTestId('node-ADR-1').getAttribute('data-selected')).toBe('false');
    expect(screen.getByTestId('node-ADR-2').getAttribute('data-selected')).toBe('false');
  });
});
