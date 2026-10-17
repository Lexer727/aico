import React, { useState, useMemo } from 'react';
import clsx from 'clsx';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FileCode,
  BookOpen,
  Layers,
  Search,
  Settings,
  Package,
  Scale,
  FolderTree,
  LayoutGrid,
  Terminal,
} from 'lucide-react';
import { AiStatusMonitor } from './AiStatusMonitor';
import type {
  DiscoveredEpic,
  DiscoveredFeature,
  DiscoveredAdr,
} from '../../features/feature-task-data';
import { createSearchIndex, searchWorkspace } from '../../utils/searchEngine';

export type MobileViewType = 'tree' | 'main' | 'terminal';

export interface DiscoveredFeatureNav {
  id: string;
  name: string;
  epicId: string;
  status?: string;
  isStandalone?: boolean;
}

export interface DiscoveredEpicNav {
  id: string;
  title: string;
  status: string;
  specs?: Array<{ id: string; title: string; status?: string }>;
  features?: Array<{ id: string; name: string }>;
}

export interface DiscoveredAdrNav {
  id: string;
  title: string;
  status?: string;
}

export interface DiscoveredCodeFileNav {
  path: string;
  relative_path: string;
  name: string;
  extension: string;
  implements_count: number;
  annotations?: Array<{ line: number; tag: string; target: string }>;
}

export interface ShellLayoutProps {
  children: React.ReactNode;
  isMobile?: boolean;
  activeMobileView?: MobileViewType;
  onMobileViewChange?: (view: MobileViewType) => void;
  epics?: DiscoveredEpicNav[];
  features?: DiscoveredFeatureNav[];
  adrs?: DiscoveredAdrNav[];
  codeFiles?: Array<DiscoveredCodeFileNav | string>;
  fullEpics?: DiscoveredEpic[];
  fullFeatures?: DiscoveredFeature[];
  fullAdrs?: DiscoveredAdr[];
  onSelectEpic?: (epicId: string) => void;
  onSelectFeature?: (featureId: string, name: string) => void;
  onSelectSpec?: (specId: string, title: string) => void;
  onSelectCode?: (file: string) => void;
  onSelectAdr?: (adrId: string) => void;
  onOpenSettings?: () => void;
  onOpenOmniSearch?: () => void;
  onRefreshWorkspace?: () => void;
  isRefreshing?: boolean;
}

const defaultEpics: DiscoveredEpicNav[] = [
  {
    id: 'ec-core',
    title: 'AICO Core SDD Platform',
    status: 'In Progress',
    specs: [
      { id: 'spec-ft-core-host-runtime', title: 'Host Runtime & Local HTTP/WS Server' },
      { id: 'spec-ft-core-security-auth', title: 'LAN Security & Local Authentication' },
      { id: 'spec-ft-core-local-storage', title: 'Local Storage & Embedded Engine Lifecycle' },
      { id: 'spec-ft-core-discovery', title: 'Workspace & Multi-Project Discovery' },
      { id: 'spec-ft-core-mcp-tools', title: 'Deterministic SDD Tool Registration' },
      { id: 'spec-ft-core-webui-shell', title: 'WebUI Workspace Shell & Dockable Layout' },
      { id: 'spec-ft-core-epic-hub', title: 'Single-Page Epic Hub & Lineage Graph' },
    ],
  },
  {
    id: 'ec-specs',
    title: 'AICO Artifact Blueprints & Skills',
    status: 'Completed',
    specs: [
      { id: 'spec-ft-specs-blueprint-standards', title: 'AICO Blueprint Standards' },
      { id: 'spec-ft-specs-skills-evolution', title: 'AICO Skills Evolution & Wave-Internal Tasks' },
      { id: 'spec-ft-specs-migration-engine', title: 'AICO Spec Migration Engine' },
      { id: 'spec-ft-specs-skills-versioning-and-naming', title: 'Skills Version Decoupling & Naming' },
    ],
  },
];

