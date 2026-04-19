/**
 * Authored interactive scenario beats for Island Run landings.
 *
 * Each beat ships a setup line and 2–3 choices. Each choice points at a
 * **whitelisted** delta map (sparse `BudgetCategoryId` -> dollar shift)
 * that **must sum to 0** so the zero-based budget invariant is preserved.
 */
import type { BudgetCategoryId } from '../budgetTypes';

export type IslandScenarioBeatId =
  | 'rentLeak'
  | 'medicalTherapyCancel'
  | 'transportationBrakeNoise'
  | 'foodPantryDip'
  | 'garageWindfall'
  | 'parkingTicket'
  | 'subscriptionCreep'
  | 'skillCourseWin'
  | 'cryptoFomoTrap'
  | 'employerMatchBoost'
  | 'deductibleDice'
  | 'rentRoommate'
  | 'sideHustleFlip'
  | 'medicalBillShock'
  | 'autoLeaseUpsell';

export type IslandScenarioChoiceId =
  | 'rent.leak.plumber'
  | 'rent.leak.tape'
  | 'medical.therapy.keep'
  | 'medical.therapy.cancel'
  | 'transportation.brakes.now'
  | 'transportation.brakes.defer'
  | 'food.pantry.restock'
  | 'food.pantry.delivery'
  | 'garage.sell.furniture'
  | 'garage.donate.receipt'
  | 'garage.skip'
  | 'ticket.pay.now'
  | 'ticket.payment.plan'
  | 'sub.cancel.half'
  | 'sub.keep.all'
  | 'sub.audit.strict'
  | 'skill.bootcamp'
  | 'skill.youtube'
  | 'skill.wait'
  | 'crypto.small.spec'
  | 'crypto.walk.away'
  | 'crypto.fomo.allin'
  | 'match.raise401k'
  | 'match.statusquo'
  | 'match.catchup'
  | 'deductible.high.plan'
  | 'deductible.low.plan'
  | 'deductible.mid'
  | 'rent.roommate.yes'
  | 'rent.alone.no'
  | 'rent.split.utilities'
  | 'hustle.weekend.shift'
  | 'hustle.sell.gear'
  | 'hustle.rest'
  | 'medical.urgent.care'
  | 'medical.er.now'
  | 'medical.wait'
  | 'lease.keep.premium'
  | 'lease.downgrade'
  | 'lease.buyout';

export interface IslandScenarioChoice {
  readonly id: IslandScenarioChoiceId;
  readonly label: string;
  readonly outcome: string;
}

export interface IslandScenarioBeat {
  readonly id: IslandScenarioBeatId;
  readonly category: BudgetCategoryId;
  /** When true, UI may show a subtle positive frame. */
  readonly tone?: 'good' | 'bad' | 'mixed';
  readonly setup: string;
  readonly optionA: IslandScenarioChoice;
  readonly optionB: IslandScenarioChoice;
  readonly optionC?: IslandScenarioChoice;
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
  'garage.sell.furniture': { emergencyFund: 400, miscFun: -400 },
  'garage.donate.receipt': { miscFun: -120, personal: 120 },
  'garage.skip': { miscFun: 40, emergencyFund: -40 },
  'ticket.pay.now': { transportation: -180, highInterestDebt: 180 },
  'ticket.payment.plan': { transportation: -60, miscFun: -40, emergencyFund: 100 },
  'sub.cancel.half': { miscFun: 90, personal: -90 },
  'sub.keep.all': { miscFun: -75, personal: 75 },
  'sub.audit.strict': { miscFun: 50, food: -25, personal: -25 },
  'skill.bootcamp': { personal: -500, emergencyFund: 500 },
  'skill.youtube': { personal: -40, miscFun: 40 },
  'skill.wait': { emergencyFund: -80, miscFun: 80 },
  'crypto.small.spec': { investments: 200, miscFun: -200 },
  'crypto.walk.away': { emergencyFund: 100, miscFun: -100 },
  'crypto.fomo.allin': { investments: -350, highInterestDebt: 350 },
  'match.raise401k': { investments: 300, food: -150, miscFun: -150 },
  'match.statusquo': {},
  'match.catchup': { investments: 150, rent: -150 },
  'deductible.high.plan': { medical: -40, emergencyFund: 40 },
  'deductible.low.plan': { medical: 90, miscFun: -90 },
  'deductible.mid': { medical: 30, transportation: -30 },
  'rent.roommate.yes': { rent: -280, miscFun: 280 },
  'rent.alone.no': { rent: 120, emergencyFund: -120 },
  'rent.split.utilities': { rent: -90, food: -30, miscFun: 120 },
  'hustle.weekend.shift': { miscFun: 220, personal: -220 },
  'hustle.sell.gear': { emergencyFund: 180, personal: -180 },
  'hustle.rest': { miscFun: -60, emergencyFund: 60 },
  'medical.urgent.care': { medical: 160, miscFun: -160 },
  'medical.er.now': { medical: 420, emergencyFund: -420 },
  'medical.wait': { medical: -90, miscFun: 90 },
  'lease.keep.premium': { transportation: 140, miscFun: -140 },
  'lease.downgrade': { transportation: -110, emergencyFund: 110 },
  'lease.buyout': { transportation: 300, highInterestDebt: -300 },
};

