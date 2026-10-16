import React, { useState, useEffect } from 'react';
import {
  Monitor,
  AlertCircle,
  FileText,
  FileAudio,
  File,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useTabStore } from '../../stores/useTabStore';

export interface AssetViewerProps {
  assetId: string;
  title: string;
  path?: string;
  onOpenSystem?: (path: string) => void;
  onDelete?: (path: string) => void;
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function isImageFile(ext: string): boolean {
  return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'avif'].includes(ext);
}

function isAudioFile(ext: string): boolean {
  return ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);
}

function isTextFile(ext: string, filename?: string): boolean {
  const textExtensions = [
    'txt', 'md', 'markdown', 'mdx', 'html', 'htm', 'css', 'scss', 'less',
    'json', 'jsonc', 'jsonl', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env',
    'xml', 'csv', 'tsv', 'sql', 'graphql', 'proto', 'log',
    'py', 'pyi', 'ipynb', 'rs', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
    'go', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'rb', 'php', 'swift',
    'scala', 'r', 'lua', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
    'dockerfile', 'makefile', 'vue', 'svelte', 'astro', 'dart', 'zig', 'sol', 'tf',
  ];
  return textExtensions.includes(ext) || (filename ? textExtensions.includes(filename.toLowerCase()) : false);
}

// @implements spec-ft-core-assets-manager::REQ-007
// @implements spec-ft-core-assets-manager::REQ-008
// @implements spec-ft-core-assets-manager::REQ-009
export const AssetViewer: React.FC<AssetViewerProps> = ({
  assetId,
  title,
  path,
  onOpenSystem,
  onDelete,
}) => {
  const { closeTab, activeProjectId } = useTabStore();
  const assetPath = path || assetId;
  const ext = getFileExtension(title || assetPath);
  const rawUrl = `/api/v1/assets/raw?path=${encodeURIComponent(assetPath)}`;

  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isTextFile(ext, title || assetPath)) {
      setLoading(true);
      setError(null);
      fetch(rawUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((text) => setTextContent(text))
        .catch((err) => setError(err.message || 'Failed to read asset content'))
        .finally(() => setLoading(false));
    }
  }, [rawUrl, ext]);

  const handleLaunchSystem = async () => {
    try {
      setLaunchMessage(null);
      setError(null);
      if (onOpenSystem) {
        onOpenSystem(assetPath);
      } else {
        const res = await fetch('/api/v1/assets/open-system', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: assetPath }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `System launch failed (${res.status})`);
        }
      }
      setLaunchMessage('Opened in system default app');
      setTimeout(() => setLaunchMessage(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to open on system');
    }
  };

  // @implements spec-ft-core-assets-manager::REQ-009
  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);
      setError(null);
      const res = await fetch('/api/v1/assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: assetPath }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to delete asset (${res.status})`);
      }
      setShowDeleteConfirm(false);
      closeTab(activeProjectId, assetPath);
      onDelete?.(assetPath);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete asset');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div data-testid="asset-viewer" className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700/80">
            {isImageFile(ext) ? (
              <File className="w-5 h-5 text-indigo-400" />
            ) : isAudioFile(ext) ? (
              <FileAudio className="w-5 h-5 text-cyan-400" />
            ) : isTextFile(ext, title || assetPath) ? (
              <FileText className="w-5 h-5 text-sky-400" />
            ) : (
              <File className="w-5 h-5 text-zinc-400" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm text-zinc-100 truncate" title={title}>
              {title}
            </span>
            <span className="text-xs text-zinc-400 font-mono truncate" title={assetPath}>
              {assetPath}
            </span>
          </div>
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-2">
          {launchMessage && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded-md animate-in fade-in">
              <Check className="w-3.5 h-3.5" />
              <span>{launchMessage}</span>
            </div>
          )}

          {isImageFile(ext) && (
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 mr-2 text-zinc-400 text-xs">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(25, z - 25))}
                title="Zoom Out"
                className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 font-mono text-[11px] min-w-[40px] text-center">{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(400, z + 25))}
                title="Zoom In"
                className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(100)}
                title="Reset Zoom"
                className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded ml-0.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            data-testid="asset-open-system-btn"
            onClick={handleLaunchSystem}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors shadow-sm"
          >
            <Monitor className="w-4 h-4 text-sky-400" />
            <span>Open on system</span>
          </button>

          <button
            type="button"
            data-testid="asset-delete-btn"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete Asset"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-800 border border-zinc-700 text-xs font-medium text-zinc-300 transition-colors shadow-sm"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="m-4 flex items-center gap-2 p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Preview Viewport */}
      <div className="flex-1 overflow-auto p-6 flex items-center justify-center min-h-0 bg-zinc-950">
        {isImageFile(ext) ? (
          <div className="overflow-auto max-w-full max-h-full flex items-center justify-center">
            <img
              src={rawUrl}
              alt={title}
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
              className="max-w-full max-h-[75vh] object-contain rounded-lg border border-zinc-800/80 shadow-2xl transition-transform duration-100"
            />
          </div>
        ) : isAudioFile(ext) ? (
          <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl max-w-md w-full">
            <FileAudio className="w-16 h-16 text-cyan-400" />
            <span className="text-sm font-medium text-zinc-200">{title}</span>
            <audio controls src={rawUrl} className="w-full mt-2" />
          </div>
        ) : isTextFile(ext, title || assetPath) ? (
          <div className="w-full h-full max-w-4xl rounded-xl bg-zinc-900/70 border border-zinc-800 p-4 overflow-auto font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed shadow-inner">
            {loading ? 'Loading content...' : textContent || '(Empty document)'}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl max-w-md w-full text-center">
            <File className="w-16 h-16 text-zinc-500" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-200">{title}</span>
              <span className="text-xs text-zinc-400 mt-1">Binary or unsupported inline preview</span>
            </div>
            <button
              type="button"
              onClick={handleLaunchSystem}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors"
            >
              <Monitor className="w-4 h-4" />
              <span>Open in Default System Program</span>
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          data-testid="asset-viewer-delete-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => {
            if (!deleting) setShowDeleteConfirm(false);
          }}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl flex flex-col gap-4 text-zinc-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <h3 className="text-sm font-semibold text-zinc-100">Delete Asset</h3>
                <p className="text-xs text-zinc-400 mt-0.5 truncate">{title}</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete <span className="font-semibold text-zinc-100 font-mono">"{title}"</span>? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                data-testid="cancel-delete-modal-btn"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 border border-zinc-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-delete-modal-btn"
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs text-white font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
