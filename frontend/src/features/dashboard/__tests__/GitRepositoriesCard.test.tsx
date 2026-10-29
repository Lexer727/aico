// @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-3::REQ-002
// @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-3::REQ-003
// @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-4::REQ-004
// @verifies spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-3::REQ-002
// @verifies spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-3::REQ-004
// @verifies spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-3::REQ-005
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-22::REQ-028
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-22::REQ-029

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitRepositoriesCard, type GitRepoStatusExtended } from '../GitRepositoriesCard';

const mockStatuses: GitRepoStatusExtended[] = [
  {
    id: 'aico-specs',
    name: 'AICO Specs',
    path: 'd:/aico/aico-specs',
    type: 'specs',
    url: 'https://github.com/Lexer727/aico-specs',
    is_available: true,
    is_cloned: true,
    branch: 'main',
    upstream: 'origin/main',
    ahead: 0,
    behind: 0,
    staged_count: 0,
    unstaged_count: 0,
    untracked_count: 0,
    is_clean: true,
    latest_commit: {
      hash: 'abc1234567890',
      message: 'docs: update specs',
      author: 'AICO Dev',
      timestamp: '2026-10-23T19:00:00Z',
    },
  },
  {
    id: 'aico',
    name: 'AICO Engine',
    path: 'd:/aico/codebase/aico',
    type: 'codebase',
    url: 'https://github.com/Lexer727/aico',
    is_available: true,
    is_cloned: true,
    branch: 'feature/git-workflow',
    upstream: 'origin/feature/git-workflow',
    ahead: 1,
    behind: 0,
    staged_count: 1,
    unstaged_count: 0,
    untracked_count: 0,
    is_clean: false,
    latest_commit: {
      hash: 'def4567890123',
      message: 'feat: add git endpoints',
      author: 'AICO Dev',
      timestamp: '2026-10-23T19:10:00Z',
    },
  },
  {
    id: 'aico-skills',
    name: 'AICO Skills',
    path: 'd:/aico/codebase/aico-skills',
    type: 'skills',
    url: 'https://github.com/Lexer727/aico-skills',
    is_available: true,
    is_cloned: true,
    branch: 'main',
    upstream: 'origin/main',
    ahead: 0,
    behind: 2,
    staged_count: 0,
    unstaged_count: 0,
    untracked_count: 0,
    is_clean: true,
  },
  {
    id: 'uncloned-repo',
    name: 'Uncloned Service',
    path: 'd:/aico/codebase/uncloned-repo',
    type: 'codebase',
    url: 'https://github.com/example/uncloned-repo',
    remote_url: 'https://github.com/example/uncloned-repo',
    is_available: false,
    is_cloned: false,
    branch: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    staged_count: 0,
    unstaged_count: 0,
    untracked_count: 0,
    is_clean: true,
  },
];

