/**
 * Maps the player's most recent Box budget submission to the four
 * Investing Birds portfolio categories.
 *
 * The Box stores five investment subcategories (Index Funds / Individual
 * Stocks / Bonds / CDs / Crypto) but the game only has four towers — so
 * CDs are folded into Bonds (both are fixed-income, locked-rate vehicles
 * that read the same way to the player). Index Funds map to ETFs (the
 * game's broad-market tower), and Individual Stocks / Crypto pass through.
 *
 * Architecture (AGENTS.md):
 *  - Pure helper, no React, no Zustand store access.
 *  - The game (`src/games/InvestingBirds/`) and the host shell
 *    (`src/App.tsx`) both read from this module so they cannot drift.
 */

import {
  BOX_PLAYER_DATA_KEYS,
  type BudgetCategoryId,
} from '@/core/budgetTypes';
import type { Allocation } from './types';

function readDollars(
  allocations: Partial<Record<BudgetCategoryId, number>>,
  id: BudgetCategoryId,
): number {
  const v = allocations[id];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Build the game's `Allocation` (four categories, percent shares 0..100
 * summing to 100) from the Box's investment-subcategory dollar amounts.
 *
 * Returns `null` when the player has not submitted a Box yet, or when the
 * investment side is empty (e.g. they still have high-interest debt and
 * the Investments tab is locked). Callers should fall back to the in-game
 * ALLOCATE panel in that case.
 */
export function selectInvestingBirdsAllocation(
  playerData: Record<string, unknown>,
): Allocation | null {
  const raw = playerData[BOX_PLAYER_DATA_KEYS.boxAllocations];
  if (!raw || typeof raw !== 'object') return null;
  const allocations = raw as Partial<Record<BudgetCategoryId, number>>;

  const stocksUsd = readDollars(allocations, 'individualStocks');
  const etfsUsd = readDollars(allocations, 'indexFunds');
  // CDs (locked-rate savings) read the same way to the player as bonds, so
  // we collapse them into the Bonds tower rather than dropping the dollars.
  const bondsUsd =
    readDollars(allocations, 'bonds') + readDollars(allocations, 'cds');
  const cryptoUsd = readDollars(allocations, 'crypto');

  const total = stocksUsd + etfsUsd + bondsUsd + cryptoUsd;
  if (total <= 0) return null;

  // The game's slider UI uses 0..100 percentages and just normalizes by
  // the sum internally, so converting dollars to integer percent shares
  // (rounded) is the natural fit. Tiny rounding drift is fine — the FSM
  // re-derives shares via `shareOf`.
  const pct = (usd: number): number => Math.round((usd / total) * 100);
  return {
    stocks: pct(stocksUsd),
    etfs: pct(etfsUsd),
    bonds: pct(bondsUsd),
    crypto: pct(cryptoUsd),
  };
}
