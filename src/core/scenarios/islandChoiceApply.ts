/**
 * @file Resolve a player choice into a sanitized `boxAllocations` patch.
 *
 * The IslandRun React shell calls `applyIslandScenarioChoice` after
 * receiving an `island:scenarioChoice` event from the imperative game
 * loop. This module is the only place numbers move; the game itself
 * never touches `playerData`.
 */
import type { BudgetCategoryId } from '../budgetTypes';
import { finalizeBoxAllocations } from './boxAllocationsFinalize';
import {
  ISLAND_CHOICE_DELTAS,
  isChoiceForBeat,
  type IslandScenarioBeatId,
  type IslandScenarioChoiceId,
} from './islandChoiceCatalog';

export interface IslandScenarioChoicePayload {
  /** Schema version; bump when payload shape changes. */
  v: 1;
  beatId: IslandScenarioBeatId;
  choiceId: IslandScenarioChoiceId;
}

export function isIslandScenarioChoicePayload(
  value: unknown,
): value is IslandScenarioChoicePayload {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    o.v === 1 &&
    typeof o.beatId === 'string' &&
    typeof o.choiceId === 'string' &&
    isChoiceForBeat(
      o.beatId as IslandScenarioBeatId,
      o.choiceId as IslandScenarioChoiceId,
    )
  );
}

export interface ApplyIslandChoiceArgs {
  allocations: Record<BudgetCategoryId, number>;
  annualSalary?: number;
  debtBalance?: number;
  /** Outstanding cash awaiting re-allocation; passed through to finalizer. */
  pendingCashToAllocate?: number;
  payload: IslandScenarioChoicePayload;
}

export interface ApplyIslandChoiceResult {
  allocations: Record<BudgetCategoryId, number>;
  appliedDeltas: Partial<Record<BudgetCategoryId, number>>;
}

export function applyIslandScenarioChoice({
  allocations,
  annualSalary,
  debtBalance,
  pendingCashToAllocate,
  payload,
}: ApplyIslandChoiceArgs): ApplyIslandChoiceResult {
  const deltas = ISLAND_CHOICE_DELTAS[payload.choiceId] ?? {};
  const next: Record<BudgetCategoryId, number> = { ...allocations };

  for (const key of Object.keys(deltas) as BudgetCategoryId[]) {
    const d = deltas[key] ?? 0;
    next[key] = (next[key] ?? 0) + d;
  }

  return {
    allocations: finalizeBoxAllocations({
      allocations: next,
      annualSalary,
      debtBalance,
      pendingCashToAllocate,
    }),
    appliedDeltas: deltas,
  };
}
