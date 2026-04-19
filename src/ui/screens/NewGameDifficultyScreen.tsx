/**
 * Difficulty picker shown after the user chooses "New Game" from the
 * title hub's Play modal. Stores the choice in `playerData` and
 * navigates into the game.
 */

import { useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { UIProps } from '@/core/types';
import { GAME_IDS } from '@/games/registry';
import { DifficultySelect } from '../components/DifficultySelect';
import {
  PLAYER_KEYS,
  selectIslandRunDifficulty,
  type DifficultyId,
} from '../menu/gameFlow';

export default function NewGameDifficultyScreen(
  props: UIProps<Record<string, unknown>>,
) {
  const mergePlayerData = useAppStore((s) => s.mergePlayerData);

  const [selected, setSelected] = useState<DifficultyId>(() =>
    selectIslandRunDifficulty(props.data),
  );

  const handleCreate = () => {
    mergePlayerData({
      [PLAYER_KEYS.islandRunDifficulty]: selected,
      [PLAYER_KEYS.islandRunHasSave]: false,
    });
    eventBus.emit('navigate:request', {
      to: 'game',
      module: GAME_IDS.islandRun,
    });
  };

  const handleBack = () => {
    eventBus.emit('navigate:request', { to: 'menu', module: null });
  };

  return (
    <div className="island-pageBg absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-10">
        <div className="island-hudBottle">
          <div className="island-hudInner px-6 py-7">
            <header className="flex flex-col gap-3 border-b border-[rgba(120,90,50,0.2)] pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--island-color-title)]/80">
                  New Game
                </p>
                <h1 className="island-title mt-1 text-3xl">Choose a difficulty</h1>
                <p className="island-statusText mt-3 max-w-md text-sm">
                  Difficulty controls pacing and resources for this run.
                  You can change it later by starting a new game.
                </p>
              </div>
              <button
                type="button"
                className="island-btnShell shrink-0"
                onClick={handleBack}
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
            </header>

            <div className="mt-6">
              <DifficultySelect value={selected} onChange={setSelected} />
            </div>

            <footer className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="island-btnShell"
                onClick={handleBack}
              >
                Cancel
              </button>
              <button
                type="button"
                className="island-btnShell"
                onClick={handleCreate}
              >
                <Sparkles className="size-4" />
                Create
              </button>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
