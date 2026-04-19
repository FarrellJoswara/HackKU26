/**
 * Difficulty-tuned **soft** spending benchmarks for The Box.
 *
 * Per the locked Box-UI spec (see plan
 * `box_ui_clarified_requirements_7711a010.plan.md` → "Goals, targets,
 * incentives"): these are **suggested bands**, not validators. They power
 * UI hints and gentle warnings — Confirm gating stays purely zero-based.
 *
 * Bands are expressed as a fraction of `cashToAllocate` (= salary + any
 * pending one-shot cash). A row is "below band" when its allocation is
 * **strictly less** than `min * cashToAllocate`. We deliberately do NOT
 * surface "above band" warnings — the user is allowed to overspend on a
 * row as long as zero-based holds; nudges are about under-funding the
 * categories that real-life players forget (Emergency Fund, Food, etc.).
 *
 * No imports from `@/ui` or `@/games`. Pure data + pure helpers.
 */

import type {
  BudgetCategoryId,
  InvestmentSubcategoryId,
} from '@/core/budgetTypes';
import { isInvestmentSubcategory } from '@/core/budgetTypes';

/**
 * Local difficulty union — must stay assignment-compatible with the UI's
 * `DifficultyId` in `@/ui/menu/gameFlow`. We duplicate the small string
 * union here because AGENTS.md forbids `core` from importing `ui`.
 * If you add a difficulty in one place, add it to the other.
 */
export type DifficultyId = 'easy' | 'normal' | 'hard';

/** Suggested fraction of `cashToAllocate` for a row. */
export interface BudgetBand {
  /** Below this is "thin" — surface a soft warning if allocation > 0 fails the floor. */
  min: number;
  /** Upper edge of the comfort zone, displayed as a guide rail. */
  max: number;
}

/** Subset of `BudgetCategoryId` we surface bands for. Investments + the
 *  legacy `investments` aggregate are excluded — Investments tab has its
 *  own separate copy and will get its own guidance later. */
export type GuidedCategoryId = Exclude<
  BudgetCategoryId,
  InvestmentSubcategoryId | 'investments'
>;

const GUIDED_CATEGORIES = [
  'rent',
  'food',
  'transportation',
  'medical',
  'personal',
  'miscFun',
  'emergencyFund',
  'savings',
  'highInterestDebt',
  'employerMatch',
] as const satisfies readonly GuidedCategoryId[];

export type GuidedCategoryTuple = typeof GUIDED_CATEGORIES;

/**
 * Per-difficulty bands. Numbers are deliberately conservative — they're
 * "rules of thumb" the player can break. Tweak in playtest, not in code
 * review. Source-of-truth is one table; UI never inlines these.
 */
const BANDS: Record<DifficultyId, Record<GuidedCategoryId, BudgetBand>> = {
  easy: {
    rent: { min: 0.22, max: 0.34 },
    food: { min: 0.08, max: 0.14 },
    transportation: { min: 0.05, max: 0.12 },
    medical: { min: 0.02, max: 0.06 },
    personal: { min: 0.02, max: 0.06 },
    miscFun: { min: 0.04, max: 0.1 },
    emergencyFund: { min: 0.04, max: 0.1 },
    savings: { min: 0.04, max: 0.1 },
    highInterestDebt: { min: 0.06, max: 0.18 },
    employerMatch: { min: 0.03, max: 0.08 },
  },
  normal: {
    rent: { min: 0.25, max: 0.35 },
    food: { min: 0.1, max: 0.16 },
    transportation: { min: 0.06, max: 0.14 },
    medical: { min: 0.03, max: 0.08 },
    personal: { min: 0.03, max: 0.07 },
    miscFun: { min: 0.04, max: 0.09 },
    emergencyFund: { min: 0.05, max: 0.12 },
    savings: { min: 0.05, max: 0.12 },
    highInterestDebt: { min: 0.1, max: 0.22 },
    employerMatch: { min: 0.04, max: 0.1 },
  },
  hard: {
    rent: { min: 0.28, max: 0.4 },
    food: { min: 0.12, max: 0.18 },
    transportation: { min: 0.07, max: 0.16 },
    medical: { min: 0.04, max: 0.1 },
    personal: { min: 0.03, max: 0.07 },
    miscFun: { min: 0.03, max: 0.07 },
    emergencyFund: { min: 0.06, max: 0.14 },
    savings: { min: 0.06, max: 0.14 },
    highInterestDebt: { min: 0.14, max: 0.28 },
    employerMatch: { min: 0.05, max: 0.12 },
  },
};

/** Public API — returns a row's suggested band for the active difficulty. */
export function getBudgetBand(
  category: BudgetCategoryId,
  difficulty: DifficultyId,
): BudgetBand | null {
  if (isInvestmentSubcategory(category) || category === 'investments') return null;
  const table = BANDS[difficulty];
  return table[category as GuidedCategoryId] ?? null;
}

/** Cashflow context used to evaluate a row. */
export interface BandContext {
  cashToAllocate: number;
  /** Optional: when true the row should not be flagged (locked/disabled). */
  isLocked?: boolean;
}

export type BandStatus = 'below' | 'within' | 'above' | 'na';

/** Pure status — UI decides whether to show anything. */
export function evaluateBand(
  category: BudgetCategoryId,
  amount: number,
  ctx: BandContext,
  difficulty: DifficultyId,
): BandStatus {
  if (ctx.isLocked) return 'na';
  const band = getBudgetBand(category, difficulty);
  if (!band) return 'na';
  if (!(ctx.cashToAllocate > 0)) return 'na';
  const fraction = Math.max(0, amount) / ctx.cashToAllocate;
  if (fraction < band.min) return 'below';
  if (fraction > band.max) return 'above';
  return 'within';
}

/**
 * Optional "needs attention" flag for a row. Currently only triggered
 * when a row that has a band is at $0 or strictly below the min band —
 * matches the locked spec ("only soft nudges; never block Confirm").
 */
export function isUnderfunded(
  category: BudgetCategoryId,
  amount: number,
  ctx: BandContext,
  difficulty: DifficultyId,
): boolean {
  return evaluateBand(category, amount, ctx, difficulty) === 'below';
}

/**
 * Convenience: bulk-evaluate a whole allocation map. UI calls this once
 * per render; no heap churn beyond a small Record per call.
 */
export function evaluateAllBands(
  allocations: Record<BudgetCategoryId, number>,
  ctx: BandContext,
  difficulty: DifficultyId,
): Partial<Record<GuidedCategoryId, BandStatus>> {
  const out: Partial<Record<GuidedCategoryId, BandStatus>> = {};
  for (const id of GUIDED_CATEGORIES) {
    out[id] = evaluateBand(id, allocations[id] ?? 0, ctx, difficulty);
  }
  return out;
}
