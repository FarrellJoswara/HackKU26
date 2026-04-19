/**
 * Every non-start square resolves to an interactive beat from the catalog.
 * Square 0 is the Start / year-end gate (handled only in `main.ts`).
 *
 * Each payload includes a `tier` for tier-based audio (and any future UI);
 * it uses the same funding math as `getBoardLandingScenarioBody` when the
 * caller passes ratios from the live budget snapshot.
 */
import {
  ISLAND_SCENARIO_BEATS,
  ISLAND_SQUARE_BEAT_ORDER,
  resolveScenarioTierFromFundingRatio,
  scenarioSeededUnit,
  type IslandScenarioBeat,
  type BudgetCategoryId,
  type ScenarioTier,
} from '@/core/scenarios';
import { SQUARE_PRIMARY_CATEGORY } from './boardScenarioLanding';

/** Passive fallbacks — ratio maps to a valid {@link ScenarioTier} (no `average` in this type system). */
const PASSIVE_FALLBACK_TIER = resolveScenarioTierFromFundingRatio(0.088);

export type LandingPayload =
  | { kind: 'passive'; body: string; tier: ScenarioTier }
  | { kind: 'choice'; beat: IslandScenarioBeat; tier: ScenarioTier };

function resolveLandingTier(
  square: number,
  fundingRatioByCategory?: Partial<Record<BudgetCategoryId, number>>,
): ScenarioTier {
  const cat = SQUARE_PRIMARY_CATEGORY[square] ?? 'personal';
  const fallbackRatio = 0.05 + scenarioSeededUnit(`demo-ratio-${square}`) * 0.14;
  const ratio = fundingRatioByCategory?.[cat] ?? fallbackRatio;
  return resolveScenarioTierFromFundingRatio(ratio);
}

export function getLandingPayload(
  square: number,
  fundingRatioByCategory?: Partial<Record<BudgetCategoryId, number>>,
): LandingPayload {
  if (square < 1 || square > 11) {
    return {
      kind: 'passive',
      body: 'Take a breath — the tide always turns.',
      tier: PASSIVE_FALLBACK_TIER,
    };
  }
  const tier = resolveLandingTier(square, fundingRatioByCategory);
  const beatId = ISLAND_SQUARE_BEAT_ORDER[square];
  if (!beatId) {
    return {
      kind: 'passive',
      body: 'Take a breath — the tide always turns.',
      tier: PASSIVE_FALLBACK_TIER,
    };
  }
  const beat = ISLAND_SCENARIO_BEATS[beatId];
  return { kind: 'choice', beat, tier };
}
