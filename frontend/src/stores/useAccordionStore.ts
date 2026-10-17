import { create } from 'zustand';

interface AccordionStore {
  // entityId -> sectionName -> boolean (true = collapsed, false = expanded)
  collapsedByEntity: Record<string, Record<string, boolean>>;
  isSectionCollapsed: (entityId: string, section: string, defaultCollapsed?: boolean) => boolean;
  toggleSection: (entityId: string, section: string, defaultCollapsed?: boolean) => void;
  setSectionCollapsed: (entityId: string, section: string, collapsed: boolean) => void;
  resetEntity: (entityId: string) => void;
}

// @implements ft-core-assets-manager::TASK-ASSET-008::REQ-012
export const useAccordionStore = create<AccordionStore>((set, get) => ({
  collapsedByEntity: {},
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
      return {
        collapsedByEntity: {
          ...state.collapsedByEntity,
          [entityId]: {
            ...entityMap,
            [section]: !current,
          },
        },
      };
    });
  },
  setSectionCollapsed: (entityId: string, section: string, collapsed: boolean) => {
    set((state) => ({
      collapsedByEntity: {
        ...state.collapsedByEntity,
        [entityId]: {
          ...(state.collapsedByEntity[entityId] || {}),
          [section]: collapsed,
        },
      },
    }));
  },
  resetEntity: (entityId: string) => {
    set((state) => {
      const next = { ...state.collapsedByEntity };
      delete next[entityId];
      return { collapsedByEntity: next };
    });
  },
}));
