import type { Allocation, BlockMaterial, LevelType } from './types';

/** Tunables in one place so balance work stays cheap. */
export const GAME_CONFIG = {
  birdRadius: 0.34,
  /** Slingshot sits closer to the left edge of the design frustum. */
  launchAnchor: { x: -6.5, y: 1.2 },
  slingPostOffset: { x: 0.52, y: -0.25 },
  slingPostSize: { w: 0.22, h: 1.1 },
  minPullToAim: 0.08,
  /** Kept low so light pulls still register after pointer-up (was losing launches). */
  minPullToLaunch: 0.1,
  maxDrag: 2.4,
  /** V2: 9.5 keeps the same launch arc feel as v1. */
  forceMultiplier: 9.5,
  gravity: 18,
  /**
   * Frame-rate-independent drag coefficient. See `applyGravityAndDrag` in
   * physics.ts — we exponentiate so `dragDamping^(dt*60)` is applied to X only.
   * Gravity is never damped (see PH1).
   */
  dragDamping: 0.995,
  /** Higher epsilon + shorter window so shots end promptly. */
  settleSpeedEpsilon: 0.6,
  settleWindowMs: 380,
  /** Time a bird can sit on the ground before force-ending the shot. */
  groundRestSec: 0.35,
  /**
   * World bounds are just outside the camera frustum so any stray motion is
   * caught quickly — no more multi-second "off screen" dead-air.
   */
  worldBounds: { minX: -16, maxX: 22, minY: -2.5, maxY: 14 },
  fixedStep: 1 / 120,
  /** V2: dropped 1.25 → 1.0 so a single bird no longer one-shots a whole
   *  column. Combined with higher block HP and tighter structural
   *  hysteresis, towers now take 2–3 well-aimed shots. */
  birdMassFactor: 1.0,
  /**
   * Post-hit velocity retention for the bird. V2: dropped 0.6 → 0.45 so the
   * bird loses more speed per impact and can't tear through a whole tower.
   */
  bounceDamping: 0.45,
  /** Base points per cleared block BEFORE category multiplier. */
  scorePerBlockKnockedOff: 100,
  /** Combo window — single source of truth shared by fsm and loop. */
  comboWindowSec: 0.75,
  /** World-Y that counts as "off the stage". Blocks past this are removed. */
  killFloorY: -3,
  /** Rounds pause for this long at ROUND_END to show the transition banner. */
  roundPauseSec: 2.0,
  trajectoryMaxDots: 120,
  /** How long the new-ball respawn takes after a shot settles. */
  respawnDelaySec: 0.35,
  /**
   * After the last bird is gone (no respawn) and `respawnDelaySec` has passed,
   * wait this many extra sim seconds before judging the tower and firing
   * `ROUND_END`. Lower = faster transition from "Out of birds…" to round end.
   */
  outOfBirdsRoundEndDelaySec: 0.75,
  /** Duration of the post-launch "woosh" streak. */
  launchStreakSec: 0.35,
  /** Heavy hit threshold for slow-mo + vignette. */
  heavyHitForce: 11,
  /** Hard cap on bird speed — prevents runaway acceleration after impacts. */
  maxBirdSpeed: 20,
  /** Hard cap on block speed so toppled blocks don't launch off-screen. */
  maxBlockSpeed: 18,

  /**
   * Static floor edge (`engine/world.ts`). Box2D mixes with body friction.
   * Tuned for a modest ground skid on landing without endless skating.
   */
  groundFriction: 0.92,

  /* ------------------------------------------------------------------ */
  /* Angry Birds reference port (planck.js / Box2D-backed simulation).   */
  /* These tunables drive the new `engine/*` physics layer.              */
  /* ------------------------------------------------------------------ */

  /** Block-on-block damage scale. Mirrors Enemy.cs `damage = v.mag * 10`. */
  obstacleDamageK: 8,
  /** Bird-on-block damage scale. Tuned so a solid Stocks hit removes
   *  roughly ~35% of that tower's structural HP. */
  birdDamageK: 7.5,
  /** Minimum impact speed (m/s) that still produces feedback. */
  minImpactSpeed: 0.4,

  bird: {
    /** Reference formula: velocity = dragVec * throwSpeed * dragLength. */
    throwSpeed: 6.5,
    /** A bird is considered at rest once its speed drops below this. */
    minRestVel: 0.38,
    /** Delay after entering rest before the bird body is destroyed. */
    restDestroyDelaySec: 0.65,
    /** Higher = velocity bleeds faster in flight and when sliding. */
    linearDamping: 0.48,
    /** Higher = stops rolling sooner. */
    angularDamping: 0.92,
    /** Circle fixture: grip on blocks/ground (higher = quicker stop). */
    friction: 0.65,
    /** Lower = less bouncy skittering along stacks. */
    restitution: 0.08,
    /**
     * When the bird’s bottom is within this distance of the floor (y=0),
     * apply extra horizontal braking (see SimDriver `applyBirdGroundSlide`).
     */
    groundContactSlop: 0.16,
    /**
     * Extra decay on horizontal velocity while on the floor (1/s). Does not
     * affect flight — only trims long ground slides so respawn comes sooner.
     * Lower than before: allows a short, subtle skid on landing.
     */
    groundSlideLambda: 4,
  },

  abilities: {
    stocks: { boostForce: 18 },
    crypto: {
      fieldOfImpact: 2.6,
      force: 40,
      damage: 22,
    },
    etfs: { splitCount: 3, splitAngleDeg: 18, radiusScale: 0.7 },
  },
} as const;

