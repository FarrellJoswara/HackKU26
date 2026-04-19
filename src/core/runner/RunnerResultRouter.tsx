/**
 * @file Listens for `runner:finished`, writes last-run stats to `playerData`,
 * bumps catch counters when applicable, and navigates to the post-run summary.
 * Mount once under `App`; renders `null`.
 */

import { useCallback } from 'react';
import { useEventBus, eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { RunnerFinishedPayload, StoredRunnerLastRun } from './runnerTypes';

const PLAYER_DATA_KEY = 'runner.lastRun';
const TIMES_CAUGHT_KEY = 'runner.timesCaught';

export function RunnerResultRouter() {
  const mergePlayerData = useAppStore((s) => s.mergePlayerData);

  const onFinished = useCallback(
    (payload: RunnerFinishedPayload) => {
      const stored: StoredRunnerLastRun = {
        ...payload,
        endedAtMs: payload.endedAtMs ?? Date.now(),
      };

      const prevCaught =
        (useAppStore.getState().playerData[TIMES_CAUGHT_KEY] as number | undefined) ?? 0;
      const caughtBump =
        payload.outcome === 'loss' && payload.failReason === 'caught'
          ? { [TIMES_CAUGHT_KEY]: prevCaught + 1 }
          : {};

      mergePlayerData({ ...caughtBump, [PLAYER_DATA_KEY]: stored });

      // Run-end always lands on Financial Debrief. This removes the extra
      // intermediate win/loss card so the loop stays focused:
      // runner -> debrief -> continue next year.
      eventBus.emit('navigate:request', {
        to: 'summary',
        module: null,
      });
    },
    [mergePlayerData],
  );

  useEventBus('runner:finished', onFinished);

  return null;
}

// eslint-disable-next-line react-refresh/only-export-components
export function getStoredLastRun(data: Record<string, unknown>): StoredRunnerLastRun | null {
  const raw = data[PLAYER_DATA_KEY] as StoredRunnerLastRun | undefined;
  if (!raw || typeof raw !== 'object') return null;
  if (raw.outcome !== 'win' && raw.outcome !== 'loss') return null;
  if (!raw.config || typeof raw.config !== 'object') return null;
  return raw;
}

