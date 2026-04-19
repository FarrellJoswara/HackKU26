/**
 * Closes a Year Loop after DebtRunner and routes the player onward.
 *
 * Campaign path (HackKU26): DebtRunner **win** trims high-interest debt by
 * ~20%; **loss** leaves the balance unchanged (no interest penalty). The
 * player returns to **Island Run** for the next lap instead of mandatory
 * The Box (they may still open the overlay to edit allocations).
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

const DEBT_WIN_MULTIPLIER = 0.8;

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
  /** Debt removed by the win rule (20% of pre-adjustment balance). */
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

  let nextDebt = debtBefore;
  let debtReductionFromWin = 0;

  if (outcome === 'win' && debtBefore > 0) {
    nextDebt = Math.round(debtBefore * DEBT_WIN_MULTIPLIER * 100) / 100;
    debtReductionFromWin = Math.round((debtBefore - nextDebt) * 100) / 100;
  } else if (outcome === 'loss') {
    nextDebt = debtBefore;
  } else {
    nextDebt = debtBefore;
  }

  nextDebt = Math.max(0, nextDebt);

  const boxReadyValue = navigateTo === 'island' ? toYear : 0;

  mergePlayerData({
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
