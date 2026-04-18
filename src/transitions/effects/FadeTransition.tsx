/**
 * Default placeholder transition: simple CSS opacity fade through black.
 *
 * TODO: developers — copy this file to add your own (e.g. CSS wipe, 3D
 *       camera swoop, glitch). Then register it in `transitions/registry.ts`.
 */

import type { Transition } from '../types';

const OVERLAY_ID = 'transition-fade-overlay';

function ensureOverlay(): HTMLDivElement {
  let el = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:#000',
      'opacity:0',
      'pointer-events:none',
      'z-index:9999',
      'transition:opacity 250ms ease',
    ].join(';');
    document.body.appendChild(el);
  }
  return el;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const FadeTransition: Transition = {
  id: 'fade',
  async play(opts, commit) {
    const half = Math.max(80, Math.floor((opts.durationMs ?? 500) / 2));
    const overlay = ensureOverlay();

    overlay.style.transitionDuration = `${half}ms`;
    overlay.style.pointerEvents = 'auto';

    overlay.style.opacity = '1';
    await wait(half);

    commit();
    // Allow the new screen to mount before fading out.
    await wait(16);

    overlay.style.opacity = '0';
    await wait(half);

    overlay.style.pointerEvents = 'none';
  },
};
