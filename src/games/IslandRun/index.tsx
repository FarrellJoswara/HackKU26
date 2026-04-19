/**
 * Self-contained Island Run. Owns every file it needs inside this folder
 * (`main.ts`, `tips.ts`, `post/`, `skydome/`, `water/`, `style.css`,
 * `assets/`). No iframe, no second Vite project, no `public/` output.
 *
 * This game mounts OUTSIDE the host R3F `<Canvas>` (see `App.tsx`) because
 * `main.ts` creates its own `WebGLRenderer`. The React shell only:
 *   1. injects the game-scoped CSS and Google Fonts on mount, removes on unmount
 *   2. renders the HUD DOM that `main.ts` wires to via `getElementById`
 *   3. calls `bootstrap()` and holds onto its cleanup closure
 */
import { useEffect, useRef } from 'react';
import { bootstrap } from './main';
import styleText from './style.css?inline';
import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import {
  BOX_PLAYER_DATA_KEYS,
  emptyAllocations,
  readAllocations,
  readNumber,
  type BudgetCategoryId,
} from '@/core/budgetTypes';
import {
  applyIslandScenarioChoice,
  isIslandScenarioChoicePayload,
} from '@/core/scenarios';
import { CAMPAIGN_KEYS } from '@/core/campaign/campaignKeys';

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600&display=swap';

