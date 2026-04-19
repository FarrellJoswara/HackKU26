import { describe, expect, it } from 'vitest';

import { BOX_PLAYER_DATA_KEYS } from '@/core/budgetTypes';
import {
  DEFAULT_WIN_GOAL_USD,
  INVESTED_BALANCE_KEY,
  WIN_GOAL_KEY,
} from '@/core/finance/boxGoalRail';
import { hasReachedFinancialFreedom } from './financialFreedom';

describe('hasReachedFinancialFreedom', () => {
  it('returns false while high-interest debt remains', () => {
    expect(
      hasReachedFinancialFreedom({
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 100,
        [INVESTED_BALANCE_KEY]: DEFAULT_WIN_GOAL_USD * 10,
      }),
    ).toBe(false);
  });

  it('returns false when debt is zero but invested balance is below the goal', () => {
    expect(
      hasReachedFinancialFreedom({
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
        [INVESTED_BALANCE_KEY]: DEFAULT_WIN_GOAL_USD - 1,
      }),
    ).toBe(false);
  });

  it('returns true when debt is zero and invested balance exactly meets the goal', () => {
    expect(
      hasReachedFinancialFreedom({
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
        [INVESTED_BALANCE_KEY]: DEFAULT_WIN_GOAL_USD,
      }),
    ).toBe(true);
  });

  it('returns true when invested balance overshoots the goal', () => {
    expect(
      hasReachedFinancialFreedom({
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
        [INVESTED_BALANCE_KEY]: DEFAULT_WIN_GOAL_USD * 2,
      }),
    ).toBe(true);
  });

  it('honors a custom win goal override on playerData', () => {
    expect(
      hasReachedFinancialFreedom({
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
        [WIN_GOAL_KEY]: 10_000,
        [INVESTED_BALANCE_KEY]: 9_999,
      }),
    ).toBe(false);
    expect(
      hasReachedFinancialFreedom({
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
        [WIN_GOAL_KEY]: 10_000,
        [INVESTED_BALANCE_KEY]: 10_000,
      }),
    ).toBe(true);
  });

  it('returns false when keys are missing (defaults to invested 0)', () => {
    expect(hasReachedFinancialFreedom({})).toBe(false);
  });

  it('returns false when the win goal is zero or negative', () => {
    expect(
      hasReachedFinancialFreedom({
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
        [WIN_GOAL_KEY]: 0,
        [INVESTED_BALANCE_KEY]: 1_000_000,
      }),
    ).toBe(false);
    expect(
      hasReachedFinancialFreedom({
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
        [WIN_GOAL_KEY]: -500,
        [INVESTED_BALANCE_KEY]: 1_000_000,
      }),
    ).toBe(false);
  });

  it('treats sub-cent debt as paid off', () => {
    expect(
      hasReachedFinancialFreedom({
        [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0.005,
        [INVESTED_BALANCE_KEY]: DEFAULT_WIN_GOAL_USD,
      }),
    ).toBe(true);
  });
});
