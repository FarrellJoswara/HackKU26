import { Vector2 } from 'three';
import {
  birdsFromShare,
  categoryLabel,
  multiplierFromShare,
  ORDERED_LEVEL_TYPES,
  shareOf,
  towerHeightFromShare,
} from './config';
import type { Allocation, Block, LevelDef, LevelType } from './types';

const GROUND_Y = 0;

function createBlock(args: {
  id: string;
  type: LevelType;
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  mass: number;
  column: number;
  row: number;
}): Block {
  return {
    id: args.id,
    type: args.type,
    position: new Vector2(args.x, args.y),
    velocity: new Vector2(0, 0),
    rotation: 0,
    rotationVel: 0,
    width: args.width,
    height: args.height,
    health: args.health,
    maxHealth: args.health,
    mass: args.mass,
    column: args.column,
    row: args.row,
    falling: false,
    knockedOff: false,
    scored: false,
    opacity: 1,
    hitFlashMs: 0,
    damagePulse: 0,
    cracked: false,
  };
}

/**
 * Build the ordered list of rounds. Each non-zero allocation becomes a level.
 */
export function buildLevels(allocation: Allocation): LevelDef[] {
  const levels: LevelDef[] = [];
  for (const type of ORDERED_LEVEL_TYPES) {
    const share = shareOf(allocation, type);
    if (share <= 0) continue;
    levels.push({
      type,
      share,
      multiplier: multiplierFromShare(share),
      birds: birdsFromShare(share),
      label: categoryLabel(type),
    });
  }
  return levels;
}

const BLOCK_W = 0.68;
const BLOCK_H = 0.8;
/** Extra nudge so adjacent columns don't phantom-overlap. */
const COL_GAP = 0.015;

/**
 * Build a single castle-style tower: 3 columns × `height` rows with a slightly
 * wider base row for that "castle" look.
 */
function buildSingleTower(
  type: LevelType,
  originX: number,
  height: number,
  hp: number,
  mass: number,
  idPrefix: string,
): Block[] {
  const out: Block[] = [];
  const columns = 3;
  for (let row = 0; row < height; row += 1) {
    const isBase = row === 0;
    const w = isBase ? BLOCK_W * 1.2 : BLOCK_W;
    const h = isBase ? BLOCK_H * 1.1 : BLOCK_H;
    for (let col = 0; col < columns; col += 1) {
      const colOffset = (col - (columns - 1) / 2) * (w + COL_GAP);
      const x = originX + colOffset;
      const y = GROUND_Y + h / 2 + row * BLOCK_H;
      out.push(
        createBlock({
          id: `${idPrefix}-${row}-${col}`,
          type,
          x,
          y,
          width: w,
          height: h,
          health: hp,
          mass,
          column: col,
          row,
        }),
      );
    }
  }
  return out;
}

function buildMiniTower(
  type: LevelType,
  originX: number,
  height: number,
  hp: number,
  mass: number,
  idPrefix: string,
): Block[] {
  const out: Block[] = [];
  const columns = 2;
  const w = BLOCK_W * 0.9;
  const h = BLOCK_H * 0.9;
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const colOffset = (col - (columns - 1) / 2) * (w + COL_GAP);
      const x = originX + colOffset;
      const y = GROUND_Y + h / 2 + row * h;
      out.push(
        createBlock({
          id: `${idPrefix}-${row}-${col}`,
          type,
          x,
          y,
          width: w,
          height: h,
          health: hp,
          mass,
          column: col,
          row,
        }),
      );
    }
  }
  return out;
}

/**
 * Generate all blocks for a level. Stocks/Bonds/Crypto → one tall tower.
 * ETFs → cluster of 3–6 smaller towers.
 */
export function generateBlocksForLevel(level: LevelDef): Block[] {
  const height = towerHeightFromShare(level.share);
  const hp = Math.round(18 + level.share * 22);
  const mass = 1 + level.share * 0.8;

  if (level.type === 'etfs') {
    const clusterCount = Math.max(3, Math.min(6, Math.round(3 + level.share * 4)));
    const miniHeight = Math.max(3, Math.min(10, Math.round(height * 0.55)));
    const baseX = 3;
    const spacing = 1.85;
    const out: Block[] = [];
    for (let i = 0; i < clusterCount; i += 1) {
      const originX = baseX + i * spacing;
      const rowCount = Math.max(
        3,
        miniHeight - Math.floor(Math.abs(i - (clusterCount - 1) / 2)),
      );
      out.push(...buildMiniTower(level.type, originX, rowCount, hp, mass, `etf${i}`));
    }
    return out;
  }

  const originX = 5;
  return buildSingleTower(level.type, originX, height, hp, mass, level.type);
}
