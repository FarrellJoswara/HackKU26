/**
 * One-shot onboarding beat shown before "New Game" the first time the
 * player launches the game. Either action (Continue or Skip) sets the
 * `onboardingComplete` flag so it never reappears for that save.
 *
 * Architecture:
 *  - DOM-only React (AGENTS.md): no R3F, no game imports.
 *  - Sets the flag once via `mergePlayerData`, then asks the
 *    TransitionManager to navigate to `newGameDifficulty`.
 */

import { ArrowRight, Sparkles } from 'lucide-react';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { UIProps } from '@/core/types';
import { CAMPAIGN_KEYS } from '@/core/campaign/campaignKeys';
import { TitleHubDecor } from '../components/TitleHubDecor';

export default function OnboardingScreen(_props: UIProps<Record<string, unknown>>) {
  const mergePlayerData = useAppStore((s) => s.mergePlayerData);

  const finish = () => {
    mergePlayerData({ [CAMPAIGN_KEYS.onboardingComplete]: true });
    eventBus.emit('navigate:request', {
      to: 'newGameDifficulty',
      module: null,
    });
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
              aria-labelledby="onboardingTitle"
            >
              <p className="th-eyebrow th-menuEyebrow">Welcome aboard</p>
              <h1
                id="onboardingTitle"
                className="island-title th-titleGradient mt-1 text-3xl md:text-[2rem]"
              >
                Balance the Box. Sail the year.
              </h1>
              <div className="th-titleDivider th-menuDivider" role="presentation" />

              <ol className="island-statusText mt-4 grid gap-3 text-sm leading-relaxed sm:text-base">
                <li>
                  <span className="font-semibold text-[var(--island-color-title)]">1. The Box.</span>{' '}
                  Give every dollar a job before you set sail. Zero-based means nothing gets
                  lost in the shuffle.
                </li>
                <li>
                  <span className="font-semibold text-[var(--island-color-title)]">2. The Island.</span>{' '}
                  Roll, move, and face the square you land on. Each stop tests how your budget
                  handles real life.
                </li>
                <li>
                  <span className="font-semibold text-[var(--island-color-title)]">3. The Year-end run.</span>{' '}
                  Finish a full lap to close the year. Your numbers decide what comes next.
                </li>
              </ol>

              <p className="island-hintText mt-5 text-sm">
                You can revisit this later from the menu. Warnings are nudges, not blockers -
                Confirm only needs a balanced plan.
              </p>

              <div className="th-menuActions mt-8">
                <button type="button" className="th-btnSettings" onClick={finish}>
                  Skip
                </button>
                <button type="button" className="th-btnPlay" onClick={finish}>
                  <Sparkles className="size-4 shrink-0" aria-hidden />
                  Continue
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
