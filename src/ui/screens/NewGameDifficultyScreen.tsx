/**
 * Difficulty picker shown after the user chooses "New Game" from the
 * title hub's Play modal. Stores the choice in `playerData` and
 * navigates into the game.
 *
 * Visual shell matches the title hub (photo + layers + glass card).
 */

import { useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { UIProps } from '@/core/types';
import { GAME_IDS } from '@/games/registry';
import { TitleHubDecor } from '../components/TitleHubDecor';
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
    <div className="th-titleHub th-menuScreen absolute inset-0 overflow-y-auto text-[var(--island-color-ink)]">
      <TitleHubDecor />

      <div className="th-content">
        <div className="th-heroCard">
          <div className="island-hudBottle w-full">
            <div
              className="island-hudInner island-hudInner--titleHero px-6 py-8 text-left sm:px-8"
              role="region"
              aria-labelledby="thDiffTitle"
              aria-describedby="thDiffDesc"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="th-eyebrow th-menuEyebrow">New game</p>
                  <h1
                    id="thDiffTitle"
                    className="island-title th-titleGradient mt-1 text-3xl md:text-[2rem]"
                  >
                    Choose a difficulty
                  </h1>
                </div>
                <button type="button" className="th-btnSettings shrink-0" onClick={handleBack}>
                  <ArrowLeft className="size-4 shrink-0" aria-hidden />
                  Back
                </button>
              </div>

              <div className="th-titleDivider th-menuDivider" role="presentation" />

              <p id="thDiffDesc" className="island-statusText th-subtitle mt-3 max-w-xl">
                Difficulty controls pacing and resources for this run. You can change it later by
                starting a new game.
              </p>

              <div className="mt-6">
                <DifficultySelect value={selected} onChange={setSelected} />
              </div>

              <div className="th-menuActions">
                <button type="button" className="th-btnSettings" onClick={handleBack}>
                  Cancel
                </button>
                <button type="button" className="th-btnPlay" onClick={handleCreate}>
                  <Sparkles className="size-4 shrink-0" aria-hidden />
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