const defaultFeatures: DiscoveredFeatureNav[] = [
  { id: 'ft-core-host-runtime', name: 'Host Runtime & Local Server', epicId: 'ec-core' },
  { id: 'ft-core-security-auth', name: 'LAN Security & Local Auth', epicId: 'ec-core' },
  { id: 'ft-core-local-storage', name: 'Embedded Storage Engines', epicId: 'ec-core' },
  { id: 'ft-core-discovery', name: 'Multi-Project Discovery', epicId: 'ec-core' },
  { id: 'ft-core-mcp-tools', name: 'Deterministic SDD Tools', epicId: 'ec-core' },
  { id: 'ft-core-webui-shell', name: 'WebUI Shell & Dockable Panels', epicId: 'ec-core' },
  { id: 'ft-core-epic-hub', name: 'Single-Page Epic Hub & Graph', epicId: 'ec-core' },
  { id: 'ft-specs-blueprint-standards', name: 'Blueprint Standards', epicId: 'ec-specs' },
  { id: 'ft-specs-skills-evolution', name: 'Skills Evolution & Wave Tasks', epicId: 'ec-specs' },
  { id: 'ft-specs-migration-engine', name: 'Migration Engine', epicId: 'ec-specs' },
  { id: 'ft-specs-skills-versioning-and-naming', name: 'Skills Versioning & Naming', epicId: 'ec-specs' },
  { id: 'ft-fast-trace', name: 'Fast-Trace Binary Parser', epicId: '', isStandalone: true },
];

const defaultCodeFiles = [
  'crates/aico-server/src/server.rs',
  'crates/aico-server/src/assets.rs',
  'crates/aico-server/src/auth.rs',
  'crates/aico-server/src/ws_hub.rs',
  'crates/aico-core/src/scanner.rs',
  'crates/aico-core/src/registry.rs',
  'crates/aico-storage/src/embedded.rs',
  'crates/aico-mcp/src/registry.rs',
  'frontend/src/App.tsx',
  'frontend/src/components/layout/ShellLayout.tsx',
  'frontend/src/features/epic-hub/EpicHubView.tsx',
  'frontend/src/features/feature-viewer/FeatureViewer.tsx',
];

const defaultAdrs: DiscoveredAdrNav[] = [
  { id: 'ADR-0001', title: 'Host Runtime and Network Topology', status: 'Accepted' },
  { id: 'ADR-0002', title: 'Decoupled SDD and Codebase Repositories', status: 'Accepted' },
  { id: 'ADR-0003', title: 'Security and Auto-Mode Enforcement', status: 'Accepted' },
  { id: 'ADR-0004', title: 'React Frontend and Reusable Design System', status: 'Accepted' },
  { id: 'ADR-0005', title: 'Unified Accordion Workspace and Dockable Panels', status: 'Accepted' },
  { id: 'ADR-0006', title: 'Packaging AICO Specs and Version Tagging', status: 'Accepted' },
  { id: 'ADR-0007', title: 'Multi-Modal Assets and Human-Gate Tasks', status: 'Accepted' },
  { id: 'ADR-0008', title: 'Unified Root Discovery and Project Manifest', status: 'Accepted' },
  { id: 'ADR-0009', title: 'SDD Artifact Schema and Task Lifecycle', status: 'Accepted' },
  { id: 'ADR-0010', title: 'SDD Structural Grammar v0.1.2 & Standalone Features', status: 'Accepted' },
];

