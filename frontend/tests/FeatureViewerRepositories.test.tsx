import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { FeatureViewer, type FeatureData } from '../src/features/feature-viewer/FeatureViewer';

// @verifies ft-git-dashboard-ui::TASK-GIT-003-2::REQ-004
// @verifies ft-core-repository-badges-alignment::TASK-CORE-008-1::REQ-001
// @verifies ft-core-repository-badges-alignment::TASK-CORE-008-1::REQ-002
// @verifies ft-core-repository-badges-alignment::TASK-CORE-008-2::REQ-004
describe('FeatureViewer Target Repositories', () => {
  it('displays target repository badge pills in the header under title with icon only', () => {
    const mockFeature: FeatureData = {
      id: 'ft-git-backend-status',
      name: 'Git Status Inspection Engine',
      status: 'In Progress',
      specId: 'spec-ft-git-backend-status',
      planId: 'plan-ft-git-backend-status',
      repositories: ['aico', 'aico-specs'],
      tasks: [],
    };

    render(<FeatureViewer feature={mockFeature} />);

    // Verify repositories list container is rendered
    const repoList = screen.getByTestId('feature-repositories-list');
    expect(repoList).toBeInTheDocument();

    // Verify icon with title="Repositories"
    expect(screen.getByTitle('Repositories')).toBeInTheDocument();

    // Verify absence of textual "Repositories:" label
    expect(screen.queryByText('Repositories:')).toBeNull();

    // Verify spec and plan jump badges are omitted under title
    expect(screen.queryByTestId('spec-badge-link')).toBeNull();
    expect(screen.queryByTestId('plan-badge-link')).toBeNull();

    // Verify badges for each declared repository
    expect(screen.getByTestId('feature-repo-badge-aico')).toHaveTextContent('aico');
    expect(screen.getByTestId('feature-repo-badge-aico-specs')).toHaveTextContent('aico-specs');
  });

  it('does not render repository container when feature has no repositories', () => {
    const mockFeatureNoRepos: FeatureData = {
      id: 'ft-no-repos',
      name: 'Feature Without Repositories',
      status: 'In Progress',
      specId: 'spec-ft-no-repos',
      planId: 'plan-ft-no-repos',
      tasks: [],
    };

    render(<FeatureViewer feature={mockFeatureNoRepos} />);
    expect(screen.queryByTestId('feature-repositories-list')).toBeNull();
  });

  // @verifies ft-core-repository-badges-alignment::TASK-CORE-008-3::REQ-005
  it('preserves loaded repository badges across prop updates or re-renders even if subsequent prop payload omits repositories', () => {
    const initialWithRepos: FeatureData = {
      id: 'ft-git-backend-status',
      name: 'Git Status Inspection Engine',
      status: 'In Progress',
      repositories: ['aico', 'aico-specs'],
      tasks: [],
    };

    const { rerender } = render(<FeatureViewer feature={initialWithRepos} />);
    expect(screen.getByTestId('feature-repositories-list')).toBeInTheDocument();
    expect(screen.getByTestId('feature-repo-badge-aico')).toHaveTextContent('aico');

    // Simulate re-render where initialFeature is re-passed without repositories (e.g. from tab switch / window blur)
    const reRenderedWithoutRepos: FeatureData = {
      id: 'ft-git-backend-status',
      name: 'Git Status Inspection Engine',
      status: 'In Progress',
      repositories: undefined,
      tasks: [],
    };

    rerender(<FeatureViewer feature={reRenderedWithoutRepos} />);

    // Repository badges must still remain mounted without disappearing
    expect(screen.getByTestId('feature-repositories-list')).toBeInTheDocument();
    expect(screen.getByTestId('feature-repo-badge-aico')).toHaveTextContent('aico');
    expect(screen.getByTestId('feature-repo-badge-aico-specs')).toHaveTextContent('aico-specs');
  });
});

