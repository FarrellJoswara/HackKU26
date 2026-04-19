/**
 * Every non-start square resolves to an interactive beat from the catalog.
 * Square 0 is the Start / year-end gate (handled only in `main.ts`).
 */
import { ISLAND_SCENARIO_BEATS, ISLAND_SQUARE_BEAT_ORDER, type IslandScenarioBeat } from '@/core/scenarios';

export type LandingPayload =
  | { kind: 'passive'; body: string }
  | { kind: 'choice'; beat: IslandScenarioBeat };

export function getLandingPayload(square: number): LandingPayload {
  if (square < 1 || square > 11) {
    return {
      kind: 'passive',
      body: 'Take a breath — the tide always turns.',
    };
  }
  const beatId = ISLAND_SQUARE_BEAT_ORDER[square];
  if (!beatId) {
    return { kind: 'passive', body: 'Take a breath — the tide always turns.' };
  }
  const beat = ISLAND_SCENARIO_BEATS[beatId];
  return { kind: 'choice', beat };
}
