/**
 * @file Transition contracts — `TransitionTarget`, animation options, and the
 * `Transition` strategy interface used by `TransitionManager` and the registry.
 */

import type { AppState, ModuleId } from '@/core/types';

/**
 * Description of an in-flight transition. The same shape is used for the
 * "before" snapshot (where we are) and the "after" target (where we go).
 */
export interface TransitionTarget {
  appState: AppState;
  module: ModuleId | null;
}

export interface TransitionOpts {
  from: TransitionTarget;
  to: TransitionTarget;
  /** Total animation duration in ms. The effect may ignore this. */
  durationMs?: number;
}

/**
 * Strategy interface. A `Transition` is a *visual hand-off* between two
 * `TransitionTarget`s. It must run `commit()` exactly once when it is
 * safe to swap the underlying screen (e.g. mid-fade when the screen is
 * fully black) and must resolve once the visual is fully gone.
 */
export interface Transition {
  /** Unique ID for the registry. */
  id: string;
  /**
   * Render any DOM/3D needed for the effect. Optional — many effects can
   * be done purely in code via classlists / CSS.
   */
  render?: () => React.ReactNode;
  /**
   * Run the transition.
   * @param opts    target description
   * @param commit  call when it's safe to mount the new screen
   */
  play: (opts: TransitionOpts, commit: () => void) => Promise<void>;
}
