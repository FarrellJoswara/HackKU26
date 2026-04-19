/**
 * @file Title hub — the new main menu.
 *
 * Shows the placeholder game title plus two primary actions: Play and
 * Settings. Play opens a local modal (`PlayModeDialog`) that branches
 * to Continue or New Game; both end up emitting `navigate:request`.
 */

import { useState } from 'react';
import { Play, Settings } from 'lucide-react';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { UIProps } from '@/core/types';
import { CAMPAIGN_KEYS } from '@/core/campaign/campaignKeys';
import { canEnterMapForCampaign } from '@/core/campaign/canEnterMapForCampaign';
import { PlayModeDialog } from '../components/PlayModeDialog';
import { RewardButton } from '../components/RewardButton';
import {
  GAME_TITLE_PLACEHOLDER,
  selectHasIslandRunSave,
} from '../menu/gameFlow';
import { TitleHubDecor } from '../components/TitleHubDecor';

export default function TitleHubScreen(_props: UIProps<unknown>) {
  const playerData = useAppStore((s) => s.playerData);
  const hasSave = selectHasIslandRunSave(playerData);

  const [playOpen, setPlayOpen] = useState(false);

  const handleContinue = () => {
    setPlayOpen(false);
    // Land on the Box (budget) screen rather than jumping straight into
    // Island Run. The Box visibly displays everything the persisted save
    // restores (year, salary, debt, allocations) and the campaign router
    // auto-routes Box → Island Run on re-confirm, so resuming is one
    // click away. The soft `canEnterMapForCampaign` gate requires
    // `boxReadyForYear >= currentYear`; going through the Box satisfies
    // it naturally so the Year Loop stays well-formed.
    const gate = canEnterMapForCampaign(playerData);
    if (!gate.allowed) {
      eventBus.emit('navigate:request', { to: 'budget', module: null });
      return;
    }
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
