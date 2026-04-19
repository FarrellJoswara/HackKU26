/**
 * One-time DebtRunner tutorial — explains controls and the goal before
 * the first run. Only shown when:
 *   - The campaign router routed here for year-end (debt > 0), AND
 *   - `playerData.debtRunner.tutorialSeen` is falsy.
 *
 * The campaign router (`initCampaign.ts`) decides which screen to send
 * the player to; this screen just handles the "Got it → briefing" hop.
 */

import { ArrowRight, KeyRound, Target } from 'lucide-react';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { UIProps } from '@/core/types';
import { DEBT_RUNNER_KEYS } from '@/core/campaign/campaignKeys';
import { TitleHubDecor } from '../components/TitleHubDecor';

export default function DebtRunnerTutorialScreen(_props: UIProps<Record<string, unknown>>) {
  const mergePlayerData = useAppStore((s) => s.mergePlayerData);

  const continueToBriefing = () => {
    mergePlayerData({ [DEBT_RUNNER_KEYS.tutorialSeen]: true });
    eventBus.emit('navigate:request', { to: 'briefing', module: null });
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
              aria-labelledby="debtTutorialTitle"
            >
              <p className="th-eyebrow th-menuEyebrow">Year-end - Debt Runner</p>
              <h1
                id="debtTutorialTitle"
                className="island-title th-titleGradient mt-1 text-3xl md:text-[2rem]"
              >
                Keep the collector behind you.
              </h1>
              <div className="th-titleDivider th-menuDivider" role="presentation" />

              <p className="island-statusText mt-3 max-w-xl">
                Your debt is still ahead of your payments this year. The collector is on your tail.
                Survive the run to chip that balance down.
              </p>

              <div className="grid gap-3 sm:grid-cols-2 mt-6">
                <div className="island-paperCard rounded-2xl p-4">
                  <p className="flex items-center gap-2 font-medium text-[var(--island-color-title)]">
                    <KeyRound className="size-4" aria-hidden /> Controls
                  </p>
                  <ul className="island-statusText mt-2 space-y-1 text-sm">
                    <li><span className="font-mono">A / D</span> or <span className="font-mono">←/→</span> — change lane</li>
                    <li><span className="font-mono">Space</span> / <span className="font-mono">↑</span> / <span className="font-mono">W</span> — jump</li>
                    <li><span className="font-mono">Esc</span> — pause</li>
                  </ul>
                </div>
                <div className="island-paperCard rounded-2xl p-4">
                  <p className="flex items-center gap-2 font-medium text-[var(--island-color-title)]">
                    <Target className="size-4" aria-hidden /> Win condition
                  </p>
                  <p className="island-statusText mt-2 text-sm">
                    Let the timer expire before you lose all lives or get caught. Strong budgets
                    grant more lives, softer hazards, and a slower collector.
                  </p>
                </div>
              </div>

              <div className="th-menuActions mt-8">
                <button type="button" className="th-btnPlay" onClick={continueToBriefing}>
                  Got it
                  <ArrowRight className="size-4 shrink-0" aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
