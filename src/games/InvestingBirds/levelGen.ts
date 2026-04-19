/**
 * @file Procedural level layout — tower stacks from portfolio allocation,
 * block materials, and per-level-type bird counts.
 */

import { Vector2 } from 'three';
import {
  birdsForLevelType,
  categoryLabel,
  MATERIAL_META,
  ORDERED_LEVEL_TYPES,
  shareOf,
  towerHeightFromShare,
} from './config';
import type { Allocation, Block, BlockMaterial, LevelDef, LevelType } from './types';

const GROUND_Y = 0;

function createBlock(args: {
  id: string;
  type: LevelType;
  material: BlockMaterial;
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
    material: args.material,
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
    initialY: args.y,
    awake: false,
    falling: false,
    unsupportedFrames: 0,
    toppled: false,
    knockedOff: false,
    shattered: false,
    scored: false,
    isTarget: false,
    isTnt: false,
    opacity: 1,
    hitFlashMs: 0,
    damagePulse: 0,
    cracked: false,
  };
}

export function buildLevels(allocation: Allocation): LevelDef[] {
  const levels: LevelDef[] = [];
  for (const type of ORDERED_LEVEL_TYPES) {
    const share = shareOf(allocation, type);
    if (share <= 0) continue;
    levels.push({
      type,
      share,
      birds: birdsForLevelType(type, share),
      label: categoryLabel(type),
    });
  }
  return levels;
}

const BLOCK_W = 0.68;
const BLOCK_H = 0.8;
const COL_GAP = 0.015;

/** Pick a material for a row — lower rows are sturdier (stone), top is lighter. */
function materialForRow(
  type: LevelType,
  row: number,
  height: number,
): BlockMaterial {
  const topThird = row >= Math.ceil(height * 0.66);
  const bottomHalf = row < Math.ceil(height * 0.5);
  // Per-category flavor: Stocks = volatile (wood heavy), ETFs = mixed,
  // Bonds = solid stone, Crypto = ice+wood (shatters easily).
  switch (type) {
    case 'stocks':
      return bottomHalf ? 'stone' : topThird ? 'ice' : 'wood';
    case 'etfs':
      return row % 2 === 0 ? 'stone' : 'wood';
    case 'bonds':
      // Bonds are low-risk and intentionally easier/predictable.
      return bottomHalf ? 'wood' : 'wood';
    case 'crypto':
      return topThird ? 'ice' : 'wood';
  }
}

function durabilityScale(type: LevelType): { hp: number; mass: number } {
  switch (type) {
    case 'stocks':
      // Hardest standard tower, but still winnable.
      return { hp: 1.08, mass: 1.05 };
    case 'etfs':
      return { hp: 0.96, mass: 0.95 };
    case 'bonds':
      return { hp: 0.86, mass: 0.9 };
    case 'crypto':
      return { hp: 1.0, mass: 0.95 };
  }
}

function applyMaterial(hp: number, mass: number, material: BlockMaterial) {
  const meta = MATERIAL_META[material];
  return { hp: Math.round(hp * meta.hp), mass: mass * meta.mass };
}

/** Deterministic 0..1 from a key — stable layout for the same allocation. */
function stableRandom01(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Per ETF mini-tower: stable difficulty 0 (easy) → 1 (hard). */
function etfTowerDifficulty(seed: string, towerIndex: number): number {
  return stableRandom01(`${seed}|towerDiff|${towerIndex}`);
}

/**
 * Easy towers skew ice/wood; hard towers skew stone. Each cell is still
 * randomized so blocks span “easy” to “hard” materials within a tower.
 */
function pickEtfBlockMaterial(
  seed: string,
  towerIndex: number,
  row: number,
  col: number,
  difficulty: number,
): BlockMaterial {
  const r = stableRandom01(`${seed}|mat|${towerIndex}|${row}|${col}`);
  const iceProb = (1 - difficulty) * 0.48;
  const stoneProb = 0.06 + difficulty * 0.58;
  if (r < iceProb) return 'ice';
  if (r < iceProb + stoneProb) return 'stone';
  return 'wood';
}

type PickBlockMaterial = (ctx: {
  row: number;
  col: number;
  height: number;
}) => BlockMaterial;

function buildSingleTower(
  type: LevelType,
  originX: number,
  height: number,
  hp: number,
  mass: number,
  idPrefix: string,
  pickMaterial?: PickBlockMaterial,
  columns = 3,
): Block[] {
  const out: Block[] = [];
  const baseH = BLOCK_H * 1.1;
  let cursorY = GROUND_Y;
  for (let row = 0; row < height; row += 1) {
    const isBase = row === 0;
    const w = isBase ? BLOCK_W * 1.2 : BLOCK_W;
    const h = isBase ? baseH : BLOCK_H;
    const y = cursorY + h / 2;
    cursorY += h;
    for (let col = 0; col < columns; col += 1) {
      const material: BlockMaterial = isBase
        ? 'stone'
        : pickMaterial
          ? pickMaterial({ row, col, height })
          : materialForRow(type, row, height);
      const scaled = applyMaterial(hp, mass, material);
      const colOffset = (col - (columns - 1) / 2) * (w + COL_GAP);
      const x = originX + colOffset;
      out.push(
        createBlock({
          id: `${idPrefix}-${row}-${col}`,
          type,
          material,
          x,
          y,
          width: w,
          height: h,
          health: scaled.hp,
          mass: scaled.mass,
          column: col,
          row,
        }),
      );
    }
  }
  return out;
}

type PickMiniMaterial = (ctx: { row: number; col: number; height: number }) => BlockMaterial;

function buildMiniTower(
  type: LevelType,
  originX: number,
  height: number,
  hp: number,
  mass: number,
  idPrefix: string,
  pickMaterial?: PickMiniMaterial,
): Block[] {
  const out: Block[] = [];
  const columns = 2;
  const w = BLOCK_W * 0.9;
  const h = BLOCK_H * 0.9;
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const material: BlockMaterial = pickMaterial
        ? pickMaterial({ row, col, height })
        : materialForRow(type, row, height);
      const scaled = applyMaterial(hp, mass, material);
      const colOffset = (col - (columns - 1) / 2) * (w + COL_GAP);
      const x = originX + colOffset;
      const y = GROUND_Y + h / 2 + row * h;
      out.push(
        createBlock({
          id: `${idPrefix}-${row}-${col}`,
          type,
          material,
          x,
          y,
          width: w,
          height: h,
          health: scaled.hp,
          mass: scaled.mass,
          column: col,
          row,
        }),
      );
    }
  }
  return out;
}

