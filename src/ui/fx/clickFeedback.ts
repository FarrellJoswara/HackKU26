/**
 * Per-element click feedback: short visual pulse + ripple + UI click sound.
 *
 * Designed so it can be invoked from anywhere — React handlers, the
 * global delegator (`installGlobalClickFx.ts`), or imperative game code
 * — without taking ownership of the click event itself. We never
 * `preventDefault` or `stopPropagation`; the original handler still runs
 * exactly as it did before.
 */

import { playClickSfx } from '@/audio/uiSfx';

/** CSS class applied for a brief scale-pulse animation. Defined in `index.css`. */
const PULSE_CLASS = 'tropic-fx-clickPulse';
/** CSS class applied to the spawned ripple span. Defined in `index.css`. */
const RIPPLE_CLASS = 'tropic-fx-clickRipple';

/** Track elements we've already mutated so we restore them exactly once. */
const restoreMap = new WeakMap<HTMLElement, { position: string; overflow: string }>();

interface ClickPoint {
  clientX: number;
  clientY: number;
}

/**
 * Plays a click sound and applies the visual ripple/pulse to `target`.
 *
 * @param target  The HTMLElement to feedback on (usually the button).
 * @param point   Optional cursor coordinates so the ripple originates at
 *                the click point. Defaults to the element's center
 *                (useful for keyboard activations).
 */
export function triggerClickFeedback(
  target: HTMLElement,
  point?: ClickPoint,
): void {
  // Audio first so even if the DOM mutations throw, the sound still fires.
  playClickSfx();

  // --- Visual pulse: re-trigger the animation by toggling the class. ---
  target.classList.remove(PULSE_CLASS);
  // Force a reflow so the next class addition restarts the animation.
  void target.offsetWidth;
  target.classList.add(PULSE_CLASS);
  window.setTimeout(() => target.classList.remove(PULSE_CLASS), 360);

  // --- Ripple: spawn a positioned span at the click point. ---
  // The ripple needs `position: relative + overflow: hidden` on the host
  // element so it stays inside the button's bounds. We patch those
  // styles only if the element doesn't already have them, then restore
  // exactly once (on first visit) via the WeakMap.
  if (!restoreMap.has(target)) {
    const computed = window.getComputedStyle(target);
    const restorePosition = computed.position === 'static' ? '' : target.style.position;
    const restoreOverflow = target.style.overflow;
    if (computed.position === 'static') {
      target.style.position = 'relative';
    }
    target.style.overflow = 'hidden';
    restoreMap.set(target, {
      position: restorePosition,
      overflow: restoreOverflow,
    });
  }

  const rect = target.getBoundingClientRect();
  const x = point ? point.clientX - rect.left : rect.width / 2;
  const y = point ? point.clientY - rect.top : rect.height / 2;

  const ripple = document.createElement('span');
  ripple.className = RIPPLE_CLASS;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.setAttribute('aria-hidden', 'true');
  target.appendChild(ripple);

  window.setTimeout(() => {
    ripple.remove();
  }, 620);
}
