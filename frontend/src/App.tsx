import React, { useState, useEffect, useCallback } from 'react';
import { ShellLayout, type DiscoveredEpicNav, type DiscoveredFeatureNav, type DiscoveredAdrNav } from './components/layout/ShellLayout';
import { DockablePanel } from './components/layout/DockablePanel';
import { TabBar } from './components/navigation/TabBar';
import { ProjectSwitcher } from './components/navigation/ProjectSwitcher';
import { HistoryNavButtons } from './components/navigation/HistoryNavButtons';
import { ConnectionStatusBanner } from './components/navigation/ConnectionStatusBanner';
import { SettingsModal } from './components/settings/SettingsModal';
import { TerminalConsole } from './components/terminal/TerminalConsole';
import { DashboardView } from './features/dashboard/DashboardView';
import { EpicHubView, type EpicData } from './features/epic-hub/EpicHubView';
import { FeatureViewer, type FeatureData } from './features/feature-viewer/FeatureViewer';
import { type DiscoveredEpic, type DiscoveredFeature, type DiscoveredAdr } from './features/feature-task-data';
import { SpecViewer } from './features/spec-viewer/SpecViewer';
import { PlanViewer } from './features/plan-viewer/PlanViewer';
import { DocumentViewer } from './features/document-viewer/DocumentViewer';
import { CodeViewer } from './features/code-viewer/CodeViewer';
import { AdrViewer } from './features/adr-viewer/AdrViewer';
import { GlossaryViewer } from './features/glossary-viewer/GlossaryViewer';
import { VisualLineageCanvas, type GraphNode, type GraphEdge } from './features/epic-hub/VisualLineageCanvas';
import { WebSocketProvider, useWebSocket } from './context/WebSocketContext';
import { useTabStore, type TabItem } from './stores/useTabStore';
import { useDockStore } from './stores/useDockStore';

if (typeof window !== 'undefined') {
  (window as any).__TAB_STORE__ = useTabStore;
}

const mockProjects = [
  { id: 'aico-core', name: 'AICO Core SDD' },
  { id: 'aico-specs', name: 'AICO Specs' },
];

