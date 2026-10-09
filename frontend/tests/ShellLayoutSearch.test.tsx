import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ShellLayout } from '../src/components/layout/ShellLayout';
import type { DiscoveredEpic, DiscoveredFeature } from '../src/features/feature-task-data';

describe('ShellLayoutSearch: Sidebar Tree Fuzzy Filtering & Section Auto-Expansion', () => {
  const mockEpics: DiscoveredEpic[] = [
    {
      id: 'ec-core',
      title: 'AICO Core SDD Platform',
      status: 'Completed',
      executive_summary: 'Axum server runtime and web daemon.',
      specs: [
        { id: 'spec-ft-core-host-runtime', title: 'spec-ft-core-host-runtime', status: 'Completed', path: '' },
      ],
    },
  ];

  const mockFeatures: DiscoveredFeature[] = [
    {
      id: 'ft-core-host-runtime',
      name: 'Host Runtime Daemon',
      epic_id: 'ec-core',
      status: 'Completed',
      description: 'Axum server lifecycle daemon.',
      tasks: [
        { id: 'TASK-001', title: 'Graceful Listener', description: 'Graceful listener shutdown drain', status: 'Done' }
      ],
    },
  ];

  // @verifies spec-ft-core-omni-search-fulltext::REQ-003
  it('auto-expands matching accordion sections and finds items via fuzzy typo and task description', () => {
    render(
      <ShellLayout
        fullEpics={mockEpics}
        fullFeatures={mockFeatures}
      >
        <div>Content</div>
      </ShellLayout>
    );

    const searchInput = screen.getByTestId('sidebar-search-input');

    // Enter a search term with a typo for the feature id: 'ft-cor-host-runtime'
    fireEvent.change(searchInput, { target: { value: 'ft-cor-host-runtime' } });

    // The Features accordion section must automatically expand to display the matching feature
    expect(screen.getByTestId('nav-feature-ft-core-host-runtime')).toBeInTheDocument();

    // Now search for a term that only exists in a child task description: 'shutdown drain'
    fireEvent.change(searchInput, { target: { value: 'shutdown drain' } });

    // The feature should still match and be visible!
    expect(screen.getByTestId('nav-feature-ft-core-host-runtime')).toBeInTheDocument();
  });

  // @verifies spec-ft-core-omni-search-fulltext::REQ-004
  it('honors active scope checkboxes when filtering search results', () => {
    render(
      <ShellLayout
        fullEpics={mockEpics}
        fullFeatures={mockFeatures}
      >
        <div>Content</div>
      </ShellLayout>
    );

    const searchInput = screen.getByTestId('sidebar-search-input');
    fireEvent.change(searchInput, { target: { value: 'host' } });

    // Both feature and spec should be found initially
    expect(screen.getByTestId('nav-feature-ft-core-host-runtime')).toBeInTheDocument();

    // Uncheck "Features" scope checkbox
    const featureScopeCheckbox = screen.getByRole('checkbox', { name: /features/i });
    fireEvent.click(featureScopeCheckbox);

    // Feature should now be hidden because its scope is disabled
    expect(screen.queryByTestId('nav-feature-ft-core-host-runtime')).not.toBeInTheDocument();
  });
});