describe('GitRepositoriesCard', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/api/v1/git/status')) {
        return {
          ok: true,
          json: async () => mockStatuses,
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ status: 'ok', message: 'feat: automated commit' }),
      } as Response;
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  // @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-3::REQ-002
  it('renders all repositories in a unified responsive grid with Specs repo first', () => {
    render(<GitRepositoriesCard statuses={mockStatuses} projectName="aico" />);

    // Unified grid container
    const grid = screen.getByTestId('git-repositories-grid');
    expect(grid).toBeInTheDocument();
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('md:grid-cols-3');

    // All repositories are present in the same grid
    expect(screen.getByTestId('git-repo-card-aico-specs')).toBeInTheDocument();
    expect(screen.getByTestId('git-repo-card-aico')).toBeInTheDocument();
    expect(screen.getByTestId('git-repo-card-aico-skills')).toBeInTheDocument();
    expect(screen.getByTestId('git-repo-card-uncloned-repo')).toBeInTheDocument();

    // Specs repo is first child of grid
    const repoCards = grid.querySelectorAll('[data-testid^="git-repo-card-"]');
    expect(repoCards[0]).toHaveAttribute('data-testid', 'git-repo-card-aico-specs');
  });

  // @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-3::REQ-003
  // @verifies ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-4::REQ-004
  it('renders state-aware disabled states, counts, and executes one-click AI commit', async () => {
    const onRefresh = vi.fn();
    render(
      <GitRepositoriesCard statuses={mockStatuses} projectName="aico" onRefresh={onRefresh} />
    );

    // 1. Check clean & synced repository (aico-specs):
    // Pull disabled (0 behind), Push disabled (0 ahead), Commit disabled (clean)
    const specsPullBtn = screen.getByTestId('git-pull-btn-aico-specs') as HTMLButtonElement;
    expect(specsPullBtn.disabled).toBe(true);
    expect(specsPullBtn.title).toBe('Up to date (0 commits behind)');

    const specsPushBtn = screen.getByTestId('git-push-btn-aico-specs') as HTMLButtonElement;
    expect(specsPushBtn.disabled).toBe(true);
    expect(specsPushBtn.title).toBe('Nothing to push (0 commits ahead)');

    const specsCommitBtn = screen.getByTestId('git-commit-btn-aico-specs') as HTMLButtonElement;
    expect(specsCommitBtn.disabled).toBe(true);
    expect(specsCommitBtn.title).toBe('Working tree clean (nothing to commit)');

    // 2. Check repository with upstream commits (aico-skills: behind: 2)
    const skillsPullBtn = screen.getByTestId('git-pull-btn-aico-skills') as HTMLButtonElement;
    expect(skillsPullBtn.disabled).toBe(false);
    expect(skillsPullBtn).toHaveTextContent('Pull (2)');

    // 3. Check repository with local commits and uncommitted changes (aico: ahead: 1, staged: 1)
    const aicoPushBtn = screen.getByTestId('git-push-btn-aico') as HTMLButtonElement;
    expect(aicoPushBtn.disabled).toBe(false);
    expect(aicoPushBtn).toHaveTextContent('Push (1)');

    const aicoCommitBtn = screen.getByTestId('git-commit-btn-aico') as HTMLButtonElement;
    expect(aicoCommitBtn.disabled).toBe(false);
    expect(aicoCommitBtn).toHaveTextContent('Commit (1)');

    // Trigger Push
    fireEvent.click(aicoPushBtn);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/git/push',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project: 'aico', repo_id: 'aico', path: 'd:/aico/codebase/aico' }),
        })
      );
    });

    // Trigger One-Click AI Commit (REQ-004, REQ-008: directly calls /api/v1/git/ai-commit with path telemetry)
    fireEvent.click(aicoCommitBtn);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/git/ai-commit',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project: 'aico',
            repo_id: 'aico',
            path: 'd:/aico/codebase/aico',
          }),
        })
      );
    });
  });

  // @verifies spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-3::REQ-004
  it('renders prominent Clone button for uncloned repo and dispatches clone request', async () => {
    const onRefresh = vi.fn();
    render(
      <GitRepositoriesCard statuses={mockStatuses} projectName="aico" onRefresh={onRefresh} />
    );

    const cloneBtn = screen.getByTestId('git-clone-btn-uncloned-repo');
    expect(cloneBtn).toBeInTheDocument();
    expect(screen.queryByTestId('git-pull-btn-uncloned-repo')).not.toBeInTheDocument();

    fireEvent.click(cloneBtn);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/git/clone',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project: 'aico',
            repo_id: 'uncloned-repo',
            url: 'https://github.com/example/uncloned-repo',
            repo_type: 'codebase',
          }),
        })
      );
    });
  });

  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-22::REQ-028
  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-22::REQ-029
  it('reflects missing remote URL with "No remote URL set" badge, disables remote actions, and opens ProjectConfigModal to edit .aico-project.json', async () => {
    const noUrlStatuses: GitRepoStatusExtended[] = [
      {
        id: 'test-specs',
        name: 'Test Specs',
        path: 'd:/aico/test-specs',
        type: 'specs',
        url: null,
        is_available: true,
        is_cloned: true,
        branch: 'main',
        upstream: null,
        ahead: 1,
        behind: 1,
        staged_count: 0,
        unstaged_count: 0,
        untracked_count: 0,
        is_clean: true,
      },
      {
        id: 'test-code',
        name: 'Test Codebase',
        path: 'd:/aico/codebase/test-code',
        type: 'codebase',
        url: '',
        is_available: false,
        is_cloned: false,
        branch: 'not cloned',
        upstream: null,
        ahead: 0,
        behind: 0,
        staged_count: 0,
        unstaged_count: 0,
        untracked_count: 0,
        is_clean: true,
      },
    ];

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/api/v1/projects/manifest')) {
        return {
          ok: true,
          json: async () => ({
            project_name: 'test',
            id: 'test-specs',
            name: 'Test Specs',
            url: null,
            repositories: [
              { id: 'test-code', name: 'Test Codebase', path: '../codebase/test-code', type: 'codebase' },
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => noUrlStatuses,
      } as Response;
    });

    render(<GitRepositoriesCard statuses={noUrlStatuses} projectName="test-specs" />);

    expect(screen.getByTestId('git-no-url-test-specs')).toHaveTextContent('No remote URL set');
    expect(screen.getByTestId('git-no-url-test-code')).toHaveTextContent('No remote URL set');

    // Remote actions (Pull, Push, Clone) must be disabled when no remote URL is configured
    expect((screen.getByTestId('git-pull-btn-test-specs') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('git-push-btn-test-specs') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('git-clone-btn-test-code') as HTMLButtonElement).disabled).toBe(true);

    // Click Edit button on GitRepositoriesCard header to open ProjectConfigModal in edit mode
    fireEvent.click(screen.getByTestId('edit-project-manifest-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('project-config-modal')).toBeInTheDocument();
      expect(screen.getByTestId('input-project-display-name')).toHaveValue('Test Specs');
    });
  });
});
