/**
 * Central audio registry. Imported once from `main.tsx` so that every
 * sound id used elsewhere is guaranteed to be loaded.
 *
 * TODO: developers — drop files in `src/assets/sounds/` and register them
 *       here. Use Vite's `?url` import so the bundler hashes & ships them.
 *
 * Example:
 *   import clickSfx from '@/assets/sounds/click.mp3?url';
 *   audio.registerSFX('click', { src: clickSfx, volume: 0.7 });
 *
 *   import themeBgm from '@/assets/sounds/theme.mp3?url';
 *   audio.registerBGM('theme', { src: themeBgm, loop: true, volume: 0.5 });
 */

import { audio } from './AudioManager';

export function registerAllTracks(): void {
  // TODO: register BGM tracks
  // audio.registerBGM('theme', { src: '/assets/sounds/theme.mp3', loop: true });

  // TODO: register SFX
  // audio.registerSFX('click', { src: '/assets/sounds/click.mp3', volume: 0.8 });

  void audio; // keeps the import live until tracks are added
}
