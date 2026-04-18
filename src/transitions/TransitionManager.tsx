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
 * Direct store mutations (`useAppStore.setAppState(...)`) still work
 * for boot or debug paths — they just skip the visual.
 */

import { useEffect, useRef, type PropsWithChildren } from 'react';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import { getActiveTransition } from './registry';
import type { TransitionTarget } from './types';

export function TransitionManager({ children }: PropsWithChildren) {
  const setAppState = useAppStore((s) => s.setAppState);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const isRunning = useRef(false);

  useEffect(() => {
    const off = eventBus.on('navigate:request', async (req) => {
      if (isRunning.current) return; // ignore re-entrant nav
      isRunning.current = true;

      const { appState: fromState, activeModule: fromModule } =
        useAppStore.getState();
      const from: TransitionTarget = { appState: fromState, module: fromModule };
      const to: TransitionTarget = {
        appState: req.to,
        module: req.module ?? null,
      };

      const transition = getActiveTransition();

      try {
        await transition.play({ from, to }, () => {
          // Commit halfway — screen is masked here.
          setAppState(to.appState);
          setActiveModule(to.module);
        });
        eventBus.emit('navigate:complete', { to: to.appState, module: to.module });
      } catch (err) {
        console.error('[transitions] effect failed; committing without animation', err);
        setAppState(to.appState);
        setActiveModule(to.module);
      } finally {
        isRunning.current = false;
      }
    });

    return off;
  }, [setAppState, setActiveModule]);

  return <>{children}</>;
}
