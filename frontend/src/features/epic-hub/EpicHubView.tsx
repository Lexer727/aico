import React, { useState } from 'react';
import {
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Layers,
  FileText,
  CheckSquare,
  GitFork,
  ShieldCheck,
  FolderArchive,
  ArrowRight,
  Package,
} from 'lucide-react';
import { FileDropZone } from '../../components/common/FileDropZone';

export interface EpicData {
  id: string;
  title: string;
  status: string;
  verifiedCount: number;
  totalCount: number;
  sections: {
    overview: string;
    brainstorm: string;
    specifications: string;
    deepDive: string;
    taskPlan: string;
    assets: string;
  };
}

interface EpicHubViewProps {
  epic: EpicData;
  onPopOut?: (epicId: string, section: string) => void;
  onOpenSpec?: (specId: string, title: string) => void;
  onOpenFeature?: (featureId: string, name: string) => void;
  uploadedFiles?: string[];
  onFileUpload?: (file: File) => void;
}

// Features definition
const coreFeaturesList = [
  {
    id: '01-host-runtime',
    name: 'Host Runtime & Local HTTP/WS Server',
    specId: 'SPEC-CORE-001',
    planId: 'PLAN-CORE-001',
    status: 'Completed',
    desc: 'Axum embedded server on port 4242 with SPA fallback and WebSocket broadcast hub.',
  },
  {
    id: '02-security-auth',
    name: 'LAN Security & Local Authentication',
    specId: 'SPEC-CORE-002',
    planId: 'PLAN-CORE-002',
    status: 'Completed',
    desc: 'Strict loopback binding, QR pairing, and SHA-256 HMAC token gate.',
  },
  {
    id: '03-local-storage',
    name: 'Local Storage & Embedded Engine Lifecycle',
    specId: 'SPEC-CORE-003',
    planId: 'PLAN-CORE-003',
    status: 'Completed',
    desc: 'In-process LanceDB vector search and Kùzu graph without Docker or background daemons.',
  },
  {
    id: '04-discovery',
    name: 'Workspace & Multi-Project Discovery',
    specId: 'SPEC-CORE-004',
    planId: 'PLAN-CORE-004',
    status: 'Completed',
    desc: 'Project manifest scanning and active workspace registry synchronization.',
  },
  {
    id: '05-mcp-tools',
    name: 'Deterministic SDD Tool Registration',
    specId: 'SPEC-CORE-005',
    planId: 'PLAN-CORE-005',
    status: 'Completed',
    desc: 'In-process Model Context Protocol tool gates enforcing strict SDD contracts.',
  },
  {
    id: '06-webui-shell',
    name: 'WebUI Workspace Shell & Dockable Layout',
    specId: 'SPEC-CORE-006',
    planId: 'PLAN-CORE-006',
    status: 'In Progress',
    desc: '100vh Shell, sidebar tree search, 5 filter scopes, activity monitor, and multi-terminals.',
  },
  {
    id: '07-epic-hub',
    name: 'Single-Page Epic Hub & Lineage Graph',
    specId: 'SPEC-CORE-007',
    planId: 'PLAN-CORE-007',
    status: 'In Progress',
    desc: '2-column overview, visual wave task plan with progress bars, and lineage graph.',
  },
];

// Specs definitions
const coreSpecsList = [
  {
    id: 'SPEC-CORE-001',
    title: 'Host Runtime & Local HTTP/WebSocket Server',
    status: 'Completed',
    reqs: 10,
    seam: 'crates/aico-server/src/server.rs',
  },
  {
    id: 'SPEC-CORE-002',
    title: 'LAN Security & Local Authentication',
    status: 'Completed',
    reqs: 8,
    seam: 'crates/aico-server/src/auth.rs',
  },
  {
    id: 'SPEC-CORE-003',
    title: 'Local Storage & Embedded Engine Lifecycle',
    status: 'Completed',
    reqs: 8,
    seam: 'crates/aico-storage/src/embedded.rs',
  },
  {
    id: 'SPEC-CORE-004',
    title: 'Workspace & Multi-Project Discovery',
    status: 'Completed',
    reqs: 11,
    seam: 'crates/aico-core/src/scanner.rs',
  },
  {
    id: 'SPEC-CORE-005',
    title: 'Deterministic SDD Tool Registration',
    status: 'Completed',
    reqs: 9,
    seam: 'crates/aico-mcp/src/registry.rs',
  },
  {
    id: 'SPEC-CORE-006',
    title: 'WebUI Workspace Shell & Dockable Layout',
    status: 'In Progress',
    reqs: 13,
    seam: 'frontend/src/components/layout/ShellLayout.tsx',
  },
  {
    id: 'SPEC-CORE-007',
    title: 'Single-Page Epic Hub & Lineage Graph',
    status: 'In Progress',
    reqs: 11,
    seam: 'frontend/src/features/epic-hub/EpicHubView.tsx',
  },
];

