/**
 * @file Pure year-close pipeline.
 *
 * `advanceCampaignYear` (`yearAdvance.ts`) is the only side-effecting
 * caller — it merges the returned patch into `playerData` and emits the
 * navigation event. Keeping the math here makes every Year Loop close
 * exactly the same regardless of which year-end route fired it
 * (DebtRunner summary, Investing Birds end, Mountain Success cinematic).
 *
 * Responsibilities:
 *  - Roll the new `currentYear` / `campaign.year` (deterministic +1).
 *  - Apply debt paydown from the high-interest debt allocation, plus a
 *    2% interest penalty on a runner loss when debt remains.
 *  - Re-arm the soft Box gate (`campaign.boxReadyForYear` -> 0).
 *  - Re-roll inflation inside `[INFLATION_RANGE_MIN, INFLATION_RANGE_MAX]`
 *    (injectable RNG so tests are deterministic).
 *  - Carry forward employer-match policy (rate / cap) so The Box header
 *    always has a number to show — required even when the save predates
 *    these keys.
 *  - Grow `campaign.investedBalanceUsd` by the year's invested
 *    contributions (investment subcategory sum + projected employer
 *    match). FI detection (`hasReachedFinancialFreedom`) reads the same
 *    key, so the cinematic trigger and the Goal Rail stay aligned.
 *
 * AGENTS.md: this module is core-only. No `ui` or `games` imports.
 */

import {
  BOX_DEFAULTS,
  BOX_PLAYER_DATA_KEYS,
  INFLATION_RANGE_MAX,
  INFLATION_RANGE_MIN,
  emptyAllocations,
  projectEmployerMatch,
  readAllocations,
  readNumber,
  sumInvestmentSubcategories,
} from '@/core/budgetTypes';
import { INVESTED_BALANCE_KEY } from '@/core/finance/boxGoalRail';
import { CAMPAIGN_KEYS } from './campaignKeys';

/** 2% of remaining debt added on a runner loss. */
const LOSS_INTEREST_PENALTY = 0.02;

export type YearAdvanceOutcome = 'win' | 'loss' | 'skipped';

export interface YearAdvanceSummary {
  /** Year the player just finished. */
  fromYear: number;
  /** Year the player is now budgeting for. */
  toYear: number;
  /** Debt before any year-end adjustment. */
  debtBeforeUsd: number;
  /** Dollars pulled from the High-Interest Debt allocation toward payoff. */
  debtPaidUsd: number;
  /** Extra interest added because the runner was lost. */
  interestPenaltyUsd: number;
  /** Final running debt balance for next year. */
  debtAfterUsd: number;
  /** Inflation rate that will drive next year's costs. */
  newInflationRate: number;
  /** Investment dollars (subcategories + projected match) added to the rolling balance. */
  investedAddedUsd: number;
  /** Running invested balance after this year's contribution. */
  investedBalanceUsd: number;
}

export interface ComputeCloseYearArgs {
  playerData: Record<string, unknown>;
  outcome: YearAdvanceOutcome;
  /**
   * Injectable randomness in [0, 1). Used only for the inflation roll.
   * Default: `Math.random`. Tests pass a stub for determinism.
   */
  random?: () => number;
}

export interface ComputeCloseYearResult {
  /** Patch to merge into `playerData`. */
  patch: Record<string, unknown>;
  summary: YearAdvanceSummary;
}

/**
 * Re-roll inflation inside the configured band.
 * Pure: `random()` is the only entropy source.
 */
export function rollInflationRate(random: () => number): number {
  const r = clamp01(random());
  const raw = INFLATION_RANGE_MIN + r * (INFLATION_RANGE_MAX - INFLATION_RANGE_MIN);
  // Round to 4 decimals so persisted values stay compact (e.g. 0.0327).
  return Math.round(raw * 10000) / 10000;
}

/**
 * Project the dollars that should land in the rolling invested-balance
 * proxy at year close. Sums every investment subcategory the player
 * funded this year, plus the bonus match the employer kicks in.
 *
 * Match rate / cap and salary read straight from `playerData` so the
 * helper is a pure projection of the *current snapshot* — no lookups
 * into BOX_DEFAULTS for missing keys (the close-year computation
 * carries those defaults forward separately).
 */
