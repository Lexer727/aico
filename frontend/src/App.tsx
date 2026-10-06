import React, { useState, useEffect, useCallback } from 'react';
import { ShellLayout, type DiscoveredEpicNav, type DiscoveredFeatureNav, type DiscoveredAdrNav } from './components/layout/ShellLayout';
import { DockablePanel } from './components/layout/DockablePanel';
import { TabBar } from './components/navigation/TabBar';
import { ProjectSwitcher } from './components/navigation/ProjectSwitcher';
import { ConnectionStatusBanner } from './components/navigation/ConnectionStatusBanner';
import { SettingsModal } from './components/settings/SettingsModal';
import { TerminalConsole } from './components/terminal/TerminalConsole';
import { DashboardView } from './features/dashboard/DashboardView';
import { EpicHubView, type EpicData } from './features/epic-hub/EpicHubView';
import { FeatureViewer, type FeatureData } from './features/feature-viewer/FeatureViewer';
import { SpecViewer } from './features/spec-viewer/SpecViewer';
import { CodeViewer } from './features/code-viewer/CodeViewer';
import { AdrViewer } from './features/adr-viewer/AdrViewer';
import { VisualLineageCanvas, type GraphNode, type GraphEdge } from './features/epic-hub/VisualLineageCanvas';
import { WebSocketProvider, useWebSocket } from './context/WebSocketContext';
import { useTabStore, type TabItem } from './stores/useTabStore';
import { useDockStore } from './stores/useDockStore';

const mockProjects = [
  { id: 'aico-core', name: 'AICO Core SDD' },
  { id: 'aico-specs', name: 'AICO Specs' },
];

const mockEpicsData: Record<string, EpicData> = {
  'EC-core': {
    id: 'EC-core',
    title: 'AICO Core SDD Platform',
    status: 'In Progress',
    verifiedCount: 48,
    totalCount: 48,
    sections: {
      overview: 'Autonomous Intelligent Code Orchestrator (AICO) host runtime and embedded databases.',
      brainstorm: 'Local-first architecture, LanceDB + Kùzu embedded engines, zero external services.',
      specifications: '7 Approved EARS Specifications: Host Runtime, Security, Storage, Discovery, MCP, WebUI, Epic Hub.',
      deepDive: 'Dependency graph traversal and module boundary designations.',
      taskPlan: 'DAG of vertical tracer-bullet tasks advancing active frontiers across 7 waves.',
      assets: 'Multi-modal reference designs, mockups, and assets.',
    },
  },
  'EC-specs': {
    id: 'EC-specs',
    title: 'AICO SDD Blueprints & Migration',
    status: 'Completed',
    verifiedCount: 12,
    totalCount: 12,
    sections: {
      overview: 'Standardization of SDD artifacts to v0.1.2, universal line-1 frontmatter, and 6-state DAG tracking.',
      brainstorm: 'Non-destructive migration engine, AST YAML validation, zero amnesia across revisions.',
      specifications: '3 Approved EARS Specifications: Blueprint Standards, Skills Evolution, Migration Engine.',
      deepDive: 'File traversal boundaries, regex/AST frontmatter transformations, backward compatibility.',
      taskPlan: 'DAG task breakdown for blueprint normalization, skill authoring, and migration toolchain.',
      assets: 'SDD blueprint reference templates and migration validation reports.',
    },
  },
};

