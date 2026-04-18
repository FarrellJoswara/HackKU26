import type { BudgetProfile } from '../finance/budgetTypes';
import type { ModuleId } from '../types';
import type { BudgetEffectNote, RunnerSessionConfig } from '../finance/budgetEffectResolver';

export type RunnerOutcome = 'win' | 'loss';
export type RunnerFailReason = 'caught' | 'fall' | 'noLives' | 'unknown';

export interface RunnerRunStats {
  timeSurvivedSeconds?: number;
  hits?: number;
  stumbles?: number;
  nearMissTurns?: number;
}

export interface RunnerRunConfigSnapshot {
  profile: BudgetProfile;
  durationSeconds: number;
  totalDebtPressureTier: RunnerSessionConfig['totalDebtPressureTier'];
}

export interface RunnerFinishedPayload {
  moduleId: ModuleId;
  outcome: RunnerOutcome;
  failReason?: RunnerFailReason;
  config: RunnerRunConfigSnapshot;
  stats?: RunnerRunStats;
  effectsTriggered?: BudgetEffectNote[];
  endedAtMs?: number;
}

export interface StoredRunnerLastRun extends RunnerFinishedPayload {
  // For forward compatibility (summary UX can show extra tokens if provided)
  effectsTriggered?: BudgetEffectNote[];
}

