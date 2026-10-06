import React, { useState } from 'react';
import { BookOpen, CheckSquare, ShieldCheck, ArrowRight } from 'lucide-react';

export interface FeatureData {
  id: string; // e.g. "01-host-runtime"
  name: string;
  epicId: string;
  specId?: string;
  specTitle?: string;
  planId?: string;
  planTitle?: string;
  status: string;
  description?: string;
  tasks?: Array<{ id: string; title: string; status: string }>;
}

interface FeatureViewerProps {
  feature: FeatureData;
  onOpenSpec?: (specId: string, title: string) => void;
  onOpenPlan?: (planId: string, title: string) => void;
}

// @implements SPEC-CORE-007::REQ-001
// @implements SPEC-CORE-007::REQ-004
export const FeatureViewer: React.FC<FeatureViewerProps> = ({
  feature,
  onOpenSpec,
  onOpenPlan,
}) => {
  const [activeView, setActiveView] = useState<'overview' | 'spec' | 'plan'>('overview');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-zinc-800 text-indigo-400 font-bold border border-zinc-700">
              FEATURE: {feature.id}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                feature.status === 'Completed' || feature.status === 'Done'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}
            >
              {feature.status}
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 mt-2">
            {feature.name}
          </h1>
          <p className="text-xs text-zinc-400 font-mono">
            Epic: <span className="text-indigo-400">{feature.epicId}</span>
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
          <button
            onClick={() => setActiveView('overview')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              activeView === 'overview'
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveView('spec')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              activeView === 'spec'
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Specification
          </button>
          <button
            onClick={() => setActiveView('plan')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              activeView === 'plan'
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Task Plan
          </button>
        </div>
      </div>

      {/* Main Content */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          {/* Linked Artifacts Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Spec Card */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                  <BookOpen className="w-4 h-4" />
                  <span>Formal EARS Specification</span>
                </div>
                <span className="font-mono text-[10px] text-zinc-500">v0.1.1</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">
                  {feature.specId || 'SPEC-CORE'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {feature.specTitle || 'Contract Requirements & Seam Boundaries'}
                </p>
              </div>
              {feature.specId && onOpenSpec && (
                <button
                  onClick={() => onOpenSpec(feature.specId!, feature.specTitle || feature.specId!)}
                  className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium pt-1"
                >
                  <span>Open Spec in Tab</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Plan Card */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <CheckSquare className="w-4 h-4" />
                  <span>Implementation Plan</span>
                </div>
                <span className="font-mono text-[10px] text-zinc-500">6-State DAG</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">
                  {feature.planId || 'PLAN-CORE'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {feature.planTitle || 'Tracer-bullet execution roadmap'}
                </p>
              </div>
              {feature.planId && onOpenPlan && (
                <button
                  onClick={() => onOpenPlan(feature.planId!, feature.planTitle || feature.planId!)}
                  className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium pt-1"
                >
                  <span>Open Plan in Tab</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Feature Architecture Details */}
          <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-2 text-xs">
            <h3 className="font-semibold text-zinc-300 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Feature Invariants & Boundaries</span>
            </h3>
            <p className="text-zinc-400 leading-relaxed font-sans">
              Each feature encapsulates a cohesive domain capability with designated public seams.
              Specifications declare formal EARS requirements, and implementation plans track vertical
              tracer-bullet tasks with verified automated tests.
            </p>
          </div>
        </div>
      )}

      {activeView === 'spec' && (
        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-mono text-sky-400 font-bold">{feature.specId}</span>
            <span className="text-zinc-400">{feature.specTitle}</span>
          </div>
          <p className="text-zinc-300 leading-relaxed">
            EARS Specification defining requirements, verification seams, and system invariants.
          </p>
          {feature.specId && onOpenSpec && (
            <button
              onClick={() => onOpenSpec(feature.specId!, feature.specTitle || feature.specId!)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors"
            >
              Open Complete Specification Document
            </button>
          )}
        </div>
      )}

      {activeView === 'plan' && (
        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-mono text-emerald-400 font-bold">{feature.planId}</span>
            <span className="text-zinc-400">{feature.planTitle}</span>
          </div>
          <p className="text-zinc-300 leading-relaxed">
            Task execution DAG tracking vertical tracer-bullet tasks, prerequisites, and automated seam tests.
          </p>
        </div>
      )}
    </div>
  );
};