// @implements spec-ft-core-webui-shell::REQ-001
// @implements spec-ft-core-webui-shell::REQ-002
// @implements spec-ft-core-webui-shell::REQ-008
// @implements spec-ft-core-webui-shell::REQ-012
// @implements spec-ft-core-webui-shell::REQ-013
// @implements spec-ft-core-webui-shell::REQ-016
// @implements spec-ft-core-epic-hub::REQ-001
// @implements spec-ft-core-omni-search-fulltext::REQ-003
// @implements spec-ft-core-omni-search-fulltext::REQ-004
export const ShellLayout: React.FC<ShellLayoutProps> = ({
  children,
  isMobile = false,
  activeMobileView,
  onMobileViewChange,
  epics = defaultEpics,
  features = defaultFeatures,
  adrs = defaultAdrs,
  codeFiles = defaultCodeFiles,
  fullEpics,
  fullFeatures,
  fullAdrs,
  onSelectEpic,
  onSelectFeature,
  onSelectSpec,
  onSelectCode,
  onSelectAdr,
  onOpenSettings,
  onOpenOmniSearch: _onOpenOmniSearch,
  onRefreshWorkspace: _onRefreshWorkspace,
  isRefreshing: _isRefreshing = false,
}) => {
  const [internalMobileView, setInternalMobileView] = useState<MobileViewType>('main');
  const currentMobileView = activeMobileView ?? internalMobileView;

  const handleMobileViewChange = (view: MobileViewType) => {
    setInternalMobileView(view);
    onMobileViewChange?.(view);
  };

  const handleSelectEpic = (epicId: string) => {
    onSelectEpic?.(epicId);
    if (isMobile) handleMobileViewChange('main');
  };

  const handleSelectFeature = (featureId: string, name: string) => {
    onSelectFeature?.(featureId, name);
    if (isMobile) handleMobileViewChange('main');
  };

  const handleSelectSpec = (specId: string, title: string) => {
    onSelectSpec?.(specId, title);
    if (isMobile) handleMobileViewChange('main');
  };

  const handleSelectCode = (file: string) => {
    onSelectCode?.(file);
    if (isMobile) handleMobileViewChange('main');
  };

  const handleSelectAdr = (adrId: string) => {
    onSelectAdr?.(adrId);
    if (isMobile) handleMobileViewChange('main');
  };

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    epics: true,
    features: true,
    specifications: true,
    code: true,
    adrs: true,
  });

  // Persistent Scope Filter Checkboxes (5 scopes including Features)
  const [scopeFilters, setScopeFilters] = useState<{
    epics: boolean;
    features: boolean;
    specs: boolean;
    code: boolean;
    adrs: boolean;
  }>({
    epics: true,
    features: true,
    specs: true,
    code: true,
    adrs: true,
  });

  const [searchQuery, setSearchQuery] = useState('');

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleScopeFilter = (scope: 'epics' | 'features' | 'specs' | 'code' | 'adrs') => {
    setScopeFilters((prev) => ({
      ...prev,
      [scope]: !prev[scope],
    }));
  };

  const effectiveEpics = useMemo(() => {
    if (epics && epics.length > 0 && epics !== defaultEpics) return epics;
    if (fullEpics && fullEpics.length > 0) {
      return fullEpics.map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        specs: e.specs || [],
        features: (e.features || []).map((f) => ({ id: f.id, name: f.name })),
      }));
    }
    return epics || defaultEpics;
  }, [epics, fullEpics]);

  const effectiveFeatures = useMemo(() => {
    if (features && features.length > 0 && features !== defaultFeatures) return features;
    if (fullFeatures && fullFeatures.length > 0) {
      return fullFeatures.map((f) => ({
        id: f.id,
        name: f.name || f.id,
        epicId: f.epic_id || (f as any).epicId || '',
        status: f.status,
        isStandalone: f.is_standalone ?? (f as any).isStandalone ?? false,
      }));
    }
    return features || defaultFeatures;
  }, [features, fullFeatures]);

  const effectiveAdrs = useMemo(() => {
    if (adrs && adrs.length > 0 && adrs !== defaultAdrs) return adrs;
    if (fullAdrs && fullAdrs.length > 0) {
      return fullAdrs.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
      }));
    }
    return adrs || defaultAdrs;
  }, [adrs, fullAdrs]);

  // Compile all specs across all epics and standalone features
  // @implements spec-ft-core-omni-search-fulltext::REQ-009
  const allSpecs = useMemo(() => {
    const epicSpecs = effectiveEpics.flatMap((e) =>
      (e.specs || []).map((s) => ({
        ...s,
        epicId: e.id,
      }))
    );
    const existingIds = new Set(epicSpecs.map((s) => s.id.toLowerCase()));
    const standaloneSpecs = effectiveFeatures
      .filter((f) => f.isStandalone && f.id)
      .map((f) => {
        const specId = (f as any).spec_id || (f as any).specId || `spec-${f.id}`;
        return {
          id: specId,
          title: (f as any).spec_title || (f as any).specTitle || f.name || specId,
          status: f.status,
          epicId: '',
          path: `features/${f.id}/${specId}.md`,
        };
      })
      .filter((s) => !existingIds.has(s.id.toLowerCase()));

    return [...epicSpecs, ...standaloneSpecs];
  }, [effectiveEpics, effectiveFeatures]);

  const effectiveCode = useMemo(() => {
    if (codeFiles && codeFiles.length > 0) return codeFiles;
    return defaultCodeFiles;
  }, [codeFiles]);

  // Build in-memory full-text fuzzy search index
  const searchIndex = useMemo(() => {
    return createSearchIndex({
      epics: fullEpics || (effectiveEpics as any),
      features: fullFeatures || (effectiveFeatures as any),
      adrs: fullAdrs || (effectiveAdrs as any),
      codeFiles: effectiveCode.map((c) => (typeof c === 'string' ? c : c.relative_path || c.path)),
    });
  }, [fullEpics, effectiveEpics, fullFeatures, effectiveFeatures, fullAdrs, effectiveAdrs, effectiveCode]);

  const q = searchQuery.trim();

  const searchMatches = useMemo(() => {
    if (!q) return null;
    return searchWorkspace(searchIndex, q, { scopes: scopeFilters });
  }, [searchIndex, q, scopeFilters]);

  // Filter items in each category
  const filteredEpics = useMemo(() => {
    if (!scopeFilters.epics) return [];
    if (!q) return effectiveEpics;
    if (!searchMatches) return [];
    return effectiveEpics.filter((e) => searchMatches.some((m) => m.scope === 'epics' && m.id.toLowerCase() === e.id.toLowerCase()));
  }, [effectiveEpics, q, searchMatches, scopeFilters.epics]);

  const filteredFeatures = useMemo(() => {
    if (!scopeFilters.features) return [];
    if (!q) return effectiveFeatures;
    if (!searchMatches) return [];
    return effectiveFeatures.filter((f) => searchMatches.some((m) => m.scope === 'features' && m.id.toLowerCase() === f.id.toLowerCase()));
  }, [effectiveFeatures, q, searchMatches, scopeFilters.features]);

  const filteredSpecs = useMemo(() => {
    if (!scopeFilters.specs) return [];
    if (!q) return allSpecs;
    if (!searchMatches) return [];
    return allSpecs.filter((s) => searchMatches.some((m) => m.scope === 'specs' && m.id.toLowerCase() === s.id.toLowerCase()));
  }, [allSpecs, q, searchMatches, scopeFilters.specs]);

  const filteredCode = useMemo(() => {
    if (!scopeFilters.code) return [];
    if (!q) return effectiveCode;
    if (!searchMatches) return [];
    return effectiveCode.filter((c) => {
      const path = typeof c === 'string' ? c : c.relative_path || c.path;
      return searchMatches.some(
        (m) =>
          m.scope === 'code' &&
          (m.id.toLowerCase() === path.toLowerCase() ||
            path.toLowerCase().includes(m.id.toLowerCase()) ||
            (m.title && path.toLowerCase().includes(m.title.toLowerCase())))
      );
    });
  }, [effectiveCode, q, searchMatches, scopeFilters.code]);

  const filteredAdrs = useMemo(() => {
    if (!scopeFilters.adrs) return [];
    if (!q) return effectiveAdrs;
    if (!searchMatches) return [];
    return effectiveAdrs.filter((a) => searchMatches.some((m) => m.scope === 'adrs' && m.id.toLowerCase() === a.id.toLowerCase()));
  }, [effectiveAdrs, q, searchMatches, scopeFilters.adrs]);

  const isEpicsOpen = openSections.epics || (!!q && filteredEpics.length > 0);
  const isFeaturesOpen = openSections.features || (!!q && filteredFeatures.length > 0);
  const isSpecsOpen = openSections.specifications || (!!q && filteredSpecs.length > 0);
  const isCodeOpen = openSections.code || (!!q && filteredCode.length > 0);
  const isAdrsOpen = openSections.adrs || (!!q && filteredAdrs.length > 0);

  const renderNavContent = () => (
    <div className="flex flex-col h-full bg-zinc-900 border-r border-zinc-800 text-zinc-300 select-none">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-zinc-800 bg-zinc-950/40">
        <div className="flex items-center gap-2 font-bold text-zinc-100 text-xs tracking-wide">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <span>AICO WORKSPACE</span>
        </div>
        {/* @implements spec-ft-core-ui-visual-consistency::REQ-001 */}
        {/* @implements spec-ft-core-webui-shell::REQ-016 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400" title="AICO Platform Version">
            v0.1.1
          </span>
        </div>
      </div>

      {/* Sidebar Integrated Search & 5 Persistent Filter Checkboxes */}
      <div className="p-2.5 border-b border-zinc-800 bg-zinc-900/60 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            data-testid="sidebar-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workspace..."
            className="w-full pl-8 pr-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* 5 Persistent Filter Checkboxes (Toggling hides/shows the section in the tree view) */}
        <div className="flex items-center justify-between px-1 text-[10px] text-zinc-400 flex-wrap gap-1">
          <label className="flex items-center gap-1 cursor-pointer hover:text-zinc-200">
            <input
              type="checkbox"
              checked={scopeFilters.epics}
              onChange={() => toggleScopeFilter('epics')}
              className="rounded bg-zinc-950 border-zinc-700 text-indigo-500 focus:ring-0 w-3 h-3 cursor-pointer"
            />
            <span>Epics</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer hover:text-zinc-200">
            <input
              type="checkbox"
              checked={scopeFilters.features}
              onChange={() => toggleScopeFilter('features')}
              className="rounded bg-zinc-950 border-zinc-700 text-indigo-500 focus:ring-0 w-3 h-3 cursor-pointer"
            />
            <span>Features</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer hover:text-zinc-200">
            <input
              type="checkbox"
              checked={scopeFilters.specs}
              onChange={() => toggleScopeFilter('specs')}
              className="rounded bg-zinc-950 border-zinc-700 text-indigo-500 focus:ring-0 w-3 h-3 cursor-pointer"
            />
            <span>Specs</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer hover:text-zinc-200">
            <input
              type="checkbox"
              checked={scopeFilters.code}
              onChange={() => toggleScopeFilter('code')}
              className="rounded bg-zinc-950 border-zinc-700 text-indigo-500 focus:ring-0 w-3 h-3 cursor-pointer"
            />
            <span>Code</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer hover:text-zinc-200">
            <input
              type="checkbox"
              checked={scopeFilters.adrs}
              onChange={() => toggleScopeFilter('adrs')}
              className="rounded bg-zinc-950 border-zinc-700 text-indigo-500 focus:ring-0 w-3 h-3 cursor-pointer"
            />
            <span>ADRs</span>
          </label>
        </div>
      </div>

      {/* Accordion Workspace Tree (Always preserves tree view structure, filtered in-place) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
        {/* 1. Epics Section (shown only if scopeFilters.epics is true) */}
        {scopeFilters.epics && (
          <div>
            <button
              data-testid="toggle-epics"
              onClick={() => toggleSection('epics')}
              className="w-full flex items-center justify-between p-2 rounded hover:bg-zinc-800/60 font-medium text-zinc-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Epics</span>
                {q && (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({filteredEpics.length})
                  </span>
                )}
              </div>
              {isEpicsOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
            {isEpicsOpen && (
              <div className="pl-6 pr-2 py-1 space-y-1 text-zinc-400">
                {filteredEpics.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 italic px-2 py-1">No matches</div>
                ) : (
                  filteredEpics.map((epic) => (
                    <div
                      key={epic.id}
                      data-testid={`nav-epic-${epic.id}`}
                      onClick={() => handleSelectEpic(epic.id)}
                      className="py-1 px-2 hover:bg-zinc-800/60 rounded cursor-pointer flex items-center justify-between group transition-colors"
                    >
                      <span className="group-hover:text-zinc-200 font-medium">{epic.id}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                        {epic.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. Features Section (shown only if scopeFilters.features is true) */}
        {scopeFilters.features && (
          <div>
            <button
              data-testid="toggle-features"
              onClick={() => toggleSection('features')}
              className="w-full flex items-center justify-between p-2 rounded hover:bg-zinc-800/60 font-medium text-zinc-200 transition-colors"
            >
              {/* @implements spec-ft-core-ui-visual-consistency::REQ-003 */}
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-400" />
                <span>Features</span>
                {q && (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({filteredFeatures.length})
                  </span>
                )}
              </div>
              {isFeaturesOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
            {isFeaturesOpen && (
              <div className="pl-6 pr-2 py-1 space-y-1 text-zinc-400">
                {filteredFeatures.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 italic px-2 py-1">No matches</div>
                ) : (
                  filteredFeatures.map((feat) => (
                    <div
                      key={feat.id}
                      data-testid={`nav-feature-${feat.id}`}
                      onClick={() => handleSelectFeature(feat.id, feat.name)}
                      className="py-1 px-2 hover:bg-zinc-800/60 rounded cursor-pointer flex items-center justify-between group transition-colors"
                      title={`${feat.id}: ${feat.name} (${feat.epicId})`}
                    >
                      <div className="truncate flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-zinc-300 font-medium shrink-0">{feat.id}</span>
                        <span className="text-zinc-500 text-[10px] truncate">{feat.name}</span>
                      </div>
                      {(feat.isStandalone || feat.epicId === 'standalone') && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950/70 text-purple-400 border border-purple-800 shrink-0 ml-1">
                          Standalone
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. Specifications Section (shown only if scopeFilters.specs is true) */}
        {scopeFilters.specs && (
          <div>
            <button
              data-testid="toggle-specifications"
              onClick={() => toggleSection('specifications')}
              className="w-full flex items-center justify-between p-2 rounded hover:bg-zinc-800/60 font-medium text-zinc-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-400" />
                <span>Specifications</span>
                {q && (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({filteredSpecs.length})
                  </span>
                )}
              </div>
              {isSpecsOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
            {isSpecsOpen && (
              <div className="pl-6 pr-2 py-1 space-y-1 text-zinc-400">
                {filteredSpecs.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 italic px-2 py-1">No matches</div>
                ) : (
                  filteredSpecs.map((sp) => (
                    <div
                      key={sp.id}
                      onClick={() => handleSelectSpec(sp.id, sp.title)}
                      className="py-1 px-2 hover:bg-zinc-800/60 rounded cursor-pointer truncate text-zinc-400 hover:text-zinc-200 transition-colors"
                      title={`${sp.id}: ${sp.title}`}
                    >
                      <span className="font-mono text-zinc-300 font-medium">{sp.id}</span>
                      <span className="text-zinc-500 text-[10px] ml-1.5 truncate">{sp.title}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. Code Files Section (shown only if scopeFilters.code is true) */}
        {scopeFilters.code && (
          <div>
            <button
              data-testid="toggle-code"
              onClick={() => toggleSection('code')}
              className="w-full flex items-center justify-between p-2 rounded hover:bg-zinc-800/60 font-medium text-zinc-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span>Code</span>
                {q && (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({filteredCode.length})
                  </span>
                )}
              </div>
              {isCodeOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
            {isCodeOpen && (
              <div className="pl-6 pr-2 py-1 space-y-1 text-zinc-400">
                {filteredCode.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 italic px-2 py-1">No matches</div>
                ) : (
                  filteredCode.map((c) => {
                    const path = typeof c === 'string' ? c : c.relative_path || c.path;
                    const implCount = typeof c === 'string' ? 0 : c.implements_count || 0;
                    return (
                      <div
                        key={path}
                        data-testid={`nav-code-${path}`}
                        onClick={() => handleSelectCode(path)}
                        className="flex items-center justify-between py-1 px-2 hover:bg-zinc-800/60 rounded cursor-pointer text-zinc-400 hover:text-zinc-200 transition-colors group"
                        title={path}
                      >
                        <div className="flex items-center gap-1.5 truncate min-w-0">
                          <FileCode className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="truncate font-mono text-[11px] text-zinc-300">{path}</span>
                        </div>
                        {implCount > 0 && (
                          <span
                            className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800 shrink-0 ml-1.5"
                            title={`${implCount} @implements annotations verified`}
                          >
                            {implCount} @impl
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. ADRs Section (shown only if scopeFilters.adrs is true) */}
        {scopeFilters.adrs && (
          <div>
            <button
              data-testid="toggle-adrs"
              onClick={() => toggleSection('adrs')}
              className="w-full flex items-center justify-between p-2 rounded hover:bg-zinc-800/60 font-medium text-zinc-200 transition-colors"
            >
              {/* @implements spec-ft-core-ui-visual-consistency::REQ-005 */}
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-400" />
                <span>ADRs</span>
                {q && (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({filteredAdrs.length})
                  </span>
                )}
              </div>
              {isAdrsOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
            {isAdrsOpen && (
              <div className="pl-6 pr-2 py-1 space-y-1 text-zinc-400">
                {filteredAdrs.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 italic px-2 py-1">No matches</div>
                ) : (
                  filteredAdrs.map((adr) => (
                    <div
                      key={adr.id}
                      onClick={() => handleSelectAdr(adr.id)}
                      className="py-1 px-2 hover:bg-zinc-800/60 rounded cursor-pointer truncate text-zinc-400 hover:text-zinc-200 transition-colors"
                      title={`${adr.id}: ${adr.title}`}
                    >
                      <span className="font-mono text-amber-400 font-medium">{adr.id}</span>
                      <span className="text-zinc-400 text-[10px] ml-1.5 truncate">{adr.title}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar Bottom: AI Status Monitor & Settings Button */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950/60 space-y-2">
        <AiStatusMonitor />

        <div className="flex items-center justify-between pt-1">
          <button
            data-testid="settings-button"
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-100 transition-colors text-xs font-medium"
            title="Open Workspace Settings"
          >
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>Settings</span>
          </button>
          <span className="text-[10px] text-zinc-600 font-mono">Localhost</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row h-full min-h-[100dvh] h-[100dvh] w-full max-w-full overflow-hidden bg-zinc-950 font-sans text-zinc-100">
      {/* Desktop Full-Height Sidebar */}
      {!isMobile && (
        <aside
          data-testid="left-sidebar"
          className="h-screen w-64 flex-shrink-0 z-30 flex flex-col"
        >
          {renderNavContent()}
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden min-w-0 bg-zinc-950 relative">
        {isMobile && currentMobileView === 'tree' ? (
          <div data-testid="mobile-tree-view" className="flex-1 overflow-y-auto h-full w-full">
            {renderNavContent()}
          </div>
        ) : (
          children
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      {/* @implements spec-ft-core-webui-shell::REQ-013 */}
      {isMobile && (
        <nav
          data-testid="mobile-bottom-navbar"
          className="min-h-14 h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-zinc-900 border-t border-zinc-800 flex items-center justify-around z-30 shrink-0 px-2"
        >
          <button
            type="button"
            data-testid="mobile-tab-tree"
            onClick={() => handleMobileViewChange('tree')}
            className={clsx(
              'flex flex-col items-center justify-center flex-1 py-1 px-2 rounded transition-colors cursor-pointer',
              currentMobileView === 'tree'
                ? 'text-indigo-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <FolderTree className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Tree</span>
          </button>

          <button
            type="button"
            data-testid="mobile-tab-main"
            onClick={() => handleMobileViewChange('main')}
            className={clsx(
              'flex flex-col items-center justify-center flex-1 py-1 px-2 rounded transition-colors cursor-pointer',
              currentMobileView === 'main'
                ? 'text-indigo-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <LayoutGrid className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Main</span>
          </button>

          <button
            type="button"
            data-testid="mobile-tab-terminal"
            onClick={() => handleMobileViewChange('terminal')}
            className={clsx(
              'flex flex-col items-center justify-center flex-1 py-1 px-2 rounded transition-colors cursor-pointer',
              currentMobileView === 'terminal'
                ? 'text-indigo-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <Terminal className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Terminal</span>
          </button>
        </nav>
      )}
    </div>
  );
};
