/**
 * Behavioral test for `RunnerResultRouter`. The router is the bridge
 * between any runner-style game and the post-run summary screen, so
 * regressions here would silently break the year-end loop.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';

import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import { GAME_IDS } from '@/games/registry';
import { RunnerResultRouter } from './RunnerResultRouter';
import type { RunnerFinishedPayload } from './runnerTypes';

function freshStore() {
  useAppStore.setState({
    appState: 'game',
    activeModule: null,
    playerData: {},
  });
}

function payload(): RunnerFinishedPayload {
  return {
    moduleId: GAME_IDS.debtRunner,
    outcome: 'loss',
    failReason: 'caught',
    config: {
      profile: {
        annualIncome: 50000,
        annualExpenses: 40000,
        annualSavings: 10000,
        debtBalance: 0,
        debtAprPct: 0,
        savingsRatePct: 20,
        notes: [],
      } as never,
      durationSeconds: 60,
      totalDebtPressureTier: 'low',
    },
    stats: { timeSurvivedSeconds: 12 },
  };
}

describe('RunnerResultRouter', () => {
  beforeEach(() => {
    eventBus.clear();
    freshStore();
  });
  afterEach(() => {
    eventBus.clear();
  });

  it('persists runner.lastRun and routes to summary on runner:finished', async () => {
    const requests: Array<{ to: string }> = [];
    eventBus.on('navigate:request', (p) => requests.push({ to: p.to }));

    render(<RunnerResultRouter />);

    await act(async () => {
      eventBus.emit('runner:finished', payload());
    });

    const stored = useAppStore.getState().playerData['runner.lastRun'] as
      | { outcome: string; endedAtMs?: number }
      | undefined;
    expect(stored?.outcome).toBe('loss');
    expect(typeof stored?.endedAtMs).toBe('number');
    expect(requests).toEqual([{ to: 'summary' }]);
  });

  it('bumps runner.timesCaught only on caught losses', async () => {
    render(<RunnerResultRouter />);

    await act(async () => {
      eventBus.emit('runner:finished', payload());
    });
    await act(async () => {
      eventBus.emit('runner:finished', { ...payload(), failReason: 'fall' });
    });

    const caught = useAppStore.getState().playerData['runner.timesCaught'];
    expect(caught).toBe(1);
  });
});
