import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import {
  BOX_DEFAULTS,
  BOX_PLAYER_DATA_KEYS,
  INFLATION_RANGE_MAX,
  INFLATION_RANGE_MIN,
} from '@/core/budgetTypes';
import { INVESTED_BALANCE_KEY } from '@/core/finance/boxGoalRail';
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

  it('routes to the menu when destination=menu (Investing Birds / Mountain Success)', () => {
    freshStore({
      [BOX_PLAYER_DATA_KEYS.currentYear]: 5,
      [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
    });
    const navs: Array<{ to: string }> = [];
    eventBus.on('navigate:request', (p) => navs.push({ to: p.to }));

    const summary = advanceCampaignYear({ outcome: 'win', destination: 'menu' });

    expect(navs).toEqual([{ to: 'menu' }]);
    expect(useAppStore.getState().playerData[BOX_PLAYER_DATA_KEYS.currentYear]).toBe(6);
    expect(useAppStore.getState().playerData[CAMPAIGN_KEYS.year]).toBe(6);
    expect(useAppStore.getState().playerData[CAMPAIGN_KEYS.boxReadyForYear]).toBe(0);
    expect(summary.toYear).toBe(6);
  });

  it('persists yearly economy updates: inflation, employer match policy, invested balance', () => {
    freshStore({
      [BOX_PLAYER_DATA_KEYS.currentYear]: 1,
      [BOX_PLAYER_DATA_KEYS.annualSalary]: 60_000,
      [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
      [BOX_PLAYER_DATA_KEYS.boxAllocations]: {
        indexFunds: 2_000,
        bonds: 500,
        employerMatch: 3_600,
      },
      [INVESTED_BALANCE_KEY]: 1_000,
    });

    advanceCampaignYear({ outcome: 'win' });

    const data = useAppStore.getState().playerData;
    const inflation = data[BOX_PLAYER_DATA_KEYS.currentInflationRate] as number;
    expect(typeof inflation).toBe('number');
    expect(inflation).toBeGreaterThanOrEqual(INFLATION_RANGE_MIN);
    expect(inflation).toBeLessThanOrEqual(INFLATION_RANGE_MAX);
    expect(data[BOX_PLAYER_DATA_KEYS.employerMatchRate]).toBe(
      BOX_DEFAULTS.employerMatchRate,
    );
    expect(data[BOX_PLAYER_DATA_KEYS.employerMatchCapPctSalary]).toBe(
      BOX_DEFAULTS.employerMatchCapPctSalary,
    );
    // 2_500 (subcategories) + 1_800 (match) = 4_300; prior balance 1_000.
    expect(data[INVESTED_BALANCE_KEY]).toBe(5_300);
  });
});
