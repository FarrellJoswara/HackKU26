/**
 * Turn-clearance validator for the DebtRunner path generator.
 *
 * Goal:
 *   Prove that for *any* generated track — across the full range of budget
 *   profile difficulty multipliers and a wide variety of seeds — every
 *   obstacle lands on a straight tile that is at least PRE_TURN_CLEAR_TILES
 *   away from the next turn and at least POST_TURN_CLEAR_TILES away from the
 *   previous turn. In other words: there is always a 1.6s+ obstacle-free
 *   exit corridor after every turn (at base speed), and a 0.8s+ clean
 *   approach window before every turn.
 *
 * What this script does:
 *   1. Iterates over a battery of synthetic BudgetEffects profiles spanning
 *      the realistic range of difficulty multipliers (low / med / high
 *      hazard density, narrow / wide paths, fast / slow movement etc.).
 *   2. For each profile generates several long tracks (480 tiles each) and
 *      runs `validateTrackTurnClearance` on every one.
 *   3. Also reports per-profile statistics: number of turn tiles, number of
 *      cleared tiles around turns, number of obstacle-bearing tiles, and the
 *      minimum observed post-turn obstacle-free segment length in tiles AND
 *      in seconds at base speed. This lets us verify the "1–1.5s window"
 *      gameplay requirement empirically and not just structurally.
 *   4. Exits with a non-zero status code if any violation is found, so it
 *      can be wired into CI later.
 *
 * Run via:  npx tsx scripts/validateTurnClearance.ts
 */

import {
  generateTrackTiles,
  validateTrackTurnClearance,
  PRE_TURN_CLEAR_TILES,
  POST_TURN_CLEAR_TILES,
} from '../src/games/DebtRunner/pathGenerator';
import type { BudgetEffects } from '../src/core/finance/budgetEffectResolver';

const BASE_SPEED = 10; // m/s — see DebtRunner/index.tsx
const TILE_SIZE = 8; // m   — see DebtRunner/pathGenerator.ts
const SECONDS_PER_TILE = TILE_SIZE / BASE_SPEED; // 0.8s

function effects(over: Partial<BudgetEffects> = {}): BudgetEffects {
  return {
    pathHazardMultiplier: 1,
    pathReadability: 1,
    pathNarrowChance: 0.2,
    stumbleTerrainChance: 0.08,
    staminaDrainMultiplier: 1,
    staminaRecoveryMultiplier: 1,
    movementResponseMultiplier: 1,
    turnWindowSeconds: 0.65,
    startingLives: 2,
    injurySlowMultiplier: 1,
    injuryDurationMultiplier: 1,
    debtCollectorScale: 1,
    debtCollectorAggression: 1,
    debtPressureGrowthPerMinute: 1,
    stumbleChancePerSecond: 0.05,
    burnoutDrainMultiplier: 1,
    moraleStartBoost: 0,
    ...over,
  };
}

interface ProfileSpec {
  name: string;
  effects: BudgetEffects;
}

const PROFILES: ProfileSpec[] = [
  { name: 'baseline', effects: effects() },
  { name: 'low-hazard', effects: effects({ pathHazardMultiplier: 0.4 }) },
  { name: 'high-hazard', effects: effects({ pathHazardMultiplier: 1.8 }) },
  { name: 'extreme-hazard', effects: effects({ pathHazardMultiplier: 2.5 }) },
  { name: 'narrow-path', effects: effects({ pathNarrowChance: 0.6, pathHazardMultiplier: 1.4 }) },
  { name: 'low-readability', effects: effects({ pathReadability: 0.3, pathHazardMultiplier: 1.6 }) },
  { name: 'fast-mover', effects: effects({ movementResponseMultiplier: 1.4, pathHazardMultiplier: 1.6 }) },
  { name: 'slow-mover', effects: effects({ movementResponseMultiplier: 0.7, pathHazardMultiplier: 1.6 }) },
  // Intentionally extreme combos — if the rule survives these it survives anything realistic.
  { name: 'pathological', effects: effects({ pathHazardMultiplier: 3, pathReadability: 0.1, pathNarrowChance: 0.9 }) },
];

const TRACKS_PER_PROFILE = 6;
const TILES_PER_TRACK = 480;

interface ProfileSummary {
  name: string;
  tracks: number;
  totalTiles: number;
  turnTiles: number;
  obstacleTiles: number;
  totalObstacles: number;
  minPostTurnGapTiles: number;
  minPostTurnGapSeconds: number;
  violations: number;
}

function postTurnGapTiles(
  tiles: ReturnType<typeof generateTrackTiles>,
  minRoomAfter: number,
): number {
  // Minimum number of consecutive obstacle-free tiles immediately after each
  // turn tile, across the whole track.
  //
  // Why we skip turns that don't have `minRoomAfter` tiles of track left
  // after them: if a turn lands close to the END of the generated array, the
  // gap measurement is truncated by the array bound, not by an obstacle. A
  // raw count would falsely report e.g. "gap = 1 after the final turn"
  // because the array runs out — even though the rule (clear N tiles after
  // every turn) is fully satisfied. Skipping those edge turns measures the
  // rule, not the bookkeeping.
  //
  // The user's requirement is "1–1.5s of NO OBSTACLES after a turn". Turn
  // tiles are themselves obstacle-free, so they EXTEND the count — we only
  // break on a tile that actually carries an obstacle.
  let minGap = Number.POSITIVE_INFINITY;
  for (let i = 0; i < tiles.length; i += 1) {
    if (tiles[i]!.turn === 'straight') continue;
    if (i + minRoomAfter >= tiles.length) continue; // truncated by track end

    let gap = 0;
    for (let j = i + 1; j < tiles.length; j += 1) {
      if (tiles[j]!.obstacles.length === 0) {
        gap += 1;
      } else {
        break;
      }
    }
    minGap = Math.min(minGap, gap);
  }
  return minGap === Number.POSITIVE_INFINITY ? 0 : minGap;
}

