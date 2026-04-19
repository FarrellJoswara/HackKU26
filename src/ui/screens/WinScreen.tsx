import { Trophy, Sun } from 'lucide-react';
import { eventBus } from '@/core/events';
import type { UIProps } from '@/core/types';
import { Button } from '../components/Button';
import { getStoredLastRun } from '@/core/runner/RunnerResultRouter';

export default function WinScreen(props: UIProps<Record<string, unknown>>) {
  const lastRun = getStoredLastRun(props.data);

  return (
    <div className="tropic-bg-sunset absolute inset-0 overflow-hidden">
      {/* Decorative tropical layers — sun, drifting clouds, palm silhouette. */}
      <div className="tropic-sun" style={{ top: '8%', right: '12%' }} />
      <div className="tropic-clouds" />
      <PalmSilhouette className="absolute bottom-0 left-0 h-[55%] opacity-90" />
      <PalmSilhouette className="absolute bottom-0 right-2 h-[45%] -scale-x-100 opacity-80" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="tropic-card tropic-pop w-full max-w-xl p-7 text-center">
          <div className="mx-auto inline-flex items-center gap-3 rounded-full bg-gradient-to-b from-[#ffe7a8] to-[#f59f3a] px-4 py-2 text-[#4a3514] shadow">
            <Trophy className="size-5" />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">You made it</span>
          </div>

          <h2
            className="mt-5 text-4xl font-semibold text-[#1a4d5c]"
            style={{ fontFamily: 'var(--island-font-display)' }}
          >
            Sunset over the boardwalk
          </h2>
          <p className="mt-3 text-sm text-[#3d3428]/85">
            You survived the run
            {lastRun?.stats?.timeSurvivedSeconds != null
              ? ` (${Math.round(lastRun.stats.timeSurvivedSeconds)}s)`
              : ''}
            . The Debt Collector is back at the pier — for now.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              variant="coral"
              leadingIcon={<Sun className="size-4" />}
              onClick={() => eventBus.emit('navigate:request', { to: 'summary', module: null })}
            >
              See what your budget caused
            </Button>
            <Button
              variant="turquoise"
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

// Inline palm-tree silhouette so we don't need an asset file.
function PalmSilhouette({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 360"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
      className={className}
    >
      <g fill="#0e2a36" opacity="0.85">
        {/* Trunk */}
        <path d="M118 360 C 110 250 100 180 122 100 L 132 100 C 150 180 140 250 134 360 Z" />
        {/* Coconuts */}
        <circle cx="118" cy="92" r="8" />
        <circle cx="132" cy="96" r="8" />
        {/* Palm leaves */}
        <path d="M125 95 C 50 60 20 90 0 110 C 30 80 80 60 125 95 Z" />
        <path d="M125 95 C 200 50 230 90 240 120 C 210 80 170 60 125 95 Z" />
        <path d="M125 95 C 80 30 110 0 140 0 C 130 30 145 70 125 95 Z" />
        <path d="M125 95 C 170 130 200 130 220 145 C 180 130 150 120 125 95 Z" />
      </g>
    </svg>
  );
}