const mockNodes: GraphNode[] = [
  { id: 'epic-1', type: 'epic', label: 'Epic 001', isFrontier: false },
  { id: 'epic-2', type: 'epic', label: 'Epic 002', isFrontier: false },
  { id: 'feat-1', type: 'task', label: '01-host-runtime', isFrontier: false },
  { id: 'feat-6', type: 'task', label: '06-webui-shell', isFrontier: false },
  { id: 'feat-7', type: 'task', label: '07-epic-hub', isFrontier: true },
  { id: 'spec-1', type: 'spec', label: 'spec-ft-core-host-runtime', isFrontier: false },
  { id: 'spec-6', type: 'spec', label: 'spec-ft-core-webui-shell', isFrontier: false },
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
  const [fullEpics, setFullEpics] = useState<DiscoveredEpic[]>([]);
  const [discoveredFeatures, setDiscoveredFeatures] = useState<DiscoveredFeatureNav[]>([]);
  const [fullFeatures, setFullFeatures] = useState<DiscoveredFeature[]>([]);
  const [discoveredAdrs, setDiscoveredAdrs] = useState<DiscoveredAdrNav[]>([]);
  const [fullAdrs, setFullAdrs] = useState<DiscoveredAdr[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const {
    openTab,
    activeProjectId,
    setActiveProject,
    activeTabId,
    getProjectTabs,
    goBack,
    goForward,
    reopenLastClosedTab,
  } = useTabStore();
  const { position } = useDockStore();

  // Dynamic Epic discovery from Axum Server REST API
  const fetchEpics = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/epics');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setFullEpics(data);
          const mapped: DiscoveredEpicNav[] = data.map((e: DiscoveredEpic) => ({
            id: e.id,
            title: e.title,
            status: e.status,
            specs: e.specs || [],
            features: (e.features || []).map((f) => ({ id: f.id, name: f.name })),
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
          setFullFeatures(data);
          const mapped: DiscoveredFeatureNav[] = data.map((f: DiscoveredFeature) => ({
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
          setFullAdrs(data);
          const mapped: DiscoveredAdrNav[] = data.map((a: DiscoveredAdr) => ({
            id: a.id,
            title: a.title,
            status: a.status,
          }));
          setDiscoveredAdrs(mapped);
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

  // Mouse Back / Forward button navigation (Mouse button 3 = Back, 4 = Forward)
  const lastNavTime = React.useRef(0);
  useEffect(() => {
    const handleMouseNav = (e: MouseEvent) => {
      if (e.button === 3) {
        // Back button
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - lastNavTime.current > 150) {
          lastNavTime.current = now;
          goBack();
        }
      } else if (e.button === 4) {
        // Forward button
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - lastNavTime.current > 150) {
          lastNavTime.current = now;
          goForward();
        }
      }
    };

    window.addEventListener('mouseup', handleMouseNav);
    window.addEventListener('auxclick', handleMouseNav);

    return () => {
      window.removeEventListener('mouseup', handleMouseNav);
      window.removeEventListener('auxclick', handleMouseNav);
    };
  }, [goBack, goForward]);

  // Keyboard navigation shortcuts: Alt + ArrowLeft (Back), Alt + ArrowRight (Forward), Ctrl+Shift+T / Ctrl+Alt+T (Reopen Closed Tab)
  useEffect(() => {
    const handleKeyNav = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        goForward();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 't' || e.key === 'T') && (e.shiftKey || e.altKey)) {
        e.preventDefault();
        reopenLastClosedTab();
      }
    };

    window.addEventListener('keydown', handleKeyNav);
    return () => window.removeEventListener('keydown', handleKeyNav);
  }, [goBack, goForward, reopenLastClosedTab]);

  // Tab management helpers - consistently use canonical IDs for title and id
  const handleOpenEpic = (epicId: string) => {
    openTab(activeProjectId, {
      id: epicId,
      title: epicId,
      type: 'epic',
    });
  };

  const handleOpenFeature = (featureId: string) => {
    openTab(activeProjectId, {
      id: featureId,
      title: featureId,
      type: 'feature',
    });
  };

  const handleOpenSpec = (specId: string) => {
    openTab(activeProjectId, {
      id: specId,
      title: specId,
      type: 'spec',
    });
  };

  const handleOpenPlan = (planId: string) => {
    openTab(activeProjectId, {
      id: planId,
      title: planId,
      type: 'plan',
    });
  };

  const handleOpenBrainstorm = (entityId: string) => {
    openTab(activeProjectId, {
      id: `brainstorm-${entityId}`,
      title: `brainstorm-${entityId}`,
      type: 'brainstorm',
    });
  };

  const handleOpenDeepDive = (entityId: string) => {
    openTab(activeProjectId, {
      id: `deepdive-${entityId}`,
      title: `deepdive-${entityId}`,
      type: 'deep_dive',
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

  const handleOpenGlossary = () => {
    openTab(activeProjectId, {
      id: 'glossary',
      title: 'glossary',
      type: 'glossary',
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
          epics={fullEpics}
          adrs={fullAdrs}
          onOpenEpic={handleOpenEpic}
          onOpenSpec={handleOpenSpec}
          onOpenGlossary={handleOpenGlossary}
          onOpenAdr={handleOpenAdr}
          ubiquitousLanguage={fullEpics[0]?.ubiquitous_language || fullEpics[0]?.ubiquitousLanguage}
        />
      );
    }

    if (activeTab.type === 'epic') {
      const foundEpic = fullEpics.find((e) => e.id.toLowerCase() === activeTab.id.toLowerCase());
      const currentEpicData: EpicData = foundEpic
        ? {
            id: foundEpic.id,
            title: foundEpic.title,
            status: foundEpic.status,
            order: foundEpic.order,
            executiveSummary: foundEpic.executive_summary || foundEpic.executiveSummary,
            brainstormContent: foundEpic.brainstorm_content || foundEpic.brainstormContent,
            deepdiveContent: foundEpic.deepdive_content || foundEpic.deepdiveContent,
            adrs: foundEpic.adrs,
            ubiquitousLanguage: foundEpic.ubiquitous_language || foundEpic.ubiquitousLanguage,
            features: foundEpic.features,
            specs: foundEpic.specs,
          }
        : {
            id: activeTab.id,
            title: activeTab.title,
            status: 'In Progress',
          };

      return (
        <div className="space-y-8">
          {/* Spatial 2-Column Epic Hub */}
          <EpicHubView
            epic={currentEpicData}
            allFeatures={fullFeatures}
            allAdrs={fullAdrs}
            onOpenAdr={handleOpenAdr}
            onPopOut={(epicId, section) => {
              if (section === 'terminology') {
                handleOpenGlossary();
              } else if (section === 'brainstorm') {
                handleOpenBrainstorm(epicId);
              } else if (section === 'deepDive') {
                handleOpenDeepDive(epicId);
              } else if (section === 'taskPlan') {
                handleOpenPlan(`plan-${epicId}`);
              } else {
                openTab(activeProjectId, {
                  id: `${epicId}-${section}`,
                  title: `${epicId}-${section}`,
                  type: 'spec',
                });
              }
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
      const foundFeat = fullFeatures.find((f) => f.id.toLowerCase() === activeTab.id.toLowerCase());
      const featData: FeatureData = foundFeat
        ? {
            id: foundFeat.id,
            name: foundFeat.name,
            epicId: foundFeat.is_standalone ? undefined : foundFeat.epic_id,
            isStandalone: foundFeat.is_standalone,
            status: foundFeat.status,
            order: foundFeat.order,
            specId: foundFeat.spec_id,
            specTitle: foundFeat.spec_title,
            planId: foundFeat.plan_id,
            planTitle: foundFeat.plan_title,
            description: foundFeat.description,
            in_scope: foundFeat.in_scope,
            out_of_scope: foundFeat.out_of_scope,
            requirements: foundFeat.requirements,
            test_seams: foundFeat.test_seams,
            adrs: foundFeat.adrs,
            tasks: foundFeat.tasks,
            brainstorm_content: foundFeat.brainstorm_content || foundFeat.brainstormContent,
            brainstormContent: foundFeat.brainstormContent || foundFeat.brainstorm_content,
            deepdive_content: foundFeat.deepdive_content || foundFeat.deepdiveContent,
            deepdiveContent: foundFeat.deepdiveContent || foundFeat.deepdive_content,
            ubiquitous_language: foundFeat.ubiquitous_language || foundFeat.ubiquitousLanguage,
            repositories: foundFeat.repositories,
          }
        : {
            id: activeTab.id,
            name: activeTab.title,
            status: 'In Progress',
            isStandalone: activeTab.id.includes('fast-trace'),
          };

      const specId = featData.specId || `spec-${featData.id}`;
      const planId = featData.planId || `plan-${featData.id}`;

      return (
        <FeatureViewer
          feature={featData}
          allFeatures={fullFeatures}
          allAdrs={fullAdrs}
          onOpenEpic={handleOpenEpic}
          onOpenSpec={handleOpenSpec}
          onOpenPlan={handleOpenPlan}
          onOpenAdr={handleOpenAdr}
          onPopOut={(featId, section) => {
            if (section === 'terminology') {
              handleOpenGlossary();
            } else if (section === 'brainstorm') {
              handleOpenBrainstorm(featId);
            } else if (section === 'deepDive') {
              handleOpenDeepDive(featId);
            } else if (section === 'specifications') {
              handleOpenSpec(specId);
            } else if (section === 'taskPlan') {
              handleOpenPlan(planId);
            } else {
              openTab(activeProjectId, {
                id: `${featId}-${section}`,
                title: `${featId}-${section}`,
                type: 'spec',
              });
            }
          }}
        />
      );
    }

    if (activeTab.type === 'plan') {
      return (
        <PlanViewer
          planId={activeTab.id}
          title={activeTab.title}
          allFeatures={fullFeatures}
          onOpenEpic={handleOpenEpic}
          onOpenFeature={handleOpenFeature}
          onOpenSpec={handleOpenSpec}
          onOpenAdr={handleOpenAdr}
        />
      );
    }

    if (activeTab.type === 'brainstorm' || activeTab.type === 'deep_dive') {
      return (
        <DocumentViewer
          docId={activeTab.id}
          docType={activeTab.type}
          title={activeTab.title}
          onOpenEpic={handleOpenEpic}
          onOpenFeature={handleOpenFeature}
          onOpenSpec={handleOpenSpec}
          onOpenPlan={handleOpenPlan}
          onOpenAdr={handleOpenAdr}
        />
      );
    }

    if (activeTab.type === 'glossary') {
      return (
        <GlossaryViewer
          terms={fullEpics[0]?.ubiquitous_language || fullEpics[0]?.ubiquitousLanguage}
        />
      );
    }

    if (activeTab.type === 'spec') {
      return (
        <SpecViewer
          specId={activeTab.id}
          title={activeTab.title}
          onOpenEpic={handleOpenEpic}
          onOpenFeature={handleOpenFeature}
          onOpenAdr={handleOpenAdr}
          onOpenPlan={handleOpenPlan}
        />
      );
    }

    if (activeTab.type === 'code') {
      return <CodeViewer filePath={activeTab.path || activeTab.id} />;
    }

    if (activeTab.type === 'adr') {
      return (
        <AdrViewer
          adrId={activeTab.id}
          onOpenEpic={handleOpenEpic}
          onOpenFeature={handleOpenFeature}
        />
      );
    }

    return (
      <DashboardView
        epics={fullEpics}
        adrs={fullAdrs}
        onOpenEpic={handleOpenEpic}
        onOpenSpec={handleOpenSpec}
        onOpenGlossary={handleOpenGlossary}
        onOpenAdr={handleOpenAdr}
        ubiquitousLanguage={fullEpics[0]?.ubiquitous_language || fullEpics[0]?.ubiquitousLanguage}
      />
    );
  };

  const contentAreaRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTop = 0;
    }
  }, [activeTabId]);

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
      {/* Top Application Bar */}
      <header className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 gap-4">
        <div className="flex items-center gap-2">
          <HistoryNavButtons />
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
        <div ref={contentAreaRef} className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0 min-h-0">
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
