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
  useMemo,
  type ComponentType,
  type LazyExoticComponent,
} from 'react';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { AppState, ModuleId, UIProps } from '@/core/types';
import { assertNever } from '@/core/types';
import { GAME_IDS, getGame } from '@/games/registry';
import { HUD } from './hud/HUD';
import { SuspenseShell } from './components/SuspenseShell';

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
  finale: lazy(() => import('./screens/CampaignFinaleScreen')),
  playthroughSummary: lazy(() => import('./screens/PlaythroughSummaryScreen')),
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
    case 'finale':
    case 'playthroughSummary':
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
  const hasRenderableGameModule = useMemo(() => {
    if (!activeModule) return false;
    // External-renderer games own their own WebGLRenderer and are mounted
    // by `App.tsx` outside the shared <Canvas>, so they do not appear in
    // the R3F GAME_MODULES registry. Treat them as renderable here so the
    // "Game route failed to load" recovery panel does not appear on top
    // of a perfectly working game.
    if (
      activeModule === GAME_IDS.islandRun ||
      activeModule === GAME_IDS.mountainSuccess ||
      activeModule === GAME_IDS.investingBirds
    ) {
      return true;
    }
    return Boolean(getGame(activeModule));
  }, [activeModule]);

  if (appState === 'game') {
    if (!hasRenderableGameModule) {
      return (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4">
          <div className="max-w-md rounded-2xl border border-white/20 bg-black/50 p-6 text-white backdrop-blur">
            <h2 className="text-lg font-semibold">Game route failed to load</h2>
            <p className="mt-2 text-sm text-white/80">
              The current game module is missing or invalid. Return to menu to
              recover.
            </p>
            <button
              type="button"
              className="ui-route-error-btn mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
              onClick={() =>
                eventBus.emit('navigate:request', { to: 'menu', module: null })
              }
            >
              Return to menu
            </button>
          </div>
        </div>
      );
    }
    const PerModule = activeModule ? MODULE_SCREENS[activeModule] : undefined;
    return (
      <>
        <HUD />
        {PerModule ? (
          <Suspense fallback={<SuspenseShell />}>
            <PerModule data={playerData} />
          </Suspense>
        ) : null}
      </>
    );
  }

  const Screen = pickScreen(appState);
  if (!Screen) return null;

  return (
    <Suspense fallback={<SuspenseShell />}>
      <Screen data={playerData} />
    </Suspense>
  );
}
