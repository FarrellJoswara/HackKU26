import { describe, expect, it } from 'vitest';
import {
  allocationsToBudgetProfile,
  PROFILE_THRESHOLDS,
} from './allocationsToBudgetProfile';

describe('allocationsToBudgetProfile', () => {
  const SALARY = 50_000;

  it('returns "bad" for every key when allocations are empty', () => {
    const profile = allocationsToBudgetProfile({
      allocations: {},
      annualSalary: SALARY,
    });
    Object.values(profile).forEach((rating) => expect(rating).toBe('bad'));
  });

  it('classifies rent as good at the threshold', () => {
    const dollars = SALARY * PROFILE_THRESHOLDS.rent.goodAt;
    const profile = allocationsToBudgetProfile({
      allocations: { rent: dollars },
      annualSalary: SALARY,
    });
    expect(profile.rent).toBe('good');
  });

  it('classifies rent as average just below the good threshold', () => {
    const dollars = SALARY * PROFILE_THRESHOLDS.rent.averageAt;
    const profile = allocationsToBudgetProfile({
      allocations: { rent: dollars },
      annualSalary: SALARY,
    });
    expect(profile.rent).toBe('average');
  });

  it('routes Box highInterestDebt → debtRepayment', () => {
    const dollars = SALARY * PROFILE_THRESHOLDS.debtRepayment.goodAt;
    const profile = allocationsToBudgetProfile({
      allocations: { highInterestDebt: dollars },
      annualSalary: SALARY,
    });
    expect(profile.debtRepayment).toBe('good');
  });

  it('treats salary <= 0 as no income (everything bad)', () => {
    const profile = allocationsToBudgetProfile({
      allocations: { rent: 999_999 },
      annualSalary: 0,
    });
    expect(profile.rent).toBe('bad');
  });

  it('produces a fully populated profile for every key', () => {
    const profile = allocationsToBudgetProfile({
      allocations: {
        rent: SALARY * PROFILE_THRESHOLDS.rent.goodAt,
        food: SALARY * PROFILE_THRESHOLDS.food.averageAt,
        transportation: SALARY * PROFILE_THRESHOLDS.transportation.goodAt,
        emergencyFund: SALARY * PROFILE_THRESHOLDS.emergencyFund.averageAt,
        medical: SALARY * PROFILE_THRESHOLDS.medical.averageAt,
        highInterestDebt: SALARY * PROFILE_THRESHOLDS.debtRepayment.goodAt,
        miscFun: SALARY * PROFILE_THRESHOLDS.miscFun.goodAt,
      },
      annualSalary: SALARY,
    });
    expect(profile).toEqual({
      rent: 'good',
      food: 'average',
      transportation: 'good',
      emergencyFund: 'average',
      medical: 'average',
      debtRepayment: 'good',
      miscFun: 'good',
    });
  });
});
