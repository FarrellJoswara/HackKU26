import { createContext, useContext, type MutableRefObject } from 'react';
import type { Vector2 } from 'three';
import type { Bird, Block } from './types';

/**
 * @file The single mutable bag of simulation state shared between the sim loop
 * (`SimDriver`), the scene's imperative mesh updater (`SceneUpdater`), and
 * the input layer.
 *
 * Contrast with the reducer: the reducer only holds state that DOM React
 * needs to re-render on change (score, birds remaining, modal flags,
 * floater lists, round outcome). Everything else — bird position, block
 * physics, drag anchors — lives here and mutates in place so we don't pay
 * for a React reconciliation at 120 Hz.
 */
export interface SimData {
  elapsedSec: number;
  bird: Bird | null;
  blocks: Block[];
  dragStart: Vector2 | null;
  dragEnd: Vector2 | null;
  aiming: boolean;
  accumulator: number;
  hasLaunchedOnce: boolean;
  shotEndedAtSec: number | null;
  scoredBlocks: Set<string>;
  nextFloaterId: number;
  nextDamageId: number;
  nextDustId: number;
  prevBlockY: Map<string, number>;
  pullRatio: number;
  slowMoUntilSec: number;
  slowMoFiredForLaunchAt: number | null;
  lastLaunchAt: number | null;
  lastLaunchPos: Vector2 | null;
  lastLaunchDir: Vector2 | null;
  /** Latest pointer world coords — used only for the aim-hint debug arrow. */
  pointerWorldX: number;
  pointerWorldY: number;
  /** Set when a keyboard Space press wants to fire next frame. */
  pendingKeyboardLaunch: boolean;
  /** When the current resting bird was spawned. Drives hop-onto-pouch. */
  birdSpawnedAtSec: number | null;
  /** Timestamp when we entered post-last-bird countdown. */
  outOfBirdsAtSec: number | null;
  /** Deadline for automatic out-of-birds transition. */
  failureDueAtSec: number | null;
}

export function createSimData(): SimData {
  return {
    elapsedSec: 0,
    bird: null,
    blocks: [],
    dragStart: null,
    dragEnd: null,
    aiming: false,
    accumulator: 0,
    hasLaunchedOnce: false,
    shotEndedAtSec: null,
    scoredBlocks: new Set(),
    nextFloaterId: 1,
    nextDamageId: 1,
    nextDustId: 1,
    prevBlockY: new Map(),
    pullRatio: 0,
    slowMoUntilSec: 0,
    slowMoFiredForLaunchAt: null,
    lastLaunchAt: null,
    lastLaunchPos: null,
    lastLaunchDir: null,
    pointerWorldX: 0,
    pointerWorldY: 0,
    pendingKeyboardLaunch: false,
    birdSpawnedAtSec: null,
    outOfBirdsAtSec: null,
    failureDueAtSec: null,
  };
}

export type SimRef = MutableRefObject<SimData>;

export const SimRefContext = createContext<SimRef | null>(null);

export function useSimRef(): SimRef {
  const ref = useContext(SimRefContext);
  if (!ref) {
    throw new Error('useSimRef must be called inside <SimRefContext.Provider>');
  }
  return ref;
}
