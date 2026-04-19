import type { Allocation, BlockMaterial, LevelType, RoundPlan } from './types';

/** Matches InvestingBirds2 orthographic design frustum. */
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

/** Slingshot layout — same numbers as InvestingBirds2 `GAME_CONFIG`. */
export const SLING = {
  launchAnchor: { x: -6.5, y: 1.2 },
  postOffset: { x: 0.52, y: -0.25 },
  postSize: { w: 0.22, h: 1.1 },
} as const;

export const ORDERED_LEVEL_TYPES: readonly LevelType[] = [
  'stocks',
  'etfs',
  'bonds',
  'crypto',
];

export const CATEGORY_META: Record<
  LevelType,
  { label: string; accent: string; accentDark: string; blurb: string }
> = {
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

export const MATERIAL_META: Record<
  BlockMaterial,
  { label: string; tint: string; hp: number; mass: number }
> = {
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

/** If true, crypto rounds roll discrete 0.5× / 1.0× / 3.0× style outcomes. */
export const CRYPTO_VARIABLE_MODE = true;

export const GAME_TUNING = {
  gravityY: -28,
  fixedStep: 1 / 120,
  slingAnchor: { x: SLING.launchAnchor.x, y: SLING.launchAnchor.y },
  maxDrag: 2.4,
  launchImpulseScale: 9.2,
  birdRadius: 0.34,
  pigRadius: 0.38,
  /** Box half-extents (wide plank). */
  plankHalfW: 0.48,
  plankHalfH: 0.22,
  pigMaxHp: 92,
  /** Impulse → damage for pig when bird is involved. */
  pigDamagePerImpulse: 0.38,
  birdLinearDamping: 0.04,
  birdAngularDamping: 0.35,
  settleSpeed: 0.12,
  settleHoldSec: 0.95,
  killY: -3,
  /** Mid-air ability — stocks dash. */
  stocksBoostImpulse: 10,
  /** ETFs — impulse applied to nearby blocks. */
  etfRippleRadius: 4.2,
  etfRippleImpulse: 3.8,
  /** Crypto — radial blast. */
  cryptoBlastRadius: 3.1,
  cryptoBlastImpulse: 14,
  scorePerPigHit: 35,
  scorePerPigClear: 420,
  scorePerBlockOffstage: 55,
  trajectoryMaxDots: 64,
} as const;

export function makeEmptyAllocation(): Allocation {
  return { stocks: 0, etfs: 0, bonds: 0, crypto: 0 };
}

export function sumAllocation(a: Allocation): number {
  return a.stocks + a.etfs + a.bonds + a.crypto;
}

export function shareOf(a: Allocation, t: LevelType): number {
  const s = sumAllocation(a);
  if (s <= 0) return 0;
  return a[t] / s;
}

export function allocationKey(a: Allocation): string {
  return `${a.stocks}-${a.etfs}-${a.bonds}-${a.crypto}`;
}

function stable01(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Risk / reward multipliers (concept aligned with earlier prototypes).
 * Bonds stable, ETFs mid-band, stocks high band, crypto discrete volatility.
 */
export function multiplierForType(
  type: LevelType,
  roundIndex: number,
  share: number,
): number {
  const n = stable01(`${type}:${roundIndex}:${share.toFixed(4)}`);
  switch (type) {
    case 'bonds':
      return 1.0;
    case 'etfs':
      return round2(1.4 + n * 0.2);
    case 'stocks':
      return round2(1.8 + n * 0.4);
    case 'crypto':
      if (!CRYPTO_VARIABLE_MODE) return 2.2;
      return [0.5, 1.0, 3.0][Math.floor(n * 3)] ?? 1.0;
  }
}

export function birdsFromShare(share: number): number {
  return Math.max(2, Math.round(share * 10));
}

/** Tower height in planks per column (clamped for orthographic view). */
export function towerHeightFromShare(share: number): number {
  return Math.max(3, Math.min(12, Math.round(share * 14)));
}

export function buildRoundPlans(allocation: Allocation): RoundPlan[] {
  return ORDERED_LEVEL_TYPES.map((type, idx) => {
    const sh = shareOf(allocation, type);
    return {
      type,
      share: sh,
      multiplier: multiplierForType(type, idx, sh),
      birds: birdsFromShare(sh),
      label: CATEGORY_META[type].label,
    };
  });
}

export function categoryAccent(type: LevelType): string {
  return CATEGORY_META[type].accent;
}

export function categoryLabel(type: LevelType): string {
  return CATEGORY_META[type].label;
}
