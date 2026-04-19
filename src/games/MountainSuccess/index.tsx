/**
 * Mountain Success — financial-freedom cinematic.
 *
 * Mirrors the IslandRun shell (own `WebGLRenderer` mounted *outside* the
 * host R3F `<Canvas>` via `App.tsx`). The DOM here is just:
 *   - the canvas root that `main.ts` attaches into,
 *   - cinematic letterbox bars + caption stack (CSS-driven via
 *     `animation-delay`, no JS handshake),
 *   - a final white fade overlay.
 *
 * Lifecycle:
 *   1. Inject the game-scoped CSS + Google Fonts on mount.
 *   2. Lock body scroll, call `bootstrap({ onComplete })` and stash its
 *      cleanup closure.
 *   3. On `onComplete` (fired ~15s into the cinematic by `main.ts`),
 *      navigate back to the Title Hub via the typed Event Bus. The
 *      existing `TransitionManager` runs the global hand-off, so the
 *      in-scene white fade chains naturally with the app's transition.
 *   4. Unmount cleans up RAF / WebGL / styles.
 *
 * Per AGENTS.md the shell never imports `src/ui/**` or other games'
 * implementation files; the only cross-game touch is a `?url` import
 * for the same banana / cloud / sun GLBs IslandRun uses, which happens
 * inside `main.ts` (static asset URLs, not code).
 */

import { useEffect, useRef } from 'react';
import { advanceCampaignYear } from '@/core/campaign/yearAdvance';
import { bootstrap } from './main';
import styleText from './style.css?inline';

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600&display=swap';

export default function MountainSuccess() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-mountain-success', '');
    styleEl.textContent = styleText;
    document.head.appendChild(styleEl);

    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = FONTS_HREF;
    fontLink.setAttribute('data-mountain-success', '');
    document.head.appendChild(fontLink);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let cleanup: () => void = () => {};
    try {
      cleanup = bootstrap({
        onComplete: () => {
          // The cinematic IS the year-end celebration on financial-freedom
          // years, so close the year through the unified pipeline so the
          // counter, debt math, and economy roll cannot be skipped by
          // playing through Mountain Success instead of DebtRunner. We
          // route to the post-cinematic playthrough recap rather than the
          // menu so the player gets to see the run-level stats before
          // returning home. The TransitionManager picks up the resulting
          // `navigate:request`, chaining the in-scene white fade into the
          // global transition.
          advanceCampaignYear({
            outcome: 'win',
            destination: 'playthroughSummary',
          });
        },
      });
    } catch (e) {
      console.error('[MountainSuccess] bootstrap failed', e);
      document.getElementById('mountain-webgl-error')?.classList.remove('hidden');
    }

    return () => {
      cleanup();
      document.body.style.overflow = prevOverflow;
      styleEl.remove();
      fontLink.remove();
      started.current = false;
    };
  }, []);

  return (
    <>
      <div
        id="mountain-webgl-error"
        className="webgl-error hidden"
        role="alert"
        aria-live="assertive"
      >
        <p>
          WebGL could not start this scene. Try another browser or update
          your graphics drivers.
        </p>
      </div>

      <main
        id="mountain-canvas-root"
        className="canvas-root"
        tabIndex={-1}
        aria-label="Financial freedom cinematic"
      />

      {/* Letterbox bars slide in over the first 1.2s — instantly cues
          "this is a cutscene." */}
      <div className="scene-bar is-top" aria-hidden />
      <div className="scene-bar is-bottom" aria-hidden />

      {/* Captions are intentionally CSS-driven via `animation-delay` so
          there is no two-way timing handshake with `main.ts`. */}
      <div className="scene-hud" role="status" aria-live="polite">
        <p className="scene-chip">Financial Freedom</p>
        <h2 className="scene-title">You reached Stability Summit</h2>
        <p className="scene-subtitle">
          The world is your Oyster
        </p>
      </div>

      <div className="scene-fade" aria-hidden />
    </>
  );
}
