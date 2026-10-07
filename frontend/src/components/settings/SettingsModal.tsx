import React from 'react';
import { X, Settings, Shield, Server, Database, Sliders } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// @implements spec-ft-core-webui-shell::REQ-008
// @implements spec-ft-core-webui-shell::REQ-012
export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
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
                <span className="font-mono text-zinc-300">Kùzu Property Graph (zero daemon)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Specs Root:</span>
                <span className="font-mono text-zinc-300">d:/aico/aico-specs</span>
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
