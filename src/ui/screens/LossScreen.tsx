/**
 * @file DebtRunner loss screen — explains fail reason, applies year-close flow,
 * and routes back into the campaign.
 */

import { useEffect } from 'react';
import { Skull, AlertTriangle, RotateCcw, ArrowRight } from 'lucide-react';
import { eventBus } from '@/core/events';
import type { UIProps } from '@/core/types';
import { Button } from '../components/Button';
import { getStoredLastRun } from '@/core/runner/RunnerResultRouter';
import { advanceCampaignYear } from '@/core/campaign/yearAdvance';
import { playLoseSfx } from '@/audio/uiSfx';

function lossTitle(failReason?: string) {
  switch (failReason) {
    case 'caught':
      return 'The Debt Collector caught you';
    case 'fall':
      return 'You slipped off the boardwalk';
    case 'noLives':
      return 'You ran out of chances';
    default:
      return 'Run ended early';
  }
}

export default function LossScreen(props: UIProps<Record<string, unknown>>) {
  const lastRun = getStoredLastRun(props.data);

  // Sad descending sting on mount. Same fire-and-forget contract as
  // WinScreen — synthesised, no asset file shipped.
  useEffect(() => {
    playLoseSfx();
  }, []);

  return (
    <div className="tropic-bg-storm absolute inset-0 overflow-hidden text-white">
      {/* Decorative storm-but-warm layers. */}
      <div className="tropic-clouds opacity-40" />
      <PalmSilhouette className="absolute bottom-0 left-0 h-[55%] opacity-95" />
      <PalmSilhouette className="absolute bottom-0 right-2 h-[45%] -scale-x-100 opacity-90" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="tropic-card-dark tropic-pop w-full max-w-xl p-7 text-center">
          <div className="mx-auto inline-flex items-center gap-3 rounded-full bg-gradient-to-b from-[#ff8b6b] to-[#b94530] px-4 py-2 text-white shadow">
            <Skull className="size-5" />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">Rough waters</span>
          </div>

          <h2
            className="mt-5 text-4xl font-semibold text-[#fff7e8]"
            style={{ fontFamily: 'var(--island-font-display)' }}
          >
            {lossTitle(lastRun?.failReason)}
          </h2>
          <p className="mt-3 text-sm text-white/80">
            {lastRun?.stats?.timeSurvivedSeconds != null
              ? `You lasted ${Math.round(lastRun.stats.timeSurvivedSeconds)} seconds. Now let's review what your budget set up.`
              : 'Open the financial recap, then try a new allocation next run.'}
          </p>

          {!lastRun ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 text-left text-sm text-white/85">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-200" />
              <p>
                No saved run data yet. Once the runner emits{' '}
                <code className="rounded bg-white/10 px-1">runner:finished</code>, this screen
                will show the full breakdown.
              </p>
            </div>
          ) : null}

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              variant="coral"
              leadingIcon={<ArrowRight className="size-4" />}
              onClick={() => advanceCampaignYear('loss')}
            >
              Continue to next year
            </Button>
            <Button
              variant="turquoise"
              leadingIcon={<RotateCcw className="size-4" />}
              onClick={() => eventBus.emit('navigate:request', { to: 'summary', module: null })}
            >
              What led to this?
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
    </div>
  );
}

function PalmSilhouette({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 360"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
      className={className}
    >
      <g fill="#000000" opacity="0.55">
        <path d="M118 360 C 110 250 100 180 122 100 L 132 100 C 150 180 140 250 134 360 Z" />
        <circle cx="118" cy="92" r="8" />
        <circle cx="132" cy="96" r="8" />
        <path d="M125 95 C 50 60 20 90 0 110 C 30 80 80 60 125 95 Z" />
        <path d="M125 95 C 200 50 230 90 240 120 C 210 80 170 60 125 95 Z" />
        <path d="M125 95 C 80 30 110 0 140 0 C 130 30 145 70 125 95 Z" />
        <path d="M125 95 C 170 130 200 130 220 145 C 180 130 150 120 125 95 Z" />
      </g>
    </svg>
  );
}
