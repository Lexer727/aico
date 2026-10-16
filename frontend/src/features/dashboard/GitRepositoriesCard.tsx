import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderGit2,
  ExternalLink,
} from 'lucide-react';
import { fetchGitStatus, type GitRepoStatus } from '../feature-task-data';

interface GitRepositoriesCardProps {
  statuses?: GitRepoStatus[];
  onRefresh?: () => void;
}

export const GitRepositoriesCard: React.FC<GitRepositoriesCardProps> = ({
  statuses: initialStatuses,
}) => {
  const [repoStatuses, setRepoStatuses] = useState<GitRepoStatus[]>(initialStatuses || []);
  const [loading, setLoading] = useState<boolean>(!initialStatuses);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadStatus = async () => {
    setRefreshing(true);
    try {
      const data = await fetchGitStatus();
      setRepoStatuses(data);
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
      loadStatus();
    }
  }, [initialStatuses]);

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
              Codebase Repositories
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
              Codebase Repositories
            </h2>
          </div>
          <button
            onClick={loadStatus}
            title="Refresh Git status"
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          No repositories configured in active project manifest.
        </p>
      </div>
    );
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'codebase':
        return 'bg-blue-950/80 text-blue-400 border-blue-800/60';
      // @implements spec-ft-core-ui-visual-consistency::REQ-004
      case 'specs':
        return 'bg-sky-950/80 text-sky-400 border-sky-800/60';
      case 'skills':
        return 'bg-amber-950/80 text-amber-400 border-amber-800/60';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div
      data-testid="git-repositories-card"
      className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FolderGit2 className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
            Codebase Repositories
          </h2>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
            {repoStatuses.length}
          </span>
        </div>
        <button
          onClick={loadStatus}
          title="Refresh Git status"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {repoStatuses.map((repo) => (
          <div
            key={repo.id}
            data-testid={`git-repo-card-${repo.id}`}
            className="p-3.5 bg-zinc-950/60 border border-zinc-800/90 rounded-lg space-y-2.5 hover:border-zinc-700 transition-colors"
          >
            {/* Header: Name and Type badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="font-semibold text-xs text-zinc-100 truncate" title={repo.name}>
                    {repo.name}
                  </div>
                  {repo.url && (
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${repo.name} on GitHub / Remote`}
                      data-testid={`git-repo-url-${repo.id}`}
                      className="text-zinc-500 hover:text-indigo-400 transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="font-mono text-[10px] text-zinc-500 truncate" title={repo.path}>
                  {repo.id}
                </div>
              </div>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase shrink-0 ${getTypeBadgeColor(
                  repo.type
                )}`}
              >
                {repo.type}
              </span>
            </div>

            {/* Git status row */}
            {!repo.is_available ? (
              <div
                data-testid={`git-unavailable-${repo.id}`}
                className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded px-2 py-1"
                title={repo.error || 'Repository unavailable'}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Unavailable</span>
              </div>
            ) : (
              <div className="space-y-1.5 pt-1 border-t border-zinc-800/60">
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
                        <span>Modified ({repo.staged_count + repo.unstaged_count + repo.untracked_count})</span>
                      </span>
                    )}
                  </div>

                  {repo.latest_commit && (
                    <div
                      className="text-zinc-500 font-mono text-[10px] flex items-center gap-1 max-w-[120px] truncate"
                      title={`${repo.latest_commit.message} (${repo.latest_commit.hash.slice(0, 7)})`}
                    >
                      <GitCommit className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{repo.latest_commit.hash.slice(0, 7)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
