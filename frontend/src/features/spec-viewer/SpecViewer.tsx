import React, { useState, useEffect } from 'react';
import { BookOpen, ShieldCheck, CheckCircle2, GitBranch, Crosshair, GitFork } from 'lucide-react';
import { fetchFeature, type DiscoveredFeature } from '../feature-task-data';
import { MarkdownView } from '../../components/common/MarkdownView';
import { TagBadge } from '../../components/common/TagBadge';
import { MarkdownToggleButton } from '../../components/common/MarkdownToggleButton';

export interface SpecViewerProps {
  specId: string;
  title?: string;
  onOpenEpic?: (epicId: string, title?: string) => void;
  onOpenFeature?: (featureId: string, title?: string) => void;
  onOpenAdr?: (adrId: string) => void;
  onOpenPlan?: (planId: string, title?: string) => void;
  onBack?: () => void;
}

// @implements ft-core-epic-hub::TASK-CORE-007-3::REQ-008
// @implements ft-specs-blueprint-standards::TASK-SPECS-001-1::REQ-001
// @implements ft-specs-blueprint-standards::TASK-SPECS-001-1::REQ-008
export const SpecViewer: React.FC<SpecViewerProps> = ({
  specId,
  title,
  onOpenEpic,
  onOpenFeature,
  onOpenAdr,
  onOpenPlan,
}) => {
  const [feature, setFeature] = useState<DiscoveredFeature | null>(null);
  const [viewRawMarkdown, setViewRawMarkdown] = useState<boolean>(false);

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
  const featureId = feature?.id || (specId.startsWith('spec-') ? specId.replace(/^spec-/, '') : undefined);
  const derivesFrom = feature?.adrs || [];
  const requirements = feature?.requirements || [];
  const inScopeList = feature?.in_scope || feature?.inScope || [];
  const outOfScopeList = feature?.out_of_scope || feature?.outOfScope || [];
  const testSeamsList = feature?.test_seams || feature?.testSeams || [];
  const rawSpecContent = feature?.raw_spec_content || feature?.rawSpecContent;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5 space-y-3">
        {/* TOP ROW: Spec Tag + Title on Left | Status Badge & aico_version on Right */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              data-testid="spec-viewer-id"
              className="font-mono text-sm px-2.5 py-1 rounded bg-sky-950/70 text-sky-400 font-bold border border-sky-800/80"
            >
              {specId}
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              {displayTitle}
            </h1>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`text-xs px-3 py-1 rounded-full font-mono font-semibold ${
                displayStatus === 'Completed' || displayStatus === 'Done'
                  ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950/70 text-amber-400 border border-amber-800'
              }`}
            >
              {displayStatus}
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              aico_skills_version: 0.1.2
            </span>
          </div>
        </div>

        {/* SECOND ROW: Metadata Clickable Tags on Left | Markdown Toggle Button on Right */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2.5 text-xs text-zinc-400 font-mono flex-wrap">
            {/* Feature Tag */}
            {featureId && (
              <div className="flex items-center gap-1.5">
                <span>Feature:</span>
                <TagBadge
                  id={featureId}
                  onClick={onOpenFeature ? () => onOpenFeature(featureId) : undefined}
                />
              </div>
            )}

            {/* Epic Tag */}
            <div className="flex items-center gap-1.5">
              {featureId && <span>•</span>}
              <span>Epic:</span>
              {displayEpic && displayEpic !== 'Standalone' ? (
                <TagBadge
                  id={displayEpic}
                  onClick={onOpenEpic ? () => onOpenEpic(displayEpic) : undefined}
                />
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-purple-950/70 text-purple-400 border border-purple-800">
                  Standalone
                </span>
              )}
            </div>

            {/* Plan Tag if available */}
            {feature?.planId || feature?.plan_id ? (
              <div className="flex items-center gap-1.5">
                <span>•</span>
                <span>Plan:</span>
                <TagBadge
                  id={feature.planId || feature.plan_id || `plan-${featureId}`}
                  onClick={
                    onOpenPlan
                      ? () => onOpenPlan(feature.planId || feature.plan_id || `plan-${featureId}`)
                      : undefined
                  }
                />
              </div>
            ) : null}

            {/* Derives From / ADR Tags */}
            {derivesFrom.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span>•</span>
                <span>Derives From:</span>
                {derivesFrom.map((adr) => (
                  <TagBadge
                    key={adr}
                    id={adr}
                    onClick={onOpenAdr ? () => onOpenAdr(adr) : undefined}
                  />
                ))}
              </div>
            )}
          </div>

          {/* View Markdown Document Toggle Button (with Markdown icon) */}
          {rawSpecContent && (
            <MarkdownToggleButton
              active={viewRawMarkdown}
              onClick={() => setViewRawMarkdown((prev) => !prev)}
            />
          )}
        </div>
      </div>

      {viewRawMarkdown && rawSpecContent ? (
        <div className="p-5 bg-zinc-900/60 rounded-xl border border-zinc-800">
          <MarkdownView content={rawSpecContent} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Scope Boundaries */}
          {(inScopeList.length > 0 || outOfScopeList.length > 0) && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-indigo-400" />
                <span>Scope Boundaries</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
                  <span className="font-semibold text-indigo-400 text-xs block">
                    In-Scope Boundaries ({inScopeList.length})
                  </span>
                  {inScopeList.length > 0 ? (
                    <ul className="list-disc list-inside text-zinc-300 text-xs leading-relaxed space-y-1">
                      {inScopeList.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-zinc-500 text-xs italic">No explicit in-scope items recorded.</p>
                  )}
                </div>
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
                  <span className="font-semibold text-amber-400 text-xs block">
                    Out-of-Scope Boundaries ({outOfScopeList.length})
                  </span>
                  {outOfScopeList.length > 0 ? (
                    <ul className="list-disc list-inside text-zinc-300 text-xs leading-relaxed space-y-1">
                      {outOfScopeList.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-zinc-500 text-xs italic">No explicit out-of-scope items recorded.</p>
                  )}
                </div>
              </div>
            </div>
          )}

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

          {/* Designated Public Test Seams */}
          {testSeamsList.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <GitFork className="w-4 h-4 text-emerald-400" />
                <span>Designated Public Test Seams ({testSeamsList.length})</span>
              </h2>
              <div className="space-y-2 text-xs font-mono text-zinc-400">
                {testSeamsList.map((seam, idx) => (
                  <div key={idx} className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800">
                    <span className="text-emerald-400 font-semibold">{seam.path}</span>
                    {seam.description && seam.description !== seam.path && (
                      <div className="text-zinc-400 text-xs mt-1 font-sans">{seam.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
