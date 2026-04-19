/**
 * Campaign event glue. Subscribes **once** at module import to:
 *
 *  - `box:budget:submit` — derives `runner.profile`, sets the soft map
 *    gate flag, and (when applicable) routes the player back to the
 *    Island map for the year.
 *  - `island:yearComplete` — routes the player to the right year-end
 *    mini-game (DebtRunner if `highInterestDebtBalance > 0`, else
 *    Investing Birds up to three times, else campaign finale).
 *  - `game:result` — when Investing Birds was launched from a lap,
 *    closes the year and returns to Island.
 *
 * Year counters (`currentYear`, `campaign.year`) advance in
 * `advanceCampaignYear` / the Birds result handler, not on
 * `island:yearComplete` emit.
 */

import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import {
  BOX_DEFAULTS,
  BOX_PLAYER_DATA_KEYS,
  readNumber,
} from '@/core/budgetTypes';
import type { BoxBudgetSubmitPayload } from '@/core/budgetTypes';
import type { EventMap, GameEvent } from '@/core/types';
import { allocationsToBudgetProfile } from '@/core/finance/allocationsToBudgetProfile';
import { CAMPAIGN_KEYS, DEBT_RUNNER_KEYS } from './campaignKeys';
import { GAME_IDS } from '@/games/registry';

let initialized = false;
let yearEndInFlight = false;

export function initCampaign(): void {
  if (initialized) return;
  initialized = true;

  eventBus.on('box:budget:submit', onBoxSubmit);
  eventBus.on('island:yearComplete', onYearComplete);
  eventBus.on('game:result', onGameResult);
}

/** Test-only reset. Not exported from `index.ts`. */
export function __resetCampaignForTests(): void {
  initialized = false;
  yearEndInFlight = false;
}

function onBoxSubmit(payload: BoxBudgetSubmitPayload): void {
  const profile = allocationsToBudgetProfile({
    allocations: payload.allocations,
    annualSalary: payload.annualSalary,
  });
  const { appState, mergePlayerData, playerData } = useAppStore.getState();
  const initialDebtSnap = playerData[CAMPAIGN_KEYS.initialHighInterestDebt];
  mergePlayerData({
    'runner.profile': profile,
    [CAMPAIGN_KEYS.boxReadyForYear]: payload.year,
    [CAMPAIGN_KEYS.boxSubmittedAtMs]: Date.now(),
    [BOX_PLAYER_DATA_KEYS.pendingCashToAllocate]: 0,
    ...(initialDebtSnap === undefined || initialDebtSnap === null
      ? {
          [CAMPAIGN_KEYS.initialHighInterestDebt]: Math.max(
            0,
            payload.highInterestDebtBalanceAtSubmit,
          ),
        }
      : {}),
  });
  if (appState === 'budget') {
    eventBus.emit('navigate:request', {
      to: 'game',
      module: GAME_IDS.islandRun,
    });
  }
}

function isInvestingBirdsResultPayload(p: unknown): boolean {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    (o.outcome === 'win' || o.outcome === 'loss') &&
    typeof o.score === 'number' &&
    typeof o.levelsCleared === 'number' &&
    o.scoreByType !== null &&
    typeof o.scoreByType === 'object'
  );
}

function onGameResult(evt: GameEvent<unknown>): void {
  if (evt.kind !== 'result') return;
  if (!isInvestingBirdsResultPayload(evt.payload)) return;

  const { playerData, mergePlayerData } = useAppStore.getState();
  if (playerData[CAMPAIGN_KEYS.yearEndBirdsPending] !== true) return;

  const played = readNumber(playerData, CAMPAIGN_KEYS.investingBirdsYearsPlayed, 0);
  const fromYear = readNumber(
    playerData,
    BOX_PLAYER_DATA_KEYS.currentYear,
    BOX_DEFAULTS.currentYear,
  );
  const toYear = fromYear + 1;

  mergePlayerData({
    [CAMPAIGN_KEYS.yearEndBirdsPending]: false,
    [CAMPAIGN_KEYS.investingBirdsYearsPlayed]: Math.min(3, played + 1),
    [BOX_PLAYER_DATA_KEYS.currentYear]: toYear,
    [CAMPAIGN_KEYS.year]: toYear,
    [CAMPAIGN_KEYS.boxReadyForYear]: toYear,
  });

  eventBus.emit('navigate:request', {
    to: 'game',
    module: GAME_IDS.islandRun,
  });
}

function onYearComplete(_payload: EventMap['island:yearComplete']): void {
  if (yearEndInFlight) return;
  yearEndInFlight = true;

  const { playerData, mergePlayerData } = useAppStore.getState();
  const debtBalance = readNumber(
    playerData,
    BOX_PLAYER_DATA_KEYS.highInterestDebtBalance,
    BOX_DEFAULTS.highInterestDebtBalance,
  );

  const investingPlayed = readNumber(playerData, CAMPAIGN_KEYS.investingBirdsYearsPlayed, 0);

  if (debtBalance > 0.01) {
    mergePlayerData({ [CAMPAIGN_KEYS.yearEndBirdsPending]: false });
    const tutorialSeen = playerData[DEBT_RUNNER_KEYS.tutorialSeen] === true;
    eventBus.emit('navigate:request', {
      to: tutorialSeen ? 'briefing' : 'debtRunnerTutorial',
      module: null,
    });
  } else if (investingPlayed >= 3) {
    const fromYear = readNumber(
      playerData,
      BOX_PLAYER_DATA_KEYS.currentYear,
      BOX_DEFAULTS.currentYear,
    );
    const toYear = fromYear + 1;
    mergePlayerData({
      [CAMPAIGN_KEYS.yearEndBirdsPending]: false,
      [BOX_PLAYER_DATA_KEYS.currentYear]: toYear,
      [CAMPAIGN_KEYS.year]: toYear,
      [CAMPAIGN_KEYS.boxReadyForYear]: toYear,
    });
    eventBus.emit('navigate:request', {
      to: 'finale',
      module: null,
    });
  } else {
    mergePlayerData({
      [CAMPAIGN_KEYS.yearEndBirdsPending]: true,
    });
    eventBus.emit('navigate:request', {
      to: 'game',
      module: GAME_IDS.investingBirds,
    });
  }

  queueMicrotask(() => {
    yearEndInFlight = false;
  });
}
