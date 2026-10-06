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
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { FileDropZone } from '../../components/common/FileDropZone';
import {
  getFeatureDefinition,
  type FeatureTask as SharedFeatureTask,
} from '../feature-task-data';

export interface FeatureRequirement {
  id: string; // e.g. "REQ-001"
  pattern: 'Ubiquitous' | 'Event-Driven' | 'State-Driven' | 'Unwanted Behavior' | 'Optional Feature';
  statement: string;
  status: 'Verified' | 'In Progress' | 'Pending';
  seam?: string;
}

export interface FeatureTaskWave {
  waveNumber: number;
  name: string;
  stage: 'Scaffolding' | 'Implementation' | 'Verification';
  description: string;
  tasks: Array<{
    id: string;
    title: string;
    status: 'Done' | 'In Progress' | 'Pending' | 'Blocked';
    seam?: string;
    deps?: string[];
  }>;
}

export interface FeatureTask {
  id: string;
  title: string;
  status: 'Done' | 'In Progress' | 'Pending' | 'Blocked' | 'Skipped/Canceled' | 'Rewritten';
  blockedBy?: string[];
  waves?: FeatureTaskWave[];
  verificationSeam?: string;
}

export interface FeatureData {
  id: string; // e.g. "core-host-runtime" or "fast-trace"
  name: string;
  epicId?: string; // e.g. "ec-core" or undefined/""
  specId?: string;
  specTitle?: string;
  planId?: string;
  planTitle?: string;
  status: string;
  order?: number;
  isStandalone?: boolean;
  description?: string;
  requirements?: FeatureRequirement[];
  tasks?: FeatureTask[];
  testSeams?: Array<{ id: string; path: string; status: 'Passed' | 'Pending' }>;
  adrs?: Array<{ id: string; title: string }>;
}

export interface FeatureViewerProps {
  feature: FeatureData;
  onPopOut?: (featureId: string, section: string) => void;
  onOpenSpec?: (specId: string, title: string) => void;
  onOpenPlan?: (planId: string, title: string) => void;
  onOpenAdr?: (adrId: string) => void;
  uploadedFiles?: string[];
  onFileUpload?: (file: File) => void;
}

