import { create } from 'zustand';

export interface TabItem {
  id: string;
  title: string;
  type: 'epic' | 'feature' | 'spec' | 'plan' | 'code' | 'adr' | 'glossary';
  path?: string;
}

interface TabState {
  activeProjectId: string;
  tabsByProject: Record<string, TabItem[]>;
  activeTabId: string | null;
  setActiveProject: (projectId: string) => void;
  openTab: (projectId: string, tab: TabItem) => void;
  closeTab: (projectId: string, tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  getProjectTabs: (projectId: string) => TabItem[];
  reset: () => void;
}

// Multi-window synchronization channel
const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('aico_tabs_sync')
  : null;

// @implements SPEC-CORE-006::REQ-004
// @implements SPEC-CORE-006::REQ-005
// @implements SPEC-CORE-006::REQ-006
export const useTabStore = create<TabState>((set, get) => {
  // Listen for multi-window tab updates
  if (syncChannel) {
    syncChannel.onmessage = (event) => {
      if (event.data?.type === 'SYNC_TABS') {
        set({
          activeProjectId: event.data.activeProjectId,
          tabsByProject: event.data.tabsByProject,
          activeTabId: event.data.activeTabId,
        });
      }
    };
  }

  const broadcastState = () => {
    if (syncChannel) {
      const state = get();
      syncChannel.postMessage({
        type: 'SYNC_TABS',
        activeProjectId: state.activeProjectId,
        tabsByProject: state.tabsByProject,
        activeTabId: state.activeTabId,
      });
    }
  };

  return {
    activeProjectId: 'default',
    tabsByProject: {},
    activeTabId: null,

    setActiveProject: (projectId: string) => {
      const tabs = get().tabsByProject[projectId] || [];
      const newActive = tabs.length > 0 ? tabs[0].id : null;
      set({
        activeProjectId: projectId,
        activeTabId: newActive,
      });
      broadcastState();
    },

    openTab: (projectId: string, tab: TabItem) => {
      set((state) => {
        const currentTabs = state.tabsByProject[projectId] || [];
        const exists = currentTabs.some((t) => t.id === tab.id);
        const updatedTabs = exists ? currentTabs : [...currentTabs, tab];

        return {
          activeProjectId: projectId,
          tabsByProject: {
            ...state.tabsByProject,
            [projectId]: updatedTabs,
          },
          activeTabId: tab.id,
        };
      });
      broadcastState();
    },

    closeTab: (projectId: string, tabId: string) => {
      set((state) => {
        const currentTabs = state.tabsByProject[projectId] || [];
        const filtered = currentTabs.filter((t) => t.id !== tabId);
        const newActive =
          state.activeTabId === tabId
            ? filtered.length > 0
              ? filtered[filtered.length - 1].id
              : null
            : state.activeTabId;

        return {
          tabsByProject: {
            ...state.tabsByProject,
            [projectId]: filtered,
          },
          activeTabId: newActive,
        };
      });
      broadcastState();
    },

    setActiveTab: (tabId: string) => {
      set({ activeTabId: tabId });
      broadcastState();
    },

    getProjectTabs: (projectId: string) => {
      return get().tabsByProject[projectId] || [];
    },

    reset: () => {
      set({
        activeProjectId: 'default',
        tabsByProject: {},
        activeTabId: null,
      });
    },
  };
});
