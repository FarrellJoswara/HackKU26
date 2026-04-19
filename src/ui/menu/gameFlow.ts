/**
 * Shared menu-flow constants and selectors.
 *
 * Single source of truth for:
 *   - The placeholder game title.
 *   - The difficulty options shown on the new-game screen.
 *   - The exact `playerData` keys the menu flow reads/writes.
 *
 * UI screens import from here instead of scattering magic strings, so
 * renaming a key or adding a difficulty is a one-file change.
 *
 * Architecture note (AGENTS.md §1): this file does NOT import from
 * `src/games/**`. Screens that need `GAME_IDS` import it directly from
 * `@/games/registry`.
 */

export const GAME_TITLE_PLACEHOLDER = 'Island Adventure';

export type DifficultyId = 'easy' | 'normal' | 'hard';

export interface DifficultyOption {
  id: DifficultyId;
  label: string;
  description: string;
}

export const DIFFICULTIES: DifficultyOption[] = [
  {
    id: 'easy',
    label: 'Easy',
    description: 'Relaxed pace, more resources.',
  },
  {
    id: 'normal',
    label: 'Normal',
    description: 'Balanced challenge.',
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'Punishing — for survivors only.',
  },
];

export const DEFAULT_DIFFICULTY: DifficultyId = 'normal';

/**
 * Flat `playerData` key names. `playerData` is `Record<string, unknown>`,
 * so we use dot-notation strings rather than nested objects.
 */
export const PLAYER_KEYS = {
  islandRunDifficulty: 'islandRun.difficulty',
  islandRunHasSave: 'islandRun.hasSave',
} as const;

export function selectHasIslandRunSave(
  playerData: Record<string, unknown>,
): boolean {
  return playerData[PLAYER_KEYS.islandRunHasSave] === true;
}

export function selectIslandRunDifficulty(
  playerData: Record<string, unknown>,
): DifficultyId {
  const raw = playerData[PLAYER_KEYS.islandRunDifficulty];
  if (raw === 'easy' || raw === 'normal' || raw === 'hard') return raw;
  return DEFAULT_DIFFICULTY;
}
