import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import { BOX_PLAYER_DATA_KEYS } from '@/core/budgetTypes';
import { CAMPAIGN_KEYS } from './campaignKeys';
import { advanceCampaignYear } from './yearAdvance';
import { GAME_IDS } from '@/games/registry';

function freshStore(seed: Record<string, unknown> = {}) {
  useAppStore.setState({
    appState: 'menu',
    activeModule: null,
    playerData: { ...seed },
  });
}

describe('advanceCampaignYear', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  afterEach(() => {
    eventBus.clear();
  });

  it('default path navigates to Island, bumps year, applies quarter-of-initial debt cut on win, keeps box gate satisfied', () => {
    freshStore({
      [BOX_PLAYER_DATA_KEYS.currentYear]: 2,
      [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 6000,
      [BOX_PLAYER_DATA_KEYS.boxAllocations]: { highInterestDebt: 1500 },
      [CAMPAIGN_KEYS.boxReadyForYear]: 2,
      [CAMPAIGN_KEYS.initialHighInterestDebt]: 12_000,
    });
    const navs: Array<{ to: string; module: unknown }> = [];
    eventBus.on('navigate:request', (p) => navs.push({ to: p.to, module: p.module }));

    const summary = advanceCampaignYear('win');

    const store = useAppStore.getState();
    expect(navs).toEqual([{ to: 'game', module: GAME_IDS.islandRun }]);
    expect(store.playerData[BOX_PLAYER_DATA_KEYS.currentYear]).toBe(3);
    expect(store.playerData[CAMPAIGN_KEYS.year]).toBe(3);
    expect(store.playerData[CAMPAIGN_KEYS.boxReadyForYear]).toBe(3);
    expect(summary.fromYear).toBe(2);
    expect(summary.toYear).toBe(3);
    expect(summary.debtReductionFromWinUsd).toBe(3000);
    expect(summary.debtAfterUsd).toBe(3000);
    expect(summary.interestPenaltyUsd).toBe(0);
  });

  it('navigates to The Box when navigateTo is budget and clears the soft gate', () => {
    freshStore({
      [BOX_PLAYER_DATA_KEYS.currentYear]: 1,
      [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 5000,
    });
    const navs: Array<{ to: string }> = [];
    eventBus.on('navigate:request', (p) => navs.push({ to: p.to }));

    advanceCampaignYear('win', { navigateTo: 'budget' });

    const store = useAppStore.getState();
    expect(navs).toEqual([{ to: 'budget' }]);
    expect(store.playerData[CAMPAIGN_KEYS.boxReadyForYear]).toBe(0);
  });

  it('loss leaves debt unchanged and still advances year to Island', () => {
    freshStore({
      [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 10_000,
      [BOX_PLAYER_DATA_KEYS.boxAllocations]: { highInterestDebt: 0 },
      [BOX_PLAYER_DATA_KEYS.currentYear]: 1,
    });

    const summary = advanceCampaignYear('loss');

    expect(summary.debtReductionFromWinUsd).toBe(0);
    expect(summary.interestPenaltyUsd).toBe(0);
    expect(summary.debtAfterUsd).toBe(10_000);
  });

  it('caps win reduction at remaining balance when less than a quarter of initial', () => {
    freshStore({
      [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 1800,
      [CAMPAIGN_KEYS.initialHighInterestDebt]: 10_000,
      [BOX_PLAYER_DATA_KEYS.currentYear]: 1,
    });
    const summary = advanceCampaignYear('win');
    expect(summary.debtReductionFromWinUsd).toBe(1800);
    expect(summary.debtAfterUsd).toBe(0);
  });

  it('does not change debt when balance is already zero on loss', () => {
    freshStore({
      [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
      [BOX_PLAYER_DATA_KEYS.currentYear]: 3,
    });

    const summary = advanceCampaignYear('loss');

    expect(summary.interestPenaltyUsd).toBe(0);
    expect(summary.debtAfterUsd).toBe(0);
  });
});
