import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShellLayout,
  type DiscoveredEpicNav,
  type DiscoveredFeatureNav,
  type DiscoveredAdrNav,
  type DiscoveredCodeFileNav,
} from './components/layout/ShellLayout';
import { DockablePanel } from './components/layout/DockablePanel';
import { TabBar } from './components/navigation/TabBar';
import { ProjectSwitcher } from './components/navigation/ProjectSwitcher';
import { HistoryNavButtons } from './components/navigation/HistoryNavButtons';
import { ConnectionStatusBanner } from './components/navigation/ConnectionStatusBanner';
import { SettingsModal } from './components/settings/SettingsModal';
import { TerminalConsole } from './components/terminal/TerminalConsole';
import { OmniSearchModal, type SearchResultItem } from './components/search/OmniSearchModal';
import { createSearchIndex } from './utils/searchEngine';
import { normalizeWorkspacePath } from './utils/pathUtils';
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
import { AssetViewer } from './features/assets/AssetViewer';
import type { DiscoveredAssetInfo } from './features/assets/AssetPanel';
import { VisualLineageCanvas, type GraphNode, type GraphEdge } from './features/epic-hub/VisualLineageCanvas';
import { WebSocketProvider, useWebSocket } from './context/WebSocketContext';
import { useTabStore, getWindowId, type TabItem } from './stores/useTabStore';
import { useDockStore } from './stores/useDockStore';
import { MobilePairingModal } from './components/navigation/MobilePairingModal';
import { DesktopWindowSwitcher } from './components/navigation/DesktopWindowSwitcher';
import { Search, QrCode } from 'lucide-react';

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

