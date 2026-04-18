/**
 * Placeholder main menu. The "Start" button asks `TransitionManager` to
 * move the app to the `template` mini-game.
 *
 * TODO: design the real menu. Add settings, leaderboard, credits, etc.
 */

import { Waves, Play, Compass, Sparkles } from 'lucide-react';
import { Button } from '../components/Button';
import { eventBus } from '@/core/events';
import type { UIProps } from '@/core/types';
import { useAppStore } from '@/core/store';
import { MOCK_BUDGET_PROFILE } from '@/core/finance/mockBudgetProfile';
import { GAME_IDS } from '@/games/registry';

export default function MainMenu(_props: UIProps<unknown>) {
  const mergePlayerData = useAppStore((s) => s.mergePlayerData);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-sky-600 via-cyan-900 to-slate-950 text-white">
      <h1 className="text-5xl font-bold tracking-tight">Debt Tide Runner</h1>
      <p className="mt-2 text-sm tracking-widest uppercase opacity-70">
        survive the coast. outrun debt.
      </p>

      <div className="mt-10 grid w-full max-w-4xl gap-4 px-4 md:grid-cols-3">
        <div className="rounded-2xl border border-cyan-200/30 bg-black/30 p-4 backdrop-blur">
          <p className="text-xs tracking-wider uppercase text-cyan-100/70">Featured</p>
          <h2 className="mt-2 text-lg font-semibold">DebtRunner</h2>
          <p className="mt-2 text-sm text-white/75">
            Endless run where your budget profile directly changes hazard difficulty.
          </p>
          <Button
            className="mt-4 w-full justify-center"
            leadingIcon={<Play className="size-4" />}
            onClick={() => {
              mergePlayerData({ 'runner.profile': MOCK_BUDGET_PROFILE });
              eventBus.emit('navigate:request', { to: 'briefing', module: null });
            }}
          >
            Launch DebtRunner
          </Button>
        </div>

        <div className="rounded-2xl border border-white/15 bg-black/25 p-4 backdrop-blur">
          <p className="text-xs tracking-wider uppercase text-white/60">Arcade</p>
          <h2 className="mt-2 text-lg font-semibold">Template Game</h2>
          <p className="mt-2 text-sm text-white/70">Quick test scene and baseline controls.</p>
          <Button
            className="mt-4 w-full justify-center"
            variant="ghost"
            leadingIcon={<Sparkles className="size-4" />}
            onClick={() => eventBus.emit('navigate:request', { to: 'game', module: GAME_IDS.template })}
          >
            Launch Template
          </Button>
        </div>

        <div className="rounded-2xl border border-white/15 bg-black/25 p-4 backdrop-blur">
          <p className="text-xs tracking-wider uppercase text-white/60">Board Run</p>
          <h2 className="mt-2 text-lg font-semibold">Island Run</h2>
          <p className="mt-2 text-sm text-white/70">Standalone island board sprint experience.</p>
          <Button
            className="mt-4 w-full justify-center"
            variant="ghost"
            leadingIcon={<Compass className="size-4" />}
            onClick={() => eventBus.emit('navigate:request', { to: 'game', module: GAME_IDS.islandRun })}
          >
            Launch Island Run
          </Button>
        </div>
      </div>

      <p className="mt-8 flex items-center gap-2 text-xs text-white/65">
        <Waves className="size-4" />
        Budget profile is loaded first, then translated into gameplay consequences.
      </p>
    </div>
  );
}
