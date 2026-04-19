/**
 * Map Box investment sub-rows → Investing Birds normalized portfolio
 * shares (sum to 1). Pure module: no React, no `import.meta.env`, no
 * cross-package imports.
 *
 * Box `cds` is **the source of truth** when CDs ship in Birds. Until
 * the Birds CDs lane lands (`hasCdsLane: false`), `cds` dollars are
 * silently dropped from the seed — we never silently merge into bonds
 * because that would mis-state the player's chosen risk mix.
 *
 * AGENTS.md: lives in `src/core/`, so it's safe to import from `ui` or
 * `games` without violating boundary rules.
 */

import type { BudgetCategoryId } from '@/core/budgetTypes';

/** Birds-side category names. Aligned with `InvestingBirds/types.ts` LevelType. */
export type BirdsLaneId = 'stocks' | 'etfs' | 'bonds' | 'cds' | 'crypto';

export interface BoxToBirdsInput {
  allocations: Partial<Record<BudgetCategoryId, number>>;
  /** Birds gains a CDs lane in a coordinated change (`investing-birds-cds-lane`). */
  hasCdsLane: boolean;
}

export interface BirdsSeed {
  shares: Record<BirdsLaneId, number>;
  /** True iff at least one lane received a non-zero share. */
  hasInvestments: boolean;
}

/** Box row → Birds lane mapping. */
const ROW_TO_LANE: Record<'indexFunds' | 'individualStocks' | 'bonds' | 'cds' | 'crypto', BirdsLaneId> = {
  indexFunds: 'etfs',
  individualStocks: 'stocks',
  bonds: 'bonds',
  cds: 'cds',
  crypto: 'crypto',
};

function safe(n: number | undefined): number {
  return Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0;
}

export function buildBirdsSeed(input: BoxToBirdsInput): BirdsSeed {
  const a = input.allocations;
  const raw: Record<BirdsLaneId, number> = {
    etfs: safe(a.indexFunds),
    stocks: safe(a.individualStocks),
    bonds: safe(a.bonds),
    cds: safe(a.cds),
    crypto: safe(a.crypto),
  };

  if (!input.hasCdsLane && raw.cds > 0) {
    raw.cds = 0;
  }

  const total = raw.etfs + raw.stocks + raw.bonds + raw.cds + raw.crypto;
  if (total <= 0) {
    return {
      shares: { etfs: 0, stocks: 0, bonds: 0, cds: 0, crypto: 0 },
      hasInvestments: false,
    };
  }

  const shares: Record<BirdsLaneId, number> = {
    etfs: raw.etfs / total,
    stocks: raw.stocks / total,
    bonds: raw.bonds / total,
    cds: raw.cds / total,
    crypto: raw.crypto / total,
  };

  // Tiny float drift can leave the sum at 0.9999... — push it onto
  // whichever lane already has the largest share so consumers can
  // assert exact `=== 1` if they want to.
  const sum = shares.etfs + shares.stocks + shares.bonds + shares.cds + shares.crypto;
  const drift = 1 - sum;
  if (Math.abs(drift) > 1e-9) {
    let largest: BirdsLaneId = 'etfs';
    let largestVal = -Infinity;
    (Object.keys(shares) as BirdsLaneId[]).forEach((k) => {
      if (shares[k] > largestVal) {
        largestVal = shares[k];
        largest = k;
      }
    });
    shares[largest] += drift;
  }

  // Reference table-driven mapping so the lint pass keeps it next to
  // changes — touching one mapping forces a thought about the other.
  void ROW_TO_LANE;

  return { shares, hasInvestments: true };
}