/**
 * Starting notional portfolio ($) split by allocation. Final score is the sum of
 * per-category values after each tower applies its return.
 */
export const NOTIONAL_PORTFOLIO_BASE = 10_000;

/**
 * Per-tower slice return bounds (decimals). At **0** blocks cleared the slice
 * earns the **low** (typically negative); at **100%** cleared it earns **high**.
 * Between those, return **linearly** interpolates with cleared / total blocks.
 *
 * Asymmetric lows vs highs mirror typical downside vs upside by asset class
 * (e.g. bonds tight, crypto wide).
 */
export const SLICE_RETURN_BOUNDS: Record<LevelType, { low: number; high: number }> = {
  bonds: { low: -0.02, high: 0.04 },
  etfs: { low: -0.08, high: 0.12 },
  stocks: { low: -0.2, high: 0.25 },
  crypto: { low: -0.3, high: 0.45 },
};

/** Linear return in [low, high] from fraction of blocks cleared [0, 1]. */
export function portfolioReturnPct(
  clearedFraction: number,
  low: number,
  high: number,
): number {
  const f = Math.max(0, Math.min(1, clearedFraction));
  return low + f * (high - low);
}

/** One-line range label for HUD / copy, e.g. "−8% to +12%". */
export function sliceReturnRangeLabel(type: LevelType): string {
  const { low, high } = SLICE_RETURN_BOUNDS[type];
  const down = Math.round(Math.abs(low * 100));
  const up = Math.round(high * 100);
  return `−${down}% to +${up}%`;
}

export function initialInvestmentByAllocation(allocation: Allocation): Record<LevelType, number> {
  const tot = sumAllocation(allocation);
  const denom = tot > 0 ? tot : 100;
  const k = NOTIONAL_PORTFOLIO_BASE / denom;
  return {
    stocks: allocation.stocks * k,
    etfs: allocation.etfs * k,
    bonds: allocation.bonds * k,
    crypto: allocation.crypto * k,
  };
}

export function sumPortfolioValue(inv: Record<LevelType, number>): number {
  return inv.stocks + inv.etfs + inv.bonds + inv.crypto;
}

export function scoreByTypeFromInvestment(inv: Record<LevelType, number>): Record<LevelType, number> {
  return {
    stocks: Math.round(inv.stocks),
    etfs: Math.round(inv.etfs),
    bonds: Math.round(inv.bonds),
    crypto: Math.round(inv.crypto),
  };
}

/** If true, crypto uses discrete volatile outcomes [0.5x, 1.0x, 3.0x]. */
export const CRYPTO_VARIABLE_MODE = true;

/**
 * Larger design frustum so both slingshot (x=-6.5) and the first tower
 * (x=5..10) always fit, with room for cluster (ETFs) extending right.
 */
/**
 * Design frustum for v2. Asymmetric — slingshot sits at x≈-6.5, towers sit
 * around x≈3..13. `top` raised to 14 so the tallest clamped tower (12 rows
 * ≈ 10 world units) fits without any per-frame re-fit. `bottom` nudged to
 * -2.4 so the sand band is always visible.
 */
export const CAMERA_DESIGN: {
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
  z: number;
} = {
  left: -10,
  right: 14,
  top: 14,
  bottom: -2.4,
  near: -10,
  far: 50,
  z: 10,
};

export const CAMERA_BOUNDS = CAMERA_DESIGN;

