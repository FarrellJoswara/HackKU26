/**
 * @file Maps Box dollar allocations → DebtRunner `BudgetProfile` (bad/avg/good
 * ratings). The DebtRunner contract was authored before The Box existed,
 * so this is the single bridge between the two budget shapes — keep all
 * thresholds in one place to avoid drift.
 *
 * Thresholds expressed as **share of cash** (`alloc / annualSalary`),
 * not absolute dollars, so the mapping survives different starting
 * incomes / difficulty levels. They are intentionally generous on the
 * lower bands so an "average" allocation is the common outcome.
 *
 * Architecture:
 *  - Pure: no React, no store, no `import.meta.env` access.
 *  - Tested in `allocationsToBudgetProfile.test.ts`.
 */

import type { BudgetCategoryId as BoxCategoryId } from '@/core/budgetTypes';
import type { BudgetProfile, BudgetRating, BudgetCategoryId as ProfileCategoryId } from './budgetTypes';

export interface ProfileMappingThresholds {
  /** alloc / cash >= goodAt → 'good' */
  goodAt: number;
  /** alloc / cash >= averageAt → 'average', else 'bad'. */
  averageAt: number;
}

/**
 * Source-of-truth thresholds, keyed by the runner's `BudgetCategoryId`.
 * Tweak in this single object — the unit tests pin every key.
 */
export const PROFILE_THRESHOLDS: Record<ProfileCategoryId, ProfileMappingThresholds> = {
  rent: { goodAt: 0.28, averageAt: 0.16 },
  food: { goodAt: 0.12, averageAt: 0.07 },
  transportation: { goodAt: 0.1, averageAt: 0.05 },
  emergencyFund: { goodAt: 0.06, averageAt: 0.02 },
  medical: { goodAt: 0.05, averageAt: 0.02 },
  // `debtRepayment` runner key ← Box `highInterestDebt`. Slightly higher
  // bands so paying off real debt actually reads as a "good" run.
  debtRepayment: { goodAt: 0.1, averageAt: 0.04 },
  miscFun: { goodAt: 0.04, averageAt: 0.015 },
};

/** Box → runner category ID map (1:1 except for debt). */
const BOX_TO_PROFILE: Record<ProfileCategoryId, BoxCategoryId> = {
  rent: 'rent',
  food: 'food',
  transportation: 'transportation',
  emergencyFund: 'emergencyFund',
  medical: 'medical',
  debtRepayment: 'highInterestDebt',
  miscFun: 'miscFun',
};

function classify(share: number, thresholds: ProfileMappingThresholds): BudgetRating {
  if (!Number.isFinite(share) || share <= 0) return 'bad';
  if (share >= thresholds.goodAt) return 'good';
  if (share >= thresholds.averageAt) return 'average';
  return 'bad';
}

export interface AllocationsToProfileInput {
  allocations: Partial<Record<BoxCategoryId, number>>;
  annualSalary: number;
}

export function allocationsToBudgetProfile(input: AllocationsToProfileInput): BudgetProfile {
  const { allocations, annualSalary } = input;
  const cash = Number.isFinite(annualSalary) && annualSalary > 0 ? annualSalary : 0;

  const profile = {} as BudgetProfile;
  (Object.keys(PROFILE_THRESHOLDS) as ProfileCategoryId[]).forEach((profileId) => {
    const boxId = BOX_TO_PROFILE[profileId];
    const dollars = Math.max(0, allocations[boxId] ?? 0);
    const share = cash > 0 ? dollars / cash : 0;
    profile[profileId] = classify(share, PROFILE_THRESHOLDS[profileId]);
  });

  return profile;
}