export default function IslandRun() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-island-run', '');
    styleEl.textContent = styleText;
    document.head.appendChild(styleEl);

    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = FONTS_HREF;
    fontLink.setAttribute('data-island-run', '');
    document.head.appendChild(fontLink);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let cleanup: () => void = () => {};
    try {
      const initialTotalHops = readNumber(
        useAppStore.getState().playerData,
        CAMPAIGN_KEYS.islandTotalHops,
        0,
      );
      cleanup = bootstrap({
        initialTotalHops,
        // Always re-read the store so a Box edit between rolls flows
        // into the next landing's tier copy.
        getPlayerSnapshot: () => {
          const { playerData } = useAppStore.getState();
          const allocations = readAllocations(playerData) ?? emptyAllocations();
          const annualSalary = readNumber(
            playerData,
            BOX_PLAYER_DATA_KEYS.annualSalary,
            0,
          );
          const fundingRatioByCategory: Partial<Record<BudgetCategoryId, number>> = {};
          if (annualSalary > 0) {
            (Object.keys(allocations) as BudgetCategoryId[]).forEach((k) => {
              fundingRatioByCategory[k] = (allocations[k] ?? 0) / annualSalary;
            });
          }
          return { annualSalary, fundingRatioByCategory };
        },
        // Persist hop counter + emit campaign event. Bumping `campaign.year`
        // is the campaign router's job (`initCampaign.ts`).
        onLapComplete: ({ totalHops, laps }) => {
          const { mergePlayerData } = useAppStore.getState();
          mergePlayerData({
            [CAMPAIGN_KEYS.islandTotalHops]: totalHops,
          });
          eventBus.emit('island:yearComplete', { year: laps + 1, totalHops });
        },
      });
    } catch (e) {
      console.error(e);
      document.getElementById('webgl-error')?.classList.remove('hidden');
    }

    return () => {
      cleanup();
      document.body.style.overflow = prevOverflow;
      styleEl.remove();
      fontLink.remove();
      started.current = false;
    };
  }, []);

  useEffect(() => {
    return eventBus.on('island:scenarioChoice', (payload) => {
      if (!isIslandScenarioChoicePayload(payload)) return;
      const { playerData, mergePlayerData } = useAppStore.getState();
      const allocations = readAllocations(playerData) ?? emptyAllocations();
      const annualSalary = readNumber(playerData, BOX_PLAYER_DATA_KEYS.annualSalary, 0);
      const debtBalance = readNumber(
        playerData,
        BOX_PLAYER_DATA_KEYS.highInterestDebtBalance,
        0,
      );
      // Pass through pending cash so the zero-based drift target inside
      // `finalizeBoxAllocations` is `salary + pending` — otherwise an
      // Island choice fired while a windfall is still on the table would
      // silently re-absorb that pending cash into miscFun.
      const pendingCash = readNumber(
        playerData,
        BOX_PLAYER_DATA_KEYS.pendingCashToAllocate,
        0,
      );
      const { allocations: next } = applyIslandScenarioChoice({
        allocations,
        annualSalary: annualSalary > 0 ? annualSalary : undefined,
        debtBalance,
        pendingCashToAllocate: pendingCash,
        payload,
      });
      mergePlayerData({ [BOX_PLAYER_DATA_KEYS.boxAllocations]: next });
    });
  }, []);

  return (
    <>
      <a className="skip-link" href="#canvas-root">
        Skip to game board
      </a>

      <div
        id="webgl-error"
        className="webgl-error hidden"
        role="alert"
        aria-live="assertive"
      >
        <p>WebGL could not start. Try another browser or update your graphics driver.</p>
      </div>

      <main
        id="canvas-root"
        className="canvas-root"
        tabIndex={-1}
        aria-label="3D island board view"
      />

      <div id="hud" className="hud-bottle">
        <div className="hud-inner">
          <h1 className="hud-title">Island Run</h1>
          <button id="roll-btn" type="button" className="btn-shell">
            <svg
              className="btn-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="8" height="8" rx="1" />
              <rect x="13" y="3" width="8" height="8" rx="1" />
              <rect x="13" y="13" width="8" height="8" rx="1" />
              <rect x="3" y="13" width="8" height="8" rx="1" />
            </svg>
            Roll
          </button>
          <p
            id="status"
            className="status-story"
            aria-live="polite"
            aria-atomic="true"
          >
            Roll and move around the island.
          </p>
          <div className="dice-chip-wrap" id="dice-chip-wrap">
            <span id="dice-face" className="dice-face" aria-hidden="true">
              —
            </span>
            <p id="dice-readout" className="readout-dice">
              Last roll: -
            </p>
          </div>
          <p id="position-readout" className="readout-secondary">
            Square: -
          </p>

          <div
            className="progress-strip"
            role="list"
            aria-label="Progress around the board"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="progress-seg"
                role="listitem"
                data-i={i}
              />
            ))}
          </div>

          <p className="hud-hint">
            <svg
              className="hint-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            Drag to orbit · Scroll to zoom
          </p>

          <div className="hud-settings">
            <label className="hud-setting">
              <input type="checkbox" id="sound-toggle" />
              Sound
            </label>
            <label className="hud-setting">
              <input type="checkbox" id="quality-toggle" defaultChecked />
              High quality
            </label>
          </div>
        </div>
      </div>

      <div
        id="landing-overlay"
        className="landing-overlay"
        aria-hidden="true"
      >
        <div
          className="landing-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="landing-title"
          aria-describedby="landing-subtitle landing-text"
        >
          <button
            type="button"
            id="landing-dismiss"
            className="landing-dismiss"
            aria-label="Close dialog"
          >
            ×
          </button>
          <div className="landing-wave" aria-hidden="true" />
          <p id="landing-subtitle" className="landing-subtitle">
            You landed on
          </p>
          <h2 id="landing-title">Shore Fund</h2>
          <p id="landing-text" />
          <div
            id="landing-choices"
            className="landing-choices"
            role="group"
            aria-label="Choose your response"
          >
            <button
              type="button"
              id="landing-choice-a"
              className="btn-choice"
              data-choice="a"
            >
              <span className="btn-choice-label" data-role="label" />
              <span className="btn-choice-outcome" data-role="outcome" />
            </button>
            <button
              type="button"
              id="landing-choice-b"
              className="btn-choice"
              data-choice="b"
            >
              <span className="btn-choice-label" data-role="label" />
              <span className="btn-choice-outcome" data-role="outcome" />
            </button>
          </div>
          <button
            id="landing-close"
            type="button"
            className="btn-continue"
          >
            Keep going
          </button>
        </div>
      </div>
    </>
  );
}
