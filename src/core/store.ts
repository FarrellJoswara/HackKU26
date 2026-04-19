/**
 * @file Global Zustand store. Intentionally generic — concrete game/UI shapes
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
import { CAMPAIGN_KEYS, DEBT_RUNNER_KEYS } from './campaign/campaignKeys';

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
      // v2: introduces campaign.* and debtRunner.* defaults so older saves
      // without these keys do not get permanently locked out by the soft
      // map gate or the one-time DebtRunner tutorial.
      version: 2,
      // Only persist things that should survive a refresh. Transient UI
      // state (`appState`, `activeModule`) is rebuilt on boot.
      partialize: (state) => ({ playerData: state.playerData }),
      migrate: (persisted, fromVersion) => {
        const safe =
          persisted && typeof persisted === 'object'
            ? (persisted as { playerData?: Record<string, unknown> })
            : {};
        const playerData = { ...(safe.playerData ?? {}) };
        if (fromVersion < 2) {
          if (playerData[CAMPAIGN_KEYS.onboardingComplete] === undefined) {
            // Old saves predate onboarding entirely — assume the player has
            // already played, so we don't shove the tutorial in their face.
            playerData[CAMPAIGN_KEYS.onboardingComplete] = true;
          }
          if (playerData[CAMPAIGN_KEYS.boxReadyForYear] === undefined) {
            playerData[CAMPAIGN_KEYS.boxReadyForYear] = 0;
          }
          if (playerData[CAMPAIGN_KEYS.islandTotalHops] === undefined) {
            playerData[CAMPAIGN_KEYS.islandTotalHops] = 0;
          }
          if (playerData[CAMPAIGN_KEYS.year] === undefined) {
            playerData[CAMPAIGN_KEYS.year] = 1;
          }
          if (playerData[DEBT_RUNNER_KEYS.tutorialSeen] === undefined) {
            playerData[DEBT_RUNNER_KEYS.tutorialSeen] = false;
          }
        }
        return { playerData };
      },
    },
  ),
);

/* -------- typed selectors (optional, but cheap) -------- */

export const selectAppState = (s: AppStoreState) => s.appState;
export const selectActiveModule = (s: AppStoreState) => s.activeModule;
export const selectPlayerData = (s: AppStoreState) => s.playerData;
