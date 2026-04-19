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
import { assertNever } from '@/core/types';
import { GAME_IDS } from '@/games/registry';
import { HUD } from './hud/HUD';

type ScreenComp = LazyExoticComponent<ComponentType<UIProps<any>>>;

/**
 * Default screen for each top-level `AppState`. Compile-safety: this is a
 * **complete** mapping (every `AppState` has an entry, even if `null` for
 * the few states that have no DOM screen). The `pickScreen` switch below
 * uses `assertNever` so a new `AppState` shows up as a TypeScript error
 * here instead of as a blank screen at runtime.
 */
const SCREENS: Record<AppState, ScreenComp | null> = {
  boot: lazy(() => import('./screens/BootScreen')),
  menu: lazy(() => import('./screens/TitleHubScreen')),
  settings: lazy(() => import('./screens/SettingsScreen')),
  onboarding: lazy(() => import('./screens/OnboardingScreen')),
  newGameDifficulty: lazy(() => import('./screens/NewGameDifficultyScreen')),
  budget: lazy(() => import('./screens/TheBoxScreen')),
  debtRunnerTutorial: lazy(() => import('./screens/DebtRunnerTutorialScreen')),
  briefing: lazy(() => import('./screens/BudgetBriefingScreen')),
  win: lazy(() => import('./screens/WinScreen')),
  loss: lazy(() => import('./screens/LossScreen')),
  summary: lazy(() => import('./screens/PostRunSummaryScreen')),
  // Active game module is rendered via MODULE_SCREENS / GameRegistry.
  game: null,
  // Transition is owned by `TransitionManager`, which masks the screen.
  transition: null,
};

function pickScreen(state: AppState): ScreenComp | null {
  switch (state) {
    case 'boot':
    case 'menu':
    case 'settings':
    case 'onboarding':
    case 'newGameDifficulty':
    case 'budget':
    case 'debtRunnerTutorial':
    case 'briefing':
    case 'win':
    case 'loss':
    case 'summary':
    case 'game':
    case 'transition':
      return SCREENS[state];
    default:
      return assertNever(state, 'UIRegistry.pickScreen');
  }
}

/**
 * Optional per-module overrides that take precedence over `SCREENS`
 * when `appState === 'game'`. Useful for game-specific menus or
 * pause overlays.
 *
 * TODO: register per-game UI here, e.g.
 *   [GAME_IDS.catRun]: lazy(() => import('./screens/CatRunHUD')),
 */
const MODULE_SCREENS: Partial<Record<ModuleId, ScreenComp>> = {
  /**
   * Island Run lives in `src/games/IslandRun/` (in-tree, no iframe).
   * The host UI can overlay "The Box" on top of it without importing
   * any game implementation.
   */
  [GAME_IDS.islandRun]: lazy(() => import('./screens/TheBoxOverlay')),
};

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

  const Screen = pickScreen(appState);
  if (!Screen) return null;

  return (
    <Suspense fallback={null}>
      <Screen data={playerData} />
    </Suspense>
  );
}
