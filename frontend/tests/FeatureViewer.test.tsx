import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FeatureViewer } from '../src/features/feature-viewer/FeatureViewer';
import { useAccordionStore } from '../src/stores/useAccordionStore';

// @verifies spec-ft-core-epic-hub::REQ-001
// @verifies spec-ft-core-epic-hub::REQ-004
describe('FeatureViewer Component', () => {
  beforeEach(() => {
    useAccordionStore.setState({ collapsedByEntity: {} });
  });

  const mockFeature = {
    id: '01-host-runtime',
    name: 'Host Runtime & Local Server',
    epicId: '001-aico-core',
    specId: 'spec-ft-core-host-runtime',
    specTitle: 'Host Runtime & Local HTTP/WebSocket Server',
    planId: 'PLAN-CORE-001',
    planTitle: 'Host Runtime & Local Axum Server',
    status: 'Completed',
  };

  // @verifies spec-ft-core-repository-badges-alignment::REQ-001
  it('omits spec and plan tags under title and provides popout actions for linked SPEC and PLAN', () => {
    const onOpenSpec = vi.fn();
    const onOpenPlan = vi.fn();

    render(
      <FeatureViewer
        feature={mockFeature}
        onOpenSpec={onOpenSpec}
        onOpenPlan={onOpenPlan}
      />
    );

    expect(screen.getByText('FEATURE: 01-host-runtime')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Host Runtime & Local Server' })).toBeInTheDocument();

    // Header spec/plan badges are removed per REQ-001
    expect(screen.queryByTestId('spec-badge-link')).toBeNull();
    expect(screen.queryByTestId('plan-badge-link')).toBeNull();

    // Opening spec and plan is supported via accordion popout actions
    const specPopout = screen.getByTestId('popout-specifications');
    fireEvent.click(specPopout);
    expect(onOpenSpec).toHaveBeenCalledWith('spec-ft-core-host-runtime', 'Host Runtime & Local HTTP/WebSocket Server');

    const planPopout = screen.getByTestId('popout-taskPlan');
    fireEvent.click(planPopout);
    expect(onOpenPlan).toHaveBeenCalledWith('PLAN-CORE-001', 'Host Runtime & Local Axum Server');
  });

  it('renders Task Execution Progress bar in the handle of Task Plan even when collapsed', () => {
    const featureWithTasks = {
      ...mockFeature,
      tasks: [
        { id: 'TASK-01', title: 'Task 1', status: 'Done', blocked_by: [] },
        { id: 'TASK-02', title: 'Task 2', status: 'In Progress', blocked_by: ['TASK-01'] },
      ],
    };

    render(<FeatureViewer feature={featureWithTasks} />);

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

  it('renders Specs accordion with Scope Boundaries, EARS requirements, and Designated Public Test Seams', () => {
    const featureWithSpecs = {
      ...mockFeature,
      description: 'Custom Executive Summary for feature',
      in_scope: ['In-scope item 1', 'In-scope item 2'],
      out_of_scope: ['Out-of-scope item 1'],
      requirements: [
        { id: 'REQ-001', pattern: 'Ubiquitous', statement: 'The system shall boot deterministically.', status: 'Verified' },
      ],
      test_seams: [
        { id: 'SEAM-001', path: 'crates/aico-server/src/server.rs', description: 'HTTP bind seam' },
      ],
    };

    render(<FeatureViewer feature={featureWithSpecs} />);

    // Executive summary in overview is visible
    expect(screen.getByText('Custom Executive Summary for feature')).toBeInTheDocument();

    // Specs accordion header is visible
    const specsAccordion = screen.getByText(/Specs \(1 Reqs • 1 Seams\)/);
    expect(specsAccordion).toBeInTheDocument();

    // Initially closed: in-scope items not visible
    expect(screen.queryByText('In-scope item 1')).toBeNull();

    // Click to open Specs
    fireEvent.click(specsAccordion);

    // In-Scope and Out-of-Scope items become visible inside Specs
    expect(screen.getByText('In-scope item 1')).toBeInTheDocument();
    expect(screen.getByText('In-scope item 2')).toBeInTheDocument();
    expect(screen.getByText('Out-of-scope item 1')).toBeInTheDocument();

    // EARS Requirements and Test Seams are visible inside Specs
    expect(screen.getByText('The system shall boot deterministically.')).toBeInTheDocument();
    expect(screen.getByText('crates/aico-server/src/server.rs')).toBeInTheDocument();
  });

  it('renders Deep Dive with zero placeholder or random info when no artifact exists, and shows content when present', () => {
    // Feature with NO deep dive artifact created
    const featureWithoutDeepDive = {
      ...mockFeature,
      test_seams: [
        { id: 'SEAM-001', path: 'crates/aico-server/src/server.rs', description: 'Migration Verification seam' },
      ],
    };

    const { rerender } = render(<FeatureViewer feature={featureWithoutDeepDive} />);

    // Deep Dive accordion shows "No deep dive artifact defined"
    expect(screen.getByText(/No deep dive artifact defined/)).toBeInTheDocument();

    // Expand Deep Dive accordion
    const deepDiveHeader = screen.getByText('Deep Dive');
    fireEvent.click(deepDiveHeader);

    // Deep Dive must NOT show test seams from spec.md!
    expect(screen.queryByText('Migration Verification seam')).toBeNull();
    // It displays strict no artifact notice, NOT a placeholder or test seams
    expect(screen.getByText(/No deep dive artifact \(deepdive-ft-\*\.md\) created for this feature\./)).toBeInTheDocument();

    // Now re-render with an actual deepdive_content artifact
    const featureWithDeepDive = {
      ...mockFeature,
      deepdive_content: 'Kùzu graph blast-radius traversal designating boundaries.',
    };

    rerender(<FeatureViewer feature={featureWithDeepDive} />);
    expect(screen.getByText(/Kùzu graph blast-radius traversal/)).toBeInTheDocument();
  });

  it('renders ADRs accordion under Brainstorm with linked architecture decision records', () => {
    const featureWithAdrs = {
      ...mockFeature,
      adrs: ['ADR-0010'],
    };
    const mockAllAdrs = [
      { id: 'ADR-0010', title: 'SDD Structural Grammar', status: 'Accepted', decision: 'Implement single PID architecture.' },
    ];
    const onOpenAdr = vi.fn();

    render(<FeatureViewer feature={featureWithAdrs} allAdrs={mockAllAdrs} onOpenAdr={onOpenAdr} />);

    // ADR accordion header is present
    const adrHeader = screen.getByText(/Architecture Decision Records \(1\)/);
    expect(adrHeader).toBeInTheDocument();

    // Click to open ADR accordion
    fireEvent.click(adrHeader);

    // ADR card is rendered with title and status
    expect(screen.getByText('SDD Structural Grammar')).toBeInTheDocument();
    expect(screen.getByText('Implement single PID architecture.')).toBeInTheDocument();

    // Click to open ADR
    fireEvent.click(screen.getByText('SDD Structural Grammar'));
    expect(onOpenAdr).toHaveBeenCalledWith('ADR-0010');
  });

  it('correctly resolves cross-feature dependencies with titles as Done and renders Depends on:', () => {
    const featureWithDep = {
      ...mockFeature,
      id: 'ft-core-security-auth',
      name: 'Security & Auth',
      tasks: [
        {
          id: 'TASK-CORE-002-4',
          title: 'Interactive WebSocket Gating',
          status: 'Done' as const,
          addresses: ['REQ-004'],
          blocked_by: ['TASK-CORE-001-3 (WebSocket Hub)'],
          seam: 'tests/security_gate_test.rs',
          deliverables: ['ApprovalGateManager implementation'],
        },
      ],
    };

    const mockAllFeatures = [
      {
        id: 'ft-core-host-runtime',
        name: 'Host Runtime',
        status: 'Completed',
        tasks: [
          {
            id: 'TASK-CORE-001-3',
            title: 'WebSocket Hub',
            status: 'Done' as const,
            addresses: ['REQ-003'],
            blocked_by: [],
          },
        ],
      },
    ];

    render(
      <FeatureViewer
        feature={featureWithDep}
        allFeatures={mockAllFeatures}
      />
    );

    // Should render "Depends on:" because all blockers are Done
    expect(screen.getByText('Depends on:')).toBeInTheDocument();

    // Dependency pill should show Done and have green styling
    const depPill = screen.getByText(/TASK-CORE-001-3 \(WebSocket Hub\) \(Done\)/);
    expect(depPill).toBeInTheDocument();
    expect(depPill.className).toContain('text-emerald-400');
  });

  it('shows red Pending and Blocked by: when blocking dependency is still pending', () => {
    const featureWithPendingDep = {
      ...mockFeature,
      id: 'ft-core-security-auth',
      name: 'Security & Auth',
      tasks: [
        {
          id: 'TASK-CORE-002-4',
          title: 'Interactive WebSocket Gating',
          status: 'Done' as const,
          addresses: ['REQ-004'],
          blocked_by: ['TASK-CORE-001-9 (Unfinished Service)'],
          seam: 'tests/security_gate_test.rs',
          deliverables: ['ApprovalGateManager implementation'],
        },
      ],
    };

    const mockAllFeatures = [
      {
        id: 'ft-core-host-runtime',
        name: 'Host Runtime',
        status: 'In Progress',
        tasks: [
          {
            id: 'TASK-CORE-001-9',
            title: 'Unfinished Service',
            status: 'Pending' as const,
            addresses: ['REQ-009'],
            blocked_by: [],
          },
        ],
      },
    ];

    render(
      <FeatureViewer
        feature={featureWithPendingDep}
        allFeatures={mockAllFeatures}
      />
    );

    // Should render "Blocked by:" because blocker is not Done
    expect(screen.getByText('Blocked by:')).toBeInTheDocument();

    // Dependency pill should show Pending and have red styling
    const depPill = screen.getByText(/TASK-CORE-001-9 \(Unfinished Service\) \(Pending\)/);
    expect(depPill).toBeInTheDocument();
    expect(depPill.className).toContain('text-rose-400');
  });

  // @verifies spec-ft-core-assets-manager::REQ-012
  it('preserves accordion expansion state per entity ID across switches', () => {
    const feature1 = {
      ...mockFeature,
      id: 'ft-01-first',
      name: 'First Feature',
    };
    const feature2 = {
      ...mockFeature,
      id: 'ft-02-second',
      name: 'Second Feature',
    };

    // Render Feature 1
    const { rerender } = render(<FeatureViewer key={feature1.id} feature={feature1} />);

    // Initially assets panel is collapsed
    const assetsHeaderF1 = screen.getByText('Assets');
    fireEvent.click(assetsHeaderF1);

    // Now in the store, ft-01-first assets is expanded (collapsed: false)
    expect(useAccordionStore.getState().isSectionCollapsed('ft-01-first', 'assets', true)).toBe(false);

    // Switch to Feature 2
    rerender(<FeatureViewer key={feature2.id} feature={feature2} />);

    // Feature 2's assets panel must still be in its own default state (collapsed: true)
    expect(useAccordionStore.getState().isSectionCollapsed('ft-02-second', 'assets', true)).toBe(true);

    // Expand Deep Dive on Feature 2
    const deepDiveHeaderF2 = screen.getByText('Deep Dive');
    fireEvent.click(deepDiveHeaderF2);
    expect(useAccordionStore.getState().isSectionCollapsed('ft-02-second', 'deepDive', true)).toBe(false);

    // Switch back to Feature 1
    rerender(<FeatureViewer key={feature1.id} feature={feature1} />);

    // Feature 1 preserves its opened Assets panel
    expect(useAccordionStore.getState().isSectionCollapsed('ft-01-first', 'assets', true)).toBe(false);
    // And its Deep Dive was never opened
    expect(useAccordionStore.getState().isSectionCollapsed('ft-01-first', 'deepDive', true)).toBe(true);
  });
});
