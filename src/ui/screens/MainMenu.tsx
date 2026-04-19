/**
 * Placeholder main menu. The "Start" button asks `TransitionManager` to
 * move the app to the `template` mini-game.
 *
 * TODO: design the real menu. Add settings, leaderboard, credits, etc.
 */

import { Box, Palmtree, Target } from 'lucide-react';
import { Button } from '../components/Button';
import { eventBus } from '@/core/events';
import { GAME_IDS } from '@/games/registry';
import type { UIProps } from '@/core/types';

export default function MainMenu(_props: UIProps<unknown>) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-indigo-950 to-black text-white">
      <h1 className="text-5xl font-bold tracking-tight">HackKU26</h1>
      <p className="mt-2 text-sm tracking-widest uppercase opacity-60">
        modular webgl game scaffold
      </p>

      <div className="mt-10 flex flex-col gap-3">
        <Button
          leadingIcon={<Box className="size-4" />}
          onClick={() =>
            eventBus.emit('navigate:request', {
              to: 'game',
              module: GAME_IDS.template,
            })
          }
        >
          Cube demo (template)
        </Button>
        <Button
          leadingIcon={<Palmtree className="size-4" />}
          onClick={() =>
            eventBus.emit('navigate:request', {
              to: 'game',
              module: GAME_IDS.islandRun,
            })
          }
        >
          Island Run
        </Button>
        <Button
          leadingIcon={<Target className="size-4" />}
          onClick={() =>
            eventBus.emit('navigate:request', {
              to: 'game',
              module: GAME_IDS.investingBirds,
            })
          }
        >
          Investing Birds (MVP)
        </Button>
      </div>

      <p className="mt-8 max-w-sm text-center text-xs text-white/45">
        Cube uses React Three Fiber in this window. Island Run loads the full
        board game from <code className="rounded bg-white/10 px-1">/island-board/</code>.
      </p>
    </div>
  );
}
