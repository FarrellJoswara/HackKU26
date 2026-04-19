/**
 * Tropical "wave wash" transition. Replaces the harsh black fade with a
 * coral->turquoise sweep that reads like a wave breaking across the screen.
 *
 * Mid-animation `commit()` is called while the screen is fully obscured by
 * the wave, exactly like FadeTransition expects.
 */

import type { Transition } from '../types';

const OVERLAY_ID = 'transition-wave-overlay';

function ensureOverlay(): HTMLDivElement {
  let el = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:9999',
      'transform:translateY(110%)',
      'opacity:1',
      // Bouncy ease so the wave feels playful, not mechanical.
      'transition:transform 280ms cubic-bezier(0.34,1.56,0.64,1), opacity 220ms ease',
      'background:' +
        'radial-gradient(120% 60% at 50% 0%, rgba(255,255,255,0.45), transparent 60%),' +
        'linear-gradient(180deg,#5ed6d9 0%,#ffc89e 55%,#ff8b6b 100%)',
    ].join(';');
    document.body.appendChild(el);
  }
  return el;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const WaveTransition: Transition = {
  id: 'wave',
  async play(opts, commit) {
    const half = Math.max(120, Math.floor((opts.durationMs ?? 600) / 2));
    const overlay = ensureOverlay();

    overlay.style.transitionDuration = `${half}ms`;
    overlay.style.pointerEvents = 'auto';

    // Wave sweeps up to fully cover the screen.
    overlay.style.transform = 'translateY(0%)';
    overlay.style.opacity = '1';
    await wait(half);

    commit();
    await wait(20);

    // Wave recedes downward and fades out.
    overlay.style.transform = 'translateY(-110%)';
    overlay.style.opacity = '0.85';
    await wait(half);

    overlay.style.transform = 'translateY(110%)';
    overlay.style.pointerEvents = 'none';
  },
};
