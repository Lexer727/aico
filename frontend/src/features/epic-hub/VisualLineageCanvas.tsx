import React, { useState } from 'react';
import clsx from 'clsx';
import { Layers, ShieldCheck, CheckSquare, Code2, Sparkles } from 'lucide-react';

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  isFrontier?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

interface VisualLineageCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelectNode?: (nodeId: string) => void;
}

// @implements spec-ft-core-epic-hub::REQ-003
// @implements spec-ft-core-epic-hub::REQ-010
export const VisualLineageCanvas: React.FC<VisualLineageCanvasProps> = ({
  nodes,
  edges,
  onSelectNode,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNodeId(node.id);
    onSelectNode?.(node.id);
  };

  // Determine upstream / downstream for highlighted edges
  const isUpstream = (edge: GraphEdge) => {
    return selectedNodeId ? edge.target === selectedNodeId : false;
  };

  const isDownstream = (edge: GraphEdge) => {
    return selectedNodeId ? edge.source === selectedNodeId : false;
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'epic':
        return <Layers className="w-4 h-4 text-indigo-400" />;
      case 'spec':
        return <ShieldCheck className="w-4 h-4 text-sky-400" />;
      case 'task':
        return <CheckSquare className="w-4 h-4 text-emerald-400" />;
      case 'code':
        return <Code2 className="w-4 h-4 text-amber-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full h-full min-h-[400px] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden p-6 flex flex-col items-center justify-center select-none">
      {/* Background Grid Pattern */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Nodes Container */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-8">
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isFrontier = !!node.isFrontier;

          return (
            <div
              key={node.id}
              data-testid={`node-${node.label}`}
              data-node-id={node.id}
              data-frontier={isFrontier ? 'true' : 'false'}
              data-selected={isSelected ? 'true' : 'false'}
              onClick={() => handleNodeClick(node)}
              className={clsx(
                'relative flex items-center gap-2.5 px-4 py-3 rounded-lg border cursor-pointer transition-all duration-200 bg-zinc-900',
                isSelected
                  ? 'border-indigo-500 bg-indigo-950/40 ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-500/20'
                  : 'border-zinc-800 hover:border-zinc-600',
                isFrontier &&
                  'ring-2 ring-emerald-400/80 shadow-lg shadow-emerald-500/30 animate-pulse border-emerald-500'
              )}
            >
              {getNodeIcon(node.type)}
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-zinc-100">{node.label}</span>
                <span className="text-[10px] font-mono text-zinc-400 uppercase">{node.type}</span>
              </div>

              {isFrontier && (
                <div className="absolute -top-2 -right-2 p-1 rounded-full bg-emerald-500 text-black shadow">
                  <Sparkles className="w-3 h-3" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Render Active Edges Information */}
      {selectedNodeId && edges.length > 0 && (
        <div className="mt-4 flex items-center gap-4 text-xs font-mono text-zinc-400">
          <span>Active Connections:</span>
          {edges.map((edge) => {
            const upstream = isUpstream(edge);
            const downstream = isDownstream(edge);
            if (!upstream && !downstream) return null;

            return (
              <span
                key={edge.id}
                className={clsx(
                  'px-2 py-0.5 rounded border text-[11px]',
                  upstream && 'border-sky-500/60 bg-sky-950/40 text-sky-300',
                  downstream && 'border-amber-500/60 bg-amber-950/40 text-amber-300'
                )}
              >
                {edge.source} &rarr; {edge.target} {upstream ? '(Upstream)' : '(Downstream)'}
              </span>
            );
          })}
        </div>
      )}

      {/* Edge Status Legend */}
      <div className="mt-8 flex items-center gap-6 text-[11px] font-medium text-zinc-400 z-10">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-sky-500" />
          <span>Upstream Provenance (Blue)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-amber-500" />
          <span>Downstream Blast Radius (Amber)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Active Frontier (Glow)</span>
        </div>
      </div>
    </div>
  );
};
