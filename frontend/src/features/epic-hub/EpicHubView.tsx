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
  BookOpen,
} from 'lucide-react';
import { FileDropZone } from '../../components/common/FileDropZone';
import {
  getEpicFeatures,
  type FeatureTask,
} from '../feature-task-data';

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

// Specs definitions for ec-core
const coreSpecsList = [
  {
    id: 'spec-ft-core-host-runtime',
    title: 'Host Runtime & Local HTTP/WebSocket Server',
    status: 'Completed',
    reqs: 10,
    seam: 'crates/aico-server/src/server.rs',
  },
  {
    id: 'spec-ft-core-security-auth',
    title: 'LAN Security & Local Authentication',
    status: 'Completed',
    reqs: 8,
    seam: 'crates/aico-server/src/auth.rs',
  },
  {
    id: 'spec-ft-core-local-storage',
    title: 'Local Storage & Embedded Engine Lifecycle',
    status: 'Completed',
    reqs: 8,
    seam: 'crates/aico-storage/src/embedded.rs',
  },
  {
    id: 'spec-ft-core-discovery',
    title: 'Workspace & Multi-Project Discovery',
    status: 'Completed',
    reqs: 11,
    seam: 'crates/aico-core/src/scanner.rs',
  },
  {
    id: 'spec-ft-core-mcp-tools',
    title: 'Deterministic SDD Tool Registration',
    status: 'Completed',
    reqs: 9,
    seam: 'crates/aico-mcp/src/registry.rs',
  },
  {
    id: 'spec-ft-core-webui-shell',
    title: 'WebUI Workspace Shell & Dockable Layout',
    status: 'In Progress',
    reqs: 13,
    seam: 'frontend/src/components/layout/ShellLayout.tsx',
  },
  {
    id: 'spec-ft-core-epic-hub',
    title: 'Single-Page Epic Hub & Lineage Graph',
    status: 'In Progress',
    reqs: 11,
    seam: 'frontend/src/features/epic-hub/EpicHubView.tsx',
  },
];

