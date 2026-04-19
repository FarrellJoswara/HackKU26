/**
 * Authored interactive scenario beats for Island Run landings.
 *
 * Each beat ships a setup line and two choices. Each choice points at a
 * **whitelisted** delta map (sparse `BudgetCategoryId` -> dollar shift)
 * that **must sum to 0** so the zero-based budget invariant is preserved.
 * The host (IslandRun React shell) is the only place that resolves
 * `(beatId, choiceId)` -> deltas, never trusting raw numbers from UI.
 */
import type { BudgetCategoryId } from '../budgetTypes';

export type IslandScenarioBeatId =
  | 'rentLeak'
  | 'medicalTherapyCancel'
  | 'transportationBrakeNoise'
  | 'foodPantryDip';

export type IslandScenarioChoiceId =
  | 'rent.leak.plumber'
  | 'rent.leak.tape'
  | 'medical.therapy.keep'
  | 'medical.therapy.cancel'
  | 'transportation.brakes.now'
  | 'transportation.brakes.defer'
  | 'food.pantry.restock'
  | 'food.pantry.delivery';

export interface IslandScenarioChoice {
  readonly id: IslandScenarioChoiceId;
  readonly label: string;
  readonly outcome: string;
}

export interface IslandScenarioBeat {
  readonly id: IslandScenarioBeatId;
  readonly category: BudgetCategoryId;
  readonly setup: string;
  readonly optionA: IslandScenarioChoice;
  readonly optionB: IslandScenarioChoice;
}

/** Sparse zero-sum dollar deltas applied to `boxAllocations` per choice. */
export const ISLAND_CHOICE_DELTAS: Record<
  IslandScenarioChoiceId,
  Partial<Record<BudgetCategoryId, number>>
> = {
  'rent.leak.plumber': { rent: 250, miscFun: -250 },
  'rent.leak.tape': { rent: -50, emergencyFund: 50 },
  'medical.therapy.keep': { medical: 120, miscFun: -120 },
  'medical.therapy.cancel': { medical: -120, miscFun: 120 },
  'transportation.brakes.now': { transportation: 200, miscFun: -200 },
  'transportation.brakes.defer': { transportation: -100, emergencyFund: 100 },
  'food.pantry.restock': { food: 80, miscFun: -80 },
  'food.pantry.delivery': { food: -60, personal: 60 },
};

export const ISLAND_SCENARIO_BEATS: Record<IslandScenarioBeatId, IslandScenarioBeat> = {
  rentLeak: {
    id: 'rentLeak',
    category: 'rent',
    setup: 'A sink pipe starts leaking tonight. Decide now before it gets expensive.',
    optionA: {
      id: 'rent.leak.plumber',
      label: 'Call a licensed plumber',
      outcome: 'Costs more tonight, but you avoid bigger repair bills later.',
    },
    optionB: {
      id: 'rent.leak.tape',
      label: 'Patch it for now',
      outcome: 'Cheaper now, and you move the difference to emergency savings.',
    },
  },
  medicalTherapyCancel: {
    id: 'medicalTherapyCancel',
    category: 'medical',
    setup: 'Work is calmer, so therapy feels easy to skip this month.',
    optionA: {
      id: 'medical.therapy.keep',
      label: 'Keep the standing copay',
      outcome: 'You stay consistent on care and trim fun spending a bit.',
    },
    optionB: {
      id: 'medical.therapy.cancel',
      label: 'Skip this month, keep the cash',
      outcome: 'You free up money now, but riskier health beats are more likely later.',
    },
  },
  transportationBrakeNoise: {
    id: 'transportationBrakeNoise',
    category: 'transportation',
    setup: 'Your brakes are squealing. The shop can fix them this weekend.',
    optionA: {
      id: 'transportation.brakes.now',
      label: 'Book the repair now',
      outcome: 'Safe and predictable: transportation goes up, fun money goes down.',
    },
    optionB: {
      id: 'transportation.brakes.defer',
      label: 'Delay it and hope',
      outcome: 'You stash cash now, but the next car problem will likely hit harder.',
    },
  },
  foodPantryDip: {
    id: 'foodPantryDip',
    category: 'food',
    setup: 'It is midweek and the pantry is empty. You need food tonight.',
    optionA: {
      id: 'food.pantry.restock',
      label: 'Do a real grocery run',
      outcome: 'Food spending rises a bit, but you cover the whole week.',
    },
    optionB: {
      id: 'food.pantry.delivery',
      label: 'Order delivery and deal with it tomorrow',
      outcome: 'Convenience fees shift to personal spending while food budget shrinks.',
    },
  },
};

export function getIslandScenarioBeat(id: IslandScenarioBeatId): IslandScenarioBeat {
  return ISLAND_SCENARIO_BEATS[id];
}

/** True when `choiceId` belongs to one of the two options on `beatId`. */
export function isChoiceForBeat(
  beatId: IslandScenarioBeatId,
  choiceId: IslandScenarioChoiceId,
): boolean {
  const beat = ISLAND_SCENARIO_BEATS[beatId];
  return beat.optionA.id === choiceId || beat.optionB.id === choiceId;
}
