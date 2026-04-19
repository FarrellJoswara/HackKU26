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
  rent: 'Roof and walls. Pay it before the surf rises.',
  food: 'Eat well or scenarios bite harder. Cheap weeks tend to backfire.',
  transportation: 'Wheels, rails, gas. Skipping it costs missed shifts.',
  medical: 'Tide of small bills + the rare wave. Stash a little, sleep easy.',
  personal: 'Phone, clothes, day-to-day swaps. Neglect it and morale drifts.',
  miscFun: 'Sanity buffer. Burnout pulls money out faster than fun does.',
  emergencyFund: 'Sea wall against bad scenarios on the map. Build it early.',
  savings: 'Long-tide cash. Scenarios will not auto-drain it.',
  highInterestDebt: 'Riptide of interest. Drown it first — Investments unlock at $0.',
  employerMatch: 'Your contribution is deducted; the match drops in later as a bonus.',
  indexFunds: 'Broad market basket. Lower variance, slower current.',
  individualStocks: 'Single picks. Higher swell, higher spill.',
  bonds: 'Anchor money. Slow but steadier than the open sea.',
  cds: 'Locked-in tide pool. Predictable yield, less liquid.',
  crypto: 'Storm season. High variance, treat as a small slice.',
};

/** Soft "below band" nudge per row — only shown when the band check fails. */
export const ROW_BELOW_BAND: Record<GuidedCategoryId, string> = {
  rent: 'Rent looks thin for this difficulty — landlords on the island do not negotiate.',
  food: 'Food allocation is light. Hungry runs cost more than they save.',
  transportation: 'Transit looks short. Missing a ride costs more than the ticket.',
  medical: 'Medical pool is shallow — one storm clinic visit and it is gone.',
  personal: 'Personal pool runs near zero. Small swaps add up later.',
  miscFun: 'No fun in the budget? Scenarios will tax your morale.',
  emergencyFund: 'Emergency Fund is light — the map pulls from it when the wave hits.',
  savings: 'Savings sits low. It is your only patient cash.',
  highInterestDebt: 'Debt payment is small for this rate — interest grows while you wait.',
  employerMatch: 'Match contribution is thin — leaving free money on the dock.',
};

/** Above-band copy is intentionally absent — see `budgetGuides.ts` notes. */

/** Footer status under the totals row. */
export const FOOTER_STATUS = {
  zeroBased: 'Zero-based — every dollar is on the map.',
  zeroBasedWithPending: 'Zero-based — every dollar is on the map (incl. pending cash).',
  remainingPrefix: 'left to assign',
  overPrefix: 'over budget',
  pendingNote: 'includes pending cash',
} as const;

/** Confirm button state copy. */
export const CONFIRM_COPY = {
  enabled: 'Confirm budget',
  enabledShort: 'Confirm',
  disabledHint: 'Assign every dollar to confirm — Island rule.',
} as const;

/** Locked-investments side panel. */
export const INVESTMENTS_LOCKED = {
  title: 'Investments locked',
  long:
    'Pay your high-interest debt down to $0 to unlock Index Funds, Stocks, Bonds, CDs, and Crypto. ' +
    'Employer Match keeps working from Essentials — match dollars wait until the dock opens.',
  short:
    'Clear high-interest debt to unlock Index Funds, Stocks, Bonds, CDs, Crypto. ' +
    'Employer Match keeps working from Essentials.',
  rowSuffix: 'Locked until high-interest debt is $0.',
} as const;

/** Employer-match informational card. */
export const EMPLOYER_MATCH_COPY = {
  title: 'Employer Match — projected bonus',
  hint:
    'Your contribution in the Employer Match row deducts from salary (counts in zero-based). ' +
    'The match drops on top later — capped at the % of salary shown.',
  hintShort:
    'Contribution deducts from salary; the match lands later, capped at the % shown.',
} as const;

/** Header strapline shown on both Box surfaces. */
export const HEADER_STRAPLINE = {
  full:
    'Allocate every dollar of salary across your categories. Investments stay locked until high-interest debt is paid off.',
  short: 'Every dollar of salary lands somewhere. Confirm to send it through.',
} as const;
