import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EpicHubView } from '../src/features/epic-hub/EpicHubView';

// @verifies SPEC-CORE-007::REQ-001
// @verifies SPEC-CORE-007::REQ-002
// @verifies SPEC-CORE-007::REQ-005
// @verifies SPEC-CORE-007::REQ-011
describe('EpicHubView Component', () => {
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

    // Check accordion headers
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Brainstorm')).toBeInTheDocument();
    expect(screen.getByText('Specifications')).toBeInTheDocument();
    expect(screen.getByText('Deep Dive')).toBeInTheDocument();
    expect(screen.getByText('Task Plan')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();

    // Pop-out button on Specifications accordion
    const popoutBtn = screen.getByTestId('popout-specifications');
    fireEvent.click(popoutBtn);
    expect(onPopOut).toHaveBeenCalledWith('001-aico-core', 'specifications');
  });
});
