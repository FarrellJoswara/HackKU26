import { describe, expect, it } from 'vitest';

import {
  BOX_DEFAULTS,
  BOX_PLAYER_DATA_KEYS,
  INFLATION_RANGE_MAX,
  INFLATION_RANGE_MIN,
} from '@/core/budgetTypes';
import { INVESTED_BALANCE_KEY } from '@/core/finance/boxGoalRail';
import {
  computeCloseYear,
  projectYearInvestedContribution,
  rollInflationRate,
} from './closeYear';
import { CAMPAIGN_KEYS } from './campaignKeys';

describe('rollInflationRate', () => {
  it('returns the band minimum when random returns 0', () => {
    expect(rollInflationRate(() => 0)).toBeCloseTo(INFLATION_RANGE_MIN, 5);
  });

  it('returns near the band maximum when random approaches 1', () => {
    const v = rollInflationRate(() => 0.999);
    expect(v).toBeGreaterThan(INFLATION_RANGE_MIN);
    expect(v).toBeLessThanOrEqual(INFLATION_RANGE_MAX);
  });

  it('clamps non-finite RNG output to 0', () => {
    expect(rollInflationRate(() => Number.NaN)).toBeCloseTo(
      INFLATION_RANGE_MIN,
      5,
    );
  });
});

describe('projectYearInvestedContribution', () => {
  it('sums investment subcategories plus projected employer match', () => {
    const result = projectYearInvestedContribution({
      [BOX_PLAYER_DATA_KEYS.annualSalary]: 60_000,
      [BOX_PLAYER_DATA_KEYS.boxAllocations]: {
        indexFunds: 1_000,
        individualStocks: 500,
        bonds: 200,
        cds: 100,
        crypto: 50,
        employerMatch: 3_600,
      },
      [BOX_PLAYER_DATA_KEYS.employerMatchRate]: 0.5,
      [BOX_PLAYER_DATA_KEYS.employerMatchCapPctSalary]: 0.06,
    });
    // subcategories = 1850, eligible match = min(3600, 60_000 * 0.06=3600) =
    // 3600 * 0.5 = 1800. total = 1850 + 1800 = 3650.
    expect(result).toBe(3_650);
  });

  it('returns 0 when no investment categories are funded and no match', () => {
    expect(projectYearInvestedContribution({})).toBe(0);
  });
});

describe('computeCloseYear', () => {
  it('rolls year, pays down debt, re-arms gate, rolls inflation, grows invested balance', () => {
    const { patch, summary } = computeCloseYear({
      playerData: {
        [BOX_PLAYER_DATA_KEYS.currentYear]: 2,
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 6_000,
        [BOX_PLAYER_DATA_KEYS.boxAllocations]: { highInterestDebt: 1_500 },
        [INVESTED_BALANCE_KEY]: 10_000,
      },
      outcome: 'win',
      random: () => 0.5,
    });

    expect(patch[BOX_PLAYER_DATA_KEYS.currentYear]).toBe(3);
    expect(patch[CAMPAIGN_KEYS.year]).toBe(3);
    expect(patch[BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]).toBe(4_500);
    expect(patch[CAMPAIGN_KEYS.boxReadyForYear]).toBe(0);
    // Random 0.5 → midpoint of band.
    expect(patch[BOX_PLAYER_DATA_KEYS.currentInflationRate]).toBe(
      Math.round(((INFLATION_RANGE_MIN + INFLATION_RANGE_MAX) / 2) * 10000) /
        10000,
    );
    // No investments allocated this year, no match contribution → balance unchanged.
    expect(patch[INVESTED_BALANCE_KEY]).toBe(10_000);

    expect(summary.fromYear).toBe(2);
    expect(summary.toYear).toBe(3);
    expect(summary.debtPaidUsd).toBe(1_500);
    expect(summary.debtAfterUsd).toBe(4_500);
    expect(summary.interestPenaltyUsd).toBe(0);
    expect(summary.investedAddedUsd).toBe(0);
    expect(summary.investedBalanceUsd).toBe(10_000);
  });

  it('applies a 2% interest penalty on a runner loss when debt remains', () => {
    const { patch, summary } = computeCloseYear({
      playerData: {
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 10_000,
        [BOX_PLAYER_DATA_KEYS.boxAllocations]: { highInterestDebt: 0 },
      },
      outcome: 'loss',
      random: () => 0,
    });
    expect(summary.debtPaidUsd).toBe(0);
    expect(summary.interestPenaltyUsd).toBe(200);
    expect(summary.debtAfterUsd).toBe(10_200);
    expect(patch[BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]).toBe(10_200);
  });

  it('caps debt pay-down at the current debt balance', () => {
    const { summary } = computeCloseYear({
      playerData: {
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 800,
        [BOX_PLAYER_DATA_KEYS.boxAllocations]: { highInterestDebt: 5_000 },
      },
      outcome: 'win',
      random: () => 0,
    });
    expect(summary.debtPaidUsd).toBe(800);
    expect(summary.debtAfterUsd).toBe(0);
  });

  it('grows invested balance by subcategory + match contributions when debt-free', () => {
    const { patch, summary } = computeCloseYear({
      playerData: {
        [BOX_PLAYER_DATA_KEYS.currentYear]: 4,
        [BOX_PLAYER_DATA_KEYS.annualSalary]: 60_000,
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
        [BOX_PLAYER_DATA_KEYS.boxAllocations]: {
          indexFunds: 2_000,
          bonds: 500,
          employerMatch: 3_600,
        },
        [BOX_PLAYER_DATA_KEYS.employerMatchRate]: 0.5,
        [BOX_PLAYER_DATA_KEYS.employerMatchCapPctSalary]: 0.06,
        [INVESTED_BALANCE_KEY]: 5_000,
      },
      outcome: 'win',
      random: () => 0,
    });
    // subcategories = 2_500, match = min(3600, 3600) * 0.5 = 1800,
    // year contribution = 4_300, balance 5_000 → 9_300.
    expect(summary.investedAddedUsd).toBe(4_300);
    expect(summary.investedBalanceUsd).toBe(9_300);
    expect(patch[INVESTED_BALANCE_KEY]).toBe(9_300);
  });

  it('carries forward employer match policy + writes inflation even when missing', () => {
    const { patch } = computeCloseYear({
      playerData: {},
      outcome: 'skipped',
      random: () => 0.25,
    });
    expect(patch[BOX_PLAYER_DATA_KEYS.employerMatchRate]).toBe(
      BOX_DEFAULTS.employerMatchRate,
    );
    expect(patch[BOX_PLAYER_DATA_KEYS.employerMatchCapPctSalary]).toBe(
      BOX_DEFAULTS.employerMatchCapPctSalary,
    );
    expect(typeof patch[BOX_PLAYER_DATA_KEYS.currentInflationRate]).toBe(
      'number',
    );
    const inflation = patch[BOX_PLAYER_DATA_KEYS.currentInflationRate] as number;
    expect(inflation).toBeGreaterThanOrEqual(INFLATION_RANGE_MIN);
    expect(inflation).toBeLessThanOrEqual(INFLATION_RANGE_MAX);
  });
});
