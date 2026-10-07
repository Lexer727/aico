import React, { useState, useEffect, useMemo } from 'react';
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
  BookOpen,
  Crosshair,
  FolderGit2,
} from 'lucide-react';
import { FileDropZone } from '../../components/common/FileDropZone';
import { MarkdownView, stripDocumentHeader, extractExecutiveSummary } from '../../components/common/MarkdownView';
import {
  fetchFeature,
  normalizeAdrId,
  extractTaskId,
  type FeatureTask,
  type FeatureRequirement,
  type TestSeamInfo,
  type TermInfo,
  type DiscoveredAdr,
  type DiscoveredFeature,
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
  brainstorm_content?: string;
  brainstormContent?: string;
  deepdive_content?: string;
  deepdiveContent?: string;
  ubiquitous_language?: TermInfo[];
  ubiquitousLanguage?: TermInfo[];
  repositories?: string[];
}

export interface FeatureViewerProps {
  feature: FeatureData;
  allFeatures?: DiscoveredFeature[];
  allAdrs?: DiscoveredAdr[];
  onOpenEpic?: (epicId: string) => void;
  onPopOut?: (featureId: string, section: string) => void;
  onOpenSpec?: (specId: string, title: string) => void;
  onOpenPlan?: (planId: string, title: string) => void;
  onOpenAdr?: (adrId: string) => void;
  uploadedFiles?: string[];
  onFileUpload?: (file: File) => void;
}

