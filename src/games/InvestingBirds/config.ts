import type { Allocation, LevelType } from './types';

/** Tunables in one place so balance work stays cheap. */
export const GAME_CONFIG = {
  birdRadius: 0.3,
  launchAnchor: { x: -8, y: 1.1 },
  slingPostOffset: { x: 0.52, y: -0.25 },
  slingPostSize: { w: 0.22, h: 1.1 },
  minPullToAim: 0.08,
  minPullToLaunch: 0.18,
  maxDrag: 2.6,
  forceMultiplier: 8.4,
  gravity: 12.5,
  dragDamping: 0.999,
  settleSpeedEpsilon: 0.3,
  settleWindowMs: 650,
  worldBounds: { minX: -24, maxX: 28, minY: -6, maxY: 14 },
  fixedStep: 1 / 120,
  birdMassFactor: 1.35,
  bounceDamping: 0.42,
  /** Score awarded per block knocked completely off the stage. */
  scorePerBlockKnockedOff: 100,
  /** World-Y that counts as "off the stage". Blocks past this are scored + removed. */
  killFloorY: -3,
  /** Rounds pause for this long at ROUND_END to show the transition banner. */
  roundPauseSec: 2.0,
  trajectoryMaxDots: 120,
  /** Parallax drift (world units / sec) */
  parallaxDrift: 0.12,
  /** How long the new-ball respawn takes after a shot settles. */
  respawnDelaySec: 0.35,
} as const;

/** Fixed design window used for level layout and camera fitting. */
export const CAMERA_DESIGN = {
  left: -12,
  right: 14,
  top: 12,
  bottom: -3,
  near: -10,
  far: 50,
  z: 10,
} as const;

export const CAMERA_BOUNDS = CAMERA_DESIGN;

/** Single source of truth for category visuals + labels. */
export const CATEGORY_META: Record<LevelType, { label: string; accent: string }> = {
  stocks: { label: 'Individual Stocks', accent: '#DC2626' },
  etfs: { label: 'ETFs', accent: '#3B82F6' },
  bonds: { label: 'Bonds', accent: '#22C55E' },
  crypto: { label: 'Crypto', accent: '#F59E0B' },
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
  skyTop: '#87CEEB',
  skyBottom: '#C9E8F5',
  sun: '#ffe88a',
  sunCore: '#ffffff',
  cloudLight: '#ffffff',
  cloudDim: '#e6eef5',
  hillFar: '#4a7c2f',
  hillNear: '#3a6322',
  grassLight: '#5a9e3a',
  grassDark: '#4a7c2f',
  grassHorizon: '#315d22',
  treeTrunk: '#6b3410',
  treeCanopy: '#2f5a22',
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
