/**
 * Closes a Year Loop and routes the player back to The Box for the next
 * year's budget.
 *
 * Per `GAME_DESIGN.md` §"The Core Game Loop (Per Year)":
 *
 *   - Each loop = one year. The year-end mini-game (DebtRunner /
 *     Investing Birds) runs **once** at lap-complete.
 *   - When the loop closes, **leftover dollars in the High-Interest Debt
 *     allocation** automatically reduce `highInterestDebtBalance` (capped
 *     at $0).
 *   - The player must then re-open The Box and submit a fresh
 *     zero-based budget for year N+1 before they can roll again — that
 *     is the soft `canEnterMapForCampaign` gate, re-armed by clearing
 *     `boxReadyForYear` here.
 *
 * On a Debt Runner *loss* we apply a small interest penalty (2% of
 * remaining balance after pay-down) so the loop has weight without
 * fully balancing the in-game economy — the full Year Controller will
 * own that math later.
 *
 * Pure with respect to inputs (`playerData` + outcome) and side-effects
 * are restricted to one `mergePlayerData` write + one navigate event.
 * The function returns a structured summary so the calling screen can
 * surface what changed if it ever wants to.
 *
 * AGENTS.md: this module is core-only. No `ui` or `games` imports.
 */

import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import {
  BOX_DEFAULTS,
  BOX_PLAYER_DATA_KEYS,
  readNumber,
} from '@/core/budgetTypes';
import { CAMPAIGN_KEYS } from './campaignKeys';

const LOSS_INTEREST_PENALTY = 0.02; // 2% of remaining balance on a runner loss

export type YearAdvanceOutcome = 'win' | 'loss' | 'skipped';

export interface YearAdvanceSummary {
  /** Year the player just finished. */
  fromYear: number;
  /** Year the player is now budgeting for. */
  toYear: number;
  /** Debt before any year-end adjustment. */
  debtBeforeUsd: number;
  /** Dollars pulled from the High-Interest Debt allocation toward payoff. */
  debtPaidUsd: number;
  /** Extra interest added because the runner was lost. */
  interestPenaltyUsd: number;
  /** Final running debt balance for next year. */
  debtAfterUsd: number;
}

/**
 * Apply year-end mechanics and route the player back to The Box.
 *
 * @param outcome `win` / `loss` of the year-end mini-game, or `skipped`
 *                when the player bypassed it (debt-free → no DebtRunner).
 */
export function advanceCampaignYear(outcome: YearAdvanceOutcome): YearAdvanceSummary {
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

  const allocations =
    (playerData[BOX_PLAYER_DATA_KEYS.boxAllocations] as Record<string, number> | undefined) ?? {};
  const debtAlloc = Math.max(0, allocations['highInterestDebt'] ?? 0);
  const debtPaid = Math.min(debtAlloc, debtBefore);

  let nextDebt = Math.max(0, debtBefore - debtPaid);

  let interestPenalty = 0;
  if (outcome === 'loss' && nextDebt > 0) {
    interestPenalty = nextDebt * LOSS_INTEREST_PENALTY;
    nextDebt += interestPenalty;
  }

  mergePlayerData({
    [BOX_PLAYER_DATA_KEYS.currentYear]: toYear,
    [CAMPAIGN_KEYS.year]: toYear,
    [BOX_PLAYER_DATA_KEYS.highInterestDebtBalance]: Math.round(nextDebt * 100) / 100,
    // Re-arm the soft Box gate: the player must submit a fresh zero-based
    // budget for the new year before the map will let them roll.
    [CAMPAIGN_KEYS.boxReadyForYear]: 0,
  });

  // Send them straight to The Box for next year's budget. The Box's own
  // `box:budget:submit` handler in `initCampaign.ts` will then advance
  // them to Island Run for the year.
  eventBus.emit('navigate:request', { to: 'budget', module: null });

  return {
    fromYear,
    toYear,
    debtBeforeUsd: Math.round(debtBefore * 100) / 100,
    debtPaidUsd: Math.round(debtPaid * 100) / 100,
    interestPenaltyUsd: Math.round(interestPenalty * 100) / 100,
    debtAfterUsd: Math.round(nextDebt * 100) / 100,
  };
}