function summarise(name: string): ProfileSummary {
  const profile = PROFILES.find((p) => p.name === name)!;
  let totalTiles = 0;
  let turnTiles = 0;
  let obstacleTiles = 0;
  let totalObstacles = 0;
  let minPostTurnGapTiles = Number.POSITIVE_INFINITY;
  let violations = 0;

  for (let trackIdx = 0; trackIdx < TRACKS_PER_PROFILE; trackIdx += 1) {
    // The generator is deterministic per (count, effects). To exercise more
    // variety we vary effects per track via tiny perturbations to the
    // multipliers — these stay within the realistic range while producing
    // distinct tile sequences thanks to the seed = i * 1.37 + multiplier * 10
    // term inside the generator.
    const perturbed: BudgetEffects = {
      ...profile.effects,
      pathHazardMultiplier:
        profile.effects.pathHazardMultiplier + trackIdx * 0.07,
    };
    const tiles = generateTrackTiles(TILES_PER_TRACK, perturbed);
    const result = validateTrackTurnClearance(tiles);
    if (!result.ok) {
      violations += result.violations.length;
      // Print first 3 violations from the first failing track so failure
      // mode is immediately diagnosable.
      for (const v of result.violations.slice(0, 3)) {
        console.error(
          `  [${name} track #${trackIdx}] tile ${v.tileIndex} (${v.tileId}) ${v.reason} (nearest turn: ${v.nearestTurnIndex}, obstacles: ${v.obstacleCount})`,
        );
      }
    }
    totalTiles += tiles.length;
    for (const t of tiles) {
      if (t.turn !== 'straight') turnTiles += 1;
      if (t.obstacles.length > 0) {
        obstacleTiles += 1;
        totalObstacles += t.obstacles.length;
      }
    }
    minPostTurnGapTiles = Math.min(
      minPostTurnGapTiles,
      postTurnGapTiles(tiles, POST_TURN_CLEAR_TILES),
    );
  }

  return {
    name,
    tracks: TRACKS_PER_PROFILE,
    totalTiles,
    turnTiles,
    obstacleTiles,
    totalObstacles,
    minPostTurnGapTiles:
      minPostTurnGapTiles === Number.POSITIVE_INFINITY ? 0 : minPostTurnGapTiles,
    minPostTurnGapSeconds: 0, // filled below
    violations,
  };
}

function main() {
  console.log('========================================================');
  console.log('DebtRunner — Turn Clearance Validator');
  console.log('========================================================');
  console.log(
    `Rule: every turn tile + ${PRE_TURN_CLEAR_TILES} tile(s) before + ${POST_TURN_CLEAR_TILES} tile(s) after must be obstacle-free`,
  );
  console.log(
    `Time budget per tile @ base speed: ${SECONDS_PER_TILE.toFixed(2)}s`,
  );
  console.log(
    `Required post-turn obstacle-free window: ${POST_TURN_CLEAR_TILES} tiles ≈ ${(
      POST_TURN_CLEAR_TILES * SECONDS_PER_TILE
    ).toFixed(2)}s at base speed`,
  );
  console.log('--------------------------------------------------------');

  const summaries = PROFILES.map((p) => {
    const s = summarise(p.name);
    s.minPostTurnGapSeconds = s.minPostTurnGapTiles * SECONDS_PER_TILE;
    return s;
  });

  let totalViolations = 0;
  for (const s of summaries) {
    totalViolations += s.violations;
    const verdict = s.violations === 0 ? 'PASS' : 'FAIL';
    console.log(
      `[${verdict}] ${s.name.padEnd(18)} tracks=${s.tracks} tiles=${s.totalTiles} turns=${s.turnTiles} obstacleTiles=${s.obstacleTiles} totalObstacles=${s.totalObstacles} minPostTurnGap=${s.minPostTurnGapTiles}t (${s.minPostTurnGapSeconds.toFixed(
        2,
      )}s) violations=${s.violations}`,
    );
  }

  console.log('--------------------------------------------------------');
  const overallMinGapSeconds = Math.min(
    ...summaries.map((s) => s.minPostTurnGapSeconds),
  );
  console.log(
    `Overall minimum post-turn obstacle-free window observed: ${overallMinGapSeconds.toFixed(
      2,
    )}s`,
  );
  if (overallMinGapSeconds < 1.0) {
    console.error(
      `FAIL: minimum post-turn window ${overallMinGapSeconds.toFixed(
        2,
      )}s is below the 1.0s requirement.`,
    );
    process.exit(2);
  }

  if (totalViolations > 0) {
    console.error(
      `FAIL: ${totalViolations} clearance violation(s) found across ${PROFILES.length} profiles.`,
    );
    process.exit(1);
  }

  console.log(
    `PASS: all ${PROFILES.length} profiles × ${TRACKS_PER_PROFILE} tracks satisfy the turn-clearance rule.`,
  );
}

main();
