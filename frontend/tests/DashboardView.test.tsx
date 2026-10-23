import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DashboardView } from '../src/features/dashboard/DashboardView';

// @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-1::REQ-001
// @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-1::REQ-007
// @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-2::REQ-006
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

  it('renders project epics with TagBadge navigation and omits bulky Open Epic button', () => {
    const onOpenEpic = vi.fn();
    const onOpenSpec = vi.fn();
    const epics = [
      {
        id: 'ec-core',
        title: 'AICO Core SDD Platform',
        status: 'Completed',
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

    render(<DashboardView onOpenEpic={onOpenEpic} onOpenSpec={onOpenSpec} epics={epics} />);

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

    // Clicking Spec TagBadge opens spec
    const specBadge = screen.getByTestId('tag-badge-spec-ft-core-host-runtime');
    expect(specBadge).toBeInTheDocument();
    fireEvent.click(specBadge);
    expect(onOpenSpec).toHaveBeenCalledWith('spec-ft-core-host-runtime', 'spec-ft-core-host-runtime');
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
