/**
 * React hook over `AudioManager`. Use it when a component needs reactive
 * volume state (e.g. a settings slider). For one-shot triggers, just
 * `import { audio } from '@/audio/AudioManager'` directly.
 */

import { useCallback, useState } from 'react';
import { audio } from './AudioManager';

export function useAudio() {
  const [volumes, setVolumes] = useState(() => audio.getVolumes());

  const setMaster = useCallback((v: number) => {
    audio.setMasterVolume(v);
    setVolumes(audio.getVolumes());
  }, []);
  const setBGM = useCallback((v: number) => {
    audio.setBGMVolume(v);
    setVolumes(audio.getVolumes());
  }, []);
  const setSFX = useCallback((v: number) => {
    audio.setSFXVolume(v);
    setVolumes(audio.getVolumes());
  }, []);
  const mute = useCallback((m: boolean) => audio.mute(m), []);

  return {
    audio,
    volumes,
    setMasterVolume: setMaster,
    setBGMVolume: setBGM,
    setSFXVolume: setSFX,
    mute,
  };
}
