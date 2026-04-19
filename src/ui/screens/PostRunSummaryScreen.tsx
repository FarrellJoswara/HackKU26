import { ArrowLeft, RotateCcw, Sparkles } from 'lucide-react';
import { eventBus } from '@/core/events';
import type { UIProps } from '@/core/types';
import { Button } from '../components/Button';
import { CATEGORY_LABELS, type BudgetCategoryId } from '@/core/finance/budgetTypes';
import { explainBudgetProfileEffects } from '@/core/finance/explainEffects';
import { getStoredLastRun } from '@/core/runner/RunnerResultRouter';

export default function PostRunSummaryScreen(props: UIProps<Record<string, unknown>>) {
  const lastRun = getStoredLastRun(props.data);

  if (!lastRun) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-950 via-indigo-950 to-black text-white">
        <div className="mx-4 w-full max-w-xl rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur">
          <h2 className="text-2xl font-semibold tracking-tight">Post-run summary</h2>
          <p className="mt-2 text-sm text-white/70">
            No run data saved yet. This screen will populate after the runner emits{' '}
            <code className="rounded bg-white/10 px-1">runner:finished</code>.
          </p>
          <div className="mt-6">
            <Button
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
    <div className="absolute inset-0 overflow-auto bg-gradient-to-b from-slate-950 via-indigo-950 to-black text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Financial debrief</h2>
            <p className="mt-1 text-sm text-white/70">
              Outcome:{' '}
              <span className="font-medium text-white">
                {lastRun.outcome === 'win' ? 'Win' : 'Loss'}
              </span>
              {lastRun.outcome === 'loss' && lastRun.failReason
                ? ` (${lastRun.failReason})`
                : ''}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="ghost"
              leadingIcon={<ArrowLeft className="size-4" />}
              onClick={() =>
                eventBus.emit('navigate:request', {
                  to: lastRun.outcome === 'win' ? 'win' : 'loss',
                  module: null,
                })
              }
            >
              Back
            </Button>
            <Button
              leadingIcon={<RotateCcw className="size-4" />}
              onClick={() => eventBus.emit('navigate:request', { to: 'menu', module: null })}
            >
              New run (menu)
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
            <h3 className="text-sm font-semibold tracking-wide text-white/85">
              Received profile
            </h3>
            <p className="mt-1 text-xs text-white/60">
              Total debt pressure tier:{' '}
              <span className="text-white/90">{lastRun.config.totalDebtPressureTier.toUpperCase()}</span>
            </p>
            <div className="mt-4 space-y-3">
              {ids.map((id) => (
                <div key={id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-white/90">{CATEGORY_LABELS[id]}</span>
                    <span
                      className={
                        profile[id] === 'bad'
                          ? 'text-rose-200'
                          : profile[id] === 'average'
                            ? 'text-amber-200'
                            : 'text-emerald-200'
                      }
                    >
                      {profile[id].toUpperCase()}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-cyan-400/70"
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

          <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-indigo-200" />
              <h3 className="text-sm font-semibold tracking-wide text-white/85">
                What that caused in gameplay
              </h3>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-white/80">
              {effects.map((e, idx) => (
                <li key={`${e.categoryId}-${idx}`} className="rounded-xl bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-white/90">{e.title}</span>
                    <span
                      className={
                        e.severity === 'high'
                          ? 'rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-200'
                          : e.severity === 'medium'
                            ? 'rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200'
                            : 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200'
                      }
                    >
                      {e.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-2 text-white/75">{e.plainText}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {lastRun.outcome === 'loss' ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
            <h3 className="text-sm font-semibold tracking-wide text-white/85">
              Why the loss makes sense (cause → effect)
            </h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {effects
                .filter((effect) => effect.severity !== 'low')
                .map((effect) => (
                <div key={effect.title} className="rounded-xl bg-white/5 p-4">
                  <p className="text-sm font-medium text-white/90">{effect.title}</p>
                  <p className="mt-2 text-sm text-white/75">{effect.plainText}</p>
                </div>
                ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

