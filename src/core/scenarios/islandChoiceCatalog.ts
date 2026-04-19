/**
 * @file Authored interactive scenario beats for Island Run landings.
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
    setup:
      'It is late on a work night and you finally move the cleaning bin—there is a slow drip under the kitchen sink and the cabinet floor is starting to swell. Small leaks rarely fix themselves; mold or subfloor damage can turn a few hundred dollars of plumbing into thousands of remediation. In a zero-based budget, "doing nothing" still means you are implicitly choosing to self-insure the risk with whatever cushion you keep elsewhere.',
    optionA: {
      id: 'rent.leak.plumber',
      label: 'Call a licensed plumber (+$250 rent / −$250 fun)',
      outcome:
        'You reallocate from discretionary fun into the rent line so a pro can stop the leak tonight. It hurts the entertainment budget this month, but you are buying speed and documentation—useful if you rent and need to show the landlord you mitigated damage promptly.',
    },
    optionB: {
      id: 'rent.leak.tape',
      label: 'Tape, towels, and hope (−$50 rent / +$50 emergency)',
      outcome:
        'You spend almost nothing up front and tuck a little extra into emergency savings "just in case." That can work short term, but you are accepting higher tail risk: if the seal fails while you are traveling, the same dollars may leave your plan via an uglier emergency later.',
    },
  },
  medicalTherapyCancel: {
    id: 'medicalTherapyCancel',
    category: 'medical',
    tone: 'mixed',
    setup:
      'Your therapist offered a recurring weekly slot that quietly stabilized your stress after a rough quarter at work. Now things feel calmer—and the copay line in your budget suddenly looks like "optional" money you could sweep into concerts or dining instead. Mental health spending is often framed as luxury when it is actually preventive maintenance, similar to changing your oil so the engine does not seize later.',
    optionA: {
      id: 'medical.therapy.keep',
      label: 'Keep the standing copay (+$120 medical / −$120 fun)',
      outcome:
        'You keep the medical line funded and trim fun. That models a common trade: predictable, smaller hits now instead of unpredictable crisis spending (missed work, urgent care, impulse retail therapy) when stress spikes again.',
    },
    optionB: {
      id: 'medical.therapy.cancel',
      label: 'Cancel for now (−$120 medical / +$120 fun)',
      outcome:
        'You pause sessions and move dollars into fun for immediate gratification. That can be a valid short pause if you have a plan to resume—but if the pause becomes permanent without replacing coping tools, the budget often pays later in other categories.',
    },
  },
  transportationBrakeNoise: {
    id: 'transportationBrakeNoise',
    category: 'transportation',
    tone: 'mixed',
    setup:
      'Your car starts squealing under light braking and the independent shop texts a quote for pads and rotors before the weekend trip you already promised friends. Transportation is not glamorous, but brakes are a classic "pay now or pay more later" category—deferring often converts a maintenance line item into towing, rental cars, or worse, a deductible event if stopping distance matters in rain.',
    optionA: {
      id: 'transportation.brakes.now',
      label: 'Fix this weekend (+$200 transit / −$200 fun)',
      outcome:
        'You fund the repair now by pulling from fun. That is the boring version of adulting: you accept a known cost today to avoid a fat-tailed unknown cost tomorrow, which is how emergency funds stay intact when life cooperates.',
    },
    optionB: {
      id: 'transportation.brakes.defer',
      label: 'Defer a few weeks (−$100 transit / +$100 emergency)',
      outcome:
        'You temporarily lower the transportation allocation and park the difference in emergency savings as a self-insurance buffer. You are betting you will not need full stopping power before you revisit the repair—educationally, that is liquidity vs. mechanical risk.',
    },
  },
  foodPantryDip: {
    id: 'foodPantryDip',
    category: 'food',
    tone: 'mixed',
    setup:
      'It is midweek, the pantry is empty, and you still have two deadlines before Friday. Delivery apps know your weakness: frictionless checkout converts hunger into "small" charges that compound. Food is one of the easiest categories to leak in because it feels morally justified—you have to eat—but the premium you pay for convenience is often hidden in fees, tips, and marked-up items rather than in the grocery line where you can compare unit prices.',
    optionA: {
      id: 'food.pantry.restock',
      label: 'Grocery run (+$80 food / −$80 fun)',
      outcome:
        'You raise the grocery envelope and cut fun. That mirrors how meal planning works financially: you trade time today for lower average cost per meal across the week, which is why dieticians and money coaches both harp on batch cooking.',
    },
    optionB: {
      id: 'food.pantry.delivery',
      label: 'Delivery tonight (−$60 food / +$60 personal)',
      outcome:
        'You shrink the grocery line and park the convenience premium in personal spending so your zero-based sheet still balances. Naming the tax honestly matters: if personal becomes the junk drawer for "I did not plan," audits get harder later.',
    },
  },
  garageWindfall: {
    id: 'garageWindfall',
    category: 'emergencyFund',
    tone: 'good',
    setup:
      'Spring cleaning turns up a desk you assembled during lockdown, a bike with dusty tires, and a lamp that no longer matches the room. Neighbors on the community app are actively buying secondhand furniture because new goods are still expensive. Selling unused stuff is one of the few ways households realize "found money" without touching salary—and the educational fork is whether that cash strengthens your cushion or just evaporates into lifestyle creep.',
    optionA: {
      id: 'garage.sell.furniture',
      label: 'Price to sell (+$400 emergency / −$400 fun)',
      outcome:
        'You list, negotiate, and deposit proceeds into the emergency fund by shifting fun dollars out to keep the sheet zero-based. That is classic liquidity repair: turning idle objects into cash that can absorb the next real shock.',
    },
    optionB: {
      id: 'garage.donate.receipt',
      label: 'Donate for write-off potential (−$120 fun / +$120 personal)',
      outcome:
        'You donate for a receipt and move value into the personal category for tax prep or mileage assumptions. Charitable giving can be part of a plan, but the lesson here is to be explicit about which envelope pays for the "feel good" versus the spreadsheet benefit.',
    },
    optionC: {
      id: 'garage.skip',
      label: 'Skip the hassle (+$40 fun / −$40 emergency)',
      outcome:
        'You protect your weekend and accept a tiny hit to emergency savings while nudging fun upward. That is a valid choice if your time is scarce—just notice you are buying convenience with cushion, not with nothing.',
    },
  },
  parkingTicket: {
    id: 'parkingTicket',
    category: 'transportation',
    tone: 'bad',
    setup:
      'You surface from a meeting to find a bright envelope tucked under the wiper—downtown parking enforcement photographed an expired meter while you were inside. Fines are annoying, but they also illustrate how cash-flow shocks enter a household: they are legally due, time-bound, and easy to "hide" inside credit cards if you do not name which envelope pays. The lesson is that ignoring the envelope choice often silently increases high-interest debt.',
    optionA: {
      id: 'ticket.pay.now',
      label: 'Pay online today (−$180 transit / +$180 debt)',
      outcome:
        'You pull from transportation and push dollars into the high-interest debt line so the fine does not become rolling APR. That is painful, but it is honest: you are preventing a parking mistake from compounding at credit-card rates.',
    },
    optionB: {
      id: 'ticket.payment.plan',
      label: 'Split hit across buckets (−$60 transit / −$40 fun / +$100 emergency)',
      outcome:
        'You spread the sting across transit, fun, and emergency so no single category collapses. That can smooth cash flow, but notice you are still funding the fine from real goals—this is why small recurring leaks matter.',
    },
  },
  subscriptionCreep: {
    id: 'subscriptionCreep',
    category: 'miscFun',
    tone: 'bad',
    setup:
      'Your card statement shows five streaming and productivity subscriptions renewing in the same week—each one felt cheap alone, but together they rival a utility bill. Subscription creep is one of the purest examples of "anchoring": companies hope you forget what you signed up for because the marginal cost per service feels small. A real audit forces you to ask which subscriptions actually save time or protect health versus which are just frictionless entertainment.',
    optionA: {
      id: 'sub.cancel.half',
      label: 'Cancel half (+$90 fun / −$90 personal)',
      outcome:
        'You cancel half the services and move freed dollars into fun while trimming personal. Educationally, you are converting recurring fixed costs into discretionary flexibility—often the fastest win in tight months.',
    },
    optionB: {
      id: 'sub.keep.all',
      label: 'Keep everything (−$75 fun / +$75 personal)',
      outcome:
        'You keep the stack and let personal absorb the creep. That models denial budgeting: the sheet still balances, but fun tightens silently until you wonder why social life feels expensive.',
    },
    optionC: {
      id: 'sub.audit.strict',
      label: 'Hard audit (+$50 fun / −$25 food / −$25 personal)',
      outcome:
        'You treat subscriptions like a committee meeting: trim apps and shave grocery impulse buys together. Cross-category cuts mirror what families do when they finally open the spreadsheet together.',
    },
  },
  skillCourseWin: {
    id: 'skillCourseWin',
    category: 'personal',
    tone: 'good',
    setup:
      'Your manager keeps nudging you toward a professional certificate that actually maps to the team’s roadmap—not a random influencer course, but a structured cohort with deadlines. Human-capital spending is tricky: it is not groceries, but it can increase earning power faster than a marginal entertainment upgrade. The educational tension is liquidity today versus higher income probability tomorrow.',
    optionA: {
      id: 'skill.bootcamp',
      label: 'Enroll (−$500 personal / +$500 emergency)',
      outcome:
        'You temporarily borrow from personal development into emergency savings bookkeeping (net zero shift pattern) to reflect that you are reallocating cushion into structured learning. In real life you might cash-flow tuition from multiple lines; here the point is naming the trade explicitly.',
    },
    optionB: {
      id: 'skill.youtube',
      label: 'Self-study only (−$40 personal / +$40 fun)',
      outcome:
        'You choose the ultra-low-cost path and keep more fun. That can work if you are disciplined—free curricula exist—but completion rates usually hinge on accountability structures you are not buying.',
    },
    optionC: {
      id: 'skill.wait',
      label: 'Wait a quarter (−$80 emergency / +$80 fun)',
      outcome:
        'You delay the course and move a slice from emergency to fun. That is a conscious risk trade: you are prioritizing present enjoyment over a skill asset, which only makes sense if your cushion is truly comfortable.',
    },
  },
  cryptoFomoTrap: {
    id: 'cryptoFomoTrap',
    category: 'investments',
    tone: 'bad',
    setup:
      'Your group chat lights up with green screenshots and rocket emojis right after a volatile asset spikes. FOMO is not just social pressure—it is a timing trap: people notice assets after they moon, which is the opposite of disciplined investing. The educational fork is whether you label speculation as a capped experiment, ignore the noise and build cash, or chase returns with dollars that really belong against high-interest debt.',
    optionA: {
      id: 'crypto.small.spec',
      label: 'Tiny spec (+$200 investments / −$200 fun)',
      outcome:
        'You move a small slice from fun into investments so the bet stays visible and bounded. If you ever speculate, the lesson is to treat it like entertainment with a ticket price—not as a substitute for an emergency fund.',
    },
    optionB: {
      id: 'crypto.walk.away',
      label: 'Log off (+$100 emergency / −$100 fun)',
      outcome:
        'You mute the thread and reallocate from fun into emergency savings. Boring cash does not screenshot well, but it absorbs real life shocks while meme assets cannot.',
    },
    optionC: {
      id: 'crypto.fomo.allin',
      label: 'Leverage up (−$350 investments / +$350 debt)',
      outcome:
        'You chase the move and shift dollars out of investments into high-interest debt—modeling the worst combo: volatile exposure plus toxic APR if the trade goes wrong and the card carries a balance.',
    },
  },
  employerMatchBoost: {
    id: 'employerMatchBoost',
    category: 'investments',
    tone: 'good',
    setup:
      'HR reopens a short window to raise your 401(k) deferral so you can capture more employer match this quarter. Matches are one of the few “guaranteed return” mechanisms in personal finance: skipping them is effectively leaving salary on the table. The tension is whether you can trim lifestyle envelopes without leaning on cards—otherwise the “smart” retirement move creates a cash-flow crisis.',
    optionA: {
      id: 'match.raise401k',
      label: 'Raise deferral (+$300 investments / −$150 food / −$150 fun)',
      outcome:
        'You raise deferrals and fund the retirement line by trimming food and fun. That is the classic trade: slightly less lifestyle today for more employer dollars compounding tomorrow.',
    },
    optionB: {
      id: 'match.statusquo',
      label: 'Stay flat (no allocation shift)',
      outcome:
        'You leave everything unchanged this window—sometimes the right move when cash is razor thin, but be explicit that you are forfeiting match dollars you could have captured with a smaller, staged increase later.',
    },
    optionC: {
      id: 'match.catchup',
      label: 'Catch-up only (+$150 investments / −$150 rent)',
      outcome:
        'You fund a smaller catch-up contribution by tightening rent-adjacent cash flow (roommates, utilities discipline, or delaying a housing upgrade). Housing is a lever, but pulling it too hard can backfire if it increases stress or instability.',
    },
  },
  deductibleDice: {
    id: 'deductibleDice',
    category: 'medical',
    tone: 'mixed',
    setup:
      'Open enrollment forces the deductible chess match: higher deductibles usually mean lower premiums, but they also mean the first dollars of care come from your pocket before insurance “really” kicks in. This is not gambling on health—it is choosing who holds liquidity risk: you via savings, or the insurer via higher premiums. The educational goal is to pair deductible choices with an HSA or emergency fund plan, not to pick the cheapest premium in isolation.',
    optionA: {
      id: 'deductible.high.plan',
      label: 'High deductible plan (−$40 medical / +$40 emergency)',
      outcome:
        'You choose the high-deductible path and move a slice into emergency savings to represent funding an HSA-style buffer or self-insurance. Lower premiums only work if you actually fund the gap you created.',
    },
    optionB: {
      id: 'deductible.low.plan',
      label: 'Low deductible (+$90 medical / −$90 fun)',
      outcome:
        'You pay up for predictability: higher medical premiums/copay capacity and less fun. That can reduce surprise bills for chronic care or kids’ visits—just notice you are buying peace with monthly cash flow.',
    },
    optionC: {
      id: 'deductible.mid',
      label: 'Split the difference (+$30 medical / −$30 transportation)',
      outcome:
        'You pick a mid plan and fund it partly by trimming transportation—modeling how families sometimes “borrow” from commute or car replacement envelopes when premiums rise. It is a patch, not a long-term strategy unless you revisit the car plan.',
    },
  },
  rentRoommate: {
    id: 'rentRoommate',
    category: 'rent',
    tone: 'good',
    setup:
      'A reliable friend needs a room for three months and offers cash—splitting housing is one of the fastest levers on fixed rent, but it is not free: it costs privacy, noise tolerance, and clear house rules. The educational fork is whether the cash-flow relief is worth household friction, and whether you formalize rent/utilities in writing so friendships do not absorb ambiguity.',
    optionA: {
      id: 'rent.roommate.yes',
      label: 'Host them (−$280 rent / +$280 fun)',
      outcome:
        'You host and model lower rent with fun rising—often realistic because roommates change how you spend weekends even when housing dollars improve. The lesson: count non-money costs, not just the line-item win.',
    },
    optionB: {
      id: 'rent.alone.no',
      label: 'Decline (+$120 rent / −$120 emergency)',
      outcome:
        'You protect solitude and accept higher rent pressure while emergency savings absorbs part of the premium. That is a valid mental-health trade if you can afford it; otherwise it quietly erodes cushion.',
    },
    optionC: {
      id: 'rent.split.utilities',
      label: 'Split utilities only (−$90 rent / −$30 food / +$120 fun)',
      outcome:
        'You negotiate a lighter arrangement—small rent relief plus a grocery shuffle into fun—mirroring partial compromises when a full sublet feels too heavy.',
    },
  },
  sideHustleFlip: {
    id: 'sideHustleFlip',
    category: 'miscFun',
    tone: 'good',
    setup:
      'A festival needs weekend ticket scanners and pays cash for overtime—classic gig work with a time tax. Side income can stabilize a budget, but it also interacts with taxes, energy, and burnout. The educational fork is whether you convert hours into discretionary spend, sell assets instead, or protect recovery so you do not trade health for short cash.',
    optionA: {
      id: 'hustle.weekend.shift',
      label: 'Take shifts (+$220 fun / −$220 personal)',
      outcome:
        'You take the shifts and move dollars from personal time/projects into fun—modeling how hustle cash often lands in lifestyle categories unless you deliberately route it to debt or savings.',
    },
    optionB: {
      id: 'hustle.sell.gear',
      label: 'Sell booth gear instead (+$180 emergency / −$180 personal)',
      outcome:
        'You skip the hours and liquidate gear, boosting emergency savings while drawing down personal “project” money. That mirrors turning inventory into cushion without burning weekends.',
    },
    optionC: {
      id: 'hustle.rest',
      label: 'Rest weekend (−$60 fun / +$60 emergency)',
      outcome:
        'You protect recovery: fun dips slightly while emergency inches up as you bank quiet time instead of wages. Sometimes the best financial move is not earning more—it is not creating a medical or mistake event from exhaustion.',
    },
  },
  medicalBillShock: {
    id: 'medicalBillShock',
    category: 'medical',
    tone: 'bad',
    setup:
      'An anesthesia line item arrives higher than the hospital estimate, due in two weeks—classic “EOB surprise” territory where coding edits and out-of-network assistants change what you owe after the fact. This is why medical literacy matters: itemized bills can be audited, payment plans exist, and silence often routes shock straight to cards. The fork is whether you engage quickly, pay aggressively from savings, or delay and risk penalties or interest.',
    optionA: {
      id: 'medical.urgent.care',
      label: 'Negotiate + urgent follow-up (+$160 medical / −$160 fun)',
      outcome:
        'You call billing, request an itemization, and fund follow-up care now by shifting fun into medical. Active negotiation does not always cut the bill, but it almost always reduces chaos fees from autopay mistakes.',
    },
    optionB: {
      id: 'medical.er.now',
      label: 'Pay aggressive (+$420 medical / −$420 emergency)',
      outcome:
        'You drain emergency savings to settle the bill and avoid revolving interest. Painful, but it keeps the shock from compounding at credit-card APR if cash is available.',
    },
    optionC: {
      id: 'medical.wait',
      label: 'Defer calls (−$90 medical / +$90 fun)',
      outcome:
        'You postpone the work of dealing with billing while fun rises short term. That is the risky path: unresolved medical balances can escalate to collections or force card usage when the next bill stacks.',
    },
  },
  autoLeaseUpsell: {
    id: 'autoLeaseUpsell',
    category: 'transportation',
    tone: 'bad',
    setup:
      'The dealer texts a “payment-friendly” zero-down upgrade to a bigger SUV—classic monthly-affordability marketing that can hide total cost, insurance increases, and fuel step-ups. Cars are one of the easiest places to confuse cash flow with wealth: a lower monthly can still mean more interest, longer chains of obligation, or negative equity. The fork is lifestyle inflation, downsizing the note, or concentrating repayment on high-interest debt via a deliberate buyout strategy.',
    optionA: {
      id: 'lease.keep.premium',
      label: 'Take the upgrade (+$140 transportation / −$140 fun)',
      outcome:
        'You take the shinier ride and raise the transportation envelope while trimming fun. Even without showing APR here, the lesson is you bought status and size with ongoing fixed costs—not a one-time sticker.',
    },
    optionB: {
      id: 'lease.downgrade',
      label: 'Downsize (−$110 transportation / +$110 emergency)',
      outcome:
        'You downsize the payment and move freed dollars into emergency savings. That is total-cost thinking: smaller note, more cushion for the next real shock.',
    },
    optionC: {
      id: 'lease.buyout',
      label: 'Buyout with loan (+$300 transportation / −$300 debt)',
      outcome:
        'You consolidate by shifting high-interest debt into a secured transportation line—sometimes cheaper APR, but you are converting unsecured risk into “lose the car if you miss payments” risk. Only rational with a disciplined payoff plan.',
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
