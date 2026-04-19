import { Skull, AlertTriangle } from 'lucide-react';
import { eventBus } from '@/core/events';
import type { UIProps } from '@/core/types';
import { Button } from '../components/Button';
import { getStoredLastRun } from '@/core/runner/RunnerResultRouter';

function lossTitle(failReason?: string) {
  switch (failReason) {
    case 'caught':
      return 'Caught by the Debt Collector';
    case 'fall':
      return 'You fell off the path';
    case 'noLives':
      return 'No lives left';
    default:
      return 'Run over';
  }
}

export default function LossScreen(props: UIProps<Record<string, unknown>>) {
  const lastRun = getStoredLastRun(props.data);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-rose-950 via-slate-950 to-black text-white">
      <div className="mx-4 w-full max-w-xl rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-rose-500/15 p-3 text-rose-200">
            <Skull className="size-6" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {lossTitle(lastRun?.failReason)}
            </h2>
            <p className="mt-1 text-sm text-white/70">
              {lastRun?.stats?.timeSurvivedSeconds != null
                ? `You lasted ${Math.round(lastRun.stats.timeSurvivedSeconds)} seconds.`
                : 'Review what happened and what your budget set up.'}
            </p>
          </div>
        </div>

        {!lastRun ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-200" />
            <p>
              No saved run data yet. Once the runner module emits a{' '}
              <code className="rounded bg-white/10 px-1">runner:finished</code> event,
              this screen will show a concrete breakdown.
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => eventBus.emit('navigate:request', { to: 'summary', module: null })}
          >
            What caused this?
          </Button>
          <Button
            variant="ghost"
            onClick={() => eventBus.emit('navigate:request', { to: 'menu', module: null })}
          >
            Back to menu
          </Button>
        </div>
      </div>
    </div>
  );
}

