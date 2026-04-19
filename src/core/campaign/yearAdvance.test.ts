import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import { BOX_PLAYER_DATA_KEYS } from '@/core/budgetTypes';
import { CAMPAIGN_KEYS } from './campaignKeys';
import { advanceCampaignYear } from './yearAdvance';

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

  it('navigates to The Box for the next year and re-arms the soft gate', () => {
    freshStore({
      [BOX_PLAYER_DATA_KEYS.currentYear]: 2,
      [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 6000,
      [BOX_PLAYER_DATA_KEYS.boxAllocations]: { highInterestDebt: 1500 },
      [CAMPAIGN_KEYS.boxReadyForYear]: 2,
    });
    const navs: Array<{ to: string }> = [];
    eventBus.on('navigate:request', (p) => navs.push({ to: p.to }));

    const summary = advanceCampaignYear('win');

    const store = useAppStore.getState();
    expect(navs).toEqual([{ to: 'budget' }]);
    expect(store.playerData[BOX_PLAYER_DATA_KEYS.currentYear]).toBe(3);
    expect(store.playerData[CAMPAIGN_KEYS.year]).toBe(3);
    // Gate must reset so player can't roll the map without re-budgeting.
    expect(store.playerData[CAMPAIGN_KEYS.boxReadyForYear]).toBe(0);
    expect(summary.fromYear).toBe(2);
    expect(summary.toYear).toBe(3);
    expect(summary.debtPaidUsd).toBe(1500);
    expect(summary.debtAfterUsd).toBe(4500);
    expect(summary.interestPenaltyUsd).toBe(0);
  });

  it('caps debt pay-down at the current debt balance', () => {
    freshStore({
      [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 800,
      [BOX_PLAYER_DATA_KEYS.boxAllocations]: { highInterestDebt: 5000 },
    });

    const summary = advanceCampaignYear('win');

    expect(summary.debtPaidUsd).toBe(800);
    expect(summary.debtAfterUsd).toBe(0);
  });

  it('applies a 2% interest penalty on a runner loss when debt remains', () => {
    freshStore({
      [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 10_000,
      [BOX_PLAYER_DATA_KEYS.boxAllocations]: { highInterestDebt: 0 },
    });

    const summary = advanceCampaignYear('loss');

    expect(summary.debtPaidUsd).toBe(0);
    expect(summary.interestPenaltyUsd).toBe(200);
    expect(summary.debtAfterUsd).toBe(10_200);
  });

  it('does not penalize interest when debt is already zero on loss', () => {
    freshStore({
      [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
    });

    const summary = advanceCampaignYear('loss');

    expect(summary.interestPenaltyUsd).toBe(0);
    expect(summary.debtAfterUsd).toBe(0);
  });
});