// Visual Task Waves for 001-aico-core
interface TaskItem {
  id: string;
  title: string;
  status: 'Done' | 'In Progress' | 'Pending' | 'Blocked';
  spec: string;
  deps: string[];
}

interface TaskWave {
  waveNumber: number;
  name: string;
  featureId: string;
  tasks: TaskItem[];
}

const coreTaskWaves: TaskWave[] = [
  {
    waveNumber: 1,
    name: 'Host Runtime & Dynamic Binding',
    featureId: '01-host-runtime',
    tasks: [
      { id: 'TASK-CORE-001-1', title: 'Axum Server Scaffolding & Dynamic Port Binding', status: 'Done', spec: 'SPEC-CORE-001', deps: ['None'] },
      { id: 'TASK-CORE-001-2', title: 'Embedded Static Asset Serving with SPA Fallback', status: 'Done', spec: 'SPEC-CORE-001', deps: ['TASK-CORE-001-1'] },
      { id: 'TASK-CORE-001-3', title: 'Full-Duplex WebSocket Broadcast Hub', status: 'Done', spec: 'SPEC-CORE-001', deps: ['TASK-CORE-001-1'] },
      { id: 'TASK-CORE-001-4', title: 'Graceful Shutdown Broadcasting & Drain', status: 'Done', spec: 'SPEC-CORE-001', deps: ['TASK-CORE-001-3'] },
      { id: 'TASK-CORE-001-5', title: 'Host Runtime Integration Test Suite', status: 'Done', spec: 'SPEC-CORE-001', deps: ['TASK-CORE-001-2', 'TASK-CORE-001-4'] },
    ],
  },
  {
    waveNumber: 2,
    name: 'LAN Security & Authentication',
    featureId: '02-security-auth',
    tasks: [
      { id: 'TASK-CORE-002-1', title: 'Loopback Mode Default & Binding Constraints', status: 'Done', spec: 'SPEC-CORE-002', deps: ['None'] },
      { id: 'TASK-CORE-002-2', title: 'Token-Based Authentication & QR Pairing', status: 'Done', spec: 'SPEC-CORE-002', deps: ['TASK-CORE-002-1'] },
      { id: 'TASK-CORE-002-3', title: 'Security Audit Logger & Auto-Mode Policy', status: 'Done', spec: 'SPEC-CORE-002', deps: ['TASK-CORE-002-2'] },
      { id: 'TASK-CORE-002-4', title: 'LAN Security & Auth Test Seams', status: 'Done', spec: 'SPEC-CORE-002', deps: ['TASK-CORE-002-3'] },
    ],
  },
  {
    waveNumber: 3,
    name: 'Local Storage & Embedded Engines',
    featureId: '03-local-storage',
    tasks: [
      { id: 'TASK-CORE-003-1', title: 'LanceDB Embedded Vector Storage Setup', status: 'Done', spec: 'SPEC-CORE-003', deps: ['None'] },
      { id: 'TASK-CORE-003-2', title: 'Kùzu Embedded Property Graph Lifecycle', status: 'Done', spec: 'SPEC-CORE-003', deps: ['TASK-CORE-003-1'] },
      { id: 'TASK-CORE-003-3', title: 'Hybrid Query Coordinator & Search Seams', status: 'Done', spec: 'SPEC-CORE-003', deps: ['TASK-CORE-003-2'] },
      { id: 'TASK-CORE-003-4', title: 'File Watcher & Incremental Ingestion', status: 'Done', spec: 'SPEC-CORE-003', deps: ['TASK-CORE-003-3'] },
      { id: 'TASK-CORE-003-5', title: 'Embedded Storage Concurrency Test Suite', status: 'Done', spec: 'SPEC-CORE-003', deps: ['TASK-CORE-003-4'] },
    ],
  },
  {
    waveNumber: 4,
    name: 'Workspace & Multi-Project Discovery',
    featureId: '04-discovery',
    tasks: [
      { id: 'TASK-CORE-004-1', title: 'Project Manifest Parser & Validation', status: 'Done', spec: 'SPEC-CORE-004', deps: ['None'] },
      { id: 'TASK-CORE-004-2', title: 'Unified Root Scanner & Workspace Registry', status: 'Done', spec: 'SPEC-CORE-004', deps: ['TASK-CORE-004-1'] },
      { id: 'TASK-CORE-004-3', title: 'Active Project Selection REST API', status: 'Done', spec: 'SPEC-CORE-004', deps: ['TASK-CORE-004-2'] },
      { id: 'TASK-CORE-004-4', title: 'Discovery Scanner & Project Switcher Tests', status: 'Done', spec: 'SPEC-CORE-004', deps: ['TASK-CORE-004-3'] },
    ],
  },
  {
    waveNumber: 5,
    name: 'Deterministic SDD Tool Registration',
    featureId: '05-mcp-tools',
    tasks: [
      { id: 'TASK-CORE-005-1', title: 'In-Process Model Context Protocol Engine', status: 'Done', spec: 'SPEC-CORE-005', deps: ['None'] },
      { id: 'TASK-CORE-005-2', title: 'SDD Deterministic Tool Handlers Registration', status: 'Done', spec: 'SPEC-CORE-005', deps: ['TASK-CORE-005-1'] },
      { id: 'TASK-CORE-005-3', title: 'Tree-sitter Traceability Tag Watcher', status: 'Done', spec: 'SPEC-CORE-005', deps: ['TASK-CORE-005-2'] },
      { id: 'TASK-CORE-005-4', title: 'Contract Enforcement Gate & Verification Loop', status: 'Done', spec: 'SPEC-CORE-005', deps: ['TASK-CORE-005-3'] },
      { id: 'TASK-CORE-005-5', title: 'MCP Dispatch & Error Handling Test Suites', status: 'Done', spec: 'SPEC-CORE-005', deps: ['TASK-CORE-005-4'] },
    ],
  },
  {
    waveNumber: 6,
    name: 'WebUI Workspace Shell & Dockable Layout',
    featureId: '06-webui-shell',
    tasks: [
      { id: 'TASK-CORE-006-1', title: 'ShellLayout 100vh Scaffold & Dark Theme', status: 'Done', spec: 'SPEC-CORE-006', deps: ['None'] },
      { id: 'TASK-CORE-006-2', title: 'Left Sidebar Navigation Accordion Tree', status: 'Done', spec: 'SPEC-CORE-006', deps: ['TASK-CORE-006-1'] },
      { id: 'TASK-CORE-006-3', title: 'Project-Scoped TabBar & Broadcast Synchronization', status: 'Done', spec: 'SPEC-CORE-006', deps: ['TASK-CORE-006-2'] },
      { id: 'TASK-CORE-006-4', title: 'Dockable Bottom/Right Auxiliary Terminal Panel', status: 'Done', spec: 'SPEC-CORE-006', deps: ['TASK-CORE-006-3'] },
      { id: 'TASK-CORE-006-5', title: 'Global OmniSearch Modal (Ctrl+K)', status: 'Done', spec: 'SPEC-CORE-006', deps: ['TASK-CORE-006-4'] },
      { id: 'TASK-CORE-006-6', title: 'Tailwind CSS Integration & Layout Theme Restoration', status: 'Done', spec: 'SPEC-CORE-006', deps: ['TASK-CORE-006-5'] },
      { id: 'TASK-CORE-006-7', title: 'Dynamic Project Discovery & Active Workspace Binding', status: 'Done', spec: 'SPEC-CORE-006', deps: ['TASK-CORE-006-6'] },
      { id: 'TASK-CORE-006-8', title: 'Sidebar Integrated Search & Activity Monitor', status: 'Done', spec: 'SPEC-CORE-006', deps: ['TASK-CORE-006-7'] },
      { id: 'TASK-CORE-006-9', title: 'Multi-Tab Terminal System with Dynamic Tab Creation', status: 'Done', spec: 'SPEC-CORE-006', deps: ['TASK-CORE-006-8'] },
      { id: 'TASK-CORE-006-10', title: 'Sidebar Settings Modal & Configuration View', status: 'Done', spec: 'SPEC-CORE-006', deps: ['TASK-CORE-006-8'] },
      { id: 'TASK-CORE-006-11', title: 'Tree-Integrated Search, 5-Scope Filter & Middle Click Close', status: 'Done', spec: 'SPEC-CORE-006', deps: ['TASK-CORE-006-10'] },
    ],
  },
  {
    waveNumber: 7,
    name: 'Single-Page Epic Hub & Visual Lineage Graph',
    featureId: '07-epic-hub',
    tasks: [
      { id: 'TASK-CORE-007-1', title: 'EpicHubView Consolidated Single-Page Component', status: 'Done', spec: 'SPEC-CORE-007', deps: ['None'] },
      { id: 'TASK-CORE-007-2', title: 'VisualLineageCanvas Interactive Graph', status: 'Done', spec: 'SPEC-CORE-007', deps: ['TASK-CORE-007-1'] },
      { id: 'TASK-CORE-007-3', title: 'Section Pop-Out Tabs & Multi-Tab Synchronization', status: 'Done', spec: 'SPEC-CORE-007', deps: ['TASK-CORE-007-2'] },
      { id: 'TASK-CORE-007-4', title: 'Multimodal Asset Drag & Drop Zone', status: 'Done', spec: 'SPEC-CORE-007', deps: ['TASK-CORE-007-3'] },
      { id: 'TASK-CORE-007-5', title: 'Epic Hub Verification & Vitest Test Suites', status: 'Done', spec: 'SPEC-CORE-007', deps: ['TASK-CORE-007-4'] },
      { id: 'TASK-CORE-007-6', title: 'Dynamic Multi-Epic Discovery via Server REST API', status: 'Done', spec: 'SPEC-CORE-007', deps: ['TASK-CORE-007-5'] },
      { id: 'TASK-CORE-007-7', title: 'Workspace Home / Dashboard View with Epic Progress', status: 'Done', spec: 'SPEC-CORE-007', deps: ['TASK-CORE-007-6'] },
      { id: 'TASK-CORE-007-8', title: 'Active Tab Content Renderer for Spec, Code, ADR, Epic', status: 'Done', spec: 'SPEC-CORE-007', deps: ['TASK-CORE-007-7'] },
      { id: 'TASK-CORE-007-9', title: 'Epic Hub Accordion Content Expansion', status: 'Done', spec: 'SPEC-CORE-007', deps: ['TASK-CORE-007-8'] },
      { id: 'TASK-CORE-007-10', title: '2-Column Epic Hub Layout & Spatial Optimization', status: 'Done', spec: 'SPEC-CORE-007', deps: ['TASK-CORE-007-9'] },
      { id: 'TASK-CORE-007-11', title: 'Visual Wave Task Plan with Overall & Per-Wave Progress', status: 'Done', spec: 'SPEC-CORE-007', deps: ['TASK-CORE-007-10'] },
      { id: 'TASK-CORE-007-12', title: 'Feature Bundle View & SDD Frontmatter Parser Fix', status: 'Done', spec: 'SPEC-CORE-007', deps: ['TASK-CORE-007-11'] },
    ],
  },
];

