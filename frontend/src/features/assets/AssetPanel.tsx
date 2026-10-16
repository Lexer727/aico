import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  FileAudio,
  File,
  Monitor,
  AppWindow,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { FileDropZone } from '../../components/common/FileDropZone';
import { useTabStore } from '../../stores/useTabStore';

export interface DiscoveredAssetInfo {
  id: string;
  filename: string;
  path: string;
  scope_type: string;
  scope_id: string;
  source_label: string;
  is_subfeature: boolean;
  mime_type: string;
  size_bytes: number;
  updated_at: string;
  text_preview?: string;
}

export interface AssetPanelProps {
  scopeType: 'epic' | 'feature';
  scopeId: string;
  onOpenAsset?: (asset: DiscoveredAssetInfo) => void;
  onAssetDeleted?: (asset: DiscoveredAssetInfo) => void;
  onCountChange?: (count: number) => void;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function isImage(mimeType: string, filename: string): boolean {
  if (mimeType.startsWith('image/')) return true;
  const ext = filename.split('.').pop()?.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'avif'].includes(ext || '');
}

function isAudio(mimeType: string, filename: string): boolean {
  if (mimeType.startsWith('audio/')) return true;
  const ext = filename.split('.').pop()?.toLowerCase();
  return ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext || '');
}

function isTextOrCode(mimeType: string, filename: string, textPreview?: string): boolean {
  if (textPreview !== undefined && textPreview !== null) return true;
  if (mimeType.startsWith('text/')) return true;
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const lowerName = filename.toLowerCase();
  const defaultTextExts = [
    'txt', 'md', 'markdown', 'mdx', 'html', 'htm', 'css', 'scss', 'less',
    'json', 'jsonc', 'jsonl', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env',
    'xml', 'csv', 'tsv', 'sql', 'graphql', 'proto', 'log',
    'py', 'pyi', 'ipynb', 'rs', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
    'go', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'rb', 'php', 'swift',
    'scala', 'r', 'lua', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
    'dockerfile', 'makefile', 'vue', 'svelte', 'astro', 'dart', 'zig', 'sol', 'tf'
  ];
  return defaultTextExts.includes(ext) || defaultTextExts.includes(lowerName);
}

const DEFAULT_ALLOWED_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'avif', 'bmp',
  'txt', 'md', 'markdown', 'mdx', 'html', 'htm', 'css', 'scss', 'less',
  'json', 'jsonc', 'jsonl', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env',
  'xml', 'csv', 'tsv', 'sql', 'graphql', 'proto', 'log',
  'py', 'pyi', 'ipynb', 'rs', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'go', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'rb', 'php', 'swift',
  'scala', 'r', 'lua', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
  'dockerfile', 'makefile', 'vue', 'svelte', 'astro', 'dart', 'zig', 'sol', 'tf'
];

