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
  /** Island Run — fully self-contained imperative Three.js game inside `src/games/IslandRun/`. Rendered outside the host `<Canvas>` by `App.tsx`, not via `GameRegistry`. */
  islandRun: moduleId('islandRun'),
} as const;

export const GAME_MODULES: Record<ModuleId, LazyGame> = {
  [GAME_IDS.template]: lazy(() => import('./TemplateGame')),
  // TODO: add your lazy imports here
  // [GAME_IDS.catRun]: lazy(() => import('./CatRun')),
};

export function getGame(id: ModuleId | null | undefined): LazyGame | null {
  if (!id) return null;
  return GAME_MODULES[id] ?? null;
}
