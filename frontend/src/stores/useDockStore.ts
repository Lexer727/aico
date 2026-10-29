import { create } from 'zustand';

export type DockPosition = 'bottom' | 'right';

interface DockState {
  position: DockPosition;
  rightWidth: number;
  bottomHeight: number;
  setPosition: (position: DockPosition) => void;
  setRightWidth: (width: number) => void;
  setBottomHeight: (height: number) => void;
  toggleDock: () => void;
  reset: () => void;
}

const STORAGE_KEY = 'aico_dock_position';
const RIGHT_WIDTH_KEY = 'aico_dock_right_width';
const BOTTOM_HEIGHT_KEY = 'aico_dock_bottom_height';

const DEFAULT_RIGHT_WIDTH = 384;
const DEFAULT_BOTTOM_HEIGHT = 256;

const clampRightWidth = (w: number) => Math.min(900, Math.max(240, Math.round(w)));
const clampBottomHeight = (h: number) => Math.min(700, Math.max(140, Math.round(h)));

const loadNumber = (key: string, fallback: number, clampFn: (v: number) => number): number => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed)) return clampFn(parsed);
    }
  } catch {
    // ignore storage errors
  }
  return fallback;
};

// @implements ft-core-webui-shell::TASK-CORE-006-9::REQ-010
// @implements ft-core-webui-shell::TASK-CORE-006-9::REQ-011
// @implements ft-core-webui-shell::TASK-CORE-006-37::REQ-025
export const useDockStore = create<DockState>((set) => ({
  position: (localStorage.getItem(STORAGE_KEY) as DockPosition) || 'bottom',
  rightWidth: loadNumber(RIGHT_WIDTH_KEY, DEFAULT_RIGHT_WIDTH, clampRightWidth),
  bottomHeight: loadNumber(BOTTOM_HEIGHT_KEY, DEFAULT_BOTTOM_HEIGHT, clampBottomHeight),
  setPosition: (position: DockPosition) => {
    localStorage.setItem(STORAGE_KEY, position);
    set({ position });
  },
  setRightWidth: (width: number) => {
    const next = clampRightWidth(width);
    localStorage.setItem(RIGHT_WIDTH_KEY, String(next));
    set({ rightWidth: next });
  },
  setBottomHeight: (height: number) => {
    const next = clampBottomHeight(height);
    localStorage.setItem(BOTTOM_HEIGHT_KEY, String(next));
    set({ bottomHeight: next });
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
    localStorage.removeItem(RIGHT_WIDTH_KEY);
    localStorage.removeItem(BOTTOM_HEIGHT_KEY);
    set({
      position: 'bottom',
      rightWidth: DEFAULT_RIGHT_WIDTH,
      bottomHeight: DEFAULT_BOTTOM_HEIGHT,
    });
  },
}));
