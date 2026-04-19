export interface RunnerHudState {
  timerSeconds: number;
  stamina: number;
  lives: number;
  maxLives: number;
  morale: number;
  debtPressure: number;
  chaseDistance: number;
  monsterStage: 'manageable' | 'threatening' | 'dangerous' | 'overwhelming';
  debuffs: string[];
  paused: boolean;
}

