import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { FeatureViewer, type FeatureData } from '../src/features/feature-viewer/FeatureViewer';

// @verifies spec-ft-git-dashboard-ui::REQ-004
// @verifies spec-ft-core-repository-badges-alignment::REQ-001
// @verifies spec-ft-core-repository-badges-alignment::REQ-002
// @verifies spec-ft-core-repository-badges-alignment::REQ-004
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
});