// @implements spec-ft-core-assets-manager::REQ-001
// @implements spec-ft-core-assets-manager::REQ-004
// @implements spec-ft-core-assets-manager::REQ-005
// @implements spec-ft-core-assets-manager::REQ-006
// @implements spec-ft-core-assets-manager::REQ-007
// @implements spec-ft-core-assets-manager::REQ-008
// @implements spec-ft-core-assets-manager::REQ-009
// @implements spec-ft-core-assets-manager::REQ-010
// @implements spec-ft-core-assets-manager::REQ-011
// @implements spec-ft-core-assets-manager::REQ-013
// @implements spec-ft-core-assets-manager::REQ-014
export const AssetPanel: React.FC<AssetPanelProps> = ({
  scopeType,
  scopeId,
  onOpenAsset,
  onAssetDeleted,
  onCountChange,
  className,
}) => {
  const { closeTab, activeProjectId } = useTabStore();
  const [assets, setAssets] = useState<DiscoveredAssetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowedExtensions, setAllowedExtensions] = useState<string[]>(DEFAULT_ALLOWED_EXTENSIONS);

  // Load workspace upload policies from GET /api/v1/config
  // @implements spec-ft-core-assets-manager::REQ-013
  useEffect(() => {
    fetch('/api/v1/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg) => {
        if (cfg?.assets) {
          const combined = [
            ...(cfg.assets.allowed_image_extensions || []),
            ...(cfg.assets.allowed_text_extensions || []),
          ];
          if (combined.length > 0) {
            setAllowedExtensions(combined);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Hover preview state
  const [hoveredAsset, setHoveredAsset] = useState<DiscoveredAssetInfo | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    asset: DiscoveredAssetInfo;
    x: number;
    y: number;
  } | null>(null);

  // Delete confirmation state
  const [assetToDelete, setAssetToDelete] = useState<DiscoveredAssetInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const endpoint =
        scopeType === 'epic'
          ? `/api/v1/epics/${encodeURIComponent(scopeId)}/assets`
          : `/api/v1/features/${encodeURIComponent(scopeId)}/assets`;

      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error(`Failed to load assets (${res.status})`);
      }
      const data: DiscoveredAssetInfo[] = await res.json();
      setAssets(data);
      onCountChange?.(data.length);
    } catch (err: any) {
      setError(err?.message || 'Error loading assets');
    } finally {
      setLoading(false);
    }
  }, [scopeType, scopeId, onCountChange]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Close context menu on global click or Escape
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      setError(null);
      const formData = new FormData();
      formData.append('scope_type', scopeType);
      formData.append('scope_id', scopeId);
      formData.append('file', file);

      const res = await fetch('/api/v1/assets/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed (${res.status})`);
      }

      await fetchAssets();
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleOpenOnSystem = async (asset: DiscoveredAssetInfo) => {
    try {
      setContextMenu(null);
      const res = await fetch('/api/v1/assets/open-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: asset.path }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `System launch failed (${res.status})`);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to open file on system');
    }
  };

  // @implements spec-ft-core-assets-manager::REQ-009
  const handleDeleteConfirm = async () => {
    if (!assetToDelete) return;
    try {
      setDeleting(true);
      setError(null);
      const res = await fetch('/api/v1/assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: assetToDelete.path }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to delete asset (${res.status})`);
      }
      const target = assetToDelete;
      setAssetToDelete(null);
      closeTab(activeProjectId, target.path);
      onAssetDeleted?.(target);
      await fetchAssets();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete asset');
    } finally {
      setDeleting(false);
    }
  };

  // @implements spec-ft-core-assets-manager::REQ-010
  const handleContextMenu = (e: React.MouseEvent, asset: DiscoveredAssetInfo) => {
    e.preventDefault();
    e.stopPropagation();

    const MENU_WIDTH = 180;
    const MENU_HEIGHT = 135;
    const PADDING = 10;

    const x =
      e.clientX + MENU_WIDTH > window.innerWidth - PADDING
        ? Math.max(PADDING, window.innerWidth - MENU_WIDTH - PADDING)
        : e.clientX;

    const y =
      e.clientY + MENU_HEIGHT > window.innerHeight - PADDING
        ? Math.max(PADDING, window.innerHeight - MENU_HEIGHT - PADDING)
        : e.clientY;

    setContextMenu({
      asset,
      x,
      y,
    });
  };

  const handleMouseEnter = (e: React.MouseEvent, asset: DiscoveredAssetInfo) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPos({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    setHoveredAsset(asset);
  };

  const handleMouseLeave = () => {
    setHoveredAsset(null);
    setHoverPos(null);
  };

  const getAssetIcon = (asset: DiscoveredAssetInfo) => {
    const iconClass = 'w-8 h-8 text-zinc-400 group-hover:text-zinc-200 transition-colors';
    if (isAudio(asset.mime_type, asset.filename)) {
      return <FileAudio className={clsx(iconClass, 'text-cyan-400')} />;
    }
    if (isTextOrCode(asset.mime_type, asset.filename, asset.text_preview)) {
      return <FileText className={clsx(iconClass, 'text-sky-400')} />;
    }
    return <File className={iconClass} />;
  };

  return (
    <div data-testid="asset-panel" className={clsx('space-y-4', className)}>
      {/* Upload Drop Zone */}
      <FileDropZone
        allowedExtensions={allowedExtensions}
        onFileUpload={handleFileUpload}
        className="min-h-[90px]"
      >
        <div className="flex flex-col items-center gap-1">
          <span className="font-medium text-zinc-200">
            {uploading ? 'Uploading asset...' : 'Drag & drop files here, or click to browse'}
          </span>
          <span className="text-[11px] text-zinc-400">
            Images & text/code files (.png, .md, .py, .ipynb, etc.) in {scopeType === 'epic' ? `epics/${scopeId}/assets/` : `features/${scopeId}/assets/`}
          </span>
        </div>
      </FileDropZone>

      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Gallery Header */}
      <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
        <span className="font-semibold text-zinc-300">
          Attached Assets ({assets.length})
        </span>
        {loading && (
          <div className="flex items-center gap-1 text-[11px] text-zinc-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Scanning...</span>
          </div>
        )}
      </div>

      {/* Empty State */}
      {!loading && assets.length === 0 && (
        <div
          data-testid="assets-empty-state"
          className="text-center py-6 border border-dashed border-zinc-800/80 rounded-lg text-xs text-zinc-500 bg-zinc-950/20"
        >
          No assets attached to this {scopeType} yet. Drop design mockups, audio cues, or specifications above.
        </div>
      )}

      {/* Asset Cards Grid */}
      {assets.length > 0 && (
        <div
          data-testid="assets-grid"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
        >
          {assets.map((asset) => {
            const hasImage = isImage(asset.mime_type, asset.filename);
            const rawUrl = `/api/v1/assets/raw?path=${encodeURIComponent(asset.path)}`;

            return (
              <div
                key={asset.id}
                data-testid={`asset-card-${asset.filename}`}
                onDoubleClick={() => onOpenAsset?.(asset)}
                onContextMenu={(e) => handleContextMenu(e, asset)}
                onMouseEnter={(e) => handleMouseEnter(e, asset)}
                onMouseLeave={handleMouseLeave}
                className="group relative flex flex-col rounded-lg border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700 p-2.5 cursor-pointer transition-all duration-150 select-none overflow-hidden"
              >
                {/* Thumbnail container */}
                <div className="w-full h-24 mb-2 rounded bg-zinc-950 flex items-center justify-center overflow-hidden border border-zinc-800/60 relative">
                  {hasImage ? (
                    <img
                      src={rawUrl}
                      alt={asset.filename}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    getAssetIcon(asset)
                  )}

                  {/* Origin Badge for Epics */}
                  {scopeType === 'epic' && (
                    <div className="absolute top-1.5 left-1.5 pointer-events-none">
                      {asset.is_subfeature ? (
                        <span
                          data-testid="asset-origin-subfeature"
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-950/90 text-purple-300 border border-purple-800 shadow-sm"
                        >
                          {asset.source_label}
                        </span>
                      ) : (
                        <span
                          data-testid="asset-origin-epic"
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-950/90 text-amber-300 border border-amber-800 shadow-sm"
                        >
                          epic
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="flex flex-col min-w-0">
                  <span
                    className="text-xs font-medium text-zinc-200 truncate group-hover:text-zinc-100"
                    title={asset.filename}
                  >
                    {asset.filename}
                  </span>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-1">
                    <span>{formatBytes(asset.size_bytes)}</span>
                    <button
                      type="button"
                      title="Open on system"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenOnSystem(asset);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-all"
                    >
                      <Monitor className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hover Preview Popover */}
      {hoveredAsset && hoverPos && (
        <div
          data-testid="asset-hover-popover"
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 320, Math.max(16, hoverPos.x - 150))}px`,
            top: `${Math.max(16, hoverPos.y - 200)}px`,
            zIndex: 9999,
          }}
          className="pointer-events-none w-72 rounded-xl bg-zinc-900/95 backdrop-blur-md border border-zinc-700 shadow-2xl p-3 flex flex-col gap-2 transition-opacity duration-150 animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
            <span className="text-xs font-semibold text-zinc-200 truncate pr-2">
              {hoveredAsset.filename}
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {formatBytes(hoveredAsset.size_bytes)}
            </span>
          </div>

          {isImage(hoveredAsset.mime_type, hoveredAsset.filename) ? (
            <div className="w-full max-h-48 overflow-hidden rounded bg-zinc-950 flex items-center justify-center border border-zinc-800/80">
              <img
                src={`/api/v1/assets/raw?path=${encodeURIComponent(hoveredAsset.path)}`}
                alt={hoveredAsset.filename}
                className="max-w-full max-h-48 object-contain"
              />
            </div>
          ) : hoveredAsset.text_preview ? (
            <div className="bg-zinc-950 p-2 rounded text-[11px] font-mono text-zinc-300 max-h-36 overflow-hidden border border-zinc-800/80 whitespace-pre-wrap line-clamp-6">
              {hoveredAsset.text_preview}
            </div>
          ) : (
            <div className="text-[11px] text-zinc-400 italic py-2">
              Double-click to open in tab or right-click to open on system.
            </div>
          )}

          <div className="text-[10px] text-zinc-500 truncate">
            {hoveredAsset.path}
          </div>
        </div>
      )}

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          data-testid="asset-context-menu"
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            zIndex: 10000,
          }}
          className="min-w-[160px] rounded-lg bg-zinc-900 border border-zinc-700 shadow-2xl py-1 text-xs text-zinc-200 animate-in fade-in"
        >
          <button
            type="button"
            data-testid="menu-open-system"
            onClick={() => handleOpenOnSystem(contextMenu.asset)}
            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-zinc-800 text-left transition-colors"
          >
            <Monitor className="w-3.5 h-3.5 text-sky-400" />
            <span>Open on system</span>
          </button>
          <button
            type="button"
            data-testid="menu-open-tab"
            onClick={() => {
              setContextMenu(null);
              onOpenAsset?.(contextMenu.asset);
            }}
            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-zinc-800 text-left transition-colors"
          >
            <AppWindow className="w-3.5 h-3.5 text-amber-400" />
            <span>Open in tab</span>
          </button>
          <button
            type="button"
            data-testid="menu-delete-asset"
            onClick={() => {
              const target = contextMenu.asset;
              setContextMenu(null);
              setAssetToDelete(target);
            }}
            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-rose-950/40 text-rose-300 hover:text-rose-200 text-left transition-colors border-t border-zinc-800"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {assetToDelete && (
        <div
          data-testid="asset-delete-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => {
            if (!deleting) setAssetToDelete(null);
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
                <p className="text-xs text-zinc-400 mt-0.5 truncate">
                  {assetToDelete.filename}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete <span className="font-semibold text-zinc-100 font-mono">"{assetToDelete.filename}"</span>? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                data-testid="cancel-delete-btn"
                disabled={deleting}
                onClick={() => setAssetToDelete(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 border border-zinc-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-delete-btn"
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
