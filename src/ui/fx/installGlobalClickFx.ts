/**
 * Install a single document-level click delegator that applies the
 * gamified click feedback (sound + ripple + pulse) to every interactive
 * surface in the app, without requiring per-component changes.
 *
 * Why a delegator instead of touching every Button/<button>?
 *   - The user's request was explicit: gamify EVERYTHING, every site.
 *     A delegator covers shared components (`Button.tsx`), the Title
 *     Hub raw buttons (`th-btnPlay` / `th-btnSettings`), all dev
 *     shortcuts (`island-btnShell`), Island Run's HUD buttons
 *     (`btn-shell`, `btn-choice`, `btn-continue`), Investing Birds, and
 *     anything we add later — all from one install call.
 *   - It's idempotent (`installed` guard), capture-phase, and never
 *     mutates the click event itself, so existing handlers run exactly
 *     as they did before.
 *
 * Scope (positive list — see `SELECTORS`):
 *   We deliberately match a curated list of button classes plus a
 *   defensive fallback for plain `<button type="button">`. We do NOT
 *   match every `<button>` because tab strips, accordion headers, and
 *   third-party widgets often use `<button>` for non-feedback-worthy
 *   purposes. If a new screen adds a button class, add it here.
 */

import { triggerClickFeedback } from './clickFeedback';

/**
 * Buttons we want to gamify. Each entry must be a CSS selector that
 * matches the actual button element (not a wrapper).
 */
const SELECTORS: readonly string[] = [
  // Shared `Button` component variants (coral, turquoise, sand, ghost,
  // primary). All variants render `tropic-pill` as the first class.
  '.tropic-pill',
  // Dev / menu shell buttons used across screens.
  '.island-btnShell',
  // Title hub primary actions.
  '.th-btnPlay',
  '.th-btnSettings',
  // Island Run HUD + landing dialog buttons.
  '.btn-shell',
  '.btn-choice',
  '.btn-continue',
  '.btn-cap',
  '.landing-dismiss',
  // Island Run: floating "The Box" open button.
  '.island-openBoxBtn',
  // Investing Birds overlay controls.
  '.ib-btnPrimary',
  '.ib-btnGhost',
  // Difficulty picker cards.
  '.difficulty-card-btn',
  // Inline info/help trigger buttons.
  '.info-mark-btn',
  // Play mode dialog close button (top-right "X").
  '.play-mode-close-btn',
  // UIRegistry hard-fallback recovery button.
  '.ui-route-error-btn',
];

const SELECTOR = SELECTORS.join(',');

let installed = false;

/**
 * Wire the global click listener. Calling more than once is a no-op so
 * StrictMode's double-mount in dev does not stack listeners.
 */
export function installGlobalClickFx(): void {
  if (installed) return;
  if (typeof document === 'undefined') return;
  installed = true;

  // Capture phase so the feedback fires even if a child handler later
  // calls `stopPropagation`. We never mutate the event itself.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest<HTMLElement>(SELECTOR);
      if (!btn) return;
      // Respect disabled buttons — both attribute form and ARIA form.
      if (btn.hasAttribute('disabled')) return;
      if (btn.getAttribute('aria-disabled') === 'true') return;
      // Guard against synthetic events with no positional data.
      const point =
        Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
          ? { clientX: event.clientX, clientY: event.clientY }
          : undefined;
      triggerClickFeedback(btn, point);
    },
    true,
  );
}