/**
 * Per-tower post processing.
 * V2 clarity pass: removed "target coin" markers and target-bonus blocks
 * because they read as noisy/unclear in dense towers. TNT remains as the
 * only special block type.
 */
function markTargets(blocks: Block[]): Block[] {
  const groups = new Map<string, Block[]>();
  for (const b of blocks) {
    const prefix = b.id.split('-')[0] ?? '';
    const arr = groups.get(prefix) ?? [];
    arr.push(b);
    groups.set(prefix, arr);
  }
  for (const arr of groups.values()) {
    if (arr.length === 0) continue;
    let topRow = -Infinity;
    for (const b of arr) if (b.row > topRow) topRow = b.row;

    // G5: promote one mid-tower block per tower to TNT when the tower is
    // tall enough (>= 4 rows). Deterministic by tower prefix so the same
    // allocation always reads the same layout.
    if (topRow >= 3) {
      const midRow = Math.max(1, Math.floor(topRow / 2));
      const midRowBlocks = arr.filter((b) => b.row === midRow);
      if (midRowBlocks.length > 0) {
        midRowBlocks.sort((a, b) => a.column - b.column);
        const pick = midRowBlocks[Math.floor(midRowBlocks.length / 2)]!;
        pick.isTnt = true;
      }
    }
  }
  return blocks;
}

export function generateBlocksForLevel(level: LevelDef): Block[] {
  const height = towerHeightFromShare(level.share);
  // V2: baseline HP raised from (10 + share*12) to (22 + share*20). Combined
  // with birdMassFactor=1.0 this gives wood blocks ~2 hits and base stone
  // ~3 hits per block — a full tower needs 2–3 well-placed birds.
  const baseHp = Math.round(22 + level.share * 20);
  const baseMass = 0.7 + level.share * 0.5;
  const scale = durabilityScale(level.type);
  const hp = Math.round(baseHp * scale.hp);
  const mass = baseMass * scale.mass;

  if (level.type === 'etfs') {
    const clusterCount = 5;
    const etfSeed = `etf:${level.share.toFixed(6)}`;
    const minRows = 3;
    const maxRows = Math.max(minRows, Math.min(10, Math.round(height * 0.72)));
    const baseX = 3.1;
    const spacing = 1.92;
    const out: Block[] = [];
    for (let i = 0; i < clusterCount; i += 1) {
      const diff = etfTowerDifficulty(etfSeed, i);
      const heightJitter = stableRandom01(`${etfSeed}|hJit|${i}`);
      const heightT = diff * 0.82 + heightJitter * 0.18;
      const rowCount = Math.max(
        minRows,
        Math.min(maxRows, Math.round(minRows + heightT * (maxRows - minRows))),
      );
      const originX = baseX + i * spacing;
      out.push(
        ...buildMiniTower(level.type, originX, rowCount, hp, mass, `etf${i}`, ({ row, col }) =>
          pickEtfBlockMaterial(etfSeed, i, row, col, diff),
        ),
      );
    }
    return markTargets(out);
  }

  if (level.type === 'bonds') {
    const originX = 4.8;
    const bondsHeight = Math.max(3, Math.round(height * 0.7));
    return markTargets(
      buildSingleTower(level.type, originX, bondsHeight, hp, mass, level.type),
    );
  }
  if (level.type === 'crypto') {
    const originX = 5.4;
    const cryptoSeed = `crypto:${level.share.toFixed(6)}`;
    // Tall brittle stack: push height within frustum; fewer blocks (2 columns) vs other towers.
    const cryptoHeight = Math.min(14, Math.max(8, Math.round(height * 1.28)));
    return markTargets(
      buildSingleTower(
        level.type,
        originX,
        cryptoHeight,
        hp,
        mass,
        level.type,
        ({ row, col, height: H }) => {
          // Bottom rows: a bit more stone footing; mid/top: mostly ice, sparse stone anchors, touch of wood.
          const r = stableRandom01(`${cryptoSeed}|m|${row}|${col}|${H}`);
          if (row <= 1 && r < 0.45) return 'stone';
          if (r < 0.16) return 'stone';
          if (r < 0.9) return 'ice';
          return 'wood';
        },
        2,
      ),
    );
  }

  if (level.type === 'stocks') {
    const originX = 5;
    const stockHeight = height * 2;
    const seed = `stocks:${level.share.toFixed(6)}`;
    return markTargets(
      buildSingleTower(level.type, originX, stockHeight, hp, mass, level.type, ({ row, col, height: H }) => {
        // Strong (stone) vs weak (ice) — random mix per cell, stable for this allocation.
        return stableRandom01(`${seed}|${row}|${col}|${H}`) < 0.5 ? 'stone' : 'ice';
      }),
    );
  }

  const originX = 5;
  return markTargets(
    buildSingleTower(level.type, originX, height, hp, mass, level.type),
  );
}
