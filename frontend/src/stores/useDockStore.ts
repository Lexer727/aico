import { create } from 'zustand';

export type DockPosition = 'bottom' | 'right';

interface DockState {
  position: DockPosition;
  setPosition: (position: DockPosition) => void;
  toggleDock: () => void;
  reset: () => void;
}

const STORAGE_KEY = 'aico_dock_position';

// @implements spec-ft-core-webui-shell::REQ-010
// @implements spec-ft-core-webui-shell::REQ-011
export const useDockStore = create<DockState>((set) => ({
  position: (localStorage.getItem(STORAGE_KEY) as DockPosition) || 'bottom',
  setPosition: (position: DockPosition) => {
    localStorage.setItem(STORAGE_KEY, position);
    set({ position });
  },
  toggleDock: () => {
    set((state) => {
      const next: DockPosition = state.position === 'bottom' ? 'right' : 'bottom';
      localStorage.setItem(STORAGE_KEY, next);
      return { position: next };
    });
  },
  reset: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ position: 'bottom' });
  },
}));
