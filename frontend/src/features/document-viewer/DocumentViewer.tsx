import React, { useState, useEffect } from 'react';
import { Layers, GitFork } from 'lucide-react';
import { fetchFeature, fetchEpic, type DiscoveredFeature, type DiscoveredEpic } from '../feature-task-data';
import { MarkdownView, stripDocumentHeader } from '../../components/common/MarkdownView';
import { TagBadge } from '../../components/common/TagBadge';
import { MarkdownToggleButton } from '../../components/common/MarkdownToggleButton';

export interface DocumentViewerProps {
  docId: string;
  docType: 'brainstorm' | 'deep_dive';
  title?: string;
  onOpenEpic?: (epicId: string, title?: string) => void;
  onOpenFeature?: (featureId: string, title?: string) => void;
  onOpenSpec?: (specId: string, title?: string) => void;
  onOpenPlan?: (planId: string, title?: string) => void;
  onOpenAdr?: (adrId: string) => void;
  onBack?: () => void;
}

// @implements spec-ft-core-epic-hub::REQ-001
// @implements spec-ft-core-epic-hub::REQ-004
export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  docId,
  docType,
  title,
  onOpenEpic,
  onOpenFeature,
}) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [featureData, setFeatureData] = useState<DiscoveredFeature | null>(null);
  const [epicData, setEpicData] = useState<DiscoveredEpic | null>(null);
  const [viewRawMarkdown, setViewRawMarkdown] = useState<boolean>(false);

  // Extract base identifier (e.g., 'brainstorm-ft-fast-trace' -> 'ft-fast-trace')
  const baseId = docId
    .replace(/^brainstorm-/, '')
    .replace(/^deepdive-/, '')
    .replace(/-brainstorm$/, '')
    .replace(/-deepdive$/, '');

  const isFeature = baseId.startsWith('ft-');
  const isEpic = baseId.startsWith('ec-');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadDoc = async () => {
      // 1. Try feature
      const feat = await fetchFeature(baseId);
      if (feat && isMounted) {
        setFeatureData(feat);
        const raw =
          docType === 'brainstorm'
            ? feat.brainstorm_content || feat.brainstormContent
            : feat.deepdive_content || feat.deepdiveContent;
        if (raw) {
          setContent(raw);
          setLoading(false);
          return;
        }
      }

      // 2. Try epic
      const ep = await fetchEpic(baseId);
      if (ep && isMounted) {
        setEpicData(ep);
        const raw =
          docType === 'brainstorm'
            ? ep.brainstorm_content || ep.brainstormContent
            : ep.deepdive_content || ep.deepdiveContent;
        if (raw) {
          setContent(raw);
          setLoading(false);
          return;
        }
      }

      if (isMounted) {
        setContent(null);
        setLoading(false);
      }
    };

    loadDoc();
    return () => {
      isMounted = false;
    };
  }, [baseId, docType]);

  const displayTitle =
    title ||
    (docType === 'brainstorm'
      ? `Brainstorm: ${featureData?.name || epicData?.title || baseId}`
      : `Deep Dive: ${featureData?.name || epicData?.title || baseId}`);

  const displayStatus =
    featureData?.status ||
    epicData?.status ||
    'Completed';

  const epicId =
    featureData?.epic_id ||
    featureData?.epicId ||
    (featureData?.is_standalone ? undefined : 'ec-core');

  const displayContent = content ? stripDocumentHeader(content) : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5 space-y-3">
        {/* TOP ROW: Document Type Badge + Title on Left | Status & aico_version on Right */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              data-testid="doc-viewer-type"
              className="font-mono text-sm px-2.5 py-1 rounded bg-zinc-800 text-indigo-400 font-bold border border-zinc-700 flex items-center gap-1.5"
            >
              {docType === 'brainstorm' ? (
                <Layers className="w-4 h-4 text-indigo-400" />
              ) : (
                <GitFork className="w-4 h-4 text-indigo-400" />
              )}
              <span>{docType === 'brainstorm' ? 'BRAINSTORM' : 'DEEP DIVE'}</span>
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
            {isFeature && (
              <>
                <div className="flex items-center gap-1.5">
                  <span>Feature:</span>
                  <TagBadge
                    id={baseId}
                    onClick={onOpenFeature ? () => onOpenFeature(baseId) : undefined}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span>•</span>
                  <span>Epic:</span>
                  {epicId ? (
                    <TagBadge
                      id={epicId}
                      onClick={onOpenEpic ? () => onOpenEpic(epicId) : undefined}
                    />
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-purple-950/70 text-purple-400 border border-purple-800">
                      Standalone
                    </span>
                  )}
                </div>
              </>
            )}

            {isEpic && (
              <div className="flex items-center gap-1.5">
                <span>Epic:</span>
                <TagBadge
                  id={baseId}
                  onClick={onOpenEpic ? () => onOpenEpic(baseId) : undefined}
                />
              </div>
            )}

            {!isFeature && !isEpic && (
              <div className="flex items-center gap-1.5">
                <span>Target:</span>
                <TagBadge id={baseId} />
              </div>
            )}
          </div>

          {/* View Markdown Document Toggle Button (with Markdown icon) */}
          {content && (
            <MarkdownToggleButton
              active={viewRawMarkdown}
              onClick={() => setViewRawMarkdown((prev) => !prev)}
            />
          )}
        </div>
      </div>

      {/* Document Content */}
      <div className="p-5 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-4">
        {loading ? (
          <p className="text-zinc-400 text-xs italic">Loading document artifact...</p>
        ) : viewRawMarkdown && content ? (
          <pre className="font-mono text-xs whitespace-pre-wrap bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-zinc-300 overflow-x-auto">
            {content}
          </pre>
        ) : displayContent ? (
          <MarkdownView content={displayContent} />
        ) : (
          <div className="py-8 text-center space-y-2">
            <p className="text-zinc-400 text-sm font-medium">
              No {docType === 'brainstorm' ? 'brainstorm' : 'deep dive'} artifact found for {baseId}.
            </p>
            <p className="text-zinc-500 text-xs">
              Expected artifact: {docType === 'brainstorm' ? `brain-${baseId}.md` : `deepdive-${baseId}.md`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
