/**
 * Goal rail — phased "north star" strip for The Box.
 *
 * Locked spec (`box_ui_clarified_requirements_7711a010.plan.md`,
 * "Goals, targets, incentives"):
 *  - Debt phase: "path to $0 debt" — informational runway, no
 *    interest math, no second ledger.
 *  - Investing / freedom phase: progress toward `[VAR_WIN_GOAL]`.
 *  - Both branches are *informational*; nothing here gates Confirm.
 *
 * Visual is intentionally calm — one line of headline copy, one
 * derived metric, one tiny progress bar (debt: payment-vs-balance;
 * freedom: invested-vs-goal). Sits above the tab nav in both Box
 * surfaces so the player sees "why" before "how".
 */

import { Compass, Flag } from 'lucide-react';
import {
  computeGoalState,
  type GoalState,
} from '@/core/finance/boxGoalRail';
import { InfoMark } from '@/ui/components/InfoMark';

export interface BoxGoalRailProps {
  highInterestDebtBalance: number;
  /** Dollars planned for the high-interest debt row this year. */
  highInterestDebtAllocation: number;
  /** Optional player-data override for the win goal. */
  winGoalUsd?: number;
  /** Optional invested balance proxy (until Year Controller ships). */
  investedBalanceUsd?: number;
  /** `compact` shrinks padding and font sizes for the overlay variant. */
  variant?: 'default' | 'compact';
}

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const pct = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 0,
});

export function BoxGoalRail({
  highInterestDebtBalance,
  highInterestDebtAllocation,
  winGoalUsd,
  investedBalanceUsd,
  variant = 'default',
}: BoxGoalRailProps) {
  const state = computeGoalState({
    highInterestDebtBalance,
    highInterestDebtAllocation,
    winGoalUsd,
    investedBalanceUsd,
  });

  const isCompact = variant === 'compact';
  const padClass = isCompact ? 'p-3' : 'p-4';
  const titleClass = isCompact ? 'text-sm' : 'text-base';
  const metricClass = isCompact ? 'text-base' : 'text-lg';

  return (
    <div className={['island-paperCard rounded-2xl', padClass].join(' ')}>
      {state.phase === 'debt' ? (
        <DebtGoal state={state} titleClass={titleClass} metricClass={metricClass} />
      ) : (
        <FreedomGoal state={state} titleClass={titleClass} metricClass={metricClass} />
      )}
    </div>
  );
}

interface InnerProps<S extends GoalState> {
  state: S;
  titleClass: string;
  metricClass: string;
}

function DebtGoal({
  state,
  titleClass,
  metricClass,
}: InnerProps<Extract<GoalState, { phase: 'debt' }>>) {
  const { debtBalance, yearlyPayment, yearsRemaining, yearsRoundedUp, paymentRatio } = state;
  const headline =
    yearsRemaining == null
      ? 'No payment toward high-interest debt this year.'
      : yearsRoundedUp != null && yearsRoundedUp <= 1
        ? 'On pace to clear the riptide this year.'
        : `~${yearsRoundedUp} year${(yearsRoundedUp ?? 0) > 1 ? 's' : ''} of paydowns at this pace.`;
  const barPct = Math.max(0, Math.min(1, paymentRatio));

  return (
    <div className="flex items-start gap-3">
      <Compass className="mt-0.5 size-5 shrink-0 text-[#b91c1c]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className={['font-medium text-[var(--island-color-ink)]', titleClass].join(' ')}>
            North star — pay down the riptide
          </p>
          <InfoMark
            label="About the debt runway"
            placement="bottom"
            popoverWidth={260}
          >
            Rough horizon: this year&apos;s high-interest payment divided into
            the current balance. It does not include interest growth — treat
            it as a heading, not a forecast.
          </InfoMark>
        </div>
        <p className={['mt-1 font-mono text-[#7a1414]', metricClass].join(' ')}>
          {fmt.format(yearlyPayment)} <span className="opacity-50">/ yr</span>
          <span className="opacity-35"> · </span>
          <span className="text-[var(--island-color-ink)]">{fmt.format(debtBalance)}</span>{' '}
          <span className="text-xs opacity-70">remaining</span>
        </p>
        <p className="island-statusText mt-1 text-sm">{headline}</p>
        <div className="tropic-hudBar tropic-hudBar--coral mt-2" aria-hidden>
          <span style={{ width: `${barPct * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function FreedomGoal({
  state,
  titleClass,
  metricClass,
}: InnerProps<Extract<GoalState, { phase: 'freedom' }>>) {
  const { invested, goal, progress, remaining } = state;
  const headline =
    progress >= 1
      ? 'Win goal reached. Sail on.'
      : `${pct.format(progress)} of the way to financial freedom.`;
  return (
    <div className="flex items-start gap-3">
      <Flag className="mt-0.5 size-5 shrink-0 text-[var(--island-color-title)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className={['font-medium text-[var(--island-color-ink)]', titleClass].join(' ')}>
            North star — financial freedom
          </p>
          <InfoMark
            label="About the freedom goal"
            placement="bottom"
            popoverWidth={260}
          >
            Progress is invested balance vs the win goal. Until the Year
            Controller lands, the invested figure is a placeholder fed by
            <code className="mx-1 rounded bg-[rgba(26,77,92,0.08)] px-1 font-mono text-[0.85em]">
              campaign.investedBalanceUsd
            </code>
            on player data.
          </InfoMark>
        </div>
        <p className={['mt-1 font-mono text-[var(--island-color-title)]', metricClass].join(' ')}>
          {fmt.format(invested)} <span className="opacity-50">/ {fmt.format(goal)}</span>{' '}
          <span className="text-xs opacity-70">
            ({fmt.format(remaining)} to go)
          </span>
        </p>
        <p className="island-statusText mt-1 text-sm">{headline}</p>
        <div className="tropic-hudBar tropic-hudBar--turquoise mt-2" aria-hidden>
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

export default BoxGoalRail;
