/**
 * @file Closes a Year Loop and routes the player to the next destination.
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
 *     `boxReadyForYear` in the close-year patch.
 *
 * On a Debt Runner *loss* we apply a small interest penalty (2% of
 * remaining balance after pay-down) so the loop has weight without
 * fully balancing the in-game economy.
 *
 * The math itself lives in `closeYear.ts` so every year-end route
 * (DebtRunner summary, Investing Birds end, Mountain Success cinematic)
 * applies the **same** state mutations. This thin shell only:
 *  - reads the current store snapshot,
 *  - merges the computed patch,
 *  - emits exactly one `navigate:request`.
 *
 * AGENTS.md: this module is core-only. No `ui` or `games` imports.
 */

import { eventBus } from '@/core/events';
import { useAppStore } from '@/core/store';
import type { AppState, ModuleId } from '@/core/types';
import {
  computeCloseYear,
  type YearAdvanceOutcome,
  type YearAdvanceSummary,
} from './closeYear';

export type { YearAdvanceOutcome, YearAdvanceSummary } from './closeYear';

/** Where to route the player once the year-close patch has been applied. */
export type YearCloseDestination = Extract<
  AppState,
  'budget' | 'menu' | 'playthroughSummary'
>;

export type AdvanceCampaignYearOptions =
  | {
      outcome: YearAdvanceOutcome;
      /**
       * Where to route after applying the close-year patch.
       *  - `'budget'` (default): straight back to The Box for next year's budget.
       *  - `'menu'`: back to the Title Hub.
       *  - `'playthroughSummary'`: post-cinematic recap shown after the
       *    Mountain Success ending.
       */
      destination?: YearCloseDestination;
    }
  | {
      outcome: YearAdvanceOutcome;
      /** Return to a `game` route — e.g. the island map after Investing Birds. */
      destination: 'game';
      module: ModuleId;
    };

/**
 * Apply year-end mechanics and route the player to the chosen destination.
 *
 * Backwards-compatible: legacy callers that passed a bare `outcome`
 * string still work and default to routing back to the budget screen.
 */
export function advanceCampaignYear(
  optsOrOutcome: AdvanceCampaignYearOptions | YearAdvanceOutcome,
): YearAdvanceSummary {
  const opts: AdvanceCampaignYearOptions =
    typeof optsOrOutcome === 'string'
      ? { outcome: optsOrOutcome }
      : optsOrOutcome;

  const { playerData, mergePlayerData } = useAppStore.getState();
  const { patch, summary } = computeCloseYear({
    playerData,
    outcome: opts.outcome,
  });

  mergePlayerData(patch);

  if ('destination' in opts && opts.destination === 'game') {
    eventBus.emit('navigate:request', {
      to: 'game',
      module: opts.module,
    });
  } else {
    const appOpts = opts as {
      outcome: YearAdvanceOutcome;
      destination?: YearCloseDestination;
    };
    const destination = appOpts.destination ?? 'budget';
    eventBus.emit('navigate:request', { to: destination, module: null });
  }

  return summary;
}
