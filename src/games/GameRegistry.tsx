/**
 * @file R3F router. Mount this inside the app's `<Canvas>`. It watches
 * `activeModule` from the store and renders the matching lazy-loaded
 * game inside `<Suspense>`.
 *
 * NOTE: this file is the *only* place that knows about which 3D scene is
 *       active. UI screens never import games directly.
 */

import { Suspense, useMemo } from 'react';
import { useAppStore } from '@/core/store';
import { getGame } from './registry';

export interface GameRegistryProps {
  /**
   * Inputs forwarded to whichever game is active. Each game type-narrows
   * its own slice — keep this generic on the host side.
   *
   * TODO: replace `any` with a tagged union if you want exhaustive checks.
   */
  inputs?: Record<string, any>;
}

export function GameRegistry({ inputs = {} }: GameRegistryProps) {
  const activeModule = useAppStore((s) => s.activeModule);
  const appState = useAppStore((s) => s.appState);

  const Game = useMemo(() => getGame(activeModule), [activeModule]);

  if (appState !== 'game' || !Game) return null;

  return (
    <Suspense fallback={null}>
      <Game inputs={inputs} />
    </Suspense>
  );
}
