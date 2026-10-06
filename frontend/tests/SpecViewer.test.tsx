import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SpecViewer } from '../src/features/spec-viewer/SpecViewer';

// Mock fetchFeature to return a mock feature spec
vi.mock('../src/features/feature-task-data', () => ({
  fetchFeature: vi.fn().mockImplementation((id: string) =>
    Promise.resolve({
      id: 'ft-fast-trace',
      name: 'Fast Traceability Validator',
      epicId: 'ec-core',
      status: 'Completed',
      specId: 'spec-ft-fast-trace',
      specTitle: 'Fast Traceability Validator Specification',
      planId: 'plan-ft-fast-trace',
      adrs: ['ADR-0010'],
      in_scope: ['In-scope item 1'],
      out_of_scope: ['Out-of-scope item 1'],
      requirements: [
        {
          id: 'REQ-001',
          pattern: 'Ubiquitous',
          statement: 'The system shall scan annotations in under 15ms.',
          status: 'Done',
          seam: 'crates/aico-core/src/trace.rs',
        },
      ],
      test_seams: [
        {
          path: 'crates/aico-core/tests/trace_test.rs::test_scan',
          description: 'Seam test description',
        },
      ],
      raw_spec_content: '# Raw Spec Document\n\nFull raw markdown content here.',
    })
  ),
}));

// @verifies spec-ft-specs-blueprint-standards::REQ-001
// @verifies spec-ft-specs-blueprint-standards::REQ-008
describe('SpecViewer Component', () => {
  it('renders status in top right with aico_skills_version below it, and no Back to Dashboard button', async () => {
    render(<SpecViewer specId="spec-ft-fast-trace" />);

    // Wait for mock data to resolve
    expect(await screen.findByRole('heading', { level: 1, name: 'Fast Traceability Validator Specification' })).toBeInTheDocument();

    // Verify "Back to Dashboard" is NOT rendered
    expect(screen.queryByText(/Back to Dashboard/i)).not.toBeInTheDocument();

    // Verify status badge and aico_skills_version are rendered
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('aico_skills_version: 0.1.2')).toBeInTheDocument();
  });

  it('renders clickable tags for Feature, Epic, and ADRs that trigger navigation callbacks', async () => {
    const onOpenFeature = vi.fn();
    const onOpenEpic = vi.fn();
    const onOpenAdr = vi.fn();
    const onOpenPlan = vi.fn();

    render(
      <SpecViewer
        specId="spec-ft-fast-trace"
        onOpenFeature={onOpenFeature}
        onOpenEpic={onOpenEpic}
        onOpenAdr={onOpenAdr}
        onOpenPlan={onOpenPlan}
      />
    );

    // Wait for content to load
    await screen.findByRole('heading', { level: 1, name: 'Fast Traceability Validator Specification' });

    // Feature tag
    const featTag = screen.getByTestId('tag-badge-ft-fast-trace');
    expect(featTag).toBeInTheDocument();
    fireEvent.click(featTag);
    expect(onOpenFeature).toHaveBeenCalledWith('ft-fast-trace');

    // Epic tag
    const epicTag = screen.getByTestId('tag-badge-ec-core');
    expect(epicTag).toBeInTheDocument();
    fireEvent.click(epicTag);
    expect(onOpenEpic).toHaveBeenCalledWith('ec-core');

    // ADR tag
    const adrTag = screen.getByTestId('tag-badge-adr-0010');
    expect(adrTag).toBeInTheDocument();
    fireEvent.click(adrTag);
    expect(onOpenAdr).toHaveBeenCalledWith('ADR-0010');

    // Plan tag
    const planTag = screen.getByTestId('tag-badge-plan-ft-fast-trace');
    expect(planTag).toBeInTheDocument();
    fireEvent.click(planTag);
    expect(onOpenPlan).toHaveBeenCalledWith('plan-ft-fast-trace');
  });

  it('toggles between structured view and raw markdown when clicking markdown icon button', async () => {
    render(<SpecViewer specId="spec-ft-fast-trace" />);

    // Wait for content
    await screen.findByRole('heading', { level: 1, name: 'Fast Traceability Validator Specification' });

    // Initially in structured view: Scope Boundaries and EARS Requirements visible
    expect(screen.getByText('Scope Boundaries')).toBeInTheDocument();
    expect(screen.getByText('EARS Formal Requirements (1)')).toBeInTheDocument();

    // Click markdown toggle button
    const mdToggle = screen.getByTestId('toggle-raw-markdown');
    expect(mdToggle).toBeInTheDocument();
    fireEvent.click(mdToggle);

    // Structured view is replaced by raw markdown view
    expect(screen.getByText(/Full raw markdown content here/i)).toBeInTheDocument();
    expect(screen.queryByText('Scope Boundaries')).not.toBeInTheDocument();

    // Click again to toggle back
    fireEvent.click(mdToggle);
    expect(screen.getByText('Scope Boundaries')).toBeInTheDocument();
  });
});
