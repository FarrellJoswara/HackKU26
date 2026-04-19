import {
  SLICE_RETURN_BOUNDS,
  GAME_CONFIG,
  initialInvestmentByAllocation,
  makeEmptyAllocation,
  portfolioReturnPct,
  scoreByTypeFromInvestment,
  sumPortfolioValue,
} from './config';
import type {
  DamageFloater,
  DustPuff,
  InvestingBirdsAction,
  LevelType,
  RunState,
  ScoreFloater,
  Settings,
} from './types';

/** Exported so both the reducer and the frame loop use the same window. */
export const COMBO_WINDOW_SEC = GAME_CONFIG.comboWindowSec;

function warnInvalidTransition(from: string, action: string): void {
  console.warn(`[InvestingBirds] Invalid transition: ${from} + ${action}`);
}

const EMPTY_SCORE_BY_TYPE: Record<LevelType, number> = {
  stocks: 0,
  etfs: 0,
  bonds: 0,
  crypto: 0,
};

export function getDefaultSettings(): Settings {
  return { reducedMotion: false, colorblind: false, volume: 0.6, musicOn: true };
}

export function getInitialRunState(seed: number): RunState {
  return {
    state: 'ALLOCATE',
    levels: [],
    currentLevelIndex: 0,
    birdsRemaining: 0,
    birdsForRound: 0,
    score: 0,
    scoreByType: { ...EMPTY_SCORE_BY_TYPE },
    currentBird: null,
    blocks: [],
    allocation: makeEmptyAllocation(),
    dragStart: null,
    dragEnd: null,
    rngSeed: seed,
    elapsedSec: 0,
    outcome: null,
    roundOutcome: null,
    roundEndedAtSec: null,
    scoreFloaters: [],
    damageFloaters: [],
    dustPuffs: [],
    lastHeavyHitAtSec: null,
    combo: 0,
    lastComboAtSec: null,
    paused: false,
    settingsOpen: false,
    settings: getDefaultSettings(),
    investmentValueByType: { ...EMPTY_SCORE_BY_TYPE },
    initialPortfolioTotal: 0,
    roundStartBlockCount: 0,
    simScoredBlockCount: 0,
    roundStartTotalMaxHealth: 0,
    lastRoundAppliedReturnPct: null,
  };
}

const MAX_FLOATERS = 6;
const MAX_DAMAGE_FLOATERS = 8;
const MAX_DUST_PUFFS = 16;
const FLOATER_TTL_SEC = 1.3;
const DAMAGE_TTL_SEC = 0.9;
const DUST_TTL_SEC = 0.7;

function pruneFloaters(list: ScoreFloater[], nowSec: number): ScoreFloater[] {
  return list.filter((f) => nowSec - f.atSec < FLOATER_TTL_SEC);
}
function pruneDamage(list: DamageFloater[], nowSec: number): DamageFloater[] {
  return list.filter((f) => nowSec - f.atSec < DAMAGE_TTL_SEC);
}
function pruneDust(list: DustPuff[], nowSec: number): DustPuff[] {
  return list.filter((f) => nowSec - f.atSec < DUST_TTL_SEC);
}

