import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { fetchAdr, type DiscoveredAdr } from '../feature-task-data';
import { MarkdownToggleButton } from '../../components/common/MarkdownToggleButton';
import { MarkdownView } from '../../components/common/MarkdownView';

export interface AdrViewerProps {
  adrId: string;
  onOpenEpic?: (epicId: string, title?: string) => void;
  onOpenFeature?: (featureId: string, title?: string) => void;
}

// @implements spec-ft-core-epic-hub::REQ-008
export const AdrViewer: React.FC<AdrViewerProps> = ({ adrId }) => {
  const [adr, setAdr] = useState<DiscoveredAdr | null>(null);
  const [viewRawMarkdown, setViewRawMarkdown] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    fetchAdr(adrId).then((data) => {
      if (isMounted) {
        setAdr(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [adrId]);

  const displayTitle = adr?.title || `${adrId}: Architecture Decision Record`;
  const displayStatus = adr?.status || 'Accepted';
  const displayContext = adr?.context || 'Architectural rationale and requirements background.';
  const displayDecision = adr?.decision || `Approved architectural decision for ${adrId}.`;
  const displayConsequences = adr?.consequences || 'Maintains modularity and designated contract test seams.';

  const rawMarkdown = `---
id: ${adr?.id || adrId}
title: "${displayTitle}"
status: ${displayStatus}
aico_version: "0.1.2"
---

# ${displayTitle}

## Context
${displayContext}

## Decision
${displayDecision}

## Consequences
${displayConsequences}
`;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5 space-y-3">
        {/* TOP ROW: ADR Tag + Title on Left | Status & aico_version on Right */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              data-testid="adr-viewer-id"
              className="font-mono text-sm px-2.5 py-1 rounded bg-amber-950/70 text-amber-400 font-bold border border-amber-800/80 flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>{adr?.id || adrId}</span>
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              {displayTitle}
            </h1>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`text-xs px-3 py-1 rounded-full font-mono font-semibold ${
                displayStatus === 'Accepted' || displayStatus === 'Completed' || displayStatus === 'Done'
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

        {/* SECOND ROW: Metadata Info on Left | Markdown Toggle Button on Right */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2.5 text-xs text-zinc-400 font-mono flex-wrap">
            <span>Type:</span>
            <span className="text-amber-400 font-semibold">Architecture Decision Record</span>
          </div>

          <MarkdownToggleButton
            active={viewRawMarkdown}
            onClick={() => setViewRawMarkdown((prev) => !prev)}
          />
        </div>
      </div>

      {viewRawMarkdown ? (
        <div className="p-5 bg-zinc-900/60 rounded-xl border border-zinc-800">
          <MarkdownView content={rawMarkdown} />
        </div>
      ) : (
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1.5">
            <h3 className="font-semibold text-zinc-300 uppercase tracking-wider text-[11px]">Context</h3>
            <p className="text-zinc-400 leading-relaxed font-sans">{displayContext}</p>
          </div>

          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1.5">
            <h3 className="font-semibold text-indigo-400 uppercase tracking-wider text-[11px]">Decision</h3>
            <p className="text-zinc-200 leading-relaxed font-sans font-medium">{displayDecision}</p>
          </div>

          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1.5">
            <h3 className="font-semibold text-emerald-400 uppercase tracking-wider text-[11px]">Consequences</h3>
            <p className="text-zinc-400 leading-relaxed font-sans">{displayConsequences}</p>
          </div>
        </div>
      )}
    </div>
  );
};
