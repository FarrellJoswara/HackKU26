import { describe, expect, it } from 'vitest';
import {
  computeGoalState,
  DEFAULT_WIN_GOAL_USD,
} from '@/core/finance/boxGoalRail';

describe('computeGoalState', () => {
  it('returns debt phase with null years when payment is zero', () => {
    const state = computeGoalState({
      highInterestDebtBalance: 12_000,
      highInterestDebtAllocation: 0,
    });
    expect(state.phase).toBe('debt');
    if (state.phase !== 'debt') return;
    expect(state.yearsRemaining).toBeNull();
    expect(state.yearsRoundedUp).toBeNull();
    expect(state.paymentRatio).toBe(0);
  });

  it('projects debt-runway as balance / payment, rounded up', () => {
    const state = computeGoalState({
      highInterestDebtBalance: 12_000,
      highInterestDebtAllocation: 4_000,
    });
    if (state.phase !== 'debt') throw new Error('expected debt');
    expect(state.yearsRemaining).toBeCloseTo(3);
    expect(state.yearsRoundedUp).toBe(3);
    expect(state.paymentRatio).toBeCloseTo(4_000 / 12_000);
  });

  it('caps the runway at 99 years for absurd payments', () => {
    const state = computeGoalState({
      highInterestDebtBalance: 1_000_000,
      highInterestDebtAllocation: 1,
    });
    if (state.phase !== 'debt') throw new Error('expected debt');
    expect(state.yearsRemaining).toBe(99);
  });

  it('moves to freedom phase once debt is gone', () => {
    const state = computeGoalState({
      highInterestDebtBalance: 0,
      highInterestDebtAllocation: 0,
      investedBalanceUsd: 50_000,
    });
    expect(state.phase).toBe('freedom');
    if (state.phase !== 'freedom') return;
    expect(state.goal).toBe(DEFAULT_WIN_GOAL_USD);
    expect(state.invested).toBe(50_000);
    expect(state.progress).toBeCloseTo(50_000 / DEFAULT_WIN_GOAL_USD);
    expect(state.remaining).toBe(DEFAULT_WIN_GOAL_USD - 50_000);
  });

  it('clamps progress to 0..1 when invested exceeds goal', () => {
    const state = computeGoalState({
      highInterestDebtBalance: 0,
      highInterestDebtAllocation: 0,
      winGoalUsd: 10_000,
      investedBalanceUsd: 50_000,
    });
    if (state.phase !== 'freedom') throw new Error('expected freedom');
    expect(state.progress).toBe(1);
    expect(state.remaining).toBe(0);
  });

  it('treats negative / NaN inputs as 0 (defensive)', () => {
    const state = computeGoalState({
      highInterestDebtBalance: -5,
      highInterestDebtAllocation: Number.NaN,
      investedBalanceUsd: -100,
    });
    expect(state.phase).toBe('freedom');
    if (state.phase !== 'freedom') return;
    expect(state.invested).toBe(0);
  });
});
