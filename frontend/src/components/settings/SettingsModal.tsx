import React, { useState, useEffect } from 'react';
import { X, Settings, Shield, Server, Database, Sliders, FolderTree, Bell, RefreshCw, Layers, GitBranch, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '../../utils/apiClient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// @implements ft-core-webui-shell::TASK-CORE-006-1::REQ-008
// @implements ft-core-webui-shell::TASK-CORE-006-8::REQ-012
// @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-3::REQ-005
export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('aico-desktop-notifications-enabled') !== 'false';
    }
    return true;
  });

  const toggleNotifications = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('aico-desktop-notifications-enabled', String(next));
    }
  };

  const [isRebuildingGraph, setIsRebuildingGraph] = useState(false);
  const [graphStatusMessage, setGraphStatusMessage] = useState<string | null>(null);

  const [isReindexingVectors, setIsReindexingVectors] = useState(false);
  const [vectorStatusMessage, setVectorStatusMessage] = useState<string | null>(null);

  // @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-6::REQ-004
  // @implements spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-4::REQ-008
  interface GitHubStatus {
    authenticated: boolean;
    username: string | null;
    source: string;
    scopes: string[];
    error?: string | null;
  }
  interface GitHubCliStatus {
    installed: boolean;
    binary_path: string | null;
    logged_in: boolean;
    username: string | null;
  }
  const [ghStatus, setGhStatus] = useState<GitHubStatus | null>(null);
  const [cliStatus, setCliStatus] = useState<GitHubCliStatus | null>(null);
  const [ghTokenInput, setGhTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isVerifyingGithub, setIsVerifyingGithub] = useState(false);
  const [isSyncingCli, setIsSyncingCli] = useState(false);
  const [isDisconnectingGithub, setIsDisconnectingGithub] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);
  const [ghSuccess, setGhSuccess] = useState<string | null>(null);

  const fetchGithubStatus = async () => {
    try {
      const res = await apiFetch('/api/v1/github/status');
      if (res.ok) {
        const data = await res.json();
        setGhStatus(data);
      }
    } catch {
      // ignore
    }

    try {
      const cliRes = await apiFetch('/api/v1/github/cli/status');
      if (cliRes.ok) {
        const cliData = await cliRes.json();
        setCliStatus(cliData);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchGithubStatus();
    }
  }, [isOpen]);

  const handleSaveGithubToken = async () => {
    if (!ghTokenInput.trim()) return;
    setIsVerifyingGithub(true);
    setGhError(null);
    setGhSuccess(null);
    try {
      const res = await apiFetch('/api/v1/github/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ghTokenInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setGhSuccess(`Connected successfully as @${data.username}`);
        setGhTokenInput('');
        await fetchGithubStatus();
      } else {
        setGhError(data.error || 'Failed to verify GitHub token');
      }
    } catch {
      setGhError('Network error connecting to server');
    } finally {
      setIsVerifyingGithub(false);
    }
  };

  // @implements spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-4::REQ-007
  const handleSyncCliToken = async () => {
    setIsSyncingCli(true);
    setGhError(null);
    setGhSuccess(null);
    try {
      const res = await apiFetch('/api/v1/github/cli/sync', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setGhSuccess(`Connected successfully with GitHub CLI as @${data.username}`);
        await fetchGithubStatus();
      } else {
        setGhError(data.error || 'Failed to sync credentials from GitHub CLI');
      }
    } catch {
      setGhError('Network error connecting to server');
    } finally {
      setIsSyncingCli(false);
    }
  };

  const handleDisconnectGithub = async () => {
    setIsDisconnectingGithub(true);
    setGhError(null);
    setGhSuccess(null);
    try {
      const res = await apiFetch('/api/v1/github/token', {
        method: 'DELETE',
      });
      if (res.ok) {
        setGhSuccess('GitHub token removed');
        await fetchGithubStatus();
      } else {
        setGhError('Failed to remove GitHub token');
      }
    } catch {
      setGhError('Network error connecting to server');
    } finally {
      setIsDisconnectingGithub(false);
    }
  };

  const handleRebuildGraph = async () => {
    setIsRebuildingGraph(true);
    setGraphStatusMessage(null);
    try {
      const res = await apiFetch('/api/v1/storage/rebuild-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setGraphStatusMessage(`Rebuilt: ${data.nodes_count} nodes, ${data.edges_count} edges`);
      } else {
        setGraphStatusMessage('Failed to rebuild graph');
      }
    } catch {
      setGraphStatusMessage('Network error');
    } finally {
      setIsRebuildingGraph(false);
    }
  };

  const handleReindexVectors = async () => {
    setIsReindexingVectors(true);
    setVectorStatusMessage(null);
    try {
      const res = await apiFetch('/api/v1/storage/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setVectorStatusMessage(`Indexed: ${data.files_scanned} files, ${data.chunks_upserted} chunks`);
      } else {
        setVectorStatusMessage('Failed to reindex vectors');
      }
    } catch {
      setVectorStatusMessage('Network error');
    } finally {
      setIsReindexingVectors(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      data-testid="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        data-testid="settings-modal"
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/40">
          <div className="flex items-center gap-2.5 font-semibold text-sm">
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>Workspace & System Settings</span>
          </div>
          <button
            data-testid="settings-close-btn"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto text-xs">
          {/* Host Server Section */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-zinc-300">
              <Server className="w-3.5 h-3.5 text-sky-400" />
              <span>Host Server Configuration</span>
            </div>
            <div className="grid grid-cols-3 gap-3 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
              <div>
                <span className="text-zinc-500 block mb-1">Server Port</span>
                <span className="font-mono text-zinc-200 bg-zinc-900 px-2 py-1 rounded border border-zinc-800 block">
                  4242 (Axum Embedded)
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1">Bind Host</span>
                <span className="font-mono text-zinc-200 bg-zinc-900 px-2 py-1 rounded border border-zinc-800 block">
                  127.0.0.1
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1">Platform Version</span>
                <span className="font-mono text-zinc-200 bg-zinc-900 px-2 py-1 rounded border border-zinc-800 block">
                  v0.1.1
                </span>
              </div>
            </div>
          </section>

          {/* AICO Skills Section */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-zinc-300">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>AICO Skills</span>
            </div>
            <div className="grid grid-cols-2 gap-3 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
              <div>
                <span className="text-zinc-500 block mb-1">AICO Skills Version</span>
                <span className="font-mono text-zinc-200 bg-zinc-900 px-2 py-1 rounded border border-zinc-800 block">
                  0.1.2 (Standardized Frontmatter)
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1">Task Lifecycle</span>
                <span className="font-mono text-zinc-200 bg-zinc-900 px-2 py-1 rounded border border-zinc-800 block">
                  6-State Non-Destructive Tracking
                </span>
              </div>
            </div>
          </section>

          {/* Embedded Engines Section */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-zinc-300">
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>Embedded Storage Engines</span>
            </div>
            <div className="space-y-2 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Vector Embeddings:</span>
                <span className="font-mono text-zinc-300">LanceDB (zero daemon)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Knowledge Graph:</span>
                <span className="font-mono text-zinc-300">AICO Property Graph (zero daemon)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Specs Root:</span>
                <span className="font-mono text-zinc-300">d:/aico/aico-specs</span>
              </div>
            </div>

            {/* Storage Maintenance Actions */}
            {/* @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-4::REQ-009 */}
            {/* @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-4::REQ-010 */}
            <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80 space-y-2.5">
              <span className="text-[11px] text-zinc-400 font-medium block">Storage Maintenance Actions</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="rebuild-graph-btn"
                  onClick={handleRebuildGraph}
                  disabled={isRebuildingGraph}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/60"
                  title="Force a complete rebuild and cache flush of the AICO property graph"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRebuildingGraph ? 'animate-spin' : ''}`} />
                  <span>{isRebuildingGraph ? 'Rebuilding Graph...' : 'Rebuild Lineage Graph'}</span>
                </button>

                <button
                  type="button"
                  data-testid="reindex-vectors-btn"
                  onClick={handleReindexVectors}
                  disabled={isReindexingVectors}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/60"
                  title="Re-crawl workspace specifications and codebase files to populate LanceDB vector embeddings"
                >
                  <Layers className={`w-3.5 h-3.5 text-indigo-400 ${isReindexingVectors ? 'animate-spin' : ''}`} />
                  <span>{isReindexingVectors ? 'Reindexing Vectors...' : 'Reindex Vector Embeddings'}</span>
                </button>
              </div>

              {(graphStatusMessage || vectorStatusMessage) && (
                <div className="flex flex-col gap-1 pt-1 border-t border-zinc-800/60">
                  {graphStatusMessage && (
                    <span data-testid="graph-status-badge" className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50 w-fit">
                      ✓ {graphStatusMessage}
                    </span>
                  )}
                  {vectorStatusMessage && (
                    <span data-testid="vector-status-badge" className="text-[11px] font-mono text-indigo-300 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-800/50 w-fit">
                      ✓ {vectorStatusMessage}
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Workspace Architecture & Topology Section */}
          {/* @implements ft-core-workspace-path-normalization::TASK-CORE-014-3::REQ-006 */}
          <section className="space-y-2.5" data-testid="section-workspace-topology">
            <div className="flex items-center gap-2 font-semibold text-zinc-300">
              <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
              <span>Workspace Architecture & Topology</span>
            </div>
            <div className="space-y-2.5 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Workspace Root:</span>
                <span className="font-mono text-emerald-300 font-semibold bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">d:/aico</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-800/60 pt-1.5 mt-1">
                The platform root container hosting all decoupled project specifications and source codebases.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/60">
                <div className="bg-zinc-900/80 p-2 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold block mb-0.5">Project Specifications</span>
                  <span className="font-mono text-zinc-200 block text-[11px]">d:/aico/*-specs/</span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">e.g. d:/aico/aico-specs</span>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold block mb-0.5">Codebase Repositories</span>
                  <span className="font-mono text-zinc-200 block text-[11px]">d:/aico/codebase/*/</span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">e.g. d:/aico/codebase/aico</span>
                </div>
              </div>
              <div className="text-[10px] text-zinc-500 italic pt-1">
                All navigation and code viewer tabs resolve canonically relative to this root (e.g. codebase/aico/...).
              </div>
            </div>
          </section>

          {/* GitHub Integration Section */}
          {/* @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-6::REQ-004 */}
          <section className="space-y-2.5" data-testid="section-github-integration">
            <div className="flex items-center justify-between font-semibold text-zinc-300">
              <div className="flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                <span>GitHub Integration</span>
              </div>
              {ghStatus?.authenticated && (
                <span data-testid="github-connected-badge" className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50 flex items-center gap-1">
                  ✓ Connected as @{ghStatus.username}
                </span>
              )}
            </div>

            <div className="bg-zinc-950/60 p-3.5 rounded-lg border border-zinc-800/80 space-y-3">
              {ghStatus?.authenticated ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-zinc-200 font-medium block">GitHub Account</span>
                      <span className="text-[11px] text-zinc-400 block font-mono">
                        @{ghStatus.username} <span className="text-zinc-500">({ghStatus.source})</span>
                      </span>
                    </div>
                    {ghStatus.source === 'configfile' && (
                      <button
                        type="button"
                        data-testid="disconnect-github-btn"
                        onClick={handleDisconnectGithub}
                        disabled={isDisconnectingGithub}
                        className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 rounded text-xs transition-colors cursor-pointer"
                      >
                        {isDisconnectingGithub ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    )}
                  </div>
                  {ghStatus.scopes && ghStatus.scopes.length > 0 && (
                    <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 flex-wrap">
                      <span>Scopes:</span>
                      {ghStatus.scopes.map((s) => (
                        <span key={s} className="bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded font-mono text-[10px] border border-zinc-800">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Connect GitHub to enable automatic repository creation, private repository status verification, and automated project cloning.
                  </p>

                  {/* GitHub CLI Option */}
                  {/* @implements spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-4::REQ-007 */}
                  {/* @implements spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-4::REQ-008 */}
                  <div
                    data-testid="github-cli-card"
                    className="p-3 bg-zinc-900/90 rounded border border-zinc-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium text-xs text-zinc-200">
                        <span className="text-purple-400">⚡</span>
                        <span>GitHub CLI (gh)</span>
                      </div>
                      {cliStatus?.installed && cliStatus.binary_path && (
                        <span
                          data-testid="gh-cli-path"
                          className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 truncate max-w-[240px]"
                          title={cliStatus.binary_path}
                        >
                          {cliStatus.binary_path}
                        </span>
                      )}
                    </div>

                    {cliStatus?.installed ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-zinc-400">
                            {cliStatus.logged_in
                              ? `Detected active CLI session${cliStatus.username ? ` for @${cliStatus.username}` : ''}`
                              : 'GitHub CLI detected on system. Click to sync credentials.'}
                          </span>
                          <button
                            type="button"
                            data-testid="sync-github-cli-btn"
                            onClick={handleSyncCliToken}
                            disabled={isSyncingCli}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                          >
                            {isSyncingCli ? 'Connecting...' : 'Connect with GitHub CLI'}
                          </button>
                        </div>
                        {!cliStatus.logged_in && (
                          <div className="text-[10px] text-zinc-500">
                            Tip: You can also run <code className="text-zinc-400">gh auth login</code> in your terminal first.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                        <span>GitHub CLI (gh) not detected on system PATH.</span>
                        <a
                          href="https://cli.github.com"
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 underline text-[10px]"
                        >
                          Install GitHub CLI ↗
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-zinc-800"></div>
                    <span className="flex-shrink mx-2 text-[10px] uppercase font-semibold text-zinc-500">
                      {cliStatus?.installed ? 'Or connect with Personal Access Token' : 'Personal Access Token'}
                    </span>
                    <div className="flex-grow border-t border-zinc-800"></div>
                  </div>

                  {/* PAT Option */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-zinc-400 font-medium block">Personal Access Token (requires 'repo' scope)</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          data-testid="github-token-input"
                          type={showToken ? 'text' : 'password'}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                          value={ghTokenInput}
                          onChange={(e) => {
                            setGhTokenInput(e.target.value);
                            setGhError(null);
                          }}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 font-mono pr-8"
                        />
                        <button
                          type="button"
                          data-testid="toggle-token-visibility-btn"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
                          title={showToken ? 'Hide token' : 'Show token'}
                        >
                          {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        data-testid="verify-github-token-btn"
                        onClick={handleSaveGithubToken}
                        disabled={isVerifyingGithub || !ghTokenInput.trim()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        {isVerifyingGithub ? 'Verifying...' : 'Verify & Connect'}
                      </button>
                    </div>
                    <div className="flex justify-between items-center text-[10px] pt-0.5">
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo&description=AICO"
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 underline"
                      >
                        Generate a token on GitHub (requires 'repo' scope) ↗
                      </a>
                    </div>
                  </div>

                  {ghError && (
                    <div data-testid="github-error-msg" className="text-[11px] text-red-400 bg-red-950/40 p-2 rounded border border-red-800/50">
                      {ghError}
                    </div>
                  )}
                  {ghSuccess && (
                    <div data-testid="github-success-msg" className="text-[11px] text-emerald-400 bg-emerald-950/40 p-2 rounded border border-emerald-800/50">
                      {ghSuccess}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Desktop Notifications Section */}
          {/* @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-3::REQ-005 */}
          <section className="space-y-2.5" data-testid="section-desktop-notifications">
            <div className="flex items-center gap-2 font-semibold text-zinc-300">
              <Bell className="w-3.5 h-3.5 text-indigo-400" />
              <span>Desktop Notifications</span>
            </div>
            <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80 space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-zinc-200 font-medium block">Windows Popup Notifications</span>
                  <span className="text-[11px] text-zinc-500 block">
                    Display native Windows popup notifications when tasks complete or halt at review gates.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationsEnabled}
                  data-testid="toggle-desktop-notifications"
                  onClick={toggleNotifications}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notificationsEnabled ? 'bg-indigo-600' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      notificationsEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Security & LAN Section */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-zinc-300">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>Security & Access Control</span>
            </div>
            <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">LAN Access Mode:</span>
                <span className="text-emerald-400 font-medium">Local-Only (Strict Loopback)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Auth Token Gate:</span>
                <span className="text-zinc-300 font-mono">active (SHA-256 HMAC)</span>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-zinc-800 bg-zinc-950/40">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
