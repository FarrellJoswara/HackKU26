/** Portfolio categories — same theme as earlier Investing Birds prototypes. */
export type LevelType = 'stocks' | 'etfs' | 'bonds' | 'crypto';

export type BlockMaterial = 'wood' | 'stone' | 'ice';

export type GamePhase =
  | 'allocate'
  | 'playing'
  | 'round_end_win'
  | 'round_end_loss'
  | 'game_win'
  | 'game_loss';

export interface Allocation {
  stocks: number;
  etfs: number;
  bonds: number;
  crypto: number;
}

export interface InvestingBirds3Input {
  seed?: number;
}

export interface InvestingBirds3Output {
  outcome: 'win' | 'loss';
  score: number;
  levelsCleared: number;
  scoreByType: Record<LevelType, number>;
}

export interface RoundPlan {
  type: LevelType;
  share: number;
  multiplier: number;
  birds: number;
  label: string;
}

export interface UiState {
  phase: GamePhase;
  allocation: Allocation;
  rounds: RoundPlan[];
  roundIndex: number;
  birdsRemaining: number;
  score: number;
  scoreByType: Record<LevelType, number>;
  /** Message shown on round end overlays. */
  banner: string;
  /** Bumps when a fresh Box2D world should be built for the current round. */
  simKey: number;
}

export type UiAction =
  | { type: 'SET_ALLOCATION'; payload: Allocation }
  | { type: 'START_RUN'; payload: { rounds: RoundPlan[] } }
  | { type: 'BIRD_LANDED'; payload: { pigAlive: boolean } }
  | { type: 'PIG_DEFEATED' }
  | { type: 'RETRY_ROUND' }
  | { type: 'NEXT_ROUND' }
  | { type: 'GAME_LOST' }
  | { type: 'ADD_SCORE'; payload: { amount: number; levelType: LevelType } };

export interface BodyUserData {
  role: 'bird' | 'pig' | 'block' | 'ground';
  levelType?: LevelType;
  /** Block fell past kill line — award once. */
  offstageScored?: boolean;
}
