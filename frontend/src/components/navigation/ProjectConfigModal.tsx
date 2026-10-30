import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, FolderGit2, Globe, Lock, Plus, Trash2, X } from 'lucide-react';
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
export const ProjectConfigModal: React.FC<ProjectConfigModalProps> = ({
  isOpen,
  mode,
  existingProjects = [],
  initialManifest = null,
  onClose,
  onSuccess,
}) => {
  const [projectName, setProjectName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [specsUrl, setSpecsUrl] = useState('');
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
      setRepositories([]);
      setIsLoadingManifest(false);
    } else {
      if (initialManifest) {
        setProjectName(initialManifest.project_name || toSlug(initialManifest.id || ''));
        setDisplayName(initialManifest.name || '');
        setDisplayNameTouched(true);
        setSpecsUrl(initialManifest.url || '');
        setRepositories(
          (initialManifest.repositories || []).map((r) => ({
            id: r.id || '',
            name: r.name || '',
            type: r.type || 'codebase',
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
              setRepositories(
                (data.repositories || []).map((r) => ({
                  id: r.id || '',
                  name: r.name || '',
                  type: r.type || 'codebase',
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

  const handleProjectNameChange = (val: string) => {
    setProjectName(val);
    if (errorMsg) setErrorMsg(null);
    if (!displayNameTouched && mode === 'create') {
      const slug = toSlug(val);
      const title = toTitleCase(slug);
      setDisplayName(title ? `${title} Specs` : '');
    }
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
            updated.name = `${toTitleCase(cleanId)} ${
              updated.type === 'skills' ? 'Skills' : 'Codebase'
            }`;
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
        type: r.type || 'codebase',
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
            url: specsUrl.trim() || undefined,
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <Briefcase className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-zinc-100">
              {mode === 'create'
                ? 'Create New Project (.aico-project.json)'
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

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Specs Repository Remote URL (optional)
                  </label>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      data-testid="input-project-specs-url"
                      value={specsUrl}
                      onChange={(e) => setSpecsUrl(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="https://github.com/org/project-specs (optional)"
                      className="w-full pl-8 pr-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-100 font-mono placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Linked Codebase / Skills Repositories Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                      Linked Repositories ({repositories.length})
                    </span>
                    <p className="text-[10px] text-zinc-500">
                      Configure codebase or skills repositories mapped under <code className="text-zinc-400">../codebase/&lt;id&gt;</code>
                    </p>
                  </div>
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

                {repositories.length === 0 ? (
                  <div className="p-3 rounded-lg border border-dashed border-zinc-800 text-center text-[11px] text-zinc-500">
                    {mode === 'create'
                      ? `Default codebase repository (${computedSlug || '<id>'}) will be created automatically, or click "Add Repository" to customize.`
                      : 'No linked codebase or skills repositories configured. Click "Add Repository" to add one.'}
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
                              <select
                                data-testid={`select-repo-type-${idx}`}
                                value={repo.type}
                                onChange={(e) =>
                                  handleUpdateRepository(idx, 'type', e.target.value)
                                }
                                className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                              >
                                <option value="codebase">codebase</option>
                                <option value="skills">skills</option>
                              </select>
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
                    (mode === 'edit' && !displayName.trim())
                  }
                  className="px-4 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting
                    ? mode === 'create'
                      ? 'Creating...'
                      : 'Saving...'
                    : mode === 'create'
                    ? 'Create Project'
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
