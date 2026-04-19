/**
 * Single sanitizer for `boxAllocations` after any external mutation
 * (Island Run choices, future logic, etc). Mirrors the rules baked into
 * `TheBoxScreen` / `TheBoxOverlay` so out-of-band updates cannot leave
 * an illegal state in `playerData`.
 *
 * Rules:
 *   1. clamp all categories to >= 0
 *   2. while high-interest debt remains (>= EPS), zero the legacy
 *      `investments` aggregate AND every investment subcategory
 *   3. keep `investments` consistent with the sum of investment
 *      subcategories (legacy aggregate is derived, not authored)
 *   4. when `annualSalary` is supplied, absorb tiny float drift on `miscFun`
 *      so the zero-based total still equals salary
 *      (zero-based total **excludes** the legacy `investments` aggregate
 *      to avoid double-counting the subcategories).
 */
import {
  INVESTMENT_SUBCATEGORIES,
  sumInvestmentSubcategories,
  sumZeroBasedAllocations,
  type BudgetCategoryId,
} from '../budgetTypes';

export interface FinalizeBoxAllocationsArgs {
  allocations: Record<BudgetCategoryId, number>;
  annualSalary?: number;
  debtBalance?: number;
  /**
   * Cash pending re-allocation (e.g. liquidation leftover). When provided,
   * the zero-based drift target becomes `salary + pendingCashToAllocate`.
   * Default: 0.
   */
  pendingCashToAllocate?: number;
}

const EPS = 0.01;

export function finalizeBoxAllocations({
  allocations,
  annualSalary,
  debtBalance,
  pendingCashToAllocate,
}: FinalizeBoxAllocationsArgs): Record<BudgetCategoryId, number> {
  const next = { ...allocations };

  for (const k of Object.keys(next) as BudgetCategoryId[]) {
    const v = next[k];
    if (!Number.isFinite(v) || v < 0) next[k] = 0;
  }

  if (typeof debtBalance === 'number' && debtBalance > EPS) {
    next.investments = 0;
    for (const id of INVESTMENT_SUBCATEGORIES) next[id] = 0;
  } else {
    next.investments = sumInvestmentSubcategories(next);
  }

  if (typeof annualSalary === 'number' && Number.isFinite(annualSalary) && annualSalary > 0) {
    const pending =
      typeof pendingCashToAllocate === 'number' && Number.isFinite(pendingCashToAllocate)
        ? Math.max(0, pendingCashToAllocate)
        : 0;
    const target = annualSalary + pending;
    const drift = target - sumZeroBasedAllocations(next);
    if (Math.abs(drift) > EPS) {
      next.miscFun = Math.max(0, (next.miscFun ?? 0) + drift);
    }
  }

  return next;
}
