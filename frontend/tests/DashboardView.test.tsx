import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DashboardView } from '../src/features/dashboard/DashboardView';

// @verifies SPEC-CORE-007::REQ-007
describe('DashboardView Component', () => {
  it('renders workspace overview with both ec-core and ec-specs epics', () => {
    const onOpenEpic = vi.fn();
    const onOpenSpec = vi.fn();

    render(<DashboardView onOpenEpic={onOpenEpic} onOpenSpec={onOpenSpec} />);

    expect(screen.getByText('Workspace Overview')).toBeInTheDocument();
    expect(screen.getByText('ec-core')).toBeInTheDocument();
    expect(screen.getByText('ec-specs')).toBeInTheDocument();
    expect(screen.getByText('AICO Core SDD Platform')).toBeInTheDocument();
    expect(screen.getByText('AICO SDD Blueprints & Migration')).toBeInTheDocument();

    const openEpicBtns = screen.getAllByRole('button', { name: /open epic/i });
    expect(openEpicBtns.length).toBe(2);

    fireEvent.click(openEpicBtns[0]);
    expect(onOpenEpic).toHaveBeenCalledWith('ec-core');
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
