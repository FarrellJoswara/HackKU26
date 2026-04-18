/**
 * Global Zustand store. Intentionally generic — concrete game/UI shapes
 * live in `playerData` so any developer can add fields without touching
 * this file or breaking other modules.
 *
 * Mutation rules of thumb:
 *   - `appState` should only change through `TransitionManager` so visual
 *     hand-offs always run.
 *   - `playerData` is freeform `Record<string, unknown>` — type-narrow
 *     where you read it (e.g. `data.score as number`) or define a typed
 *     selector in the owning module.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppState, ModuleId } from './types';

export interface AppStoreState {
  /** Current top-level lifecycle stage. */
  appState: AppState;
  /** Which `/games` or `/ui` module is currently active. */
  activeModule: ModuleId | null;
  /** Freeform persisted data — score, settings, progress, etc. */
  playerData: Record<string, unknown>;

  /* -------- actions -------- */
  setAppState: (next: AppState) => void;
  setActiveModule: (id: ModuleId | null) => void;
  /** Shallow-merge a patch into `playerData`. */
  mergePlayerData: (patch: Record<string, unknown>) => void;
  /** Wipe persisted state — handy for "New Game". */
  resetPlayerData: () => void;
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set) => ({
      appState: 'boot',
      activeModule: null,
      playerData: {},

      setAppState: (next) => set({ appState: next }),
      setActiveModule: (id) => set({ activeModule: id }),
      mergePlayerData: (patch) =>
        set((state) => ({ playerData: { ...state.playerData, ...patch } })),
      resetPlayerData: () => set({ playerData: {} }),
    }),
    {
      name: 'hackku26:app',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Only persist things that should survive a refresh. Transient UI
      // state (`appState`, `activeModule`) is rebuilt on boot.
      partialize: (state) => ({ playerData: state.playerData }),
    },
  ),
);

/* -------- typed selectors (optional, but cheap) -------- */

export const selectAppState = (s: AppStoreState) => s.appState;
export const selectActiveModule = (s: AppStoreState) => s.activeModule;
export const selectPlayerData = (s: AppStoreState) => s.playerData;
