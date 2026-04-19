import type { BudgetProfile } from '@/core/finance/budgetTypes';
import type { RunnerHudState } from '@/core/runner/hudTypes';

export type Heading = 'north' | 'east' | 'south' | 'west';
export type TurnDirection = 'left' | 'right' | 'straight';
export type ObstacleKind = 'block' | 'low' | 'high' | 'hazard';

export interface ObstacleSpec {
  lane: -1 | 0 | 1;
  kind: ObstacleKind;
  label: string;
}

export interface TrackTile {
  id: string;
  x: number;
  z: number;
  heading: Heading;
  turn: TurnDirection;
  narrow: boolean;
  slippery: boolean;
  obstacles: ObstacleSpec[];
}

export interface RuntimeRunState {
  profile: BudgetProfile;
  hud: RunnerHudState;
}

