export interface RunnerHudState {
  timerSeconds: number;
  stamina: number;
  lives: number;
  maxLives: number;
  morale: number;
  debtPressure: number;
  chaseDistance: number;
  monsterStage: 'manageable' | 'threatening' | 'dangerous' | 'overwhelming';
  /** 0..1 combined chase proximity + debt + morale — drives DOM stress effects. */
  collectorPressure01: number;
  debuffs: string[];
  paused: boolean;
}

