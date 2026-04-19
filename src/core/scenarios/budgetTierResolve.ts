/**
 * @file Maps funding ratios (allocation ÷ income) to scenario tiers for
 * copy selection. Tunable band defaults for demos and tests.
 */

import type { ScenarioTier } from './types';

/** `allocation / annualSalary` (or similar) — games supply the ratio. */
export interface FundingRatioTierBands {
  excellentMin: number;
  goodMin: number;
  badMin: number;
}

/** Tunable defaults for hackathon demos; games may override per category. */
export const DEFAULT_FUNDING_TIER_BANDS: FundingRatioTierBands = {
  excellentMin: 0.14,
  goodMin: 0.09,
  badMin: 0.05,
};

export function resolveScenarioTierFromFundingRatio(
  ratio: number,
  bands: FundingRatioTierBands = DEFAULT_FUNDING_TIER_BANDS,
): ScenarioTier {
  const r = Math.max(0, Math.min(1, ratio));
  if (r >= bands.excellentMin) return 'excellent';
  if (r >= bands.goodMin) return 'good';
  if (r >= bands.badMin) return 'bad';
  return 'terrible';
}
