/**
 * `TransitionManager` is the *only* component that should change
 * `appState`/`activeModule` when a visual hand-off is desired.
 *
 *   eventBus.emit('navigate:request', { to: 'game', module: gameId });
 *
 * It listens for `navigate:request` events, runs the active `Transition`
 * effect, and only commits the store mutation halfway through the
 * animation (when the screen is masked). Callers therefore never have to
 * coordinate "fade then change state then fade back" themselves.
 *
 * Reliability contract:
 *  - Only one transition runs at a time.
 *  - If a request arrives while busy, it is held in a single "latest"
 *    slot; whichever request is latest at the moment we drain wins.
 *    This guarantees the user's *final* navigation intent is honored
 *    instead of being silently dropped.
 *  - `navigate:complete` is emitted only for transitions whose target
 *    was actually committed (never for superseded slot contents).
 *  - Same-route requests (where `from` already equals `to`) skip the
 *    visual effect entirely so duplicate emits do not cause a flash.
 *
 * Direct store mutations (`useAppStore.setAppState(...)`) still work
 * for boot or debug paths — they just skip the visual.
 */

import { useEffect, useRef, type PropsWithChildren } from 'react';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import { getActiveTransition } from './registry';
import type { EventMap } from '@/core/types';
import type { TransitionTarget } from './types';

type NavRequest = EventMap['navigate:request'];

export function TransitionManager({ children }: PropsWithChildren) {
  const setAppState = useAppStore((s) => s.setAppState);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const isRunning = useRef(false);
  const pending = useRef<NavRequest | null>(null);

  useEffect(() => {
    const runOne = async (req: NavRequest): Promise<void> => {
      const { appState: fromState, activeModule: fromModule } =
        useAppStore.getState();
      const from: TransitionTarget = { appState: fromState, module: fromModule };
      const to: TransitionTarget = {
        appState: req.to,
        module: req.module ?? null,
      };

      // Same-route short-circuit: emit `navigate:complete` so any
      // listeners still fire, but skip the visual to avoid a flash.
      if (from.appState === to.appState && from.module === to.module) {
        eventBus.emit('navigate:complete', {
          to: to.appState,
          module: to.module,
        });
        return;
      }

      const transition = getActiveTransition();

      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        setAppState(to.appState);
        setActiveModule(to.module);
      };

      try {
        await transition.play({ from, to }, commit);
      } catch (err) {
        console.error(
          '[transitions] effect failed; committing without animation',
          err,
        );
        commit();
      }

      // The effect's `finally` block is responsible for forcing commit,
      // but be defensive: if the effect somehow skipped commit, do it
      // now so the app cannot get stuck on the old route.
      commit();

      eventBus.emit('navigate:complete', {
        to: to.appState,
        module: to.module,
      });
    };

    const setTransitioning = (on: boolean): void => {
      if (typeof document === 'undefined') return;
      if (on) document.body.dataset.transitioning = 'true';
      else delete document.body.dataset.transitioning;
    };

    const drain = async (initial: NavRequest): Promise<void> => {
      if (isRunning.current) {
        // Latest-request-wins: overwrite any older pending request.
        pending.current = initial;
        return;
      }
      isRunning.current = true;
      setTransitioning(true);
      let next: NavRequest | null = initial;
      try {
        while (next) {
          const current = next;
          next = null;
          await runOne(current);
          // Pull any request that arrived during the run; the slot
          // already contains the latest one.
          if (pending.current) {
            next = pending.current;
            pending.current = null;
          }
        }
      } finally {
        isRunning.current = false;
        setTransitioning(false);
      }
    };

    const off = eventBus.on('navigate:request', (req) => {
      // Fire-and-forget: drain manages its own lifecycle.
      void drain(req);
    });

    return off;
  }, [setAppState, setActiveModule]);

  return <>{children}</>;
}
