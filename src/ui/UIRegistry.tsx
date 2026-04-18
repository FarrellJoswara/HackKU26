/**
 * Routes the current `appState` / `activeModule` to a 2D React screen.
 * Lives in the DOM layer next to (NOT inside) the R3F `<Canvas>`.
 *
 * Add a new screen:
 *   1. Create `screens/MyScreen.tsx` typed as `UIProps<MyData>`.
 *   2. Add an entry to `SCREENS` (per `appState`) or `MODULE_SCREENS`
 *      (per active module id) below.
 *
 * Rule: this file may import from `/core` and `/games/registry` (for
 *       `GAME_IDS`) but NEVER from a game's implementation file.
 */

import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
} from 'react';
import { useAppStore } from '@/core/store';
import type { AppState, ModuleId, UIProps } from '@/core/types';
import { HUD } from './hud/HUD';

type ScreenComp = LazyExoticComponent<ComponentType<UIProps<any>>>;

/** Default screen for each top-level `AppState`. */
const SCREENS: Partial<Record<AppState, ScreenComp>> = {
  boot: lazy(() => import('./screens/BootScreen')),
  menu: lazy(() => import('./screens/MainMenu')),
  briefing: lazy(() => import('./screens/BudgetBriefingScreen')),
  win: lazy(() => import('./screens/WinScreen')),
  loss: lazy(() => import('./screens/LossScreen')),
  summary: lazy(() => import('./screens/PostRunSummaryScreen')),
};

/**
 * Optional per-module overrides that take precedence over `SCREENS`
 * when `appState === 'game'`. Useful for game-specific menus or
 * pause overlays.
 *
 * TODO: register per-game UI here, e.g.
 *   [GAME_IDS.catRun]: lazy(() => import('./screens/CatRunHUD')),
 */
const MODULE_SCREENS: Partial<Record<ModuleId, ScreenComp>> = {};

export function UIRegistry() {
  const appState = useAppStore((s) => s.appState);
  const activeModule = useAppStore((s) => s.activeModule);
  const playerData = useAppStore((s) => s.playerData);

  if (appState === 'game') {
    const PerModule = activeModule ? MODULE_SCREENS[activeModule] : undefined;
    return (
      <>
        <HUD />
        {PerModule ? (
          <Suspense fallback={null}>
            <PerModule data={playerData} />
          </Suspense>
        ) : null}
      </>
    );
  }

  const Screen = SCREENS[appState];
  if (!Screen) return null;

  return (
    <Suspense fallback={null}>
      <Screen data={playerData} />
    </Suspense>
  );
}