// @implements ft-core-code-navigation-and-search::TASK-CORE-013-5::REQ-001
// @implements ft-core-code-navigation-and-search::TASK-CORE-013-5::REQ-003
// @implements ft-core-code-navigation-and-search::TASK-CORE-013-5::REQ-006
// @implements ft-core-code-navigation-and-search::TASK-CORE-013-5::REQ-007
// @implements ft-core-code-navigation-and-search::TASK-CORE-013-5::REQ-008
export const MainWorkspace: React.FC = () => {
  const { status, reconnect, sendMessage, lastMessage } = useWebSocket();
  const [windowId] = useState<string>(() => getWindowId());
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [targetWindowId, setTargetWindowId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('win') || '';
  });
  const initialWinRef = React.useRef<string>(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('win') || '' : ''
  );
  const pairedNotifiedRef = React.useRef<boolean>(false);
  const isRemoteSyncRef = React.useRef<boolean>(false);
  const hasReceivedInitialSyncRef = React.useRef<boolean>(false);
  const [activeMobileView, setActiveMobileView] = useState<'tree' | 'main' | 'terminal'>('main');
  const [isMobileMode, setIsMobileMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('companion') === 'true' || params.has('win') || params.has('token')) {
      return true;
    }
    if (window.innerWidth < 768) return true;
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      return true;
    }
    return false;
  });

  const [desktopWindows, setDesktopWindows] = useState<Record<string, {
    windowId: string;
    title?: string;
    activeTabId?: string | null;
    tabs?: TabItem[];
    activeProject?: string;
    lastSeen: number;
  }>>({});

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [projects, setProjects] = useState(mockProjects);
  const [discoveredEpics, setDiscoveredEpics] = useState<DiscoveredEpicNav[]>([]);
  const [fullEpics, setFullEpics] = useState<DiscoveredEpic[]>([]);
  const [discoveredFeatures, setDiscoveredFeatures] = useState<DiscoveredFeatureNav[]>([]);
  const [fullFeatures, setFullFeatures] = useState<DiscoveredFeature[]>([]);
  const [discoveredAdrs, setDiscoveredAdrs] = useState<DiscoveredAdrNav[]>([]);
  const [fullAdrs, setFullAdrs] = useState<DiscoveredAdr[]>([]);
  const [codeFiles, setCodeFiles] = useState<DiscoveredCodeFileNav[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const {
    openTab,
    closeTab,
    activeProjectId,
    setActiveProject,
    activeTabId,
    tabsByProject,
    getProjectTabs,
    goBack,
    goForward,
    reopenLastClosedTab,
  } = useTabStore();
  const { position } = useDockStore();
  const effectivePosition = isMobileMode ? 'bottom' : position;

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
            status: f.status,
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
          const mapped = data.map((p: { id: string; name?: string; specs_path?: string }) => ({
            id: p.id,
            name: p.name || p.id,
            specs_path: p.specs_path,
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

  const fetchCodeFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/code/files');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCodeFiles(data);
        }
      }
    } catch {
      // Offline fallback
    }
  }, []);

  // @implements ft-core-webui-shell::TASK-CORE-006-29::REQ-016
  const handleRefreshWorkspace = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchProjects(), fetchEpics(), fetchFeatures(), fetchAdrs(), fetchCodeFiles()]);
      setWorkspaceRefreshKey((prev) => prev + 1);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }, [fetchProjects, fetchEpics, fetchFeatures, fetchAdrs, fetchCodeFiles]);

  useEffect(() => {
    fetchProjects();
    fetchEpics();
    fetchFeatures();
    fetchAdrs();
    fetchCodeFiles();
  }, [fetchProjects, fetchEpics, fetchFeatures, fetchAdrs, fetchCodeFiles]);

  useEffect(() => {
    if (lastMessage && typeof lastMessage === 'object') {
      const msg = lastMessage as { topic?: string; payload?: string };
      if (msg.topic === 'active_project_changed' && msg.payload) {
        setActiveProject(msg.payload);
        fetchEpics();
        fetchFeatures();
        fetchAdrs();
        fetchCodeFiles();
      } else if (msg.topic === 'projects_updated') {
        fetchProjects();
        fetchEpics();
        fetchFeatures();
        fetchAdrs();
        fetchCodeFiles();
      }
    }
  }, [lastMessage, setActiveProject, fetchProjects, fetchEpics, fetchFeatures, fetchAdrs, fetchCodeFiles]);

  // Dynamic mobile mode detection on viewport resize or URL query
  useEffect(() => {
    const checkMobile = () => {
      const params = new URLSearchParams(window.location.search);
      const isExplicitCompanion = params.get('companion') === 'true' || params.has('win') || params.has('token');
      const isNarrow = window.innerWidth < 768;
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobileMode(isExplicitCompanion || isNarrow || isMobileUA);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // @implements ft-core-webui-shell::TASK-CORE-006-15::REQ-018
  // Desktop: Broadcast window presence and state periodically and on tab changes
  useEffect(() => {
    if (isMobileMode) return;
    const broadcastWindowState = () => {
      const state = useTabStore.getState();
      const currentTabs = state.getProjectTabs(state.activeProjectId);
      const curActiveTab = currentTabs.find((t) => t.id === state.activeTabId);
      const title = curActiveTab ? curActiveTab.title : 'Workspace';
      sendMessage('desktop_window_state', {
        windowId,
        title,
        activeTabId: state.activeTabId,
        tabs: currentTabs,
        activeProject: state.activeProjectId,
      });
    };
    broadcastWindowState();
    const interval = setInterval(broadcastWindowState, 3000);
    return () => clearInterval(interval);
  }, [isMobileMode, windowId, sendMessage, activeTabId, activeProjectId, tabsByProject]);

  // @implements ft-core-webui-shell::TASK-CORE-006-15::REQ-018
  // @implements ft-core-webui-shell::TASK-CORE-006-17::REQ-019
  // Desktop: Respond to companion requests, pairing notifications, and remote tab modifications
  useEffect(() => {
    if (isMobileMode || !lastMessage || typeof lastMessage !== 'object') return;
    const msg = lastMessage as { topic?: string; payload?: unknown };
    if (msg.topic === 'companion_paired') {
      try {
        const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
        if (!payload?.windowId || payload.windowId === windowId) {
          setIsPairingOpen(false);
        }
      } catch {
        // ignore
      }
    } else if (msg.topic === 'request_desktop_windows') {
      const state = useTabStore.getState();
      const currentTabs = state.getProjectTabs(state.activeProjectId);
      const curActiveTab = currentTabs.find((t) => t.id === state.activeTabId);
      const title = curActiveTab ? curActiveTab.title : 'Workspace';
      sendMessage('desktop_window_state', {
        windowId,
        title,
        activeTabId: state.activeTabId,
        tabs: currentTabs,
        activeProject: state.activeProjectId,
      });
    } else if (msg.topic === 'companion_tabs_update') {
      try {
        const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
        if (payload?.targetWindowId === windowId) {
          const activeProj = payload.activeProject || activeProjectId;
          const curTabsByProject = useTabStore.getState().tabsByProject;
          useTabStore.getState().replaceState({
            activeProjectId: activeProj,
            tabsByProject: {
              ...curTabsByProject,
              [activeProj]: payload.tabs || [],
            },
            activeTabId: payload.activeTabId ?? null,
          });
        }
      } catch {
        // ignore
      }
    }
  }, [isMobileMode, lastMessage, windowId, activeProjectId, sendMessage]);

  // @implements ft-core-webui-shell::TASK-CORE-006-17::REQ-019
  // Mobile Companion: Notify desktop upon WebSocket connection that pairing is complete
  useEffect(() => {
    if (isMobileMode && status === 'connected' && initialWinRef.current && !pairedNotifiedRef.current) {
      pairedNotifiedRef.current = true;
      sendMessage('companion_paired', { windowId: initialWinRef.current });
    }
  }, [isMobileMode, status, sendMessage]);

  // @implements ft-core-webui-shell::TASK-CORE-006-26::REQ-020
  // Mobile Companion: Request active desktop windows on mount
  useEffect(() => {
    if (!isMobileMode) return;
    sendMessage('request_desktop_windows', { from: 'companion' });
  }, [isMobileMode, sendMessage]);

  // @implements ft-core-webui-shell::TASK-CORE-006-26::REQ-020
  // Mobile Companion: Discover desktop windows and mirror target window tabs
  useEffect(() => {
    if (!isMobileMode || !lastMessage || typeof lastMessage !== 'object') return;
    const msg = lastMessage as { topic?: string; payload?: unknown };
    if (msg.topic === 'desktop_window_state') {
      try {
        const data = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
        if (data && data.windowId) {
          setDesktopWindows((prev) => ({
            ...prev,
            [data.windowId]: { ...data, lastSeen: Date.now() },
          }));
          const effectiveTarget = targetWindowId || data.windowId;
          if (!targetWindowId) {
            setTargetWindowId(data.windowId);
          }
          if (data.windowId === effectiveTarget && Array.isArray(data.tabs)) {
            hasReceivedInitialSyncRef.current = true;
            isRemoteSyncRef.current = true;
            const activeProj = data.activeProject || 'default';
            const curTabsByProject = useTabStore.getState().tabsByProject;
            useTabStore.getState().replaceState({
              activeProjectId: activeProj,
              tabsByProject: {
                ...curTabsByProject,
                [activeProj]: data.tabs,
              },
              activeTabId: data.activeTabId ?? null,
            });
          }
        }
      } catch {
        // ignore
      }
    }
  }, [isMobileMode, lastMessage, targetWindowId]);

  // @implements ft-core-webui-shell::TASK-CORE-006-26::REQ-020
  // Mobile Companion: Dispatch local tab modifications back to target desktop window
  useEffect(() => {
    if (!isMobileMode || !targetWindowId || !hasReceivedInitialSyncRef.current) return;
    if (isRemoteSyncRef.current) {
      isRemoteSyncRef.current = false;
      return;
    }
    const currentTabs = tabsByProject[activeProjectId] || [];
    sendMessage('companion_tabs_update', {
      targetWindowId,
      tabs: currentTabs,
      activeTabId,
      activeProject: activeProjectId,
    });
  }, [isMobileMode, targetWindowId, tabsByProject, activeTabId, activeProjectId, sendMessage]);

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

  // @implements ft-core-workspace-path-normalization::TASK-CORE-014-2::REQ-005
  // @implements ft-core-code-path-simplification-and-omnisearch::TASK-CORE-015-3::REQ-005
  const handleOpenCode = (file: string) => {
    const normalized = normalizeWorkspacePath(file);
    openTab(activeProjectId, {
      id: normalized,
      title: normalized.split('/').pop() || normalized,
      type: 'code',
      path: normalized,
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

  // @implements ft-core-assets-manager::TASK-ASSET-005::REQ-007
  const handleOpenAsset = (asset: DiscoveredAssetInfo) => {
    openTab(activeProjectId, {
      id: asset.path,
      title: asset.filename,
      type: 'asset',
      path: asset.path,
    });
  };

  const [isOmniSearchOpen, setIsOmniSearchOpen] = useState(false);

  // @implements ft-core-omni-search-fulltext::TASK-CORE-009-3::REQ-005
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsOmniSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Build Cross-Project Global Search Index
  const globalSearchIndex = useMemo(() => {
    const activeProjectObj = projects.find((p) => p.id === activeProjectId);
    const projectName = activeProjectObj?.name || activeProjectId;

    const activeIndex = createSearchIndex({
      epics: fullEpics,
      features: fullFeatures,
      adrs: fullAdrs,
      codeFiles: codeFiles.map((c) => c.relative_path || c.path),
      projectId: activeProjectId,
      projectName,
    });

    for (const p of projects) {
      if (p.id !== activeProjectId) {
        activeIndex.push({
          id: p.id,
          title: p.name || p.id,
          scope: 'epics',
          projectId: p.id,
          projectName: p.name || p.id,
          searchableText: `${p.id} ${p.name || ''}`,
          originalItem: p,
        });
      }
    }

    return activeIndex;
  }, [projects, activeProjectId, fullEpics, fullFeatures, fullAdrs, codeFiles]);

  // @implements ft-core-omni-search-fulltext::TASK-CORE-009-3::REQ-007
  const handleOmniSelect = useCallback(async (item: SearchResultItem) => {
    if (item.projectId && item.projectId !== activeProjectId) {
      setActiveProject(item.projectId);
      try {
        await fetch('/api/v1/projects/active', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: item.projectId }),
        });
      } catch {
        // Fallback
      }
    }

    if (item.scope === 'epics') {
      handleOpenEpic(item.id);
    } else if (item.scope === 'features') {
      handleOpenFeature(item.id);
    } else if (item.scope === 'specs') {
      handleOpenSpec(item.id);
    } else if (item.scope === 'adrs') {
      handleOpenAdr(item.id);
    } else if (item.scope === 'code') {
      handleOpenCode(item.id);
    }
  }, [activeProjectId, setActiveProject, handleOpenEpic, handleOpenFeature, handleOpenSpec, handleOpenAdr, handleOpenCode]);

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
            key={currentEpicData.id}
            epic={currentEpicData}
            allFeatures={fullFeatures}
            allAdrs={fullAdrs}
            codeFiles={codeFiles}
            onSelectCode={handleOpenCode}
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
            onOpenAsset={handleOpenAsset}
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
          key={featData.id}
          feature={featData}
          allFeatures={fullFeatures}
          allAdrs={fullAdrs}
          codeFiles={codeFiles}
          onSelectCode={handleOpenCode}
          onOpenEpic={handleOpenEpic}
          onOpenSpec={handleOpenSpec}
          onOpenPlan={handleOpenPlan}
          onOpenAdr={handleOpenAdr}
          onOpenAsset={handleOpenAsset}
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
          key={`${activeTab.id}-${workspaceRefreshKey}`}
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
          key={`${activeTab.id}-${workspaceRefreshKey}`}
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
          key={`${activeTab.id}-${workspaceRefreshKey}`}
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
      return (
        <CodeViewer
          filePath={activeTab.path || activeTab.id}
          onSelectFeature={handleOpenFeature}
        />
      );
    }

    if (activeTab.type === 'adr') {
      return (
        <AdrViewer
          key={`${activeTab.id}-${workspaceRefreshKey}`}
          adrId={activeTab.id}
          onOpenEpic={handleOpenEpic}
          onOpenFeature={handleOpenFeature}
        />
      );
    }

    // @implements ft-core-assets-manager::TASK-ASSET-005::REQ-007
    // @implements ft-core-assets-manager::TASK-ASSET-006::REQ-008
    // @implements ft-core-assets-manager::TASK-ASSET-007::REQ-009
    if (activeTab.type === 'asset') {
      return (
        <AssetViewer
          assetId={activeTab.id}
          title={activeTab.title}
          path={activeTab.path}
          onDelete={() => {
            closeTab(activeProjectId, activeTab.id);
          }}
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

  const handleSelectDesktopWindow = useCallback((newWinId: string) => {
    setTargetWindowId(newWinId);
    const win = desktopWindows[newWinId];
    if (win && win.tabs) {
      isRemoteSyncRef.current = true;
      hasReceivedInitialSyncRef.current = true;
      const activeProj = win.activeProject || 'default';
      const curTabsByProject = useTabStore.getState().tabsByProject;
      useTabStore.getState().replaceState({
        activeProjectId: activeProj,
        tabsByProject: {
          ...curTabsByProject,
          [activeProj]: win.tabs,
        },
        activeTabId: win.activeTabId ?? null,
      });
    } else {
      hasReceivedInitialSyncRef.current = false;
    }
  }, [desktopWindows]);

  return (
    <ShellLayout
      isMobile={isMobileMode}
      activeMobileView={activeMobileView}
      onMobileViewChange={setActiveMobileView}
      epics={discoveredEpics.length > 0 ? discoveredEpics : undefined}
      features={discoveredFeatures.length > 0 ? discoveredFeatures : undefined}
      adrs={discoveredAdrs.length > 0 ? discoveredAdrs : undefined}
      codeFiles={codeFiles.length > 0 ? codeFiles : undefined}
      fullEpics={fullEpics}
      fullFeatures={fullFeatures}
      fullAdrs={fullAdrs}
      onSelectEpic={handleOpenEpic}
      onSelectFeature={handleOpenFeature}
      onSelectSpec={handleOpenSpec}
      onSelectCode={handleOpenCode}
      onSelectAdr={handleOpenAdr}
      onOpenSettings={() => setIsSettingsOpen(true)}
      onOpenOmniSearch={() => setIsOmniSearchOpen(true)}
      onRefreshWorkspace={handleRefreshWorkspace}
      isRefreshing={isRefreshing}
    >
      {/* Top Application Bar */}
      {/* @implements ft-core-webui-shell::TASK-CORE-006-26::REQ-020 */}
      {/* @implements ft-core-webui-shell::TASK-CORE-006-26::REQ-022 */}
      <header
        className={`bg-zinc-900 border-b border-zinc-800 px-3 ${
          isMobileMode
            ? 'min-h-12 py-2 flex flex-col gap-2'
            : 'h-12 px-4 flex items-center justify-between gap-4'
        }`}
      >
        {isMobileMode ? (
          <>
            {/* Mobile Line 1: History, Project Switcher on Left; Connection Icon on Far Right */}
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <HistoryNavButtons />
                <ProjectSwitcher projects={projects} />
              </div>
              <ConnectionStatusBanner status={status} onReconnect={reconnect} iconOnly={true} />
            </div>

            {/* Mobile Line 2: Desktop Window Switcher on Left; OmniSearch on Right */}
            <div className="flex items-center justify-between w-full pt-1.5 border-t border-zinc-800/60">
              <DesktopWindowSwitcher
                windows={desktopWindows}
                targetWindowId={targetWindowId}
                onSelectWindow={handleSelectDesktopWindow}
              />
              <button
                type="button"
                data-testid="header-omnisearch-btn"
                onClick={() => setIsOmniSearchOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 hover:bg-zinc-800 rounded border border-zinc-700/60 transition-colors cursor-pointer"
                title="Global OmniSearch (Ctrl+K)"
              >
                <Search className="w-3.5 h-3.5 text-indigo-400" />
                <span>Search</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 shrink-0 relative z-20">
              <HistoryNavButtons />
              <ProjectSwitcher projects={projects} />
            </div>

            {/* Desktop Global Viewport Centered OmniSearch Bar (50vw) */}
            {/* @implements ft-core-webui-shell::TASK-CORE-006-31::REQ-023 */}
            <div className="hidden md:flex fixed top-0 inset-x-0 h-12 items-center justify-center pointer-events-none z-20 px-4">
              <button
                type="button"
                data-testid="header-omnisearch-btn"
                onClick={() => setIsOmniSearchOpen(true)}
                className="pointer-events-auto w-full max-w-sm lg:max-w-md flex items-center justify-between px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-950/70 hover:bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-md transition-colors cursor-pointer shadow-xs group"
                title="Global OmniSearch (Ctrl+K)"
              >
                <div className="flex items-center gap-2 truncate">
                  <Search className="w-3.5 h-3.5 text-zinc-400 group-hover:text-indigo-400 transition-colors shrink-0" />
                  <span className="truncate text-zinc-400 group-hover:text-zinc-300">Search workspace, epics, specs...</span>
                </div>
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700/80 text-zinc-400 shrink-0 ml-2">
                  Ctrl+K
                </kbd>
              </button>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2 shrink-0 relative z-20">
              {/* Desktop QR Pairing Button */}
              {/* @implements ft-core-webui-shell::TASK-CORE-006-17::REQ-019 */}
              <button
                type="button"
                data-testid="qr-pairing-btn"
                onClick={() => setIsPairingOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-indigo-300 hover:text-indigo-100 bg-indigo-950/60 hover:bg-indigo-900/80 rounded border border-indigo-700/60 transition-colors cursor-pointer"
                title="Pair Mobile Companion (QR Code)"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pair Mobile</span>
              </button>

              <ConnectionStatusBanner status={status} onReconnect={reconnect} />
            </div>
          </>
        )}
      </header>

      {/* Project Tab Bar */}
      {(!isMobileMode || activeMobileView === 'main') && <TabBar />}

      {/* Main Canvas Area */}
      <div
        className={`flex-1 flex overflow-hidden min-h-0 ${
          effectivePosition === 'bottom' ? 'flex-col' : 'flex-row'
        }`}
      >
        {/* Central Content Area */}
        {(!isMobileMode || activeMobileView === 'main') && (
          <div ref={contentAreaRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 min-w-0 min-h-0">
            {renderActiveContent()}
          </div>
        )}

        {/* Dockable Auxiliary Panel - Terminals */}
        {(!isMobileMode || activeMobileView === 'terminal') && (
          isMobileMode ? (
            <div data-testid="mobile-terminal-fullscreen" className="flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden bg-zinc-950">
              <TerminalConsole
                onWorkspaceRefresh={handleRefreshWorkspace}
                isMobile={true}
                targetWindowId={targetWindowId}
              />
            </div>
          ) : (
            <DockablePanel hideHeader isMobile={false}>
              <TerminalConsole
                onWorkspaceRefresh={handleRefreshWorkspace}
                isMobile={false}
                targetWindowId={targetWindowId}
              />
            </DockablePanel>
          )
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* OmniSearch Modal */}
      <OmniSearchModal
        isOpen={isOmniSearchOpen}
        onClose={() => setIsOmniSearchOpen(false)}
        onSelect={handleOmniSelect}
        searchIndex={globalSearchIndex}
      />

      {/* Mobile Pairing Modal */}
      {/* @implements ft-core-webui-shell::TASK-CORE-006-17::REQ-019 */}
      <MobilePairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        windowId={windowId}
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
