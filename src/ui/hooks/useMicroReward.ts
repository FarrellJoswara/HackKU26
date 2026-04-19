/**
 * @file useMicroReward — instant, low-cost feedback for any UI control.
 *
 * Goal: every important click in the app produces a snappy visual + audio
 * response within one frame, without bespoke per-screen code.
 *
 * Usage (raw button):
 *
 *   const { overlayRef, onClick } = useMicroReward({ level: 'normal' });
 *   <button className="th-btnPlay" onClick={onClick(handlePlay)}>
 *     <span ref={overlayRef} className="ui-reward-overlay" aria-hidden />
 *     Play
 *   </button>
 *
 * Design notes (see `ui_engagement_ideas` plan):
 *   - Trigger source is React `onClick` only. Native `<button>` elements
 *     already dispatch `click` on Enter/Space, so adding `onKeyDown`
 *     here would double-fire the reward.
 *   - The visual class lives on a *child overlay element*, not the
 *     button itself, so it animates `opacity` / `box-shadow` only and
 *     never fights the existing `tropic-pill` / `th-btn*` transforms.
 *   - Throttling uses a `useRef`, not React state, so rapid clicks do
 *     not queue duplicate animations or extra renders.
 *   - Audio is best-effort and wrapped in `try/catch`; failures never
 *     bubble back into the host click handler. Mute is honored
 *     automatically because `audio.playSFX` routes through Howler's
 *     global mute (wired by `SettingsScreen`).
 *   - Cleanup on unmount clears any pending timer and removes any
 *     lingering reward class so a fast unmount can never strand the
 *     overlay in a "lit" state.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { audio } from '@/audio/AudioManager';

export type MicroRewardLevel = 'subtle' | 'normal' | 'strong';

export interface UseMicroRewardOptions {
  /** Visual + audio intensity. Default `'normal'`. */
  level?: MicroRewardLevel;
  /**
   * Sound id registered in `src/audio/tracks.ts`. Pass `null` to
   * disable audio for this control while keeping the visual reward.
   * Default `'uiClick'`.
   */
  sfxId?: string | null;
  /** When true, suppresses both visual and audio. Default `false`. */
  disabled?: boolean;
  /**
   * Per-instance throttle window in ms. Prevents double-clicks from
   * stacking the animation. Default `80` — short enough that
   * intentional rapid clicks still feel responsive.
   */
  throttleMs?: number;
}

export interface UseMicroRewardResult {
  /** Attach to a child `<span aria-hidden className="ui-reward-overlay" />`. */
  overlayRef: RefObject<HTMLSpanElement>;
  /**
   * Wraps a user click handler so the reward fires first (synchronously,
   * preserving the user-gesture context for audio) and the user handler
   * runs immediately after. Always returns a stable function shape:
   *
   *   <button onClick={onClick(myHandler)} />
   *
   * Calling with no argument is also valid for buttons that need the
   * reward without a custom handler.
   */
  onClick: <E extends { defaultPrevented?: boolean }>(
    userHandler?: (event: E) => void,
  ) => (event: E) => void;
}

const REWARD_CLASS_PREFIX = 'is-rewarding-';

/**
 * Total visible duration of the reward class on the overlay. MUST match
 * the keyframe animation duration on the matching `.is-rewarding-*`
 * class in `src/ui/island-ui.css` so the class is removed exactly when
 * the animation completes (avoids a stuck-final frame on slow devices).
 */
const VISIBLE_MS_BY_LEVEL: Record<MicroRewardLevel, number> = {
  subtle: 360,
  normal: 460,
  strong: 560,
};

export function useMicroReward(
  options: UseMicroRewardOptions = {},
): UseMicroRewardResult {
  const {
    level = 'normal',
    sfxId = 'uiClick',
    disabled = false,
    throttleMs = 80,
  } = options;

  // `useRef<T>(null)` returns the read-only `RefObject<T>` shape JSX
  // `ref` props expect (vs `useRef<T | null>(null)` which yields a
  // mutable ref the JSX type rejects).
  const overlayRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Seed at -Infinity so the *first* click is never throttled, even
  // under fake timers where `performance.now()` starts at 0 (which
  // would tie with a default `0` baseline and incorrectly suppress
  // the very first reward).
  const lastFiredAtRef = useRef<number>(Number.NEGATIVE_INFINITY);
  // Latest element we lit a reward on. Captured at fire-time so the
  // unmount cleanup can clear classes even after React has already
  // detached `overlayRef` from the JSX ref slot during teardown.
  const litElRef = useRef<HTMLSpanElement | null>(null);

  // Capture the latest options without re-creating the click wrapper on
  // every render. Consumers commonly inline the options object.
  const optsRef = useRef({ level, sfxId, disabled, throttleMs });
  optsRef.current = { level, sfxId, disabled, throttleMs };

  // Tear down any pending timer + lingering class on unmount so a fast
  // unmount never leaves the DOM in a lit state.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Prefer the lit element captured at fire time. `overlayRef.current`
      // is null by the time React runs effect cleanups on unmount, so
      // relying on it alone would miss cleanup of an in-flight reward.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const el = litElRef.current ?? overlayRef.current;
      if (el) {
        el.classList.remove(
          `${REWARD_CLASS_PREFIX}subtle`,
          `${REWARD_CLASS_PREFIX}normal`,
          `${REWARD_CLASS_PREFIX}strong`,
        );
      }
      litElRef.current = null;
    };
  }, []);

  const fire = useCallback(() => {
    const opts = optsRef.current;
    if (opts.disabled) return;

    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastFiredAtRef.current < opts.throttleMs) return;
    lastFiredAtRef.current = now;

    const el = overlayRef.current;
    const className = `${REWARD_CLASS_PREFIX}${opts.level}`;
    if (el) {
      // Clear any prior level so visual state is deterministic even if
      // `level` changed between activations.
      el.classList.remove(
        `${REWARD_CLASS_PREFIX}subtle`,
        `${REWARD_CLASS_PREFIX}normal`,
        `${REWARD_CLASS_PREFIX}strong`,
      );
      // Force reflow so re-applying the same class re-triggers the CSS
      // transition for back-to-back rewards (after the throttle window).
      void el.offsetWidth;
      el.classList.add(className);
      // Capture the live node so the timeout + unmount cleanup can
      // operate on it even if the JSX ref slot is later cleared.
      litElRef.current = el;

      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        el.classList.remove(className);
        if (litElRef.current === el) litElRef.current = null;
      }, VISIBLE_MS_BY_LEVEL[opts.level]);
    }

    if (opts.sfxId) {
      try {
        audio.playSFX(opts.sfxId);
      } catch (err) {
        // Audio must never break the click. Howler is generally tolerant
        // but defensive `try/catch` keeps a misregistered id or a
        // suspended AudioContext from bubbling up.
        if (import.meta.env.DEV) {
          console.warn('[useMicroReward] sfx play failed', err);
        }
      }
    }
  }, []);

  const onClick = useCallback(
    <E extends { defaultPrevented?: boolean }>(
      userHandler?: (event: E) => void,
    ) =>
      (event: E) => {
        // Reward fires first so it stays inside the user-gesture stack
        // (some browsers gate audio on that).
        fire();
        if (userHandler && !event.defaultPrevented) userHandler(event);
      },
    [fire],
  );

  return { overlayRef, onClick };
}
