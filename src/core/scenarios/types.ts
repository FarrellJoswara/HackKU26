/**
 * @file Shared scenario tier union and constants for budget-linked narrative
 * beats (Island Run and future modules). Tiers are ordered best → worst for
 * typical “funding / choices” framing.
 */

export const SCENARIO_TIERS = ['excellent', 'good', 'bad', 'terrible'] as const;
export type ScenarioTier = (typeof SCENARIO_TIERS)[number];
