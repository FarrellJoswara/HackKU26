/**
 * @file Pure helper for "did the player just complete a lap?" decisions.
 *
 * Single source-of-truth rule (referenced from `IslandRun/main.ts` and
 * `GAME_DESIGN.md`):
 *
 *     totalHops > 0 && totalHops % NUM_SQUARES === 0
 *
 * The helper returns the **new** total hops, the lap count, and a
 * `lapCompletedThisStep` boolean — the caller emits `island:yearComplete`
 * exactly once when this flips true. Re-entrant emits while a transition
 * is in flight should be guarded by the caller.
 */

export const NUM_SQUARES = 12;

export interface LapStep {
  /** Hop counter after this step. */
  totalHops: number;
  /** Total laps completed so far (0 before the first lap). */
  laps: number;
  /** True iff this step *just* completed a lap (caller should fire once). */
  lapCompletedThisStep: boolean;
}

export function advanceHops(
  prevTotalHops: number,
  hopsThisStep: number,
  numSquares: number = NUM_SQUARES,
): LapStep {
  const safePrev = Number.isFinite(prevTotalHops) && prevTotalHops > 0 ? Math.floor(prevTotalHops) : 0;
  const safeStep = Number.isFinite(hopsThisStep) && hopsThisStep > 0 ? Math.floor(hopsThisStep) : 0;
  const safeMod = Number.isFinite(numSquares) && numSquares > 0 ? Math.floor(numSquares) : 1;

  const totalHops = safePrev + safeStep;
  const laps = Math.floor(totalHops / safeMod);
  const prevLaps = Math.floor(safePrev / safeMod);
  return {
    totalHops,
    laps,
    lapCompletedThisStep: laps > prevLaps,
  };
}