const defaultFeaturesData: Record<string, FeatureData> = {
  'core-host-runtime': {
    id: 'core-host-runtime',
    name: 'Host Runtime & Local HTTP/WS Server',
    epicId: 'EC-core',
    specId: 'SPEC-core-host-runtime',
    specTitle: 'Host Runtime & Local HTTP/WebSocket Server',
    planId: 'PLAN-core-host-runtime',
    planTitle: 'Host Runtime & Local Axum Server',
    status: 'Completed',
    order: 1,
  },
  'core-security-auth': {
    id: 'core-security-auth',
    name: 'LAN Security & Local Authentication',
    epicId: 'EC-core',
    specId: 'SPEC-core-security-auth',
    specTitle: 'LAN Security & Local Authentication',
    planId: 'PLAN-core-security-auth',
    planTitle: 'LAN Security & Local Authentication',
    status: 'Completed',
    order: 2,
  },
  'core-local-storage': {
    id: 'core-local-storage',
    name: 'Local Storage & Embedded Engine Lifecycle',
    epicId: 'EC-core',
    specId: 'SPEC-core-local-storage',
    specTitle: 'Local Storage & Embedded Engine Lifecycle',
    planId: 'PLAN-core-local-storage',
    planTitle: 'Local Storage & Embedded Engine Lifecycle',
    status: 'Completed',
    order: 3,
  },
  'core-discovery': {
    id: 'core-discovery',
    name: 'Workspace & Multi-Project Discovery',
    epicId: 'EC-core',
    specId: 'SPEC-core-discovery',
    specTitle: 'Workspace & Multi-Project Discovery',
    planId: 'PLAN-core-discovery',
    planTitle: 'Workspace & Multi-Project Discovery',
    status: 'Completed',
    order: 4,
  },
  'core-mcp-tools': {
    id: 'core-mcp-tools',
    name: 'Deterministic SDD Tool Registration',
    epicId: 'EC-core',
    specId: 'SPEC-core-mcp-tools',
    specTitle: 'Deterministic SDD Tool Registration',
    planId: 'PLAN-core-mcp-tools',
    planTitle: 'Deterministic SDD Tool Registration',
    status: 'Completed',
    order: 5,
  },
  'core-webui-shell': {
    id: 'core-webui-shell',
    name: 'WebUI Workspace Shell & Dockable Layout',
    epicId: 'EC-core',
    specId: 'SPEC-core-webui-shell',
    specTitle: 'WebUI Workspace Shell & Dockable Layout',
    planId: 'PLAN-core-webui-shell',
    planTitle: 'WebUI Workspace Shell & Dockable Layout',
    status: 'Completed',
    order: 6,
  },
  'core-epic-hub': {
    id: 'core-epic-hub',
    name: 'Single-Page Epic Hub & Lineage Graph',
    epicId: 'EC-core',
    specId: 'SPEC-core-epic-hub',
    specTitle: 'Single-Page Epic Hub & Lineage Graph',
    planId: 'PLAN-core-epic-hub',
    planTitle: 'Single-Page Epic Hub & Lineage Graph',
    status: 'Completed',
    order: 7,
  },
  'specs-blueprint-standards': {
    id: 'specs-blueprint-standards',
    name: 'AICO SDD Blueprint Standards v0.1.2',
    epicId: 'EC-specs',
    specId: 'SPEC-specs-blueprint-standards',
    specTitle: 'AICO SDD Blueprint Standards v0.1.2',
    planId: 'PLAN-specs-blueprint-standards',
    planTitle: 'AICO SDD Blueprint Standards v0.1.2',
    status: 'Completed',
    order: 1,
  },
  'specs-skills-evolution': {
    id: 'specs-skills-evolution',
    name: 'AICO Skills Evolution & Wave-Internal Tasks',
    epicId: 'EC-specs',
    specId: 'SPEC-specs-skills-evolution',
    specTitle: 'AICO Skills Evolution & Wave-Internal Tasks',
    planId: 'PLAN-specs-skills-evolution',
    planTitle: 'AICO Skills Evolution & Wave-Internal Tasks',
    status: 'Completed',
    order: 2,
  },
  'specs-migration-engine': {
    id: 'specs-migration-engine',
    name: 'AICO Spec Migration Engine v0.1.2',
    epicId: 'EC-specs',
    specId: 'SPEC-specs-migration-engine',
    specTitle: 'AICO Spec Migration Engine v0.1.2',
    planId: 'PLAN-specs-migration-engine',
    planTitle: 'AICO Spec Migration Engine v0.1.2',
    status: 'Completed',
    order: 3,
  },
};

const mockNodes: GraphNode[] = [
  { id: 'epic-1', type: 'epic', label: 'Epic 001', isFrontier: false },
  { id: 'epic-2', type: 'epic', label: 'Epic 002', isFrontier: false },
  { id: 'feat-1', type: 'task', label: '01-host-runtime', isFrontier: false },
  { id: 'feat-6', type: 'task', label: '06-webui-shell', isFrontier: false },
  { id: 'feat-7', type: 'task', label: '07-epic-hub', isFrontier: true },
  { id: 'spec-1', type: 'spec', label: 'SPEC-CORE-001', isFrontier: false },
  { id: 'spec-6', type: 'spec', label: 'SPEC-CORE-006', isFrontier: false },
  { id: 'code-1', type: 'code', label: 'ShellLayout.tsx', isFrontier: false },
];

const mockEdges: GraphEdge[] = [
  { id: 'e1', source: 'epic-1', target: 'feat-1' },
  { id: 'e2', source: 'epic-1', target: 'feat-6' },
  { id: 'e3', source: 'epic-1', target: 'feat-7' },
  { id: 'e4', source: 'feat-1', target: 'spec-1' },
  { id: 'e5', source: 'feat-6', target: 'spec-6' },
  { id: 'e6', source: 'spec-6', target: 'code-1' },
];

