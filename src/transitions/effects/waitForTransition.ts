/**
 * Awaits a CSS transition on `el` for a specific property, with a hard
 * timeout fallback so a missed `transitionend` (interrupted, unchanged
 * value, duration 0, or browser quirk) can never deadlock a transition
 * effect.
 *
 * Resolution rules:
 *  - Resolves on the first `transitionend` for `propertyName`.
 *  - Resolves immediately if `maxMs <= 0` (caller can pre-flush).
 *  - Resolves after `maxMs` if no event arrives.
 *  - Always removes its listener exactly once.
 */
export function waitForTransition(
  el: HTMLElement,
  propertyName: string,
  maxMs: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (maxMs <= 0) {
      resolve();
      return;
    }

    let settled = false;
    const onEnd = (ev: TransitionEvent) => {
      if (ev.propertyName !== propertyName) return;
      finish();
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener('transitionend', onEnd);
      clearTimeout(timer);
      resolve();
    };

    el.addEventListener('transitionend', onEnd);
    // Safety fallback: pad slightly past the expected duration so a
    // late `transitionend` still has a chance to fire first.
    const timer = setTimeout(finish, maxMs + 60);
  });
}

/** One animation frame, useful to flush style writes before measuring. */
export function nextFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
