import { describe, expect, it } from 'vitest';
import {
  evaluateBand,
  evaluateAllBands,
  getBudgetBand,
  isUnderfunded,
} from '@/core/finance/budgetGuides';
import { emptyAllocations } from '@/core/budgetTypes';

describe('budgetGuides', () => {
  it('returns null bands for investment subcategories + legacy aggregate', () => {
    expect(getBudgetBand('indexFunds', 'normal')).toBeNull();
    expect(getBudgetBand('investments', 'normal')).toBeNull();
  });

  it('classifies under-band, within, and over-band correctly', () => {
    const band = getBudgetBand('food', 'normal');
    expect(band).not.toBeNull();
    if (!band) return;

    const cash = 50_000;
    const minDollars = band.min * cash;
    const maxDollars = band.max * cash;

    expect(evaluateBand('food', minDollars - 1, { cashToAllocate: cash }, 'normal')).toBe('below');
    expect(evaluateBand('food', minDollars + 1, { cashToAllocate: cash }, 'normal')).toBe('within');
    expect(evaluateBand('food', maxDollars + 1, { cashToAllocate: cash }, 'normal')).toBe('above');
  });

  it('returns "na" for locked or zero-cash contexts', () => {
    expect(
      evaluateBand('food', 100, { cashToAllocate: 0 }, 'normal'),
    ).toBe('na');
    expect(
      evaluateBand('food', 100, { cashToAllocate: 1_000, isLocked: true }, 'normal'),
    ).toBe('na');
  });

  it('isUnderfunded matches "below" status', () => {
    const band = getBudgetBand('emergencyFund', 'hard');
    if (!band) throw new Error('expected band');
    const cash = 40_000;
    const tooLittle = band.min * cash - 1;
    expect(isUnderfunded('emergencyFund', tooLittle, { cashToAllocate: cash }, 'hard')).toBe(true);
    expect(isUnderfunded('emergencyFund', band.min * cash + 1, { cashToAllocate: cash }, 'hard')).toBe(false);
  });

  it('evaluateAllBands returns a status per guided category', () => {
    const out = evaluateAllBands(emptyAllocations(), { cashToAllocate: 50_000 }, 'easy');
    expect(out.rent).toBe('below');
    expect(out.food).toBe('below');
    expect(out.miscFun).toBe('below');
    // Investment subcategory ids are not present in the result map.
    expect((out as Record<string, unknown>).indexFunds).toBeUndefined();
  });
});
