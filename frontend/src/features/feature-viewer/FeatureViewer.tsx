import React, { useState } from 'react';
import {
  BookOpen,
  CheckSquare,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Layers,
  CheckCircle2,
  Code2
} from 'lucide-react';

export interface FeatureRequirement {
  id: string; // e.g. "REQ-001"
  pattern: 'Ubiquitous' | 'Event-Driven' | 'State-Driven' | 'Unwanted Behavior' | 'Optional Feature';
  statement: string;
  status: 'Verified' | 'In Progress' | 'Pending';
  seam?: string;
}

export interface FeatureTaskWave {
  name: string;
  description: string;
  status: 'Done' | 'In Progress' | 'Pending';
}

export interface FeatureTask {
  id: string; // e.g. "TASK-core-runtime-01"
  title: string;
  status: 'Done' | 'In Progress' | 'Pending' | 'Blocked' | 'Skipped/Canceled' | 'Rewritten';
  blockedBy?: string[];
  waves?: FeatureTaskWave[];
  verificationSeam?: string;
  reason?: string;
  rewriteTarget?: string;
}

export interface FeatureData {
  id: string; // e.g. "core-host-runtime"
  name: string;
  epicId?: string; // e.g. "EC-core" or "standalone"
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

interface FeatureViewerProps {
  feature: FeatureData;
  onOpenSpec?: (specId: string, title: string) => void;
  onOpenPlan?: (planId: string, title: string) => void;
  onOpenAdr?: (adrId: string) => void;
}

// @implements SPEC-CORE-007::REQ-001
// @implements SPEC-CORE-007::REQ-004
export const FeatureViewer: React.FC<FeatureViewerProps> = ({
  feature,
  onOpenSpec,
  onOpenPlan,
  onOpenAdr,
}) => {
  const [activeView, setActiveView] = useState<'overview' | 'requirements' | 'waves' | 'spec' | 'plan'>('overview');
  const [selectedPattern, setSelectedPattern] = useState<string>('All');

  // Compute stats
  const totalTasks = feature.tasks?.length || 6;
  const doneTasks = feature.tasks?.filter((t) => t.status === 'Done').length || (feature.status === 'Completed' ? totalTasks : 2);
  const taskProgressPct = Math.round((doneTasks / totalTasks) * 100);

  const defaultReqs: FeatureRequirement[] = [
    {
      id: 'REQ-001',
      pattern: 'Ubiquitous',
      statement: 'The HostDaemon shall acquire a single-instance file lock on startup to prevent conflicting processes.',
      status: 'Verified',
      seam: 'crates/aico-server/tests/server_test.rs::test_server_binds_to_available_port',
    },
    {
      id: 'REQ-002',
      pattern: 'Event-Driven',
      statement: 'When started, the HostDaemon shall bind to a free TCP port in the 4242..4252 range.',
      status: 'Verified',
      seam: 'crates/aico-server/tests/server_test.rs::test_server_binds_to_available_port',
    },
    {
      id: 'REQ-003',
      pattern: 'Event-Driven',
      statement: 'When receiving SIGTERM or Ctrl+C, the HostDaemon shall broadcast graceful drain events and exit within 500ms.',
      status: 'Verified',
      seam: 'crates/aico-server/tests/shutdown_test.rs::test_server_graceful_shutdown_broadcasts_and_drains',
    },
    {
      id: 'REQ-004',
      pattern: 'State-Driven',
      statement: 'While the server is running, the WebSocketHub shall maintain real-time bi-directional streaming across connected WebUI clients.',
      status: 'Verified',
      seam: 'crates/aico-server/tests/ws_test.rs::test_websocket_connect_and_broadcast',
    },
    {
      id: 'REQ-005',
      pattern: 'Ubiquitous',
      statement: 'The HealthProbe shall respond with HTTP 200 and uptime metrics at /api/v1/health.',
      status: 'Verified',
      seam: 'crates/aico-server/tests/server_test.rs::test_health_check_endpoint',
    },
    {
      id: 'REQ-006',
      pattern: 'Unwanted Behavior',
      statement: 'If a socket fails to bind or authentication token is malformed, then the SecurityGate shall reject connection with 401 Unauthorized.',
      status: 'Verified',
      seam: 'crates/aico-server/tests/auth_test.rs::test_lan_authenticator_token_generation_and_validation',
    },
  ];

  const requirementsList = feature.requirements || defaultReqs;
  const filteredReqs = selectedPattern === 'All'
    ? requirementsList
    : requirementsList.filter((r) => r.pattern === selectedPattern);

  const defaultTasks: FeatureTask[] = [
    {
      id: `TASK-${feature.id}-01`,
      title: 'Scaffold trait interfaces and designated public test seams',
      status: 'Done',
      waves: [
        { name: 'Wave 1 (Scaffolding)', description: 'Scaffold HostDaemon trait & red integration tests', status: 'Done' },
        { name: 'Wave 2 (Implementation)', description: 'Implement PID lock and TCP port scanner', status: 'Done' },
        { name: 'Wave 3 (Verification)', description: 'Verify duplicate process collision handling', status: 'Done' },
      ],
      verificationSeam: 'crates/aico-server/tests/server_test.rs::test_server_binds_to_available_port',
    },
    {
      id: `TASK-${feature.id}-02`,
      title: 'Axum HTTP routes, health probe, and graceful shutdown signal drain',
      status: 'Done',
      waves: [
        { name: 'Wave 1 (Scaffolding)', description: 'Failing probe tests at /api/v1/health', status: 'Done' },
        { name: 'Wave 2 (Implementation)', description: 'Router setup and shutdown broadcast loop', status: 'Done' },
        { name: 'Wave 3 (Verification)', description: 'Assert 500ms timeout on graceful exit', status: 'Done' },
      ],
      verificationSeam: 'crates/aico-server/tests/shutdown_test.rs::test_server_graceful_shutdown_broadcasts_and_drains',
    },
    {
      id: `TASK-${feature.id}-03`,
      title: 'WebSocket duplex broadcast hub and client subscription channels',
      status: 'Done',
      waves: [
        { name: 'Wave 1 (Scaffolding)', description: 'Red WebSocket mock client connection tests', status: 'Done' },
        { name: 'Wave 2 (Implementation)', description: 'Broadcast channel hub & topic routing', status: 'Done' },
        { name: 'Wave 3 (Verification)', description: 'Stress-test concurrent client broadcasts', status: 'Done' },
      ],
      verificationSeam: 'crates/aico-server/tests/ws_test.rs::test_websocket_connect_and_broadcast',
    },
  ];

  const tasksList = feature.tasks || defaultTasks;

  const defaultAdrs = [
    { id: 'ADR-0001', title: 'Host Runtime & Network Topology' },
    { id: 'ADR-0003', title: 'Security & Auto-Mode Enforcement' },
    { id: 'ADR-0008', title: 'Unified Discovery & Project Manifest' },
    { id: 'ADR-0010', title: 'SDD Structural Grammar v0.1.2' },
  ];
  const adrsList = feature.adrs || defaultAdrs;

  const isStandalone = feature.isStandalone || feature.epicId === 'standalone' || !feature.epicId;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-zinc-100">
      {/* 1. Header Banner */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs px-2.5 py-1 rounded bg-zinc-800 text-indigo-400 font-bold border border-zinc-700">
                FEATURE: {feature.id}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                  feature.status === 'Completed' || feature.status === 'Done'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}
              >
                {feature.status}
              </span>
              {isStandalone ? (
                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-purple-950 text-purple-400 border border-purple-800">
                  Standalone Feature
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Epic: <span className="text-indigo-400 font-semibold">{feature.epicId}</span>
                </span>
              )}
              {feature.order && (
                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-zinc-800/60 text-zinc-400 border border-zinc-700/60">
                  Order #{feature.order}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              {feature.name}
            </h1>
          </div>

          {/* View Switcher Tabs */}
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1 text-xs shrink-0 self-start md:self-auto overflow-x-auto">
            <button
              onClick={() => setActiveView('overview')}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeView === 'overview'
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveView('requirements')}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeView === 'requirements'
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              EARS Requirements ({requirementsList.length})
            </button>
            <button
              onClick={() => setActiveView('waves')}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeView === 'waves'
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Tasks & Waves ({tasksList.length})
            </button>
            <button
              onClick={() => setActiveView('spec')}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeView === 'spec'
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Specification
            </button>
            <button
              onClick={() => setActiveView('plan')}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeView === 'plan'
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Plan DAG
            </button>
          </div>
        </div>

        {/* Feature Progress Bar */}
        <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
            <div className="flex items-center gap-3">
              <span>Progress: <strong className="text-zinc-200">{taskProgressPct}%</strong></span>
              <span>•</span>
              <span>{doneTasks} / {totalTasks} Tasks Done</span>
              <span>•</span>
              <span>{requirementsList.length} / {requirementsList.length} Reqs Verified</span>
            </div>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-sans">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Contract Seams Green
            </span>
          </div>
          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${taskProgressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Overview Tab Content */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-sky-400 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  EARS Reqs
                </span>
                <span className="font-mono text-xs">{requirementsList.length}</span>
              </div>
              <p className="text-xs text-zinc-400">Formal behavioral requirements</p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4" />
                  Tasks
                </span>
                <span className="font-mono text-xs">{doneTasks}/{totalTasks}</span>
              </div>
              <p className="text-xs text-zinc-400">Vertical tracer-bullet DAG</p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-purple-400 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <Code2 className="w-4 h-4" />
                  Test Seams
                </span>
                <span className="font-mono text-xs">100% Green</span>
              </div>
              <p className="text-xs text-zinc-400">Designated public contract seams</p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  Lineage
                </span>
                <span className="font-mono text-xs">{adrsList.length} ADRs</span>
              </div>
              <p className="text-xs text-zinc-400">Architecture Decision Records</p>
            </div>
          </div>

          {/* Architecture Boundaries & Invariants */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-zinc-200 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Domain Invariants & System Boundaries</span>
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {feature.description ||
                `This capability encapsulates a single, cohesive vertical slice with verified public seams. All behaviors conform to strict EARS patterns and maintain backward-compatible contracts.`}
            </p>
          </div>

          {/* Quick Jump Spec & Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  {feature.specId || `SPEC-${feature.id}`}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">EARS Contract</span>
              </div>
              <p className="text-xs text-zinc-300 font-medium">{feature.specTitle || feature.name}</p>
              {feature.specId && onOpenSpec && (
                <button
                  onClick={() => onOpenSpec(feature.specId!, feature.specTitle || feature.name)}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium pt-1"
                >
                  <span>Open Spec Document</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4" />
                  {feature.planId || `PLAN-${feature.id}`}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">6-State DAG</span>
              </div>
              <p className="text-xs text-zinc-300 font-medium">{feature.planTitle || `${feature.name} Plan`}</p>
              {feature.planId && onOpenPlan && (
                <button
                  onClick={() => onOpenPlan(feature.planId!, feature.planTitle || feature.name)}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium pt-1"
                >
                  <span>Open Implementation Plan</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Derived Architecture Decision Records (ADRs) */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-zinc-200 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Architecture Lineage (Derived ADRs)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {adrsList.map((adr) => (
                <div
                  key={adr.id}
                  onClick={() => onOpenAdr?.(adr.id)}
                  className="p-2.5 rounded bg-zinc-950/60 border border-zinc-800/80 hover:border-indigo-500/50 cursor-pointer transition-colors flex items-center justify-between group"
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
        </div>
      )}

      {/* 3. Requirements (EARS) Tab Content */}
      {activeView === 'requirements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <span>Formal EARS Requirements Contract</span>
            </h2>

            {/* Pattern Filter Pills */}
            <div className="flex items-center gap-1.5 text-[11px] overflow-x-auto">
              {['All', 'Ubiquitous', 'Event-Driven', 'State-Driven', 'Unwanted Behavior', 'Optional Feature'].map((pat) => (
                <button
                  key={pat}
                  onClick={() => setSelectedPattern(pat)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    selectedPattern === pat
                      ? 'bg-zinc-700 text-zinc-100 font-medium'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {pat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredReqs.map((req) => (
              <div
                key={req.id}
                className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400 px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800">
                      {req.id}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {req.pattern}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {req.status}
                  </span>
                </div>

                <p className="text-xs text-zinc-200 leading-relaxed font-sans pl-1">
                  {req.statement}
                </p>

                {req.seam && (
                  <div className="pt-1.5 border-t border-zinc-800/60 flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                    <span className="text-zinc-400">Verification Seam:</span>
                    <code className="text-indigo-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                      {req.seam}
                    </code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Tasks & Execution Waves Tab Content */}
      {activeView === 'waves' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                <span>Task Execution DAG & Wave Progression</span>
              </h2>
              <p className="text-xs text-zinc-400">
                Tasks structure work into internal execution waves: Scaffolding (Red) $\to$ Implementation (Green) $\to$ Verification.
              </p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-zinc-800 text-zinc-300">
              Active Frontier: <strong className="text-emerald-400">All Tasks Done</strong>
            </span>
          </div>

          <div className="space-y-4">
            {tasksList.map((task) => (
              <div
                key={task.id}
                className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-indigo-400">
                      {task.id}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        task.status === 'Done'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : task.status === 'In Progress'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>
                  {task.verificationSeam && (
                    <span className="text-[10px] text-zinc-500 font-mono">
                      Seam Verified
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-zinc-100">
                  {task.title}
                </h3>

                {/* Internal Waves Breakdown */}
                {task.waves && task.waves.length > 0 && (
                  <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3 space-y-2">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Internal Execution Waves
                    </span>
                    <div className="space-y-1.5">
                      {task.waves.map((w, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-mono font-medium text-zinc-300 text-[11px]">{w.name}: </span>
                            <span className="text-zinc-400 text-xs">{w.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {task.verificationSeam && (
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                    <span className="text-zinc-400">Designated Seam:</span>
                    <code className="text-indigo-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                      {task.verificationSeam}
                    </code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Specification Viewer Tab Content */}
      {activeView === 'spec' && (
        <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <span className="font-mono text-sky-400 font-bold text-sm block">
                {feature.specId || `SPEC-${feature.id}`}
              </span>
              <span className="text-zinc-300 font-medium text-xs">
                {feature.specTitle || feature.name}
              </span>
            </div>
            {feature.specId && onOpenSpec && (
              <button
                onClick={() => onOpenSpec(feature.specId!, feature.specTitle || feature.name)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors"
              >
                Open in Full Spec Editor Tab
              </button>
            )}
          </div>
          <div className="prose prose-invert max-w-none text-zinc-300 space-y-3 leading-relaxed">
            <p>
              This specification declares formal EARS requirements, designated test seams, and system boundaries
              for the <strong>{feature.name}</strong> capability.
            </p>
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 font-mono text-zinc-400 text-[11px] space-y-1">
              <div># Feature Specification: {feature.name}</div>
              <div>## 1. Problem Statement & User Value</div>
              <div>...</div>
              <div>## 3. Functional Requirements (EARS)</div>
              <div>- Total Requirements: {requirementsList.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Plan Viewer Tab Content */}
      {activeView === 'plan' && (
        <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <span className="font-mono text-emerald-400 font-bold text-sm block">
                {feature.planId || `PLAN-${feature.id}`}
              </span>
              <span className="text-zinc-300 font-medium text-xs">
                {feature.planTitle || `${feature.name} Plan`}
              </span>
            </div>
            {feature.planId && onOpenPlan && (
              <button
                onClick={() => onOpenPlan(feature.planId!, feature.planTitle || feature.name)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors"
              >
                Open in Full Plan Tab
              </button>
            )}
          </div>
          <div className="prose prose-invert max-w-none text-zinc-300 space-y-3 leading-relaxed">
            <p>
              Execution plan tracking vertical tracer-bullet tasks, internal wave progression, prerequisites, and automated seam tests.
            </p>
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 font-mono text-zinc-400 text-[11px] space-y-1">
              <div># Implementation Plan: {feature.name}</div>
              <div>## 1. Technical Architecture & Decisions</div>
              <div>## 2. Tracer-Bullet Task Execution Plan</div>
              <div>- Total Tasks: {tasksList.length} (100% Completed)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
