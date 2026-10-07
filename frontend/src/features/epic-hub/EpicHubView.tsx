import React, { useState, useEffect, useMemo } from 'react';
import {
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Layers,
  FileText,
  CheckSquare,
  GitFork,
  FolderArchive,
  Package,
  BookOpen,
  FolderGit2,
} from 'lucide-react';
import { FileDropZone } from '../../components/common/FileDropZone';
import { MarkdownView, stripDocumentHeader } from '../../components/common/MarkdownView';
import {
  fetchEpic,
  normalizeAdrId,
  extractTaskId,
  type DiscoveredFeature,
  type FeatureTask,
  type TermInfo,
  type DiscoveredAdr,
} from '../feature-task-data';

export interface EpicData {
  id: string;
  title: string;
  status: string;
  verifiedCount?: number;
  totalCount?: number;
  order?: number;
  executiveSummary?: string;
  executive_summary?: string;
  brainstormContent?: string;
  brainstorm_content?: string;
  deepdiveContent?: string;
  deepdive_content?: string;
  adrs?: string[];
  ubiquitousLanguage?: TermInfo[];
  ubiquitous_language?: TermInfo[];
  repositories?: string[];
  features?: DiscoveredFeature[];
  specs?: Array<{
    id: string;
    title: string;
    status: string;
    path?: string;
    order?: number;
    requirements_count?: number;
    requirementsCount?: number;
    seam?: string;
  }>;
  sections?: {
    overview?: string;
    brainstorm?: string;
    specifications?: string;
    deepDive?: string;
    taskPlan?: string;
    assets?: string;
  };
}

interface EpicHubViewProps {
  epic: EpicData;
  allFeatures?: DiscoveredFeature[];
  allAdrs?: DiscoveredAdr[];
  onOpenAdr?: (adrId: string) => void;
  onPopOut?: (epicId: string, section: string) => void;
  onOpenSpec?: (specId: string, title: string) => void;
  onOpenFeature?: (featureId: string, name: string) => void;
  uploadedFiles?: string[];
  onFileUpload?: (file: File) => void;
}

