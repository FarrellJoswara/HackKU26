/**
 * Island board landing copy from shared `@hackku/scenarios` catalog.
 * When host passes funding ratios (future: localStorage / postMessage), tier reflects real allocations.
 */
import {
  pickScenarioLine,
  resolveScenarioTierFromFundingRatio,
  scenarioSeededUnit,
  type BudgetCategoryId,
} from '@hackku/scenarios';

/** One primary category per square — loosely aligned with `SQUARE_LABELS` order. */
export const SQUARE_PRIMARY_CATEGORY: readonly BudgetCategoryId[] = [
  'emergencyFund',
  'food',
  'highInterestDebt',
  'transportation',
  'rent',
  'miscFun',
  'miscFun',
  'investments',
  'investments',
  'investments',
  'medical',
  'personal',
] as const;

export function getBoardLandingScenarioBody(
  square: number,
  fundingRatioByCategory?: Partial<Record<BudgetCategoryId, number>>,
): string {
  const cat = SQUARE_PRIMARY_CATEGORY[square] ?? 'personal';
  const fallbackRatio = 0.05 + scenarioSeededUnit(`demo-ratio-${square}`) * 0.14;
  const ratio = fundingRatioByCategory?.[cat] ?? fallbackRatio;
  const tier = resolveScenarioTierFromFundingRatio(ratio);
  const rng = () => scenarioSeededUnit(`pick-${square}-${cat}-${tier}`);
  return pickScenarioLine(cat, tier, rng);
}
