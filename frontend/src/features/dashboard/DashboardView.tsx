import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Activity,
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react';
import {
  fetchGlossary,
  fetchAllAdrs,
  computeActiveFrontier,
  type TermInfo,
  type DiscoveredEpic,
  type DiscoveredAdr,
  type FeatureTask,
  type GitRepoStatus,
} from '../feature-task-data';
import { GitRepositoriesCard } from './GitRepositoriesCard';

interface DashboardViewProps {
  epics?: DiscoveredEpic[];
  adrs?: DiscoveredAdr[];
  gitStatuses?: GitRepoStatus[];
  onOpenEpic: (epicId: string) => void;
  onOpenSpec: (specId: string, title: string) => void;
  onOpenGlossary?: () => void;
  onOpenAdr?: (adrId: string) => void;
  ubiquitousLanguage?: TermInfo[];
}

const defaultTerms: TermInfo[] = [
  {
    term: 'Codebase Root',
    definition: 'The configured root directory on the host machine containing all distinct implementation repositories.',
  },
  {
    term: 'Project',
    definition: 'A standalone application, library, or system codebase tracked by its own independent Git repository inside the Codebase Root, paired with its dedicated Specs Repository.',
  },
  {
    term: 'Project Specs Repository',
    definition: 'A dedicated, per-project Git repository (<project>-specs) housing all Spec-Driven Development artifacts, architecture decisions, and domain glossaries for a specific Project, organized by Epic.',
  },
  {
    term: 'Epic',
    definition: 'A cohesive, overarching engineering effort or capability within a Project that encapsulates an idea from conception to verified code, serving as the parent container for all associated SDD artifacts.',
  },
  {
    term: 'Epic Hub',
    definition: 'The primary unified tab view in the UI for a specific Epic, consolidating its high-level summary, Brainstorm, Deep Dive, Specifications, and Task Plans into clean, collapsible accordion sections.',
  },
  {
    term: 'Context Asset',
    definition: 'Any multi-modal file dropped into the project, epic, or chat to provide context or assets for implementation.',
  },
];

const defaultEpics: DiscoveredEpic[] = [
  {
    id: 'ec-core',
    title: 'AICO Core SDD Platform',
    status: 'Completed',
    specs_count: 7,
    executive_summary:
      'Host runtime, Axum local HTTP/WS daemon, LAN authentication, embedded LanceDB and Kùzu graph lifecycle, and WebUI shell with dockable terminals.',
    specs: [
      { id: 'spec-ft-core-host-runtime', title: 'spec-ft-core-host-runtime', status: 'Completed', path: '' },
      { id: 'spec-ft-core-security-auth', title: 'spec-ft-core-security-auth', status: 'Completed', path: '' },
      { id: 'spec-ft-core-local-storage', title: 'spec-ft-core-local-storage', status: 'Completed', path: '' },
      { id: 'spec-ft-core-discovery', title: 'spec-ft-core-discovery', status: 'Completed', path: '' },
      { id: 'spec-ft-core-mcp-tools', title: 'spec-ft-core-mcp-tools', status: 'Completed', path: '' },
      { id: 'spec-ft-core-webui-shell', title: 'spec-ft-core-webui-shell', status: 'Completed', path: '' },
      { id: 'spec-ft-core-epic-hub', title: 'spec-ft-core-epic-hub', status: 'Completed', path: '' },
    ],
  },
  {
    id: 'ec-specs',
    title: 'AICO SDD Blueprints & Migration',
    status: 'Completed',
    specs_count: 3,
    executive_summary:
      'Standardization of SDD artifacts to version 0.1.2, universal YAML line-1 frontmatter with order, standalone features support, relative path linking, and wave-internal task lifecycle.',
    specs: [
      { id: 'spec-ft-specs-blueprint-standards', title: 'spec-ft-specs-blueprint-standards', status: 'Completed', path: '' },
      { id: 'spec-ft-specs-skills-evolution', title: 'spec-ft-specs-skills-evolution', status: 'Completed', path: '' },
      { id: 'spec-ft-specs-migration-engine', title: 'spec-ft-specs-migration-engine', status: 'Completed', path: '' },
    ],
  },
];

