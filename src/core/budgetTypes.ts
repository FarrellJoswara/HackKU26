/**
 * Financial Freedom — "The Box" budgeting phase (GDD).
 * Shared IDs + `playerData` keys so UI and future logic stay aligned.
 *
 * @see GAME_DESIGN.md — "The Box (The Budgeting Phase)"
 *
 * Terminology:
 *  - **Essentials & Cash Flow tab** ships the day-to-day rows (rent, food, …,
 *    Emergency Fund, Savings, High-Interest Debt).
 *  - **Investments tab** is locked until `highInterestDebtBalance <= 0`. It
 *    breaks the legacy `investments` field into the same asset classes the
 *    Investing Birds mini-game uses (Index Funds / Stocks / Bonds / Crypto)
 *    plus CDs.
 *  - `investments` (the legacy single category) stays in the union so older
 *    consumers keep compiling and reading from `playerData.boxAllocations`.
 *    UI sets it to **the sum of the five subcategories** at submit time.
 */

/** Tab the row lives in (browser-style tabs in the Box UI). */
export type BoxTabId = 'essentials' | 'investments';

/** All budget category ids, both essentials and investment subcategories. */
export type BudgetCategoryId =
  /* essentials */
  | 'emergencyFund'
  | 'rent'
  | 'food'
  | 'transportation'
  | 'miscFun'
  | 'highInterestDebt'
  | 'medical'
  | 'personal'
  | 'savings'
  /* legacy aggregate — recomputed from subcategories on submit */
  | 'investments'
  /* investment subcategories (Investing Birds + CDs + Employer Match) */
  | 'indexFunds'
  | 'individualStocks'
  | 'bonds'
  | 'cds'
  | 'crypto'
  | 'employerMatch';

/**
 * Investment subcategories that sum to the legacy `investments` aggregate.
 *
 * NOTE: `employerMatch` is intentionally NOT in this list. Per GDD it lives
 * on the **Essentials** tab as a paycheck-deducted contribution; the
 * **bonus match** is what flows into Investments later via the Year
 * Controller (see `projectEmployerMatch`).
 */
export const INVESTMENT_SUBCATEGORIES = [
  'indexFunds',
  'individualStocks',
  'bonds',
  'cds',
  'crypto',
] as const satisfies readonly BudgetCategoryId[];

export type InvestmentSubcategoryId = (typeof INVESTMENT_SUBCATEGORIES)[number];

export function isInvestmentSubcategory(id: BudgetCategoryId): id is InvestmentSubcategoryId {
  return (INVESTMENT_SUBCATEGORIES as readonly BudgetCategoryId[]).includes(id);
}

/** Keys stored on `playerData` (Zustand) for this feature. */
export const BOX_PLAYER_DATA_KEYS = {
  /** Annual salary for the current budgeting round (`[VAR_STARTING_INCOME]`). */
  annualSalary: 'annualSalary',
  /** Running high-interest debt balance; Investments unlock at $0. */
  highInterestDebtBalance: 'highInterestDebtBalance',
  /** Last submitted allocations by category id. */
  boxAllocations: 'boxAllocations',
  /** Difficulty label affects starting income in full game logic. */
  difficulty: 'difficulty',
  /** Current-year inflation rate (decimal, e.g. 0.034 for 3.4%) (`[VAR_INFLATION_RATE]`). */
  currentInflationRate: 'currentInflationRate',
  /**
   * Employer match rate (decimal). Bonus money on top of player allocations
   * — does NOT count against the zero-based salary total.
   * (`[VAR_EMPLOYER_MATCH_RATE]`)
   */
  employerMatchRate: 'employerMatchRate',
  /** Match cap as a fraction of salary (e.g. 0.06 = match up to 6% of salary). */
  employerMatchCapPctSalary: 'employerMatchCapPctSalary',
  /**
   * 1-indexed integer; tracks which year the player is on. Year Controller
   * (future) increments at Payday. UI displays in HUD / Box header.
   */
  currentYear: 'currentYear',
  /**
   * One-shot cash that must be re-budgeted before the next roll: liquidation
   * leftover after a debt regression, future windfall scenarios, etc.
   * Strict zero-based uses `salary + pendingCashToAllocate`; submit clears it.
   */
  pendingCashToAllocate: 'pendingCashToAllocate',
} as const;

