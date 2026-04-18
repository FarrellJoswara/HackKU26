/**
 * Budget-linked narrative beats for mini-games (Island Run, future modules).
 * Tiers are ordered best → worst for typical “funding / choices” framing.
 */

export const SCENARIO_TIERS = ['excellent', 'good', 'bad', 'terrible'] as const;
export type ScenarioTier = (typeof SCENARIO_TIERS)[number];
