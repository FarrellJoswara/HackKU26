import type { BudgetCategoryId } from '../budgetTypes';
import type { ScenarioTier } from './types';

/**
 * Curated player-facing scenario lines for budget categories.
 * Tone target: short, useful, and human.
 */
export const BUDGET_SCENARIO_LINES: Record<
  BudgetCategoryId,
  Record<ScenarioTier, readonly string[]>
> = {
  emergencyFund: {
    excellent: [
      'A job gap hits, but your emergency fund keeps bills paid.',
      'Two surprises land back-to-back and your buffer handles both.',
      'You make calm choices because your cash runway is ready.',
    ],
    good: [
      'A repair stings once, then it is done with no card balance.',
      'You dip into savings, then refill it over a few paychecks.',
      'Unexpected costs stay annoying, not catastrophic.',
    ],
    bad: [
      'A surprise bill lands on your card and starts charging interest.',
      'One medium setback drains most of your cushion.',
      'You keep borrowing from next month to close today.',
    ],
    terrible: [
      'Two emergencies hit and you go straight to high-APR debt.',
      'A crisis turns into a long payment plan with extra fees.',
      'Every new expense feels urgent because there is no buffer.',
    ],
  },
  rent: {
    excellent: [
      'Housing is stable, so the rest of your budget stays calm.',
      'Rent fits your income and still leaves room to save.',
      'Lease changes show up, but you are ready for them.',
    ],
    good: [
      'Rent is paid on time and your plan still holds.',
      'Housing costs stay manageable with only minor tradeoffs.',
      'A small increase is frustrating, but still affordable.',
    ],
    bad: [
      'Rent is stretched thin, and one late fee could snowball.',
      'Housing costs crowd out food, savings, or debt payoff.',
      'Extra lease fees keep squeezing your monthly cash flow.',
    ],
    terrible: [
      'Housing becomes the crisis and dominates every decision.',
      'You are choosing between rent and other essentials.',
      'An unstable place forces expensive emergency moves.',
    ],
  },
  food: {
    excellent: [
      'Groceries are planned, meals are solid, and spending stays steady.',
      'Takeout is a choice, not the emergency plan.',
      'You eat well without wrecking the weekly budget.',
    ],
    good: [
      'Most weeks follow a plan with room for a small treat.',
      'Batch cooking keeps weekday spending predictable.',
      'Less food waste means more money stays in your pocket.',
    ],
    bad: [
      'You run out midweek and convenience prices take over.',
      'Skipping meals hurts energy and work performance.',
      'Unplanned lunches quietly drain your cash.',
    ],
    terrible: [
      'Food insecurity forces expensive short-term choices.',
      'Basic meals become hard to cover without borrowing.',
      'Nutrition drops while food stress keeps climbing.',
    ],
  },
  transportation: {
    excellent: [
      'Maintenance is funded, so repairs stay routine and cheap.',
      'Your commute plan is reliable and budget-friendly.',
      'Fuel, insurance, and upkeep all stay in a healthy range.',
    ],
    good: [
      'Regular maintenance keeps small issues from becoming big bills.',
      'You budget parking, tolls, and gas before they surprise you.',
      'Transportation spending feels steady month to month.',
    ],
    bad: [
      'You delay a fix and a small repair becomes a major one.',
      'Fuel spikes leave no slack in the rest of your plan.',
      'Convenience rides replace planning and costs stack up.',
    ],
    terrible: [
      'A breakdown costs workdays and forces emergency spending.',
      'Coverage gaps turn normal accidents into major damage.',
      'Transport problems cut into income and deepen debt.',
    ],
  },
  miscFun: {
    excellent: [
      'Fun is budgeted, so joy does not become debt.',
      'Small treats keep morale up without harming progress.',
      'You recharge on purpose and avoid stress spending.',
    ],
    good: [
      'You keep a modest fun budget and mostly stick to it.',
      'Low-cost hangouts replace expensive impulse plans.',
      'Entertainment stays enjoyable and predictable.',
    ],
    bad: [
      'No fun budget leads to rebound spending later.',
      'Stress purchases feel good now and painful on statement day.',
      'Too many one-time splurges quietly become a pattern.',
    ],
    terrible: [
      'Impulse spending turns short fun into long debt.',
      'Big outings on credit create bills that linger for months.',
      'Emotional spending keeps resetting your progress.',
    ],
  },
  highInterestDebt: {
    excellent: [
      'High-interest balances are cleared and cash flow finally opens up.',
      'Old minimum payments can now move toward savings or investing.',
      'Interest stops acting like a second rent bill.',
    ],
    good: [
      'Debt balances shrink each month with a clear payoff plan.',
      'You stop adding new charges while paying old ones down.',
      'One expensive balance is gone and momentum is building.',
    ],
    bad: [
      'Minimum payments barely touch principal at this APR.',
      'A late payment adds fees and makes the climb steeper.',
      'Balance shuffling continues, but total debt barely moves.',
    ],
    terrible: [
      'Missed payments and fees stack faster than you can catch up.',
      'You borrow new debt to service old debt.',
      'High APR controls your budget instead of you.',
    ],
  },
  investments: {
    excellent: [
      'Investing runs on autopilot after essentials are fully covered.',
      'Your mix stays diversified and low-fee.',
      'You stick with the plan through noise and volatility.',
    ],
    good: [
      'Small recurring contributions keep momentum going.',
      'You raise contributions when income rises.',
      'You rebalance occasionally instead of reacting emotionally.',
    ],
    bad: [
      'You invest while high-interest debt still compounds fast.',
      'Concentrated bets replace a diversified plan.',
      'FOMO trades add stress and reduce consistency.',
    ],
    terrible: [
      'Leverage and hype trades wipe out hard-earned savings.',
      'You chase fast gains with no risk limits.',
      'Volatility turns short-term bets into long-term setbacks.',
    ],
  },
  medical: {
    excellent: [
      'Preventive care stays funded and problems are caught early.',
      'Prescriptions and appointments happen on schedule.',
      'Health costs feel planned, not chaotic.',
    ],
    good: [
      'Copays are budgeted and manageable.',
      'Routine visits happen before issues escalate.',
      'You avoid most surprise bills by planning ahead.',
    ],
    bad: [
      'You delay care and small issues become expensive visits.',
      'Out-of-network costs catch you off guard.',
      'Medical bills start competing with other essentials.',
    ],
    terrible: [
      'You skip care because cash is too tight.',
      'Emergency treatment becomes the default, costly path.',
      'Health setbacks and debt rise together.',
    ],
  },
  personal: {
    excellent: [
      'Personal essentials are funded without stress.',
      'Phone, basics, and upkeep stay predictable.',
      'You replace items on schedule instead of in panic.',
    ],
    good: [
      'You cap personal spending and keep it mostly steady.',
      'Small quality-of-life costs stay under control.',
      'You pause impulse buys before they become habits.',
    ],
    bad: [
      'Subscription creep quietly inflates monthly spending.',
      'Small personal purchases keep bypassing your plan.',
      'Installment-style buys start stacking up.',
    ],
    terrible: [
      'Essentials break and replacement terms are expensive.',
      'BNPL-style payments spread across too many categories.',
      'Personal spending pressure crowds out critical priorities.',
    ],
  },
  savings: {
    excellent: [
      'Savings grows steadily and future goals feel real.',
      'Automatic transfers keep progress consistent.',
      'You can handle planned costs without borrowing.',
    ],
    good: [
      'You save every month, even if the amount is modest.',
      'Raises translate into stronger savings habits.',
      'Cash goals are visible and moving forward.',
    ],
    bad: [
      'Savings grows, then gets raided for non-emergencies.',
      'Progress stalls when monthly pressure increases.',
      'One large expense resets the account.',
    ],
    terrible: [
      'Savings starts at zero month after month.',
      'Overdrafts consume what little buffer exists.',
      'Future goals keep getting traded for immediate fixes.',
    ],
  },
  indexFunds: {
    excellent: [
      'Broad indexing keeps fees low and discipline high.',
      'Contributions stay consistent through market noise.',
      'Long-term compounding works because you stay the course.',
    ],
    good: [
      'You picked a solid index strategy and stuck with it.',
      'Small recurring buys keep building over time.',
      'Your approach is simple, diversified, and sustainable.',
    ],
    bad: [
      'You keep swapping funds based on short-term headlines.',
      'Dip panic causes exits that hurt long-term returns.',
      'You pause contributions during volatility and lose momentum.',
    ],
    terrible: [
      'Leverage turns normal swings into major losses.',
      'A narrow bet is treated like diversification.',
      'Risk gets oversized relative to your timeline.',
    ],
  },
  individualStocks: {
    excellent: [
      'Single-stock exposure stays small and intentional.',
      'Position sizing and patience protect your downside.',
      'You research before buying and rebalance when needed.',
    ],
    good: [
      'A limited stock slice adds upside without dominating risk.',
      'You follow position limits and avoid emotional trades.',
      'You take gains methodically instead of chasing peaks.',
    ],
    bad: [
      'Concentration risk rises as one name grows too large.',
      'Averaging down replaces disciplined risk management.',
      'Headline-driven moves create expensive whiplash.',
    ],
    terrible: [
      'One stock bet becomes most of your portfolio.',
      'Speculation replaces investing and losses compound.',
      'Borrowed conviction keeps adding risk to losing positions.',
    ],
  },
  bonds: {
    excellent: [
      'Bonds steady your portfolio when stocks get rough.',
      'Your bond mix matches timeline and cash needs.',
      'Rebalancing into bonds protects gains and lowers volatility.',
    ],
    good: [
      'Core bond exposure adds useful stability.',
      'Shorter-duration choices support near-term goals.',
      'Income is modest but dependable.',
    ],
    bad: [
      'You chase yield and take more credit risk than planned.',
      'Rate shifts hurt because duration and goals do not match.',
      'Bond exposure is treated like cash when it is not.',
    ],
    terrible: [
      'Complex bond products add risk you did not price in.',
      'Concentration in one thesis magnifies downside.',
      'Defensive capital becomes unexpectedly fragile.',
    ],
  },
  cds: {
    excellent: [
      'CD timing matches known future bills.',
      'You lock a solid rate without compromising safety.',
      'Cash goals and maturity dates line up cleanly.',
    ],
    good: [
      'CDs anchor short-term money with predictable returns.',
      'You blend CDs and liquid savings appropriately.',
      'Renewals are intentional, not accidental.',
    ],
    bad: [
      'Funds get locked too long for your real cash needs.',
      'Penalty math weakens returns when you withdraw early.',
      'You overuse CDs while higher-priority debt remains.',
    ],
    terrible: [
      'Liquidity dries up when urgent cash is needed.',
      'Poor product terms erase much of the expected gain.',
      'Locked money collides with an emergency-heavy year.',
    ],
  },
  crypto: {
    excellent: [
      'Crypto stays a small, controlled slice of the portfolio.',
      'You secure assets properly and track tax lots.',
      'Volatility is accepted without letting it drive decisions.',
    ],
    good: [
      'Allocation is capped and rebalanced after large swings.',
      'You treat crypto as speculative, not core savings.',
      'Security basics reduce avoidable mistakes.',
    ],
    bad: [
      'FOMO increases position size beyond your risk plan.',
      'Frequent trading adds stress, fees, and tax drag.',
      'Concentration in one token raises downside risk.',
    ],
    terrible: [
      'Leverage plus volatility creates abrupt heavy losses.',
      'Poor custody or scam risk wipes out capital quickly.',
      'Speculation crowds out stable long-term planning.',
    ],
  },
  employerMatch: {
    excellent: [
      'You capture the full employer match and boost long-term returns.',
      'Contribution rate is tuned to hit the cap efficiently.',
      'Free match dollars compound year after year.',
    ],
    good: [
      'You contribute enough to capture a meaningful match.',
      'Deferrals increase gradually as income rises.',
      'Plan participation stays consistent across the year.',
    ],
    bad: [
      'You are leaving part of your match unclaimed.',
      'Contribution timing misses available employer dollars.',
      'Small deferrals limit what free money can do.',
    ],
    terrible: [
      'No deferral means no employer match captured.',
      'Years of unclaimed match materially slow wealth building.',
      'Immediate cash pressure keeps sacrificing long-term gains.',
    ],
  },
} as const;
