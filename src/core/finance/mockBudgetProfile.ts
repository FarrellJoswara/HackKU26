/**
 * @file Deterministic mock `BudgetProfile` for tests and dev shortcuts when
 * no persisted player save exists.
 */

import type { BudgetProfile } from './budgetTypes';

export const MOCK_BUDGET_PROFILE: BudgetProfile = {
  rent: 'bad',
  food: 'average',
  transportation: 'good',
  emergencyFund: 'bad',
  medical: 'bad',
  debtRepayment: 'bad',
  miscFun: 'good',
};

