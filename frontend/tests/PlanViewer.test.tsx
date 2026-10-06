import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PlanViewer } from '../src/features/plan-viewer/PlanViewer';

// Mock fetchFeature and helpers to return a mock feature plan
vi.mock('../src/features/feature-task-data', () => ({
  fetchFeature: vi.fn().mockImplementation((id: string) =>
    Promise.resolve({
      id: 'ft-fast-trace',
      name: 'Fast Traceability Validator',
      epicId: 'ec-core',
      status: 'Completed',
      specId: 'spec-ft-fast-trace',
      planId: 'plan-ft-fast-trace',
      planTitle: 'Fast Traceability Validator Implementation Plan',
      tasks: [
        {
          id: 'TASK-01',
          title: 'Implement Scanner Engine',
          status: 'Done',
          addresses: ['REQ-001'],
          blocked_by: [],
          seam: 'crates/aico-core/src/trace.rs',
          deliverables: ['Scanner struct and public seam.'],
        },
        {
          id: 'TASK-02',
          title: 'Catalog Validator',
          status: 'Done',
          addresses: ['REQ-002'],
          blocked_by: ['TASK-01'],
          seam: 'crates/aico-core/tests/trace_test.rs',
          deliverables: ['Catalog matching algorithm.'],
        },
      ],
      raw_plan_content: '# Raw Plan Document\n\nFull raw DAG tasks content here.',
    })
  ),
  fetchAllFeatures: vi.fn().mockResolvedValue([]),
  extractTaskId: vi.fn().mockImplementation((dep: string) => {
    const m = dep.match(/TASK-[A-Za-z0-9-]+/i);
    return m ? m[0].toUpperCase() : null;
  }),
}));

// @verifies spec-ft-specs-blueprint-standards::REQ-004
// @verifies spec-ft-specs-blueprint-standards::REQ-010
describe('PlanViewer Component', () => {
  it('renders status in top right, aico_version below it, and no Back to Dashboard button', async () => {
    render(<PlanViewer planId="plan-ft-fast-trace" />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Fast Traceability Validator Implementation Plan' })).toBeInTheDocument();

    // Verify "Back to Dashboard" is NOT rendered
    expect(screen.queryByText(/Back to Dashboard/i)).not.toBeInTheDocument();

    // Verify status badge and aico_version are rendered
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('aico_version: 0.1.2')).toBeInTheDocument();
  });

  it('renders clickable tags for Feature, Epic, and Spec that trigger callbacks', async () => {
    const onOpenFeature = vi.fn();
    const onOpenEpic = vi.fn();
    const onOpenSpec = vi.fn();

    render(
      <PlanViewer
        planId="plan-ft-fast-trace"
        onOpenFeature={onOpenFeature}
        onOpenEpic={onOpenEpic}
        onOpenSpec={onOpenSpec}
      />
    );

    await screen.findByRole('heading', { level: 1, name: 'Fast Traceability Validator Implementation Plan' });

    // Feature tag
    const featTag = screen.getByTestId('tag-badge-ft-fast-trace');
    fireEvent.click(featTag);
    expect(onOpenFeature).toHaveBeenCalledWith('ft-fast-trace');

    // Epic tag
    const epicTag = screen.getByTestId('tag-badge-ec-core');
    fireEvent.click(epicTag);
    expect(onOpenEpic).toHaveBeenCalledWith('ec-core');

    // Spec tag
    const specTag = screen.getByTestId('tag-badge-spec-ft-fast-trace');
    fireEvent.click(specTag);
    expect(onOpenSpec).toHaveBeenCalledWith('spec-ft-fast-trace');
  });

  it('toggles between structured DAG and raw markdown with markdown toggle button', async () => {
    render(<PlanViewer planId="plan-ft-fast-trace" />);

    await screen.findByRole('heading', { level: 1, name: 'Fast Traceability Validator Implementation Plan' });

    // Initially in structured DAG view
    expect(screen.getByText('Implementation Tasks DAG (2)')).toBeInTheDocument();
    expect(screen.getByText('Implement Scanner Engine')).toBeInTheDocument();

    // Click markdown toggle button
    const mdToggle = screen.getByTestId('toggle-raw-markdown');
    fireEvent.click(mdToggle);

    // Shows raw markdown
    expect(screen.getByText(/Full raw DAG tasks content here/i)).toBeInTheDocument();
    expect(screen.queryByText('Implementation Tasks DAG (2)')).not.toBeInTheDocument();
  });
});
