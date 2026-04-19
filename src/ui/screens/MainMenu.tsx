/**
 * Placeholder main menu. The "Start" button asks `TransitionManager` to
 * move the app to the `template` mini-game.
 *
 * TODO: design the real menu. Add settings, leaderboard, credits, etc.
 */

import { Box, LayoutGrid, Layers, Palmtree, Footprints } from 'lucide-react';
import { eventBus } from '@/core/events';
import { GAME_IDS } from '@/games/registry';
import { useAppStore } from '@/core/store';
import type { UIProps } from '@/core/types';
import { MOCK_BUDGET_PROFILE } from '@/core/finance/mockBudgetProfile';

export default function MainMenu(_props: UIProps<unknown>) {
  const mergePlayerData = useAppStore((s) => s.mergePlayerData);

  return (
    <div className="island-pageBg absolute inset-0 flex flex-col items-center justify-center px-4 text-[var(--island-color-ink)]">
      <div className="island-hudBottle w-full max-w-xl">
        <div className="island-hudInner px-6 py-7 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--island-color-title)]/80">
            HackKU26
          </p>
          <h1 className="island-title mt-2 text-5xl">Financial Freedom</h1>
          <p className="island-statusText mx-auto mt-4 max-w-md">
            Choose a prototype lane: budget first, view the budget over Island Run, or jump
            directly into a playable scene.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <button
              className="island-btnShell"
              onClick={() => eventBus.emit('navigate:request', { to: 'budget', module: null })}
            >
              <LayoutGrid className="size-4" />
              The Box (budget)
            </button>
            <button
              className="island-btnShell"
              onClick={() => {
                mergePlayerData({ 'ui:boxOverlay': true });
                eventBus.emit('navigate:request', { to: 'game', module: GAME_IDS.islandRun });
              }}
            >
              <Layers className="size-4" />
              The Box over Island Run
            </button>
            <button
              className="island-btnShell"
              onClick={() =>
                eventBus.emit('navigate:request', {
                  to: 'game',
                  module: GAME_IDS.template,
                })
              }
            >
              <Box className="size-4" />
              Cube demo (template)
            </button>
            <button
              className="island-btnShell"
              onClick={() =>
                {
                  mergePlayerData({ 'ui:boxOverlay': false });
                  eventBus.emit('navigate:request', {
                    to: 'game',
                    module: GAME_IDS.islandRun,
                  });
                }
              }
            >
              <Palmtree className="size-4" />
              Island Run
            </button>
            <button
              className="island-btnShell"
              onClick={() => {
                mergePlayerData({ 'runner.profile': MOCK_BUDGET_PROFILE });
                eventBus.emit('navigate:request', { to: 'briefing', module: null });
              }}
            >
              <Footprints className="size-4" />
              Debt Runner (test)
            </button>
          </div>

          <div className="mt-7 border-t border-[rgba(120,90,50,0.25)] pt-4">
            <p className="island-hintText">
              Cube runs in React Three Fiber. Island Run is a self-contained
              Three.js module in{' '}
              <code className="rounded bg-black/10 px-1">src/games/IslandRun/</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