// @implements SPEC-CORE-007::REQ-001
// @implements SPEC-CORE-007::REQ-002
// @implements SPEC-CORE-007::REQ-003
// @implements SPEC-CORE-007::REQ-005
// @implements SPEC-CORE-007::REQ-011
export const EpicHubView: React.FC<EpicHubViewProps> = ({
  epic,
  onPopOut,
  onOpenSpec,
  onOpenFeature,
  uploadedFiles = [],
  onFileUpload,
}) => {
  // Layout states:
  // Overview: open by default (collapsed = false)
  // Left column (Brainstorm, Specs, Deep Dive, Assets): closed by default (collapsed = true)
  // Right column (Task Plan): open by default (collapsed = false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    overview: false,
    brainstorm: true,
    specifications: true,
    deepDive: true,
    assets: true,
    taskPlan: false,
  });

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Compute overall task plan progress
  const totalTasks = coreTaskWaves.reduce((acc, w) => acc + w.tasks.length, 0);
  const doneTasks = coreTaskWaves.reduce(
    (acc, w) => acc + w.tasks.filter((t) => t.status === 'Done').length,
    0
  );
  const overallPercentage = Math.round((doneTasks / totalTasks) * 100);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Epic Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">{epic.title}</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800">
              {epic.status}
            </span>
            <span className="px-2.5 py-0.5 text-xs font-mono rounded bg-zinc-800 text-zinc-300">
              [{epic.verifiedCount}/{epic.totalCount} Verified]
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1 font-mono">Epic ID: {epic.id}</p>
        </div>
      </div>

      {/* TOP SECTION: Overview (Open by default across full width) */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
        <div
          onClick={() => toggleSection('overview')}
          className="flex items-center justify-between px-4 py-3 bg-zinc-900 cursor-pointer select-none hover:bg-zinc-900/80 transition-colors"
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {collapsedSections.overview ? (
              <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            )}
            <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span className="font-semibold text-sm text-zinc-200">Overview</span>
            {collapsedSections.overview && (
              <span className="text-xs text-zinc-500 truncate ml-2 italic">
                — {epic.sections.overview}
              </span>
            )}
          </div>
          <button
            data-testid="popout-overview"
            onClick={(e) => {
              e.stopPropagation();
              onPopOut?.(epic.id, 'overview');
            }}
            title="Open in separate tab"
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {!collapsedSections.overview && (
          <div className="p-5 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-5">
            {/* Executive Summary */}
            <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800">
              <h4 className="text-xs font-semibold text-zinc-200 mb-1">Executive Summary</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Autonomous Intelligent Code Orchestrator (AICO) delivers a zero-daemon, local-first
                Spec-Driven Development (SDD) environment. Embedded LanceDB and Kùzu engines, deterministic
                MCP tool gates, and strict EARS contracts guarantee architectural consistency and zero cloud amnesia.
              </p>
            </div>

            {/* Features in this Epic (Openable feature bundles) */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-indigo-400" />
                <span>Features in this Epic ({coreFeaturesList.length})</span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {coreFeaturesList.map((feat) => (
                  <div
                    key={feat.id}
                    onClick={() => onOpenFeature?.(feat.id, feat.name)}
                    className="p-3 bg-zinc-900 border border-zinc-800 hover:border-indigo-500/60 rounded-lg cursor-pointer transition-colors space-y-1 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-indigo-400 group-hover:text-indigo-300">
                        {feat.id}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-zinc-800 text-zinc-400">
                        {feat.status}
                      </span>
                    </div>
                    <div className="font-semibold text-xs text-zinc-200 group-hover:text-white truncate">
                      {feat.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {feat.specId} • {feat.planId}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ubiquitous Domain Terminology */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Ubiquitous Domain Terminology
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded">
                  <span className="font-semibold text-indigo-400 block">Local-First SDD</span>
                  <span className="text-zinc-400 text-[11px]">
                    Zero external daemons. LanceDB vector search and Kùzu graph run in-process.
                  </span>
                </div>
                <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded">
                  <span className="font-semibold text-sky-400 block">EARS Syntax</span>
                  <span className="text-zinc-400 text-[11px]">
                    Easy Approach to Requirements Syntax: Ubiquitous, Event-driven, State-driven.
                  </span>
                </div>
                <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded">
                  <span className="font-semibold text-emerald-400 block">Tracer Bullets</span>
                  <span className="text-zinc-400 text-[11px]">
                    Vertical task slices penetrating every layer end-to-end to verify architectural feasibility.
                  </span>
                </div>
                <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded">
                  <span className="font-semibold text-amber-400 block">Designated Test Seams</span>
                  <span className="text-zinc-400 text-[11px]">
                    Deterministic test interfaces tagged with @verifies and verified via automated suites.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2-COLUMN SECTION: Left = Brainstorm, Specs, Deep Dive, Assets | Right = Task Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: Brainstorm, Specs, Deep Dive, Assets (All Closed by Default) */}
        <div className="space-y-3">
          {/* Brainstorm Accordion */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
            <div
              onClick={() => toggleSection('brainstorm')}
              className="flex items-center justify-between px-4 py-3 bg-zinc-900 cursor-pointer select-none hover:bg-zinc-900/80 transition-colors"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {collapsedSections.brainstorm ? (
                  <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                )}
                <Layers className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span className="font-semibold text-sm text-zinc-200">Brainstorm</span>
                {collapsedSections.brainstorm && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — {epic.sections.brainstorm}
                  </span>
                )}
              </div>
              <button
                data-testid="popout-brainstorm"
                onClick={(e) => {
                  e.stopPropagation();
                  onPopOut?.(epic.id, 'brainstorm');
                }}
                title="Open in separate tab"
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
            {!collapsedSections.brainstorm && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-3">
                <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-200">Architectural Trade-Offs</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-400">
                          <th className="pb-1.5 font-medium">Vector</th>
                          <th className="pb-1.5 font-medium">Approach</th>
                          <th className="pb-1.5 font-medium">Rationale</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 text-zinc-300 text-[11px]">
                        <tr>
                          <td className="py-1.5 text-indigo-400 font-mono">Storage</td>
                          <td className="py-1.5">LanceDB + Kùzu</td>
                          <td className="py-1.5 text-zinc-400">Zero Docker setup, sub-millisecond query latency.</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 text-indigo-400 font-mono">UI Host</td>
                          <td className="py-1.5">Axum Embedded</td>
                          <td className="py-1.5 text-zinc-400">Port 4242 loopback with SPA fallback.</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 text-indigo-400 font-mono">Security</td>
                          <td className="py-1.5">Loopback & Token Gate</td>
                          <td className="py-1.5 text-zinc-400">Restricts unauthorized remote commands.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Specifications Accordion */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
            <div
              onClick={() => toggleSection('specifications')}
              className="flex items-center justify-between px-4 py-3 bg-zinc-900 cursor-pointer select-none hover:bg-zinc-900/80 transition-colors"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {collapsedSections.specifications ? (
                  <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                )}
                <ShieldCheck className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <span className="font-semibold text-sm text-zinc-200">Specifications</span>
                {collapsedSections.specifications && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — {epic.sections.specifications}
                  </span>
                )}
              </div>
              <button
                data-testid="popout-specifications"
                onClick={(e) => {
                  e.stopPropagation();
                  onPopOut?.(epic.id, 'specifications');
                }}
                title="Open in separate tab"
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
            {!collapsedSections.specifications && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-2">
                {coreSpecsList.map((spec) => (
                  <div
                    key={spec.id}
                    className="p-2.5 bg-zinc-900/80 rounded border border-zinc-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-sky-400">{spec.id}</span>
                        <span className="text-xs text-zinc-200">{spec.title}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        {spec.reqs} Requirements • Seam: {spec.seam}
                      </div>
                    </div>
                    <button
                      onClick={() => onOpenSpec?.(spec.id, spec.title)}
                      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deep Dive Accordion */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
            <div
              onClick={() => toggleSection('deepDive')}
              className="flex items-center justify-between px-4 py-3 bg-zinc-900 cursor-pointer select-none hover:bg-zinc-900/80 transition-colors"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {collapsedSections.deepDive ? (
                  <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                )}
                <GitFork className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span className="font-semibold text-sm text-zinc-200">Deep Dive</span>
                {collapsedSections.deepDive && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — {epic.sections.deepDive}
                  </span>
                )}
              </div>
              <button
                data-testid="popout-deepDive"
                onClick={(e) => {
                  e.stopPropagation();
                  onPopOut?.(epic.id, 'deepDive');
                }}
                title="Open in separate tab"
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
            {!collapsedSections.deepDive && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-2">
                <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-200">Designated Contract Seams</h4>
                  <div className="space-y-1.5 text-[11px] font-mono text-zinc-400">
                    <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                      <span className="text-emerald-400 font-semibold">crates/aico-server::server.rs</span>
                      <div className="text-zinc-500 text-[10px]">Axum REST routes: /api/v1/projects, /api/v1/epics, /api/v1/adrs</div>
                    </div>
                    <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                      <span className="text-emerald-400 font-semibold">crates/aico-server::ws_hub.rs</span>
                      <div className="text-zinc-500 text-[10px]">Duplex WebSocket broadcast hub with subscriber channels</div>
                    </div>
                    <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                      <span className="text-emerald-400 font-semibold">frontend::ShellLayout.tsx</span>
                      <div className="text-zinc-500 text-[10px]">Integrated sidebar tree search with 5 scope filters</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Assets Accordion (Contains File Drop Zone when expanded) */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
            <div
              onClick={() => toggleSection('assets')}
              className="flex items-center justify-between px-4 py-3 bg-zinc-900 cursor-pointer select-none hover:bg-zinc-900/80 transition-colors"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {collapsedSections.assets ? (
                  <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                )}
                <FolderArchive className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="font-semibold text-sm text-zinc-200">Assets</span>
                {collapsedSections.assets && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — {epic.sections.assets}
                  </span>
                )}
              </div>
              <button
                data-testid="popout-assets"
                onClick={(e) => {
                  e.stopPropagation();
                  onPopOut?.(epic.id, 'assets');
                }}
                title="Open in separate tab"
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
            {!collapsedSections.assets && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800 text-center text-[10px] text-zinc-400 truncate">
                    ui_workspace.png
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800 text-center text-[10px] text-zinc-400 truncate">
                    ui_dock_right.png
                  </div>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800 text-center text-[10px] text-zinc-400 truncate">
                    ui_search_modal.png
                  </div>
                </div>

                {/* Multimodal Asset Drop Zone inside expanded Assets */}
                <div className="pt-2">
                  <FileDropZone onFileUpload={(f) => onFileUpload?.(f)}>
                    <span>Drag & drop design mockups, audio files, or specifications here</span>
                  </FileDropZone>
                  {uploadedFiles.length > 0 && (
                    <div className="text-[11px] text-zinc-400 mt-2">
                      Attached: {uploadedFiles.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Task Plan (Alone on the right, open by default, with waves and progress bars) */}
        <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50 flex flex-col">
          <div
            onClick={() => toggleSection('taskPlan')}
            className="flex items-center justify-between px-4 py-3 bg-zinc-900 cursor-pointer select-none hover:bg-zinc-900/80 transition-colors"
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              {collapsedSections.taskPlan ? (
                <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              )}
              <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="font-semibold text-sm text-zinc-200">Task Plan</span>
              {collapsedSections.taskPlan && (
                <span className="text-xs text-zinc-500 truncate ml-2 italic">
                  — {epic.sections.taskPlan}
                </span>
              )}
            </div>
            <button
              data-testid="popout-taskPlan"
              onClick={(e) => {
                e.stopPropagation();
                onPopOut?.(epic.id, 'taskPlan');
              }}
              title="Open in separate tab"
              className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {!collapsedSections.taskPlan && (
            <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-5">
              {/* Overall Progress Track Bar */}
              <div className="p-3.5 bg-zinc-950/80 rounded-xl border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-200">Overall Task Plan Progress</span>
                  <span className="font-mono text-emerald-400">
                    {doneTasks} / {totalTasks} Tasks Done ({overallPercentage}%)
                  </span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-2.5 overflow-hidden border border-zinc-800">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${overallPercentage}%` }}
                  />
                </div>
              </div>

              {/* Sequential Waves with Individual Progress Bars */}
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
                {coreTaskWaves.map((wave) => {
                  const waveDone = wave.tasks.filter((t) => t.status === 'Done').length;
                  const waveTotal = wave.tasks.length;
                  const wavePct = Math.round((waveDone / waveTotal) * 100);

                  return (
                    <div
                      key={wave.waveNumber}
                      className="p-3.5 bg-zinc-900/60 rounded-xl border border-zinc-800/80 space-y-3"
                    >
                      {/* Wave Header & Dedicated Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-800 text-indigo-400">
                              Wave {wave.waveNumber}
                            </span>
                            <span className="font-semibold text-xs text-zinc-200">
                              {wave.name}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-zinc-400">
                            {waveDone}/{waveTotal} Done ({wavePct}%)
                          </span>
                        </div>
                        <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-800/60">
                          <div
                            className="bg-indigo-500 h-full rounded-full transition-all duration-200"
                            style={{ width: `${wavePct}%` }}
                          />
                        </div>
                      </div>

                      {/* Wave Tasks List (Chronological Order) */}
                      <div className="space-y-1.5 divide-y divide-zinc-800/40">
                        {wave.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="pt-1.5 first:pt-0 flex items-start justify-between gap-2"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] font-semibold text-indigo-400 shrink-0">
                                  {task.id}
                                </span>
                                <span className="text-[11px] text-zinc-300 truncate">
                                  {task.title}
                                </span>
                              </div>
                              <div className="text-[9px] text-zinc-500 font-mono">
                                Spec: {task.spec} • Deps: {task.deps.join(', ')}
                              </div>
                            </div>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-mono shrink-0 ${
                                task.status === 'Done'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-amber-950 text-amber-400 border border-amber-800'
                              }`}
                            >
                              {task.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
