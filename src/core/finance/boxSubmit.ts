/**
 * Pure Box submit normalization.
 *
 * Both `TheBoxScreen` (full-page) and `TheBoxOverlay` (in-game panel)
 * need to:
 *   1. recompute the legacy `investments` aggregate from the five
 *      investment subcategories (so older consumers stay correct),
 *   2. force every investment row to $0 while high-interest debt remains,
 *   3. compose the `BoxBudgetSubmitPayload` for the typed Event Bus,
 *   4. produce the `playerData` patch (allocations + pendingCash reset
 *      + a UI timestamp).
 *
 * Putting the math here means the two screens cannot diverge — and
 * future surfaces (a future modal, a unit test, a CLI tool) get the
 * same behavior for free.
 *
 * AGENTS.md: this module is core-only. No `ui` or `games` imports.
 */

import {
  BOX_PLAYER_DATA_KEYS,
  sumInvestmentSubcategories,
  type BoxBudgetSubmitPayload,
  type BudgetCategoryId,
} from '@/core/budgetTypes';

const EPS = 0.01;

export interface ComposeBoxSubmitArgs {
  allocations: Record<BudgetCategoryId, number>;
  annualSalary: number;
  debtBalance: number;
  inflationRate: number;
  employerMatchProjected: number;
  currentYear: number;
  pendingCash: number;
}

export interface ComposeBoxSubmitResult {
  payload: BoxBudgetSubmitPayload;
  /** Patch the caller should `mergePlayerData` with after emitting. */
  playerDataPatch: Record<string, unknown>;
}

/**
 * Normalize allocations and produce both the event payload and the
 * `playerData` patch. Pure — no store / event bus access.
 */
export function composeBoxSubmit(
  args: ComposeBoxSubmitArgs,
): ComposeBoxSubmitResult {
  const debtFree = args.debtBalance <= EPS;
  const investmentsAggregate = sumInvestmentSubcategories(args.allocations);
  const finalAllocations: Record<BudgetCategoryId, number> = {
    ...args.allocations,
    investments: debtFree ? investmentsAggregate : 0,
  };
  if (!debtFree) {
    finalAllocations.indexFunds = 0;
    finalAllocations.individualStocks = 0;
    finalAllocations.bonds = 0;
    finalAllocations.cds = 0;
    finalAllocations.crypto = 0;
  }
  const payload: BoxBudgetSubmitPayload = {
    allocations: finalAllocations,
    annualSalary: args.annualSalary,
    highInterestDebtBalanceAtSubmit: args.debtBalance,
    inflationRate: args.inflationRate,
    employerMatchProjected: args.employerMatchProjected,
    year: args.currentYear,
    pendingCashConsumed: args.pendingCash,
  };
  const playerDataPatch: Record<string, unknown> = {
    [BOX_PLAYER_DATA_KEYS.boxAllocations]: payload.allocations,
    [BOX_PLAYER_DATA_KEYS.pendingCashToAllocate]: 0,
    boxBudgetSubmittedAt: Date.now(),
  };
  return { payload, playerDataPatch };
}