const MainWorkspace: React.FC = () => {
  const { status, reconnect, lastMessage } = useWebSocket();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [projects, setProjects] = useState(mockProjects);
  const [discoveredEpics, setDiscoveredEpics] = useState<DiscoveredEpicNav[]>([]);
  const [discoveredFeatures, setDiscoveredFeatures] = useState<DiscoveredFeatureNav[]>([]);
  const [discoveredAdrs, setDiscoveredAdrs] = useState<DiscoveredAdrNav[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const { openTab, activeProjectId, setActiveProject, activeTabId, getProjectTabs } = useTabStore();
  const { position } = useDockStore();

  // Dynamic Epic discovery from Axum Server REST API
  const fetchEpics = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/epics');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped: DiscoveredEpicNav[] = data.map((e: {
            id: string;
            title: string;
            status: string;
            specs?: Array<{ id: string; title: string; status?: string }>;
            features?: Array<{ id: string; name: string }>;
          }) => ({
            id: e.id,
            title: e.title,
            status: e.status,
            specs: e.specs || [],
            features: e.features || [],
          }));
          setDiscoveredEpics(mapped);
        }
      }
    } catch {
      // Offline fallback
    }
  }, []);

  const fetchFeatures = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/features');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped: DiscoveredFeatureNav[] = data.map((f: {
            id: string;
            name: string;
            epic_id?: string;
            epicId?: string;
            is_standalone?: boolean;
            isStandalone?: boolean;
          }) => ({
            id: f.id,
            name: f.name || f.id,
            epicId: f.epic_id || f.epicId || '',
            isStandalone: f.is_standalone ?? f.isStandalone ?? false,
          }));
          setDiscoveredFeatures(mapped);
        }
      }
    } catch {
      // Offline fallback
    }
  }, []);

  const fetchAdrs = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/adrs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setDiscoveredAdrs(data);
        }
      }
    } catch {
      // Offline fallback
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/projects');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((p: { id: string; name?: string }) => ({
            id: p.id,
            name: p.name || p.id,
          }));
          setProjects(mapped);
          if (activeProjectId === 'default' || !mapped.some((p: { id: string }) => p.id === activeProjectId)) {
            setActiveProject(mapped[0].id);
          }
        }
      }
    } catch {
      // Offline fallback
    }
  }, [activeProjectId, setActiveProject]);

  useEffect(() => {
    fetchProjects();
    fetchEpics();
    fetchFeatures();
    fetchAdrs();
  }, [fetchProjects, fetchEpics, fetchFeatures, fetchAdrs]);

  useEffect(() => {
    if (lastMessage && typeof lastMessage === 'object') {
      const msg = lastMessage as { topic?: string; payload?: string };
      if (msg.topic === 'active_project_changed' && msg.payload) {
        setActiveProject(msg.payload);
        fetchEpics();
        fetchFeatures();
        fetchAdrs();
      } else if (msg.topic === 'projects_updated') {
        fetchProjects();
        fetchEpics();
        fetchFeatures();
        fetchAdrs();
      }
    }
  }, [lastMessage, setActiveProject, fetchProjects, fetchEpics, fetchFeatures, fetchAdrs]);

  // Tab management helpers
  const handleOpenEpic = (epicId: string) => {
    openTab(activeProjectId, {
      id: epicId,
      title: epicId,
      type: 'epic',
    });
  };

  const handleOpenFeature = (featureId: string, name?: string) => {
    openTab(activeProjectId, {
      id: featureId,
      title: name || featureId,
      type: 'feature',
    });
  };

  const handleOpenSpec = (specId: string, title?: string) => {
    openTab(activeProjectId, {
      id: specId,
      title: title || specId,
      type: 'spec',
    });
  };

  const handleOpenCode = (file: string) => {
    openTab(activeProjectId, {
      id: file,
      title: file.split('/').pop() || file,
      type: 'code',
      path: file,
    });
  };

  const handleOpenAdr = (adrId: string) => {
    openTab(activeProjectId, {
      id: adrId,
      title: adrId,
      type: 'adr',
    });
  };

  // Find active tab object
  const projectTabs = getProjectTabs(activeProjectId);
  const activeTab: TabItem | undefined = projectTabs.find((t) => t.id === activeTabId);

  // Render canvas content based on active tab
  const renderActiveContent = () => {
    if (!activeTab || activeTab.id === 'dashboard') {
      return (
        <DashboardView
          onOpenEpic={handleOpenEpic}
          onOpenSpec={handleOpenSpec}
        />
      );
    }

    if (activeTab.type === 'epic') {
      const currentEpicData = mockEpicsData[activeTab.id] || {
        id: activeTab.id,
        title: activeTab.title,
        status: 'In Progress',
        verifiedCount: 10,
        totalCount: 10,
        sections: {
          overview: `Overview of ${activeTab.title}`,
          brainstorm: `Brainstorm exploration for ${activeTab.title}`,
          specifications: `Specifications for ${activeTab.title}`,
          deepDive: `Deep dive boundaries for ${activeTab.title}`,
          taskPlan: `DAG tasks for ${activeTab.title}`,
          assets: `Assets for ${activeTab.title}`,
        },
      };

      return (
        <div className="space-y-8">
          {/* Spatial 2-Column Epic Hub */}
          <EpicHubView
            epic={currentEpicData}
            onPopOut={(epicId, section) => {
              openTab(activeProjectId, {
                id: `${epicId}-${section}`,
                title: `${section.toUpperCase()} (${epicId})`,
                type: 'spec',
              });
            }}
            onOpenSpec={handleOpenSpec}
            onOpenFeature={handleOpenFeature}
            uploadedFiles={uploadedFiles}
            onFileUpload={(f) => setUploadedFiles((prev) => [...prev, f.name])}
          />

          {/* Visual Lineage Graph Canvas (Rendered at the very bottom) */}
          <div className="max-w-7xl mx-auto space-y-2 pt-4 border-t border-zinc-800/80">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Interactive Lineage Graph
            </h3>
            <VisualLineageCanvas nodes={mockNodes} edges={mockEdges} />
          </div>
        </div>
      );
    }

    if (activeTab.type === 'feature') {
      const featData = defaultFeaturesData[activeTab.id] || {
        id: activeTab.id,
        name: activeTab.title,
        epicId: 'EC-core',
        status: 'In Progress',
      };
      return (
        <FeatureViewer
          feature={featData}
          onOpenSpec={handleOpenSpec}
          onOpenPlan={(planId, title) => handleOpenSpec(planId, title)}
          onOpenAdr={handleOpenAdr}
        />
      );
    }

    if (activeTab.type === 'spec') {
      return (
        <SpecViewer
          specId={activeTab.id}
          title={activeTab.title}
          onBack={() => handleOpenEpic('001-aico-core')}
        />
      );
    }

    if (activeTab.type === 'code') {
      return <CodeViewer filePath={activeTab.path || activeTab.id} />;
    }

    if (activeTab.type === 'adr') {
      return <AdrViewer adrId={activeTab.id} />;
    }

    return (
      <DashboardView
        onOpenEpic={handleOpenEpic}
        onOpenSpec={handleOpenSpec}
      />
    );
  };

  return (
    <ShellLayout
      epics={discoveredEpics.length > 0 ? discoveredEpics : undefined}
      features={discoveredFeatures.length > 0 ? discoveredFeatures : undefined}
      adrs={discoveredAdrs.length > 0 ? discoveredAdrs : undefined}
      onSelectEpic={handleOpenEpic}
      onSelectFeature={handleOpenFeature}
      onSelectSpec={handleOpenSpec}
      onSelectCode={handleOpenCode}
      onSelectAdr={handleOpenAdr}
      onOpenSettings={() => setIsSettingsOpen(true)}
    >
      {/* Top Application Bar (Search removed per user request) */}
      <header className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 gap-4">
        <div className="flex items-center gap-3">
          <ProjectSwitcher projects={projects} />
        </div>

        <div className="flex items-center gap-3">
          <ConnectionStatusBanner status={status} onReconnect={reconnect} />
        </div>
      </header>

      {/* Project Tab Bar */}
      <TabBar />

      {/* Main Canvas Area */}
      <div
        className={`flex-1 flex overflow-hidden min-h-0 ${
          position === 'bottom' ? 'flex-col' : 'flex-row'
        }`}
      >
        {/* Central Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0 min-h-0">
          {renderActiveContent()}
        </div>

        {/* Dockable Auxiliary Panel - Terminals */}
        <DockablePanel title="Terminals">
          <TerminalConsole />
        </DockablePanel>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </ShellLayout>
  );
};

export const App: React.FC = () => {
  return (
    <WebSocketProvider>
      <MainWorkspace />
    </WebSocketProvider>
  );
};

export default App;
