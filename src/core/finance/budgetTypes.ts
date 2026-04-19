export type BudgetRating = 'bad' | 'average' | 'good';

export type BudgetCategoryId =
  | 'rent'
  | 'food'
  | 'transportation'
  | 'emergencyFund'
  | 'medical'
  | 'debtRepayment'
  | 'miscFun';

export interface BudgetProfile {
  rent: BudgetRating;
  food: BudgetRating;
  transportation: BudgetRating;
  emergencyFund: BudgetRating;
  medical: BudgetRating;
  debtRepayment: BudgetRating;
  miscFun: BudgetRating;
}

export const BUDGET_CATEGORIES: BudgetCategoryId[] = [
  'rent',
  'food',
  'transportation',
  'emergencyFund',
  'medical',
  'debtRepayment',
  'miscFun',
];

export const CATEGORY_LABELS: Record<BudgetCategoryId, string> = {
  rent: 'Rent / Housing',
  food: 'Food',
  transportation: 'Transportation',
  emergencyFund: 'Emergency Fund',
  medical: 'Medical / Health',
  debtRepayment: 'Debt Repayment',
  miscFun: 'Misc / Fun',
};

export function isBudgetRating(value: unknown): value is BudgetRating {
  return value === 'bad' || value === 'average' || value === 'good';
}

export function parseBudgetProfile(raw: unknown): BudgetProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const parsed: Partial<BudgetProfile> = {};

  for (const category of BUDGET_CATEGORIES) {
    const value = input[category];
    if (!isBudgetRating(value)) return null;
    parsed[category] = value;
  }

  return parsed as BudgetProfile;
}

