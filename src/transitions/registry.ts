/**
 * Transition registry. Hot-swap effects by changing `activeTransitionId`
 * — no code that *triggers* transitions ever needs to know which effect
 * is mounted.
 *
 * TODO: developers — register additional `Transition` strategies and
 *       call `setActiveTransition('myEffect')` to switch.
 */

import type { Transition } from './types';
import { FadeTransition } from './effects/FadeTransition';

export const TRANSITIONS: Record<string, Transition> = {
  [FadeTransition.id]: FadeTransition,
  // TODO: register more, e.g.
  // [WipeTransition.id]: WipeTransition,
  // [CameraSwoopTransition.id]: CameraSwoopTransition,
};

let activeTransitionId: string = FadeTransition.id;

export function setActiveTransition(id: string): void {
  if (!TRANSITIONS[id]) {
    console.warn(`[transitions] unknown transition "${id}", keeping "${activeTransitionId}"`);
    return;
  }
  activeTransitionId = id;
}

export function getActiveTransition(): Transition {
  // Non-null because we initialise with a known id and validate on set.
  return TRANSITIONS[activeTransitionId]!;
}
