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
  Mountain,
  Palmtree,
  Play,
  Settings,
} from 'lucide-react';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { UIProps } from '@/core/types';
import { GAME_IDS } from '@/games/registry';
import { CAMPAIGN_KEYS } from '@/core/campaign/campaignKeys';
import { canEnterMapForCampaign } from '@/core/campaign/canEnterMapForCampaign';
import { MOCK_BUDGET_PROFILE } from '@/core/finance/mockBudgetProfile';
import { PlayModeDialog } from '../components/PlayModeDialog';
import { RewardButton } from '../components/RewardButton';
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
    // Soft Box gate: a player who finished a year but has not yet
    // submitted a fresh budget for the new year would otherwise enter
    // the Island map with stale allocations. Route them to The Box
    // instead so the Year Loop stays well-formed.
    const gate = canEnterMapForCampaign(playerData);
    if (!gate.allowed) {
      eventBus.emit('navigate:request', { to: 'budget', module: null });
      return;
    }
    eventBus.emit('navigate:request', {
      to: 'game',
      module: GAME_IDS.islandRun,
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
              <p className="th-eyebrow">Main dock</p>
              <p id="titleHubTagline" className="island-statusText th-subtitle mx-auto mt-2 max-w-md">
                Sun is up, board is set, and your next money call is waiting.
              </p>

              <div className="th-btnRow mt-8 flex flex-col gap-3 sm:gap-3.5">
                <RewardButton
                  type="button"
                  className="th-btnPlay"
                  microReward="normal"
                  aria-haspopup="dialog"
                  aria-expanded={playOpen}
                  aria-controls="play-mode-dialog"
                  onClick={() => setPlayOpen(true)}
                >
                  <Play className="size-4 shrink-0" aria-hidden />
                  Play
                </RewardButton>
                <RewardButton
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
                </RewardButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      {import.meta.env.DEV ? (
        <details className="th-devDock">
          <summary>Dev shortcuts</summary>
          <div className="island-hudBottle th-devDock__panel">
            <div className="island-hudInner flex flex-col gap-3 px-4 py-4">
                <RewardButton
                  type="button"
                  className="island-btnShell"
                  onClick={() =>
                    eventBus.emit('navigate:request', { to: 'budget', module: null })
                  }
                >
                  <LayoutGrid className="size-4" />
                  Open The Box
                </RewardButton>
                <RewardButton
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
                  Box over Island Run
                </RewardButton>
                <RewardButton
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
                </RewardButton>
                <RewardButton
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
                </RewardButton>
                <RewardButton
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
                  Debt Runner test
                </RewardButton>

                <RewardButton
                  type="button"
                  className="island-btnShell"
                  onClick={() => {
                    mergePlayerData({ 'ui:boxOverlay': false });
                    eventBus.emit('navigate:request', {
                      to: 'game',
                      module: GAME_IDS.mountainSuccess,
                    });
                  }}
                >
                  <Mountain className="size-4" />
                  Mountain Success cutscene
                </RewardButton>

                <RewardButton
                  type="button"
                  className="island-btnShell"
                  onClick={() =>
                    mergePlayerData({ [PLAYER_KEYS.islandRunHasSave]: true })
                  }
                >
                  Toggle save flag
                </RewardButton>
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
