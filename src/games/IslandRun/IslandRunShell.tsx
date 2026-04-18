/**
 * Full-screen Island Run (Three.js) experience.
 *
 * The game is shipped as a static Vite build under `/public/island-board/`
 * (see `scripts/sync-island.mjs` + README). We embed it in an iframe so the
 * host app stays on React + R3F for the template cube, without duplicating the
 * imperative Three.js stack inside `<Canvas>`.
 */

import { useEffect } from 'react';

export function IslandRunShell() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const src = `${import.meta.env.BASE_URL}island-board/index.html`;

  return (
    <iframe
      title="Island Run — 12 square board"
      className="absolute inset-0 z-0 h-full min-h-[100dvh] w-full border-0"
      src={src}
      allow="fullscreen"
    />
  );
}
