import React from 'react';
import {
  Layers,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Activity,
} from 'lucide-react';

interface DashboardViewProps {
  onOpenEpic: (epicId: string) => void;
  onOpenSpec: (specId: string, title: string) => void;
}

// @implements SPEC-CORE-007::REQ-001
// @implements SPEC-CORE-007::REQ-002
// @implements SPEC-CORE-007::REQ-007
export const DashboardView: React.FC<DashboardViewProps> = ({ onOpenEpic, onOpenSpec }) => {
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
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Discovered Epics</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100">2</div>
          <div className="text-[11px] text-zinc-500">ec-core & ec-specs</div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Formal Specifications</span>
            <BookOpen className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100">10</div>
          <div className="text-[11px] text-zinc-500">Strict EARS Syntax & Tags</div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Active DAG Frontier</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100">7</div>
          <div className="text-[11px] text-zinc-500">6-State Non-Destructive Tasks</div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Designated Test Seams</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">34 / 34</div>
          <div className="text-[11px] text-zinc-500">Automated Contract Tests</div>
        </div>
      </div>

      {/* Epics Progress Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Project Epics
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {/* ec-core Card */}
          <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-4 hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-indigo-400 font-semibold">
                    ec-core
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-amber-950 text-amber-400 border border-amber-800">
                    In Progress
                  </span>
                </div>
                <h3 className="text-base font-bold text-zinc-100 mt-2">
                  AICO Core SDD Platform
                </h3>
              </div>
              <button
                onClick={() => onOpenEpic('ec-core')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
              >
                <span>Open Epic</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Host runtime, Axum local HTTP/WS daemon, LAN authentication, embedded LanceDB
              and Kùzu graph lifecycle, and WebUI shell with dockable terminals.
            </p>

            <div className="space-y-1.5 pt-2 border-t border-zinc-800">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Specifications (7)</span>
                <span className="font-mono text-emerald-400">100% Contract Covered</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'spec-core-host-runtime',
                  'spec-core-security-auth',
                  'spec-core-local-storage',
                  'spec-core-discovery',
                  'spec-core-mcp-tools',
                  'spec-core-webui-shell',
                  'spec-core-epic-hub'
                ].map((s) => (
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

          {/* ec-specs Card */}
          <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-4 hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-indigo-400 font-semibold">
                    ec-specs
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                    Completed
                  </span>
                </div>
                <h3 className="text-base font-bold text-zinc-100 mt-2">
                  AICO SDD Blueprints & Migration
                </h3>
              </div>
              <button
                onClick={() => onOpenEpic('ec-specs')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
              >
                <span>Open Epic</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Standardization of SDD artifacts to version 0.1.2, universal YAML line-1 frontmatter with order,
              standalone features support, relative path linking, and wave-internal task lifecycle.
            </p>

            <div className="space-y-1.5 pt-2 border-t border-zinc-800">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Specifications (3)</span>
                <span className="font-mono text-emerald-400">100% Contract Covered</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'spec-specs-blueprint-standards',
                  'spec-specs-skills-evolution',
                  'spec-specs-migration-engine'
                ].map((s) => (
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
        </div>
      </div>

      {/* Active DAG Frontier & System Diagnostics */}
      <div className="grid grid-cols-3 gap-4">
        {/* Active Frontier */}
        <div className="col-span-2 p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Active Task Frontier
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
              Tracer Bullets Active
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="font-mono text-indigo-400 font-semibold block">TASK-CORE-006-8</span>
                <span className="text-zinc-300">Sidebar search with persistent scopes & activity stats</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">Done</span>
            </div>

            <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="font-mono text-indigo-400 font-semibold block">TASK-CORE-006-9</span>
                <span className="text-zinc-300">Multi-tab Terminals dock with tab creation</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">Done</span>
            </div>

            <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="font-mono text-indigo-400 font-semibold block">TASK-CORE-007-7</span>
                <span className="text-zinc-300">Workspace Home / Dashboard view with multi-epic progress</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">Done</span>
            </div>
          </div>
        </div>

        {/* Embedded Host Health */}
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