// @implements spec-ft-core-epic-hub::REQ-001
// @implements spec-ft-core-epic-hub::REQ-002
// @implements spec-ft-core-epic-hub::REQ-003
// @implements spec-ft-core-epic-hub::REQ-005
// @implements spec-ft-core-epic-hub::REQ-011
export const EpicHubView: React.FC<EpicHubViewProps> = ({
  epic: initialEpic,
  allFeatures,
  allAdrs,
  onOpenAdr,
  onPopOut,
  onOpenSpec: _onOpenSpec,
  onOpenFeature,
  uploadedFiles = [],
  onFileUpload,
}) => {
  const [epic, setEpic] = useState<EpicData>(initialEpic);

  useEffect(() => {
    setEpic(initialEpic);
  }, [initialEpic]);

  // Fetch full live artifact details if features or summary are not yet populated
  useEffect(() => {
    let isMounted = true;
    const loadDetails = async () => {
      if (!initialEpic.features || initialEpic.features.length === 0) {
        const live = await fetchEpic(initialEpic.id);
        if (live && isMounted) {
          setEpic((prev) => ({
            ...prev,
            ...live,
            executiveSummary: live.executive_summary || prev.executiveSummary,
            brainstormContent: live.brainstorm_content || prev.brainstormContent,
            deepdiveContent: live.deepdive_content || prev.deepdiveContent,
            adrs: live.adrs || prev.adrs,
            ubiquitousLanguage: live.ubiquitous_language || prev.ubiquitousLanguage,
            features: live.features || prev.features,
            specs: live.specs || prev.specs,
          }));
        }
      }
    };
    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [initialEpic.id]);

  // Layout states:
  // Left column (Features, Brainstorm, ADRs, Deep Dive, Assets): closed by default (collapsed = true)
  // Right column (Task Plan): open by default (collapsed = false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    features: true,
    brainstorm: true,
    adrs: true,
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

  const currentFeaturesList: DiscoveredFeature[] = epic.features || [];
  const currentSpecsList =
    epic.specs ||
    currentFeaturesList.map((f) => ({
      id: f.spec_id || f.specId || `spec-${f.id}`,
      title: f.spec_title || f.specTitle || f.name,
      status: f.status,
      requirements_count: f.requirements ? f.requirements.length : 0,
      seam: f.tasks?.[0]?.seam || '',
    }));

  // Compute overall task plan progress across all features in this epic
  const allTasks: FeatureTask[] = currentFeaturesList.flatMap((f) => f.tasks || []);
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === 'Done' || t.status === 'Completed').length;
  const overallPercentage = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;

  // Dynamic epic status calculation: if all features and tasks are finished, status rolls up to Completed
  const isAllFeaturesDone =
    currentFeaturesList.length > 0 &&
    currentFeaturesList.every((f) => f.status === 'Completed' || f.status === 'Done');
  const isAllTasksDone = allTasks.length > 0 && doneTasks === allTasks.length;
  const computedEpicStatus =
    (isAllFeaturesDone && (allTasks.length === 0 || isAllTasksDone))
      ? 'Completed'
      : epic.status;

  const allTasksMap = useMemo(() => {
    const map: Record<string, FeatureTask> = {};
    if (allFeatures && allFeatures.length > 0) {
      allFeatures.forEach((f) => {
        (f.tasks || []).forEach((t) => {
          map[t.id.toUpperCase()] = t;
          map[t.id.toLowerCase()] = t;
        });
      });
    }
    allTasks.forEach((t) => {
      map[t.id.toUpperCase()] = t;
      map[t.id.toLowerCase()] = t;
    });
    return map;
  }, [allFeatures, allTasks]);

  const executiveSummary =
    epic.executiveSummary ||
    epic.executive_summary ||
    epic.sections?.overview ||
    'Autonomous Intelligent Code Orchestrator (AICO) delivers a zero-daemon, local-first engineering platform enforcing strict EARS specification contracts, non-destructive DAG execution, and AST traceability.';

  const verifiedCount = epic.verifiedCount ?? doneTasks;
  const totalCount = epic.totalCount ?? (totalTasks > 0 ? totalTasks : currentSpecsList.length);

  const epicAdrs = useMemo(() => {
    const set = new Set<string>();
    if (epic.adrs) {
      epic.adrs.forEach((a) => {
        const norm = normalizeAdrId(a);
        if (norm) set.add(norm);
      });
    }
    if (epic.features) {
      epic.features.forEach((f) => {
        if (f.adrs) {
          f.adrs.forEach((a) => {
            const norm = normalizeAdrId(a);
            if (norm) set.add(norm);
          });
        }
      });
    }
    const list = Array.from(set);
    list.sort();
    return list;
  }, [epic.adrs, epic.features]);

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

  // @implements spec-ft-git-dashboard-ui::REQ-003
  const relevantRepositories = useMemo(() => {
    if (epic.repositories && epic.repositories.length > 0) {
      return epic.repositories;
    }
    const reposSet = new Set<string>();
    for (const feat of currentFeaturesList) {
      if (feat.repositories) {
        for (const r of feat.repositories) {
          reposSet.add(r);
        }
      }
    }
    return Array.from(reposSet);
  }, [epic.repositories, currentFeaturesList]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Epic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-sm px-2.5 py-1 rounded-md bg-indigo-950 text-indigo-400 border border-indigo-800/80 font-bold uppercase tracking-wide">
              {epic.id}
            </span>
            {epic.order && (
              <span className="text-xs text-zinc-500 font-mono">
                Order #{epic.order}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-2">{epic.title}</h1>

          {/* Repositories beneath title */}
          {/* @implements spec-ft-git-dashboard-ui::REQ-003 */}
          {/* @implements spec-ft-core-repository-badges-alignment::REQ-003 */}
          {/* @implements spec-ft-core-repository-badges-alignment::REQ-004 */}
          {relevantRepositories.length > 0 && (
            <div
              data-testid="epic-repositories-list"
              className="flex items-center gap-1.5 mt-2"
            >
              <span title="Repositories" className="flex items-center text-zinc-400">
                <FolderGit2 className="w-3.5 h-3.5" />
              </span>
              {relevantRepositories.map((repo) => (
                <span
                  key={repo}
                  data-testid={`epic-repo-badge-${repo}`}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700/80 text-zinc-300 font-medium"
                >
                  {repo}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Status and Verification on the right */}
        <div className="flex flex-col items-end gap-1">
          <span
            className={`text-xs px-3 py-1 rounded-full font-mono font-semibold ${
              computedEpicStatus === 'Completed' || computedEpicStatus === 'Done'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'
                : 'bg-amber-950 text-amber-400 border border-amber-800/80'
            }`}
          >
            {computedEpicStatus}
          </span>
          <p className="text-[11px] font-mono text-zinc-400">
            [{verifiedCount}/{totalCount} Verified]
          </p>
        </div>
      </div>

      {/* TOP SECTION: Executive Summary Banner (Directly visible at top, no collapsible accordion) */}
      {executiveSummary && (
        <div className="p-4 bg-zinc-900/70 border border-zinc-800 rounded-xl space-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Executive Summary</span>
          </div>
          <div className="text-zinc-300 text-xs sm:text-sm leading-relaxed">
            <MarkdownView content={executiveSummary} />
          </div>
        </div>
      )}

      {/* 2-COLUMN SECTION: Left = Accordions | Right = Task Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: Features, Brainstorm, ADRs, Deep Dive, Assets */}
        <div className="space-y-3">
          {/* Features Accordion */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
            <div
              onClick={() => toggleSection('features')}
              className="flex items-center justify-between px-4 py-3 bg-zinc-900 cursor-pointer select-none hover:bg-zinc-900/80 transition-colors"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {collapsedSections.features ? (
                  <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                )}
                <Package className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span className="font-semibold text-sm text-zinc-200">
                  Features in this Epic ({currentFeaturesList.length})
                </span>
                {collapsedSections.features && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — Child feature modules
                  </span>
                )}
              </div>
            </div>
            {!collapsedSections.features && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-2">
                <div className="grid grid-cols-1 gap-2">
                  {currentFeaturesList.map((feat) => (
                    <div
                      key={feat.id}
                      onClick={() => onOpenFeature?.(feat.id, feat.name)}
                      className="p-3 bg-zinc-900/80 rounded border border-zinc-800 hover:border-indigo-500/50 cursor-pointer transition-colors space-y-1 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
                          {feat.id}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                            feat.status === 'Completed' || feat.status === 'Done'
                              ? 'bg-emerald-950 text-emerald-400'
                              : 'bg-amber-950 text-amber-400'
                          }`}
                        >
                          {feat.status}
                        </span>
                      </div>
                      <div className="font-semibold text-xs text-zinc-200 group-hover:text-white truncate">
                        {feat.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {feat.spec_id || feat.specId} • {feat.plan_id || feat.planId}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Brainstorm Accordion */}
          {(() => {
            const rawBrainstorm = epic.brainstormContent || epic.brainstorm_content || epic.sections?.brainstorm;
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
                        onPopOut?.(epic.id, 'brainstorm');
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
                        <h4 className="text-xs font-semibold text-zinc-200">Architectural Context & Exploration</h4>
                        <MarkdownView content={displayBrainstorm} />
                      </div>
                    ) : rawBrainstorm ? (
                      <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 text-zinc-400 text-xs italic">
                        Brainstorming details summarized in Executive Summary above.
                      </div>
                    ) : (
                      <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 text-zinc-500 text-xs italic">
                        No brainstorm artifact (brain-ec-*.md) created for this epic.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Architecture Decision Records (ADRs) Accordion */}
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
                  Architecture Decision Records ({epicAdrs.length})
                </span>
                {collapsedSections.adrs && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — Architectural governance records across child features
                  </span>
                )}
              </div>
            </div>
            {!collapsedSections.adrs && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-2.5">
                {epicAdrs.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {epicAdrs.map((adrId) => {
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
                    No Architecture Decision Records (ADRs) associated with this epic.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Deep Dive Accordion */}
          {(() => {
            const epicDeepDive = epic.deepdiveContent || epic.deepdive_content || epic.sections?.deepDive;
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
                        {epicDeepDive ? '— System boundaries and designated seams' : '— No deep dive artifact defined'}
                      </span>
                    )}
                  </div>
                  {epicDeepDive && (
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
                  )}
                </div>
                {!collapsedSections.deepDive && (
                  <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-2">
                    {epicDeepDive ? (
                      <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 space-y-2">
                        <h4 className="text-xs font-semibold text-zinc-200">System Boundaries & Seams</h4>
                        <MarkdownView content={epicDeepDive} />
                      </div>
                    ) : (
                      <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 text-zinc-500 text-xs italic">
                        No deep dive artifact (deepdive-ec-*.md) created for this epic.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

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
                    — {epic.sections?.assets || 'Attached artifacts and multimodal drops'}
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
                <div className="pt-1">
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

            {/* Overall Task Execution Progress Bar in Handle (Visible both expanded & collapsed) */}
            <div data-testid="task-plan-handle-progress" className="flex items-center gap-3 flex-1 max-w-xs sm:max-w-sm justify-end ml-auto">
              <span className="font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                <span className="text-emerald-400 font-semibold">{doneTasks}/{totalTasks}</span> Done ({overallPercentage}%)
              </span>
              <div className="w-24 sm:w-32 bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800 shrink-0">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${overallPercentage}%` }}
                />
              </div>
            </div>

            <button
              data-testid="popout-taskPlan"
              onClick={(e) => {
                e.stopPropagation();
                onPopOut?.(epic.id, 'taskPlan');
              }}
              title="Open in separate tab"
              className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {!collapsedSections.taskPlan && (
            <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-4">
              {/* Sequential Feature Groups with Dedicated Task DAGs */}
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
                {currentFeaturesList.map((feat) => {
                  const featTasks = feat.tasks || [];
                  const featTotal = featTasks.length;
                  const featDone = featTasks.filter((t) => t.status === 'Done').length;
                  const featPct = featTotal > 0 ? Math.round((featDone / featTotal) * 100) : 100;

                  return (
                    <div
                      key={feat.id}
                      className="p-4 bg-zinc-900/70 rounded-xl border border-zinc-800/90 space-y-3.5"
                    >
                      {/* Feature Task Header & Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-800 text-indigo-400 shrink-0">
                              {feat.id}
                            </span>
                            <span className="font-semibold text-xs text-zinc-200 truncate">
                              {feat.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[11px] text-zinc-400">
                              {featDone}/{featTotal} Done ({featPct}%)
                            </span>
                            {onOpenFeature && (
                              <button
                                onClick={() => onOpenFeature(feat.id, feat.name)}
                                className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                              >
                                View Feature
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-800/60">
                          <div
                            className="bg-indigo-500 h-full rounded-full transition-all duration-200"
                            style={{ width: `${featPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Pure Vertical DAG Tasks without waves */}
                      <div className="space-y-2.5 pt-1">
                        {featTasks.map((task) => {
                          const blockedList = task.blocked_by || task.blockedBy || [];
                          const addressesList = task.addresses || [];
                          const deliverablesList = task.deliverables || [];

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
                                {blockedList.length > 0 && (() => {
                                  const isAllResolved = blockedList.every((dep) => {
                                    const depUpper = dep.trim().toUpperCase();
                                    if (!depUpper || depUpper === 'NONE' || depUpper.startsWith('NONE')) return true;
                                    const taskId = extractTaskId(dep);
                                    const blocker = taskId
                                      ? allTasksMap[taskId] || allTasksMap[taskId.toLowerCase()]
                                      : allTasksMap[depUpper] || allTasksMap[dep.trim().toLowerCase()];
                                    return blocker && (blocker.status === 'Done' || blocker.status === 'Completed');
                                  });

                                  return (
                                    <div className="text-zinc-500 flex items-center gap-1.5 flex-wrap pt-0.5">
                                      <span>{isAllResolved ? 'Depends on:' : 'Blocked by:'}</span>
                                      {blockedList.map((dep) => {
                                        const depUpper = dep.trim().toUpperCase();
                                        const isNone = !depUpper || depUpper === 'NONE' || depUpper.startsWith('NONE');
                                        const taskId = extractTaskId(dep);
                                        const blocker = taskId
                                          ? allTasksMap[taskId] || allTasksMap[taskId.toLowerCase()]
                                          : allTasksMap[depUpper] || allTasksMap[dep.trim().toLowerCase()];
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
                                  );
                                })()}
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
                        })}
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
