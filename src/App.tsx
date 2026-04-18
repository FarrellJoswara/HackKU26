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

const IslandRun = lazy(() => import('./games/IslandRun'));

export default function App() {
  const appState = useAppStore((s) => s.appState);
  const activeModule = useAppStore((s) => s.activeModule);
  const islandRun =
    appState === 'game' && activeModule === GAME_IDS.islandRun;

  return (
    <TransitionManager>
      <div className="absolute inset-0">
        {islandRun ? (
          <Suspense fallback={null}>
            <IslandRun />
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
