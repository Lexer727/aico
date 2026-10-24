import React, { useState, useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import {
  Layers,
  ShieldCheck,
  CheckSquare,
  Code2,
  Sparkles,
  BookOpen,
  Package,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Filter,
  ExternalLink,
} from 'lucide-react';

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  title?: string;
  isFrontier?: boolean;
  status?: string;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation?: string;
}

export interface VisualLineageCanvasProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  projectName?: string;
  epicId?: string;
  onSelectNode?: (nodeId: string) => void;
  onNodeClick?: (node: GraphNode) => void;
  onOpenNode?: (node: GraphNode) => void;
  onPopoutGraph?: () => void;
  isFullWindow?: boolean;
}

const TIER_COLUMNS = [
  { id: 'adr', label: 'ADR', types: ['adr'] },
  { id: 'epic', label: 'Epic', types: ['epic'] },
  { id: 'feature', label: 'Feature', types: ['feature'] },
  { id: 'task', label: 'Task', types: ['task'] },
  { id: 'code', label: 'Verification Seam / Code', types: ['code'] },
];

const TYPE_ORDER: Record<string, number> = {
  adr: 0,
  epic: 1,
  feature: 2,
  task: 3,
  code: 4,
};

const OMITTED_NODE_TYPES = new Set(['brainstorm', 'deepdive', 'spec', 'plan', 'requirement']);

const getTierIndex = (type: string): number => {
  const t = (type || '').toLowerCase();
  if (t === 'adr') return 0;
  if (t === 'epic') return 1;
  if (t === 'feature') return 2;
  if (t === 'task') return 3;
  if (t === 'code') return 4;
  return 2;
};

