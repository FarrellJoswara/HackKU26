/**
 * @file React hook over `AudioManager` for reactive volume/mute state (e.g.
 * settings sliders). For one-shot playback, import `audio` directly from
 * `AudioManager.ts`.
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
