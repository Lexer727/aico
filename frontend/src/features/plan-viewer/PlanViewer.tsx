import React, { useState, useEffect, useMemo } from 'react';
import { CheckSquare, GitFork, BookOpen, Layers } from 'lucide-react';
import {
  fetchFeature,
  fetchAllFeatures,
  extractTaskId,
  type FeatureTask,
  type DiscoveredFeature,
  isTaskDone,
} from '../feature-task-data';
import { MarkdownView, InlineMarkdown } from '../../components/common/MarkdownView';
import { TagBadge } from '../../components/common/TagBadge';
import { MarkdownToggleButton } from '../../components/common/MarkdownToggleButton';

export interface PlanViewerProps {
  planId: string;
  title?: string;
  allFeatures?: DiscoveredFeature[];
  onOpenEpic?: (epicId: string, title?: string) => void;
  onOpenFeature?: (featureId: string, title?: string) => void;
  onOpenSpec?: (specId: string, title?: string) => void;
  onOpenAdr?: (adrId: string) => void;
  onBack?: () => void;
}

// @implements ft-core-epic-hub::TASK-CORE-007-12::REQ-004
// @implements ft-specs-blueprint-standards::TASK-SPECS-001-3::REQ-004
// @implements ft-specs-blueprint-standards::TASK-SPECS-001-3::REQ-010
export const PlanViewer: React.FC<PlanViewerProps> = ({
  planId,
  title,
  allFeatures,
  onOpenEpic,
  onOpenFeature,
  onOpenSpec,
  onOpenAdr,
}) => {
  const [feature, setFeature] = useState<DiscoveredFeature | null>(null);
  const [viewRawMarkdown, setViewRawMarkdown] = useState<boolean>(false);
  const [loadedFeatures, setLoadedFeatures] = useState<DiscoveredFeature[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetchFeature(planId).then((data) => {
      if (isMounted && data) {
        setFeature(data);
      }
    });

    if (!allFeatures || allFeatures.length === 0) {
      fetchAllFeatures().then((data) => {
        if (isMounted && data && data.length > 0) {
          setLoadedFeatures(data);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [planId, allFeatures]);

  const displayTitle = feature?.plan_title || feature?.planTitle || feature?.name || title || planId;
  const displayStatus = feature?.status || 'In Progress';
  const displayEpic = feature?.epic_id || feature?.epicId || (feature?.is_standalone ? 'Standalone' : 'ec-core');
  const featureId = feature?.id || (planId.startsWith('plan-') ? planId.replace(/^plan-/, '') : undefined);
  const specId = feature?.spec_id || feature?.specId || (featureId ? `spec-${featureId}` : undefined);
  const derivesFrom = feature?.adrs || [];
  const tasksList: FeatureTask[] = feature?.tasks || [];
  const totalTasks = tasksList.length;
  const doneTasks = tasksList.filter((t) => isTaskDone(t)).length;
  const taskProgressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;
  const rawContent = feature?.raw_plan_content || feature?.rawPlanContent;

  const effectiveAllFeatures = (allFeatures && allFeatures.length > 0) ? allFeatures : loadedFeatures;

  const tasksMap = useMemo(() => {
    const map: Record<string, FeatureTask> = {};
    if (effectiveAllFeatures && effectiveAllFeatures.length > 0) {
      effectiveAllFeatures.forEach((f) => {
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
  }, [effectiveAllFeatures, tasksList]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5 space-y-3">
        {/* TOP ROW: Plan Tag + Title on Left | Status Badge & aico_version on Right */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              data-testid="plan-viewer-id"
              className="font-mono text-sm px-2.5 py-1 rounded bg-emerald-950/70 text-emerald-400 font-bold border border-emerald-800/80"
            >
              {planId}
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
              aico_version: 0.1.2
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

            {/* Spec Tag */}
            {specId && (
              <div className="flex items-center gap-1.5">
                <span>•</span>
                <span>Spec:</span>
                <TagBadge
                  id={specId}
                  onClick={onOpenSpec ? () => onOpenSpec(specId) : undefined}
                />
              </div>
            )}

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

            {/* Tasks Progress Bar */}
            <div className="flex items-center gap-2 pl-2">
              <span>•</span>
              <span className="text-zinc-300">
                <strong className="text-emerald-400">{doneTasks}/{totalTasks}</strong> Done ({taskProgressPct}%)
              </span>
              <div className="w-24 bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-800 shrink-0">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${taskProgressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* View Markdown Document Toggle Button (with Markdown icon) */}
          {rawContent && (
            <MarkdownToggleButton
              active={viewRawMarkdown}
              onClick={() => setViewRawMarkdown((prev) => !prev)}
            />
          )}
        </div>
      </div>

      {viewRawMarkdown && rawContent ? (
        <div className="p-5 bg-zinc-900/60 rounded-xl border border-zinc-800">
          <MarkdownView content={rawContent} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Implementation Tasks Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                <span>Implementation Tasks DAG ({totalTasks})</span>
              </h2>
              <span className="text-[11px] font-mono text-zinc-400">
                Vertical Tracer-Bullet Tasks with Explicit Dependencies
              </span>
            </div>

            <div className="space-y-3">
              {tasksList.length > 0 ? (
                tasksList.map((task) => {
                  const blockedList = task.blocked_by || task.blockedBy || [];
                  const addressesList = task.addresses || [];
                  const deliverablesList = task.deliverables || [];

                  // Check if all blockers are resolved (Done or Completed)
                  const isAllResolved = blockedList.every((dep) => {
                    const depUpper = dep.trim().toUpperCase();
                    if (!depUpper || depUpper === 'NONE' || depUpper.startsWith('NONE')) return true;
                    const taskId = extractTaskId(dep);
                    const blocker = taskId
                      ? tasksMap[taskId] || tasksMap[taskId.toLowerCase()]
                      : tasksMap[depUpper] || tasksMap[dep.trim().toLowerCase()];
                    return blocker && isTaskDone(blocker);
                  });

                  return (
                    <div
                      key={task.id}
                      className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-xs font-bold text-indigo-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                            {task.id}
                          </span>
                          <h3 className="text-sm font-semibold text-zinc-100 truncate">
                            {task.title}
                          </h3>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono shrink-0 font-semibold ${
                            isTaskDone(task.status)
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

                      {/* Metadata: Seam, Addresses, Dependencies */}
                      <div className="space-y-1.5 text-xs font-mono text-zinc-400 pt-1">
                        {task.seam && (
                          <div className="flex items-center gap-1.5 text-zinc-400">
                            <GitFork className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>Verification Seam: <span className="text-emerald-400">{task.seam}</span></span>
                          </div>
                        )}

                        {addressesList.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <BookOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span className="text-zinc-500">Addresses:</span>
                            {addressesList.map((addr) => (
                              <button
                                key={addr}
                                type="button"
                                onClick={specId && onOpenSpec ? () => onOpenSpec(specId) : undefined}
                                className="px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/60 text-[10px] hover:bg-sky-900/80 cursor-pointer transition-colors"
                                title="Click to view specification"
                              >
                                {addr}
                              </button>
                            ))}
                          </div>
                        )}

                        {blockedList.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-zinc-500">
                              {isAllResolved ? 'Depends on:' : 'Blocked by:'}
                            </span>
                            {blockedList.map((dep) => {
                              const depUpper = dep.trim().toUpperCase();
                              const isNone = !depUpper || depUpper === 'NONE' || depUpper.startsWith('NONE');
                              const taskId = extractTaskId(dep);
                              const blocker = taskId
                                ? tasksMap[taskId] || tasksMap[taskId.toLowerCase()]
                                : tasksMap[depUpper] || tasksMap[dep.trim().toLowerCase()];
                              const isResolved =
                                isNone ||
                                (blocker && isTaskDone(blocker));

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
                      {/* @implements ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-8::REQ-011 */}
                      {deliverablesList.length > 0 && (
                        <div className="pt-2 border-t border-zinc-800/60 space-y-1">
                          <span className="text-[11px] font-semibold text-zinc-300 block">
                            What it delivers:
                          </span>
                          <ul className="list-disc list-inside text-zinc-400 text-xs space-y-0.5">
                            {deliverablesList.map((deliv, idx) => (
                              <InlineMarkdown key={idx} as="li" content={deliv} />
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-zinc-500 text-xs italic">
                  Loading implementation plan tasks from disk...
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
