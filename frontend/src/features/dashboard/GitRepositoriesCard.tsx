import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderGit2,
  ExternalLink,
  Sparkles,
  Pencil,
} from 'lucide-react';
import { fetchGitStatus, type GitRepoStatus } from '../feature-task-data';
import { ProjectConfigModal } from '../../components/navigation/ProjectConfigModal';
import { apiFetch } from '../../utils/apiClient';

// @implements ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-3::REQ-002
// @implements ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-3::REQ-003
// @implements ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-4::REQ-004
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-3::REQ-002
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-3::REQ-004
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-3::REQ-005
export interface GitRepoStatusExtended extends GitRepoStatus {
  is_cloned?: boolean;
  remote_url?: string | null;
}

export interface GitRepositoriesCardProps {
  statuses?: (GitRepoStatus | GitRepoStatusExtended)[];
  projectName?: string;
  onRefresh?: () => void;
}

export const GitRepositoriesCard: React.FC<GitRepositoriesCardProps> = ({
  statuses: initialStatuses,
  projectName = 'aico',
  onRefresh,
}) => {
  const [repoStatuses, setRepoStatuses] = useState<(GitRepoStatus | GitRepoStatusExtended)[]>(
    initialStatuses || []
  );
  const [loading, setLoading] = useState<boolean>(!initialStatuses);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  const fetchRepos = async () => {
    setRefreshing(true);
    try {
      const data = await fetchGitStatus();
      if (Array.isArray(data)) {
        setRepoStatuses(data);
      }
    } catch (err) {
      console.error('Error fetching git status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (initialStatuses) {
      setRepoStatuses(initialStatuses);
      setLoading(false);
    } else {
      fetchRepos();
    }
  }, [initialStatuses, projectName]);

  const handleClone = async (repo: GitRepoStatusExtended) => {
    setActionLoading((prev) => ({ ...prev, [repo.id]: 'clone' }));
    setActionFeedback(null);
    try {
      const res = await apiFetch('/api/v1/git/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: projectName,
          repo_id: repo.id,
          url: repo.remote_url || repo.url || '',
          repo_type: repo.type,
        }),
      });
      if (res.ok) {
        setActionFeedback({
          type: 'success',
          message: `Successfully cloned ${repo.name || repo.id}`,
        });
        await fetchRepos();
        if (onRefresh) onRefresh();
      } else {
        const errData = await res.json().catch(() => ({}));
        setActionFeedback({
          type: 'error',
          message: errData.error || `Failed to clone ${repo.id}`,
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || `Failed to clone ${repo.id}`,
      });
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[repo.id];
        return next;
      });
    }
  };

  const handlePull = async (repo: GitRepoStatusExtended) => {
    setActionLoading((prev) => ({ ...prev, [repo.id]: 'pull' }));
    setActionFeedback(null);
    try {
      const res = await apiFetch('/api/v1/git/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: projectName,
          repo_id: repo.id,
          path: repo.path,
        }),
      });
      if (res.ok) {
        setActionFeedback({
          type: 'success',
          message: `Pull completed for ${repo.name || repo.id}`,
        });
        await fetchRepos();
        if (onRefresh) onRefresh();
      } else {
        const errData = await res.json().catch(() => ({}));
        setActionFeedback({
          type: 'error',
          message: errData.error || `Failed to pull ${repo.id}`,
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || `Failed to pull ${repo.id}`,
      });
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[repo.id];
        return next;
      });
    }
  };

  const handlePush = async (repo: GitRepoStatusExtended) => {
    setActionLoading((prev) => ({ ...prev, [repo.id]: 'push' }));
    setActionFeedback(null);
    try {
      const res = await apiFetch('/api/v1/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: projectName,
          repo_id: repo.id,
          path: repo.path,
        }),
      });
      if (res.ok) {
        setActionFeedback({
          type: 'success',
          message: `Push completed for ${repo.name || repo.id}`,
        });
        await fetchRepos();
        if (onRefresh) onRefresh();
      } else {
        const errData = await res.json().catch(() => ({}));
        setActionFeedback({
          type: 'error',
          message: errData.error || `Failed to push ${repo.id}`,
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || `Failed to push ${repo.id}`,
      });
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[repo.id];
        return next;
      });
    }
  };

  // @implements ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-4::REQ-004
  // @implements ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-6::REQ-008
  const handleAiCommit = async (repo: GitRepoStatusExtended) => {
    setActionLoading((prev) => ({ ...prev, [repo.id]: 'commit' }));
    setActionFeedback(null);
    try {
      const res = await apiFetch('/api/v1/git/ai-commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: projectName,
          repo_id: repo.id,
          path: repo.path,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionFeedback({
          type: 'success',
          message: `AI Commit completed for ${repo.name || repo.id}: ${data.message || 'Committed changes'}`,
        });
        await fetchRepos();
        if (onRefresh) onRefresh();
      } else {
        const errData = await res.json().catch(() => ({}));
        setActionFeedback({
          type: 'error',
          message: errData.error || `Failed to commit in ${repo.id}`,
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || `Failed to commit in ${repo.id}`,
      });
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[repo.id];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div
        data-testid="git-repositories-card"
        className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Git Repositories
            </h2>
          </div>
          <RefreshCw className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
        </div>
        <p className="text-xs text-zinc-500">Scanning local git repositories...</p>
      </div>
    );
  }

  if (repoStatuses.length === 0) {
    return (
      <div
        data-testid="git-repositories-card"
        className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Git Repositories
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="edit-project-manifest-btn"
              onClick={() => setIsEditModalOpen(true)}
              title="Edit .aico-project.json configuration"
              className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
            >
              <Pencil className="w-3 h-3 text-indigo-400" />
              <span>Edit</span>
            </button>
            <button
              onClick={fetchRepos}
              title="Refresh Git status"
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          No repositories configured in active project manifest.
        </p>
        <ProjectConfigModal
          isOpen={isEditModalOpen}
          mode="edit"
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={async () => {
            await fetchRepos();
            if (onRefresh) onRefresh();
          }}
        />
      </div>
    );
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'codebase':
        return 'bg-blue-950/80 text-blue-400 border-blue-800/60';
      case 'specs':
        return 'bg-sky-950/80 text-sky-400 border-sky-800/60';
      case 'skills':
        return 'bg-amber-950/80 text-amber-400 border-amber-800/60';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-22::REQ-028
  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-22::REQ-029
  const renderRepoCard = (repo: GitRepoStatusExtended) => {
    const isUncloned = repo.is_cloned === false;
    const modifiedCount = (repo.staged_count || 0) + (repo.unstaged_count || 0) + (repo.untracked_count || 0);
    const effectiveUrl = (repo.remote_url || repo.url || '').trim();
    const hasRemoteUrl = effectiveUrl.length > 0;

    return (
      <div
        key={repo.id}
        data-testid={`git-repo-card-${repo.id}`}
        className="p-3.5 bg-zinc-950/60 border border-zinc-800/90 rounded-lg space-y-2.5 hover:border-zinc-700 transition-colors flex flex-col justify-between"
      >
        <div>
          {/* Header: Name and Type badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="font-semibold text-xs text-zinc-100 truncate" title={repo.name}>
                  {repo.name}
                </div>
                {hasRemoteUrl ? (
                  <a
                    href={effectiveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${repo.name} on GitHub / Remote`}
                    data-testid={`git-repo-url-${repo.id}`}
                    className="text-zinc-500 hover:text-indigo-400 transition-colors shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span
                    data-testid={`git-no-url-${repo.id}`}
                    className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-500 border border-zinc-800 shrink-0"
                    title="No remote Git URL configured in .aico-project.json"
                  >
                    No remote URL set
                  </span>
                )}
              </div>
              <div className="font-mono text-[10px] text-zinc-500 truncate" title={repo.path}>
                {repo.id}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                data-testid={`git-edit-repo-${repo.id}`}
                onClick={() => setIsEditModalOpen(true)}
                title="Edit repository in .aico-project.json"
                className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase shrink-0 ${getTypeBadgeColor(
                  repo.type
                )}`}
              >
                {repo.type}
              </span>
            </div>
          </div>

          {/* Uncloned State */}
          {isUncloned ? (
            <div className="mt-2.5 pt-2 border-t border-zinc-800/60 space-y-2">
              <div className="text-[11px] text-amber-400/90 font-mono flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>Repository not cloned locally</span>
              </div>
              <button
                type="button"
                onClick={() => handleClone(repo)}
                disabled={!hasRemoteUrl || !!actionLoading[repo.id]}
                title={!hasRemoteUrl ? 'Configure a remote URL in .aico-project.json to clone' : `Clone ${repo.id}`}
                data-testid={`git-clone-btn-${repo.id}`}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <FolderGit2 className={`w-3.5 h-3.5 ${actionLoading[repo.id] === 'clone' ? 'animate-pulse' : ''}`} />
                <span>{actionLoading[repo.id] === 'clone' ? 'Cloning...' : 'Clone'}</span>
              </button>
            </div>
          ) : !repo.is_available ? (
            <div
              data-testid={`git-unavailable-${repo.id}`}
              className="mt-2.5 flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded px-2 py-1"
              title={repo.error || 'Repository unavailable'}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Unavailable</span>
            </div>
          ) : (
            <div className="space-y-1.5 pt-2 mt-2 border-t border-zinc-800/60">
              <div className="flex items-center justify-between text-xs font-mono">
                {/* Branch Pill */}
                <div
                  data-testid={`git-branch-${repo.id}`}
                  className="flex items-center gap-1 text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800"
                  title={repo.upstream ? `Tracking ${repo.upstream}` : 'Local branch'}
                >
                  <GitBranch className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="truncate max-w-[90px]">{repo.branch || 'detached'}</span>
                </div>

                {/* Ahead / Behind Indicator */}
                <div
                  data-testid={`git-ahead-behind-${repo.id}`}
                  className="flex items-center gap-1.5 text-[11px]"
                >
                  {repo.ahead > 0 && (
                    <span
                      className="flex items-center text-emerald-400 font-semibold"
                      title={`${repo.ahead} commits ahead of upstream`}
                    >
                      <ArrowUp className="w-3 h-3" />
                      {repo.ahead}
                    </span>
                  )}
                  {repo.behind > 0 && (
                    <span
                      className="flex items-center text-amber-400 font-semibold"
                      title={`${repo.behind} commits behind upstream`}
                    >
                      <ArrowDown className="w-3 h-3" />
                      {repo.behind}
                    </span>
                  )}
                  {repo.ahead === 0 && repo.behind === 0 && (
                    <span className="text-zinc-500 font-mono text-[10px]">Synced</span>
                  )}
                </div>
              </div>

              {/* Clean / Dirty status */}
              <div className="flex items-center justify-between text-[11px] pt-1">
                <div
                  data-testid={`git-clean-status-${repo.id}`}
                  className="flex items-center gap-1"
                >
                  {repo.is_clean ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Clean</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-400">
                      <AlertCircle className="w-3 h-3" />
                      <span>Modified ({modifiedCount})</span>
                    </span>
                  )}
                </div>

                {repo.latest_commit && (
                  <div
                    className="text-zinc-500 font-mono text-[10px] flex items-center gap-1 max-w-[120px] truncate"
                    title={`${repo.latest_commit.message} (${repo.latest_commit.hash.slice(0, 7)})`}
                  >
                    <span className="truncate">{repo.latest_commit.hash.slice(0, 7)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action controls for cloned repositories */}
        {!isUncloned && (
          <div className="pt-2 border-t border-zinc-800/60">
            {/* @implements ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-3::REQ-003 */}
            {/* @implements ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-4::REQ-004 */}
            {/* @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-22::REQ-029 */}
            <div className="flex items-center gap-1.5">
              {/* Pull button */}
              <button
                type="button"
                onClick={() => handlePull(repo)}
                disabled={!hasRemoteUrl || repo.behind === 0 || !!actionLoading[repo.id]}
                data-testid={`git-pull-btn-${repo.id}`}
                title={
                  !hasRemoteUrl
                    ? 'No remote URL configured'
                    : repo.behind === 0
                    ? 'Up to date (0 commits behind)'
                    : `${repo.behind} commits behind upstream - click to pull`
                }
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowDown className={`w-3 h-3 ${actionLoading[repo.id] === 'pull' ? 'animate-bounce' : ''}`} />
                <span>
                  {actionLoading[repo.id] === 'pull'
                    ? 'Pulling...'
                    : repo.behind > 0
                    ? `Pull (${repo.behind})`
                    : 'Pull'}
                </span>
              </button>

              {/* Push button */}
              <button
                type="button"
                onClick={() => handlePush(repo)}
                disabled={!hasRemoteUrl || repo.ahead === 0 || !!actionLoading[repo.id]}
                data-testid={`git-push-btn-${repo.id}`}
                title={
                  !hasRemoteUrl
                    ? 'No remote URL configured'
                    : repo.ahead === 0
                    ? 'Nothing to push (0 commits ahead)'
                    : `${repo.ahead} commits ahead of upstream - click to push`
                }
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowUp className={`w-3 h-3 ${actionLoading[repo.id] === 'push' ? 'animate-bounce' : ''}`} />
                <span>
                  {actionLoading[repo.id] === 'push'
                    ? 'Pushing...'
                    : repo.ahead > 0
                    ? `Push (${repo.ahead})`
                    : 'Push'}
                </span>
              </button>

              {/* One-click AI Commit button */}
              <button
                type="button"
                onClick={() => handleAiCommit(repo)}
                disabled={(repo.is_clean && modifiedCount === 0) || !!actionLoading[repo.id]}
                data-testid={`git-commit-btn-${repo.id}`}
                title={
                  repo.is_clean && modifiedCount === 0
                    ? 'Working tree clean (nothing to commit)'
                    : `${modifiedCount} modified/untracked files - click for AI Commit`
                }
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[11px] font-mono transition-colors bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800/80 text-indigo-300 disabled:opacity-40 disabled:bg-zinc-800 disabled:border-transparent disabled:text-zinc-400 disabled:cursor-not-allowed"
              >
                {actionLoading[repo.id] === 'commit' ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                )}
                <span>
                  {actionLoading[repo.id] === 'commit'
                    ? 'Committing...'
                    : modifiedCount > 0
                    ? `Commit (${modifiedCount})`
                    : 'Commit'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const sortedRepos = [...repoStatuses].sort((a, b) => {
    if (a.type === 'specs' && b.type !== 'specs') return -1;
    if (a.type !== 'specs' && b.type === 'specs') return 1;
    return a.id.localeCompare(b.id);
  });

  return (
    <div
      data-testid="git-repositories-card"
      className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-4"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FolderGit2 className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
            Git Repositories
          </h2>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
            {repoStatuses.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="edit-project-manifest-btn"
            onClick={() => setIsEditModalOpen(true)}
            title="Edit .aico-project.json configuration"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
          >
            <Pencil className="w-3 h-3 text-indigo-400" />
            <span>Edit</span>
          </button>
          <button
            onClick={fetchRepos}
            title="Refresh Git status"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Action feedback message banner */}
      {actionFeedback && (
        <div
          data-testid="git-action-feedback"
          className={`px-3 py-2 rounded text-xs flex items-center justify-between font-mono ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/60 border border-rose-800/60 text-rose-300'
          }`}
        >
          <span>{actionFeedback.message}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-zinc-400 hover:text-zinc-200 ml-2 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Unified 3-column Repositories Grid (Specs First, No Blank Columns) */}
      <div
        data-testid="git-repositories-grid"
        className="grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        {sortedRepos.map(renderRepoCard)}
      </div>

      <ProjectConfigModal
        isOpen={isEditModalOpen}
        mode="edit"
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={async () => {
          await fetchRepos();
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
};
