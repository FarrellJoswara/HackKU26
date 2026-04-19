/**
 * Soft gate: can the player enter the Island map for the *campaign* path?
 *
 * Pure function — no React, no store import. Reads a snapshot of
 * `playerData` so it is trivial to unit test and to call from a router.
 *
 * Rules:
 *  1. DEV builds (`import.meta.env.DEV`) always allow entry — keeps the
 *     game easy to demo.
 *  2. Explicit `playerData['campaign.bypassBoxGate'] === true` always
 *     allows entry (QA / dev shortcut).
 *  3. Otherwise the player must have submitted a valid Box budget for
 *     the current `currentYear` (signalled by `campaign.boxReadyForYear`
 *     >= `currentYear`).
 */

import {
  BOX_DEFAULTS,
  BOX_PLAYER_DATA_KEYS,
  readNumber,
} from '@/core/budgetTypes';
import { CAMPAIGN_KEYS } from './campaignKeys';

export interface CanEnterMapResult {
  allowed: boolean;
  reason: 'devBuild' | 'bypassFlag' | 'budgetFresh' | 'needsBudget';
}

export interface CanEnterMapOptions {
  /** Override `import.meta.env.DEV` for tests. */
  isDev?: boolean;
}

export function canEnterMapForCampaign(
  data: Record<string, unknown>,
  opts: CanEnterMapOptions = {},
): CanEnterMapResult {
  const isDev = opts.isDev ?? (typeof import.meta !== 'undefined' && import.meta.env?.DEV === true);
  if (isDev) return { allowed: true, reason: 'devBuild' };
  if (data[CAMPAIGN_KEYS.bypassBoxGate] === true) {
    return { allowed: true, reason: 'bypassFlag' };
  }
  const currentYear = readNumber(
    data,
    BOX_PLAYER_DATA_KEYS.currentYear,
    BOX_DEFAULTS.currentYear,
  );
  const boxReady = readNumber(data, CAMPAIGN_KEYS.boxReadyForYear, 0);
  if (boxReady >= currentYear) {
    return { allowed: true, reason: 'budgetFresh' };
  }
  return { allowed: false, reason: 'needsBudget' };
}
