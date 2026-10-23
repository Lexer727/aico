import { create } from 'zustand';

interface AccordionStore {
  // entityId -> sectionName -> boolean (true = collapsed, false = expanded)
  collapsedByEntity: Record<string, Record<string, boolean>>;
  isSectionCollapsed: (entityId: string, section: string, defaultCollapsed?: boolean) => boolean;
  toggleSection: (entityId: string, section: string, defaultCollapsed?: boolean) => void;
  setSectionCollapsed: (entityId: string, section: string, collapsed: boolean) => void;
  resetEntity: (entityId: string) => void;
}

const STORAGE_KEY = 'aico_accordion_store_session_v1';

const loadPersistedState = (): Record<string, Record<string, boolean>> => {
  if (typeof window === 'undefined' || !window.sessionStorage) return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // Fallback
  }
  return {};
};

const savePersistedState = (state: Record<string, Record<string, boolean>>) => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Fallback
  }
};

// @implements ft-core-assets-manager::TASK-ASSET-008::REQ-012
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-6::REQ-013
export const useAccordionStore = create<AccordionStore>((set, get) => ({
  collapsedByEntity: loadPersistedState(),
  isSectionCollapsed: (entityId: string, section: string, defaultCollapsed = true) => {
    const entityMap = get().collapsedByEntity[entityId];
    if (!entityMap || entityMap[section] === undefined) {
      return defaultCollapsed;
    }
    return entityMap[section];
  },
  toggleSection: (entityId: string, section: string, defaultCollapsed = true) => {
    set((state) => {
      const entityMap = state.collapsedByEntity[entityId] || {};
      const current = entityMap[section] ?? defaultCollapsed;
      const nextMap = {
        ...state.collapsedByEntity,
        [entityId]: {
          ...entityMap,
          [section]: !current,
        },
      };
      savePersistedState(nextMap);
      return {
        collapsedByEntity: nextMap,
      };
    });
  },
  setSectionCollapsed: (entityId: string, section: string, collapsed: boolean) => {
    set((state) => {
      const nextMap = {
        ...state.collapsedByEntity,
        [entityId]: {
          ...(state.collapsedByEntity[entityId] || {}),
          [section]: collapsed,
        },
      };
      savePersistedState(nextMap);
      return {
        collapsedByEntity: nextMap,
      };
    });
  },
  resetEntity: (entityId: string) => {
    set((state) => {
      const next = { ...state.collapsedByEntity };
      delete next[entityId];
      savePersistedState(next);
      return { collapsedByEntity: next };
    });
  },
}));
