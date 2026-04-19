/**
 * Tropical "wave wash" transition. Replaces the harsh black fade with a
 * coral->turquoise sweep that reads like a wave breaking across the screen.
 *
 * Hardening notes (fixes for visible glitches):
 *  - The cover phase uses a non-overshoot easing (`cubic-bezier` that
 *    decelerates into the target) so the overlay never bounces past the
 *    top edge and momentarily exposes the bottom of the page. The
 *    overlay is also vertically over-sized (top/bottom -20vh) so even
 *    a sub-pixel rounding gap can never reveal an uncovered band.
 *  - Reset to the offscreen "armed" position is performed with
 *    transitions temporarily disabled so the user never sees a second
 *    sweep.
 *  - `commit()` is called at most once and is also forced in `finally`
 *    so a thrown effect can never leave the app stuck on the old route.
 *  - Phase waits use the actual `transitionend` (with bounded fallback)
 *    instead of fixed `setTimeout` delays, eliminating commit-vs-mask
 *    drift under main-thread load.
 *  - Reduced-motion users get a much shorter, lower-amplitude wash.
 */

import type { Transition } from '../types';
import { nextFrame, waitForTransition } from './waitForTransition';

const OVERLAY_ID = 'transition-wave-overlay';
// Cover with a clean ease-out (no overshoot) so the wave fully sits on
// the viewport at the end of the sweep instead of bouncing past it.
// Reveal uses ease-in for the opacity fade.
const COVER_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
const TRANSITION_ON =
  `transform 320ms ${COVER_EASING}, opacity 240ms ease`;

function ensureOverlay(): HTMLDivElement {
  let el = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.style.cssText = [
      'position:fixed',
      // Over-size vertically so any easing/rounding/mobile-URL-bar
      // wobble at the top or bottom edges is hidden behind the
      // overlay's own bleed area instead of revealing the page.
      'top:-20vh',
      'bottom:-20vh',
      'left:0',
      'right:0',
      'pointer-events:none',
      'z-index:9999',
      // Start fully below the (over-sized) overlay's natural rect so
      // it sits offscreen below the viewport.
      'transform:translateY(120%)',
      'opacity:1',
      `transition:${TRANSITION_ON}`,
      'will-change:transform, opacity',
      'background:' +
        'radial-gradient(120% 60% at 50% 0%, rgba(255,255,255,0.45), transparent 60%),' +
        'linear-gradient(180deg,#5ed6d9 0%,#ffc89e 55%,#ff8b6b 100%)',
    ].join(';');
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Snap the overlay back to its armed offscreen position with no visible
 * tween. Disabling transitions, forcing a layout, then re-enabling them
 * is the standard way to avoid a "second sweep" flash.
 */
function snapToArmed(overlay: HTMLDivElement): void {
  overlay.style.transition = 'none';
  overlay.style.transform = 'translateY(120%)';
  overlay.style.opacity = '1';
  overlay.style.pointerEvents = 'none';
  // Force reflow so the next style write actually animates.
  void overlay.offsetHeight;
  overlay.style.transition = TRANSITION_ON;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export const WaveTransition: Transition = {
  id: 'wave',
  async play(opts, commit) {
    const reduced = prefersReducedMotion();
    const baseHalf = Math.max(140, Math.floor((opts.durationMs ?? 640) / 2));
    const half = reduced ? Math.min(baseHalf, 140) : baseHalf;
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

      // Cover phase: wave sweeps up to fully cover the screen.
      overlay.style.transform = 'translateY(0%)';
      overlay.style.opacity = '1';
      await waitForTransition(overlay, 'transform', half);

      safeCommit();
      // Allow the new screen to mount in the next frame before revealing.
      await nextFrame();

      // Reveal phase: wave fades out in place. We deliberately do NOT
      // slide it off in the opposite direction — the previous version
      // did that and then snapped back, which read as a glitch.
      overlay.style.opacity = '0';
      await waitForTransition(overlay, 'opacity', half);
    } finally {
      // Guarantee committed state and a fully invisible, non-blocking
      // overlay armed for the next run.
      safeCommit();
      snapToArmed(overlay);
    }
  },
};
