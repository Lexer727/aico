import React, { useState } from 'react';
import {
  Menu,
  ChevronDown,
  ChevronRight,
  Folder,
  FileCode,
  BookOpen,
  Layers,
  Search,
  Settings,
  FileText,
  Package,
} from 'lucide-react';
import { ActivityMonitor } from './ActivityMonitor';

export interface DiscoveredFeatureNav {
  id: string;
  name: string;
  epicId: string;
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

export interface ShellLayoutProps {
  children: React.ReactNode;
  isMobile?: boolean;
  epics?: DiscoveredEpicNav[];
  features?: DiscoveredFeatureNav[];
  adrs?: DiscoveredAdrNav[];
  onSelectEpic?: (epicId: string) => void;
  onSelectFeature?: (featureId: string, name: string) => void;
  onSelectSpec?: (specId: string, title: string) => void;
  onSelectCode?: (file: string) => void;
  onSelectAdr?: (adrId: string) => void;
  onOpenSettings?: () => void;
}

const defaultEpics: DiscoveredEpicNav[] = [
  {
    id: 'EC-core',
    title: 'AICO Core SDD Platform',
    status: 'In Progress',
    specs: [
      { id: 'SPEC-core-host-runtime', title: 'Host Runtime & Local HTTP/WS Server' },
      { id: 'SPEC-core-security-auth', title: 'LAN Security & Local Authentication' },
      { id: 'SPEC-core-local-storage', title: 'Local Storage & Embedded Engine Lifecycle' },
      { id: 'SPEC-core-discovery', title: 'Workspace & Multi-Project Discovery' },
      { id: 'SPEC-core-mcp-tools', title: 'Deterministic SDD Tool Registration' },
      { id: 'SPEC-core-webui-shell', title: 'WebUI Workspace Shell & Dockable Layout' },
      { id: 'SPEC-core-epic-hub', title: 'Single-Page Epic Hub & Lineage Graph' },
    ],
  },
  {
    id: 'EC-specs',
    title: 'AICO SDD Blueprints & Migration',
    status: 'Completed',
    specs: [
      { id: 'SPEC-specs-blueprint-standards', title: 'AICO SDD Blueprint Standards v0.1.2' },
      { id: 'SPEC-specs-skills-evolution', title: 'AICO Skills Evolution & Wave-Internal Tasks' },
      { id: 'SPEC-specs-migration-engine', title: 'AICO Spec Migration Engine v0.1.2' },
    ],
  },
];

const defaultFeatures: DiscoveredFeatureNav[] = [
  { id: 'core-host-runtime', name: 'Host Runtime & Local Server', epicId: 'EC-core' },
  { id: 'core-security-auth', name: 'LAN Security & Local Auth', epicId: 'EC-core' },
  { id: 'core-local-storage', name: 'Embedded Storage Engines', epicId: 'EC-core' },
  { id: 'core-discovery', name: 'Multi-Project Discovery', epicId: 'EC-core' },
  { id: 'core-mcp-tools', name: 'Deterministic SDD Tools', epicId: 'EC-core' },
  { id: 'core-webui-shell', name: 'WebUI Shell & Dockable Panels', epicId: 'EC-core' },
  { id: 'core-epic-hub', name: 'Single-Page Epic Hub & Graph', epicId: 'EC-core' },
  { id: 'specs-blueprint-standards', name: 'Blueprint Standards v0.1.2', epicId: 'EC-specs' },
  { id: 'specs-skills-evolution', name: 'Skills Evolution & Wave Tasks', epicId: 'EC-specs' },
  { id: 'specs-migration-engine', name: 'Migration Engine v0.1.2', epicId: 'EC-specs' },
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

// @implements SPEC-CORE-006::REQ-001
// @implements SPEC-CORE-006::REQ-002
// @implements SPEC-CORE-006::REQ-008
// @implements SPEC-CORE-006::REQ-012
// @implements SPEC-CORE-006::REQ-013
// @implements SPEC-CORE-007::REQ-001
export const ShellLayout: React.FC<ShellLayoutProps> = ({
  children,
  isMobile = false,
  epics = defaultEpics,
  features = defaultFeatures,
  adrs = defaultAdrs,
  onSelectEpic,
  onSelectFeature,
  onSelectSpec,
  onSelectCode,
  onSelectAdr,
  onOpenSettings,
}) => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
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

  // Compile all specs across all epics
  const allSpecs = epics.flatMap((e) =>
    (e.specs || []).map((s) => ({
      ...s,
      epicId: e.id,
    }))
  );

  const q = searchQuery.trim().toLowerCase();

  // Filter items in each category
  const filteredEpics = epics.filter(
    (e) => !q || e.id.toLowerCase().includes(q) || e.title.toLowerCase().includes(q)
  );

  const filteredFeatures = features.filter(
    (f) =>
      !q ||
      f.id.toLowerCase().includes(q) ||
      f.name.toLowerCase().includes(q) ||
      f.epicId.toLowerCase().includes(q)
  );

  const filteredSpecs = allSpecs.filter(
    (s) =>
      !q ||
      s.id.toLowerCase().includes(q) ||
      s.title.toLowerCase().includes(q) ||
      s.epicId.toLowerCase().includes(q)
  );

  const filteredCode = defaultCodeFiles.filter((c) => !q || c.toLowerCase().includes(q));

  const filteredAdrs = adrs.filter(
    (a) => !q || a.id.toLowerCase().includes(q) || a.title.toLowerCase().includes(q)
  );

  const renderNavContent = () => (
    <div className="flex flex-col h-full bg-zinc-900 border-r border-zinc-800 text-zinc-300 select-none">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-zinc-800 bg-zinc-950/40">
        <div className="flex items-center gap-2 font-bold text-zinc-100 text-xs tracking-wide">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <span>AICO WORKSPACE</span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
          v0.1.1
        </span>
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
              {openSections.epics ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
            {openSections.epics && (
              <div className="pl-6 pr-2 py-1 space-y-1 text-zinc-400">
                {filteredEpics.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 italic px-2 py-1">No matches</div>
                ) : (
                  filteredEpics.map((epic) => (
                    <div
                      key={epic.id}
                      onClick={() => onSelectEpic?.(epic.id)}
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
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-400" />
                <span>Features</span>
                {q && (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({filteredFeatures.length})
                  </span>
                )}
              </div>
              {openSections.features ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
            {openSections.features && (
              <div className="pl-6 pr-2 py-1 space-y-1 text-zinc-400">
                {filteredFeatures.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 italic px-2 py-1">No matches</div>
                ) : (
                  filteredFeatures.map((feat) => (
                    <div
                      key={feat.id}
                      onClick={() => onSelectFeature?.(feat.id, feat.name)}
                      className="py-1 px-2 hover:bg-zinc-800/60 rounded cursor-pointer flex items-center justify-between group transition-colors"
                      title={`${feat.id}: ${feat.name} (${feat.epicId})`}
                    >
                      <div className="truncate flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-zinc-300 font-medium shrink-0">{feat.id}</span>
                        <span className="text-zinc-500 text-[10px] truncate">{feat.name}</span>
                      </div>
                      {(feat.isStandalone || feat.epicId === 'standalone') && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-400 border border-indigo-800 shrink-0 ml-1">
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
              {openSections.specifications ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
            {openSections.specifications && (
              <div className="pl-6 pr-2 py-1 space-y-1 text-zinc-400">
                {filteredSpecs.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 italic px-2 py-1">No matches</div>
                ) : (
                  filteredSpecs.map((sp) => (
                    <div
                      key={sp.id}
                      onClick={() => onSelectSpec?.(sp.id, sp.title)}
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
              {openSections.code ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
            {openSections.code && (
              <div className="pl-6 pr-2 py-1 space-y-1 text-zinc-400">
                {filteredCode.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 italic px-2 py-1">No matches</div>
                ) : (
                  filteredCode.map((file) => (
                    <div
                      key={file}
                      onClick={() => onSelectCode?.(file)}
                      className="flex items-center gap-1.5 py-1 px-2 hover:bg-zinc-800/60 rounded cursor-pointer text-zinc-400 hover:text-zinc-200 transition-colors truncate"
                      title={file}
                    >
                      <Folder className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                      <span className="truncate">{file}</span>
                    </div>
                  ))
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
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>ADRs</span>
                {q && (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({filteredAdrs.length})
                  </span>
                )}
              </div>
              {openSections.adrs ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
            {openSections.adrs && (
              <div className="pl-6 pr-2 py-1 space-y-1 text-zinc-400">
                {filteredAdrs.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 italic px-2 py-1">No matches</div>
                ) : (
                  filteredAdrs.map((adr) => (
                    <div
                      key={adr.id}
                      onClick={() => onSelectAdr?.(adr.id)}
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

      {/* Sidebar Bottom: Activity Monitor & Settings Button */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950/60 space-y-2">
        <ActivityMonitor />

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
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 font-sans text-zinc-100">
      {/* Desktop Full-Height Sidebar */}
      {!isMobile && (
        <aside
          data-testid="left-sidebar"
          className="h-screen w-64 flex-shrink-0 z-20 flex flex-col"
        >
          {renderNavContent()}
        </aside>
      )}

      {/* Mobile Drawer Trigger & Slide-Over */}
      {isMobile && (
        <>
          <button
            data-testid="mobile-drawer-toggle"
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="fixed top-3 left-3 z-40 p-2 rounded-lg bg-zinc-800 text-zinc-100 shadow-lg border border-zinc-700"
          >
            <Menu className="w-5 h-5" />
          </button>

          {mobileDrawerOpen && (
            <div
              data-testid="mobile-drawer"
              className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileDrawerOpen(false)}
            >
              <div
                className="w-72 h-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {renderNavContent()}
              </div>
            </div>
          )}
        </>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-zinc-950 relative">
        {children}
      </main>
    </div>
  );
};
