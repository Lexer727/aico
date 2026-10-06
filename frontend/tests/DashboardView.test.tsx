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
});
