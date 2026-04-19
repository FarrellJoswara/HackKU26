/**
 * @file Financial debrief after DebtRunner — budget effect copy, stats, and
 * navigation into the next campaign step.
 */

import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { eventBus } from '@/core/events';
import type { UIProps } from '@/core/types';
import { Button } from '../components/Button';
import { CATEGORY_LABELS, type BudgetCategoryId } from '@/core/finance/budgetTypes';
import { explainBudgetProfileEffects } from '@/core/finance/explainEffects';
import { getStoredLastRun } from '@/core/runner/RunnerResultRouter';
import { advanceCampaignYear } from '@/core/campaign/yearAdvance';

export default function PostRunSummaryScreen(props: UIProps<Record<string, unknown>>) {
  const lastRun = getStoredLastRun(props.data);

  if (!lastRun) {
    return (
      <div className="tropic-bg-paper absolute inset-0 flex items-center justify-center text-[#2a2418]">
        <div className="tropic-card mx-4 w-full max-w-xl p-7">
          <h2
            className="text-2xl font-semibold text-[#1a4d5c]"
            style={{ fontFamily: 'var(--island-font-display)' }}
          >
            Post-run report
          </h2>
          <p className="mt-2 text-sm text-[#3d3428]/85">
            No run data saved yet. This screen fills in after the runner emits{' '}
            <code className="rounded bg-[#fbe6be] px-1">runner:finished</code>.
          </p>
          <div className="mt-6">
            <Button
              variant="turquoise"
              leadingIcon={<ArrowLeft className="size-4" />}
              onClick={() => eventBus.emit('navigate:request', { to: 'menu', module: null })}
            >
              Back to menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const profile = lastRun.config.profile;
  const effects = explainBudgetProfileEffects(profile);
  const ids: BudgetCategoryId[] = [
    'rent',
    'food',
    'transportation',
    'emergencyFund',
    'medical',
    'debtRepayment',
    'miscFun',
  ];

  return (
    <div className="tropic-bg-paper absolute inset-0 overflow-auto text-[#2a2418]">
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1a4d5c]/75">
              Financial recap
            </p>
            <h2
              className="mt-1 text-3xl font-semibold text-[#1a4d5c]"
              style={{ fontFamily: 'var(--island-font-display)' }}
            >
              {lastRun.outcome === 'win' ? 'Clear sunset, steady water.' : 'The currents hit hard.'}
            </h2>
            <p className="mt-1 text-sm text-[#3d3428]/80">
              Outcome:{' '}
              <span className="font-semibold text-[#1a4d5c]">
                {lastRun.outcome === 'win' ? 'Win' : 'Loss'}
              </span>
              {lastRun.outcome === 'loss' && lastRun.failReason
                ? ` (${lastRun.failReason})`
                : ''}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="coral"
              leadingIcon={<ArrowRight className="size-4" />}
              onClick={() =>
                advanceCampaignYear({
                  outcome: lastRun.outcome,
                  destination: 'budget',
                })
              }
            >
              Continue to next year
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="tropic-card p-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#1a4d5c]">
              Received profile
            </h3>
            <p className="mt-1 text-xs text-[#3d3428]/75">
              Total debt pressure tier:{' '}
              <span className="font-semibold text-[#1a4d5c]">
                {lastRun.config.totalDebtPressureTier.toUpperCase()}
              </span>
            </p>
            <div className="mt-4 space-y-3">
              {ids.map((id) => (
                <div key={id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-[#2a2418]">{CATEGORY_LABELS[id]}</span>
                    <span
                      className={
                        profile[id] === 'bad'
                          ? 'rounded-full bg-[#ff8b6b]/25 px-2 py-0.5 text-xs font-semibold text-[#b94530]'
                          : profile[id] === 'average'
                            ? 'rounded-full bg-[#ffc36b]/30 px-2 py-0.5 text-xs font-semibold text-[#a8854a]'
                            : 'rounded-full bg-[#5ed6d9]/30 px-2 py-0.5 text-xs font-semibold text-[#1a7a8c]'
                      }
                    >
                      {profile[id].toUpperCase()}
                    </span>
                  </div>
                  <div className="tropic-hudBar tropic-hudBar--turquoise">
                    <span
                      style={{
                        width:
                          profile[id] === 'good' ? '100%' : profile[id] === 'average' ? '65%' : '35%',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="tropic-card p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#f59f3a]" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#1a4d5c]">
                How it changed gameplay
              </h3>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-[#2a2418]">
              {effects.map((e, idx) => {
                // The severity field is derived from the rating
                // (bad → high, average → medium, good → low). The chip used
                // to print the raw severity ("LOW") which read as confusing
                // when the underlying rating was GOOD. Translate to the
                // direction-of-impact wording the player already sees on
                // the left column.
                const chipLabel =
                  e.severity === 'high'
                    ? 'Risk'
                    : e.severity === 'medium'
                      ? 'Baseline'
                      : 'Strength';
                // Plain text already starts with "X was Y, " — strip that
                // since the title chip carries the same info. Keep the
                // verb that follows ("reducing", "giving", etc.) so the
                // sentence still reads as a consequence and not just a
                // bare noun phrase.
                const consequence = e.plainText.replace(
                  /^[^,]+\swas\s[A-Z]+,\s*(?:so\s+|which\s+)?/,
                  '',
                );
                const cleaned = consequence.charAt(0).toUpperCase() + consequence.slice(1);
                return (
                  <li
                    key={`${e.categoryId}-${idx}`}
                    className="rounded-2xl border border-[#fbe6be] bg-[#fff7e8]/85 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[#1a4d5c]">{e.title}</span>
                      <span
                        className={
                          e.severity === 'high'
                            ? 'rounded-full bg-[#ff8b6b]/25 px-2 py-0.5 text-xs font-semibold text-[#b94530]'
                            : e.severity === 'medium'
                              ? 'rounded-full bg-[#ffc36b]/30 px-2 py-0.5 text-xs font-semibold text-[#a8854a]'
                              : 'rounded-full bg-[#5ed6d9]/30 px-2 py-0.5 text-xs font-semibold text-[#1a7a8c]'
                        }
                      >
                        {chipLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-[#3d3428]/85">{cleaned}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {lastRun.outcome === 'loss' ? (
          <div className="tropic-card mt-6 p-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#1a4d5c]">
              Why this loss happened (cause to effect)
            </h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {effects
                .filter((effect) => effect.severity !== 'low')
                .map((effect) => (
                  <div
                    key={effect.title}
                    className="rounded-2xl border border-[#fbe6be] bg-[#fff7e8]/85 p-4"
                  >
                    <p className="text-sm font-semibold text-[#1a4d5c]">{effect.title}</p>
                    <p className="mt-2 text-sm text-[#3d3428]/85">{effect.plainText}</p>
                  </div>
                ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
