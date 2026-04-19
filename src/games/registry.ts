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
  template: moduleId('template'),
  /** Endless-runner consequence game, driven by a budget profile. */
  debtRunner: moduleId('debtRunner'),
  /** Island Run — fully self-contained imperative Three.js game inside `src/games/IslandRun/`. Rendered outside the host `<Canvas>` by `App.tsx`, not via `GameRegistry`. */
  islandRun: moduleId('islandRun'),
  /** Angry-Birds–style towers with portfolio allocation (R3F, self-contained). */
  investingBirds: moduleId('investingBirds'),
  /** V2 rebuild of Investing Birds. Renders outside the shared `<Canvas>` (see
   *  App.tsx) for complete isolation — no layout inheritance, no per-frame
   *  camera drift, no overlay grey-strip bug. */
  investingBirds2: moduleId('investingBirds2'),
  /** Angry-Birds asset reskin + portfolio rounds (isolated Canvas, Planck.js). */
  investingBirds3: moduleId('investingBirds3'),
} as const;

export const GAME_MODULES: Record<ModuleId, LazyGame> = {
  [GAME_IDS.template]: lazy(() => import('./TemplateGame')),
  [GAME_IDS.debtRunner]: lazy(() => import('./DebtRunner')),
  [GAME_IDS.investingBirds]: lazy(() => import('./InvestingBirds')),
  // Island Run has no R3F module — it mounts directly from App.tsx (see src/games/IslandRun/main.ts).
};

export function getGame(id: ModuleId | null | undefined): LazyGame | null {
  if (!id) return null;
  return GAME_MODULES[id] ?? null;
}
