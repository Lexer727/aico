import React from 'react';
import { BookOpen, ShieldCheck, CheckCircle2, GitBranch, ArrowLeft } from 'lucide-react';

interface SpecViewerProps {
  specId: string;
  title?: string;
  onBack?: () => void;
}

const mockSpecDetails: Record<string, {
  title: string;
  epic: string;
  status: string;
  derivesFrom: string[];
  requirements: Array<{ id: string; pattern: string; text: string; seam: string }>;
}> = {
  'SPEC-CORE-001': {
    title: 'Host Runtime & Local HTTP/WebSocket Server',
    epic: '001-aico-core',
    status: 'Completed',
    derivesFrom: ['ADR-0001', 'ADR-0003', 'ADR-0005'],
    requirements: [
      {
        id: 'REQ-001',
        pattern: 'State-driven',
        text: 'WHILE running, the host server SHALL bind to port 4242 or increment up to 10 fallback ports.',
        seam: 'crates/aico-server/src/server.rs::HostServer::bind',
      },
      {
        id: 'REQ-002',
        pattern: 'Ubiquitous',
        text: 'The host server SHALL serve embedded static React WebUI assets with SPA fallback on non-API routes.',
        seam: 'crates/aico-server/src/assets.rs::static_asset_handler',
      },
      {
        id: 'REQ-003',
        pattern: 'Event-driven',
        text: 'WHEN a client connects to /ws, the host server SHALL establish a duplex WebSocket broadcast channel.',
        seam: 'crates/aico-server/src/server.rs::ws_handler',
      },
      {
        id: 'REQ-004',
        pattern: 'Unwanted Behavior',
        text: 'IF graceful shutdown is triggered, THEN the host server SHALL broadcast drain notifications to all WebSocket clients.',
        seam: 'crates/aico-server/src/server.rs::serve_with_shutdown',
      },
    ],
  },
  'SPEC-CORE-006': {
    title: 'WebUI Workspace Shell & Dockable Layout',
    epic: '001-aico-core',
    status: 'In Progress',
    derivesFrom: ['ADR-0005', 'ADR-0008'],
    requirements: [
      {
        id: 'REQ-001',
        pattern: 'Ubiquitous',
        text: 'The WebUI shell SHALL render a full-height 100vh layout with dark zinc color palette.',
        seam: 'frontend/src/components/layout/ShellLayout.tsx',
      },
      {
        id: 'REQ-008',
        pattern: 'State-driven',
        text: 'WHILE in the sidebar, the system SHALL provide an integrated search input with persistent scope checkboxes.',
        seam: 'frontend/src/components/layout/ShellLayout.tsx::searchQuery',
      },
      {
        id: 'REQ-009',
        pattern: 'Event-driven',
        text: 'WHEN the user clicks new terminal in the dockable panel, the system SHALL instantiate a new terminal session tab.',
        seam: 'frontend/src/components/terminal/TerminalConsole.tsx',
      },
      {
        id: 'REQ-012',
        pattern: 'Ubiquitous',
        text: 'The system SHALL display real-time host activity stats (CPU %, RAM, active tasks) at the bottom of the sidebar.',
        seam: 'frontend/src/components/layout/ActivityMonitor.tsx',
      },
    ],
  },
};

// @implements SPEC-CORE-007::REQ-008
export const SpecViewer: React.FC<SpecViewerProps> = ({ specId, title, onBack }) => {
  const details = mockSpecDetails[specId] || {
    title: title || specId,
    epic: '001-aico-core',
    status: 'In Progress',
    derivesFrom: ['ADR-0001', 'ADR-0005'],
    requirements: [
      {
        id: 'REQ-001',
        pattern: 'Ubiquitous',
        text: `The system SHALL implement formal SDD specifications for ${specId}.`,
        seam: `crates/aico-core/src/${specId.toLowerCase()}.rs`,
      },
      {
        id: 'REQ-002',
        pattern: 'State-driven',
        text: 'WHILE executing, all module boundaries SHALL remain strictly verified via automated tests.',
        seam: 'tests/contract_verification_test.rs',
      },
    ],
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5 space-y-3">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm px-2.5 py-1 rounded bg-zinc-800 text-sky-400 font-bold border border-zinc-700">
              {specId}
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              {details.title}
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                details.status === 'Completed'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}
            >
              {details.status}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
            <span className="bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
              aico_version: 0.1.1
            </span>
          </div>
        </div>

        {/* YAML Metadata Strip */}
        <div className="flex items-center gap-4 text-xs text-zinc-400 font-mono pt-1">
          <span>Epic: <strong className="text-indigo-400">{details.epic}</strong></span>
          <span>•</span>
          <span>Derives From: <strong className="text-zinc-300">{details.derivesFrom.join(', ')}</strong></span>
        </div>
      </div>

      {/* Requirements Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-400" />
            <span>EARS Formal Requirements ({details.requirements.length})</span>
          </h2>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% Designated Seams Verified</span>
          </span>
        </div>

        <div className="space-y-3">
          {details.requirements.map((req) => (
            <div
              key={req.id}
              className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2.5 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/60 border border-sky-800/80 px-2 py-0.5 rounded">
                    {req.id}
                  </span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {req.pattern}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>@verifies {specId}::{req.id}</span>
                </div>
              </div>

              <p className="text-xs text-zinc-200 leading-relaxed font-sans">
                {req.text}
              </p>

              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-500 font-mono">
                <GitBranch className="w-3 h-3 text-indigo-400" />
                <span>Test Seam: <span className="text-zinc-400">{req.seam}</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
