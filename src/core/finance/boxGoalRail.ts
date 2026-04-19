/**
 * @file Phased goal-rail math for The Box.
 *
 * Per the locked Box-UI spec ("Goals, targets, incentives"):
 *  - **Debt phase** (high-interest debt > 0): foreground "path to $0 debt".
 *    Use `highInterestDebtBalance` + this year's `highInterestDebt` row to
 *    project a *simple informational* runway in years. We do NOT model
 *    interest growth here — that belongs to the future Year Controller.
 *    Until then we surface a plain ratio with copy that reads as a rough
 *    horizon, not a promise.
 *  - **Investing / freedom phase** (debt-free): foreground progress toward
 *    `[VAR_WIN_GOAL]`. The win goal lives on `playerData` as a tunable
 *    constant; until real FI math ships we display a simple progress bar.
 *
 * Pure module. No React, no UI imports.
 */

/** Tunable: default win goal (placeholder for `[VAR_WIN_GOAL]`). */
export const DEFAULT_WIN_GOAL_USD = 250_000;

/** `playerData` key for an override of the win goal. Optional. */
export const WIN_GOAL_KEY = 'campaign.winGoalUsd';

/** `playerData` key for the running invested-balance proxy. Optional. */
export const INVESTED_BALANCE_KEY = 'campaign.investedBalanceUsd';

export type GoalPhase = 'debt' | 'freedom';

export interface DebtRunway {
  phase: 'debt';
  debtBalance: number;
  yearlyPayment: number;
  /**
   * Years remaining at *current* annual payment, ignoring interest.
   * `null` when payment is $0 (cannot project) or balance is $0.
   * Capped at 99 to avoid silly numbers in UI.
   */
  yearsRemaining: number | null;
  /** Same as above but rounded up to the next whole year for headline copy. */
  yearsRoundedUp: number | null;
  /** Convenience: ratio 0..1 of this year's payment vs total balance. */
  paymentRatio: number;
}

export interface FreedomProgress {
  phase: 'freedom';
  invested: number;
  goal: number;
  /** 0..1 progress, clamped. */
  progress: number;
  remaining: number;
}

export type GoalState = DebtRunway | FreedomProgress;

const EPS = 0.01;

export interface GoalInputs {
  highInterestDebtBalance: number;
  /** Allocation dollars planned for the high-interest debt row this year. */
  highInterestDebtAllocation: number;
  /** Optional override for win goal (reads `WIN_GOAL_KEY` at the call site). */
  winGoalUsd?: number;
  /** Running invested balance (proxy until Year Controller lands). */
  investedBalanceUsd?: number;
}

export function computeGoalState(inputs: GoalInputs): GoalState {
  const balance = safeNonNegative(inputs.highInterestDebtBalance);
  if (balance > EPS) {
    const payment = safeNonNegative(inputs.highInterestDebtAllocation);
    const yearsRaw = payment > EPS ? balance / payment : null;
    const yearsClamped =
      yearsRaw == null
        ? null
        : Math.min(99, Math.max(0, yearsRaw));
    const yearsRounded =
      yearsClamped == null ? null : Math.max(1, Math.ceil(yearsClamped));
    const ratio =
      balance > 0 ? Math.min(1, payment / balance) : 0;
    return {
      phase: 'debt',
      debtBalance: balance,
      yearlyPayment: payment,
      yearsRemaining: yearsClamped,
      yearsRoundedUp: yearsRounded,
      paymentRatio: ratio,
    };
  }
  const goal = safeNonNegative(inputs.winGoalUsd ?? DEFAULT_WIN_GOAL_USD);
  const invested = safeNonNegative(inputs.investedBalanceUsd ?? 0);
  const safeGoal = goal > 0 ? goal : 1;
  const progress = Math.max(0, Math.min(1, invested / safeGoal));
  return {
    phase: 'freedom',
    invested,
    goal,
    progress,
    remaining: Math.max(0, goal - invested),
  };
}

function safeNonNegative(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n;
}