export const ISLAND_SCENARIO_BEATS: Record<IslandScenarioBeatId, IslandScenarioBeat> = {
  rentLeak: {
    id: 'rentLeak',
    category: 'rent',
    tone: 'mixed',
    setup: 'A leak opens under the sink on a Tuesday night. Time to decide before the cabinet warps.',
    optionA: {
      id: 'rent.leak.plumber',
      label: 'Call a licensed plumber (+$250 rent / −$250 fun)',
      outcome: 'Pricey tonight, but no mold lecture later.',
    },
    optionB: {
      id: 'rent.leak.tape',
      label: 'Tape, towels, and hope (−$50 rent / +$50 emergency)',
      outcome: 'Cheap right now; you stash the saved cash in the emergency fund.',
    },
  },
  medicalTherapyCancel: {
    id: 'medicalTherapyCancel',
    category: 'medical',
    tone: 'mixed',
    setup: 'Work calmed down; therapy feels optional this month.',
    optionA: {
      id: 'medical.therapy.keep',
      label: 'Keep the standing copay (+$120 medical / −$120 fun)',
      outcome: 'Maintenance over crisis.',
    },
    optionB: {
      id: 'medical.therapy.cancel',
      label: 'Cancel for now (−$120 medical / +$120 fun)',
      outcome: 'You free up fun money this month.',
    },
  },
  transportationBrakeNoise: {
    id: 'transportationBrakeNoise',
    category: 'transportation',
    tone: 'mixed',
    setup: 'Brakes squeal; the shop quotes pads and rotors this weekend.',
    optionA: {
      id: 'transportation.brakes.now',
      label: 'Fix this weekend (+$200 transit / −$200 fun)',
      outcome: 'Boring, planned, safe.',
    },
    optionB: {
      id: 'transportation.brakes.defer',
      label: 'Defer a few weeks (−$100 transit / +$100 emergency)',
      outcome: 'You skim cash into emergency fund.',
    },
  },
  foodPantryDip: {
    id: 'foodPantryDip',
    category: 'food',
    tone: 'mixed',
    setup: 'Wednesday and the pantry is bare. Convenience apps are screaming at you.',
    optionA: {
      id: 'food.pantry.restock',
      label: 'Grocery run (+$80 food / −$80 fun)',
      outcome: 'Food line bumps; you eat the whole week from one trip.',
    },
    optionB: {
      id: 'food.pantry.delivery',
      label: 'Delivery tonight (−$60 food / +$60 personal)',
      outcome: 'Fees move to personal as a convenience tax.',
    },
  },
  garageWindfall: {
    id: 'garageWindfall',
    category: 'emergencyFund',
    tone: 'good',
    setup: 'Sunlight weekend: neighbors want your unused desk, bike, and lamp.',
    optionA: {
      id: 'garage.sell.furniture',
      label: 'Price to sell (+$400 emergency / −$400 fun)',
      outcome: 'Cash lands in the emergency fund.',
    },
    optionB: {
      id: 'garage.donate.receipt',
      label: 'Donate for write-off potential (−$120 fun / +$120 personal)',
      outcome: 'You favor tax paperwork over cash today.',
    },
    optionC: {
      id: 'garage.skip',
      label: 'Skip the hassle (+$40 fun / −$40 emergency)',
      outcome: 'You keep the clutter but protect weekend peace.',
    },
  },
  parkingTicket: {
    id: 'parkingTicket',
    category: 'transportation',
    tone: 'bad',
    setup: 'Bright envelope on the windshield — downtown meter expired.',
    optionA: {
      id: 'ticket.pay.now',
      label: 'Pay online today (−$180 transit / +$180 debt)',
      outcome: 'You shuffle dollars toward the toxic stack to stay legal.',
    },
    optionB: {
      id: 'ticket.payment.plan',
      label: 'Split hit across buckets (−$60 transit / −$40 fun / +$100 emergency)',
      outcome: 'Smaller pain now, thinner cushions later.',
    },
  },
  subscriptionCreep: {
    id: 'subscriptionCreep',
    category: 'miscFun',
    tone: 'bad',
    setup: 'Five streaming tiers quietly renewed the same week.',
    optionA: {
      id: 'sub.cancel.half',
      label: 'Cancel half (+$90 fun / −$90 personal)',
      outcome: 'You claw back fun money from phantom apps.',
    },
    optionB: {
      id: 'sub.keep.all',
      label: 'Keep everything (−$75 fun / +$75 personal)',
      outcome: 'Convenience wins; personal absorbs the creep.',
    },
    optionC: {
      id: 'sub.audit.strict',
      label: 'Hard audit (+$50 fun / −$25 food / −$25 personal)',
      outcome: 'You trim snacks and apps together.',
    },
  },
  skillCourseWin: {
    id: 'skillCourseWin',
    category: 'personal',
    tone: 'good',
    setup: 'A cohort opens for a certificate your manager keeps mentioning.',
    optionA: {
      id: 'skill.bootcamp',
      label: 'Enroll (−$500 personal / +$500 emergency)',
      outcome: 'You borrow from cash cushions to fund a raise path.',
    },
    optionB: {
      id: 'skill.youtube',
      label: 'Self-study only (−$40 personal / +$40 fun)',
      outcome: 'Cheap ladder; slower proof.',
    },
    optionC: {
      id: 'skill.wait',
      label: 'Wait a quarter (−$80 emergency / +$80 fun)',
      outcome: 'You re-route cushion dollars toward joy — riskier if shocks hit.',
    },
  },
  cryptoFomoTrap: {
    id: 'cryptoFomoTrap',
    category: 'investments',
    tone: 'bad',
    setup: 'Group chat is screenshots of green candles at 1 a.m.',
    optionA: {
      id: 'crypto.small.spec',
      label: 'Tiny spec (+$200 investments / −$200 fun)',
      outcome: 'You keep it playful-sized.',
    },
    optionB: {
      id: 'crypto.walk.away',
      label: 'Log off (+$100 emergency / −$100 fun)',
      outcome: 'You shore up boring cash instead.',
    },
    optionC: {
      id: 'crypto.fomo.allin',
      label: 'Leverage up (−$350 investments / +$350 debt)',
      outcome: 'Volatility meets toxic APR — a rough combo.',
    },
  },
  employerMatchBoost: {
    id: 'employerMatchBoost',
    category: 'investments',
    tone: 'good',
    setup: 'HR re-opens a two-week window to raise your deferral.',
    optionA: {
      id: 'match.raise401k',
      label: 'Raise deferral (+$300 investments / −$150 food / −$150 fun)',
      outcome: 'You chase the match; lifestyle trims a little.',
    },
    optionB: {
      id: 'match.statusquo',
      label: 'Stay flat (no allocation shift)',
      outcome: 'No change this window.',
    },
    optionC: {
      id: 'match.catchup',
      label: 'Catch-up only (+$150 investments / −$150 rent)',
      outcome: 'Housing tightens to fund retirement.',
    },
  },
  deductibleDice: {
    id: 'deductibleDice',
    category: 'medical',
    tone: 'mixed',
    setup: 'Open enrollment nudges you to pick a deductible chess match.',
    optionA: {
      id: 'deductible.high.plan',
      label: 'High deductible plan (−$40 medical / +$40 emergency)',
      outcome: 'Lower premiums, thinner copay cushion.',
    },
    optionB: {
      id: 'deductible.low.plan',
      label: 'Low deductible (+$90 medical / −$90 fun)',
      outcome: 'Predictable bills; fun trims.',
    },
    optionC: {
      id: 'deductible.mid',
      label: 'Split the difference (+$30 medical / −$30 transportation)',
      outcome: 'You borrow from commute dollars.',
    },
  },
  rentRoommate: {
    id: 'rentRoommate',
    category: 'rent',
    tone: 'good',
    setup: 'A friend needs a room for three months and will pay cash.',
    optionA: {
      id: 'rent.roommate.yes',
      label: 'Host them (−$280 rent / +$280 fun)',
      outcome: 'Housing line drops; you reassign freed cash.',
    },
    optionB: {
      id: 'rent.alone.no',
      label: 'Decline (+$120 rent / −$120 emergency)',
      outcome: 'Privacy premium; cushion shrinks.',
    },
    optionC: {
      id: 'rent.split.utilities',
      label: 'Split utilities only (−$90 rent / −$30 food / +$120 fun)',
      outcome: 'Tiny rent relief plus grocery shuffle.',
    },
  },
  sideHustleFlip: {
    id: 'sideHustleFlip',
    category: 'miscFun',
    tone: 'good',
    setup: 'A festival needs weekend ticket scanners — overtime pay in cash.',
    optionA: {
      id: 'hustle.weekend.shift',
      label: 'Take shifts (+$220 fun / −$220 personal)',
      outcome: 'Fun line grows from hustle cash.',
    },
    optionB: {
      id: 'hustle.sell.gear',
      label: 'Sell booth gear instead (+$180 emergency / −$180 personal)',
      outcome: 'Liquidity without clocking hours.',
    },
    optionC: {
      id: 'hustle.rest',
      label: 'Rest weekend (−$60 fun / +$60 emergency)',
      outcome: 'You value recovery over extra dollars.',
    },
  },
  medicalBillShock: {
    id: 'medicalBillShock',
    category: 'medical',
    tone: 'bad',
    setup: 'Anesthesia bill lands higher than the estimate — due in 14 days.',
    optionA: {
      id: 'medical.urgent.care',
      label: 'Negotiate + urgent follow-up (+$160 medical / −$160 fun)',
      outcome: 'You fund care now from fun.',
    },
    optionB: {
      id: 'medical.er.now',
      label: 'Pay aggressive (+$420 medical / −$420 emergency)',
      outcome: 'You drain the cushion to avoid interest.',
    },
    optionC: {
      id: 'medical.wait',
      label: 'Defer calls (−$90 medical / +$90 fun)',
      outcome: 'Short-term relief; risk of penalties later.',
    },
  },
  autoLeaseUpsell: {
    id: 'autoLeaseUpsell',
    category: 'transportation',
    tone: 'bad',
    setup: 'The dealer texts: zero-down upgrade on a bigger SUV.',
    optionA: {
      id: 'lease.keep.premium',
      label: 'Take the upgrade (+$140 transportation / −$140 fun)',
      outcome: 'New payment, shinier ride.',
    },
    optionB: {
      id: 'lease.downgrade',
      label: 'Downsize (−$110 transportation / +$110 emergency)',
      outcome: 'Cheaper note; cushion breathes.',
    },
    optionC: {
      id: 'lease.buyout',
      label: 'Buyout with loan (+$300 transportation / −$300 debt)',
      outcome: 'You slide debt toward the car note — risky trade.',
    },
  },
};

/** Board squares 1..11 → scenario beat (square 0 is Start / year gate in game). */
export const ISLAND_SQUARE_BEAT_ORDER: readonly IslandScenarioBeatId[] = [
  'rentLeak',
  'garageWindfall',
  'parkingTicket',
  'subscriptionCreep',
  'skillCourseWin',
  'cryptoFomoTrap',
  'employerMatchBoost',
  'deductibleDice',
  'rentRoommate',
  'sideHustleFlip',
  'medicalBillShock',
  'autoLeaseUpsell',
] as const;

export function getIslandScenarioBeat(id: IslandScenarioBeatId): IslandScenarioBeat {
  return ISLAND_SCENARIO_BEATS[id];
}

/** True when `choiceId` belongs to one of the options on `beatId`. */
export function isChoiceForBeat(
  beatId: IslandScenarioBeatId,
  choiceId: IslandScenarioChoiceId,
): boolean {
  const beat = ISLAND_SCENARIO_BEATS[beatId];
  return (
    beat.optionA.id === choiceId ||
    beat.optionB.id === choiceId ||
    beat.optionC?.id === choiceId
  );
}
