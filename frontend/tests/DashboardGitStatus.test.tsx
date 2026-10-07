import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DashboardView } from '../src/features/dashboard/DashboardView';
import type { GitRepoStatus } from '../src/features/feature-task-data';

// @verifies spec-ft-git-dashboard-ui::REQ-001
// @verifies spec-ft-git-dashboard-ui::REQ-002
// @verifies spec-ft-git-dashboard-ui::REQ-005
describe('DashboardView Git Repositories Status', () => {
  const mockGitStatuses: GitRepoStatus[] = [
    {
      id: 'aico',
      name: 'AICO Engine & WebUI',
      path: 'd:/dev/aico',
      type: 'codebase',
      is_available: true,
      branch: 'main',
      upstream: 'origin/main',
      ahead: 2,
      behind: 0,
      staged_count: 1,
      unstaged_count: 0,
      untracked_count: 0,
      is_clean: false,
      latest_commit: {
        hash: '0e0da2fabc',
        message: 'feat: add git engine',
        author: 'Lexer727',
        timestamp: '2026-10-07T02:00:00Z',
      },
      error: null,
    },
    {
      id: 'aico-specs',
      name: 'AICO Specs',
      path: 'd:/aico/aico-specs',
      type: 'specs',
      is_available: true,
      branch: 'master',
      upstream: 'origin/master',
      ahead: 0,
      behind: 1,
      staged_count: 0,
      unstaged_count: 0,
      untracked_count: 0,
      is_clean: true,
      latest_commit: null,
      error: null,
    },
    {
      id: 'missing-repo',
      name: 'External Docs',
      path: 'd:/missing/docs',
      type: 'skills',
      is_available: false,
      branch: null,
      upstream: null,
      ahead: 0,
      behind: 0,
      staged_count: 0,
      unstaged_count: 0,
      untracked_count: 0,
      is_clean: true,
      latest_commit: null,
      error: 'Directory does not exist',
    },
  ];

  it('renders codebase repositories widget with branch, ahead/behind, and clean status', () => {
    render(
      <DashboardView
        onOpenEpic={vi.fn()}
        onOpenSpec={vi.fn()}
        gitStatuses={mockGitStatuses}
      />
    );

    // Repositories card header
    expect(screen.getByTestId('git-repositories-card')).toBeInTheDocument();
    expect(screen.getByText('Codebase Repositories')).toBeInTheDocument();

    // Verify 3 repository cards rendered
    expect(screen.getByTestId('git-repo-card-aico')).toBeInTheDocument();
    expect(screen.getByTestId('git-repo-card-aico-specs')).toBeInTheDocument();
    expect(screen.getByTestId('git-repo-card-missing-repo')).toBeInTheDocument();

    // Verify repository AICO details
    expect(screen.getByText('AICO Engine & WebUI')).toBeInTheDocument();
    expect(screen.getByTestId('git-branch-aico')).toHaveTextContent('main');
    expect(screen.getByTestId('git-ahead-behind-aico')).toHaveTextContent('2');
    expect(screen.getByTestId('git-clean-status-aico')).toHaveTextContent(/Modified/);

    // Verify repository AICO Specs details
    expect(screen.getByText('AICO Specs')).toBeInTheDocument();
    expect(screen.getByTestId('git-branch-aico-specs')).toHaveTextContent('master');
    expect(screen.getByTestId('git-ahead-behind-aico-specs')).toHaveTextContent('1');
    expect(screen.getByTestId('git-clean-status-aico-specs')).toHaveTextContent('Clean');

    // Verify graceful handling of unavailable repository
    expect(screen.getByTestId('git-unavailable-missing-repo')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });
});
