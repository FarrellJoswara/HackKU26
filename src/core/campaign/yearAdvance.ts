/**
 * Closes a Year Loop after DebtRunner and routes the player onward.
 *
 * Campaign path: DebtRunner **win** pays down **one quarter of the
 * campaign’s initial high-interest debt** (snapshot in
 * `campaign.initialHighInterestDebt`), capped at the current balance, so
 * each win feels like a predictable chunk (~$2.5k on a $10k starter debt).
 * **Loss** leaves debt unchanged (no interest penalty). The player returns
 * to **Island Run** by default.
 *
 * `navigateTo: 'budget'` remains for tooling / legacy callers.
 *
 * AGENTS.md: core-only. No `ui` or `games` imports.
 */

import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import {
  BOX_DEFAULTS,
  BOX_PLAYER_DATA_KEYS,
  readNumber,
} from '@/core/budgetTypes';
import { CAMPAIGN_KEYS } from './campaignKeys';
import { GAME_IDS } from '@/games/registry';

/** Each DebtRunner win shaves this fraction of the **initial** campaign debt. */
const DEBT_WIN_SLICE_OF_INITIAL = 0.25;

export type YearAdvanceOutcome = 'win' | 'loss' | 'skipped';

export type YearAdvanceNavigateTarget = 'island' | 'budget';

export interface AdvanceCampaignYearOptions {
  /** Where to send the player after merging year + debt state. */
  navigateTo?: YearAdvanceNavigateTarget;
}

export interface YearAdvanceSummary {
  /** Year the player just finished. */
  fromYear: number;
  /** Year the player is now playing. */
  toYear: number;
  /** Debt before any year-end adjustment. */
  debtBeforeUsd: number;
  /** Debt removed by the win rule (quarter of initial, capped at balance). */
  debtReductionFromWinUsd: number;
  /** Legacy field — kept 0 (interest penalty removed for campaign). */
  interestPenaltyUsd: number;
  /** Final running debt balance for next year. */
  debtAfterUsd: number;
}

/**
 * Apply year-end mechanics after DebtRunner and navigate.
 *
 * @param outcome `win` / `loss` of DebtRunner, or `skipped` (unused today).
 */
export function advanceCampaignYear(
  outcome: YearAdvanceOutcome,
  opts: AdvanceCampaignYearOptions = {},
): YearAdvanceSummary {
  const navigateTo: YearAdvanceNavigateTarget = opts.navigateTo ?? 'island';
  const { playerData, mergePlayerData } = useAppStore.getState();

  const fromYear = readNumber(
    playerData,
    BOX_PLAYER_DATA_KEYS.currentYear,
    BOX_DEFAULTS.currentYear,
  );
  const toYear = fromYear + 1;

  const debtBefore = readNumber(
    playerData,
    BOX_PLAYER_DATA_KEYS.highInterestDebtBalance,
    BOX_DEFAULTS.highInterestDebtBalance,
  );

  const storedInitial = readNumber(playerData, CAMPAIGN_KEYS.initialHighInterestDebt, 0);
  const baselineInitial =
    Number.isFinite(storedInitial) && storedInitial > 0 ? storedInitial : debtBefore;
  const chunkUsd =
    baselineInitial > 0
      ? Math.round(baselineInitial * DEBT_WIN_SLICE_OF_INITIAL * 100) / 100
      : 0;

  let nextDebt = debtBefore;
  let debtReductionFromWin = 0;

  if (outcome === 'win' && debtBefore > 0 && chunkUsd > 0) {
    debtReductionFromWin = Math.min(debtBefore, chunkUsd);
    nextDebt = Math.round((debtBefore - debtReductionFromWin) * 100) / 100;
  } else if (outcome === 'loss') {
    nextDebt = debtBefore;
  } else {
    nextDebt = debtBefore;
  }

  nextDebt = Math.max(0, nextDebt);

  const boxReadyValue = navigateTo === 'island' ? toYear : 0;

  const persistInitialSnapshot =
    !(Number.isFinite(storedInitial) && storedInitial > 0) && debtBefore > 0
      ? { [CAMPAIGN_KEYS.initialHighInterestDebt]: debtBefore }
      : {};

  mergePlayerData({
    ...persistInitialSnapshot,
    [BOX_PLAYER_DATA_KEYS.currentYear]: toYear,
    [CAMPAIGN_KEYS.year]: toYear,
    [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: nextDebt,
    [CAMPAIGN_KEYS.boxReadyForYear]: boxReadyValue,
  });

  if (navigateTo === 'island') {
    eventBus.emit('navigate:request', {
      to: 'game',
      module: GAME_IDS.islandRun,
    });
  } else {
    eventBus.emit('navigate:request', { to: 'budget', module: null });
  }

  return {
    fromYear,
    toYear,
    debtBeforeUsd: Math.round(debtBefore * 100) / 100,
    debtReductionFromWinUsd: debtReductionFromWin,
    interestPenaltyUsd: 0,
    debtAfterUsd: Math.round(nextDebt * 100) / 100,
  };
}
