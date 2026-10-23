import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { VisualLineageCanvas, type GraphNode, type GraphEdge } from '../VisualLineageCanvas';

// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-006
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-011
describe('VisualLineageCanvas Live Graph & Tier Lineage (REQ-006)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockMultiTierNodes: GraphNode[] = [
    { id: 'adr-0001', type: 'adr', label: 'ADR-0001 Local Architecture' },
    { id: 'ec-core', type: 'epic', label: 'Core Platform Epic' },
    { id: 'ft-core-runtime', type: 'feature', label: 'Host Runtime Feature' },
    { id: 'spec-ft-core-runtime', type: 'spec', label: 'spec-ft-core-runtime' },
    { id: 'task-core-001', type: 'task', label: 'TASK-CORE-001', isFrontier: true },
    { id: 'code-server-rs', type: 'code', label: 'server.rs' },
  ];

  const mockMultiTierEdges: GraphEdge[] = [
    { id: 'e1', source: 'adr-0001', target: 'ec-core' },
    { id: 'e2', source: 'ec-core', target: 'ft-core-runtime' },
    { id: 'e3', source: 'ft-core-runtime', target: 'spec-ft-core-runtime' },
    { id: 'e4', source: 'spec-ft-core-runtime', target: 'task-core-001' },
    { id: 'e5', source: 'task-core-001', target: 'code-server-rs' },
  ];

  it('renders multi-tier nodes (ADR -> Epic -> Feature -> Spec -> Task -> Code) and SVG directed edges', () => {
    const onNodeClick = vi.fn();

    const { container } = render(
      <VisualLineageCanvas
        nodes={mockMultiTierNodes}
        edges={mockMultiTierEdges}
        onNodeClick={onNodeClick}
      />
    );

    // Verify all tiers are represented in the rendered canvas
    expect(screen.getByText('ADR-0001 Local Architecture')).toBeInTheDocument();
    expect(screen.getByText('Core Platform Epic')).toBeInTheDocument();
    expect(screen.getByTestId('node-Host Runtime Feature')).toBeInTheDocument();
    expect(screen.queryByText('spec-ft-core-runtime')).toBeNull();
    expect(screen.getByText('server.rs')).toBeInTheDocument();

    // Granular task is revealed on feature drilldown
    const featNode = screen.getByTestId('node-Host Runtime Feature');
    fireEvent.click(featNode);
    expect(screen.getByText('TASK-CORE-001')).toBeInTheDocument();

    // Verify SVG paths for directed edges exist with bezier curves
    const svgPaths = container.querySelectorAll('[data-testid="edge-path"]');
    expect(svgPaths.length).toBeGreaterThan(0);

    // Verify frontier node indicator
    const frontierNode = screen.getByTestId('node-TASK-CORE-001');
    expect(frontierNode.getAttribute('data-frontier')).toBe('true');
  });

  it('highlights connected multi-hop upstream provenance and downstream blast radius on node click', () => {
    const onNodeClick = vi.fn();

    render(
      <VisualLineageCanvas
        nodes={mockMultiTierNodes}
        edges={mockMultiTierEdges}
        onNodeClick={onNodeClick}
      />
    );

    // Click on ft-core-runtime
    const featNode = screen.getByTestId('node-Host Runtime Feature');
    fireEvent.click(featNode);

    expect(onNodeClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ft-core-runtime' })
    );

    // Selected indicator in status bar
    expect(screen.getByText('Selected:')).toBeInTheDocument();
    expect(screen.getAllByText('ft-core-runtime')[0]).toBeInTheDocument();
    // Upstream (ec-core -> ft-core-runtime and adr-0001 -> ec-core): 2 upstream edges
    expect(screen.getByText(/\(2 Up\)/)).toBeInTheDocument();
    // Downstream (ft-core-runtime -> task -> code): 2 downstream edges
    expect(screen.getByText(/\(2 Down\)/)).toBeInTheDocument();
  });

  it('fetches live lineage graph from GET /api/v1/graph?project=...&epic=... when nodes are not provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        nodes: [
          { id: 'node-live-epic', type: 'epic', title: 'Live Discovered Epic', status: 'Active' },
          { id: 'node-live-task', type: 'task', title: 'Live Task 101', status: 'In Progress', is_frontier: true },
        ],
        edges: [
          { id: 'live-e1', source: 'node-live-epic', target: 'node-live-task', relation: 'decomposes_into' },
        ],
      }),
    } as any);

    render(
      <VisualLineageCanvas
        projectName="aico-core"
        epicId="ec-core"
      />
    );

    // Verifies fetch was invoked with encoded query params
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/graph?project=aico-core&epic=ec-core')
      );
    });

    // Verifies fetched nodes are rendered
    expect(await screen.findByText('Live Discovered Epic')).toBeInTheDocument();
    expect(await screen.findByText('Live Task 101')).toBeInTheDocument();
  });

  it('supports node type filter pills and zoom controls', () => {
    render(
      <VisualLineageCanvas
        nodes={mockMultiTierNodes}
        edges={mockMultiTierEdges}
      />
    );

    // Verify filter pills exist
    const adrPill = screen.getByTestId('filter-pill-adr');
    expect(adrPill).toBeInTheDocument();

    const allPill = screen.getByTestId('filter-pill-all');

    // REQ-019: Clicking ADR filter pill while All is active unselects ADR
    fireEvent.click(adrPill);
    expect(screen.queryByText('ADR-0001 Local Architecture')).toBeNull();
    expect(screen.getByTestId('node-Host Runtime Feature')).toBeInTheDocument();

    // REQ-019: Click All to toggle to empty view, then click ADR to select only ADR
    fireEvent.click(allPill); // all selected
    fireEvent.click(allPill); // empty view
    expect(screen.queryByText('ADR-0001 Local Architecture')).toBeNull();
    expect(screen.queryByTestId('node-Host Runtime Feature')).toBeNull();

    // Click ADR from empty view -> only ADR selected
    fireEvent.click(adrPill);
    expect(screen.getByText('ADR-0001 Local Architecture')).toBeInTheDocument();
    expect(screen.queryByTestId('node-Host Runtime Feature')).toBeNull();

    // Reset filter to All
    fireEvent.click(allPill);
    expect(screen.getByTestId('node-Host Runtime Feature')).toBeInTheDocument();

    // Zoom controls
    const zoomInBtn = screen.getByTestId('zoom-in-btn');
    const zoomResetBtn = screen.getByTestId('zoom-reset-btn');
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('115%')).toBeInTheDocument();
    fireEvent.click(zoomResetBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
