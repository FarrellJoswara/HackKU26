/**
 * Financial Freedom — "The Box" budgeting phase (GDD).
 * Shared IDs + `playerData` keys so UI and future logic stay aligned.
 *
 * @see GAME_DESIGN.md — "The Box (The Budgeting Phase)"
 */

/** The nine budget categories from the GDD (order preserved for UI). */
export type BudgetCategoryId =
  | 'emergencyFund'
  | 'rent'
  | 'food'
  | 'transportation'
  | 'miscFun'
  | 'highInterestDebt'
  | 'investments'
  | 'medical'
  | 'personal';

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
} as const;

/** Human labels + which row is progression-locked until debt is cleared. */
export const BOX_CATEGORIES: readonly {
  id: BudgetCategoryId;
  label: string;
  short: string;
  /** When true, row is disabled until `highInterestDebtBalance <= 0`. */
  lockedUntilDebtFree: boolean;
}[] = [
  {
    id: 'emergencyFund',
    label: 'Emergency Fund',
    short: 'Defense vs bad scenarios',
    lockedUntilDebtFree: false,
  },
  { id: 'rent', label: 'Rent', short: 'Housing', lockedUntilDebtFree: false },
  { id: 'food', label: 'Food', short: 'Groceries & meals', lockedUntilDebtFree: false },
  {
    id: 'transportation',
    label: 'Transportation',
    short: 'Car, transit, gas',
    lockedUntilDebtFree: false,
  },
  {
    id: 'miscFun',
    label: 'Misc / Fun',
    short: 'Burnout buffer',
    lockedUntilDebtFree: false,
  },
  {
    id: 'highInterestDebt',
    label: 'High-Interest Debt',
    short: 'Pay toxic debt first',
    lockedUntilDebtFree: false,
  },
  {
    id: 'investments',
    label: 'Investments',
    short: 'Locked until debt is $0',
    lockedUntilDebtFree: true,
  },
  { id: 'medical', label: 'Medical', short: 'Health costs', lockedUntilDebtFree: false },
  {
    id: 'personal',
    label: 'Personal',
    short: 'Clothing, phone, etc.',
    lockedUntilDebtFree: false,
  },
] as const;

/** Default demo values when `playerData` has not been seeded yet (hackathon / UI example). */
export const BOX_DEFAULTS = {
  /** Placeholder for `[VAR_STARTING_INCOME]` — Easy/Medium/Hard in full game. */
  annualSalary: 48_000,
  /** Placeholder for `[VAR_STARTING_DEBT]`. */
  highInterestDebtBalance: 12_000,
} as const;

export function emptyAllocations(): Record<BudgetCategoryId, number> {
  return {
    emergencyFund: 0,
    rent: 0,
    food: 0,
    transportation: 0,
    miscFun: 0,
    highInterestDebt: 0,
    investments: 0,
    medical: 0,
    personal: 0,
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
