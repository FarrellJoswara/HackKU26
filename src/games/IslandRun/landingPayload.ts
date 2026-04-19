/**
 * Decide whether a board square presents a **passive vignette** (today's
 * `getBoardLandingScenarioBody` text) or an **interactive beat** with two
 * choices. Interactive beats are pulled from the shared core catalog and
 * shown via the landing overlay's `landing-choices` group.
 *
 * The mapping here is intentionally tiny and deterministic; it picks the
 * first beat whose category matches the square's primary category, so a
 * given square always offers the same beat for replay reasoning.
 */
import {
  ISLAND_SCENARIO_BEATS,
  type IslandScenarioBeat,
  type BudgetCategoryId,
} from '@/core/scenarios';
import { SQUARE_PRIMARY_CATEGORY, getBoardLandingScenarioBody } from './boardScenarioLanding';

export type LandingPayload =
  | { kind: 'passive'; body: string }
  | { kind: 'choice'; beat: IslandScenarioBeat };

function findBeatForCategory(category: BudgetCategoryId): IslandScenarioBeat | null {
  for (const beat of Object.values(ISLAND_SCENARIO_BEATS)) {
    if (beat.category === category) return beat;
  }
  return null;
}

export function getLandingPayload(
  square: number,
  fundingRatioByCategory?: Partial<Record<BudgetCategoryId, number>>,
): LandingPayload {
  const cat = SQUARE_PRIMARY_CATEGORY[square] ?? 'personal';
  const beat = findBeatForCategory(cat);
  if (beat) return { kind: 'choice', beat };
  return { kind: 'passive', body: getBoardLandingScenarioBody(square, fundingRatioByCategory) };
}
