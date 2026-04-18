/**
 * Top-level layout. Two stacked layers, totally decoupled:
 *
 *   [DOM   ] UIRegistry    — Tailwind-only React, never imports R3F
 *   [WebGL ] GameRegistry  — R3F scene tree, never imports DOM UI
 *
 * Both are wrapped by `TransitionManager`, which intercepts navigation
 * requests and runs the active visual hand-off.
 */

import { Canvas } from '@react-three/fiber';
import { TransitionManager } from './transitions/TransitionManager';
import { GameRegistry } from './games/GameRegistry';
import { UIRegistry } from './ui/UIRegistry';

export default function App() {
  return (
    <TransitionManager>
      <div className="absolute inset-0">
        {/* 3D layer */}
        <Canvas
          camera={{ position: [0, 0, 4], fov: 50 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          {/* TODO: shared lighting / post-processing can live here */}
          <GameRegistry />
        </Canvas>

        {/* 2D layer */}
        <UIRegistry />
      </div>
    </TransitionManager>
  );
}
