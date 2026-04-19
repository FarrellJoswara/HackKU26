/**
 * @file Core shared types. Keep this file generic — concrete game/UI shapes belong
 * in the module that owns them (e.g. `games/TemplateGame/types.ts`).
 *
 * The whole architecture rests on three ideas:
 *   1. `ModuleId` is the only thing that ties UI screens, games, and the
 *      Zustand store together. Add a new module = add a new `ModuleId`.
 *   2. `GameProps<TInput, TOutput>` and `UIProps<TData>` are generic so
 *      every module owns its own input/output shape.
 *   3. `EventMap` is the single source of truth for cross-module events.
 *      Add an entry here and the whole codebase becomes type-safe for it.
 */

import type { BoxBudgetSubmitPayload } from './budgetTypes';
import type { IslandScenarioChoicePayload } from './scenarios/islandChoiceApply';

/* -------------------------------------------------------------------------- */
/*  App lifecycle                                                             */
/* -------------------------------------------------------------------------- */

export type AppState =
  | 'boot'
  | 'menu'
  /** Settings hub — audio, controls, etc. */
  | 'settings'
  /** One-shot global onboarding shown before the first New Game flow. */
  | 'onboarding'
  /** Difficulty picker shown when starting a new game. */
  | 'newGameDifficulty'
  /** Financial Freedom — "The Box" zero-based budgeting UI (GDD). */
  | 'budget'
  /** DebtRunner — one-time controls/goal tutorial before first run. */
  | 'debtRunnerTutorial'
  /** DebtRunner — pre-run consequence briefing screen. */
  | 'briefing'
  | 'game'
  | 'transition'
  /** DebtRunner — endgame screens. */
  | 'win'
  | 'loss'
  | 'summary'
  /** Campaign complete — congrats + stats (title hub styling). */
  | 'finale'
  /** Post-cinematic recap — shown after the Mountain Success ending. */
  | 'playthroughSummary';

/**
 * Exhaustiveness helper — call from a `default` case in a `switch` over a
 * discriminated union so adding a new variant is a compile error instead
 * of silently routing to a blank screen.
 *
 *   switch (state) {
 *     case 'a': ...
 *     case 'b': ...
 *     default: assertNever(state);
 *   }
 */
export function assertNever(value: never, context = 'assertNever'): never {
  throw new Error(`${context}: unexpected value ${String(value)}`);
}

/**
 * Branded string used as a registry key. Modules (games & UI screens)
 * register themselves under a `ModuleId`. Branding prevents accidental
 * mixing with arbitrary strings.
 */
export type ModuleId = string & { readonly __brand: 'ModuleId' };

export const moduleId = (id: string): ModuleId => id as ModuleId;

/* -------------------------------------------------------------------------- */
/*  Generic module contracts                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Generic 3D game contract. Each game declares its own input/output types
 * and emits domain events through the Event Bus rather than callbacks, so
 * there is zero coupling between any two games.
 *
 * @template TInput  Shape of the data the game needs to start.
 * @template TOutput Shape of the result the game produces when it ends.
 */
export interface GameProps<TInput = unknown, TOutput = unknown> {
  /** Static configuration / payload provided by the host. */
  inputs: TInput;
  /** Optional convenience callback. Prefer the Event Bus for cross-module signals. */
  onEvent?: (evt: GameEvent<TOutput>) => void;
}

/**
 * Generic UI screen contract. Mirrors `GameProps` so the two layers feel
 * symmetric.
 *
 * @template TData Read-only data the screen renders.
 */
export interface UIProps<TData = unknown> {
  data: TData;
  dispatch?: (evt: UIEvent) => void;
}

/* -------------------------------------------------------------------------- */
/*  Event Bus payloads                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Generic envelope for game-emitted events. Use `kind` to distinguish
 * lifecycle (`start | progress | result | error`) and put the per-game
 * payload in `payload`.
 */
export interface GameEvent<TPayload = unknown> {
  kind: 'start' | 'progress' | 'result' | 'error';
  payload: TPayload;
}

/** Generic envelope for UI-emitted events. */
export interface UIEvent<TPayload = unknown> {
  kind: string;
  payload?: TPayload;
}

/**
 * Central registry of bus events. Extend freely — each new entry becomes
 * type-safe across `emit`/`on`/`useEventBus`.
 *
 * TODO: developers — add domain-specific events here (e.g. 'player:hit',
 *       'inventory:add', 'audio:duck') so emitters/listeners stay typed.
 */

export interface EventMap {
  /** Fired by `TransitionManager` when a navigation request begins. */
  'navigate:request': { to: AppState; module?: ModuleId | null };
  /** Fired once the new screen is mounted and the transition finished. */
  'navigate:complete': { to: AppState; module?: ModuleId | null };

  /** Generic game lifecycle channel. */
  'game:event': GameEvent<unknown>;
  /** Game finished; payload is the game's TOutput. */
  'game:result': GameEvent<unknown>;

  /** Generic UI dispatch channel. */
  'ui:event': UIEvent<unknown>;

  /** Audio control. Listen in `AudioManager` if you wire audio reactions. */
  'audio:play': { id: string; channel: 'bgm' | 'sfx' };

  /**
   * The Box — player confirmed a zero-based budget for the year.
   * Logic listens here; UI may also `mergePlayerData` for optimistic UX.
   */
  'box:budget:submit': BoxBudgetSubmitPayload;

  /**
   * Island Run — player picked option A/B on an interactive landing.
   * The IslandRun React shell resolves the payload through
   * `applyIslandScenarioChoice` and merges into `playerData`.
   */
  'island:scenarioChoice': IslandScenarioChoicePayload;

  /**
   * Endless-runner style game finished. Emitted by the game module,
   * consumed by `RunnerResultRouter` which stores a snapshot and routes
   * to the win/loss screens.
   */
  'runner:finished': import('./runner/runnerTypes').RunnerFinishedPayload;

  /**
   * Island Run — player completed a full circuit of the 12-square board
   * (one in-game year). Fires exactly once per lap by the `lapCounter`
   * rule (see `src/core/campaign/lapCounter.ts` and `IslandRun/main.ts`).
   * Campaign router subscribes and dispatches the year-end mini-game.
   */
  'island:yearComplete': { year: number; totalHops: number };
}

export type EventKey = keyof EventMap;
export type EventHandler<K extends EventKey> = (payload: EventMap[K]) => void;
