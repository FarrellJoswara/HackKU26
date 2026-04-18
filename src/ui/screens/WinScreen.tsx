import { Trophy } from 'lucide-react';
import { eventBus } from '@/core/events';
import type { UIProps } from '@/core/types';
import { Button } from '../components/Button';
import { getStoredLastRun } from '@/core/runner/RunnerResultRouter';

export default function WinScreen(props: UIProps<Record<string, unknown>>) {
  const lastRun = getStoredLastRun(props.data);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-emerald-950 via-slate-950 to-black text-white">
      <div className="mx-4 w-full max-w-xl rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/15 p-3 text-emerald-200">
            <Trophy className="size-6" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">You made it.</h2>
            <p className="mt-1 text-sm text-white/70">
              Survived the run{lastRun?.stats?.timeSurvivedSeconds != null
                ? ` (${Math.round(lastRun.stats.timeSurvivedSeconds)}s)`
                : ''}
              .
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => eventBus.emit('navigate:request', { to: 'summary', module: null })}
          >
            See what your budget caused
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

