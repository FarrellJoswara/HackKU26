import type { BudgetCategoryId, BudgetProfile, BudgetRating } from './budgetTypes';
import { CATEGORY_LABELS } from './budgetTypes';

export type EffectSeverity = 'low' | 'medium' | 'high';

export interface EffectToken {
  categoryId: BudgetCategoryId;
  severity: EffectSeverity;
  title: string;
  plainText: string;
}

function severityFromRating(rating: BudgetRating): EffectSeverity {
  if (rating === 'bad') return 'high';
  if (rating === 'average') return 'medium';
  return 'low';
}

export function explainBudgetProfileEffects(profile: BudgetProfile): EffectToken[] {
  const rows: Array<{ id: BudgetCategoryId; text: Record<BudgetRating, string> }> = [
    {
      id: 'rent',
      text: {
        bad: 'Rent was BAD, which created a more hazardous and less forgiving course.',
        average: 'Rent was AVERAGE, so path difficulty stayed near baseline.',
        good: 'Rent was GOOD, making the route cleaner and easier to read.',
      },
    },
    {
      id: 'food',
      text: {
        bad: 'Food was BAD, so stamina drained faster and recovery slowed.',
        average: 'Food was AVERAGE, so stamina behavior stayed normal.',
        good: 'Food was GOOD, giving stronger endurance and faster recovery.',
      },
    },
    {
      id: 'transportation',
      text: {
        bad: 'Transportation was BAD, so turning and lane response were slower.',
        average: 'Transportation was AVERAGE, so controls were standard.',
        good: 'Transportation was GOOD, making movement sharper and cleaner.',
      },
    },
    {
      id: 'emergencyFund',
      text: {
        bad: 'Emergency Fund was BAD, so you only had one life.',
        average: 'Emergency Fund was AVERAGE, giving limited forgiveness.',
        good: 'Emergency Fund was GOOD, giving extra lives/revive protection.',
      },
    },
    {
      id: 'medical',
      text: {
        bad: 'Medical was BAD, so injury slowdown lasted longer and hit harder.',
        average: 'Medical was AVERAGE, so injury behavior stayed standard.',
        good: 'Medical was GOOD, reducing injury severity and recovery time.',
      },
    },
    {
      id: 'debtRepayment',
      text: {
        bad: 'Debt Repayment was BAD, so the Debt Collector became visibly larger and more aggressive.',
        average: 'Debt Repayment was AVERAGE, so collector pressure stayed standard.',
        good: 'Debt Repayment was GOOD, so the Debt Collector stayed smaller and calmer.',
      },
    },
    {
      id: 'miscFun',
      text: {
        bad: 'Misc/Fun was BAD, increasing stumbles, burnout, and the exhausting run feel.',
        average: 'Misc/Fun was AVERAGE, so morale/focus stayed near baseline.',
        good: 'Misc/Fun was GOOD, improving early morale and comfort.',
      },
    },
  ];

  const tokens = rows.map((row) => ({
    categoryId: row.id,
    severity: severityFromRating(profile[row.id]),
    title: CATEGORY_LABELS[row.id],
    plainText: row.text[profile[row.id]],
  }));

  const highDebtPressure =
    profile.debtRepayment === 'bad' &&
    (profile.emergencyFund === 'bad' || profile.medical === 'bad');
  if (highDebtPressure) {
    tokens.push({
      categoryId: 'debtRepayment',
      severity: 'high',
      title: 'Total Debt Pressure',
      plainText:
        'High debt pressure increased chase speed over time (interest shadow), making recovery windows shrink as the run continued.',
    });
  }

  return tokens;
}

