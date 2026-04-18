/**
 * Placeholder main menu. The "Start" button asks `TransitionManager` to
 * move the app to the `template` mini-game.
 *
 * TODO: design the real menu. Add settings, leaderboard, credits, etc.
 */

import { Play } from 'lucide-react';
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
          leadingIcon={<Play className="size-4" />}
          onClick={() =>
            eventBus.emit('navigate:request', {
              to: 'game',
              module: GAME_IDS.template,
            })
          }
        >
          Start Template Game
        </Button>
      </div>
    </div>
  );
}
