/**
 * Central audio registry. Imported once from `main.tsx` so that every
 * sound id used elsewhere is guaranteed to be loaded.
 */

import collectorFootWav from '@/assets/sounds/collector_foot.wav?url';
import collectorPapersWav from '@/assets/sounds/collector_papers.wav?url';
import collectorPhoneWav from '@/assets/sounds/collector_phone.wav?url';
import { audio } from './AudioManager';

export function registerAllTracks(): void {
  audio.registerSFX('collectorFootstep', { src: collectorFootWav, volume: 0.55 });
  audio.registerSFX('collectorPapers', { src: collectorPapersWav, volume: 0.45 });
  audio.registerSFX('collectorPhone', { src: collectorPhoneWav, volume: 0.5 });
}
