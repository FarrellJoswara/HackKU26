/**
 * @file Procedural beach track generation — straights, turns, obstacles, and
 * clearance validation. Tunable from resolved `BudgetEffects` so the budget
 * profile changes how the run *feels*, not just numbers in the HUD.
 */

import type { BudgetEffects } from '@/core/finance/budgetEffectResolver';
import type { Heading, ObstacleKind, ObstacleSpec, TrackTile, TurnDirection } from './types';

const TILE_SIZE = 8;

/**
 * Number of straight tiles either side of a turn tile that must be free of
 * obstacles. Player base speed is 10 m/s and a tile is 8 m, so 1 tile ≈ 0.8s
 * of travel.
 *
 *   - PRE_TURN_CLEAR_TILES = 1  ->  ≥ 0.8s of clean approach (player can read
 *                                   the upcoming turn without dodging)
 *   - POST_TURN_CLEAR_TILES = 2 ->  ≥ 1.6s of clean exit (satisfies the
 *                                   "1–1.5s of NO obstacles after a turn"
 *                                   gameplay requirement; the exact value
 *                                   stretches to ~1.3–2.0s once the budget
 *                                   profile's `movementResponseMultiplier`
 *                                   is applied)
 *
 * Together with always clearing the turn tile itself, this guarantees that
 * obstacles only appear on straight pathway segments at least one tile away
 * from any turn — see {@link validateTrackTurnClearance} for the runnable
 * proof.
 */
export const PRE_TURN_CLEAR_TILES = 1;
export const POST_TURN_CLEAR_TILES = 2;

const HAZARD_LABELS: Record<ObstacleKind, string[]> = {
  block: ['Driftwood', 'Broken Board', 'Beach Debris'],
  low: ['Low Dock Beam', 'Rent Issue Sign', 'Late Fee Banner'],
  high: ['Medical Expense Gate', 'Car Repair Arch', 'Boardwalk Rail'],
  hazard: ['Interest Spike Patch', 'Slippery Water', 'Burnout Sand'],
};

function rand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function nextHeading(heading: Heading, turn: TurnDirection): Heading {
  if (turn === 'straight') return heading;
  if (heading === 'north') return turn === 'left' ? 'west' : 'east';
  if (heading === 'south') return turn === 'left' ? 'east' : 'west';
  if (heading === 'east') return turn === 'left' ? 'north' : 'south';
  return turn === 'left' ? 'south' : 'north';
}

function moveCoord(x: number, z: number, heading: Heading) {
  if (heading === 'north') return { x, z: z - TILE_SIZE };
  if (heading === 'south') return { x, z: z + TILE_SIZE };
  if (heading === 'east') return { x: x + TILE_SIZE, z };
  return { x: x - TILE_SIZE, z };
}

function pickObstacle(seed: number, lane: -1 | 0 | 1): ObstacleSpec {
  // 'hazard' (cyan pulsing puddles) intentionally excluded — they read as
  // distracting blue blobs in the player's forward view. Path difficulty is
  // still carried by block / low / high obstacles + slippery / narrow tiles.
  const kinds: ObstacleKind[] = ['block', 'low', 'high'];
  const kind = kinds[Math.floor(rand(seed) * kinds.length)] ?? 'block';
  const labels = HAZARD_LABELS[kind];
  const label = labels[Math.floor(rand(seed + 1) * labels.length)] ?? labels[0] ?? 'Hazard';
  return { lane, kind, label };
}

