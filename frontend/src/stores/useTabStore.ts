import { create } from 'zustand';

export interface TabItem {
  id: string;
  title: string;
  type: 'epic' | 'feature' | 'spec' | 'plan' | 'code' | 'adr' | 'glossary' | 'brainstorm' | 'deep_dive';
  path?: string;
}

interface TabState {
  activeProjectId: string;
  tabsByProject: Record<string, TabItem[]>;
  activeTabId: string | null;
  history: string[];
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
  tabCache: Record<string, TabItem>;
  recentlyClosedTabs: TabItem[];
  setActiveProject: (projectId: string) => void;
  openTab: (projectId: string, tab: TabItem) => void;
  closeTab: (projectId: string, tabId: string) => void;
  reorderTabs: (projectId: string, fromIndex: number, toIndex: number) => void;
  setProjectTabs: (projectId: string, tabs: TabItem[]) => void;
  reopenLastClosedTab: (projectId?: string) => void;
  setActiveTab: (tabId: string) => void;
  goBack: () => void;
  goForward: () => void;
  getProjectTabs: (projectId: string) => TabItem[];
  reset: () => void;
}

const STORAGE_KEY = 'aico_tab_store_v1';

interface PersistedTabState {
  activeProjectId: string;
  tabsByProject: Record<string, TabItem[]>;
  activeTabId: string | null;
  history: string[];
  historyIndex: number;
  tabCache: Record<string, TabItem>;
  recentlyClosedTabs?: TabItem[];
}

const loadPersistedState = (): PersistedTabState | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // Corrupted or restricted storage
  }
  return null;
};

const savePersistedState = (state: PersistedTabState) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // QuotaExceededError or restricted storage
  }
};

// Multi-window synchronization channel
const syncChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('aico_tabs_sync')
    : null;

// Clean up any legacy ?tab= query parameter from URL to maintain clean SPA
if (typeof window !== 'undefined' && window.location && window.location.search.includes('tab=')) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('tab');
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
  } catch {
    // Ignore URL manipulation error
  }
}