// @implements ft-core-epic-hub::TASK-CORE-007-11::REQ-003
// @implements ft-core-epic-hub::TASK-CORE-007-4::REQ-010
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-006
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-011
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-7::REQ-014
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-7::REQ-015
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-8::REQ-016
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-9::REQ-017
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-9::REQ-018
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-10::REQ-019
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-11::REQ-020
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-12::REQ-021
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-13::REQ-022
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-15::REQ-024
export const VisualLineageCanvas: React.FC<VisualLineageCanvasProps> = ({
  nodes: initialNodes,
  edges: initialEdges,
  projectName,
  epicId,
  onSelectNode,
  onNodeClick,
  onOpenNode,
  onPopoutGraph,
  isFullWindow = false,
}) => {
  const [fetchedNodes, setFetchedNodes] = useState<GraphNode[]>([]);
  const [fetchedEdges, setFetchedEdges] = useState<GraphEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isAllSelected, setIsAllSelected] = useState<boolean>(true);
  const [drilledFeatureId, setDrilledFeatureId] = useState<string | null>(null);

  // Zoom & Pan
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Fetch live graph data if nodes are not explicitly provided
  const isLive = !initialNodes || initialNodes.length === 0;

  useEffect(() => {
    if (!isLive) return;
    let isMounted = true;

    const fetchGraphData = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (projectName) queryParams.set('project', projectName);
        if (epicId) queryParams.set('epic', epicId);

        const url = `/api/v1/graph${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            const rawNodes = Array.isArray(data.nodes) ? data.nodes : Array.isArray(data) ? data : [];
            const rawEdges = Array.isArray(data.edges) ? data.edges : [];

            const parsedNodes: GraphNode[] = rawNodes.map((n: any) => ({
              id: n.id,
              type: (n.type || n.node_type || n.label || 'task').toLowerCase(),
              label: n.title || n.label || n.id,
              title: n.title || n.label,
              isFrontier: !!n.isFrontier || !!n.is_frontier,
              status: n.status,
            }));

            const parsedEdges: GraphEdge[] = rawEdges.map((e: any, idx: number) => ({
              id: e.id || `edge-${e.source}-${e.target}-${idx}`,
              source: e.source,
              target: e.target,
              relation: e.relation,
            }));

            setFetchedNodes(parsedNodes);
            setFetchedEdges(parsedEdges);
          }
        }
      } catch {
        // Fallback / offline handling
      }
    };

    fetchGraphData();
    return () => {
      isMounted = false;
    };
  }, [isLive, projectName, epicId]);

  const rawNodes = initialNodes && initialNodes.length > 0 ? initialNodes : fetchedNodes;
  const rawEdges = initialEdges && initialEdges.length > 0 ? initialEdges : fetchedEdges;

  // Features list for drill-down selector
  const featureList = useMemo(() => {
    return rawNodes
      .filter((n) => n.type.toLowerCase() === 'feature')
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [rawNodes]);

  // REQ-020: Bridge edges through omitted intermediate nodes (spec, plan, brainstorm, deepdive)
  // so Feature directly connects to Requirement, Task, and Code even in mock test graphs
  const effectiveEdges = useMemo(() => {
    const edgeList: GraphEdge[] = [...rawEdges];
    const omittedNodeIds = new Set(
      rawNodes
        .filter((n) => OMITTED_NODE_TYPES.has(n.type.toLowerCase()))
        .map((n) => n.id)
    );

    if (omittedNodeIds.size > 0) {
      const incomingToOmitted = new Map<string, string[]>();
      const outgoingFromOmitted = new Map<string, string[]>();

      rawEdges.forEach((e) => {
        if (omittedNodeIds.has(e.target)) {
          const list = incomingToOmitted.get(e.target) || [];
          list.push(e.source);
          incomingToOmitted.set(e.target, list);
        }
        if (omittedNodeIds.has(e.source)) {
          const list = outgoingFromOmitted.get(e.source) || [];
          list.push(e.target);
          outgoingFromOmitted.set(e.source, list);
        }
      });

      const transitiveTargets = new Map<string, Set<string>>();
      omittedNodeIds.forEach((omitId) => {
        const visited = new Set<string>();
        const queue = [omitId];
        const targets = new Set<string>();

        while (queue.length > 0) {
          const curr = queue.shift()!;
          const directTgts = outgoingFromOmitted.get(curr) || [];
          for (const tgt of directTgts) {
            if (omittedNodeIds.has(tgt)) {
              if (!visited.has(tgt)) {
                visited.add(tgt);
                queue.push(tgt);
              }
            } else {
              targets.add(tgt);
            }
          }
        }
        transitiveTargets.set(omitId, targets);
      });

      const existingEdgeKeys = new Set(rawEdges.map((e) => `${e.source}->${e.target}`));
      incomingToOmitted.forEach((sources, omitId) => {
        const targets = transitiveTargets.get(omitId);
        if (targets) {
          sources.forEach((src) => {
            if (!omittedNodeIds.has(src)) {
              targets.forEach((tgt) => {
                const key = `${src}->${tgt}`;
                if (!existingEdgeKeys.has(key)) {
                  existingEdgeKeys.add(key);
                  edgeList.push({
                    id: `bridge-${src}-${tgt}`,
                    source: src,
                    target: tgt,
                  });
                }
              });
            }
          });
        }
      });
    }

    return edgeList;
  }, [rawNodes, rawEdges]);

  // Determine all node IDs connected to the drilled feature using BFS
  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-9::REQ-018
  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-11::REQ-020
  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-15::REQ-024
  const drilledFeatureNodeIds = useMemo(() => {
    if (!drilledFeatureId) return null;
    const set = new Set<string>([drilledFeatureId]);
    const queue = [drilledFeatureId];

    // REQ-024: Strictly traverse downstream directed edges from the drilled feature
    // Do not traverse backwards through shared code verification seams into other features
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of effectiveEdges) {
        if (edge.source === current && !set.has(edge.target)) {
          set.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    return set;
  }, [drilledFeatureId, effectiveEdges]);

  // Available unique types for filter pills ordered by left-to-right architectural columns
  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-7::REQ-014
  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-11::REQ-020
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    rawNodes.forEach((n) => {
      const t = n.type.toLowerCase();
      if (!OMITTED_NODE_TYPES.has(t)) {
        types.add(t);
      }
    });
    return Array.from(types).sort((a, b) => (TYPE_ORDER[a] ?? 99) - (TYPE_ORDER[b] ?? 99));
  }, [rawNodes]);

  // Tri-state filter handlers
  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-10::REQ-019
  const toggleAll = () => {
    if (isAllSelected) {
      // Clicking All while All is active toggles to an empty view (all unselected)
      setIsAllSelected(false);
      setSelectedTypes([]);
    } else {
      // Clicking All while in empty view or partial view selects all
      setIsAllSelected(true);
      setSelectedTypes([]);
    }
  };

  const toggleTypeFilter = (type: string) => {
    if (isAllSelected) {
      // Clicking an active type filter pill while All is selected unselects that one thing!
      setIsAllSelected(false);
      setSelectedTypes(availableTypes.filter((t) => t !== type));
    } else if (selectedTypes.length === 0) {
      // Clicking a type filter pill from empty view selects just that one thing!
      setSelectedTypes([type]);
    } else if (selectedTypes.includes(type)) {
      // Unselect this type
      const next = selectedTypes.filter((t) => t !== type);
      setSelectedTypes(next);
    } else {
      // Select this type
      const next = [...selectedTypes, type];
      if (next.length === availableTypes.length) {
        setIsAllSelected(true);
        setSelectedTypes([]);
      } else {
        setSelectedTypes(next);
      }
    }
  };

  // Filter nodes by selected multi-select type pills and feature drill-down
  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-9::REQ-017
  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-9::REQ-018
  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-10::REQ-019
  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-11::REQ-020
  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-12::REQ-021
  const visibleNodes = useMemo(() => {
    // Empty view: all unselected -> 0 visible nodes
    if (!isAllSelected && selectedTypes.length === 0) {
      return [];
    }

    // REQ-020 & REQ-021: Omit brainstorm, deepdive, spec, plan, and requirement from visual DAG
    let base = rawNodes.filter((n) => !OMITTED_NODE_TYPES.has(n.type.toLowerCase()));

    if (drilledFeatureId && drilledFeatureNodeIds) {
      // In drilled mode: show ADRs, Epic, and all nodes belonging to the drilled feature (including its TASKs!)
      base = base.filter((n) => {
        const t = n.type.toLowerCase();
        if (t === 'adr' || t === 'epic') return true;
        return drilledFeatureNodeIds.has(n.id);
      });
    } else {
      // In Epic overview mode: hide task nodes if features are present
      if (featureList.length > 0) {
        const taskToggledExplicitly = !isAllSelected && selectedTypes.includes('task');
        if (!taskToggledExplicitly) {
          base = base.filter((n) => n.type.toLowerCase() !== 'task');
        }
      }
    }

    if (isAllSelected) return base;
    return base.filter((n) => selectedTypes.includes(n.type.toLowerCase()));
  }, [
    rawNodes,
    selectedTypes,
    isAllSelected,
    drilledFeatureId,
    drilledFeatureNodeIds,
    featureList.length,
  ]);

  const visibleNodeIdSet = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  // Compute 2D grid coordinates for nodes across dynamic visible columns with barycenter row alignment
  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-7::REQ-014
  // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-12::REQ-021
  const NODE_WIDTH = 190;
  const NODE_HEIGHT = 54;
  const COL_WIDTH = 246;
  const ROW_HEIGHT = 72;
  const OFFSET_X = 36;
  const OFFSET_Y = 56;

  // Active columns that actually have at least one visible node
  const activeTierColumns = useMemo(() => {
    return TIER_COLUMNS.filter((col) => {
      return visibleNodes.some((n) => col.types.includes(n.type.toLowerCase()));
    });
  }, [visibleNodes]);

  const activeColMap = useMemo(() => {
    const map = new Map<string, number>();
    activeTierColumns.forEach((col, idx) => {
      col.types.forEach((t) => map.set(t, idx));
    });
    return map;
  }, [activeTierColumns]);

  // REQ-022: Render directed edges strictly between immediately adjacent visible column tiers (colDiff === 1 or 0)
  // Suppress multi-tier bypass edges (colDiff > 1) when intermediate tiers are visible
  const visibleEdges = useMemo(() => {
    const nodeColMap = new Map<string, number>();
    visibleNodes.forEach((n) => {
      const colIdx = activeColMap.get(n.type.toLowerCase()) ?? getTierIndex(n.type);
      nodeColMap.set(n.id, colIdx);
    });

    return effectiveEdges.filter((e) => {
      if (!visibleNodeIdSet.has(e.source) || !visibleNodeIdSet.has(e.target)) {
        return false;
      }
      const srcCol = nodeColMap.get(e.source);
      const tgtCol = nodeColMap.get(e.target);
      if (srcCol === undefined || tgtCol === undefined) {
        return true;
      }
      const colDiff = tgtCol - srcCol;
      // Allow intra-column (0) or immediately adjacent visible column (1)
      return colDiff === 0 || colDiff === 1;
    });
  }, [effectiveEdges, visibleNodes, visibleNodeIdSet, activeColMap]);

  const { positionedNodes, positionedMap, canvasWidth, canvasHeight } = useMemo(() => {
    const numCols = Math.max(1, activeTierColumns.length);
    const tierBuckets: GraphNode[][] = Array.from({ length: numCols }, () => []);

    visibleNodes.forEach((node) => {
      const colIdx = activeColMap.get(node.type.toLowerCase()) ?? getTierIndex(node.type);
      const safeColIdx = Math.min(colIdx, numCols - 1);
      tierBuckets[safeColIdx].push(node);
    });

    // Sort early tiers deterministically
    if (tierBuckets[0]) tierBuckets[0].sort((a, b) => a.id.localeCompare(b.id));
    if (tierBuckets[1]) {
      tierBuckets[1].sort((a, b) => {
        const rank = (t: string) => {
          const lower = t.toLowerCase();
          if (lower === 'epic') return 0;
          if (lower === 'brainstorm') return 1;
          return 2;
        };
        return rank(a.type) - rank(b.type) || a.id.localeCompare(b.id);
      });
    }

    // Build incoming neighbor map for barycenter ordering of downstream columns
    const incomingSources = new Map<string, string[]>();
    visibleEdges.forEach((edge) => {
      const list = incomingSources.get(edge.target) || [];
      list.push(edge.source);
      incomingSources.set(edge.target, list);
    });

    const assignedRow = new Map<string, number>();
    for (let cIdx = 0; cIdx < numCols; cIdx++) {
      if (cIdx <= 1) {
        tierBuckets[cIdx].forEach((node, rIdx) => {
          assignedRow.set(node.id, rIdx);
        });
      } else {
        tierBuckets[cIdx].sort((a, b) => {
          const aPreds = (incomingSources.get(a.id) || [])
            .map((srcId) => assignedRow.get(srcId))
            .filter((r): r is number => r !== undefined);
          const bPreds = (incomingSources.get(b.id) || [])
            .map((srcId) => assignedRow.get(srcId))
            .filter((r): r is number => r !== undefined);

          const aBary =
            aPreds.length > 0
              ? aPreds.reduce((sum, val) => sum + val, 0) / aPreds.length
              : Number.MAX_SAFE_INTEGER;
          const bBary =
            bPreds.length > 0
              ? bPreds.reduce((sum, val) => sum + val, 0) / bPreds.length
              : Number.MAX_SAFE_INTEGER;

          if (Math.abs(aBary - bBary) > 0.001) {
            return aBary - bBary;
          }
          return a.id.localeCompare(b.id);
        });

        tierBuckets[cIdx].forEach((node, rIdx) => {
          assignedRow.set(node.id, rIdx);
        });
      }
    }

    let maxRows = 1;
    tierBuckets.forEach((bucket) => {
      if (bucket.length > maxRows) maxRows = bucket.length;
    });

    const posMap = new Map<string, { x: number; y: number; width: number; height: number; node: GraphNode }>();
    const posList: Array<{ x: number; y: number; width: number; height: number; node: GraphNode }> = [];

    tierBuckets.forEach((bucket, colIdx) => {
      bucket.forEach((node, rowIdx) => {
        const x = node.x !== undefined ? node.x : OFFSET_X + colIdx * COL_WIDTH;
        const y = node.y !== undefined ? node.y : OFFSET_Y + rowIdx * ROW_HEIGHT;
        const posItem = {
          x,
          y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          node,
        };
        posMap.set(node.id, posItem);
        posList.push(posItem);
      });
    });

    const cWidth = Math.max(1000, OFFSET_X + numCols * COL_WIDTH + 80);
    const cHeight = Math.max(480, OFFSET_Y + maxRows * ROW_HEIGHT + 80);

    return {
      positionedNodes: posList,
      positionedMap: posMap,
      canvasWidth: cWidth,
      canvasHeight: cHeight,
    };
  }, [visibleNodes, visibleEdges, activeTierColumns, activeColMap]);

  // Multi-hop Upstream and Downstream lineage sets
  const { upstreamEdges, downstreamEdges } = useMemo(() => {
    if (!selectedNodeId) {
      return { upstreamEdges: new Set<string>(), downstreamEdges: new Set<string>() };
    }

    const upSet = new Set<string>();
    const upQueue = [selectedNodeId];
    const upVisited = new Set<string>([selectedNodeId]);
    while (upQueue.length > 0) {
      const cur = upQueue.shift()!;
      for (const edge of visibleEdges) {
        if (edge.target === cur && !upSet.has(edge.id)) {
          upSet.add(edge.id);
          if (!upVisited.has(edge.source)) {
            upVisited.add(edge.source);
            upQueue.push(edge.source);
          }
        }
      }
    }

    const downSet = new Set<string>();
    const downQueue = [selectedNodeId];
    const downVisited = new Set<string>([selectedNodeId]);
    while (downQueue.length > 0) {
      const cur = downQueue.shift()!;
      for (const edge of visibleEdges) {
        if (edge.source === cur && !downSet.has(edge.id)) {
          downSet.add(edge.id);
          if (!downVisited.has(edge.target)) {
            downVisited.add(edge.target);
            downQueue.push(edge.target);
          }
        }
      }
    }

    return { upstreamEdges: upSet, downstreamEdges: downSet };
  }, [selectedNodeId, visibleEdges]);

  // REQ-015: Left click only toggles selection / highlights provenance & blast-radius
  // REQ-018: Clicking a feature node toggles drill-down for that feature
  const handleNodeClick = (node: GraphNode) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
    if (node.type.toLowerCase() === 'feature') {
      setDrilledFeatureId((prev) => (prev === node.id ? null : node.id));
    }
    onSelectNode?.(node.id);
    onNodeClick?.(node);
  };

  const getNodeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'adr':
        return <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'brainstorm':
        return <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />;
      case 'deepdive':
        return <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'epic':
        return <Layers className="w-4 h-4 text-indigo-400 shrink-0" />;
      case 'feature':
        return <Package className="w-4 h-4 text-violet-400 shrink-0" />;
      case 'spec':
        return <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />;
      case 'plan':
        return <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0" />;
      case 'requirement':
        return <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />;
      case 'task':
        return <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'code':
        return <Code2 className="w-4 h-4 text-amber-400 shrink-0" />;
      default:
        return <Sparkles className="w-4 h-4 text-zinc-400 shrink-0" />;
    }
  };

  // Pan interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node-id]') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  // REQ-016: Scroll wheel to zoom
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomDelta = -e.deltaY * 0.0015;
      setZoom((z) => Math.min(2.5, Math.max(0.4, Number((z + zoomDelta).toFixed(2)))));
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div
      data-testid="lineage-graph-canvas"
      className={clsx(
        'relative w-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col select-none',
        isFullWindow ? 'h-full flex-1' : 'h-[560px]'
      )}
    >
      {/* Top Toolbar: Filter Pills & Zoom / Pan / Popout Controls */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900/80 z-20 gap-2 flex-wrap">
        {/* Node Type Filter Pills (Multi-Select with Graph Order) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 mr-1">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <span>Filter:</span>
          </div>
          <button
            type="button"
            data-testid="filter-pill-all"
            onClick={toggleAll}
            className={clsx(
              'px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer',
              isAllSelected
                ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            )}
          >
            All ({visibleNodes.length})
          </button>
          {availableTypes.map((type) => {
            const isTypeActive = isAllSelected || selectedTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                data-testid={`filter-pill-${type}`}
                onClick={() => toggleTypeFilter(type)}
                className={clsx(
                  'px-2 py-0.5 rounded text-[11px] font-mono uppercase transition-colors cursor-pointer',
                  isTypeActive
                    ? isAllSelected
                      ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 font-medium'
                      : 'bg-indigo-600 text-white shadow-xs font-semibold'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                )}
              >
                {type}
              </button>
            );
          })}
        </div>

        {/* Feature Drilldown Selector & Zoom / Popout Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {featureList.length > 0 && (
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 shadow-xs">
              <span className="text-[11px] font-medium text-zinc-400">Drilldown:</span>
              <select
                data-testid="feature-drilldown-select"
                value={drilledFeatureId || ''}
                onChange={(e) => setDrilledFeatureId(e.target.value || null)}
                className="bg-zinc-800 text-zinc-200 text-[11px] rounded px-1.5 py-0.5 border border-zinc-700 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[210px] truncate"
              >
                <option value="">Epic Overview (All Features)</option>
                {featureList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label || f.id}
                  </option>
                ))}
              </select>
              {drilledFeatureId && (
                <button
                  type="button"
                  data-testid="reset-drilldown-btn"
                  onClick={() => setDrilledFeatureId(null)}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 hover:bg-indigo-900 hover:text-indigo-100 transition-colors cursor-pointer"
                  title="Reset to Epic Overview"
                >
                  ✕ Reset to Epic
                </button>
              )}
            </div>
          )}

          {/* Zoom & Popout Controls */}
          <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid="zoom-in-btn"
            onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
            className="p-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            data-testid="zoom-out-btn"
            onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
            className="p-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            data-testid="zoom-reset-btn"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-zinc-500 ml-1">
            {Math.round(zoom * 100)}%
          </span>

          {/* REQ-016: Full-window popout button */}
          {onPopoutGraph && !isFullWindow && (
            <button
              type="button"
              data-testid="popout-graph-btn"
              onClick={onPopoutGraph}
              className="ml-1 p-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer"
              title="Open Graph in Full-Window Tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          </div>
        </div>
      </div>

      {/* Interactive Graph Canvas Area with Wheel Zoom Support */}
      <div
        ref={canvasContainerRef}
        data-testid="lineage-canvas-viewport"
        className="relative flex-1 overflow-auto cursor-grab active:cursor-grabbing bg-zinc-950"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Background Grid Pattern */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Pan & Zoom Transform Container */}
        <div
          className="absolute top-0 left-0 transition-transform duration-75"
          style={{
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Dynamic Column Tier Headers (Only render for columns with visible nodes) */}
          {/* @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-7::REQ-014 */}
          <div className="absolute top-3 left-0 right-0 pointer-events-none z-10 flex">
            {activeTierColumns.map((col, idx) => (
              <div
                key={col.id}
                className="absolute text-center"
                style={{
                  left: `${OFFSET_X + idx * COL_WIDTH}px`,
                  width: `${NODE_WIDTH}px`,
                }}
              >
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400 bg-zinc-900/90 px-2.5 py-1 rounded-full border border-zinc-800 shadow-xs">
                  {col.label}
                </span>
              </div>
            ))}
          </div>

          {/* SVG Directed Bezier Edges Layer */}
          <svg
            data-testid="lineage-edges-svg"
            className="absolute inset-0 pointer-events-none lineage-graph-edges"
            width={canvasWidth}
            height={canvasHeight}
            style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
          >
            <defs>
              <marker
                id="arrowhead-default"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#71717a" />
              </marker>
              <marker
                id="arrowhead-upstream"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#38bdf8" />
              </marker>
              <marker
                id="arrowhead-downstream"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
              </marker>
              <marker
                id="arrowhead-hover"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#818cf8" />
              </marker>
            </defs>

            {visibleEdges.map((edge) => {
              const src = positionedMap.get(edge.source);
              const tgt = positionedMap.get(edge.target);
              if (!src || !tgt) return null;

              const isSameCol = Math.abs(src.x - tgt.x) < 10;
              const x1 = src.x + src.width;
              const y1 = src.y + src.height / 2;
              const x2 = isSameCol ? tgt.x + tgt.width : tgt.x;
              const y2 = tgt.y + tgt.height / 2;

              const isUp = upstreamEdges.has(edge.id);
              const isDown = downstreamEdges.has(edge.id);
              const isHovered =
                hoveredNodeId && (edge.source === hoveredNodeId || edge.target === hoveredNodeId);

              const dx = isSameCol ? 28 : Math.max(30, Math.abs(x2 - x1) * 0.5);
              const pathD = isSameCol
                ? `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 + dx} ${y2}, ${x2} ${y2}`
                : `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

              let stroke = '#52525b';
              let strokeWidth = 1.5;
              let markerEnd = 'url(#arrowhead-default)';
              let strokeDasharray: string | undefined = undefined;

              if (isUp) {
                stroke = '#38bdf8';
                strokeWidth = 2.5;
                markerEnd = 'url(#arrowhead-upstream)';
              } else if (isDown) {
                stroke = '#f59e0b';
                strokeWidth = 2.5;
                markerEnd = 'url(#arrowhead-downstream)';
              } else if (isHovered) {
                stroke = '#818cf8';
                strokeWidth = 2;
                markerEnd = 'url(#arrowhead-hover)';
              } else if (selectedNodeId) {
                stroke = '#3f3f46';
                strokeWidth = 1;
                strokeDasharray = '4 4';
              }

              return (
                <path
                  key={edge.id}
                  data-testid="edge-path"
                  data-edge-id={edge.id}
                  data-source={edge.source}
                  data-target={edge.target}
                  d={pathD}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  markerEnd={markerEnd}
                  className="transition-all duration-200"
                />
              );
            })}
          </svg>

          {/* Interactive Nodes Layer */}
          {/* @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-7::REQ-015 */}
          {positionedNodes.map(({ x, y, width, height, node }) => {
            const isSelected = selectedNodeId === node.id;
            const isFrontier = !!node.isFrontier;
            const isHovered = hoveredNodeId === node.id;

            return (
              <div
                key={node.id}
                data-testid={`node-${node.label}`}
                data-node-id={node.id}
                data-frontier={isFrontier ? 'true' : 'false'}
                data-selected={isSelected ? 'true' : 'false'}
                onClick={() => handleNodeClick(node)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{
                  position: 'absolute',
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                }}
                className={clsx(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all duration-200 bg-zinc-900 shadow-md group z-10',
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/60 ring-2 ring-indigo-500/60 shadow-lg shadow-indigo-500/25'
                    : isHovered
                    ? 'border-indigo-400 bg-zinc-850 scale-[1.02]'
                    : 'border-zinc-800 hover:border-zinc-700',
                  isFrontier &&
                    'ring-2 ring-emerald-400/80 shadow-lg shadow-emerald-500/30 animate-pulse border-emerald-500'
                )}
                title={node.title || node.label}
              >
                {getNodeIcon(node.type)}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-semibold text-zinc-100 truncate group-hover:text-white">
                    {node.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-zinc-400 uppercase">
                      {node.type}
                    </span>
                    {node.status && (
                      <span className="text-[9px] font-mono text-zinc-500">
                        • {node.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* REQ-015: Separate Open In New Tab button */}
                <button
                  type="button"
                  data-testid={`open-node-${node.id}`}
                  title={`Open ${node.label} in separate tab`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNode?.(node);
                  }}
                  className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>

                {isFrontier && (
                  <div
                    className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-emerald-500 text-black shadow-sm"
                    title="Active DAG Frontier"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Status Legend & Connection Info */}
      <div className="flex items-center justify-between p-2.5 border-t border-zinc-800 bg-zinc-900/90 text-[11px] text-zinc-400 z-20 flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-sky-400 rounded-full" />
            <span>Upstream Provenance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-amber-400 rounded-full" />
            <span>Downstream Blast Radius</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active Frontier</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {drilledFeatureId && (
            <div
              data-testid="drilldown-status-badge"
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-[11px] font-mono"
            >
              <span className="text-zinc-400">Drilled:</span>
              <span className="font-semibold text-white">{drilledFeatureId}</span>
            </div>
          )}
          {selectedNodeId && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-zinc-500">Selected:</span>
              <span className="text-indigo-300 font-semibold">{selectedNodeId}</span>
              <span className="text-sky-400 font-semibold">({upstreamEdges.size} Up)</span>
              <span className="text-amber-400 font-semibold">({downstreamEdges.size} Down)</span>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="text-[10px] text-zinc-400 hover:text-zinc-200 underline ml-1 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