export function generateTrackTiles(count: number, effects: BudgetEffects): TrackTile[] {
  const tiles: TrackTile[] = [];
  let heading: Heading = 'north';
  let x = 0;
  let z = 0;
  let sinceLastTurn = 4;

  for (let i = 0; i < count; i += 1) {
    const seed = i * 1.37 + effects.pathHazardMultiplier * 10;
    const teachPhase = i < 16;
    const turnBias = teachPhase ? 0.16 : 0.28 + (1 - effects.pathReadability) * 0.18;
    const roll = rand(seed);
    const canTurn = sinceLastTurn >= 2;
    const turn: TurnDirection =
      canTurn && roll < turnBias ? (rand(seed + 3) > 0.5 ? 'left' : 'right') : 'straight';
    const wear = effects.pathVisualWear01 ?? 0;
    const medStress = effects.medicalTerrainStress ?? 0;
    const narrow =
      rand(seed + 5) < Math.min(0.72, effects.pathNarrowChance + wear * 0.14);
    const slippery =
      rand(seed + 6) <
      Math.min(0.38, effects.stumbleTerrainChance + wear * 0.1 + medStress);
    const hazardChance = Math.min(0.82, (teachPhase ? 0.24 : 0.33) * effects.pathHazardMultiplier);
    const obstacleCount = rand(seed + 7) < hazardChance ? (rand(seed + 8) < 0.65 ? 1 : 2) : 0;
    const obstacles: ObstacleSpec[] = [];

    for (let n = 0; n < obstacleCount; n += 1) {
      const laneRoll = rand(seed + 9 + n * 2);
      const lane = (laneRoll < 0.33 ? -1 : laneRoll < 0.66 ? 0 : 1) as -1 | 0 | 1;
      obstacles.push(pickObstacle(seed + 11 + n * 3, lane));
    }

    tiles.push({
      id: `tile-${i}`,
      x,
      z,
      heading,
      turn,
      narrow,
      slippery,
      obstacles,
    });

    heading = nextHeading(heading, turn);
    sinceLastTurn = turn === 'straight' ? sinceLastTurn + 1 : 0;
    const moved = moveCoord(x, z, heading);
    x = moved.x;
    z = moved.z;
  }

  // POST-PASS: enforce the obstacle-clearance rule around every turn.
  //
  // Spawning obstacles inside the obstacle-list during the main loop makes
  // density tunable per profile, but a turn tile or its immediate neighbours
  // must NEVER carry an obstacle regardless of difficulty. We therefore wipe
  // obstacles on:
  //
  //   1. Every turn tile itself
  //   2. The PRE_TURN_CLEAR_TILES tiles immediately preceding each turn
  //   3. The POST_TURN_CLEAR_TILES tiles immediately following each turn
  //
  // This is the single source of truth for the "no obstacles on/around
  // turns" gameplay rule. See `validateTrackTurnClearance` for the
  // executable assertion that proves it holds.
  for (let i = 0; i < tiles.length; i += 1) {
    const tile = tiles[i]!;
    if (tile.turn === 'straight') continue;
    const lo = Math.max(0, i - PRE_TURN_CLEAR_TILES);
    const hi = Math.min(tiles.length - 1, i + POST_TURN_CLEAR_TILES);
    for (let j = lo; j <= hi; j += 1) {
      tiles[j]!.obstacles = [];
    }
  }

  return tiles;
}

/**
 * Validates that a generated track honours the turn-clearance rule:
 *
 *   - Every tile with `turn !== 'straight'` has zero obstacles.
 *   - Every straight tile within `PRE_TURN_CLEAR_TILES` BEFORE a turn has
 *     zero obstacles.
 *   - Every straight tile within `POST_TURN_CLEAR_TILES` AFTER a turn has
 *     zero obstacles.
 *
 * Returns `{ ok: true }` if the rule holds for every tile, otherwise
 * `{ ok: false, violations }` where `violations` lists each tile that
 * carries an obstacle when it shouldn't (with the index of the nearest turn
 * tile and the reason). Used by both the runtime self-check at game start
 * and the standalone `scripts/validateTurnClearance.ts` validator.
 */
export interface TurnClearanceViolation {
  tileIndex: number;
  tileId: string;
  reason: 'turn-tile-has-obstacle' | 'pre-turn-window' | 'post-turn-window';
  nearestTurnIndex: number;
  obstacleCount: number;
}

export function validateTrackTurnClearance(tiles: TrackTile[]): {
  ok: boolean;
  violations: TurnClearanceViolation[];
} {
  const violations: TurnClearanceViolation[] = [];

  for (let i = 0; i < tiles.length; i += 1) {
    const tile = tiles[i]!;
    if (tile.obstacles.length === 0) continue;

    if (tile.turn !== 'straight') {
      violations.push({
        tileIndex: i,
        tileId: tile.id,
        reason: 'turn-tile-has-obstacle',
        nearestTurnIndex: i,
        obstacleCount: tile.obstacles.length,
      });
      continue;
    }

    // Search a small window for any nearby turn tile. We bound the search by
    // the maximum clear radius so we don't waste work on long straightaways.
    const radius = Math.max(PRE_TURN_CLEAR_TILES, POST_TURN_CLEAR_TILES);
    for (let d = 1; d <= radius; d += 1) {
      const before = tiles[i - d];
      if (before && before.turn !== 'straight' && d <= POST_TURN_CLEAR_TILES) {
        violations.push({
          tileIndex: i,
          tileId: tile.id,
          reason: 'post-turn-window',
          nearestTurnIndex: i - d,
          obstacleCount: tile.obstacles.length,
        });
        break;
      }
      const after = tiles[i + d];
      if (after && after.turn !== 'straight' && d <= PRE_TURN_CLEAR_TILES) {
        violations.push({
          tileIndex: i,
          tileId: tile.id,
          reason: 'pre-turn-window',
          nearestTurnIndex: i + d,
          obstacleCount: tile.obstacles.length,
        });
        break;
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

