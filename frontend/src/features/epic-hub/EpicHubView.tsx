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
  Package,
  BookOpen,
} from 'lucide-react';
import { FileDropZone } from '../../components/common/FileDropZone';
import {
  fetchEpic,
  type DiscoveredFeature,
  type FeatureTask,
  type TermInfo,
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
  ubiquitousLanguage?: TermInfo[];
  ubiquitous_language?: TermInfo[];
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
  onPopOut?: (epicId: string, section: string) => void;
  onOpenSpec?: (specId: string, title: string) => void;
  onOpenFeature?: (featureId: string, name: string) => void;
  uploadedFiles?: string[];
  onFileUpload?: (file: File) => void;
}

// @implements SPEC-CORE-007::REQ-001
// @implements SPEC-CORE-007::REQ-002
// @implements SPEC-CORE-007::REQ-003
// @implements SPEC-CORE-007::REQ-005
// @implements SPEC-CORE-007::REQ-011
export const EpicHubView: React.FC<EpicHubViewProps> = ({
  epic: initialEpic,
  onPopOut,
  onOpenSpec,
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
  // Overview: open by default (collapsed = false)
  // Left column (Features, Brainstorm, Specs, Deep Dive, Terminology, Assets): closed by default (collapsed = true)
  // Right column (Task Plan): open by default (collapsed = false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    overview: false,
    features: true,
    brainstorm: true,
    specifications: true,
    deepDive: true,
    terminology: true,
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

  const termsList: TermInfo[] = epic.ubiquitous_language || epic.ubiquitousLanguage || [];

  // Compute overall task plan progress across all features in this epic
  const allTasks: FeatureTask[] = currentFeaturesList.flatMap((f) => f.tasks || []);
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === 'Done').length;
  const overallPercentage = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;

  const executiveSummary =
    epic.executiveSummary ||
    epic.executive_summary ||
    epic.sections?.overview ||
    'Autonomous Intelligent Code Orchestrator (AICO) delivers a zero-daemon, local-first engineering platform enforcing strict EARS specification contracts, non-destructive DAG execution, and AST traceability.';

  const verifiedCount = epic.verifiedCount ?? doneTasks;
  const totalCount = epic.totalCount ?? (totalTasks > 0 ? totalTasks : currentSpecsList.length);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Epic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm px-2.5 py-1 rounded-md bg-indigo-950 text-indigo-400 border border-indigo-800/80 font-bold uppercase tracking-wide">
              {epic.id}
            </span>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                epic.status === 'Completed' || epic.status === 'Done'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'
                  : 'bg-amber-950 text-amber-400 border border-amber-800/80'
              }`}
            >
              {epic.status}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              [{verifiedCount}/{totalCount} Verified]
            </span>
            {epic.order && (
              <span className="text-xs text-zinc-500 font-mono">
                Order #{epic.order}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-2">{epic.title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              toggleSection('features');
              toggleSection('brainstorm');
              toggleSection('specifications');
              toggleSection('deepDive');
              toggleSection('terminology');
              toggleSection('assets');
            }}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 transition-colors"
          >
            Toggle Left Accordions
          </button>
        </div>
      </div>

      {/* TOP SECTION: Overview (Open by default, containing solely the Executive Summary) */}
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
                — {executiveSummary}
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
          <div className="p-5 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30">
            {/* Executive Summary */}
            <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800">
              <h4 className="text-xs font-semibold text-zinc-200 mb-1">Executive Summary</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                {executiveSummary}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2-COLUMN SECTION: Left = Accordions | Right = Task Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: Features, Brainstorm, Specifications, Deep Dive, Terminology, Assets (Closed by default) */}
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
                    — {epic.sections?.brainstorm || 'Architectural trade-offs and decision matrix'}
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
                  <h4 className="text-xs font-semibold text-zinc-200">Architectural Context & Brainstorm</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    {epic.brainstormContent ||
                      epic.brainstorm_content ||
                      epic.sections?.brainstorm ||
                      'Problem exploration, architectural boundaries, and alternative approaches.'}
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
                <span className="font-semibold text-sm text-zinc-200">Specifications</span>
                {collapsedSections.specifications && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — {epic.sections?.specifications || `${currentSpecsList.length} EARS specifications`}
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
                {currentSpecsList.map((spec) => (
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
                        {spec.requirements_count ?? (spec as any).requirementsCount ?? 0} Requirements
                        {spec.seam ? ` • Seam: ${spec.seam}` : ''}
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
                    — {epic.sections?.deepDive || 'System boundaries and designated seams'}
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
                  <h4 className="text-xs font-semibold text-zinc-200">System Boundaries & Seams</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Graph traversal designates test seams between modules to prevent regressions and isolate blast radii.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Ubiquitous Domain Terminology Accordion */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
            <div
              onClick={() => toggleSection('terminology')}
              className="flex items-center justify-between px-4 py-3 bg-zinc-900 cursor-pointer select-none hover:bg-zinc-900/80 transition-colors"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {collapsedSections.terminology ? (
                  <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                )}
                <BookOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="font-semibold text-sm text-zinc-200">
                  Ubiquitous Domain Terminology ({termsList.length})
                </span>
                {collapsedSections.terminology && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — GLOSSARY.md domain language definitions
                  </span>
                )}
              </div>
            </div>
            {!collapsedSections.terminology && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30 space-y-2.5">
                {termsList.length > 0 ? (
                  <div className="space-y-2">
                    {termsList.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 space-y-1"
                      >
                        <span className="font-semibold text-amber-400 text-xs">{t.term}</span>
                        <p className="text-zinc-400 text-[11px] leading-relaxed">{t.definition}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-xs italic">
                    Glossary terms defined in GLOSSARY.md.
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
                  — {epic.sections?.taskPlan || 'Directed Acyclic Graph of vertical tracer-bullet tasks'}
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
                                {blockedList.length > 0 && (
                                  <div className="text-zinc-500 flex items-center gap-1 flex-wrap">
                                    <span>Blocked by:</span>
                                    {blockedList.map((dep) => (
                                      <span
                                        key={dep}
                                        className="px-1 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60"
                                      >
                                        {dep}
                                      </span>
                                    ))}
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