// @implements SPEC-CORE-007::REQ-001
// @implements SPEC-CORE-007::REQ-004
export const FeatureViewer: React.FC<FeatureViewerProps> = ({
  feature,
  onPopOut,
  onOpenSpec,
  onOpenPlan,
  onOpenAdr,
  uploadedFiles = [],
  onFileUpload,
}) => {
  // Accordion state mirroring EpicHubView:
  // Overview: open by default (collapsed = false)
  // Left column (Brainstorm, Specs, Deep Dive, Lineage, Assets): closed by default (collapsed = true)
  // Right column (Task Plan): open by default (collapsed = false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    overview: false,
    brainstorm: true,
    specifications: true,
    deepDive: true,
    lineage: true,
    assets: true,
    taskPlan: false,
  });

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const isStandalone = Boolean(
    feature.isStandalone ||
      !feature.epicId ||
      feature.epicId === 'standalone' ||
      feature.epicId === ''
  );

  const isFastTrace = feature.id.toLowerCase() === 'fast-trace';

  // Default EARS requirements
  const defaultReqs: FeatureRequirement[] = isFastTrace
    ? [
        {
          id: 'REQ-001',
          pattern: 'Ubiquitous',
          statement:
            'The system SHALL scan all workspace source files for @implements <spec_id>::<req_id> annotations upon request.',
          status: 'Verified',
          seam: 'crates/aico-core/src/trace.rs::scan_workspace_annotations',
        },
        {
          id: 'REQ-002',
          pattern: 'Event-Driven',
          statement:
            'WHEN a source annotation is encountered, the system SHALL cross-reference the requirement ID against parsed specifications in the active project.',
          status: 'Verified',
          seam: 'crates/aico-core/src/trace.rs::validate_requirement_references',
        },
        {
          id: 'REQ-003',
          pattern: 'Unwanted Behavior',
          statement:
            'IF an annotation references a non-existent specification or requirement ID, THEN the system SHALL report an unresolved diagnostic warning with the exact source path and line number.',
          status: 'Verified',
          seam: 'crates/aico-core/tests/trace_test.rs::test_broken_annotation_diagnostics',
        },
      ]
    : [
        {
          id: 'REQ-001',
          pattern: 'Ubiquitous',
          statement:
            'The HostDaemon shall acquire a single-instance file lock on startup to prevent conflicting processes.',
          status: 'Verified',
          seam: 'crates/aico-server/tests/server_test.rs::test_server_binds_to_available_port',
        },
        {
          id: 'REQ-002',
          pattern: 'Event-Driven',
          statement:
            'When started, the HostDaemon shall bind to a free TCP port in the 4242..4252 range.',
          status: 'Verified',
          seam: 'crates/aico-server/tests/server_test.rs::test_server_binds_to_available_port',
        },
        {
          id: 'REQ-003',
          pattern: 'Event-Driven',
          statement:
            'When receiving SIGTERM or Ctrl+C, the HostDaemon shall broadcast graceful drain events and exit within 500ms.',
          status: 'Verified',
          seam: 'crates/aico-server/tests/shutdown_test.rs::test_server_graceful_shutdown_broadcasts_and_drains',
        },
        {
          id: 'REQ-004',
          pattern: 'State-Driven',
          statement:
            'While the server is running, the WebSocketHub shall maintain real-time bi-directional streaming across connected WebUI clients.',
          status: 'Verified',
          seam: 'crates/aico-server/tests/ws_test.rs::test_websocket_connect_and_broadcast',
        },
        {
          id: 'REQ-005',
          pattern: 'Ubiquitous',
          statement:
            'The HealthProbe shall respond with HTTP 200 and uptime metrics at /api/v1/health.',
          status: 'Verified',
          seam: 'crates/aico-server/tests/server_test.rs::test_health_check_endpoint',
        },
        {
          id: 'REQ-006',
          pattern: 'Unwanted Behavior',
          statement:
            'If a socket fails to bind or authentication token is malformed, then the SecurityGate shall reject connection with 401 Unauthorized.',
          status: 'Verified',
          seam: 'crates/aico-server/tests/auth_test.rs::test_lan_authenticator_token_generation_and_validation',
        },
      ];

  const requirementsList = feature.requirements || defaultReqs;

  // Execution tasks and waves for this feature's Task Plan
  const def = getFeatureDefinition(feature.id);
  const tasksList: SharedFeatureTask[] =
    feature.tasks && feature.tasks.length > 0
      ? (feature.tasks as unknown as SharedFeatureTask[])
      : def?.tasks || [
          {
            id: `TASK-${feature.id.toUpperCase()}-001`,
            title: `${feature.name} Scaffolding & Public Seams`,
            status: 'Done',
            seam: 'crates/aico-server/tests/server_test.rs',
            deps: ['None'],
            waves: [
              {
                waveNumber: 1,
                name: 'Wave 1 (Scaffolding)',
                stage: 'Scaffolding',
                description: 'Scaffold public trait/type signatures and red contract tests',
                status: 'Done',
              },
              {
                waveNumber: 2,
                name: 'Wave 2 (Implementation)',
                stage: 'Implementation',
                description: 'Minimal core logic turning tests green',
                status: 'Done',
              },
            ],
          },
        ];

  const totalTasks = tasksList.length;
  const doneTasks = tasksList.filter((t) => t.status === 'Done').length;
  const taskProgressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;

  const defaultAdrs = isFastTrace
    ? [
        { id: 'ADR-0010', title: 'SDD Structural Grammar, Standalone Features & Naming' },
        { id: 'ADR-0008', title: 'Unified Discovery & Project Manifest' },
      ]
    : [
        { id: 'ADR-0001', title: 'Host Runtime & Network Topology' },
        { id: 'ADR-0003', title: 'Security & Auto-Mode Enforcement' },
        { id: 'ADR-0008', title: 'Unified Discovery & Project Manifest' },
        { id: 'ADR-0010', title: 'SDD Structural Grammar v0.1.2' },
      ];
  const adrsList = feature.adrs || defaultAdrs;

  const specIdentifier = feature.specId || `spec-${feature.id}`;
  const specDisplayName = feature.specTitle || feature.name;
  const planIdentifier = feature.planId || `plan-${feature.id}`;
  const planDisplayName = feature.planTitle || `${feature.name} Plan`;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* 1. Feature Header Banner */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-zinc-800 text-indigo-400 font-bold border border-zinc-700">
              FEATURE: {feature.id}
            </span>
            <span
              className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-semibold ${
                feature.status === 'Completed' || feature.status === 'Done'
                  ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950/70 text-amber-400 border border-amber-800'
              }`}
            >
              {feature.status}
            </span>
            {isStandalone ? (
              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-semibold bg-purple-950/70 text-purple-400 border border-purple-800">
                Standalone Feature
              </span>
            ) : (
              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
                Epic: <span className="text-indigo-400 font-semibold">{feature.epicId}</span>
              </span>
            )}
            {feature.order && (
              <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-zinc-800/60 text-zinc-400 border border-zinc-700/60">
                Order #{feature.order}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 mt-2">
            {feature.name}
          </h1>

          {/* Quick Jump Spec / Plan Badges */}
          <div className="flex items-center gap-2 mt-2">
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-sky-950/50 border border-sky-800/60 text-sky-400">
              {specIdentifier}
            </span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-800/60 text-emerald-400">
              {planIdentifier}
            </span>
            {onOpenSpec && (
              <button
                onClick={() => onOpenSpec(specIdentifier, specDisplayName)}
                className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors ml-1 font-medium"
              >
                <span>Open Spec Document</span>
                <ArrowRight className="w-3 h-3 text-zinc-400" />
              </button>
            )}
            {onOpenPlan && (
              <button
                onClick={() => onOpenPlan(planIdentifier, planDisplayName)}
                className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors font-medium"
              >
                <span>Open Implementation Plan</span>
                <ArrowRight className="w-3 h-3 text-zinc-400" />
              </button>
            )}
          </div>
        </div>

        {/* Contract Seams Green KPI */}
        <div className="text-right space-y-1">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Contract Seams Green</span>
          </span>
          <p className="text-[11px] font-mono text-zinc-400">
            {doneTasks}/{totalTasks} Tasks Done ({taskProgressPct}%)
          </p>
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
                — {feature.description || 'Executive summary and domain invariants'}
              </span>
            )}
          </div>
          <button
            data-testid="popout-overview"
            onClick={(e) => {
              e.stopPropagation();
              onPopOut?.(feature.id, 'overview');
            }}
            title="Open in separate tab"
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {!collapsedSections.overview && (
          <div className="p-5 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-4">
            {/* Executive Summary */}
            <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800">
              <h4 className="text-xs font-semibold text-zinc-200 mb-1">Executive Summary</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                {isFastTrace
                  ? 'Provides instantaneous CLI and in-editor validation of @implements and @verifies code comment annotations against formal EARS requirement identifiers across the repository without requiring full test suite execution.'
                  : feature.description ||
                    'Autonomous Intelligent Code Orchestrator (AICO) feature module enforcing deterministic contract seams, vertical tracer-bullet DAG execution, and strict EARS behavioral invariants.'}
              </p>
            </div>

            {/* Domain Invariants & Boundaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg space-y-1">
                <span className="font-semibold text-indigo-400 text-xs block">In-Scope Boundaries</span>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  {isFastTrace
                    ? 'Single-pass Tree-sitter & regex parsing of source files for SDD tags; cross-referencing against active project specification requirements; orphan reference reporting.'
                    : 'Encapsulated vertical tracer-bullet execution across public seams; strict EARS behavioral contracts; verified integration test suites.'}
                </p>
              </div>
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg space-y-1">
                <span className="font-semibold text-amber-400 text-xs block">Architectural Guarantees</span>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  {isFastTrace
                    ? '< 15ms per project scan latency; zero external background daemons; strict backward compatibility with v0.1.2 SDD standard.'
                    : 'Zero external background daemons; single PID lock; deterministic Model Context Protocol tool gates.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2-COLUMN SECTION: Left = Brainstorm, Specs, Deep Dive, Lineage, Assets | Right = Task Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN (All Closed by Default) */}
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
                    — Architectural trade-offs and decision matrix
                  </span>
                )}
              </div>
              <button
                data-testid="popout-brainstorm"
                onClick={(e) => {
                  e.stopPropagation();
                  onPopOut?.(feature.id, 'brainstorm');
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
                    {isFastTrace ? (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-800 text-zinc-400">
                            <th className="pb-1.5 font-medium">Dimension</th>
                            <th className="pb-1.5 font-medium">Tree-Sitter Pass</th>
                            <th className="pb-1.5 font-medium">Test Suite Run</th>
                            <th className="pb-1.5 font-medium">External CLI</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 text-zinc-300 text-[11px]">
                          <tr>
                            <td className="py-1.5 text-indigo-400 font-mono font-semibold">Latency</td>
                            <td className="py-1.5 text-emerald-400">&lt; 15ms scan</td>
                            <td className="py-1.5 text-zinc-400">5-15 seconds</td>
                            <td className="py-1.5 text-zinc-400">200-500ms</td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-indigo-400 font-mono font-semibold">Dependencies</td>
                            <td className="py-1.5 text-emerald-400">Zero external runtime</td>
                            <td className="py-1.5 text-zinc-400">Rust toolchain</td>
                            <td className="py-1.5 text-zinc-400">Node/Python env</td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-indigo-400 font-mono font-semibold">Precision</td>
                            <td className="py-1.5 text-emerald-400">Exact AST node spans</td>
                            <td className="py-1.5 text-zinc-400">Exit-code only</td>
                            <td className="py-1.5 text-zinc-400">Regex approximations</td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-indigo-400 font-mono font-semibold">Decision</td>
                            <td className="py-1.5 text-emerald-400 font-semibold">Chosen (In-process)</td>
                            <td className="py-1.5 text-zinc-400">Retain for CI gate</td>
                            <td className="py-1.5 text-red-400">Reject</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
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
                            <td className="py-1.5 text-indigo-400 font-mono">Architecture</td>
                            <td className="py-1.5">In-Process Engine</td>
                            <td className="py-1.5 text-zinc-400">Zero Docker setup, zero daemon latency.</td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-indigo-400 font-mono">Verification</td>
                            <td className="py-1.5">Public Seam Contracts</td>
                            <td className="py-1.5 text-zinc-400">Tagged with @verifies and validated in CI.</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
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
                <span className="font-semibold text-sm text-zinc-200">
                  Specifications ({requirementsList.length} Reqs)
                </span>
                {collapsedSections.specifications && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — Strict EARS syntax and test seams
                  </span>
                )}
              </div>
              <button
                data-testid="popout-specifications"
                onClick={(e) => {
                  e.stopPropagation();
                  onPopOut?.(feature.id, 'specifications');
                }}
                title="Open in separate tab"
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
            {!collapsedSections.specifications && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-2.5">
                {requirementsList.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-sky-400">{req.id}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                          {req.pattern}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">{req.statement}</p>
                    {req.seam && (
                      <div className="text-[10px] text-zinc-500 font-mono pt-1 border-t border-zinc-800/60">
                        Seam: <span className="text-indigo-400">{req.seam}</span>
                      </div>
                    )}
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
                    — Designated test seams and boundary contracts
                  </span>
                )}
              </div>
              <button
                data-testid="popout-deepDive"
                onClick={(e) => {
                  e.stopPropagation();
                  onPopOut?.(feature.id, 'deepDive');
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
                    {isFastTrace ? (
                      <>
                        <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                          <span className="text-emerald-400 font-semibold">
                            crates/aico-core::trace.rs
                          </span>
                          <div className="text-zinc-500 text-[10px]">
                            Single-pass regex & Tree-sitter extractor for SDD annotation tags
                          </div>
                        </div>
                        <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                          <span className="text-emerald-400 font-semibold">
                            crates/aico-core::tests/trace_test.rs
                          </span>
                          <div className="text-zinc-500 text-[10px]">
                            Automated validation for valid, broken, and orphan requirement identifiers
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                          <span className="text-emerald-400 font-semibold">
                            crates/aico-server::server.rs
                          </span>
                          <div className="text-zinc-500 text-[10px]">
                            Axum REST routes and dynamic socket listener bindings
                          </div>
                        </div>
                        <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                          <span className="text-emerald-400 font-semibold">
                            crates/aico-server::ws_hub.rs
                          </span>
                          <div className="text-zinc-500 text-[10px]">
                            WebSocket real-time broadcast and subscription topic router
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Lineage / ADRs Accordion */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
            <div
              onClick={() => toggleSection('lineage')}
              className="flex items-center justify-between px-4 py-3 bg-zinc-900 cursor-pointer select-none hover:bg-zinc-900/80 transition-colors"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {collapsedSections.lineage ? (
                  <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                )}
                <BookOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="font-semibold text-sm text-zinc-200">
                  Lineage ({adrsList.length} ADRs)
                </span>
                {collapsedSections.lineage && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — Architecture Decision Records
                  </span>
                )}
              </div>
            </div>
            {!collapsedSections.lineage && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30">
                <div className="grid grid-cols-1 gap-2">
                  {adrsList.map((adr) => (
                    <div
                      key={adr.id}
                      onClick={() => onOpenAdr?.(adr.id)}
                      className="p-2.5 rounded bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 cursor-pointer transition-colors flex items-center justify-between group"
                    >
                      <div className="space-y-0.5">
                        <span className="font-mono text-[11px] text-indigo-400 font-bold group-hover:text-indigo-300">
                          {adr.id}
                        </span>
                        <p className="text-xs text-zinc-300">{adr.title}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Assets Accordion */}
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
                    — Attached artifacts and multimodal drops
                  </span>
                )}
              </div>
              <button
                data-testid="popout-assets"
                onClick={(e) => {
                  e.stopPropagation();
                  onPopOut?.(feature.id, 'assets');
                }}
                title="Open in separate tab"
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
            {!collapsedSections.assets && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-3">
                <div className="pt-1">
                  <FileDropZone onFileUpload={(f) => onFileUpload?.(f)}>
                    <span>Drag & drop design mockups, logs, or audio files for this feature</span>
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

        {/* RIGHT COLUMN: Task Plan (Alone on the right, open by default, with internal waves) */}
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
                  — Vertical tracer-bullet task DAG with internal waves
                </span>
              )}
            </div>
            <button
              data-testid="popout-taskPlan"
              onClick={(e) => {
                e.stopPropagation();
                onPopOut?.(feature.id, 'taskPlan');
              }}
              title="Open in separate tab"
              className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {!collapsedSections.taskPlan && (
            <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-4">
              {/* Feature Task Progress Bar */}
              <div className="p-3.5 bg-zinc-950/80 rounded-xl border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-200">Task Execution Progress</span>
                  <span className="font-mono text-emerald-400">
                    {doneTasks} / {totalTasks} Tasks Done ({taskProgressPct}%)
                  </span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-2.5 overflow-hidden border border-zinc-800">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${taskProgressPct}%` }}
                  />
                </div>
              </div>

              {/* Sequential Task Cards with Internal Waves */}
              <div className="space-y-3.5">
                {tasksList.map((task) => {
                  const taskWavesTotal = task.waves ? task.waves.length : 0;
                  const taskWavesDone = task.waves
                    ? task.waves.filter((w) => w.status === 'Done').length
                    : 0;
                  const taskPct =
                    taskWavesTotal > 0
                      ? Math.round((taskWavesDone / taskWavesTotal) * 100)
                      : task.status === 'Done'
                      ? 100
                      : 0;

                  return (
                    <div
                      key={task.id}
                      className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/60 p-4 space-y-3"
                    >
                      {/* Task Card Header */}
                      <div className="space-y-1 pb-2 border-b border-zinc-800">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-indigo-400 block">
                            {task.id}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                              task.status === 'Done'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : task.status === 'In Progress'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}
                          >
                            {task.status}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-zinc-200">{task.title}</div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1">
                          <span>Seam: {task.seam || (task as any).verificationSeam || 'N/A'}</span>
                          <span>
                            {taskWavesDone}/{taskWavesTotal} Waves ({taskPct}%)
                          </span>
                        </div>
                        <div className="w-full bg-zinc-950 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-200"
                            style={{ width: `${taskPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Declared Internal Waves */}
                      {task.waves && task.waves.length > 0 && (
                        <div className="space-y-2">
                          {task.waves.map((wave) => (
                            <div
                              key={wave.waveNumber}
                              className="p-2.5 bg-zinc-950/70 border border-zinc-800/80 rounded-lg space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-zinc-200 text-xs">
                                    {wave.name}
                                  </span>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                                      wave.stage === 'Scaffolding'
                                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                        : wave.stage === 'Implementation'
                                        ? 'bg-sky-950 text-sky-400 border border-sky-800'
                                        : wave.stage === 'Verification'
                                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                                    }`}
                                  >
                                    {wave.stage}
                                  </span>
                                </div>
                                <span
                                  className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                                    wave.status === 'Done'
                                      ? 'text-emerald-400 font-semibold'
                                      : wave.status === 'In Progress'
                                      ? 'text-amber-400'
                                      : 'text-zinc-500'
                                  }`}
                                >
                                  {wave.status}
                                </span>
                              </div>
                              <p className="text-zinc-400 text-[11px] leading-relaxed">
                                {wave.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
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