// @implements spec-ft-core-epic-hub::REQ-001
// @implements spec-ft-core-epic-hub::REQ-004
export const FeatureViewer: React.FC<FeatureViewerProps> = ({
  feature: initialFeature,
  allFeatures,
  allAdrs,
  onOpenEpic,
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
        initialFeature.tasks.length === 0 ||
        (!initialFeature.brainstorm_content && !initialFeature.brainstormContent)
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
            brainstorm_content: live.brainstorm_content || prev.brainstorm_content,
            brainstormContent: live.brainstormContent || live.brainstorm_content || prev.brainstormContent,
            deepdive_content: live.deepdive_content || prev.deepdive_content,
            deepdiveContent: live.deepdiveContent || live.deepdive_content || prev.deepdiveContent,
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
  // Left column (Brainstorm, ADRs, Deep Dive, Specs, Assets): closed by default (true)
  // Right column (Task Plan): open by default (false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    brainstorm: true,
    adrs: true,
    deepDive: true,
    specifications: true,
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
  const doneTasks = tasksList.filter((t) => t.status === 'Done' || t.status === 'Completed').length;
  const taskProgressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;

  const tasksMap = useMemo(() => {
    const map: Record<string, FeatureTask> = {};
    if (allFeatures && allFeatures.length > 0) {
      allFeatures.forEach((f) => {
        (f.tasks || []).forEach((t) => {
          map[t.id.toUpperCase()] = t;
          map[t.id.toLowerCase()] = t;
        });
      });
    }
    tasksList.forEach((t) => {
      map[t.id.toUpperCase()] = t;
      map[t.id.toLowerCase()] = t;
    });
    return map;
  }, [allFeatures, tasksList]);

  const requirementsList: FeatureRequirement[] = feature.requirements || [];
  const inScopeList = feature.in_scope || feature.inScope || [];
  const outOfScopeList = feature.out_of_scope || feature.outOfScope || [];
  const testSeamsList = feature.test_seams || feature.testSeams || [];
  const adrsList = feature.adrs || [];

  const featureAdrs = useMemo(() => {
    const set = new Set<string>();
    if (feature.adrs) {
      feature.adrs.forEach((a) => {
        const norm = normalizeAdrId(a);
        if (norm) set.add(norm);
      });
    }
    const list = Array.from(set);
    list.sort();
    return list;
  }, [feature.adrs]);

  const adrLookupMap = useMemo(() => {
    const map: Record<string, DiscoveredAdr> = {};
    if (allAdrs) {
      allAdrs.forEach((a) => {
        map[a.id.toLowerCase()] = a;
        const norm = normalizeAdrId(a.id);
        if (norm) map[norm.toLowerCase()] = a;
      });
    }
    return map;
  }, [allAdrs]);

  const rawBrainstorm = feature.brainstormContent || feature.brainstorm_content;
  const execSummary =
    feature.description ||
    extractExecutiveSummary(rawBrainstorm) ||
    'Autonomous Intelligent Code Orchestrator (AICO) feature module enforcing deterministic contract seams, vertical tracer-bullet DAG execution, and strict EARS behavioral invariants.';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* 1. Feature Header Banner */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {isStandalone ? (
              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-semibold bg-purple-950/70 text-purple-400 border border-purple-800">
                Standalone Feature
              </span>
            ) : (
              <button
                onClick={() => {
                  const epic = feature.epicId || feature.epic_id;
                  if (epic) onOpenEpic?.(epic);
                }}
                className="text-[10px] px-2.5 py-0.5 rounded-full font-mono bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                title="Click to open parent Epic"
              >
                <span>Epic:</span>
                <span className="text-indigo-400 font-semibold">{feature.epicId || feature.epic_id}</span>
              </button>
            )}
            <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-zinc-800 text-indigo-400 font-bold border border-zinc-700">
              FEATURE: {feature.id}
            </span>
            {feature.order && (
              <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-zinc-800/60 text-zinc-400 border border-zinc-700/60">
                Order #{feature.order}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 mt-2">
            {feature.name}
          </h1>

          {/* Target Repositories */}
          {/* @implements spec-ft-git-dashboard-ui::REQ-004 */}
          {/* @implements spec-ft-core-repository-badges-alignment::REQ-001 */}
          {/* @implements spec-ft-core-repository-badges-alignment::REQ-002 */}
          {/* @implements spec-ft-core-repository-badges-alignment::REQ-004 */}
          {feature.repositories && feature.repositories.length > 0 && (
            <div
              data-testid="feature-repositories-list"
              className="flex items-center gap-1.5 mt-2"
            >
              <span title="Repositories" className="flex items-center text-zinc-400">
                <FolderGit2 className="w-3.5 h-3.5" />
              </span>
              {feature.repositories.map((repo) => (
                <span
                  key={repo}
                  data-testid={`feature-repo-badge-${repo}`}
                  className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700/80 text-zinc-300 font-medium"
                >
                  {repo}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Status and Progress on the right */}
        <div className="flex flex-col items-end gap-1">
          <span
            className={`text-xs px-3 py-1 rounded-full font-mono font-semibold ${
              feature.status === 'Completed' || feature.status === 'Done'
                ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800'
                : 'bg-amber-950/70 text-amber-400 border border-amber-800'
            }`}
          >
            {feature.status}
          </span>
          <p className="text-[11px] font-mono text-zinc-400">
            {doneTasks}/{totalTasks} Tasks Done ({taskProgressPct}%)
          </p>
        </div>
      </div>

      {/* TOP SECTION: Executive Summary Banner (Directly visible at top, no collapsible accordion) */}
      {execSummary && (
        <div className="p-4 bg-zinc-900/70 border border-zinc-800 rounded-xl space-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Executive Summary</span>
          </div>
          <div className="text-zinc-300 text-xs sm:text-sm leading-relaxed">
            <MarkdownView content={execSummary} />
          </div>
        </div>
      )}

      {/* 2-COLUMN SECTION: Left = Brainstorm, ADRs, Deep Dive, Specs, Assets | Right = Task Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: Brainstorm, ADRs, Deep Dive, Specs, Assets (Closed by default) */}
        <div className="space-y-3">
          {/* 1. Brainstorm Accordion */}
          {(() => {
            const displayBrainstorm = stripDocumentHeader(rawBrainstorm);
            return (
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
                        {rawBrainstorm ? '— Architectural trade-offs and decision matrix' : '— No brainstorm artifact defined'}
                      </span>
                    )}
                  </div>
                  {rawBrainstorm && (
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
                  )}
                </div>
                {!collapsedSections.brainstorm && (
                  <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-3">
                    {displayBrainstorm ? (
                      <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 space-y-2">
                        <h4 className="text-xs font-semibold text-zinc-200">Feature Brainstorm & Exploration</h4>
                        <MarkdownView content={displayBrainstorm} />
                      </div>
                    ) : rawBrainstorm ? (
                      <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 text-zinc-400 text-xs italic">
                        Brainstorming details summarized in Executive Summary above.
                      </div>
                    ) : (
                      <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 text-zinc-500 text-xs italic">
                        No brainstorm artifact (brain-ft-*.md) created for this feature.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 2. Architecture Decision Records (ADRs) Accordion */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
            <div
              onClick={() => toggleSection('adrs')}
              className="flex items-center justify-between px-4 py-3 bg-zinc-900 cursor-pointer select-none hover:bg-zinc-900/80 transition-colors"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {collapsedSections.adrs ? (
                  <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                )}
                <BookOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="font-semibold text-sm text-zinc-200">
                  Architecture Decision Records ({featureAdrs.length})
                </span>
                {collapsedSections.adrs && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — Architectural governance records referenced by this feature
                  </span>
                )}
              </div>
            </div>
            {!collapsedSections.adrs && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-2.5">
                {featureAdrs.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {featureAdrs.map((adrId) => {
                      const adrInfo = adrLookupMap[adrId.toLowerCase()];
                      return (
                        <div
                          key={adrId}
                          onClick={() => onOpenAdr?.(adrId)}
                          className="p-3 bg-zinc-900/80 rounded border border-zinc-800 hover:border-amber-500/50 cursor-pointer transition-colors space-y-1.5 group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-amber-400 group-hover:text-amber-300">
                                {adrId}
                              </span>
                              <span className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate">
                                {adrInfo?.title || `Architecture Decision Record ${adrId}`}
                              </span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                              {adrInfo?.status || 'Accepted'}
                            </span>
                          </div>
                          {adrInfo?.decision && (
                            <p className="text-[11px] text-zinc-400 line-clamp-2">
                              {adrInfo.decision}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
                            <span>Click to view decision record</span>
                            <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                              Open ADR &rarr;
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 text-zinc-500 text-xs italic">
                    No Architecture Decision Records (ADRs) associated with this feature.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Deep Dive Accordion */}
          {(() => {
            const featureDeepDive = feature.deepdiveContent || feature.deepdive_content;
            return (
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
                        {featureDeepDive ? '— System boundaries and designated seams' : '— No deep dive artifact defined'}
                      </span>
                    )}
                  </div>
                  {featureDeepDive && (
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
                  )}
                </div>
                {!collapsedSections.deepDive && (
                  <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-2">
                    {featureDeepDive ? (
                      <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 space-y-2">
                        <h4 className="text-xs font-semibold text-zinc-200">System Boundaries & Deep Dive Analysis</h4>
                        <MarkdownView content={featureDeepDive} />
                      </div>
                    ) : (
                      <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 text-zinc-500 text-xs italic">
                        No deep dive artifact (deepdive-ft-*.md) created for this feature.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 3. Specs Accordion */}
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
                  Specs ({requirementsList.length} Reqs • {testSeamsList.length} Seams)
                </span>
                {collapsedSections.specifications && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — Scope boundaries, EARS requirements & contract seams
                  </span>
                )}
              </div>
              <button
                data-testid="popout-specifications"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSpec?.(specIdentifier, specDisplayName);
                }}
                title="Open in separate tab"
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
            {!collapsedSections.specifications && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-4">
                {/* Scope Boundaries */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Scope Boundaries</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-2.5">
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

                {/* EARS Requirements */}
                <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                  <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                    <span>EARS Requirements ({requirementsList.length})</span>
                  </h4>
                  {requirementsList.length > 0 ? (
                    <div className="space-y-2">
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

                {/* Designated Public Test Seams */}
                <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                  <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <GitFork className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Designated Public Test Seams ({testSeamsList.length})</span>
                  </h4>
                  {testSeamsList.length > 0 ? (
                    <div className="space-y-1.5 text-[11px] font-mono text-zinc-400">
                      {testSeamsList.map((seam, idx) => (
                        <div key={idx} className="p-2.5 bg-zinc-900 rounded border border-zinc-800">
                          <span className="text-emerald-400 font-semibold">{seam.path}</span>
                          {seam.description && seam.description !== seam.path && (
                            <div className="text-zinc-400 text-[11px] mt-1 font-sans">{seam.description}</div>
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

                {/* Lineage / ADRs */}
                {adrsList.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                    <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span>Lineage ({adrsList.length} ADRs)</span>
                    </h4>
                    <div className="grid grid-cols-1 gap-1.5">
                      {adrsList.map((adrId) => (
                        <div
                          key={adrId}
                          onClick={() => onOpenAdr?.(adrId)}
                          className="p-2 rounded bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 cursor-pointer transition-colors flex items-center justify-between group"
                        >
                          <span className="font-mono text-[11px] text-indigo-400 font-bold group-hover:text-indigo-300">
                            {adrId}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Assets Accordion */}
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
            className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 cursor-pointer select-none hover:bg-zinc-900/80 transition-colors gap-3"
          >
            <div className="flex items-center gap-2.5 shrink-0">
              {collapsedSections.taskPlan ? (
                <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              )}
              <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="font-semibold text-sm text-zinc-200">Task Plan</span>
            </div>

            {/* Task Execution Progress Bar in Handle (Visible both expanded & collapsed) */}
            <div data-testid="task-plan-handle-progress" className="flex items-center gap-3 flex-1 max-w-xs sm:max-w-sm justify-end ml-auto">
              <span className="font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                <span className="text-emerald-400 font-semibold">{doneTasks}/{totalTasks}</span> Done ({taskProgressPct}%)
              </span>
              <div className="w-24 sm:w-32 bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800 shrink-0">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${taskProgressPct}%` }}
                />
              </div>
            </div>

            <button
              data-testid="popout-taskPlan"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPlan?.(planIdentifier, planDisplayName);
              }}
              title="Open in separate tab"
              className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {!collapsedSections.taskPlan && (
            <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-4">
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
                <div className="p-4 bg-zinc-900/70 rounded-xl border border-zinc-800/90 space-y-3.5">
                  {/* Feature Task Header & Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-800 text-indigo-400 shrink-0">
                          {feature.id}
                        </span>
                        <span className="font-semibold text-xs text-zinc-200 truncate">
                          {feature.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-zinc-400">
                          {doneTasks}/{totalTasks} Done ({taskProgressPct}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-800/60">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-200"
                        style={{ width: `${taskProgressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Pure Vertical DAG Tasks without waves */}
                  <div className="space-y-2.5 pt-1">
                    {tasksList.length > 0 ? (
                      tasksList.map((task) => {
                        const blockedList = task.blocked_by || task.blockedBy || [];
                        const addressesList = task.addresses || [];
                        const deliverablesList = task.deliverables || [];

                        const isAllResolved = blockedList.every((dep) => {
                          const depUpper = dep.trim().toUpperCase();
                          if (!depUpper || depUpper === 'NONE' || depUpper.startsWith('NONE')) return true;
                          const taskId = extractTaskId(dep);
                          const blocker = taskId
                            ? tasksMap[taskId] || tasksMap[taskId.toLowerCase()]
                            : tasksMap[depUpper] || tasksMap[dep.trim().toLowerCase()];
                          return blocker && (blocker.status === 'Done' || blocker.status === 'Completed');
                        });

                        return (
                          <div
                            key={task.id}
                            className="p-3 bg-zinc-950/70 rounded-lg border border-zinc-800/70 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[11px] font-bold text-indigo-400 shrink-0">
                                  {task.id}
                                </span>
                                <span className="text-xs text-zinc-200 font-medium truncate">
                                  {task.title}
                                </span>
                              </div>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 font-semibold ${
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

                            {/* Seam, Addresses & Blocked-By */}
                            <div className="space-y-0.5 text-[10px] font-mono text-zinc-400">
                              {task.seam && (
                                <div className="text-zinc-500">
                                  Seam: <span className="text-emerald-400">{task.seam}</span>
                                </div>
                              )}
                              {addressesList.length > 0 && (
                                <div className="text-zinc-500 flex items-center gap-1 flex-wrap">
                                  <span>Addresses:</span>
                                  {addressesList.map((addr) => (
                                    <span
                                      key={addr}
                                      className="px-1 py-0.2 rounded bg-sky-950/80 text-sky-400 border border-sky-800/60"
                                    >
                                      {addr}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {blockedList.length > 0 && (
                                <div className="text-zinc-500 flex items-center gap-1.5 flex-wrap pt-0.5">
                                  <span>{isAllResolved ? 'Depends on:' : 'Blocked by:'}</span>
                                  {blockedList.map((dep) => {
                                    const depUpper = dep.trim().toUpperCase();
                                    const isNone = !depUpper || depUpper === 'NONE' || depUpper.startsWith('NONE');
                                    const taskId = extractTaskId(dep);
                                    const blocker = taskId
                                      ? tasksMap[taskId] || tasksMap[taskId.toLowerCase()]
                                      : tasksMap[depUpper] || tasksMap[dep.trim().toLowerCase()];
                                    const isResolved =
                                      isNone ||
                                      (blocker && (blocker.status === 'Done' || blocker.status === 'Completed'));

                                    return (
                                      <span
                                        key={dep}
                                        className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                                          isResolved
                                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                                            : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                                        }`}
                                      >
                                        {dep} {isResolved ? '(Done)' : blocker?.status ? `(${blocker.status})` : '(Pending)'}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Deliverables */}
                            {deliverablesList.length > 0 && (
                              <div className="pt-1.5 border-t border-zinc-800/50">
                                <ul className="list-disc list-inside text-zinc-400 text-[10px] space-y-0.5">
                                  {deliverablesList.map((deliv, idx) => (
                                    <li key={idx}>{deliv}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-zinc-500 text-xs italic py-2">
                        No implementation tasks defined for this feature.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
