import type { BudgetCategoryId, BudgetProfile, BudgetRating } from './budgetTypes';
import { CATEGORY_LABELS } from './budgetTypes';

export interface BudgetEffectNote {
  categoryId: BudgetCategoryId;
  rating: BudgetRating;
  text: string;
}

export interface BudgetEffects {
  pathHazardMultiplier: number;
  pathReadability: number;
  pathNarrowChance: number;
  stumbleTerrainChance: number;
  staminaDrainMultiplier: number;
  staminaRecoveryMultiplier: number;
  movementResponseMultiplier: number;
  turnWindowSeconds: number;
  /** Multiplier on lane-shift easing speed (transportation). */
  laneSmoothSpeedMultiplier: number;
  startingLives: number;
  injurySlowMultiplier: number;
  injuryDurationMultiplier: number;
  debtCollectorScale: number;
  debtCollectorAggression: number;
  debtPressureGrowthPerMinute: number;
  stumbleChancePerSecond: number;
  burnoutDrainMultiplier: number;
  moraleStartBoost: number;
  /**
   * Rent — how beat-up the boardwalk reads (0 = well-kept, 1 = neglected).
   * Drives plank visuals in DebtRunner; also nudges narrow/slippery rolls in
   * {@link generateTrackTiles}.
   */
  pathVisualWear01: number;
  /** Food — max forward slowdown at end of a long run when nutrition is poor (0..~0.26). */
  foodForwardFatigueMax: number;
  /** Food — extra forward speed from good fueling, scaled by stamina in-runner (0..~0.12). */
  foodForwardBoostMax: number;
  /** Medical — extra slippery / uneven-board chance when health coverage is weak. */
  medicalTerrainStress: number;
  /** Emergency fund — starting gap ahead of the Debt Collector (meters). */
  startingChaseDistance: number;
}

export interface RunnerSessionConfig {
  profile: BudgetProfile;
  effects: BudgetEffects;
  durationSeconds: number;
  totalDebtPressureTier: 'low' | 'medium' | 'high';
  notes: BudgetEffectNote[];
}

const ratingFactor: Record<BudgetRating, number> = {
  bad: -1,
  average: 0,
  good: 1,
};

function note(categoryId: BudgetCategoryId, rating: BudgetRating, text: string): BudgetEffectNote {
  return { categoryId, rating, text };
}

