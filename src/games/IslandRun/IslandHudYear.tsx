/**
 * @file Small HUD chip showing the active campaign year (mirrors Box / campaign keys).
 */

import { useAppStore } from '@/core/store';
import { CAMPAIGN_KEYS } from '@/core/campaign/campaignKeys';
import { BOX_DEFAULTS, BOX_PLAYER_DATA_KEYS, readNumber } from '@/core/budgetTypes';

/**
 * Live campaign year for the Island HUD (mirrors Box `currentYear` when synced).
 */
export function IslandHudYear() {
  const y = useAppStore((s) => {
    const cy = readNumber(
      s.playerData,
      BOX_PLAYER_DATA_KEYS.currentYear,
      BOX_DEFAULTS.currentYear,
    );
    return readNumber(s.playerData, CAMPAIGN_KEYS.year, cy);
  });
  return (
    <p className="hud-year-chip" aria-live="polite">
      <span className="hud-year-eyebrow">Year</span>{' '}
      <span className="hud-year-num">{y}</span>
    </p>
  );
}
