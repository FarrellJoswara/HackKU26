import { buildRoundPlans, makeEmptyAllocation } from './config';
import type { Allocation, UiAction, UiState } from './types';

const emptyScore = () =>
  ({
    stocks: 0,
    etfs: 0,
    bonds: 0,
    crypto: 0,
  }) as const;

export function initialUiState(): UiState {
  return {
    phase: 'allocate',
    allocation: { stocks: 25, etfs: 25, bonds: 25, crypto: 25 },
    rounds: [],
    roundIndex: 0,
    birdsRemaining: 0,
    score: 0,
    scoreByType: { ...emptyScore() },
    banner: '',
    simKey: 0,
  };
}

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'SET_ALLOCATION':
      return { ...state, allocation: action.payload };
    case 'START_RUN': {
      return {
        ...state,
        phase: 'playing',
        rounds: action.payload.rounds,
        roundIndex: 0,
        score: 0,
        scoreByType: { ...emptyScore() },
        banner: '',
        birdsRemaining: action.payload.rounds[0]?.birds ?? 0,
        simKey: state.simKey + 1,
      };
    }
    case 'BIRD_LANDED': {
      const { pigAlive } = action.payload;
      const br = Math.max(0, state.birdsRemaining - 1);
      if (!pigAlive) {
        return { ...state, birdsRemaining: br };
      }
      if (br <= 0) {
        return {
          ...state,
          birdsRemaining: 0,
          phase: 'round_end_loss',
          banner: 'Volley exhausted — the pig still holds the line.',
        };
      }
      return { ...state, birdsRemaining: br };
    }
    case 'PIG_DEFEATED':
      return {
        ...state,
        phase: 'round_end_win',
        banner: 'Risk target eliminated — round cleared!',
      };
    case 'RETRY_ROUND': {
      const r = state.rounds[state.roundIndex];
      if (!r) return state;
      return {
        ...state,
        phase: 'playing',
        birdsRemaining: r.birds,
        banner: '',
        simKey: state.simKey + 1,
      };
    }
    case 'NEXT_ROUND': {
      const next = state.roundIndex + 1;
      if (next >= state.rounds.length) {
        return { ...state, phase: 'game_win', banner: 'Portfolio challenge complete!' };
      }
      const r = state.rounds[next];
      return {
        ...state,
        roundIndex: next,
        phase: 'playing',
        birdsRemaining: r?.birds ?? 0,
        banner: '',
        simKey: state.simKey + 1,
      };
    }
    case 'GAME_LOST':
      return { ...state, phase: 'game_loss', banner: 'Out of birds — try a different allocation.' };
    case 'ADD_SCORE': {
      const { amount, levelType } = action.payload;
      return {
        ...state,
        score: state.score + amount,
        scoreByType: {
          ...state.scoreByType,
          [levelType]: state.scoreByType[levelType] + amount,
        },
      };
    }
    default:
      return state;
  }
}

export function normalizedAllocation(raw: Allocation): Allocation {
  const a = {
    stocks: Math.max(0, raw.stocks),
    etfs: Math.max(0, raw.etfs),
    bonds: Math.max(0, raw.bonds),
    crypto: Math.max(0, raw.crypto),
  };
  const s = a.stocks + a.etfs + a.bonds + a.crypto;
  if (s <= 0) return makeEmptyAllocation();
  return {
    stocks: (a.stocks / s) * 100,
    etfs: (a.etfs / s) * 100,
    bonds: (a.bonds / s) * 100,
    crypto: (a.crypto / s) * 100,
  };
}

export function startRoundsFromAllocation(allocation: Allocation) {
  return buildRoundPlans(allocation);
}
