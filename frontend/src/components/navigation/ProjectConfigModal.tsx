import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, FolderGit2, FolderTree, Globe, Lock, Plus, Trash2, X, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../utils/apiClient';

export interface ManifestRepoDraft {
  id: string;
  name: string;
  type: string;
  url: string;
}

export interface ProjectManifestData {
  project_name: string;
  id: string;
  name: string;
  url?: string | null;
  repositories?: Array<{
    id: string;
    name: string;
    path?: string;
    type?: string;
    url?: string | null;
  }>;
}

export interface ProjectConfigModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  existingProjects?: Array<{ id: string; name: string }>;
  initialManifest?: ProjectManifestData | null;
  onClose: () => void;
  onSuccess?: (project: { id: string; name: string }) => Promise<void> | void;
  onOpenSettings?: () => void;
}

function toSlug(raw: string): string {
  return raw
    .trim()
    .replace(/-specs$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

function toTitleCase(slug: string): string {
  if (!slug) return '';
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-21::REQ-027
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-21::REQ-028
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-22::REQ-029
// @implements spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-5::REQ-001
export const ProjectConfigModal: React.FC<ProjectConfigModalProps> = ({
  isOpen,
  mode,
  existingProjects = [],
  initialManifest = null,
  onClose,
  onSuccess,
  onOpenSettings,
}) => {
  const [projectName, setProjectName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [specsUrl, setSpecsUrl] = useState('');
  const [specsUrlTouched, setSpecsUrlTouched] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [isGithubAuthenticated, setIsGithubAuthenticated] = useState(false);
  const [localOnly, setLocalOnly] = useState(true);
  const [isPrivate, setIsPrivate] = useState(true);
  const [isCheckingRepo, setIsCheckingRepo] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    exists: boolean;
    is_specs?: boolean;
    is_empty?: boolean;
    unauthenticated?: boolean;
    manifest?: any;
    owner?: string | null;
    repo?: string | null;
    error?: string | null;
  } | null>(null);
  const [confirmExisting, setConfirmExisting] = useState(false);

  // Codebase Folder Browser State
  const [isBrowsingCodebase, setIsBrowsingCodebase] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [codebaseFolders, setCodebaseFolders] = useState<
    Array<{ id: string; name: string; path: string; is_git: boolean }>
  >([]);

  const [repositories, setRepositories] = useState<ManifestRepoDraft[]>([]);
  const [isLoadingManifest, setIsLoadingManifest] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setIsSubmitting(false);

    if (mode === 'create') {
      setProjectName('');
      setDisplayName('');
      setDisplayNameTouched(false);
      setSpecsUrl('');
      setSpecsUrlTouched(false);
      setLocalOnly(true);
      setIsPrivate(true);
      setCheckResult(null);
      setConfirmExisting(false);
      setIsBrowsingCodebase(false);
      setRepositories([]);
      setIsLoadingManifest(false);

      // Query GitHub authentication status
      // @implements spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-5::REQ-001
      apiFetch('/api/v1/github/status')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.authenticated && data?.username) {
            setGithubUsername(data.username);
            setIsGithubAuthenticated(true);
            setLocalOnly(false);
          } else {
            setGithubUsername(null);
            setIsGithubAuthenticated(false);
          }
        })
        .catch(() => {
          setGithubUsername(null);
          setIsGithubAuthenticated(false);
        });
    } else {
      if (initialManifest) {
        setProjectName(initialManifest.project_name || toSlug(initialManifest.id || ''));
        setDisplayName(initialManifest.name || '');
        setDisplayNameTouched(true);
        setSpecsUrl(initialManifest.url || '');
        setSpecsUrlTouched(true);
        setRepositories(
          (initialManifest.repositories || []).map((r) => ({
            id: r.id || '',
            name: r.name || '',
            type: 'codebase',
            url: r.url || '',
          }))
        );
        setIsLoadingManifest(false);
      } else {
        setIsLoadingManifest(true);
        apiFetch('/api/v1/projects/manifest')
          .then((res) => (res.ok ? res.json() : null))
          .then((data: ProjectManifestData | null) => {
            if (data) {
              setProjectName(data.project_name || toSlug(data.id || ''));
              setDisplayName(data.name || '');
              setDisplayNameTouched(true);
              setSpecsUrl(data.url || '');
              setSpecsUrlTouched(true);
              setRepositories(
                (data.repositories || []).map((r) => ({
                  id: r.id || '',
                  name: r.name || '',
                  type: 'codebase',
                  url: r.url || '',
                }))
              );
            }
          })
          .catch(() => {
            setErrorMsg('Failed to load .aico-project.json manifest');
          })
          .finally(() => {
            setIsLoadingManifest(false);
          });
      }
    }
  }, [isOpen, mode, initialManifest]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const computedSlug = toSlug(projectName);
  const specsFolderPreview = computedSlug ? `${computedSlug}-specs` : '<project-name>-specs';

  const cleanSpecsUrl = specsUrl.trim().replace(/\/+$/, '');
  const hasSpecsSuffix =
    !cleanSpecsUrl ||
    cleanSpecsUrl.endsWith('-specs') ||
    cleanSpecsUrl.endsWith('-specs.git');

  // @implements spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-5::REQ-001
  const handleProjectNameChange = (val: string) => {
    setProjectName(val);
    if (errorMsg) setErrorMsg(null);
    const slug = toSlug(val);
    if (!displayNameTouched && mode === 'create') {
      const title = toTitleCase(slug);
      setDisplayName(title ? `${title} Specs` : '');
    }
    if (!specsUrlTouched && mode === 'create' && !localOnly) {
      if (slug && githubUsername) {
        setSpecsUrl(`https://github.com/${githubUsername}/${slug}-specs.git`);
      } else {
        setSpecsUrl('');
      }
      setCheckResult(null);
    }
  };

  // @implements spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-5::REQ-001
  const handleToggleLocalOnly = (checked: boolean) => {
    setLocalOnly(checked);
    if (checked) {
      setSpecsUrl('');
      setCheckResult(null);
    } else if (computedSlug && githubUsername) {
      setSpecsUrl(`https://github.com/${githubUsername}/${computedSlug}-specs.git`);
    } else {
      setSpecsUrl('');
    }
  };

  const handleCheckRepo = async () => {
    const trimmed = specsUrl.trim();
    if (!trimmed) return;
    setIsCheckingRepo(true);
    setCheckResult(null);
    try {
      const res = await apiFetch('/api/v1/github/check-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        setCheckResult(data);
        if (data.exists && data.is_specs && data.manifest) {
          if (data.manifest.name && !displayNameTouched) {
            setDisplayName(data.manifest.name);
          }
          if (data.manifest.repositories && Array.isArray(data.manifest.repositories)) {
            setRepositories(
              data.manifest.repositories.map((r: any) => ({
                id: r.id || '',
                name: r.name || '',
                type: 'codebase',
                url: r.url || '',
              }))
            );
          }
        }
      } else {
        setCheckResult({ exists: false, error: 'Failed to check repository' });
      }
    } catch {
      setCheckResult({ exists: false, error: 'Network error checking repository' });
    } finally {
      setIsCheckingRepo(false);
    }
  };

  const handleBrowseCodebase = async () => {
    setIsBrowsingCodebase((prev) => !prev);
    if (!isBrowsingCodebase) {
      setIsLoadingFolders(true);
      try {
        const res = await apiFetch('/api/v1/workspace/codebase-folders');
        if (res.ok) {
          const data = await res.json();
          setCodebaseFolders(data || []);
        }
      } catch {
        setCodebaseFolders([]);
      } finally {
        setIsLoadingFolders(false);
      }
    }
  };

  const handleSelectCodebaseFolder = (folder: { id: string; name: string; path: string; is_git: boolean }) => {
    const exists = repositories.some((r) => toSlug(r.id) === toSlug(folder.id));
    if (!exists) {
      setRepositories((prev) => [
        ...prev,
        {
          id: folder.id,
          name: folder.name || `${toTitleCase(folder.id)} Codebase`,
          type: 'codebase',
          url: '',
        },
      ]);
    }
    setIsBrowsingCodebase(false);
  };

  const handleAddRepository = () => {
    const defaultRepoId =
      repositories.length === 0 && computedSlug ? computedSlug : '';
    const defaultRepoName =
      repositories.length === 0 && computedSlug
        ? `${toTitleCase(computedSlug)} Codebase`
        : '';
    setRepositories((prev) => [
      ...prev,
      {
        id: defaultRepoId,
        name: defaultRepoName,
        type: 'codebase',
        url: '',
      },
    ]);
  };

  const handleUpdateRepository = (
    idx: number,
    field: keyof ManifestRepoDraft,
    value: string
  ) => {
    setRepositories((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        if (field === 'id' && !item.name.trim()) {
          const cleanId = toSlug(value);
          if (cleanId) {
            updated.name = `${toTitleCase(cleanId)} Codebase`;
          }
        }
        return updated;
      })
    );
  };

  const handleRemoveRepository = (idx: number) => {
    setRepositories((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (mode === 'create') {
      if (!computedSlug) {
        setErrorMsg('Project name cannot be empty');
        return;
      }
      if (
        !/^[a-z0-9-]+$/.test(computedSlug) ||
        computedSlug.startsWith('-') ||
        computedSlug.endsWith('-')
      ) {
        setErrorMsg(
          'Invalid project name: must be lowercase alphanumeric with hyphens'
        );
        return;
      }
      const duplicate = existingProjects.some(
        (p) =>
          p.id.toLowerCase() === `${computedSlug}-specs` ||
          p.id.toLowerCase() === computedSlug ||
          p.name.toLowerCase() === computedSlug
      );
      if (duplicate) {
        setErrorMsg(`Project "${computedSlug}" already exists`);
        return;
      }

      if (
        !localOnly &&
        checkResult?.exists &&
        !checkResult.is_specs &&
        !checkResult.is_empty &&
        !confirmExisting
      ) {
        setErrorMsg(
          'Please confirm initializing AICO specs in the existing non-specs repository.'
        );
        return;
      }
    }

    const effectiveDisplayName =
      displayName.trim() ||
      (computedSlug ? `${toTitleCase(computedSlug)} Specs` : '');
    if (!effectiveDisplayName) {
      setErrorMsg('Display name cannot be empty');
      return;
    }

    for (let i = 0; i < repositories.length; i++) {
      const rId = toSlug(repositories[i].id);
      if (!rId) {
        setErrorMsg(`Repository #${i + 1} is missing a repository ID`);
        return;
      }
    }

    const normalizedRepos = repositories.map((r) => {
      const cleanId = toSlug(r.id);
      return {
        id: cleanId,
        name: r.name.trim() || `${toTitleCase(cleanId)} Codebase`,
        path: `../codebase/${cleanId}`,
        type: 'codebase',
        url: r.url.trim() || undefined,
      };
    });

    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        const res = await apiFetch('/api/v1/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_name: computedSlug,
            name: effectiveDisplayName,
            display_name: effectiveDisplayName,
            url: !localOnly && specsUrl.trim() ? specsUrl.trim() : undefined,
            local_only: localOnly,
            private: isPrivate,
            repositories:
              normalizedRepos.length > 0 ? normalizedRepos : undefined,
          }),
        });

        if (!res.ok) {
          let msg = 'Failed to create project';
          try {
            const errData = await res.json();
            msg = errData.message || errData.error || msg;
          } catch {
            // ignore
          }
          setErrorMsg(msg);
          return;
        }

        const created = await res.json().catch(() => ({
          id: `${computedSlug}-specs`,
          name: effectiveDisplayName,
        }));
        const newId = created.id || `${computedSlug}-specs`;
        const newName = created.name || effectiveDisplayName;
        if (onSuccess) {
          await onSuccess({ id: newId, name: newName });
        }
        onClose();
      } else {
        const res = await apiFetch('/api/v1/projects/manifest', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: effectiveDisplayName,
            url: specsUrl.trim() || undefined,
            repositories: normalizedRepos,
          }),
        });

        if (!res.ok) {
          let msg = 'Failed to update .aico-project.json';
          try {
            const errData = await res.json();
            msg = errData.message || errData.error || msg;
          } catch {
            // ignore
          }
          setErrorMsg(msg);
          return;
        }

        const updated = await res.json().catch(() => ({
          id: `${computedSlug}-specs`,
          name: effectiveDisplayName,
        }));
        if (onSuccess) {
          await onSuccess({
            id: updated.id || `${computedSlug}-specs`,
            name: updated.name || effectiveDisplayName,
          });
        }
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error saving project configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="project-config-modal"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header (OmniSearch Style) */}
        {/* @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-7::REQ-001 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <Briefcase className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-zinc-100">
              {mode === 'create'
                ? 'Add Project (.aico-project.json)'
                : 'Edit Project Configuration (.aico-project.json)'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-zinc-200"
        >
          {isLoadingManifest ? (
            <div className="py-8 text-center text-zinc-400">
              Loading .aico-project.json configuration...
            </div>
          ) : (
            <>
              {/* Specs Repository & Project Identity Section */}
              <div className="space-y-3 p-3.5 rounded-lg bg-zinc-950/50 border border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
                    Project &amp; Specs Repository
                  </span>
                  <span
                    data-testid="preview-specs-folder"
                    className="font-mono text-[11px] px-2 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-800/60"
                    title="Specs directory under workspace root"
                  >
                    {specsFolderPreview}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Project Identifier (project_name)
                    </label>
                    <input
                      type="text"
                      autoFocus={mode === 'create'}
                      data-testid="input-new-project-name"
                      value={projectName}
                      onChange={(e) => handleProjectNameChange(e.target.value)}
                      readOnly={mode === 'edit'}
                      disabled={isSubmitting || mode === 'edit'}
                      placeholder="e.g. demo-app"
                      className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-100 font-mono placeholder-zinc-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                    <span className="block text-[10px] text-zinc-500 mt-1">
                      Specs folder: <code className="text-zinc-300">{specsFolderPreview}</code>
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      UI Display Name (shown in dropdown &amp; dashboard)
                    </label>
                    <input
                      type="text"
                      autoFocus={mode === 'edit'}
                      data-testid="input-project-display-name"
                      value={displayName}
                      onChange={(e) => {
                        setDisplayName(e.target.value);
                        setDisplayNameTouched(true);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      disabled={isSubmitting}
                      placeholder="e.g. Demo App Specs"
                      className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Local-Only & Private Toggles (Mode create) */}
                {/* @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-7::REQ-006 */}
                {/* @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-7::REQ-007 */}
                {mode === 'create' && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-800/60">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        data-testid="checkbox-local-only"
                        checked={localOnly}
                        onChange={(e) => handleToggleLocalOnly(e.target.checked)}
                        className="rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-0"
                      />
                      <span>Local repository only (no GitHub remote push)</span>
                    </label>

                    {!localOnly && (
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          data-testid="checkbox-private-repo"
                          checked={isPrivate}
                          onChange={(e) => setIsPrivate(e.target.checked)}
                          className="rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-0"
                        />
                        <span>Private repository on GitHub</span>
                      </label>
                    )}
                  </div>
                )}

                {/* Specs Remote URL & Remote Inspector */}
                {/* @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-7::REQ-005 */}
                {/* @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-7::REQ-008 */}
                {/* @implements spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-5::REQ-004 */}
                {!localOnly && (
                  <div className="space-y-2">
                    {/* Unauthenticated Alert Guard */}
                    {isGithubAuthenticated === false && (
                      <div
                        data-testid="unauthenticated-remote-alert"
                        className="p-2.5 rounded bg-amber-950/40 border border-amber-800/50 space-y-2 text-xs text-amber-200"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-medium text-amber-300">GitHub account not connected</p>
                            <p className="text-[11px] text-amber-200/80 leading-relaxed">
                              Private repositories cannot be checked and remote repositories cannot be created without authentication. Connect your GitHub account in Settings to enable remote workflows.
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end pt-0.5">
                          <button
                            type="button"
                            data-testid="btn-open-settings-from-alert"
                            onClick={() => {
                              onOpenSettings?.();
                              if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('aico:open-settings'));
                              }
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded text-[11px] transition-colors cursor-pointer"
                          >
                            Connect GitHub in Settings →
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-zinc-400">
                        Specs Repository Remote URL (GitHub)
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Globe className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            data-testid="input-project-specs-url"
                            value={specsUrl}
                            onChange={(e) => {
                              setSpecsUrl(e.target.value);
                              setSpecsUrlTouched(true);
                              setCheckResult(null);
                            }}
                            disabled={isSubmitting}
                            placeholder="https://github.com/org/project-specs.git"
                            className="w-full pl-8 pr-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-100 font-mono placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <button
                          type="button"
                          data-testid="btn-check-repo"
                          onClick={handleCheckRepo}
                          disabled={isCheckingRepo || !specsUrl.trim() || isSubmitting}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700 shrink-0"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isCheckingRepo ? 'animate-spin' : ''}`} />
                          <span>{isCheckingRepo ? 'Checking...' : 'Check Repo'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Permissive Warning if -specs postfix is missing */}
                    {!hasSpecsSuffix && (
                      <div data-testid="warning-missing-specs-postfix" className="flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-950/40 px-2 py-1 rounded border border-amber-800/50">
                        <span>⚠️</span>
                        <span>Specs repository URL should end with <code>-specs</code> postfix (e.g. <code>https://github.com/org/project-specs.git</code>)</span>
                      </div>
                    )}

                    {/* Inspection Result Banners */}
                    {checkResult?.exists && checkResult.is_specs && (
                      <div data-testid="check-repo-status-specs" className="text-[11px] text-emerald-300 bg-emerald-950/40 p-2 rounded border border-emerald-800/50 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>AICO Specs repository detected! Loaded configuration. On Add Project, specs and linked repositories will be cloned.</span>
                      </div>
                    )}

                    {checkResult?.exists && checkResult.is_empty && (
                      <div data-testid="check-repo-status-empty" className="text-[11px] text-sky-300 bg-sky-950/40 p-2 rounded border border-sky-800/50 flex items-center gap-1.5">
                        <span className="shrink-0">ℹ️</span>
                        <span>Repository exists on GitHub and is empty. Ready for initial scaffolding push.</span>
                      </div>
                    )}

                    {checkResult?.exists && !checkResult.is_specs && !checkResult.is_empty && (
                      <div data-testid="check-repo-status-non-specs" className="space-y-1.5 text-[11px] text-amber-300 bg-amber-950/40 p-2.5 rounded border border-amber-800/50">
                        <div className="flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Repository contains existing files and is not an AICO specs repository.</span>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer pt-1 text-zinc-200">
                          <input
                            type="checkbox"
                            data-testid="checkbox-confirm-existing"
                            checked={confirmExisting}
                            onChange={(e) => setConfirmExisting(e.target.checked)}
                            className="rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-0"
                          />
                          <span className="text-[10px]">Initialize AICO specs in this existing repository</span>
                        </label>
                      </div>
                    )}

                    {/* Unauthenticated 404 Guard Banner */}
                    {/* @implements spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-5::REQ-005 */}
                    {checkResult?.unauthenticated && (
                      <div
                        data-testid="check-repo-status-unauthenticated"
                        className="p-2.5 rounded bg-amber-950/40 border border-amber-800/50 space-y-2 text-xs text-amber-200"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-medium text-amber-300">Authentication Required for Private Repositories</p>
                            <p className="text-[11px] text-amber-200/80 leading-relaxed">
                              {checkResult.error || 'Repository was not found (or is private). Sign in to GitHub in Settings to verify private repositories or scaffold remote repositories.'}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end pt-0.5">
                          <button
                            type="button"
                            data-testid="btn-open-settings-from-check"
                            onClick={() => {
                              onOpenSettings?.();
                              if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('aico:open-settings'));
                              }
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded text-[11px] transition-colors cursor-pointer"
                          >
                            Connect GitHub in Settings →
                          </button>
                        </div>
                      </div>
                    )}

                    {checkResult && !checkResult.exists && !checkResult.unauthenticated && (
                      <div data-testid="check-repo-status-not-found" className="text-[11px] text-indigo-300 bg-indigo-950/40 p-2 rounded border border-indigo-800/50 flex items-center gap-1.5">
                        <span className="shrink-0">ℹ️</span>
                        <span>
                          {checkResult.error
                            ? `Note: ${checkResult.error}`
                            : 'Repository does not exist on GitHub yet. It will be created automatically on Add Project.'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Linked Codebase Repositories Section */}
              {/* @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-7::REQ-002 */}
              {/* @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-7::REQ-003 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                      Linked Repositories ({repositories.length})
                    </span>
                    <p className="text-[10px] text-zinc-500">
                      Configure codebase repositories mapped under <code className="text-zinc-400">../codebase/&lt;id&gt;</code>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="btn-browse-codebase"
                      onClick={handleBrowseCodebase}
                      disabled={isSubmitting}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Browse ../codebase</span>
                    </button>
                    <button
                      type="button"
                      data-testid="btn-add-manifest-repo"
                      onClick={handleAddRepository}
                      disabled={isSubmitting}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800/80 text-indigo-300 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Repository</span>
                    </button>
                  </div>
                </div>

                {/* Codebase Folder Browser Popover */}
                {isBrowsingCodebase && (
                  <div data-testid="codebase-browser-panel" className="p-3 bg-zinc-950 border border-zinc-700 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-200 text-xs flex items-center gap-1.5">
                        <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
                        Discovered Codebase Folders (../codebase/)
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsBrowsingCodebase(false)}
                        className="text-zinc-400 hover:text-zinc-200 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {isLoadingFolders ? (
                      <div className="py-3 text-center text-zinc-500 text-[11px]">Scanning ../codebase/...</div>
                    ) : codebaseFolders.length === 0 ? (
                      <div className="py-3 text-center text-zinc-500 text-[11px]">No subfolders found in ../codebase/</div>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {codebaseFolders.map((f) => (
                          <div
                            key={f.id}
                            data-testid={`codebase-folder-item-${f.id}`}
                            onClick={() => handleSelectCodebaseFolder(f)}
                            className="flex items-center justify-between p-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/60 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
                              <span className="font-mono text-xs text-zinc-200">{f.id}</span>
                              {f.is_git && (
                                <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 px-1 rounded">
                                  git
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-indigo-400 hover:underline">+ Select</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {repositories.length === 0 ? (
                  <div className="p-3 rounded-lg border border-dashed border-zinc-800 text-center text-[11px] text-zinc-500">
                    No linked codebase repositories configured. Click &quot;Add Repository&quot; or &quot;Browse ../codebase&quot; to link one.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {repositories.map((repo, idx) => {
                      const cleanRepoId = toSlug(repo.id);
                      const fixedRepoPath = `../codebase/${cleanRepoId || '<id>'}`;
                      return (
                        <div
                          key={idx}
                          data-testid={`manifest-repo-row-${idx}`}
                          className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-zinc-300 font-medium text-[11px]">
                              <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Repository #{idx + 1}</span>
                            </div>
                            <button
                              type="button"
                              data-testid={`btn-remove-repo-${idx}`}
                              onClick={() => handleRemoveRepository(idx)}
                              className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                              title="Remove repository"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                            <div>
                              <label className="block text-[10px] text-zinc-400 mb-1">
                                Repository ID
                              </label>
                              <input
                                type="text"
                                data-testid={`input-repo-id-${idx}`}
                                value={repo.id}
                                onChange={(e) =>
                                  handleUpdateRepository(idx, 'id', e.target.value)
                                }
                                placeholder="e.g. aico"
                                className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-100 font-mono placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-zinc-400 mb-1">
                                Display Name
                              </label>
                              <input
                                type="text"
                                data-testid={`input-repo-name-${idx}`}
                                value={repo.name}
                                onChange={(e) =>
                                  handleUpdateRepository(idx, 'name', e.target.value)
                                }
                                placeholder="e.g. AICO Engine"
                                className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-zinc-400 mb-1">
                                Type
                              </label>
                              <div
                                data-testid={`static-repo-type-${idx}`}
                                className="px-2 py-1 bg-zinc-900/60 border border-zinc-700 rounded text-xs text-zinc-300 font-mono flex items-center gap-1.5"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                <span>codebase</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] text-zinc-400 mb-1">
                                Remote URL (optional)
                              </label>
                              <input
                                type="text"
                                data-testid={`input-repo-url-${idx}`}
                                value={repo.url}
                                onChange={(e) =>
                                  handleUpdateRepository(idx, 'url', e.target.value)
                                }
                                placeholder="https://github.com/org/repo (optional)"
                                className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-100 font-mono placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-zinc-400 mb-1">
                                Path (fixed relative to specs)
                              </label>
                              <div className="relative flex items-center">
                                <Lock className="w-3 h-3 text-zinc-500 absolute left-2" />
                                <input
                                  type="text"
                                  readOnly
                                  disabled
                                  data-testid={`preview-repo-path-${idx}`}
                                  value={fixedRepoPath}
                                  className="w-full pl-6 pr-2 py-1 bg-zinc-900/50 border border-zinc-800 rounded text-xs text-zinc-400 font-mono cursor-not-allowed"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {errorMsg && (
                <div
                  data-testid="new-project-error"
                  className="px-3 py-2 rounded bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300"
                >
                  {errorMsg}
                </div>
              )}

              {/* Footer Actions */}
              {/* @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-7::REQ-001 */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  data-testid="btn-cancel-create-project"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="btn-submit-create-project"
                  disabled={
                    isSubmitting ||
                    (mode === 'create' && !projectName.trim()) ||
                    (mode === 'edit' && !displayName.trim()) ||
                    (mode === 'create' &&
                      !localOnly &&
                      checkResult?.exists &&
                      !checkResult.is_specs &&
                      !checkResult.is_empty &&
                      !confirmExisting)
                  }
                  className="px-4 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting
                    ? mode === 'create'
                      ? 'Adding...'
                      : 'Saving...'
                    : mode === 'create'
                    ? 'Add Project'
                    : 'Save Changes'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
