import { makeEmptyAllocation } from './config';
import type { InvestingBirdsAction, LevelType, RunState, ScoreFloater } from './types';

function warnInvalidTransition(from: string, action: string): void {
  console.warn(`[InvestingBirds] Invalid transition: ${from} + ${action}`);
}

const EMPTY_SCORE_BY_TYPE: Record<LevelType, number> = {
  stocks: 0,
  etfs: 0,
  bonds: 0,
  crypto: 0,
};

export function getInitialRunState(seed: number): RunState {
  return {
    state: 'ALLOCATE',
    levels: [],
    currentLevelIndex: 0,
    birdsRemaining: 0,
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
  };
}

const MAX_FLOATERS = 6;
const FLOATER_TTL_SEC = 1.3;

function pruneFloaters(list: ScoreFloater[], nowSec: number): ScoreFloater[] {
  return list.filter((f) => nowSec - f.atSec < FLOATER_TTL_SEC);
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
      return {
        ...state,
        levels: action.payload.levels,
        rngSeed: action.payload.seed,
        state: 'PLAYING',
        birdsRemaining: action.payload.levels[0]?.birds ?? 0,
        currentLevelIndex: 0,
        score: 0,
        scoreByType: { ...EMPTY_SCORE_BY_TYPE },
        roundOutcome: null,
        roundEndedAtSec: null,
      };
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
        dragStart: null,
        dragEnd: null,
        roundOutcome: null,
        scoreFloaters: [],
      };
    case 'ROUND_END':
      if (state.state !== 'PLAYING') {
        warnInvalidTransition(state.state, action.type);
        return state;
      }
      return {
        ...state,
        state: 'ROUND_END',
        roundOutcome: action.payload.outcome,
        roundEndedAtSec: action.payload.endedAtSec,
      };
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
      return { ...state, blocks: action.payload };
    case 'SET_ELAPSED':
      return { ...state, elapsedSec: action.payload };
    case 'PUSH_FLOATER': {
      const pruned = pruneFloaters(state.scoreFloaters, action.payload.atSec);
      const next = [...pruned, action.payload].slice(-MAX_FLOATERS);
      return { ...state, scoreFloaters: next };
    }
    case 'PRUNE_FLOATERS':
      return {
        ...state,
        scoreFloaters: pruneFloaters(state.scoreFloaters, action.payload.nowSec),
      };
    case 'RESTART':
      return {
        ...getInitialRunState(state.rngSeed + 1),
        allocation: state.allocation,
      };
    default:
      return state;
  }
}