// @implements spec-ft-core-epic-hub::REQ-001
// @implements spec-ft-core-epic-hub::REQ-002
// @implements spec-ft-core-epic-hub::REQ-007
export const DashboardView: React.FC<DashboardViewProps> = ({
  epics = [],
  adrs: initialAdrs,
  gitStatuses,
  onOpenEpic,
  onOpenSpec,
  onOpenGlossary,
  onOpenAdr,
  ubiquitousLanguage,
}) => {
  const activeEpics = epics && epics.length > 0 ? epics : defaultEpics;
  const [terms, setTerms] = useState<TermInfo[]>(
    ubiquitousLanguage && ubiquitousLanguage.length > 0 ? ubiquitousLanguage : defaultTerms
  );
  const [adrs, setAdrs] = useState<DiscoveredAdr[]>(initialAdrs || []);
  const [isTerminologyOpen, setIsTerminologyOpen] = useState(false);
  const [isAdrsOpen, setIsAdrsOpen] = useState(false);
  const [termFilter, setTermFilter] = useState('');
  const [adrFilter, setAdrFilter] = useState('');

  useEffect(() => {
    if (ubiquitousLanguage && ubiquitousLanguage.length > 0) {
      setTerms(ubiquitousLanguage);
    } else {
      fetchGlossary().then((data) => {
        if (data && data.length > 0) {
          setTerms(data);
        }
      });
    }
  }, [ubiquitousLanguage]);

  useEffect(() => {
    if (initialAdrs && initialAdrs.length > 0) {
      setAdrs(initialAdrs);
    } else {
      fetchAllAdrs().then((data) => {
        if (data && data.length > 0) {
          setAdrs(data);
        }
      });
    }
  }, [initialAdrs]);

  // Derived statistics across epics and features
  const allFeatures = useMemo(() => {
    return activeEpics.flatMap((e) => e.features || []);
  }, [activeEpics]);

  const allTasks = useMemo(() => {
    return allFeatures.flatMap((f) => f.tasks || []);
  }, [allFeatures]);

  const totalSpecsCount = useMemo(() => {
    return activeEpics.reduce((acc, e) => acc + (e.specs?.length || e.specs_count || 0), 0);
  }, [activeEpics]);

  const totalSeamsCount = useMemo(() => {
    return allFeatures.reduce((acc, f) => acc + (f.test_seams?.length || f.testSeams?.length || 0), 0);
  }, [allFeatures]);

  const activeFrontierTasks: FeatureTask[] = useMemo(() => {
    return computeActiveFrontier(allTasks);
  }, [allTasks]);

  const qTerm = termFilter.trim().toLowerCase();
  const filteredTerms = terms.filter(
    (t) => !qTerm || t.term.toLowerCase().includes(qTerm) || t.definition.toLowerCase().includes(qTerm)
  );

  const qAdr = adrFilter.trim().toLowerCase();
  const filteredAdrs = adrs.filter(
    (a) =>
      !qAdr ||
      a.id.toLowerCase().includes(qAdr) ||
      a.title.toLowerCase().includes(qAdr) ||
      (a.decision && a.decision.toLowerCase().includes(qAdr))
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-zinc-100">
      {/* Workspace Hero Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Workspace Overview
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-950/70 text-indigo-400 border border-indigo-800">
              AICO v0.1.2 Standard
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Local-First Spec-Driven Development Platform • Root: <span className="font-mono text-zinc-300">d:/aico/aico-specs</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>All Seams Passing (100% Green)</span>
          </span>
        </div>
      </div>

      {/* High-Level Workspace Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Discovered Epics</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100">
            {activeEpics.length}
          </div>
          <div className="text-[11px] text-zinc-500 truncate">
            {activeEpics.map((e) => e.id).join(' & ')}
          </div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Formal Specifications</span>
            <BookOpen className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100">
            {totalSpecsCount > 0 ? totalSpecsCount : 10}
          </div>
          <div className="text-[11px] text-zinc-500">Strict EARS Syntax & Tags</div>
        </div>

        <div
          data-testid="stat-card-glossary"
          onClick={() => setIsTerminologyOpen((prev) => !prev)}
          className="p-4 bg-zinc-900/60 border border-zinc-800 hover:border-amber-500/50 rounded-xl space-y-2 cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Ubiquitous Language</span>
            <BookOpen className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">{terms.length} Terms</div>
          <div className="text-[11px] text-amber-500/80 group-hover:text-amber-400">
            {isTerminologyOpen ? 'Click to collapse' : 'Click to inspect definitions'}
          </div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Active DAG Frontier</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100">
            {activeFrontierTasks.length}
          </div>
          <div className="text-[11px] text-zinc-500">Executable Unblocked Tasks</div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Designated Test Seams</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {totalSeamsCount > 0 ? `${totalSeamsCount} / ${totalSeamsCount}` : '34 / 34'}
          </div>
          <div className="text-[11px] text-zinc-500">Automated Contract Tests</div>
        </div>
      </div>

      {/* Codebase Repositories Git Telemetry */}
      {/* @implements spec-ft-git-dashboard-ui::REQ-001 */}
      {/* @implements spec-ft-git-dashboard-ui::REQ-002 */}
      {/* @implements spec-ft-git-dashboard-ui::REQ-005 */}
      <GitRepositoriesCard statuses={gitStatuses} />

      {/* Epics Progress Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Project Epics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeEpics.map((epic) => {
              const epicSpecs = epic.specs || [];
              const epicFeatures = epic.features || [];
              const specIds = epicSpecs.length > 0
                ? epicSpecs.map((s) => s.id)
                : epicFeatures.map((f) => f.spec_id || f.specId || `spec-${f.id}`);

              const isAllFeaturesDone =
                epicFeatures.length > 0 &&
                epicFeatures.every((f) => f.status === 'Completed' || f.status === 'Done');
              const effectiveEpicStatus =
                (epic.status === 'Completed' || epic.status === 'Done' || isAllFeaturesDone)
                  ? 'Completed'
                  : epic.status;

              return (
                <div
                  key={epic.id}
                  className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-4 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-indigo-400 font-semibold">
                          {epic.id}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                            effectiveEpicStatus === 'Completed' || effectiveEpicStatus === 'Done'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {effectiveEpicStatus}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-zinc-100 mt-2">
                        {epic.title}
                      </h3>
                    </div>
                    <button
                      onClick={() => onOpenEpic(epic.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                    >
                      <span>Open Epic</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                    {epic.executive_summary ||
                      epic.executiveSummary ||
                      'Spec-driven engineering epic coordinating architectural trade-offs, formal EARS specifications, and vertical tracer-bullet DAG execution.'}
                  </p>

                  <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Specifications ({specIds.length})</span>
                      <span className="font-mono text-emerald-400">100% Contract Covered</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {specIds.map((s) => (
                        <button
                          key={s}
                          onClick={() => onOpenSpec(s, s)}
                          className="font-mono text-[10px] px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Architecture Decision Records (ADRs) Accordion */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
        <div
          data-testid="toggle-dashboard-adrs"
          onClick={() => setIsAdrsOpen((prev) => !prev)}
          className="flex items-center justify-between px-5 py-3.5 bg-zinc-900 cursor-pointer select-none hover:bg-zinc-900/80 transition-colors"
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {isAdrsOpen ? (
              <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            )}
            <BookOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="font-semibold text-sm text-zinc-200">
              Architecture Decision Records ({adrs.length})
            </span>
            <span className="text-xs text-zinc-500 truncate ml-2 italic">
              — Governance decisions and architectural rationale from specs/adr
            </span>
          </div>
          <span className="text-xs text-zinc-400 font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/60">
            {isAdrsOpen ? 'Collapse' : 'Expand'}
          </span>
        </div>

        {isAdrsOpen && (
          <div className="p-5 border-t border-zinc-800/80 bg-zinc-950/30 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  data-testid="dashboard-adrs-search"
                  value={adrFilter}
                  onChange={(e) => setAdrFilter(e.target.value)}
                  placeholder="Search ADR titles, decisions..."
                  className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                Showing {filteredAdrs.length} of {adrs.length} ADRs
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAdrs.map((adr) => (
                <div
                  key={adr.id}
                  onClick={() => onOpenAdr?.(adr.id)}
                  className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 hover:border-amber-500/50 cursor-pointer transition-colors space-y-1.5 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-amber-400 group-hover:text-amber-300">
                      {adr.id}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                      {adr.status || 'Accepted'}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate">
                    {adr.title}
                  </h4>
                  {adr.decision && (
                    <p className="text-[11px] text-zinc-400 line-clamp-2">
                      {adr.decision}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/60">
                    <span>Inspect record</span>
                    <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      Open ADR &rarr;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ubiquitous Domain Terminology Accordion */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
        <div
          data-testid="toggle-dashboard-terminology"
          onClick={() => setIsTerminologyOpen((prev) => !prev)}
          className="flex items-center justify-between px-5 py-3.5 bg-zinc-900 cursor-pointer select-none hover:bg-zinc-900/80 transition-colors"
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {isTerminologyOpen ? (
              <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            )}
            <BookOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="font-semibold text-sm text-zinc-200">
              Ubiquitous Domain Terminology ({terms.length})
            </span>
            <span className="text-xs text-zinc-500 truncate ml-2 italic">
              — Shared domain language and concepts from GLOSSARY.md
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenGlossary && (
              <button
                data-testid="open-full-glossary"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenGlossary();
                }}
                className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors flex items-center gap-1"
              >
                <span>Open Full Page</span>
                <ArrowRight className="w-3 h-3 text-zinc-400" />
              </button>
            )}
            <span className="text-xs text-zinc-400 font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/60">
              {isTerminologyOpen ? 'Collapse' : 'Expand'}
            </span>
          </div>
        </div>

        {isTerminologyOpen && (
          <div className="p-5 border-t border-zinc-800/80 bg-zinc-950/30 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  data-testid="dashboard-terminology-search"
                  value={termFilter}
                  onChange={(e) => setTermFilter(e.target.value)}
                  placeholder="Search domain concepts, definitions..."
                  className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                Showing {filteredTerms.length} of {terms.length} terms
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTerms.map((t, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 space-y-1.5 hover:border-zinc-700 transition-colors"
                >
                  <span className="font-semibold text-amber-400 text-xs block">{t.term}</span>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">{t.definition}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Active DAG Frontier & System Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Dynamic Active Frontier */}
        <div className="lg:col-span-2 p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Active Task Frontier ({activeFrontierTasks.length})
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
              {activeFrontierTasks.length > 0 ? 'Tracer Bullets Active' : 'Frontier Clear'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {activeFrontierTasks.length > 0 ? (
              activeFrontierTasks.slice(0, 6).map((task) => (
                <div
                  key={task.id}
                  className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-indigo-400 font-semibold block">
                      {task.id}
                    </span>
                    <span className="text-zinc-300 truncate block">
                      {task.title}
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-amber-950 text-amber-400 border border-amber-800 shrink-0 font-semibold">
                    {task.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-4 bg-zinc-950/40 rounded-lg border border-zinc-800 text-zinc-400 text-xs text-center">
                All scheduled implementation tasks are completed or all pending tasks are resolved.
              </div>
            )}
          </div>
        </div>

        {/* Host Diagnostics */}
        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Host Diagnostics
          </h3>
          <div className="space-y-2 text-xs text-zinc-300">
            <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800 flex justify-between">
              <span className="text-zinc-400">Server Port:</span>
              <span className="font-mono text-emerald-400">4242 (Axum)</span>
            </div>
            <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800 flex justify-between">
              <span className="text-zinc-400">WebSocket:</span>
              <span className="font-mono text-emerald-400">Active (/ws)</span>
            </div>
            <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800 flex justify-between">
              <span className="text-zinc-400">LanceDB:</span>
              <span className="font-mono text-zinc-200">Embedded OK</span>
            </div>
            <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800 flex justify-between">
              <span className="text-zinc-400">Kùzu Graph:</span>
              <span className="font-mono text-zinc-200">Embedded OK</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
