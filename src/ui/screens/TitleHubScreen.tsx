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
  Footprints,
  Layers,
  LayoutGrid,
  Palmtree,
  Play,
  Settings,
  Sparkles,
} from 'lucide-react';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { UIProps } from '@/core/types';
import { GAME_IDS } from '@/games/registry';
import { CAMPAIGN_KEYS } from '@/core/campaign/campaignKeys';
import { BOX_PLAYER_DATA_KEYS } from '@/core/budgetTypes';
import { MOCK_BUDGET_PROFILE } from '@/core/finance/mockBudgetProfile';
import { PlayModeDialog } from '../components/PlayModeDialog';
import {
  GAME_TITLE_PLACEHOLDER,
  PLAYER_KEYS,
  selectHasIslandRunSave,
} from '../menu/gameFlow';
import { TitleHubDecor } from '../components/TitleHubDecor';

export default function TitleHubScreen(_props: UIProps<unknown>) {
  const playerData = useAppStore((s) => s.playerData);
  const mergePlayerData = useAppStore((s) => s.mergePlayerData);
  const hasSave = selectHasIslandRunSave(playerData);

  const [playOpen, setPlayOpen] = useState(false);

  const handleContinue = () => {
    setPlayOpen(false);
    // Land on the Box (budget) screen rather than jumping straight into
    // Island Run. Why:
    //
    //   1. The Box visibly displays everything the persisted save
    //      restores — current year, annual salary, high-interest debt,
    //      every category allocation. That's the most convincing "your
    //      previous game is back" UX, exactly what the user asked for.
    //   2. The campaign router (`core/campaign/initCampaign.onBoxSubmit`)
    //      already auto-routes Box → Island Run when the player
    //      re-confirms, so resuming the active session from here is one
    //      click away.
    //   3. The soft `canEnterMapForCampaign` gate requires
    //      `boxReadyForYear >= currentYear`. Going through the Box
    //      satisfies that gate naturally; jumping straight to Island Run
    //      would skip it and could leave the player on a stale gate
    //      state in production builds.
    eventBus.emit('navigate:request', {
      to: 'budget',
      module: null,
    });
  };

  const handleNewGame = () => {
    setPlayOpen(false);
    // First-ever new game on this save? Show the global onboarding beat.
    // Subsequent new games skip straight to difficulty.
    const onboarded = playerData[CAMPAIGN_KEYS.onboardingComplete] === true;
    eventBus.emit('navigate:request', {
      to: onboarded ? 'newGameDifficulty' : 'onboarding',
      module: null,
    });
  };

  return (
    <div className="th-titleHub text-[var(--island-color-ink)]">
      <TitleHubDecor />

      <div className="th-content">
        <div className="th-heroCard">
          <div className="island-hudBottle w-full">
            <div
              className="island-hudInner island-hudInner--titleHero px-6 py-8 text-center"
              role="region"
              aria-labelledby="titleHubTitle"
              aria-describedby="titleHubTagline"
            >
              <h1
                id="titleHubTitle"
                className="island-title th-titleGradient text-5xl md:text-[2.85rem]"
              >
                {GAME_TITLE_PLACEHOLDER}
              </h1>
              <div className="th-titleDivider" role="presentation" />
              <p className="th-eyebrow">Main menu</p>
              <p id="titleHubTagline" className="island-statusText th-subtitle mx-auto mt-2 max-w-md">
                Balance the Box, roll the island path, and see how your budget survives the year.
                Press Play.
              </p>

              <div className="th-btnRow mt-8 flex flex-col gap-3 sm:gap-3.5">
                <button
                  type="button"
                  className="th-btnPlay"
                  aria-haspopup="dialog"
                  aria-expanded={playOpen}
                  aria-controls="play-mode-dialog"
                  onClick={() => setPlayOpen(true)}
                >
                  <Play className="size-4 shrink-0" aria-hidden />
                  Play
                </button>
                <button
                  type="button"
                  className="th-btnSettings"
                  onClick={() =>
                    eventBus.emit('navigate:request', {
                      to: 'settings',
                      module: null,
                    })
                  }
                >
                  <Settings className="size-4 shrink-0" aria-hidden />
                  Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {import.meta.env.DEV ? (
        <details className="th-devDock">
          <summary>Developer shortcuts</summary>
          <div className="island-hudBottle th-devDock__panel">
            <div className="island-hudInner flex flex-col gap-3 px-4 py-4">
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
                      module: GAME_IDS.investingBirds,
                    })
                  }
                >
                  <Bird className="size-4" />
                  Investing Birds
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

                <button
                  type="button"
                  className="island-btnShell"
                  onClick={() => {
                    mergePlayerData({
                      [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: 0,
                      [BOX_PLAYER_DATA_KEYS.currentYear]: 6,
                      [BOX_PLAYER_DATA_KEYS.annualSalary]: 72_000,
                      [BOX_PLAYER_DATA_KEYS.boxAllocations]: {
                        rent: 20_000,
                        food: 8_000,
                        highInterestDebt: 0,
                        emergencyFund: 12_000,
                        investments: 32_000,
                      },
                      [CAMPAIGN_KEYS.year]: 6,
                      [CAMPAIGN_KEYS.investingBirdsYearsPlayed]: 3,
                    });
                    eventBus.emit('navigate:request', { to: 'finale', module: null });
                  }}
                >
                  <Sparkles className="size-4" />
                  Campaign finale (dev)
                </button>
              </div>
            </div>
        </details>
      ) : null}

      <PlayModeDialog
        dialogId="play-mode-dialog"
        open={playOpen}
        hasSave={hasSave}
        onContinue={handleContinue}
        onNewGame={handleNewGame}
        onClose={() => setPlayOpen(false)}
      />
    </div>
  );
}
