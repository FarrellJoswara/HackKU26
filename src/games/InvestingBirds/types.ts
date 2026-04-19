import type { Vector2 } from 'three';

export type InvestingBirdsState =
  | 'ALLOCATE'
  | 'INIT_LEVELS'
  | 'PLAYING'
  | 'ROUND_END'
  | 'GAME_END';

/** Investment categories. */
export type LevelType = 'stocks' | 'etfs' | 'bonds' | 'crypto';

export interface InvestingBirdsInput {
  seed?: number;
}

export interface InvestingBirdsOutput {
  outcome: 'win' | 'loss';
  score: number;
  levelsCleared: number;
  scoreByType: Record<LevelType, number>;
}

/** Portfolio allocation as percentages 0..100 per category. */
export interface Allocation {
  stocks: number;
  etfs: number;
  bonds: number;
  crypto: number;
}

export interface LevelDef {
  type: LevelType;
  /** Normalized share of portfolio 0..1 */
  share: number;
  /** Per-tower score multiplier: 1 + share * 3 */
  multiplier: number;
  /** Birds (shots) allocated for this round: max(2, round(share * 10)) */
  birds: number;
  /** Display label, e.g. "ETFs". */
  label: string;
}

export interface Bird {
  position: Vector2;
  velocity: Vector2;
  radius: number;
  launched: boolean;
  active: boolean;
  settledMs: number;
}

export interface Block {
  id: string;
  type: LevelType;
  position: Vector2;
  /** Linear velocity (world units / sec). Set by impacts or gravity. */
  velocity: Vector2;
  /** Rotation in radians for tumbling visual. */
  rotation: number;
  rotationVel: number;
  width: number;
  height: number;
  /** Structural HP. When <= 0 the block crumbles — but scoring happens only when knocked off the stage. */
  health: number;
  maxHealth: number;
  mass: number;
  /** Position index inside its tower (for structural support checks). */
  column: number;
  row: number;
  /** True once the block is no longer resting (gravity / kicked). */
  falling: boolean;
  /** True when block has fallen off the stage (y below kill floor). */
  knockedOff: boolean;
  /** Guard so we only award score once. */
  scored: boolean;
  /** Render-only visuals. */
  opacity: number;
  hitFlashMs: number;
  damagePulse: number;
  cracked: boolean;
}

export interface ScoreFloater {
  id: number;
  delta: number;
  atSec: number;
  /** Overlay-local NDC [-1..1] for positioning the floater. */
  ndcX: number;
  ndcY: number;
}

export interface RunState {
  state: InvestingBirdsState;
  levels: LevelDef[];
  currentLevelIndex: number;
  birdsRemaining: number;
  score: number;
  scoreByType: Record<LevelType, number>;
  currentBird: Bird | null;
  blocks: Block[];
  allocation: Allocation;
  dragStart: Vector2 | null;
  dragEnd: Vector2 | null;
  rngSeed: number;
  elapsedSec: number;
  outcome: 'win' | 'loss' | null;
  /** Set to `'cleared' | 'survived'` after a round ends; drives transition overlay. */
  roundOutcome: 'cleared' | 'survived' | null;
  roundEndedAtSec: number | null;
  /** Floating score popups (max a handful kept at a time). */
  scoreFloaters: ScoreFloater[];
}

export type InvestingBirdsAction =
  | { type: 'SET_ALLOCATION'; payload: Allocation }
  | { type: 'START_GAME' }
  | { type: 'INIT_COMPLETE'; payload: { levels: LevelDef[]; seed: number } }
  | {
      type: 'SET_ROUND';
      payload: { blocks: Block[]; bird: Bird; birdsForRound: number };
    }
  | {
      type: 'ROUND_END';
      payload: { outcome: 'cleared' | 'survived'; endedAtSec: number };
    }
  | { type: 'ROUND_ADVANCE' }
  | { type: 'LOSE_GAME' }
  | { type: 'WIN_GAME' }
  | { type: 'UPDATE_SCORE'; payload: { delta: number; levelType: LevelType } }
  | { type: 'CONSUME_BIRD' }
  | { type: 'SET_DRAG'; payload: { start: Vector2 | null; end: Vector2 | null } }
  | { type: 'SET_BIRD'; payload: Bird | null }
  | { type: 'SET_BLOCKS'; payload: Block[] }
  | { type: 'SET_ELAPSED'; payload: number }
  | { type: 'PUSH_FLOATER'; payload: ScoreFloater }
  | { type: 'PRUNE_FLOATERS'; payload: { nowSec: number } }
  | { type: 'RESTART' };