export function resolveBudgetEffects(profile: BudgetProfile): RunnerSessionConfig {
  const effects: BudgetEffects = {
    pathHazardMultiplier: 1,
    pathReadability: 1,
    pathNarrowChance: 0.2,
    stumbleTerrainChance: 0.08,
    staminaDrainMultiplier: 1,
    staminaRecoveryMultiplier: 1,
    movementResponseMultiplier: 1,
    turnWindowSeconds: 0.65,
    laneSmoothSpeedMultiplier: 1,
    startingLives: 2,
    injurySlowMultiplier: 1,
    injuryDurationMultiplier: 1,
    debtCollectorScale: 1,
    debtCollectorAggression: 1,
    debtPressureGrowthPerMinute: 0.4,
    stumbleChancePerSecond: 0.015,
    burnoutDrainMultiplier: 1,
    moraleStartBoost: 0,
    pathVisualWear01: 0.35,
    foodForwardFatigueMax: 0,
    foodForwardBoostMax: 0,
    medicalTerrainStress: 0,
    startingChaseDistance: 16,
  };

  const notes: BudgetEffectNote[] = [];

  if (profile.rent === 'bad') {
    effects.pathHazardMultiplier = 1.35;
    effects.pathReadability = 0.8;
    effects.pathNarrowChance = 0.35;
    effects.pathVisualWear01 = 0.92;
    notes.push(note('rent', 'bad', 'Rent was BAD: rougher deck, tighter lanes, more hazards, worse footing.'));
  } else if (profile.rent === 'good') {
    effects.pathHazardMultiplier = 0.82;
    effects.pathReadability = 1.2;
    effects.pathNarrowChance = 0.1;
    effects.pathVisualWear01 = 0.06;
    notes.push(note('rent', 'good', 'Rent was GOOD: wide, readable route with a well-kept boardwalk.'));
  } else {
    effects.pathVisualWear01 = 0.38;
    notes.push(note('rent', 'average', 'Rent was AVERAGE: route difficulty stays near baseline.'));
  }

  if (profile.food === 'bad') {
    effects.staminaDrainMultiplier = 1.4;
    effects.staminaRecoveryMultiplier = 0.65;
    effects.foodForwardFatigueMax = 0.24;
    notes.push(
      note(
        'food',
        'bad',
        'Food was BAD: stamina drains faster, recovery is slower, and forward pace tires as the run goes on.',
      ),
    );
  } else if (profile.food === 'good') {
    effects.staminaDrainMultiplier = 0.75;
    effects.staminaRecoveryMultiplier = 1.35;
    effects.foodForwardBoostMax = 0.1;
    notes.push(
      note(
        'food',
        'good',
        'Food was GOOD: stronger endurance, faster recovery, and a little extra sprint when energy is high.',
      ),
    );
  } else {
    notes.push(note('food', 'average', 'Food was AVERAGE: normal stamina behavior.'));
  }

  if (profile.transportation === 'bad') {
    effects.movementResponseMultiplier = 0.72;
    effects.turnWindowSeconds = 0.52;
    effects.laneSmoothSpeedMultiplier = 0.74;
    notes.push(
      note(
        'transportation',
        'bad',
        'Transportation was BAD: slower base pace, sluggish lane changes, and a tighter turn-input window.',
      ),
    );
  } else if (profile.transportation === 'good') {
    effects.movementResponseMultiplier = 1.28;
    effects.turnWindowSeconds = 0.75;
    effects.laneSmoothSpeedMultiplier = 1.22;
    notes.push(
      note(
        'transportation',
        'good',
        'Transportation was GOOD: snappier movement, smoother lane shifts, and a forgiving turn buffer.',
      ),
    );
  } else {
    notes.push(note('transportation', 'average', 'Transportation was AVERAGE: baseline responsiveness.'));
  }

  if (profile.emergencyFund === 'bad') {
    effects.startingLives = 1;
    effects.startingChaseDistance = 13.2;
    notes.push(
      note(
        'emergencyFund',
        'bad',
        'Emergency Fund was BAD: one life and the collector starts uncomfortably close.',
      ),
    );
  } else if (profile.emergencyFund === 'good') {
    effects.startingLives = 3;
    effects.startingChaseDistance = 18.6;
    notes.push(
      note(
        'emergencyFund',
        'good',
        'Emergency Fund was GOOD: extra lives and more breathing room before the chase tightens.',
      ),
    );
  } else {
    effects.startingLives = 2;
    notes.push(note('emergencyFund', 'average', 'Emergency Fund was AVERAGE: limited safety net.'));
  }

  if (profile.medical === 'bad') {
    effects.injurySlowMultiplier = 1.5;
    effects.injuryDurationMultiplier = 1.6;
    effects.medicalTerrainStress = 0.1;
    notes.push(
      note(
        'medical',
        'bad',
        'Medical was BAD: injuries slow you harder for longer, and the path stays slicker between hits.',
      ),
    );
  } else if (profile.medical === 'good') {
    effects.injurySlowMultiplier = 0.75;
    effects.injuryDurationMultiplier = 0.7;
    notes.push(note('medical', 'good', 'Medical was GOOD: faster healing and lighter injury penalties.'));
  } else {
    notes.push(note('medical', 'average', 'Medical was AVERAGE: standard injury behavior.'));
  }

  if (profile.debtRepayment === 'bad') {
    effects.debtCollectorScale = 1.55;
    effects.debtCollectorAggression = 1.5;
    notes.push(
      note(
        'debtRepayment',
        'bad',
        'Debt Repayment was BAD: Debt Collector is visibly bigger and more aggressive.',
      ),
    );
  } else if (profile.debtRepayment === 'good') {
    effects.debtCollectorScale = 0.82;
    effects.debtCollectorAggression = 0.78;
    notes.push(note('debtRepayment', 'good', 'Debt Repayment was GOOD: Debt Collector is smaller and calmer.'));
  } else {
    notes.push(note('debtRepayment', 'average', 'Debt Repayment was AVERAGE: standard collector pressure.'));
  }

  if (profile.miscFun === 'bad') {
    effects.stumbleChancePerSecond = 0.04;
    effects.burnoutDrainMultiplier = 1.35;
    effects.stumbleTerrainChance += 0.1;
    notes.push(
      note(
        'miscFun',
        'bad',
        'Misc/Fun was BAD: shorter run timer, more stumbling, burnout, and a bleaker pace.',
      ),
    );
  } else if (profile.miscFun === 'good') {
    effects.stumbleChancePerSecond = 0.01;
    effects.burnoutDrainMultiplier = 0.85;
    effects.moraleStartBoost = 14;
    notes.push(
      note(
        'miscFun',
        'good',
        'Misc/Fun was GOOD: longer run timer, better early morale, and a calmer stride.',
      ),
    );
  } else {
    notes.push(note('miscFun', 'average', 'Misc/Fun was AVERAGE: normal morale and comfort.'));
  }

  const debtFactor = 1 - ratingFactor[profile.debtRepayment];
  const emergencyFactor = 1 - ratingFactor[profile.emergencyFund];
  const medicalFactor = 1 - ratingFactor[profile.medical];
  const totalDebtScore = debtFactor * 2 + emergencyFactor + medicalFactor;

  let totalDebtPressureTier: 'low' | 'medium' | 'high' = 'medium';
  if (totalDebtScore >= 4) totalDebtPressureTier = 'high';
  if (totalDebtScore <= 1) totalDebtPressureTier = 'low';

  if (totalDebtPressureTier === 'high') {
    effects.debtPressureGrowthPerMinute = 0.75;
    notes.push(
      note(
        'debtRepayment',
        profile.debtRepayment,
        'High total debt pressure: the interest shadow accelerates over time and mistakes become deadlier.',
      ),
    );
  } else if (totalDebtPressureTier === 'low') {
    effects.debtPressureGrowthPerMinute = 0.3;
  }

  const strongFunWeakSafety =
    profile.miscFun === 'good' &&
    (profile.emergencyFund === 'bad' || profile.medical === 'bad' || profile.rent === 'bad');
  if (strongFunWeakSafety) {
    notes.push(
      note(
        'miscFun',
        'good',
        'Strong early morale, but weak safety categories reduce long-term resilience.',
      ),
    );
  }

  let durationSeconds = 30;
  if (profile.miscFun === 'bad') {
    durationSeconds = 22;
  } else if (profile.miscFun === 'good') {
    durationSeconds = 40;
  }

  return {
    profile,
    effects,
    durationSeconds,
    totalDebtPressureTier,
    notes: notes.map((item) => ({
      ...item,
      text: `${CATEGORY_LABELS[item.categoryId]}: ${item.text}`,
    })),
  };
}

