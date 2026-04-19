/**
 * @file Investing Birds domain types — FSM state, allocations, blocks, levels,
 * and overlay actions. Shared by R3F scene, Planck layer, and DOM UI.
 */

import type { Vector2 } from 'three';

export type InvestingBirdsState =
  | 'ALLOCATE'
  | 'INIT_LEVELS'
  | 'PLAYING'
  | 'ROUND_END'
  | 'GAME_END';

/** Investment categories. */
export type LevelType = 'stocks' | 'etfs' | 'bonds' | 'crypto';

/** Material a block is made of — drives HP/mass/look. */
export type BlockMaterial = 'wood' | 'stone' | 'ice';

export interface InvestingBirdsInput {
  seed?: number;
  /**
   * Pre-filled portfolio allocation (sourced from The Box's investment
   * subcategories — see `landingPayload.ts`). When supplied, the game
   * skips the in-game ALLOCATE panel and starts the run immediately on
   * these numbers.
   */
  allocation?: Allocation;
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
  /** Birds (shots) this round — from `birdsForLevelType` (ETFs scale with share; others are 1). */
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
  /** Bird variant = category of the current round (visuals / tuning). */
  variant: LevelType;
  /** `elapsedSec` when launch happened (for streak / grace window). */
  launchedAtSec: number;
}

export interface Block {
  id: string;
  type: LevelType;
  material: BlockMaterial;
  position: Vector2;
  /** Linear velocity (world units / sec). Set by impacts or gravity. */
  velocity: Vector2;
  /** Rotation in radians for tumbling visual. */
  rotation: number;
  rotationVel: number;
  width: number;
  height: number;
  /** Structural HP. */
  health: number;
  maxHealth: number;
  mass: number;
  /** Position index inside its tower (for structural support checks). */
  column: number;
  row: number;
  /** Original centered Y at spawn — used for "toppled" detection. */
  initialY: number;
  /** Block has been disturbed (hit directly or by another block) since spawn. */
  awake: boolean;
  /** True once the block is no longer resting (gravity / kicked). */
  falling: boolean;
  /** Consecutive frames with no support — used for hysteresis. */
  unsupportedFrames: number;
  /** Block has fallen over or off its original position (counts as cleared). */
  toppled: boolean;
  /** True when block has fallen off the stage (y below kill floor). */
  knockedOff: boolean;
  /** True once the block has shattered (HP reached 0). */
  shattered: boolean;
  /** Guard so we only award score once. */
  scored: boolean;
  /** Primary target block (top of tower). Worth a +500 bonus when cleared. */
  isTarget: boolean;
  /** G5: block is a TNT barrel — shattering it bursts neighbors in a 2u radius. */
  isTnt: boolean;
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
  /** World coords of the block/event. Overlay projects via `worldToScreen`. */
  worldX: number;
  worldY: number;
  /** Category for tinted floaters. */
  levelType?: LevelType;
}

export interface DustPuff {
  id: number;
  atSec: number;
  worldX: number;
  worldY: number;
  size: number;
  /** Tint for the dust (per category). */
  tint?: string;
}

export interface DamageFloater {
  id: number;
  delta: number;
  atSec: number;
  worldX: number;
  worldY: number;
}

export interface Settings {
  /** Enable reduced motion: disables slow-mo, shake, parallax follow, confetti. */
  reducedMotion: boolean;
  /** Enable colorblind-friendly palette (patterns in addition to color). */
  colorblind: boolean;
  /** Audio volume 0..1 (master). */
  volume: number;
}

export interface RunState {
  state: InvestingBirdsState;
  levels: LevelDef[];
  currentLevelIndex: number;
  birdsRemaining: number;
  birdsForRound: number;
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
  /** Set after a round ends; drives transition overlay. */
  roundOutcome: 'cleared' | 'failed' | null;
  roundEndedAtSec: number | null;
  /** Floating score popups (max a handful kept at a time). */
  scoreFloaters: ScoreFloater[];
  /** Red -NN damage popups on every bird/block hit. */
  damageFloaters: DamageFloater[];
  /** Transient dust puff sprites shown at ground/bird impact points. */
  dustPuffs: DustPuff[];
  /** Elapsed-sec timestamp of the last heavy hit, for vignette pulse. */
  lastHeavyHitAtSec: number | null;
  /** Running combo counter: knockoffs inside `comboWindowSec`. */
  combo: number;
  /** Latest timestamp a combo tick was registered. */
  lastComboAtSec: number | null;
  /** True while the simulation is paused via the pause menu. */
  paused: boolean;
  /** True while the settings modal is open. */
  settingsOpen: boolean;
  /** Settings persisted across rounds. */
  settings: Settings;
  /** Notional $ in each asset class; tower returns multiply the slice for that type. */
  investmentValueByType: Record<LevelType, number>;
  /** Sum of `investmentValueByType` at run start — used for win vs loss on final tower. */
  initialPortfolioTotal: number;
  /** Blocks in the tower when the current round began (for clear fraction). */
  roundStartBlockCount: number;
  /**
   * Mirrors `sim.scoredBlocks.size` — blocks that count toward portfolio return
   * this round (may exceed visible `blocks.length` after destroyed blocks are pruned).
   */
  simScoredBlockCount: number;
  /** Sum of maxHealth for all blocks at round start — fixed HP bar denominator. */
  roundStartTotalMaxHealth: number;
  /** Return applied to the current category when the last round ended (−max..+max as decimal). */
  lastRoundAppliedReturnPct: number | null;
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
      payload: {
        outcome: 'cleared' | 'failed';
        endedAtSec: number;
        /** Blocks knocked out / scored this round (for portfolio return). */
        blocksCleared: number;
      };
    }
  | { type: 'ROUND_ADVANCE' }
  | { type: 'LOSE_GAME' }
  | { type: 'WIN_GAME' }
  | { type: 'UPDATE_SCORE'; payload: { delta: number; levelType: LevelType } }
  | { type: 'CONSUME_BIRD' }
  | { type: 'SET_DRAG'; payload: { start: Vector2 | null; end: Vector2 | null } }
  | { type: 'SET_BIRD'; payload: Bird | null }
  | { type: 'SET_BLOCKS'; payload: { blocks: Block[]; scoredBlockCount: number } }
  | { type: 'SET_ELAPSED'; payload: number }
  | { type: 'PUSH_FLOATER'; payload: ScoreFloater }
  | { type: 'PUSH_DAMAGE'; payload: DamageFloater }
  | { type: 'PUSH_DUST'; payload: DustPuff }
  | { type: 'PRUNE_FLOATERS'; payload: { nowSec: number } }
  | { type: 'HEAVY_HIT'; payload: { atSec: number } }
  | { type: 'COMBO_TICK'; payload: { atSec: number } }
  | { type: 'COMBO_RESET' }
  | { type: 'SET_PAUSED'; payload: boolean }
  | { type: 'OPEN_SETTINGS'; payload: boolean }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> };
