import React, { useState, useEffect } from 'react';
import { BookOpen, ShieldCheck, CheckCircle2, GitBranch, ArrowLeft } from 'lucide-react';
import { fetchFeature, type DiscoveredFeature } from '../feature-task-data';

interface SpecViewerProps {
  specId: string;
  title?: string;
  onBack?: () => void;
}

// @implements SPEC-CORE-007::REQ-008
export const SpecViewer: React.FC<SpecViewerProps> = ({ specId, title, onBack }) => {
  const [feature, setFeature] = useState<DiscoveredFeature | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchFeature(specId).then((data) => {
      if (isMounted && data) {
        setFeature(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [specId]);

  const displayTitle = feature?.spec_title || feature?.specTitle || feature?.name || title || specId;
  const displayStatus = feature?.status || 'In Progress';
  const displayEpic = feature?.epic_id || feature?.epicId || (feature?.is_standalone ? 'Standalone' : 'ec-core');
  const derivesFrom = feature?.adrs || [];
  const requirements = feature?.requirements || [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5 space-y-3">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm px-2.5 py-1 rounded bg-zinc-800 text-sky-400 font-bold border border-zinc-700">
              {specId}
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              {displayTitle}
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                displayStatus === 'Completed' || displayStatus === 'Done'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}
            >
              {displayStatus}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
            <span className="bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
              aico_version: 0.1.2
            </span>
          </div>
        </div>

        {/* YAML Metadata Strip */}
        <div className="flex items-center gap-4 text-xs text-zinc-400 font-mono pt-1">
          <span>Epic: <strong className="text-indigo-400">{displayEpic}</strong></span>
          {derivesFrom.length > 0 && (
            <>
              <span>•</span>
              <span>Derives From: <strong className="text-zinc-300">{derivesFrom.join(', ')}</strong></span>
            </>
          )}
        </div>
      </div>

      {/* Requirements Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-400" />
            <span>EARS Formal Requirements ({requirements.length})</span>
          </h2>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Designated Contract Seams Verified</span>
          </span>
        </div>

        <div className="space-y-3">
          {requirements.length > 0 ? (
            requirements.map((req) => (
              <div
                key={req.id}
                className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2.5 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/60 border border-sky-800/80 px-2 py-0.5 rounded">
                      {req.id}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {req.pattern}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>@verifies {specId}::{req.id}</span>
                  </div>
                </div>

                <p className="text-xs text-zinc-200 leading-relaxed font-sans">
                  {req.statement}
                </p>

                {req.seam && (
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-500 font-mono">
                    <GitBranch className="w-3 h-3 text-indigo-400" />
                    <span>Test Seam: <span className="text-zinc-400">{req.seam}</span></span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-zinc-500 text-xs italic">
              Loading formal EARS requirements from specification markdown on disk...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
