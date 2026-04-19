/**
 * Centralized `playerData` keys for campaign / loop state.
 *
 * Why nest under `campaign.*` and `debtRunner.*` strings?
 *  - Avoids string typos at call sites — every read/write goes through
 *    these constants.
 *  - Clear ownership: anything namespaced `campaign.*` is owned by the
 *    Year Loop / `initCampaign.ts` core subscriber.
 *
 * AGENTS.md: this module is core-only. No `ui` or `games` imports.
 */

export const CAMPAIGN_KEYS = {
  /** True once the global onboarding screen has been completed (or skipped). */
  onboardingComplete: 'onboardingComplete',
  /**
   * Latest year for which the player submitted a Box budget. Used by the
   * soft map gate so the player cannot open Island Run without a fresh
   * budget on the campaign path.
   */
  boxReadyForYear: 'campaign.boxReadyForYear',
  /** Wall-clock ms timestamp of the last `box:budget:submit`. */
  boxSubmittedAtMs: 'campaign.boxSubmittedAtMs',
  /**
   * Cumulative hops taken across all Island Run sessions for the active
   * save. The year-end fires when this becomes a positive multiple of
   * `NUM_SQUARES` (see `lapCounter.ts`).
   */
  islandTotalHops: 'campaign.islandTotalHops',
  /** 1-indexed year counter incremented each lap. */
  year: 'campaign.year',
  /** Designer's "win goal" net invested capital for FI (USD). */
  winGoalUsd: 'campaign.winGoalUsd',
  /** Net invested balance (informational; full Year Controller will own this). */
  investedBalanceUsd: 'campaign.investedBalanceUsd',
  /**
   * Bypass the soft Box gate even in production builds. Designed for QA
   * shortcuts; never surfaced from regular UI paths.
   */
  bypassBoxGate: 'campaign.bypassBoxGate',
} as const;

export const DEBT_RUNNER_KEYS = {
  /** Once true, skip the one-time controls/goal tutorial on subsequent entries. */
  tutorialSeen: 'debtRunner.tutorialSeen',
} as const;

export type DifficultyIncomeId = 'easy' | 'normal' | 'hard';

/**
 * Default starting income per difficulty (`[VAR_STARTING_INCOME]` in
 * GAME_DESIGN.md). Intentionally close to the prior `BOX_DEFAULTS`
 * baseline so existing playtest reasoning still holds.
 */
export const DIFFICULTY_INCOME_USD: Record<DifficultyIncomeId, number> = {
  easy: 60_000,
  normal: 48_000,
  hard: 36_000,
};

/** Default starting high-interest debt per difficulty (`[VAR_STARTING_DEBT]`). */
export const DIFFICULTY_DEBT_USD: Record<DifficultyIncomeId, number> = {
  easy: 6_000,
  normal: 12_000,
  hard: 18_000,
};