/** Metadata for one Box row. */
export interface BoxCategoryDef {
  id: BudgetCategoryId;
  label: string;
  short: string;
  /** Tab the row belongs to. */
  tab: BoxTabId;
  /** When true, row is disabled until `highInterestDebtBalance <= 0`. */
  lockedUntilDebtFree: boolean;
}

/** Human labels + tab + which row is progression-locked until debt is cleared. */
export const BOX_CATEGORIES: readonly BoxCategoryDef[] = [
  /* --- Essentials & Cash Flow tab --- */
  { id: 'rent', label: 'Rent', short: 'Housing', tab: 'essentials', lockedUntilDebtFree: false },
  { id: 'food', label: 'Food', short: 'Groceries & meals', tab: 'essentials', lockedUntilDebtFree: false },
  {
    id: 'transportation',
    label: 'Transportation',
    short: 'Car, transit, gas',
    tab: 'essentials',
    lockedUntilDebtFree: false,
  },
  { id: 'medical', label: 'Medical', short: 'Health costs', tab: 'essentials', lockedUntilDebtFree: false },
  {
    id: 'personal',
    label: 'Personal',
    short: 'Clothing, phone, etc.',
    tab: 'essentials',
    lockedUntilDebtFree: false,
  },
  {
    id: 'miscFun',
    label: 'Misc / Fun',
    short: 'Burnout buffer',
    tab: 'essentials',
    lockedUntilDebtFree: false,
  },
  {
    id: 'emergencyFund',
    label: 'Emergency Fund',
    short: 'Defense vs bad scenarios',
    tab: 'essentials',
    lockedUntilDebtFree: false,
  },
  {
    id: 'savings',
    label: 'Savings',
    short: 'General / long-term cash',
    tab: 'essentials',
    lockedUntilDebtFree: false,
  },
  {
    id: 'highInterestDebt',
    label: 'High-Interest Debt',
    short: 'Pay toxic debt first',
    tab: 'essentials',
    lockedUntilDebtFree: false,
  },
  {
    id: 'employerMatch',
    label: 'Employer Match',
    short: 'Your 401(k) contribution — match added later',
    tab: 'essentials',
    lockedUntilDebtFree: false,
  },

  /* --- Investments tab (locked until debt = $0) --- */
  {
    id: 'indexFunds',
    label: 'Index Funds',
    short: 'Broad market ETFs',
    tab: 'investments',
    lockedUntilDebtFree: true,
  },
  {
    id: 'individualStocks',
    label: 'Individual Stocks',
    short: 'Single-company picks',
    tab: 'investments',
    lockedUntilDebtFree: true,
  },
  {
    id: 'bonds',
    label: 'Bonds',
    short: 'Lower-risk yield',
    tab: 'investments',
    lockedUntilDebtFree: true,
  },
  {
    id: 'cds',
    label: 'CDs',
    short: 'Certificates of Deposit',
    tab: 'investments',
    lockedUntilDebtFree: true,
  },
  {
    id: 'crypto',
    label: 'Crypto',
    short: 'High risk / high variance',
    tab: 'investments',
    lockedUntilDebtFree: true,
  },
] as const;

/** Default demo values when `playerData` has not been seeded yet (hackathon / UI example). */
export const BOX_DEFAULTS = {
  /** Placeholder for `[VAR_STARTING_INCOME]` — Easy/Medium/Hard in full game. */
  annualSalary: 48_000,
  /** Placeholder for `[VAR_STARTING_DEBT]`. */
  highInterestDebtBalance: 12_000,
  /**
   * Default current-year inflation (5.0%). The Year Controller (future)
   * re-rolls at each Payday inside `[INFLATION_RANGE_MIN, INFLATION_RANGE_MAX]`.
   */
  currentInflationRate: 0.05,
  /** Default employer 401(k)-style match (50%). */
  employerMatchRate: 0.5,
  /** Default match cap = 6% of annual salary. */
  employerMatchCapPctSalary: 0.06,
  /** Players start in Year 1. */
  currentYear: 1,
  /** No pending cash on a fresh game. */
  pendingCashToAllocate: 0,
} as const;

