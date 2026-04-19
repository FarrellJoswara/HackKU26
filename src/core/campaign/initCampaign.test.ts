import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import { BOX_PLAYER_DATA_KEYS } from '@/core/budgetTypes';
import { __resetCampaignForTests, initCampaign } from './initCampaign';
import { CAMPAIGN_KEYS, DEBT_RUNNER_KEYS } from './campaignKeys';
import { GAME_IDS } from '@/games/registry';

function freshStore() {
  useAppStore.setState({
    appState: 'menu',
    activeModule: null,
    playerData: {},
  });
}

describe('initCampaign', () => {
  beforeEach(() => {
    eventBus.clear();
    __resetCampaignForTests();
    freshStore();
  });

  afterEach(() => {
    eventBus.clear();
    __resetCampaignForTests();
  });

  it('subscribes once even if called multiple times', () => {
    initCampaign();
    initCampaign();
    initCampaign();

    const navs = vi.fn();
    eventBus.on('navigate:request', navs);

    eventBus.emit('box:budget:submit', {
      allocations: { rent: 10000, food: 4000 } as never,
      annualSalary: 50000,
      highInterestDebtBalanceAtSubmit: 0,
      inflationRate: 0.03,
      employerMatchProjected: 0,
      year: 1,
      pendingCashConsumed: 0,
    });

    const store = useAppStore.getState();
    expect(store.playerData[CAMPAIGN_KEYS.boxReadyForYear]).toBe(1);
    expect(store.playerData['runner.profile']).toBeDefined();
    // Default test store has appState='menu' (not 'budget'), so submit
    // alone should not trigger a navigation.
    expect(navs).not.toHaveBeenCalled();
  });

  it('navigates to Island after Box submit on the campaign path (appState=budget)', () => {
    initCampaign();
    useAppStore.setState({ appState: 'budget', activeModule: null, playerData: {} });
    const navs: Array<{ to: string }> = [];
    eventBus.on('navigate:request', (p) => navs.push({ to: p.to }));

    eventBus.emit('box:budget:submit', {
      allocations: { rent: 10000 } as never,
      annualSalary: 50000,
      highInterestDebtBalanceAtSubmit: 0,
      inflationRate: 0.03,
      employerMatchProjected: 0,
      year: 1,
      pendingCashConsumed: 0,
    });
    expect(navs).toEqual([{ to: 'game' }]);
  });

  it('routes to DebtRunner tutorial on year-end with debt + tutorial unseen', () => {
    initCampaign();
    useAppStore.setState((s) => ({
      playerData: {
        ...s.playerData,
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 5000,
        [DEBT_RUNNER_KEYS.tutorialSeen]: false,
      },
    }));
    const requests: Array<{ to: string; module: string | null }> = [];
    eventBus.on('navigate:request', (p) => {
      requests.push({ to: p.to, module: (p.module ?? null) as string | null });
    });

    eventBus.emit('island:yearComplete', { year: 2, totalHops: 12 });

    expect(requests).toHaveLength(1);
    expect(requests[0]!.to).toBe('debtRunnerTutorial');
  });

  it('routes straight to briefing when DebtRunner tutorial already seen', () => {
    initCampaign();
    useAppStore.setState((s) => ({
      playerData: {
        ...s.playerData,
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 5000,
        [DEBT_RUNNER_KEYS.tutorialSeen]: true,
      },
    }));
    const requests: string[] = [];
    eventBus.on('navigate:request', (p) => requests.push(p.to));
    eventBus.emit('island:yearComplete', { year: 2, totalHops: 12 });
    expect(requests).toEqual(['briefing']);
  });

  it('routes to InvestingBirds when debt is cleared', () => {
    initCampaign();
    useAppStore.setState((s) => ({
      playerData: {
        ...s.playerData,
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
      },
    }));
    const captured: Array<{ to: string; module: unknown }> = [];
    eventBus.on('navigate:request', (p) => captured.push({ to: p.to, module: p.module }));

    eventBus.emit('island:yearComplete', { year: 1, totalHops: 12 });

    expect(captured).toHaveLength(1);
    expect(captured[0]!.to).toBe('game');
    expect(captured[0]!.module).toBe(GAME_IDS.investingBirds);
  });

  it('ignores re-entrant year-complete emits in the same tick', () => {
    initCampaign();
    useAppStore.setState((s) => ({
      playerData: {
        ...s.playerData,
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
      },
    }));
    const fired = vi.fn();
    eventBus.on('navigate:request', fired);
    eventBus.emit('island:yearComplete', { year: 1, totalHops: 12 });
    eventBus.emit('island:yearComplete', { year: 1, totalHops: 12 });
    expect(fired).toHaveBeenCalledTimes(1);
  });
});
