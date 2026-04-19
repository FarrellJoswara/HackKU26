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
    setup: 'A leak opens under the sink on a Tuesday night. Time to decide before the cabinet warps.',
    optionA: {
      id: 'rent.leak.plumber',
      label: 'Call a licensed plumber',
      outcome: 'Pricey tonight, but no mold lecture later. Rent line goes up; fun line goes down.',
    },
    optionB: {
      id: 'rent.leak.tape',
      label: 'Tape, towels, and hope',
      outcome: 'Cheap right now; you stash the saved cash in the emergency fund for the next round.',
    },
  },
  medicalTherapyCancel: {
    id: 'medicalTherapyCancel',
    category: 'medical',
    setup: 'Work calmed down; therapy feels optional this month.',
    optionA: {
      id: 'medical.therapy.keep',
      label: 'Keep the standing copay',
      outcome: 'Maintenance over crisis. Medical line stays funded; fun line trims a little.',
    },
    optionB: {
      id: 'medical.therapy.cancel',
      label: 'Cancel for now, save the cash',
      outcome: 'You free up fun money this month. Future "bad" beats are more likely.',
    },
  },
  transportationBrakeNoise: {
    id: 'transportationBrakeNoise',
    category: 'transportation',
    setup: 'Brakes squeal; the shop quotes pads and rotors this weekend.',
    optionA: {
      id: 'transportation.brakes.now',
      label: 'Schedule the repair this weekend',
      outcome: 'Boring, planned, safe. Transit line goes up; fun line takes the hit.',
    },
    optionB: {
      id: 'transportation.brakes.defer',
      label: 'Turn the radio up for a few weeks',
      outcome: 'You skim cash into emergency fund. The next car beat is going to bite.',
    },
  },
  foodPantryDip: {
    id: 'foodPantryDip',
    category: 'food',
    setup: 'Wednesday and the pantry is bare. Convenience apps are screaming at you.',
    optionA: {
      id: 'food.pantry.restock',
      label: 'Real grocery run on the way home',
      outcome: 'Food line bumps a little; you eat the whole week from one trip.',
    },
    optionB: {
      id: 'food.pantry.delivery',
      label: 'Order delivery tonight, deal tomorrow',
      outcome: 'Fees move to "personal" as a convenience tax; food line trims.',
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
