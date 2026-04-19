import { useCallback } from 'react';
import { useEventBus, eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { RunnerFinishedPayload, StoredRunnerLastRun } from './runnerTypes';

const PLAYER_DATA_KEY = 'runner.lastRun';

export function RunnerResultRouter() {
  const mergePlayerData = useAppStore((s) => s.mergePlayerData);

  const onFinished = useCallback(
    (payload: RunnerFinishedPayload) => {
      const stored: StoredRunnerLastRun = {
        ...payload,
        endedAtMs: payload.endedAtMs ?? Date.now(),
      };

      mergePlayerData({ [PLAYER_DATA_KEY]: stored });

      eventBus.emit('navigate:request', {
        to: payload.outcome === 'win' ? 'win' : 'loss',
        module: null,
      });
    },
    [mergePlayerData],
  );

  useEventBus('runner:finished', onFinished);

  return null;
}

export function getStoredLastRun(data: Record<string, unknown>): StoredRunnerLastRun | null {
  const raw = data[PLAYER_DATA_KEY] as StoredRunnerLastRun | undefined;
  if (!raw || typeof raw !== 'object') return null;
  if (raw.outcome !== 'win' && raw.outcome !== 'loss') return null;
  if (!raw.config || typeof raw.config !== 'object') return null;
  return raw;
}