/** Single source of truth for category visuals + labels. */
export const CATEGORY_META: Record<LevelType, { label: string; accent: string; accentDark: string; blurb: string }> = {
  stocks: {
    label: 'Individual Stocks',
    accent: '#DC2626',
    accentDark: '#7f1d1d',
    blurb: 'High risk, high reward. Harder tower, multiplier usually around 2.0x.',
  },
  etfs: {
    label: 'ETFs',
    accent: '#3B82F6',
    accentDark: '#1e3a8a',
    blurb: 'Medium risk. Clustered towers with a multiplier around 1.5x.',
  },
  bonds: {
    label: 'Bonds',
    accent: '#22C55E',
    accentDark: '#14532d',
    blurb: 'Low risk and predictable. Easier clears, fixed 1.0x multiplier.',
  },
  crypto: {
    label: 'Crypto',
    accent: '#F59E0B',
    accentDark: '#78350f',
    blurb: 'Wild swings. Volatile multiplier can underperform or spike hard.',
  },
};

/** Material palette — used to tint block faces in addition to the category accent. */
export const MATERIAL_META: Record<BlockMaterial, { label: string; tint: string; hp: number; mass: number }> = {
  wood: { label: 'Wood', tint: '#9a6b3a', hp: 1.0, mass: 0.9 },
  stone: { label: 'Stone', tint: '#555b66', hp: 1.6, mass: 1.35 },
  ice: { label: 'Ice', tint: '#9fd6ff', hp: 0.6, mass: 0.6 },
};

export const COLORS = {
  stoneDark: '#3a3a3a',
  stoneMid: '#4a4a4a',
  stoneLight: '#5a5a5a',
  stoneTop: '#6f6f6f',
  stoneMortar: '#2b2b2b',
  birdBody: '#DC2626',
  birdEye: '#ffffff',
  birdEyePupil: '#111111',
  birdBeak: '#fbbf24',
  slingWoodDark: '#6b3410',
  slingWoodLight: '#8B4513',
  slingPouch: '#4a2a18',
  slingBand: '#8B2500',
  trajectoryDot: '#ffffff',
  hitFlash: '#FDE047',
} as const;

export const ORDERED_LEVEL_TYPES: readonly LevelType[] = [
  'stocks',
  'etfs',
  'bonds',
  'crypto',
];

export function makeEmptyAllocation(): Allocation {
  return { stocks: 0, etfs: 0, bonds: 0, crypto: 0 };
}

export function sumAllocation(a: Allocation): number {
  return a.stocks + a.etfs + a.bonds + a.crypto;
}

/** Allocation share 0..1 for a single category. */
export function shareOf(a: Allocation, type: LevelType): number {
  const total = sumAllocation(a);
  if (total <= 0) return 0;
  return a[type] / total;
}

function stableNoise01(input: string): number {
  // Small deterministic hash -> 0..1, so multipliers are stable per round.
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Risk-vs-reward multiplier model.
 * - Bonds: fixed 1.0x (stable)
 * - ETFs/Index funds: 1.4x..1.6x
 * - Individual stocks: 1.8x..2.2x
 * - Crypto: optional volatile mode [0.5x, 1.0x, 3.0x]
 */
export function multiplierForType(
  type: LevelType,
  roundIndex: number,
  share: number,
): number {
  const n = stableNoise01(`${type}:${roundIndex}:${share.toFixed(4)}`);
  switch (type) {
    case 'bonds':
      return 1.0;
    case 'etfs':
      return round2(1.4 + n * 0.2);
    case 'stocks':
      return round2(1.8 + n * 0.4);
    case 'crypto':
      if (!CRYPTO_VARIABLE_MODE) return 2.3;
      return [0.5, 1.0, 3.0][Math.floor(n * 3)] ?? 1.0;
  }
}

/** Bird count for a tower: max(2, round(share * 10)). */
export function birdsFromShare(share: number): number {
  return Math.max(2, Math.round(share * 10));
}

/** Tower height in blocks.
 *  V2: clamped to [3, 12] (was [3, 20]) so the tallest tower fits inside the
 *  fixed frustum (top=14) with no per-frame camera re-fit. */
export function towerHeightFromShare(share: number): number {
  return Math.max(3, Math.min(12, Math.round(share * 14)));
}

export interface AllocationProfile {
  stocks: number;
  etfs: number;
  bonds: number;
  crypto: number;
}

export function getAllocationProfile(allocation: Allocation): AllocationProfile {
  return {
    stocks: shareOf(allocation, 'stocks'),
    etfs: shareOf(allocation, 'etfs'),
    bonds: shareOf(allocation, 'bonds'),
    crypto: shareOf(allocation, 'crypto'),
  };
}

export function categoryLabel(type: LevelType): string {
  return CATEGORY_META[type].label;
}

export function categoryAccent(type: LevelType): string {
  return CATEGORY_META[type].accent;
}

export function categoryAccentDark(type: LevelType): string {
  return CATEGORY_META[type].accentDark;
}

/** Hash an allocation to a string usable as a localStorage key. */
export function allocationKey(a: Allocation): string {
  return `${a.stocks}-${a.etfs}-${a.bonds}-${a.crypto}`;
}
