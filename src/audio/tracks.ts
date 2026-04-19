/**
 * Central audio registry. Imported once from `main.tsx` so that every
 * sound id used elsewhere is guaranteed to be loaded.
 */

import collectorFootWav from '@/assets/sounds/collector_foot.wav?url';
import collectorPapersWav from '@/assets/sounds/collector_papers.wav?url';
import collectorPhoneWav from '@/assets/sounds/collector_phone.wav?url';
import uiClickWav from '@/assets/sounds/ui_click.wav?url';
import { audio } from './AudioManager';

export function registerAllTracks(): void {
  audio.registerSFX('collectorFootstep', { src: collectorFootWav, volume: 0.55 });
  audio.registerSFX('collectorPapers', { src: collectorPapersWav, volume: 0.45 });
  audio.registerSFX('collectorPhone', { src: collectorPhoneWav, volume: 0.5 });
  // Shared UI click — used by `useMicroReward` for instant button feedback.
  // Volume deliberately low: the asset is a soft warm "wood tap" tuned
  // for the island theme, not an attention-grabbing pip.
  audio.registerSFX('uiClick', { src: uiClickWav, volume: 0.22 });
}
