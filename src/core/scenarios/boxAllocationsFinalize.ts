/**
 * Single sanitizer for `boxAllocations` after any external mutation
 * (Island Run choices, future logic, etc). Mirrors the rules baked into
 * `TheBoxScreen` / `TheBoxOverlay` so out-of-band updates cannot leave
 * an illegal state in `playerData`.
 *
 * Rules:
 *   1. clamp all categories to >= 0
 *   2. zero `investments` while high-interest debt remains (>= EPS)
 *   3. when `annualSalary` is supplied, absorb tiny float drift on `miscFun`
 *      so the zero-based total still equals salary
 */
import type { BudgetCategoryId } from '../budgetTypes';

export interface FinalizeBoxAllocationsArgs {
  allocations: Record<BudgetCategoryId, number>;
  annualSalary?: number;
  debtBalance?: number;
}

const EPS = 0.01;

function sumAllocations(a: Record<BudgetCategoryId, number>): number {
  return (Object.keys(a) as BudgetCategoryId[]).reduce((s, k) => s + (a[k] ?? 0), 0);
}

export function finalizeBoxAllocations({
  allocations,
  annualSalary,
  debtBalance,
}: FinalizeBoxAllocationsArgs): Record<BudgetCategoryId, number> {
  const next = { ...allocations };

  for (const k of Object.keys(next) as BudgetCategoryId[]) {
    const v = next[k];
    if (!Number.isFinite(v) || v < 0) next[k] = 0;
  }

  if (typeof debtBalance === 'number' && debtBalance > EPS) {
    next.investments = 0;
  }

  if (typeof annualSalary === 'number' && Number.isFinite(annualSalary) && annualSalary > 0) {
    const drift = annualSalary - sumAllocations(next);
    if (Math.abs(drift) > EPS) {
      next.miscFun = Math.max(0, (next.miscFun ?? 0) + drift);
    }
  }

  return next;
}
