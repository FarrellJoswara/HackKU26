/**
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

const IslandRun = lazy(() => import('./games/IslandRun'));
const InvestingBirds2 = lazy(() => import('./games/InvestingBirds2'));
const InvestingBirds3 = lazy(() => import('./games/InvestingBirds3'));

export default function App() {
  const appState = useAppStore((s) => s.appState);
  const activeModule = useAppStore((s) => s.activeModule);
  const islandRun =
    appState === 'game' && activeModule === GAME_IDS.islandRun;
  // InvestingBirds v2 owns its own full-screen Canvas + DOM overlay in a
  // fixed-position isolated root, so (like IslandRun) we mount it OUTSIDE
  // the shared R3F `<Canvas>`. No layout, style, or camera in this App shell
  // can reach it.
  const investingBirds2 =
    appState === 'game' && activeModule === GAME_IDS.investingBirds2;
  const investingBirds3 =
    appState === 'game' && activeModule === GAME_IDS.investingBirds3;

  return (
    <TransitionManager>
      <RunnerResultRouter />
      <div className="absolute inset-0">
        {islandRun ? (
          <Suspense fallback={null}>
            <IslandRun />
          </Suspense>
        ) : investingBirds2 ? (
          <Suspense fallback={null}>
            <InvestingBirds2 inputs={{}} />
          </Suspense>
        ) : investingBirds3 ? (
          <Suspense fallback={null}>
            <InvestingBirds3 inputs={{}} />
          </Suspense>
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
