/**
 * Central game registry. Each entry is a `React.lazy` import so games
 * are code-split — adding a 50MB game does not bloat the initial bundle.
 *
 * TODO: developers — add your game here. The `ModuleId` you choose is
 *       what callers will pass to `setActiveModule(id)` /
 *       `eventBus.emit('navigate:request', { to: 'game', module: id })`.
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GameProps, ModuleId } from '@/core/types';
import { moduleId } from '@/core/types';

export type GameComponent = ComponentType<GameProps<any, any>>;
export type LazyGame = LazyExoticComponent<GameComponent>;

export const GAME_IDS = {
  /** Endless-runner consequence game, driven by a budget profile. */
  debtRunner: moduleId('debtRunner'),
  /** Island Run — fully self-contained imperative Three.js game inside `src/games/IslandRun/`. Rendered outside the host `<Canvas>` by `App.tsx`, not via `GameRegistry`. */
  islandRun: moduleId('islandRun'),
  /** Angry-Birds–style towers with portfolio allocation (R3F, self-contained). */
  investingBirds: moduleId('investingBirds'),
  /**
   * Mountain Success — financial-freedom cinematic. Self-contained
   * imperative Three.js scene inside `src/games/MountainSuccess/`.
   * Like Island Run, mounts directly from `App.tsx` (its own
   * `WebGLRenderer`), so it is intentionally NOT in `GAME_MODULES`.
   */
  mountainSuccess: moduleId('mountainSuccess'),
} as const;

export const GAME_MODULES: Record<ModuleId, LazyGame> = {
  [GAME_IDS.debtRunner]: lazy(() => import('./DebtRunner')),
  [GAME_IDS.investingBirds]: lazy(() => import('./InvestingBirds')),
  // Island Run + Mountain Success have no R3F module — they each own
  // their own WebGLRenderer and mount directly from App.tsx (see
  // src/games/IslandRun/main.ts and src/games/MountainSuccess/main.ts).
  // TemplateGame remains in `src/games/TemplateGame/` as a copy-paste starter
  // (referenced by AGENTS.md), but is intentionally unregistered so it does
  // not appear in any menu.
};

export function getGame(id: ModuleId | null | undefined): LazyGame | null {
  if (!id) return null;
  return GAME_MODULES[id] ?? null;
}
