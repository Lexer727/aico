import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { EpicHubView } from '../src/features/epic-hub/EpicHubView';
import { VisualLineageCanvas } from '../src/features/epic-hub/VisualLineageCanvas';
import { useAccordionStore } from '../src/stores/useAccordionStore';

// @verifies ft-core-epic-hub::TASK-CORE-007-12::REQ-001
// @verifies ft-core-epic-hub::TASK-CORE-007-10::REQ-002
// @verifies ft-core-epic-hub::TASK-CORE-007-11::REQ-005
// @verifies ft-core-epic-hub::TASK-CORE-007-4::REQ-011
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-1::REQ-001
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-1::REQ-002
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-1::REQ-003
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-1::REQ-007
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-1::REQ-008
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-006
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-011
describe('EpicHubView Component', () => {
  beforeEach(() => {
    useAccordionStore.setState({ collapsedByEntity: {} });
  });
  const mockEpic = {
    id: '001-aico-core',
    title: 'AICO Core SDD Platform',
    status: 'Active',
    verifiedCount: 4,
    totalCount: 7,
    sections: {
      overview: 'Overview content of epic',
      brainstorm: 'Brainstorm ideas and trade-offs',
      specifications: 'EARS Specifications list',
      deepDive: 'Kùzu blast radius analysis',
      taskPlan: 'DAG task plan details',
      assets: 'Multimodal drop assets',
    },
  };

  it('renders consolidated single-page view with all collapsible accordion sections', () => {
    const onPopOut = vi.fn();

    render(<EpicHubView epic={mockEpic} onPopOut={onPopOut} />);

    expect(screen.getByText('AICO Core SDD Platform')).toBeInTheDocument();
    // Summary status badge
    expect(screen.getByText('[4/7 Verified]')).toBeInTheDocument();

    // Check Executive Summary top banner and accordion headers
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    expect(screen.getByText(/Features in this Epic/)).toBeInTheDocument();
    expect(screen.getByText('Brainstorm')).toBeInTheDocument();
    expect(screen.getByText(/Architecture Decision Records/)).toBeInTheDocument();
    expect(screen.getByText('Deep Dive')).toBeInTheDocument();
    expect(screen.getByText('Task Plan')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();

    // Pop-out button on Brainstorm accordion
    const popoutBtn = screen.getByTestId('popout-brainstorm');
    fireEvent.click(popoutBtn);
    expect(onPopOut).toHaveBeenCalledWith('001-aico-core', 'brainstorm');
  });

  it('renders overall Task Execution Progress bar in the Task Plan handle even when collapsed', () => {
    const epicWithFeatures = {
      ...mockEpic,
      features: [
        {
          id: 'ft-01',
          name: 'Feature 1',
          tasks: [
            { id: 'TASK-01', title: 'Task 1', status: 'Done' },
            { id: 'TASK-02', title: 'Task 2', status: 'In Progress' },
          ],
        },
      ],
    };

    render(<EpicHubView epic={epicWithFeatures} />);

    // Check handle has progress text
    const handleProgress = screen.getByTestId('task-plan-handle-progress');
    expect(handleProgress).toHaveTextContent('1/2');
    expect(handleProgress).toHaveTextContent('Done (50%)');

    // Collapse Task Plan by clicking handle
    const taskPlanHeader = screen.getByText('Task Plan');
    fireEvent.click(taskPlanHeader);

    // After collapsing, progress in handle is still visible!
    const collapsedHandleProgress = screen.getByTestId('task-plan-handle-progress');
    expect(collapsedHandleProgress).toBeInTheDocument();
    expect(collapsedHandleProgress).toHaveTextContent('1/2');
    expect(collapsedHandleProgress).toHaveTextContent('Done (50%)');
  });

  // @verifies spec-ft-core-webui-shell::TASK-CORE-006-35::REQ-024
  it('counts Rewritten and Completed tasks as done in child feature task sub-views and resolves blockers', () => {
    const epicWithFeatures = {
      ...mockEpic,
      features: [
        {
          id: 'ft-core-mcp-tools',
          name: 'Deterministic MCP Tool Gates & Code Annotations',
          tasks: [
            { id: 'TASK-CORE-005-1', title: 'Task 1', status: 'Done' },
            { id: 'TASK-CORE-005-2', title: 'Task 2', status: 'Done' },
            { id: 'TASK-CORE-005-3', title: 'Task 3', status: 'Rewritten' },
            { id: 'TASK-CORE-005-4', title: 'Task 4', status: 'Done', blocked_by: ['TASK-CORE-005-3'] },
          ],
        },
      ],
    };

    render(<EpicHubView epic={epicWithFeatures} />);

    // Child feature header progress should show 4/4 Done (100%)
    expect(screen.getByText('4/4 Done (100%)')).toBeInTheDocument();

    // Check Rewritten status badge has emerald styling
    const rewrittenBadge = screen.getByText('Rewritten');
    expect(rewrittenBadge).toHaveClass('bg-emerald-950');

    // Dependent task blocked_by TASK-CORE-005-3 should show resolved (Done)
    expect(screen.getByText(/TASK-CORE-005-3 \(Done\)/)).toBeInTheDocument();
  });

  // @verifies ft-core-assets-manager::TASK-ASSET-008::REQ-011
  it('renders (x) count badge only when asset count is greater than zero and omits badge when zero', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/assets')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'a1',
              filename: 'diagram.png',
              path: 'assets/diagram.png',
              scope_type: 'epic',
              scope_id: '001-aico-core',
              source_label: '001-aico-core',
              is_subfeature: false,
              mime_type: 'image/png',
              size_bytes: 1024,
              updated_at: '2026-10-15T00:00:00Z',
            },
            {
              id: 'a2',
              filename: 'doc.txt',
              path: 'assets/doc.txt',
              scope_type: 'epic',
              scope_id: '001-aico-core',
              source_label: '001-aico-core',
              is_subfeature: false,
              mime_type: 'text/plain',
              size_bytes: 512,
              updated_at: '2026-10-15T00:00:00Z',
            },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }));

    const { rerender } = render(<EpicHubView epic={mockEpic} />);

    // Non-zero asset count badge appears
    const badge = await screen.findByTestId('asset-counter-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('(2)');

    // Now re-render with zero assets
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/assets')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }));

    rerender(<EpicHubView epic={{ ...mockEpic, id: '002-empty-epic' }} />);
    // Badge should not be in the document
    await waitFor(() => {
      expect(screen.queryByTestId('asset-counter-badge')).toBeNull();
    });
  });

  // @verifies ft-core-code-navigation-and-search::TASK-CORE-013-4::REQ-008
  it('renders aggregated Code Files section rolling up implementations across child features', () => {
    const handleSelectCode = vi.fn();
    const epicWithFeatures = {
      ...mockEpic,
      features: [
        {
          id: 'ft-core-host-runtime',
          name: 'Host Runtime',
          status: 'Done',
          epic_id: '001-aico-core',
          tasks: [],
        },
      ],
    };

    const mockCodeFiles = [
      {
        path: 'crates/aico-server/src/server.rs',
        name: 'server.rs',
        annotations: [
          {
            kind: 'implements',
            target: 'ft-core-host-runtime::TASK-CORE-001::REQ-001',
            line: 14,
            task: 'TASK-CORE-001',
            req: 'REQ-001',
          },
        ],
      },
    ];

    render(
      <EpicHubView
        epic={epicWithFeatures}
        codeFiles={mockCodeFiles}
        onSelectCode={handleSelectCode}
      />
    );

    // Verify Code Files section exists
    const codeFilesSection = screen.getByTestId('section-epic-code-files');
    expect(codeFilesSection).toBeInTheDocument();
    expect(screen.getByText(/Code Files \(1 file\)/)).toBeInTheDocument();

    // Expand the Code Files section
    fireEvent.click(screen.getByText(/Code Files \(1 file\)/));

    // Verify matching code file link is rendered and clickable
    const fileLink = screen.getByTestId('epic-code-file-crates/aico-server/src/server.rs');
    expect(fileLink).toBeInTheDocument();
    fireEvent.click(fileLink);
    expect(handleSelectCode).toHaveBeenCalledWith('crates/aico-server/src/server.rs');
  });

  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-006
  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-011
  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-9::REQ-017
  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-9::REQ-018
  it('renders 6-column Epic lineage graph with SVG edges and expands feature tasks on drilldown', () => {
    const nodes = [
      { id: 'ADR-0004', type: 'adr', label: 'ADR-0004: React Frontend' },
      { id: 'ec-core', type: 'epic', label: 'Epic ec-core' },
      { id: 'ft-core-1', type: 'feature', label: 'Feature ft-core-1' },
      { id: 'spec-ft-core-1', type: 'spec', label: 'spec-ft-core-1: Spec' },
      { id: 'plan-ft-core-1', type: 'plan', label: 'plan-ft-core-1: Plan' },
      { id: 'TASK-CORE-001', type: 'task', label: 'TASK-CORE-001' },
      { id: 'code:server.rs', type: 'code', label: 'server.rs' },
    ];
    const edges = [
      { id: 'e1', source: 'ADR-0004', target: 'ec-core' },
      { id: 'e2', source: 'ec-core', target: 'ft-core-1' },
      { id: 'e3', source: 'ft-core-1', target: 'spec-ft-core-1' },
      { id: 'e4', source: 'spec-ft-core-1', target: 'plan-ft-core-1' },
      { id: 'e5', source: 'plan-ft-core-1', target: 'code:server.rs' },
      { id: 'e6', source: 'plan-ft-core-1', target: 'TASK-CORE-001' },
    ];

    render(<VisualLineageCanvas nodes={nodes} edges={edges} />);

    expect(screen.getByText('ADR-0004: React Frontend')).toBeInTheDocument();
    expect(screen.getByTestId('node-Feature ft-core-1')).toBeInTheDocument();
    expect(screen.queryByText('TASK-CORE-001')).toBeNull();

    // Click feature node to trigger drilldown
    const featNode = screen.getByTestId('node-Feature ft-core-1');
    fireEvent.click(featNode);
    expect(screen.getByText('TASK-CORE-001')).toBeInTheDocument();
  });

  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-6::REQ-013
  it('persists manual feature collapse state in useAccordionStore across remounts and resets on resetEntity', () => {
    const epicWithFeatures = {
      ...mockEpic,
      features: [
        {
          id: 'ft-core-1',
          name: 'Feature 1',
          status: 'Completed',
          tasks: [
            { id: 'TASK-1', title: 'Task 1', status: 'Done' },
          ],
        },
      ],
    };

    // 1. First render: completed feature starts collapsed
    const { unmount } = render(<EpicHubView epic={epicWithFeatures} />);
    const taskList = screen.getByTestId('feature-task-list-ft-core-1');
    expect(taskList).toHaveClass('hidden');

    // 2. User expands the completed feature
    const header = screen.getByTestId('feature-header-ft-core-1');
    fireEvent.click(header);
    expect(taskList).not.toHaveClass('hidden');

    // 3. User switches tabs (unmounting EpicHubView) and returns (remounting EpicHubView)
    unmount();
    render(<EpicHubView epic={epicWithFeatures} />);

    // REQ-013: The feature must remain expanded across remounts!
    const remountedTaskList = screen.getByTestId('feature-task-list-ft-core-1');
    expect(remountedTaskList).not.toHaveClass('hidden');

    // 4. Tab is closed -> resetEntity is invoked
    useAccordionStore.getState().resetEntity('001-aico-core');

    // 5. Epic is reopened later -> resets to default (completed features collapsed)
    render(<EpicHubView epic={epicWithFeatures} />);
    const resetTaskList = screen.getAllByTestId('feature-task-list-ft-core-1')[0];
    expect(resetTaskList).toHaveClass('hidden');
  });

  // @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-8::REQ-011
  it('formats inline markdown in task deliverables and ADR decisions without showing raw syntax', () => {
    const epicWithDeliverables = {
      ...mockEpic,
      adrs: ['ADR-0004'],
      features: [
        {
          id: 'ft-core-active',
          name: 'Active Feature',
          status: 'In Progress',
          tasks: [
            {
              id: 'TASK-1',
              title: 'Task 1',
              status: 'In Progress',
              deliverables: ['Updates **DashboardView** in `DashboardView.tsx`'],
            },
          ],
        },
      ],
    };

    const allAdrs = [
      {
        id: 'ADR-0004',
        title: 'React Frontend',
        status: 'Accepted',
        decision: 'Use **React 19** with `Tailwind CSS`.',
      },
    ];

    const { container } = render(<EpicHubView epic={epicWithDeliverables} allAdrs={allAdrs} />);

    // Expand ADRs section
    fireEvent.click(screen.getByText(/Architecture Decision Records/));

    const strongTexts = Array.from(container.querySelectorAll('strong')).map((el) => el.textContent);
    expect(strongTexts).toContain('DashboardView');
    expect(strongTexts).toContain('React 19');

    const codeTexts = Array.from(container.querySelectorAll('code')).map((el) => el.textContent);
    expect(codeTexts).toContain('DashboardView.tsx');
    expect(codeTexts).toContain('Tailwind CSS');
  });
});