// @implements spec-ft-core-webui-shell::REQ-004
// @implements spec-ft-core-webui-shell::REQ-005
// @implements spec-ft-core-webui-shell::REQ-006
export const useTabStore = create<TabState>((set, get) => {
  const initial = loadPersistedState();
  const initialProjectId = initial?.activeProjectId || 'default';
  const initialTabsByProject = initial?.tabsByProject || {};
  const initialActiveTabId = initial?.activeTabId ?? null;
  const initialHistory = initial?.history && initial.history.length > 0 ? initial.history : ['dashboard'];
  const initialHistoryIndex = typeof initial?.historyIndex === 'number' ? initial.historyIndex : 0;
  const initialTabCache = initial?.tabCache || {};
  const initialRecentlyClosedTabs = Array.isArray(initial?.recentlyClosedTabs) ? initial.recentlyClosedTabs : [];

  const persistCurrentState = () => {
    const current = get();
    savePersistedState({
      activeProjectId: current.activeProjectId,
      tabsByProject: current.tabsByProject,
      activeTabId: current.activeTabId,
      history: current.history,
      historyIndex: current.historyIndex,
      tabCache: current.tabCache,
      recentlyClosedTabs: current.recentlyClosedTabs,
    });
  };

  const broadcastState = () => {
    if (syncChannel) {
      const state = get();
      syncChannel.postMessage({
        type: 'SYNC_TABS',
        activeProjectId: state.activeProjectId,
        tabsByProject: state.tabsByProject,
        activeTabId: state.activeTabId,
        history: state.history,
        historyIndex: state.historyIndex,
        tabCache: state.tabCache,
        recentlyClosedTabs: state.recentlyClosedTabs,
      });
    }
  };

  // Listen for multi-window tab updates
  if (syncChannel) {
    syncChannel.onmessage = (event) => {
      if (event.data?.type === 'SYNC_TABS') {
        set({
          activeProjectId: event.data.activeProjectId,
          tabsByProject: event.data.tabsByProject,
          activeTabId: event.data.activeTabId,
          history: event.data.history || ['dashboard'],
          historyIndex: event.data.historyIndex ?? 0,
          canGoBack: (event.data.historyIndex ?? 0) > 0,
          canGoForward:
            (event.data.historyIndex ?? 0) <
            (event.data.history ? event.data.history.length - 1 : 0),
          tabCache: event.data.tabCache || {},
          recentlyClosedTabs: event.data.recentlyClosedTabs || [],
        });
        persistCurrentState();
      }
    };
  }

  return {
    activeProjectId: initialProjectId,
    tabsByProject: initialTabsByProject,
    activeTabId: initialActiveTabId,
    history: initialHistory,
    historyIndex: initialHistoryIndex,
    canGoBack: initialHistoryIndex > 0,
    canGoForward: initialHistoryIndex < initialHistory.length - 1,
    tabCache: initialTabCache,
    recentlyClosedTabs: initialRecentlyClosedTabs,

    setActiveProject: (projectId: string) => {
      const state = get();
      const tabs = state.tabsByProject[projectId] || [];
      const currentActive = state.activeTabId;
      const isCurrentInProject = currentActive && tabs.some((t) => t.id === currentActive);
      const newActive = isCurrentInProject
        ? currentActive
        : tabs.length > 0
        ? tabs[tabs.length - 1].id
        : null;

      set({
        activeProjectId: projectId,
        activeTabId: newActive,
      });
      persistCurrentState();
      broadcastState();
    },

    openTab: (projectId: string, tab: TabItem) => {
      set((state) => {
        const currentTabs = state.tabsByProject[projectId] || [];
        const exists = currentTabs.some((t) => t.id === tab.id);
        const updatedTabs = exists ? currentTabs : [...currentTabs, tab];
        const newCache = { ...state.tabCache, [tab.id]: tab };

        if (state.activeTabId === tab.id) {
          return {
            activeProjectId: projectId,
            tabsByProject: {
              ...state.tabsByProject,
              [projectId]: updatedTabs,
            },
            tabCache: newCache,
          };
        }

        const newHistory = [...state.history.slice(0, state.historyIndex + 1), tab.id];
        const newIndex = newHistory.length - 1;

        return {
          activeProjectId: projectId,
          tabsByProject: {
            ...state.tabsByProject,
            [projectId]: updatedTabs,
          },
          activeTabId: tab.id,
          history: newHistory,
          historyIndex: newIndex,
          canGoBack: newIndex > 0,
          canGoForward: false,
          tabCache: newCache,
        };
      });
      persistCurrentState();
      broadcastState();
    },

    closeTab: (projectId: string, tabId: string) => {
      set((state) => {
        const currentTabs = state.tabsByProject[projectId] || [];
        const closedTab = currentTabs.find((t) => t.id === tabId);
        const filtered = currentTabs.filter((t) => t.id !== tabId);

        // Save closed tab to recentlyClosedTabs history (max 25)
        const updatedRecentlyClosed = closedTab
          ? [...state.recentlyClosedTabs.filter((t) => t.id !== tabId), closedTab].slice(-25)
          : state.recentlyClosedTabs;

        // If the closed tab was active, switch to adjacent open tab or null (dashboard)
        let newActive: string | null = state.activeTabId;
        if (state.activeTabId === tabId) {
          const closedIndex = currentTabs.findIndex((t) => t.id === tabId);
          if (filtered.length === 0) {
            newActive = null;
          } else if (closedIndex < filtered.length) {
            newActive = filtered[closedIndex].id;
          } else {
            newActive = filtered[filtered.length - 1].id;
          }
        }

        // Clean closed tabId from history completely
        let newHistory = state.history.filter((id) => id !== tabId);
        const effectiveActive = newActive || 'dashboard';

        if (newHistory.length === 0) {
          newHistory = [effectiveActive];
        } else if (!newHistory.includes(effectiveActive)) {
          newHistory.push(effectiveActive);
        }

        // Reposition history index to point to current effectiveActive
        let newIndex = newHistory.lastIndexOf(effectiveActive);
        if (newIndex < 0) {
          newIndex = Math.min(Math.max(0, state.historyIndex), newHistory.length - 1);
        }

        return {
          tabsByProject: {
            ...state.tabsByProject,
            [projectId]: filtered,
          },
          activeTabId: newActive,
          history: newHistory,
          historyIndex: newIndex,
          canGoBack: newIndex > 0,
          canGoForward: newIndex < newHistory.length - 1,
          recentlyClosedTabs: updatedRecentlyClosed,
        };
      });
      persistCurrentState();
      broadcastState();
    },

    reorderTabs: (projectId: string, fromIndex: number, toIndex: number) => {
      set((state) => {
        const currentTabs = [...(state.tabsByProject[projectId] || [])];
        if (
          fromIndex < 0 ||
          fromIndex >= currentTabs.length ||
          toIndex < 0 ||
          toIndex >= currentTabs.length ||
          fromIndex === toIndex
        ) {
          return state;
        }
        const [moved] = currentTabs.splice(fromIndex, 1);
        currentTabs.splice(toIndex, 0, moved);
        return {
          tabsByProject: {
            ...state.tabsByProject,
            [projectId]: currentTabs,
          },
        };
      });
      persistCurrentState();
      broadcastState();
    },

    setProjectTabs: (projectId: string, tabs: TabItem[]) => {
      set((state) => ({
        tabsByProject: {
          ...state.tabsByProject,
          [projectId]: tabs,
        },
      }));
      persistCurrentState();
      broadcastState();
    },

    reopenLastClosedTab: (projectId?: string) => {
      const state = get();
      if (state.recentlyClosedTabs.length === 0) return;

      const targetProjectId = projectId || state.activeProjectId;
      const lastClosed = state.recentlyClosedTabs[state.recentlyClosedTabs.length - 1];
      const remainingClosed = state.recentlyClosedTabs.slice(0, -1);

      set({ recentlyClosedTabs: remainingClosed });
      get().openTab(targetProjectId, lastClosed);
    },

    setActiveTab: (tabId: string) => {
      set((state) => {
        if (state.activeTabId === tabId) return state;

        const effectiveTab = tabId || 'dashboard';
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), effectiveTab];
        const newIndex = newHistory.length - 1;

        return {
          activeTabId: tabId,
          history: newHistory,
          historyIndex: newIndex,
          canGoBack: newIndex > 0,
          canGoForward: false,
        };
      });
      persistCurrentState();
      broadcastState();
    },

    goBack: () => {
      const state = get();
      if (state.historyIndex <= 0) return;

      const newIndex = state.historyIndex - 1;
      const targetTabId = state.history[newIndex];
      const effectiveActive = targetTabId === 'dashboard' ? null : targetTabId;

      // Ensure tab is restored in tabsByProject if closed
      let updatedTabs = state.tabsByProject[state.activeProjectId] || [];
      if (effectiveActive && !updatedTabs.some((t) => t.id === effectiveActive)) {
        const cached = state.tabCache[effectiveActive];
        if (cached) {
          updatedTabs = [...updatedTabs, cached];
        }
      }

      set({
        tabsByProject: {
          ...state.tabsByProject,
          [state.activeProjectId]: updatedTabs,
        },
        activeTabId: effectiveActive,
        historyIndex: newIndex,
        canGoBack: newIndex > 0,
        canGoForward: newIndex < state.history.length - 1,
      });
      persistCurrentState();
      broadcastState();
    },

    goForward: () => {
      const state = get();
      if (state.historyIndex >= state.history.length - 1) return;

      const newIndex = state.historyIndex + 1;
      const targetTabId = state.history[newIndex];
      const effectiveActive = targetTabId === 'dashboard' ? null : targetTabId;

      // Ensure tab is restored in tabsByProject if closed
      let updatedTabs = state.tabsByProject[state.activeProjectId] || [];
      if (effectiveActive && !updatedTabs.some((t) => t.id === effectiveActive)) {
        const cached = state.tabCache[effectiveActive];
        if (cached) {
          updatedTabs = [...updatedTabs, cached];
        }
      }

      set({
        tabsByProject: {
          ...state.tabsByProject,
          [state.activeProjectId]: updatedTabs,
        },
        activeTabId: effectiveActive,
        historyIndex: newIndex,
        canGoBack: newIndex > 0,
        canGoForward: newIndex < state.history.length - 1,
      });
      persistCurrentState();
      broadcastState();
    },

    getProjectTabs: (projectId: string) => {
      return get().tabsByProject[projectId] || [];
    },

    reset: () => {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {}
      }
      set({
        activeProjectId: 'default',
        tabsByProject: {},
        activeTabId: null,
        history: ['dashboard'],
        historyIndex: 0,
        canGoBack: false,
        canGoForward: false,
        tabCache: {},
        recentlyClosedTabs: [],
      });
    },
  };
});
