import { describe, expect, it } from 'vitest';
import { finalizeBoxAllocations } from '@/core/scenarios/boxAllocationsFinalize';
import { emptyAllocations } from '@/core/budgetTypes';

const baseAllocations = () => ({
  ...emptyAllocations(),
  rent: 1_000,
  food: 500,
  miscFun: 0,
});

describe('finalizeBoxAllocations', () => {
  it('clamps negative + non-finite values to 0', () => {
    const out = finalizeBoxAllocations({
      allocations: {
        ...emptyAllocations(),
        rent: -100,
        food: Number.NaN,
        miscFun: Number.POSITIVE_INFINITY,
      },
    });
    expect(out.rent).toBe(0);
    expect(out.food).toBe(0);
    expect(out.miscFun).toBe(0);
  });

  it('zeros investments + subcategories while debt remains', () => {
    const out = finalizeBoxAllocations({
      allocations: {
        ...emptyAllocations(),
        indexFunds: 200,
        individualStocks: 300,
        bonds: 100,
        cds: 50,
        crypto: 25,
        investments: 9999,
      },
      debtBalance: 5_000,
    });
    expect(out.investments).toBe(0);
    expect(out.indexFunds).toBe(0);
    expect(out.individualStocks).toBe(0);
    expect(out.bonds).toBe(0);
    expect(out.cds).toBe(0);
    expect(out.crypto).toBe(0);
  });

  it('recomputes legacy investments aggregate from subcategories when debt-free', () => {
    const out = finalizeBoxAllocations({
      allocations: {
        ...emptyAllocations(),
        indexFunds: 200,
        individualStocks: 100,
        bonds: 50,
        cds: 25,
        crypto: 25,
        investments: 0,
      },
      debtBalance: 0,
    });
    expect(out.investments).toBe(400);
  });

  it('absorbs zero-based drift onto miscFun when salary is provided', () => {
    const out = finalizeBoxAllocations({
      allocations: {
        ...baseAllocations(),
        miscFun: 0,
      },
      annualSalary: 2_000,
    });
    // rent 1000 + food 500 = 1500, drift = 500
    expect(out.miscFun).toBe(500);
  });

  it('respects pendingCashToAllocate as additional drift target', () => {
    const out = finalizeBoxAllocations({
      allocations: baseAllocations(),
      annualSalary: 2_000,
      pendingCashToAllocate: 250,
    });
    // target = 2_250, sum = 1_500 → miscFun absorbs 750
    expect(out.miscFun).toBe(750);
  });

  it('does not subtract below 0 when drift is negative and miscFun is small', () => {
    const out = finalizeBoxAllocations({
      allocations: {
        ...emptyAllocations(),
        rent: 5_000,
        miscFun: 10,
      },
      annualSalary: 1_000,
    });
    // Sum (5_010) > target (1_000) → drift is large negative; miscFun
    // clamps at 0 instead of going negative.
    expect(out.miscFun).toBe(0);
  });
});
