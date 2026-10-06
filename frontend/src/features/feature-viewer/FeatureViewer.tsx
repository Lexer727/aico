import React, { useState, useEffect } from 'react';
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
  Crosshair,
} from 'lucide-react';
import { FileDropZone } from '../../components/common/FileDropZone';
import {
  fetchFeature,
  type FeatureTask,
  type FeatureRequirement,
  type TestSeamInfo,
} from '../feature-task-data';

export interface FeatureData {
  id: string; // e.g. "core-host-runtime" or "ft-fast-trace"
  name: string;
  epicId?: string;
  epic_id?: string;
  specId?: string;
  spec_id?: string;
  specTitle?: string;
  spec_title?: string;
  planId?: string;
  plan_id?: string;
  planTitle?: string;
  plan_title?: string;
  status: string;
  order?: number;
  isStandalone?: boolean;
  is_standalone?: boolean;
  description?: string;
  in_scope?: string[];
  inScope?: string[];
  out_of_scope?: string[];
  outOfScope?: string[];
  requirements?: FeatureRequirement[];
  test_seams?: TestSeamInfo[];
  testSeams?: TestSeamInfo[];
  adrs?: string[];
  tasks?: FeatureTask[];
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
  feature: initialFeature,
  onPopOut,
  onOpenSpec,
  onOpenPlan,
  onOpenAdr,
  uploadedFiles = [],
  onFileUpload,
}) => {
  const [feature, setFeature] = useState<FeatureData>(initialFeature);

  // Sync state if initialFeature prop changes
  useEffect(() => {
    setFeature(initialFeature);
  }, [initialFeature]);

  // Fetch full live artifact data if details are missing
  useEffect(() => {
    let isMounted = true;
    const loadDetails = async () => {
      if (
        !initialFeature.requirements ||
        initialFeature.requirements.length === 0 ||
        !initialFeature.tasks ||
        initialFeature.tasks.length === 0
      ) {
        const live = await fetchFeature(initialFeature.id);
        if (live && isMounted) {
          setFeature((prev) => ({
            ...prev,
            ...live,
            description: live.description || prev.description,
            in_scope: live.in_scope || prev.in_scope,
            out_of_scope: live.out_of_scope || prev.out_of_scope,
            requirements: live.requirements && live.requirements.length > 0 ? live.requirements : prev.requirements,
            tasks: live.tasks && live.tasks.length > 0 ? live.tasks : prev.tasks,
            test_seams: live.test_seams && live.test_seams.length > 0 ? live.test_seams : prev.test_seams,
            adrs: live.adrs && live.adrs.length > 0 ? live.adrs : prev.adrs,
          }));
        }
      }
    };
    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [initialFeature.id]);

  // Accordion state:
  // Overview: open by default (false)
  // Left column: closed by default (true)
  // Right column (Task Plan): open by default (false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    overview: false,
    scopeBoundaries: true,
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
      feature.is_standalone ||
      !feature.epicId ||
      feature.epicId === 'standalone' ||
      feature.epicId === '' ||
      feature.id.includes('fast-trace')
  );

  const specIdentifier = feature.specId || feature.spec_id || `spec-${feature.id}`;
  const specDisplayName = feature.specTitle || feature.spec_title || feature.name;
  const planIdentifier = feature.planId || feature.plan_id || `plan-${feature.id}`;
  const planDisplayName = feature.planTitle || feature.plan_title || `${feature.name} Plan`;

  const tasksList: FeatureTask[] = feature.tasks || [];
  const totalTasks = tasksList.length;
  const doneTasks = tasksList.filter((t) => t.status === 'Done').length;
  const taskProgressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;

  const requirementsList: FeatureRequirement[] = feature.requirements || [];
  const inScopeList = feature.in_scope || feature.inScope || [];
  const outOfScopeList = feature.out_of_scope || feature.outOfScope || [];
  const testSeamsList = feature.test_seams || feature.testSeams || [];
  const adrsList = feature.adrs || [];

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
                Epic: <span className="text-indigo-400 font-semibold">{feature.epicId || feature.epic_id}</span>
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
          <div className="p-5 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30">
            {/* Executive Summary */}
            <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800">
              <h4 className="text-xs font-semibold text-zinc-200 mb-1">Executive Summary</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                {feature.description || 'Autonomous Intelligent Code Orchestrator (AICO) feature module enforcing deterministic contract seams, vertical tracer-bullet DAG execution, and strict EARS behavioral invariants.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2-COLUMN SECTION: Left = Scope Boundaries, Brainstorm, Specs, Deep Dive, Lineage, Assets | Right = Task Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN (All Closed by Default) */}
        <div className="space-y-3">
          {/* Scope Boundaries Accordion (Closed by default) */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
            <div
              onClick={() => toggleSection('scopeBoundaries')}
              className="flex items-center justify-between px-4 py-3 bg-zinc-900 cursor-pointer select-none hover:bg-zinc-900/80 transition-colors"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {collapsedSections.scopeBoundaries ? (
                  <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                )}
                <Crosshair className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span className="font-semibold text-sm text-zinc-200">
                  Scope Boundaries ({inScopeList.length + outOfScopeList.length})
                </span>
                {collapsedSections.scopeBoundaries && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — In-Scope and Out-of-Scope boundaries
                  </span>
                )}
              </div>
              <button
                data-testid="popout-scope-boundaries"
                onClick={(e) => {
                  e.stopPropagation();
                  onPopOut?.(feature.id, 'scope-boundaries');
                }}
                title="Open in separate tab"
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
            {!collapsedSections.scopeBoundaries && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg space-y-1.5">
                    <span className="font-semibold text-indigo-400 text-xs block">
                      In-Scope Boundaries ({inScopeList.length})
                    </span>
                    {inScopeList.length > 0 ? (
                      <ul className="list-disc list-inside text-zinc-400 text-[11px] leading-relaxed space-y-1">
                        {inScopeList.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-500 text-[11px] italic">
                        No explicit in-scope items defined in specification.
                      </p>
                    )}
                  </div>
                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg space-y-1.5">
                    <span className="font-semibold text-amber-400 text-xs block">
                      Out-of-Scope Boundaries ({outOfScopeList.length})
                    </span>
                    {outOfScopeList.length > 0 ? (
                      <ul className="list-disc list-inside text-zinc-400 text-[11px] leading-relaxed space-y-1">
                        {outOfScopeList.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-500 text-[11px] italic">
                        No explicit out-of-scope items defined in specification.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

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
                  <h4 className="text-xs font-semibold text-zinc-200">Feature Brainstorm & Exploration</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Socratic problem framing and architectural alternatives evaluated for {feature.name}.
                  </p>
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
                  Specifications ({requirementsList.length} EARS Reqs)
                </span>
                {collapsedSections.specifications && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — Strict EARS requirement contracts
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
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-3">
                {requirementsList.length > 0 ? (
                  <div className="space-y-2.5">
                    {requirementsList.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-sky-400">
                              {req.id}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                              {req.pattern}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                            {req.status}
                          </span>
                        </div>
                        <p className="text-zinc-300 text-xs leading-relaxed">{req.statement}</p>
                        {req.seam && (
                          <div className="text-[10px] text-zinc-500 font-mono">
                            Seam: <span className="text-zinc-400">{req.seam}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-xs italic">
                    No EARS requirements parsed yet for this specification.
                  </p>
                )}
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
                <span className="font-semibold text-sm text-zinc-200">
                  Deep Dive ({testSeamsList.length} Seams)
                </span>
                {collapsedSections.deepDive && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — Designated verification test seams
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
                  {testSeamsList.length > 0 ? (
                    <div className="space-y-1.5 text-[11px] font-mono text-zinc-400">
                      {testSeamsList.map((seam, idx) => (
                        <div key={idx} className="p-2 bg-zinc-900 rounded border border-zinc-800">
                          <span className="text-emerald-400 font-semibold">{seam.path}</span>
                          {seam.description && seam.description !== seam.path && (
                            <div className="text-zinc-500 text-[10px] mt-0.5">{seam.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-xs italic">
                      No designated contract seams listed for this feature.
                    </p>
                  )}
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
                {adrsList.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {adrsList.map((adrId) => (
                      <div
                        key={adrId}
                        onClick={() => onOpenAdr?.(adrId)}
                        className="p-2.5 rounded bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 cursor-pointer transition-colors flex items-center justify-between group"
                      >
                        <div className="space-y-0.5">
                          <span className="font-mono text-[11px] text-indigo-400 font-bold group-hover:text-indigo-300">
                            {adrId}
                          </span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-xs italic">
                    No derived ADR references declared in frontmatter.
                  </p>
                )}
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

        {/* RIGHT COLUMN: Task Plan (Pure vertical DAG tasks with explicit dependencies, NO waves) */}
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
                  — Vertical tracer-bullet DAG task execution
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

              {/* Vertical DAG Task Cards */}
              <div className="space-y-3.5">
                {tasksList.map((task) => {
                  const blockedList = task.blocked_by || task.blockedBy || [];
                  const addressesList = task.addresses || [];
                  const deliverablesList = task.deliverables || [];

                  return (
                    <div
                      key={task.id}
                      className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/60 p-4 space-y-2.5"
                    >
                      {/* Task Card Header */}
                      <div className="flex items-center justify-between pb-1 border-b border-zinc-800/60">
                        <span className="font-mono text-xs font-bold text-indigo-400">
                          {task.id}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                            task.status === 'Done'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : task.status === 'In Progress'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : task.status === 'Blocked'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-zinc-100">{task.title}</div>

                      {/* Seam, Addresses & Blocked-By Metadata */}
                      <div className="space-y-1 text-[11px] font-mono text-zinc-400">
                        {task.seam && (
                          <div className="text-zinc-500">
                            Seam: <span className="text-emerald-400">{task.seam}</span>
                          </div>
                        )}
                        {addressesList.length > 0 && (
                          <div className="text-zinc-500 flex items-center gap-1.5 flex-wrap">
                            <span>Addresses:</span>
                            {addressesList.map((addr) => (
                              <span
                                key={addr}
                                className="px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-400 border border-sky-800/60 text-[10px]"
                              >
                                {addr}
                              </span>
                            ))}
                          </div>
                        )}
                        {blockedList.length > 0 && (
                          <div className="text-zinc-500 flex items-center gap-1.5 flex-wrap">
                            <span>Blocked by:</span>
                            {blockedList.map((dep) => (
                              <span
                                key={dep}
                                className="px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60 text-[10px]"
                              >
                                {dep}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Deliverables List */}
                      {deliverablesList.length > 0 && (
                        <div className="pt-2 border-t border-zinc-800/50">
                          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                            Deliverables
                          </span>
                          <ul className="list-disc list-inside text-zinc-300 text-[11px] leading-relaxed space-y-0.5">
                            {deliverablesList.map((deliv, idx) => (
                              <li key={idx}>{deliv}</li>
                            ))}
                          </ul>
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
