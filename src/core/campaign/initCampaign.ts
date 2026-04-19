/**
 * Campaign event glue. Subscribes **once** at module import to:
 *
 *  - `box:budget:submit` — derives `runner.profile`, sets the soft map
 *    gate flag, and (when applicable) routes the player back to the
 *    Island map for the year.
 *  - `island:yearComplete` — routes the player to the right year-end
 *    mini-game (DebtRunner if `highInterestDebtBalance > 0`, else
 *    Investing Birds). One-time DebtRunner tutorial flag is checked here.
 *
 * Why module-level instead of a React `useEffect`?
 *  - StrictMode mounts effects twice in dev — that would register the
 *    subscriber twice and double every navigation / write. The bus only
 *    de-duplicates by exact handler reference, so we keep one stable
 *    handler in module scope and call `initCampaign()` exactly once
 *    from `main.tsx`. Subsequent calls are no-ops.
 *  - An in-flight flag guards against re-entrant `island:yearComplete`
 *    emits while a transition animation is mid-flight.
 */

import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import {
  BOX_DEFAULTS,
  BOX_PLAYER_DATA_KEYS,
  readNumber,
} from '@/core/budgetTypes';
import type { BoxBudgetSubmitPayload } from '@/core/budgetTypes';
import type { EventMap } from '@/core/types';
import { allocationsToBudgetProfile } from '@/core/finance/allocationsToBudgetProfile';
import { CAMPAIGN_KEYS, DEBT_RUNNER_KEYS } from './campaignKeys';
import { hasReachedFinancialFreedom } from './financialFreedom';
import { GAME_IDS } from '@/games/registry';

let initialized = false;
let yearEndInFlight = false;

export function initCampaign(): void {
  if (initialized) return;
  initialized = true;

  eventBus.on('box:budget:submit', onBoxSubmit);
  eventBus.on('island:yearComplete', onYearComplete);
}

/** Test-only reset. Not exported from `index.ts`. */
export function __resetCampaignForTests(): void {
  initialized = false;
  yearEndInFlight = false;
}

function onBoxSubmit(payload: BoxBudgetSubmitPayload): void {
  // Derived profile so DebtRunner / Briefing read from real Box data.
  const profile = allocationsToBudgetProfile({
    allocations: payload.allocations,
    annualSalary: payload.annualSalary,
  });
  const { appState, mergePlayerData } = useAppStore.getState();
  mergePlayerData({
    'runner.profile': profile,
    [CAMPAIGN_KEYS.boxReadyForYear]: payload.year,
    [CAMPAIGN_KEYS.boxSubmittedAtMs]: Date.now(),
    // Submit consumed any pending one-shot cash; mirror the UI write so
    // a future logic refactor that drops the UI-side merge still works.
    [BOX_PLAYER_DATA_KEYS.pendingCashToAllocate]: 0,
  });
  // Auto-advance to the Island map when the player submitted from the
  // standalone Box screen (campaign path). When submitted from the
  // overlay above an existing Island session, no navigation needed —
  // the player is already on the map.
  if (appState === 'budget') {
    eventBus.emit('navigate:request', {
      to: 'game',
      module: GAME_IDS.islandRun,
    });
  }
}

function onYearComplete(_payload: EventMap['island:yearComplete']): void {
  if (yearEndInFlight) return;
  yearEndInFlight = true;

  const { playerData } = useAppStore.getState();
  const debtBalance = readNumber(
    playerData,
    BOX_PLAYER_DATA_KEYS.highInterestDebtBalance,
    BOX_DEFAULTS.highInterestDebtBalance,
  );

  // NOTE: do NOT bump `campaign.year` here. Year progression is owned
  // by `advanceCampaignYear` (the unified close-year pipeline) so the
  // counter cannot drift from `currentYear` based on which year-end
  // route the player took.

  if (debtBalance > 0.01) {
    const tutorialSeen = playerData[DEBT_RUNNER_KEYS.tutorialSeen] === true;
    eventBus.emit('navigate:request', {
      to: tutorialSeen ? 'briefing' : 'debtRunnerTutorial',
      module: null,
    });
  } else if (hasReachedFinancialFreedom(playerData)) {
    // Debt-free AND invested balance has crossed the win goal — play
    // the Mountain Success cinematic instead of routing into another
    // year-end mini-game. The cinematic auto-returns to the Title Hub.
    eventBus.emit('navigate:request', {
      to: 'game',
      module: GAME_IDS.mountainSuccess,
    });
  } else {
    eventBus.emit('navigate:request', {
      to: 'game',
      module: GAME_IDS.investingBirds,
    });
  }

  // Release the in-flight latch on the next tick so a subsequent
  // genuine `island:yearComplete` (e.g. after returning to the map)
  // can re-arm. Re-entrant emits in the *same* tick are still ignored.
  queueMicrotask(() => {
    yearEndInFlight = false;
  });
}
