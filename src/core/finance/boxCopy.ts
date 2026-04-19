/**
 * In-world copy strings for The Box.
 *
 * Centralises Island-flavored helper text + soft warnings so the full
 * Box screen and the IslandRun overlay stay in sync (same words, same
 * tone). Keep each line under ~120 chars where possible.
 *
 * Rules of voice:
 *  - Talk like an Island scout, not a SaaS form. Short, warm, factual.
 *  - Never imply Confirm is blocked unless it actually is (zero-based).
 *  - Numbers are facts. Suggestions are nudges. Don't moralise.
 */

import type { BudgetCategoryId } from '@/core/budgetTypes';
import type { GuidedCategoryId } from '@/core/finance/budgetGuides';

/** Per-row info bubbles surfaced via `<InfoMark>`. */
export const ROW_INFO: Partial<Record<BudgetCategoryId, string>> = {
  rent: 'Keep housing paid first. Stable shelter protects every other category.',
  food: 'Fund groceries on purpose. Skipping this line often costs more later.',
  transportation: 'Budget for rides, fuel, and repairs so work stays reliable.',
  medical: 'Set aside health money now to dodge bigger bills later.',
  personal: 'Cover daily basics like phone and essentials so stress stays lower.',
  miscFun: 'A small fun budget helps prevent bigger impulse spending.',
  emergencyFund: 'Build cash for surprises so one bad week does not wreck the plan.',
  savings: 'This is patient cash for future goals and larger planned costs.',
  highInterestDebt: 'Pay this down early. High APR beats most investment returns.',
  employerMatch: 'Your contribution comes from salary; employer match lands later as bonus money.',
  indexFunds: 'Broad market exposure with low fees and less single-stock risk.',
  individualStocks: 'Higher upside, higher risk. Keep position sizes disciplined.',
  bonds: 'Lower-volatility investing that helps steady your overall mix.',
  cds: 'Predictable return with funds locked until maturity.',
  crypto: 'High volatility. Keep this allocation small and intentional.',
};

/** Soft "below band" nudge per row — only shown when the band check fails. */
export const ROW_BELOW_BAND: Record<GuidedCategoryId, string> = {
  rent: 'Rent looks light for this run. Housing shocks can snowball fast.',
  food: 'Food is underfunded. Cheap weeks often turn into expensive ones.',
  transportation: 'Transportation is thin. One missed repair can cost a lot.',
  medical: 'Medical is light. A single visit could empty this bucket.',
  personal: 'Personal spending is near zero. Everyday essentials still add up.',
  miscFun: 'No fun money can backfire. Burnout spending often shows up later.',
  emergencyFund: 'Emergency Fund is low. You may need this when surprises hit.',
  savings: 'Savings is low. Future-you has less room to breathe.',
  highInterestDebt: 'Debt payment is light. Interest keeps growing while you wait.',
  employerMatch: 'Match contribution is low. You are leaving free employer money behind.',
};

/** Above-band copy is intentionally absent — see `budgetGuides.ts` notes. */

/** Footer status under the totals row. */
export const FOOTER_STATUS = {
  zeroBased: 'Zero-based: every dollar has a job.',
  zeroBasedWithPending: 'Zero-based: every dollar has a job (including pending cash).',
  remainingPrefix: 'left to assign',
  overPrefix: 'over budget',
  pendingNote: 'includes pending cash',
} as const;

/** Confirm button state copy. */
export const CONFIRM_COPY = {
  enabled: 'Confirm budget',
  enabledShort: 'Confirm',
  disabledHint: 'Assign every dollar before confirming.',
} as const;

/** Locked-investments side panel. */
export const INVESTMENTS_LOCKED = {
  title: 'Investments locked',
  long:
    'Pay high-interest debt to $0 to unlock Index Funds, Stocks, Bonds, CDs, and Crypto. ' +
    'Employer Match still works from Essentials, and match dollars land when investing unlocks.',
  short:
    'Clear high-interest debt to unlock Index Funds, Stocks, Bonds, CDs, and Crypto. ' +
    'Employer Match still works from Essentials.',
  rowSuffix: 'Locked until high-interest debt is $0.',
} as const;

/** Employer-match informational card. */
export const EMPLOYER_MATCH_COPY = {
  title: 'Employer Match — projected bonus',
  hint:
    'Your Employer Match contribution comes from salary (counts in zero-based). ' +
    'Match dollars are added later, capped at the % of salary shown.',
  hintShort:
    'Contribution comes from salary; match lands later, capped at the % shown.',
} as const;

/** Header strapline shown on both Box surfaces. */
export const HEADER_STRAPLINE = {
  full:
    'Assign every salary dollar across your categories. Investments unlock after high-interest debt is cleared.',
  short: 'Give each salary dollar a job, then confirm to lock it in.',
} as const;
