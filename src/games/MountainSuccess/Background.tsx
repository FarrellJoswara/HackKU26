/**
 * @file Mountain Success — quietly orbiting background.
 *
 * Mounts the same Three.js scene as the cinematic but in
 * "background mode": no captions, no completion timer, the camera
 * just slowly orbits the summit forever. Used by the Playthrough
 * Summary screen so the recap sits in front of the world the
 * player just earned.
 *
 * AGENTS.md: lives in `src/games/` (owns its WebGL renderer) and
 * is mounted by `App.tsx` outside the host R3F `<Canvas>` — same
 * pattern as `IslandRun` / `MountainSuccess` cinematic, just
 * driven by an `appState` rather than `activeModule`.
 */

import { useEffect, useRef } from 'react';
import { bootstrapMountainBackground } from './main';

const ROOT_ID = 'mountain-bg-canvas-root';

export default function MountainBackground() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const rootEl = document.getElementById(ROOT_ID);
    if (!rootEl) return;

    let cleanup: () => void = () => {};
    try {
      cleanup = bootstrapMountainBackground(rootEl);
    } catch (e) {
      console.error('[MountainBackground] bootstrap failed', e);
    }

    return () => {
      cleanup();
      started.current = false;
    };
  }, []);

  return (
    <div
      id={ROOT_ID}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