const specsSpecsList = [
  {
    id: 'spec-ft-specs-blueprint-standards',
    title: 'AICO SDD Blueprint Standards v0.1.2',
    status: 'Completed',
    reqs: 8,
    seam: 'aico-specs/adr/0010.md',
  },
  {
    id: 'spec-ft-specs-skills-evolution',
    title: 'Skills Suite Evolution & Triage System',
    status: 'Completed',
    reqs: 6,
    seam: 'skills/aico-start/SKILL.md',
  },
  {
    id: 'spec-ft-specs-migration-engine',
    title: 'SDD v0.1.1 to v0.1.2 Migration Engine',
    status: 'Completed',
    reqs: 6,
    seam: 'skills/aico-spec-migration/SKILL.md',
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

  const isSpecsEpic = epic.id.toLowerCase() === 'ec-specs' || epic.id === '002-aico-specs';
  const currentEpicId = isSpecsEpic ? 'ec-specs' : 'ec-core';
  const currentFeaturesList = getEpicFeatures(currentEpicId);
  const currentSpecsList = isSpecsEpic ? specsSpecsList : coreSpecsList;

  // Compute overall task plan progress across all features in this epic
  const allTasks: FeatureTask[] = currentFeaturesList.flatMap((f) => f.tasks);
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === 'Done').length;
  const overallPercentage = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Epic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm px-2.5 py-1 rounded-md bg-indigo-950 text-indigo-400 border border-indigo-800/80 font-bold uppercase tracking-wide">
              {epic.id}
            </span>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                epic.status === 'Completed'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'
                  : 'bg-amber-950 text-amber-400 border border-amber-800/80'
              }`}
            >
              {epic.status}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              [{epic.verifiedCount}/{epic.totalCount} Verified]
            </span>
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
          <div className="p-5 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30">
            {/* Executive Summary */}
            <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800">
              <h4 className="text-xs font-semibold text-zinc-200 mb-1">Executive Summary</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Autonomous Intelligent Code Orchestrator (AICO) delivers a zero-daemon, local-first
                Spec-Driven Development (SDD) environment. Embedded LanceDB and Kùzu engines, deterministic
                MCP tool gates, and strict EARS contracts guarantee architectural consistency and zero cloud amnesia.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2-COLUMN SECTION: Left = Features, Brainstorm, Specs, Deep Dive, Terminology, Assets | Right = Task Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN (All Closed by Default) */}
        <div className="space-y-3">
          {/* Features in this Epic Accordion */}
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
                    — Component feature bundles and specifications
                  </span>
                )}
              </div>
            </div>
            {!collapsedSections.features && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {currentFeaturesList.map((feat) => (
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
                  Ubiquitous Domain Terminology
                </span>
                {collapsedSections.terminology && (
                  <span className="text-xs text-zinc-500 truncate ml-2 italic">
                    — Local-First SDD, EARS Syntax, Tracer Bullets, Test Seams
                  </span>
                )}
              </div>
            </div>
            {!collapsedSections.terminology && (
              <div className="p-4 text-xs text-zinc-300 border-t border-zinc-800/80 bg-zinc-950/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
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

              {/* Sequential Feature Task Groups with Individual Progress Bars and Internal Waves */}
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
                {currentFeaturesList.map((feat) => {
                  const featTotal = feat.tasks.length;
                  const featDone = feat.tasks.filter((t) => t.status === 'Done').length;
                  const featPct = featTotal > 0 ? Math.round((featDone / featTotal) * 100) : 100;

                  return (
                    <div
                      key={feat.id}
                      className="p-4 bg-zinc-900/70 rounded-xl border border-zinc-800/90 space-y-3.5"
                    >
                      {/* Feature Task Header & Dedicated Progress Bar */}
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

                      {/* Tasks in this Feature with Internal Waves */}
                      <div className="space-y-3 pt-1">
                        {feat.tasks.map((task) => {
                          const taskWavesTotal = task.waves.length;
                          const taskWavesDone = task.waves.filter((w) => w.status === 'Done').length;
                          const taskPct =
                            taskWavesTotal > 0
                              ? Math.round((taskWavesDone / taskWavesTotal) * 100)
                              : task.status === 'Done'
                              ? 100
                              : 0;

                          return (
                            <div
                              key={task.id}
                              className="p-3 bg-zinc-950/70 rounded-lg border border-zinc-800/70 space-y-2.5"
                            >
                              {/* Task Header */}
                              <div className="space-y-1">
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
                                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                    }`}
                                  >
                                    {task.status}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                                  <span>Seam: {task.seam || 'N/A'}</span>
                                  <span>
                                    {taskWavesDone}/{taskWavesTotal} Waves ({taskPct}%)
                                  </span>
                                </div>
                                <div className="w-full bg-zinc-900 rounded-full h-1 overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-full rounded-full transition-all duration-200"
                                    style={{ width: `${taskPct}%` }}
                                  />
                                </div>
                              </div>

                              {/* Internal Waves inside this Task */}
                              <div className="space-y-1.5 pl-2 border-l border-zinc-800/80">
                                {task.waves.map((wave) => (
                                  <div
                                    key={wave.waveNumber}
                                    className="flex items-start justify-between gap-2 text-[11px]"
                                  >
                                    <div className="space-y-0.5 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                            wave.stage === 'Scaffolding'
                                              ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50'
                                              : wave.stage === 'Implementation'
                                              ? 'bg-sky-950/80 text-sky-300 border border-sky-800/50'
                                              : wave.stage === 'Verification'
                                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                                              : 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                                          }`}
                                        >
                                          {wave.name}
                                        </span>
                                        <span className="text-zinc-300 text-[11px] truncate">
                                          {wave.description}
                                        </span>
                                      </div>
                                    </div>
                                    <span
                                      className={`text-[9px] font-mono px-1 py-0.2 rounded shrink-0 ${
                                        wave.status === 'Done'
                                          ? 'text-emerald-400'
                                          : wave.status === 'In Progress'
                                          ? 'text-amber-400'
                                          : 'text-zinc-500'
                                      }`}
                                    >
                                      {wave.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
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
