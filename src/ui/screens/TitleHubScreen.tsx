/**
 * Title hub — the new main menu.
 *
 * Shows the placeholder game title plus two primary actions: Play and
 * Settings. Play opens a local modal (`PlayModeDialog`) that branches
 * to Continue or New Game; both end up emitting `navigate:request`.
 *
 * Developer shortcuts (the prototypes that used to live in MainMenu)
 * appear only when `import.meta.env.DEV`, so production builds stay
 * clean without disturbing teammates' workflows.
 */

import { useState } from 'react';
import {
  Bird,
  Box,
  Feather,
  Footprints,
  Layers,
  LayoutGrid,
  Palmtree,
  Play,
  Settings,
} from 'lucide-react';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { UIProps } from '@/core/types';
import { GAME_IDS } from '@/games/registry';
import { MOCK_BUDGET_PROFILE } from '@/core/finance/mockBudgetProfile';
import { PlayModeDialog } from '../components/PlayModeDialog';
import {
  GAME_TITLE_PLACEHOLDER,
  PLAYER_KEYS,
  selectHasIslandRunSave,
} from '../menu/gameFlow';

export default function TitleHubScreen(_props: UIProps<unknown>) {
  const playerData = useAppStore((s) => s.playerData);
  const mergePlayerData = useAppStore((s) => s.mergePlayerData);
  const hasSave = selectHasIslandRunSave(playerData);

  const [playOpen, setPlayOpen] = useState(false);

  const handleContinue = () => {
    setPlayOpen(false);
    eventBus.emit('navigate:request', {
      to: 'game',
      module: GAME_IDS.islandRun,
    });
  };

  const handleNewGame = () => {
    setPlayOpen(false);
    eventBus.emit('navigate:request', {
      to: 'newGameDifficulty',
      module: null,
    });
  };

  return (
    <div className="island-pageBg absolute inset-0 flex flex-col items-center justify-center px-4 text-[var(--island-color-ink)]">
      <div className="island-hudBottle w-full max-w-xl">
        <div className="island-hudInner px-6 py-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--island-color-title)]/80">
            HackKU26
          </p>
          <h1 className="island-title mt-2 text-5xl">{GAME_TITLE_PLACEHOLDER}</h1>
          <p className="island-statusText mx-auto mt-4 max-w-md">
            A modular WebGL hackathon adventure. Press Play to begin.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              className="island-btnShell"
              onClick={() => setPlayOpen(true)}
            >
              <Play className="size-4" />
              Play
            </button>
            <button
              type="button"
              className="island-btnShell"
              onClick={() =>
                eventBus.emit('navigate:request', {
                  to: 'settings',
                  module: null,
                })
              }
            >
              <Settings className="size-4" />
              Settings
            </button>
            <button
              type="button"
              className="island-btnShell"
              onClick={() =>
                eventBus.emit('navigate:request', {
                  to: 'game',
                  module: GAME_IDS.investingBirds2,
                })
              }
            >
              <Feather className="size-4" />
              Investing Birds 2
            </button>
          </div>
        </div>
      </div>

      {import.meta.env.DEV ? (
        <details className="mt-6 w-full max-w-xl">
          <summary className="cursor-pointer text-center text-xs uppercase tracking-[0.22em] text-[var(--island-color-ink-muted)]">
            Developer shortcuts
          </summary>
          <div className="island-hudBottle mt-3">
            <div className="island-hudInner flex flex-col gap-3 px-6 py-5">
              <button
                type="button"
                className="island-btnShell"
                onClick={() =>
                  eventBus.emit('navigate:request', { to: 'budget', module: null })
                }
              >
                <LayoutGrid className="size-4" />
                The Box (budget)
              </button>
              <button
                type="button"
                className="island-btnShell"
                onClick={() => {
                  mergePlayerData({ 'ui:boxOverlay': true });
                  eventBus.emit('navigate:request', {
                    to: 'game',
                    module: GAME_IDS.islandRun,
                  });
                }}
              >
                <Layers className="size-4" />
                The Box over Island Run
              </button>
              <button
                type="button"
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
                type="button"
                className="island-btnShell"
                onClick={() =>
                  eventBus.emit('navigate:request', {
                    to: 'game',
                    module: GAME_IDS.investingBirds3,
                  })
                }
              >
                <Bird className="size-4" />
                Investing Birds 3
              </button>
              <button
                type="button"
                className="island-btnShell"
                onClick={() => {
                  mergePlayerData({ 'ui:boxOverlay': false });
                  eventBus.emit('navigate:request', {
                    to: 'game',
                    module: GAME_IDS.islandRun,
                  });
                }}
              >
                <Palmtree className="size-4" />
                Island Run
              </button>
              <button
                type="button"
                className="island-btnShell"
                onClick={() => {
                  mergePlayerData({ 'runner.profile': MOCK_BUDGET_PROFILE });
                  eventBus.emit('navigate:request', {
                    to: 'briefing',
                    module: null,
                  });
                }}
              >
                <Footprints className="size-4" />
                Debt Runner (test)
              </button>

              <button
                type="button"
                className="island-btnShell"
                onClick={() =>
                  mergePlayerData({ [PLAYER_KEYS.islandRunHasSave]: true })
                }
              >
                Toggle save flag (debug)
              </button>
            </div>
          </div>
        </details>
      ) : null}

      <PlayModeDialog
        open={playOpen}
        hasSave={hasSave}
        onContinue={handleContinue}
        onNewGame={handleNewGame}
        onClose={() => setPlayOpen(false)}
      />
    </div>
  );
}
