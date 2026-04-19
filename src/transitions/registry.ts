/**
 * @file Transition registry. Hot-swap effects by changing `activeTransitionId`
 * — no code that *triggers* transitions ever needs to know which effect
 * is mounted.
 *
 * TODO: developers — register additional `Transition` strategies and
 *       call `setActiveTransition('myEffect')` to switch.
 */

import type { Transition } from './types';
import { FadeTransition } from './effects/FadeTransition';
import { WaveTransition } from './effects/WaveTransition';

export const TRANSITIONS: Record<string, Transition> = {
  [FadeTransition.id]: FadeTransition,
  // Tropical wave-wash; reads as part of the beach world rather than a cut.
  [WaveTransition.id]: WaveTransition,
};

// Default to the tropical wave so every navigation feels themed.
let activeTransitionId: string = WaveTransition.id;

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
