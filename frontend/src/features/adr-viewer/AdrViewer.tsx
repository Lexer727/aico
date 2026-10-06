import React from 'react';
import { FileText } from 'lucide-react';

interface AdrViewerProps {
  adrId: string;
}

const mockAdrs: Record<string, { title: string; status: string; context: string; decision: string; consequences: string }> = {
  'ADR-0001': {
    title: 'Local-First Zero-Daemon Architecture',
    status: 'Accepted',
    context: 'Traditional agent orchestrators rely on background Docker daemons, complex microservices, and external cloud telemetry, making local developer onboarding brittle.',
    decision: 'AICO SHALL run as a single compiled executable on localhost with embedded storage and zero background daemons.',
    consequences: 'Eliminates cloud lock-in, ensures deterministic local execution, and enables offline engineering.',
  },
  'ADR-0005': {
    title: 'Unified Accordion and Dockable Shell Layout',
    status: 'Accepted',
    context: 'Navigating between Epics, Specs, Lineage Graphs, and Terminal logs in separate windows leads to fragmented developer attention.',
    decision: 'AICO WebUI SHALL adopt a 100vh full-height workspace layout featuring a multi-level accordion tree on the left, tabbed canvas in the center, and a dockable terminal panel on the bottom/right.',
    consequences: 'Enables high-leverage navigation and seamless single-page orchestration.',
  },
  'ADR-0008': {
    title: 'Non-Destructive 6-State Task Lifecycle',
    status: 'Accepted',
    context: 'Simple binary task completion [ ] vs [x] fails to represent blocked tasks, discarded explorations, or rewrites, causing historical amnesia.',
    decision: 'All SDD tasks SHALL use a 6-state lifecycle: Pending, In Progress, Done, Blocked, Skipped/Canceled, Rewritten with structured reasons.',
    consequences: 'Preserves complete lineage and non-destructive DAG audit trails.',
  },
};

// @implements SPEC-CORE-007::REQ-008
export const AdrViewer: React.FC<AdrViewerProps> = ({ adrId }) => {
  const adr = mockAdrs[adrId] || {
    title: `${adrId}: Architecture Decision Record`,
    status: 'Accepted',
    context: 'Architectural rationale and requirements background.',
    decision: `Approved decision for ${adrId} per AICO v0.1.1 specification standards.`,
    consequences: 'Maintains system modularity and test seam isolation.',
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-zinc-100">
      <div className="border-b border-zinc-800 pb-5 space-y-2">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-amber-400" />
          <span className="font-mono text-sm px-2.5 py-1 rounded bg-zinc-800 text-amber-400 font-bold border border-zinc-700">
            {adrId}
          </span>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">{adr.title}</h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
            {adr.status}
          </span>
        </div>
      </div>

      <div className="space-y-4 text-xs">
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1.5">
          <h3 className="font-semibold text-zinc-300 uppercase tracking-wider text-[11px]">Context</h3>
          <p className="text-zinc-400 leading-relaxed font-sans">{adr.context}</p>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1.5">
          <h3 className="font-semibold text-indigo-400 uppercase tracking-wider text-[11px]">Decision</h3>
          <p className="text-zinc-200 leading-relaxed font-sans font-medium">{adr.decision}</p>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1.5">
          <h3 className="font-semibold text-emerald-400 uppercase tracking-wider text-[11px]">Consequences</h3>
          <p className="text-zinc-400 leading-relaxed font-sans">{adr.consequences}</p>
        </div>
      </div>
    </div>
  );
};
