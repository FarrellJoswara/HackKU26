/**
 * Behavioral contract tests for `TransitionManager`.
 *
 * These cases lock in the four reliability invariants that motivated
 * the transition glitch fix pass:
 *   1. A successful transition commits exactly once and emits
 *      `navigate:complete` exactly once for the committed target.
 *   2. While a transition is in flight, additional `navigate:request`
 *      events are coalesced (latest-request-wins) and run after the
 *      current one — never silently dropped.
 *   3. If the active transition's `play()` rejects, the manager still
 *      commits the target (no stuck route).
 *   4. A request whose target equals the current state skips the
 *      visual transition but still emits `navigate:complete` so any
 *      downstream listeners stay consistent.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';

import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import * as registry from './registry';
import { TransitionManager } from './TransitionManager';
import type { Transition } from './types';

function freshStore() {
  useAppStore.setState({
    appState: 'menu',
    activeModule: null,
    playerData: {},
  });
}

/** Awaits queued microtasks/promises so `await drain(...)` settles. */
const flushAsync = () => new Promise<void>((r) => setTimeout(r, 0));

describe('TransitionManager', () => {
  let restoreActive: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    eventBus.clear();
    freshStore();
    delete document.body.dataset.transitioning;
  });

  afterEach(() => {
    eventBus.clear();
    restoreActive?.mockRestore();
    delete document.body.dataset.transitioning;
  });

  it('commits the target and emits navigate:complete exactly once', async () => {
    const transition: Transition = {
      id: 'test-instant',
      play: async (_opts, commit) => {
        commit();
      },
    };
    restoreActive = vi
      .spyOn(registry, 'getActiveTransition')
      .mockReturnValue(transition);

    const completes: string[] = [];
    eventBus.on('navigate:complete', (p) => completes.push(p.to));

    render(<TransitionManager />);

    await act(async () => {
      eventBus.emit('navigate:request', { to: 'settings', module: null });
      await flushAsync();
    });

    expect(useAppStore.getState().appState).toBe('settings');
    expect(useAppStore.getState().activeModule).toBeNull();
    expect(completes).toEqual(['settings']);
  });

  it('queues a request that arrives while busy and runs the latest one next', async () => {
    let releaseFirst!: () => void;
    const inFlight = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const calls: string[] = [];
    const transition: Transition = {
      id: 'test-blocking',
      play: async (opts, commit) => {
        calls.push(opts.to.appState);
        if (opts.to.appState === 'settings') {
          // Hold the first transition open so we can stack requests.
          await inFlight;
        }
        commit();
      },
    };
    restoreActive = vi
      .spyOn(registry, 'getActiveTransition')
      .mockReturnValue(transition);

    const completes: string[] = [];
    eventBus.on('navigate:complete', (p) => completes.push(p.to));

    render(<TransitionManager />);

    // Kick off the first transition (held open).
    await act(async () => {
      eventBus.emit('navigate:request', { to: 'settings', module: null });
      await flushAsync();
    });

    // Stack two more while busy. Latest-request-wins: we expect only
    // the LAST one ('summary') to run after the first completes.
    await act(async () => {
      eventBus.emit('navigate:request', { to: 'briefing', module: null });
      eventBus.emit('navigate:request', { to: 'summary', module: null });
      await flushAsync();
    });

    expect(useAppStore.getState().appState).toBe('menu');
    expect(calls).toEqual(['settings']);

    await act(async () => {
      releaseFirst();
      await flushAsync();
      await flushAsync();
    });

    expect(calls).toEqual(['settings', 'summary']);
    expect(useAppStore.getState().appState).toBe('summary');
    expect(completes).toEqual(['settings', 'summary']);
  });

  it('still commits the target if the transition play rejects', async () => {
    const transition: Transition = {
      id: 'test-reject',
      play: async () => {
        throw new Error('boom');
      },
    };
    restoreActive = vi
      .spyOn(registry, 'getActiveTransition')
      .mockReturnValue(transition);

    // Silence the expected console.error in this case.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<TransitionManager />);

    await act(async () => {
      eventBus.emit('navigate:request', { to: 'win', module: null });
      await flushAsync();
    });

    expect(useAppStore.getState().appState).toBe('win');
    errSpy.mockRestore();
  });

  it('short-circuits same-route requests but still emits navigate:complete', async () => {
    const playSpy = vi.fn(async (_opts, commit: () => void) => commit());
    const transition: Transition = {
      id: 'test-counted',
      play: playSpy,
    };
    restoreActive = vi
      .spyOn(registry, 'getActiveTransition')
      .mockReturnValue(transition);

    const completes: Array<{ to: string; module: unknown }> = [];
    eventBus.on('navigate:complete', (p) =>
      completes.push({ to: p.to, module: p.module ?? null }),
    );

    render(<TransitionManager />);

    await act(async () => {
      // Current state is 'menu' / null — request the same target.
      eventBus.emit('navigate:request', { to: 'menu', module: null });
      await flushAsync();
    });

    expect(playSpy).not.toHaveBeenCalled();
    expect(completes).toEqual([{ to: 'menu', module: null }]);
    expect(useAppStore.getState().appState).toBe('menu');
  });

  it('toggles body[data-transitioning] only while a transition is in flight', async () => {
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    const transition: Transition = {
      id: 'test-flag',
      play: async (_opts, commit) => {
        // Capture the flag mid-play.
        midFlight = document.body.dataset.transitioning;
        await hold;
        commit();
      },
    };
    let midFlight: string | undefined;
    restoreActive = vi
      .spyOn(registry, 'getActiveTransition')
      .mockReturnValue(transition);

    render(<TransitionManager />);

    await act(async () => {
      eventBus.emit('navigate:request', { to: 'settings', module: null });
      await flushAsync();
    });

    expect(midFlight).toBe('true');

    await act(async () => {
      release();
      await flushAsync();
      await flushAsync();
    });

    expect(document.body.dataset.transitioning).toBeUndefined();
  });
});