export function projectYearInvestedContribution(
  playerData: Record<string, unknown>,
): number {
  const allocations = readAllocations(playerData) ?? emptyAllocations();
  const annualSalary = readNumber(playerData, BOX_PLAYER_DATA_KEYS.annualSalary, 0);
  const matchRate = readNumber(
    playerData,
    BOX_PLAYER_DATA_KEYS.employerMatchRate,
    BOX_DEFAULTS.employerMatchRate,
  );
  const capPctSalary = readNumber(
    playerData,
    BOX_PLAYER_DATA_KEYS.employerMatchCapPctSalary,
    BOX_DEFAULTS.employerMatchCapPctSalary,
  );
  const subcategorySum = sumInvestmentSubcategories(allocations);
  const matchProjected = projectEmployerMatch({
    allocations,
    annualSalary,
    matchRate,
    capPctSalary,
  });
  const total = subcategorySum + matchProjected;
  return Number.isFinite(total) && total > 0 ? total : 0;
}

export function computeCloseYear({
  playerData,
  outcome,
  random = Math.random,
}: ComputeCloseYearArgs): ComputeCloseYearResult {
  const fromYear = readNumber(
    playerData,
    BOX_PLAYER_DATA_KEYS.currentYear,
    BOX_DEFAULTS.currentYear,
  );
  const toYear = fromYear + 1;

  const debtBefore = readNumber(
    playerData,
    BOX_PLAYER_DATA_KEYS.highInterestDebtBalance,
    BOX_DEFAULTS.highInterestDebtBalance,
  );
  const allocations = readAllocations(playerData) ?? emptyAllocations();
  const debtAlloc = Math.max(0, allocations.highInterestDebt ?? 0);
  const debtPaid = Math.min(debtAlloc, debtBefore);
  let nextDebt = Math.max(0, debtBefore - debtPaid);
  let interestPenalty = 0;
  if (outcome === 'loss' && nextDebt > 0) {
    interestPenalty = nextDebt * LOSS_INTEREST_PENALTY;
    nextDebt += interestPenalty;
  }

  const newInflation = rollInflationRate(random);
  const matchRate = readNumber(
    playerData,
    BOX_PLAYER_DATA_KEYS.employerMatchRate,
    BOX_DEFAULTS.employerMatchRate,
  );
  const matchCapPct = readNumber(
    playerData,
    BOX_PLAYER_DATA_KEYS.employerMatchCapPctSalary,
    BOX_DEFAULTS.employerMatchCapPctSalary,
  );

  const investedAdded = projectYearInvestedContribution(playerData);
  const prevInvested = readNumber(playerData, INVESTED_BALANCE_KEY, 0);
  const investedBalance = round2(prevInvested + investedAdded);

  const patch: Record<string, unknown> = {
    [BOX_PLAYER_DATA_KEYS.currentYear]: toYear,
    [CAMPAIGN_KEYS.year]: toYear,
    [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: round2(nextDebt),
    [BOX_PLAYER_DATA_KEYS.currentInflationRate]: newInflation,
    [BOX_PLAYER_DATA_KEYS.employerMatchRate]: matchRate,
    [BOX_PLAYER_DATA_KEYS.employerMatchCapPctSalary]: matchCapPct,
    [INVESTED_BALANCE_KEY]: investedBalance,
    // Re-arm the soft Box gate so the player must submit a fresh
    // zero-based budget before the map will let them roll again.
    [CAMPAIGN_KEYS.boxReadyForYear]: 0,
  };

  return {
    patch,
    summary: {
      fromYear,
      toYear,
      debtBeforeUsd: round2(debtBefore),
      debtPaidUsd: round2(debtPaid),
      interestPenaltyUsd: round2(interestPenalty),
      debtAfterUsd: round2(nextDebt),
      newInflationRate: newInflation,
      investedAddedUsd: round2(investedAdded),
      investedBalanceUsd: investedBalance,
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n >= 1) return 0.999999;
  return n;
}
