import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { fetchAdr, type DiscoveredAdr } from '../feature-task-data';

interface AdrViewerProps {
  adrId: string;
}

// @implements SPEC-CORE-007::REQ-008
export const AdrViewer: React.FC<AdrViewerProps> = ({ adrId }) => {
  const [adr, setAdr] = useState<DiscoveredAdr | null>(null);

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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-zinc-100">
      <div className="border-b border-zinc-800 pb-5 space-y-2">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-amber-400" />
          <span className="font-mono text-sm px-2.5 py-1 rounded bg-zinc-800 text-amber-400 font-bold border border-zinc-700">
            {adr?.id || adrId}
          </span>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">{displayTitle}</h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
            {displayStatus}
          </span>
        </div>
      </div>

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
    </div>
  );
};
