import type { Allocation, BlockMaterial, LevelType } from './types';

/** Tunables in one place so balance work stays cheap. */
export const GAME_CONFIG = {
  birdRadius: 0.34,
  /** Slingshot sits closer to the left edge of the design frustum. */
  launchAnchor: { x: -6.5, y: 1.2 },
  slingPostOffset: { x: 0.52, y: -0.25 },
  slingPostSize: { w: 0.22, h: 1.1 },
  minPullToAim: 0.08,
  minPullToLaunch: 0.18,
  maxDrag: 2.4,
  /** Rebalanced in P12 — 9.5 makes a full pull clear 1 tower consistently. */
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
  /** Rebalanced in P12 — 1.25 lets heavy shots pierce but not one-shot towers. */
  birdMassFactor: 1.25,
  /**
   * Post-hit velocity retention for the bird. ~0.6 means the bird keeps 60%
   * of its forward speed through each block so a hard shot can punch
   * through the first tower and still carry into the second.
   */
  bounceDamping: 0.6,
  /** Score awarded per block that is cleared (toppled or off-stage). */
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
  /** Duration of the post-launch "woosh" streak. */
  launchStreakSec: 0.35,
  /** Heavy hit threshold for slow-mo + vignette. */
  heavyHitForce: 11,
  /** Hard cap on bird speed — prevents runaway acceleration after impacts. */
  maxBirdSpeed: 20,
  /** Hard cap on block speed so toppled blocks don't launch off-screen. */
  maxBlockSpeed: 18,
} as const;

/**
 * Larger design frustum so both slingshot (x=-6.5) and the first tower
 * (x=5..10) always fit, with room for cluster (ETFs) extending right.
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
  top: 10,
  bottom: -2.2,
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
    blurb: 'High reward, high volatility. Biggest multiplier — and biggest tower.',
  },
  etfs: {
    label: 'ETFs',
    accent: '#3B82F6',
    accentDark: '#1e3a8a',
    blurb: 'Diversified buckets — a cluster of small towers, easier to clear.',
  },
  bonds: {
    label: 'Bonds',
    accent: '#22C55E',
    accentDark: '#14532d',
    blurb: 'Steady, low risk. Short dense fortress with a modest payout.',
  },
  crypto: {
    label: 'Crypto',
    accent: '#F59E0B',
    accentDark: '#78350f',
    blurb: 'Wild swings. Fewer blocks, steep rewards if you clear.',
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

/** Multiplier = 1 + share * 3, rounded to 2 decimals. */
export function multiplierFromShare(share: number): number {
  return Math.round((1 + share * 3) * 100) / 100;
}

/** Bird count for a tower: max(2, round(share * 10)). */
export function birdsFromShare(share: number): number {
  return Math.max(2, Math.round(share * 10));
}

/** Tower height in blocks: round(share * 20), clamped to [3, 20]. */
export function towerHeightFromShare(share: number): number {
  return Math.max(3, Math.min(20, Math.round(share * 20)));
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
