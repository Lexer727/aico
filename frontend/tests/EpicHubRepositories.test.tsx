import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { EpicHubView, type EpicData } from '../src/features/epic-hub/EpicHubView';

// @verifies spec-ft-git-dashboard-ui::REQ-003
// @verifies spec-ft-core-repository-badges-alignment::REQ-003
// @verifies spec-ft-core-repository-badges-alignment::REQ-004
describe('EpicHubView Repositories Roll-up', () => {
  it('dynamically aggregates and displays repositories declared across child feature plans under title with icon only', () => {
    const mockEpic: EpicData = {
      id: 'ec-git',
      title: 'AICO Multi-Repo Git Integration',
      status: 'In Progress',
      features: [
        {
          id: 'ft-git-backend-status',
          name: 'Git Status Backend',
          status: 'Done',
          repositories: ['aico', 'aico-specs'],
        },
        {
          id: 'ft-git-skills-traceability',
          name: 'Skills Traceability',
          status: 'Done',
          repositories: ['aico-skills', 'aico-specs'],
        },
        {
          id: 'ft-git-dashboard-ui',
          name: 'Dashboard UI',
          status: 'In Progress',
          repositories: ['aico'],
        },
      ],
    };

    render(<EpicHubView epic={mockEpic} />);

    // Verify repositories list container is rendered
    expect(screen.getByTestId('epic-repositories-list')).toBeInTheDocument();

    // Verify icon with title="Repositories"
    expect(screen.getByTitle('Repositories')).toBeInTheDocument();

    // Verify absence of textual "Repositories:" label
    expect(screen.queryByText('Repositories:')).toBeNull();

    // Verify union of repositories: aico, aico-specs, aico-skills
    expect(screen.getByTestId('epic-repo-badge-aico')).toHaveTextContent('aico');
    expect(screen.getByTestId('epic-repo-badge-aico-specs')).toHaveTextContent('aico-specs');
    expect(screen.getByTestId('epic-repo-badge-aico-skills')).toHaveTextContent('aico-skills');
  });

  it('displays repositories directly if specified on the epic', () => {
    const mockEpicDirect: EpicData = {
      id: 'ec-direct',
      title: 'Direct Repositories Epic',
      status: 'In Progress',
      repositories: ['aico', 'aico-specs'],
      features: [],
    };

    render(<EpicHubView epic={mockEpicDirect} />);

    expect(screen.getByTestId('epic-repositories-list')).toBeInTheDocument();
    expect(screen.getByTestId('epic-repo-badge-aico')).toHaveTextContent('aico');
    expect(screen.getByTestId('epic-repo-badge-aico-specs')).toHaveTextContent('aico-specs');
  });
});
