/**
 * @file Default placeholder transition: simple CSS opacity fade through black.
 *
 * Hardened against three failure modes that produced visible glitches:
 *  1. Mid-flight throw leaving the overlay full-screen and pointer-blocking.
 *     -> overlay reset always runs in `finally`.
 *  2. Timer drift causing `commit()` to run before/after the mask is fully
 *     opaque.
 *     -> we await the actual `transitionend` (with a bounded fallback).
 *  3. Reduced-motion users seeing the same long fade as everyone else.
 *     -> duration is clamped when the OS prefers reduced motion.
 *
 * TODO: developers — copy this file to add your own (e.g. CSS wipe, 3D
 *       camera swoop, glitch). Then register it in `transitions/registry.ts`.
 */

import type { Transition } from '../types';
import { nextFrame, waitForTransition } from './waitForTransition';

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
      'will-change:opacity',
    ].join(';');
    document.body.appendChild(el);
  }
  return el;
}

function resetOverlay(overlay: HTMLDivElement): void {
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export const FadeTransition: Transition = {
  id: 'fade',
  async play(opts, commit) {
    const reduced = prefersReducedMotion();
    const baseHalf = Math.max(80, Math.floor((opts.durationMs ?? 500) / 2));
    const half = reduced ? Math.min(baseHalf, 90) : baseHalf;
    const overlay = ensureOverlay();
    let committed = false;
    const safeCommit = () => {
      if (committed) return;
      committed = true;
      commit();
    };

    try {
      overlay.style.transitionDuration = `${half}ms`;
      overlay.style.pointerEvents = 'auto';

      // Cover phase.
      overlay.style.opacity = '1';
      await waitForTransition(overlay, 'opacity', half);

      safeCommit();
      // Allow the new screen to mount in the next frame before unmasking.
      await nextFrame();

      // Reveal phase.
      overlay.style.opacity = '0';
      await waitForTransition(overlay, 'opacity', half);
    } finally {
      // Guarantee committed state and a clean overlay even on error.
      safeCommit();
      resetOverlay(overlay);
    }
  },
};
