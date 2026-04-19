/**
 * Financial Freedom (FI) detection.
 *
 * The campaign router calls `hasReachedFinancialFreedom(playerData)` at
 * `island:yearComplete` to decide whether to route the player to the
 * Mountain Success cinematic instead of the Investing Birds year-end
 * mini-game.
 *
 * Two conditions must hold:
 *   1. High-interest debt is paid off (balance ≤ $0.01).
 *   2. Net invested balance has reached the configured win goal.
 *
 * Both are read from `playerData` via the keys already established in
 * `boxGoalRail.ts`, so the same numbers that drive the Goal Rail's
 * "freedom phase" decide when the cinematic fires. This keeps the UI
 * progress bar and the cinematic trigger from drifting apart.
 *
 * AGENTS.md: this module is core-only. No `ui` or `games` imports.
 */

import { BOX_PLAYER_DATA_KEYS, readNumber } from '@/core/budgetTypes';
import {
  DEFAULT_WIN_GOAL_USD,
  INVESTED_BALANCE_KEY,
  WIN_GOAL_KEY,
} from '@/core/finance/boxGoalRail';

const DEBT_EPSILON_USD = 0.01;
const INVESTED_EPSILON_USD = 1e-6;

export function hasReachedFinancialFreedom(
  playerData: Record<string, unknown>,
): boolean {
  const debt = readNumber(
    playerData,
    BOX_PLAYER_DATA_KEYS.highInterestDebtBalance,
    0,
  );
  if (debt > DEBT_EPSILON_USD) return false;

  const goal = readNumber(playerData, WIN_GOAL_KEY, DEFAULT_WIN_GOAL_USD);
  if (goal <= 0) return false;

  const invested = readNumber(playerData, INVESTED_BALANCE_KEY, 0);
  return invested + INVESTED_EPSILON_USD >= goal;
}