export function runReducer(state: RunState, action: InvestingBirdsAction): RunState {
  switch (action.type) {
    case 'SET_ALLOCATION':
      return { ...state, allocation: action.payload };
    case 'START_GAME':
      if (state.state !== 'ALLOCATE') {
        warnInvalidTransition(state.state, action.type);
        return state;
      }
      return { ...state, state: 'INIT_LEVELS' };
    case 'INIT_COMPLETE':
      if (state.state !== 'INIT_LEVELS') {
        warnInvalidTransition(state.state, action.type);
        return state;
      }
      {
        const inv = initialInvestmentByAllocation(state.allocation);
        const initSum = sumPortfolioValue(inv);
        return {
          ...state,
          levels: action.payload.levels,
          rngSeed: action.payload.seed,
          state: 'PLAYING',
          birdsRemaining: action.payload.levels[0]?.birds ?? 0,
          birdsForRound: action.payload.levels[0]?.birds ?? 0,
          currentLevelIndex: 0,
          investmentValueByType: inv,
          initialPortfolioTotal: initSum,
          score: Math.round(initSum),
          scoreByType: scoreByTypeFromInvestment(inv),
          roundOutcome: null,
          roundEndedAtSec: null,
          roundStartBlockCount: 0,
          simScoredBlockCount: 0,
          roundStartTotalMaxHealth: 0,
          lastRoundAppliedReturnPct: null,
        };
      }
    case 'SET_ROUND':
      if (state.state !== 'PLAYING') {
        warnInvalidTransition(state.state, action.type);
        return state;
      }
      return {
        ...state,
        blocks: action.payload.blocks,
        currentBird: action.payload.bird,
        birdsRemaining: action.payload.birdsForRound,
        birdsForRound: action.payload.birdsForRound,
        dragStart: null,
        dragEnd: null,
        roundOutcome: null,
        roundStartBlockCount: action.payload.blocks.length,
        simScoredBlockCount: 0,
        roundStartTotalMaxHealth: action.payload.blocks.reduce(
          (s, b) => s + b.maxHealth,
          0,
        ),
        lastRoundAppliedReturnPct: null,
        scoreFloaters: [],
        damageFloaters: [],
        dustPuffs: [],
        lastHeavyHitAtSec: null,
      };
    case 'ROUND_END':
      if (state.state !== 'PLAYING') {
        warnInvalidTransition(state.state, action.type);
        return state;
      }
      {
        const level = state.levels[state.currentLevelIndex];
        if (!level) {
          warnInvalidTransition(state.state, 'ROUND_END(no level)');
          return state;
        }
        const total = state.roundStartBlockCount;
        const cleared = action.payload.blocksCleared;
        const frac = total > 0 ? Math.min(1, Math.max(0, cleared / total)) : 0;
        const { low, high } = SLICE_RETURN_BOUNDS[level.type];
        const appliedReturnPct = portfolioReturnPct(frac, low, high);
        const nextInv = { ...state.investmentValueByType };
        nextInv[level.type] *= 1 + appliedReturnPct;
        const scoreNext = Math.round(sumPortfolioValue(nextInv));
        return {
          ...state,
          state: 'ROUND_END',
          roundOutcome: action.payload.outcome,
          roundEndedAtSec: action.payload.endedAtSec,
          investmentValueByType: nextInv,
          score: scoreNext,
          scoreByType: scoreByTypeFromInvestment(nextInv),
          lastRoundAppliedReturnPct: appliedReturnPct,
        };
      }
    case 'ROUND_ADVANCE':
      if (state.state !== 'ROUND_END') {
        warnInvalidTransition(state.state, action.type);
        return state;
      }
      return {
        ...state,
        state: 'PLAYING',
        currentLevelIndex: state.currentLevelIndex + 1,
        roundEndedAtSec: null,
        roundOutcome: null,
        lastRoundAppliedReturnPct: null,
      };
    case 'LOSE_GAME':
      return { ...state, state: 'GAME_END', outcome: 'loss' };
    case 'WIN_GAME':
      return { ...state, state: 'GAME_END', outcome: 'win' };
    case 'UPDATE_SCORE':
      return {
        ...state,
        score: state.score + action.payload.delta,
        scoreByType: {
          ...state.scoreByType,
          [action.payload.levelType]:
            state.scoreByType[action.payload.levelType] + action.payload.delta,
        },
      };
    case 'CONSUME_BIRD':
      return { ...state, birdsRemaining: Math.max(0, state.birdsRemaining - 1) };
    case 'SET_DRAG':
      return { ...state, dragStart: action.payload.start, dragEnd: action.payload.end };
    case 'SET_BIRD':
      return { ...state, currentBird: action.payload };
    case 'SET_BLOCKS':
      return {
        ...state,
        blocks: action.payload.blocks,
        simScoredBlockCount: action.payload.scoredBlockCount,
      };
    case 'SET_ELAPSED':
      return { ...state, elapsedSec: action.payload };
    case 'PUSH_FLOATER': {
      const pruned = pruneFloaters(state.scoreFloaters, action.payload.atSec);
      const next = [...pruned, action.payload].slice(-MAX_FLOATERS);
      return { ...state, scoreFloaters: next };
    }
    case 'PUSH_DAMAGE': {
      const pruned = pruneDamage(state.damageFloaters, action.payload.atSec);
      const next = [...pruned, action.payload].slice(-MAX_DAMAGE_FLOATERS);
      return { ...state, damageFloaters: next };
    }
    case 'PUSH_DUST': {
      const pruned = pruneDust(state.dustPuffs, action.payload.atSec);
      const next = [...pruned, action.payload].slice(-MAX_DUST_PUFFS);
      return { ...state, dustPuffs: next };
    }
    case 'PRUNE_FLOATERS': {
      const now = action.payload.nowSec;
      return {
        ...state,
        scoreFloaters: pruneFloaters(state.scoreFloaters, now),
        damageFloaters: pruneDamage(state.damageFloaters, now),
        dustPuffs: pruneDust(state.dustPuffs, now),
      };
    }
    case 'HEAVY_HIT':
      return { ...state, lastHeavyHitAtSec: action.payload.atSec };
    case 'COMBO_TICK': {
      const within =
        state.lastComboAtSec != null &&
        action.payload.atSec - state.lastComboAtSec < COMBO_WINDOW_SEC;
      return {
        ...state,
        combo: within ? state.combo + 1 : 1,
        lastComboAtSec: action.payload.atSec,
      };
    }
    case 'COMBO_RESET':
      return { ...state, combo: 0, lastComboAtSec: null };
    case 'SET_PAUSED':
      return { ...state, paused: action.payload };
    case 'OPEN_SETTINGS':
      return { ...state, settingsOpen: action.payload };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    default:
      return state;
  }
}