/** Inflation roll band per GDD ([VAR_INFLATION_RATE]). Decimals: 0.02 = 2%. */
export const INFLATION_RANGE_MIN = 0.02;
export const INFLATION_RANGE_MAX = 0.08;

export function emptyAllocations(): Record<BudgetCategoryId, number> {
  return {
    emergencyFund: 0,
    rent: 0,
    food: 0,
    transportation: 0,
    miscFun: 0,
    highInterestDebt: 0,
    medical: 0,
    personal: 0,
    savings: 0,
    investments: 0,
    indexFunds: 0,
    individualStocks: 0,
    bonds: 0,
    cds: 0,
    crypto: 0,
    employerMatch: 0,
  };
}

export function readNumber(data: Record<string, unknown>, key: string, fallback: number): number {
  const v = data[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Payload for `box:budget:submit` — logic layer listens and advances the loop. */
export interface BoxBudgetSubmitPayload {
  allocations: Record<BudgetCategoryId, number>;
  annualSalary: number;
  /** Snapshot of debt balance when the player confirmed (for auditing / modifiers). */
  highInterestDebtBalanceAtSubmit: number;
  /** Inflation rate active at submit time (decimal). */
  inflationRate: number;
  /** Employer match dollars projected for the year (info, NOT in `allocations`). */
  employerMatchProjected: number;
  /** 1-indexed year the player is on at submit time. */
  year: number;
  /**
   * Pending cash that was on the table at submit. The Year Controller / submit
   * handler should set `playerData.pendingCashToAllocate = 0` after consuming
   * this payload — the player has now allocated it.
   */
  pendingCashConsumed: number;
}

export function readAllocations(
  data: Record<string, unknown>,
): Record<BudgetCategoryId, number> | null {
  const raw = data[BOX_PLAYER_DATA_KEYS.boxAllocations];
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const base = emptyAllocations();
  for (const k of Object.keys(base) as BudgetCategoryId[]) {
    const n = readNumber(o, k, 0);
    if (n >= 0) base[k] = n;
  }
  return base;
}

/** Sum of all investment subcategories — used to recompute the legacy `investments` aggregate. */
export function sumInvestmentSubcategories(
  allocations: Record<BudgetCategoryId, number>,
): number {
  let total = 0;
  for (const id of INVESTMENT_SUBCATEGORIES) total += allocations[id] ?? 0;
  return total;
}

/**
 * Sum that contributes to the **zero-based** total. Excludes the legacy
 * `investments` aggregate (it would double-count the subcategories).
 */
export function sumZeroBasedAllocations(
  allocations: Record<BudgetCategoryId, number>,
): number {
  let total = 0;
  for (const k of Object.keys(allocations) as BudgetCategoryId[]) {
    if (k === 'investments') continue;
    total += allocations[k] ?? 0;
  }
  return total;
}

/**
 * Total cash the player must allocate this submit (zero-based target).
 * `salary + pendingCashToAllocate`. Negative pending values are clamped to 0.
 */
export function effectiveCashToAllocate(args: {
  annualSalary: number;
  pendingCashToAllocate: number;
}): number {
  const salary = Number.isFinite(args.annualSalary) ? Math.max(0, args.annualSalary) : 0;
  const pending = Number.isFinite(args.pendingCashToAllocate)
    ? Math.max(0, args.pendingCashToAllocate)
    : 0;
  return salary + pending;
}

/**
 * Project employer match dollars from the current allocation.
 *
 * Source of contribution: `allocations.employerMatch` — the player's own
 * 401(k)-style row (deducted from salary, counts toward zero-based).
 *
 * The **bonus match** = `min(contribution, cap) * matchRate` where
 * `cap = capPctSalary * annualSalary`. The match is **NOT** part of the
 * zero-based total; the Year Controller (future) will deposit it into
 * Investments later. This function only projects the number for UI.
 */
export function projectEmployerMatch(args: {
  allocations: Record<BudgetCategoryId, number>;
  annualSalary: number;
  matchRate: number;
  capPctSalary: number;
}): number {
  const playerContrib = args.allocations.employerMatch ?? 0;
  const cap = Math.max(0, args.capPctSalary) * Math.max(0, args.annualSalary);
  const eligible = Math.min(Math.max(0, playerContrib), cap);
  return eligible * Math.max(0, args.matchRate);
}
