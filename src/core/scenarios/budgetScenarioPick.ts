/**
 * @file Deterministic scenario line selection — seeded RNG, tier lookup, and
 * helpers for narrative beats tied to budget categories.
 */

import type { BudgetCategoryId } from '../budgetTypes';
import { BUDGET_SCENARIO_LINES } from './budgetCatalog';
import type { ScenarioTier } from './types';
import { SCENARIO_TIERS } from './types';

/** Stable pseudo-random in [0, 1) from a string seed (deterministic replays). */
export function scenarioSeededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

export function getScenarioLines(
  category: BudgetCategoryId,
  tier: ScenarioTier,
): readonly string[] {
  return BUDGET_SCENARIO_LINES[category][tier];
}

/**
 * Pick one line for UI / VO. Pass `rng` for tests; defaults to Math.random.
 */
export function pickScenarioLine(
  category: BudgetCategoryId,
  tier: ScenarioTier,
  rng: () => number = Math.random,
): string {
  const lines = getScenarioLines(category, tier);
  const i = Math.floor(rng() * lines.length);
  return lines[i] ?? lines[0]!;
}

/**
 * Full catalog read-only — for editors, debug overlays, or serialization.
 */
export function getBudgetScenarioCatalog(): Readonly<
  Record<BudgetCategoryId, Record<ScenarioTier, readonly string[]>>
> {
  return BUDGET_SCENARIO_LINES;
}

export function isScenarioTier(value: string): value is ScenarioTier {
  return (SCENARIO_TIERS as readonly string[]).includes(value);
}
