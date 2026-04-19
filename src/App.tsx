/**
 * @file Root layout — composes the DOM UI layer and WebGL game layer without
 * cross-imports between them (see AGENTS.md).
 *
 * Top-level layout. Two stacked layers, totally decoupled:
 *
 *   [DOM   ] UIRegistry    — Tailwind-only React, never imports R3F
 *   [WebGL ] GameRegistry  — R3F scene tree, never imports DOM UI
 *
 * Island Run is the exception: it owns its own `WebGLRenderer` (see
 * `src/games/IslandRun/main.ts`), so we mount it OUTSIDE the host R3F
 * `<Canvas>` instead of nesting a second WebGL context inside R3F.
 *
 * Both are wrapped by `TransitionManager`, which intercepts navigation
 * requests and runs the active visual hand-off.
 */

import { lazy, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { TransitionManager } from './transitions/TransitionManager';
import { GameRegistry } from './games/GameRegistry';
import { UIRegistry } from './ui/UIRegistry';
import { useAppStore } from './core/store';
import { GAME_IDS } from './games/registry';
import { RunnerResultRouter } from './core/runner/RunnerResultRouter';
import IslandRun from './games/IslandRun';
import MountainSuccess from './games/MountainSuccess';
import MountainBackground from './games/MountainSuccess/Background';
import { selectInvestingBirdsAllocation } from './games/InvestingBirds/landingPayload';

// Investing Birds owns its own full-screen `<Canvas>` + DOM overlay in an
// isolated fixed-position root (see `src/games/InvestingBirds/index.tsx`),
// so (like Island Run) we mount it OUTSIDE the shared R3F `<Canvas>`.
// Lazy-loaded so its planck/Three bundle does not bloat the initial chunk.
const InvestingBirds = lazy(() => import('./games/InvestingBirds'));

export default function App() {
  const appState = useAppStore((s) => s.appState);
  const activeModule = useAppStore((s) => s.activeModule);
  const playerData = useAppStore((s) => s.playerData);
  // Games that own their own WebGLRenderer mount OUTSIDE the host R3F
  // `<Canvas>` so we never instantiate two WebGL contexts at once.
  const islandRun = appState === 'game' && activeModule === GAME_IDS.islandRun;
  const mountainSuccess =
    appState === 'game' && activeModule === GAME_IDS.mountainSuccess;
  const investingBirds =
    appState === 'game' && activeModule === GAME_IDS.investingBirds;
  // The Playthrough Summary screen renders the post-summit mountain
  // scene as a slowly orbiting backdrop, so it also owns its own
  // WebGLRenderer and lives outside the host R3F `<Canvas>`.
  const playthroughSummary = appState === 'playthroughSummary';
  const externalRenderer =
    islandRun || mountainSuccess || investingBirds || playthroughSummary;

  // Pre-fill Investing Birds' portfolio mix from the player's most recent
  // Box submission (Individual Stocks / Index Funds / Bonds + CDs / Crypto)
  // so the in-game allocate panel is skipped — the player chose this in
  // The Box and the year-end mini-game just runs on those numbers.
  const investingBirdsAllocation = investingBirds
    ? selectInvestingBirdsAllocation(playerData)
    : null;

  return (
    <TransitionManager>
      <RunnerResultRouter />
      <div className="absolute inset-0">
        {externalRenderer ? (
          <>
            {islandRun ? <IslandRun /> : null}
            {mountainSuccess ? <MountainSuccess /> : null}
            {investingBirds ? (
              <Suspense fallback={null}>
                <InvestingBirds
                  inputs={{ allocation: investingBirdsAllocation ?? undefined }}
                />
              </Suspense>
            ) : null}
            {playthroughSummary ? <MountainBackground /> : null}
          </>
        ) : (
          <Canvas
            camera={{ position: [0, 0, 4], fov: 50 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true }}
          >
            <GameRegistry />
          </Canvas>
        )}

        <UIRegistry />
      </div>
    </TransitionManager>
  );
}
