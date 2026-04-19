/**
 * @file Lightweight, non-interactive, opaque-enough placeholder used as a
 * `<Suspense fallback={...}>` for lazy-loaded screens and games.
 *
 * Design intent:
 *  - Full-viewport so a transition's reveal phase never exposes empty
 *    DOM behind the mask.
 *  - On-theme background that matches the global `body` gradient, so
 *    even if the transition lifts before the chunk is ready the user
 *    sees a beach-themed wash, not a black flash.
 *  - `pointer-events: none` so it never traps clicks intended for any
 *    layer the host renders alongside it.
 */

export function SuspenseShell() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          'linear-gradient(180deg, #7ec8ff 0%, #4aa8d8 35%, #2d8a9e 100%)',
      }}
    />
  );
}
