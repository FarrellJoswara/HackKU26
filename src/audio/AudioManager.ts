/**
 * @file Howler-backed audio singleton. Import the shared `audio` instance and
 * call from anywhere — UI button handlers, R3F frame loops, event bus
 * subscribers, etc. No React required.
 *
 *   import { audio } from '@/audio/AudioManager';
 *   audio.playSFX('click');
 *   audio.playBGM('theme');
 *
 * Sounds are registered up-front in `tracks.ts` so callers reference IDs
 * instead of file paths and we get autocomplete + dead-asset detection.
 */

import { Howl, Howler } from 'howler';

export type Channel = 'bgm' | 'sfx';

export interface TrackDef {
  src: string | string[];
  /** Per-track default volume 0..1. Multiplied by channel & master volume. */
  volume?: number;
  loop?: boolean;
  /** Sprite map for SFX banks. See Howler docs. */
  sprite?: Record<string, [number, number] | [number, number, boolean]>;
}

export interface PlayOpts {
  /** Override registered loop flag. */
  loop?: boolean;
  /** Override per-track volume (still scaled by channel & master). */
  volume?: number;
  /** Sprite key, when the registered track defines a sprite map. */
  sprite?: string;
}

class AudioManager {
  private bgm = new Map<string, Howl>();
  private sfx = new Map<string, Howl>();

  private currentBGMId: string | null = null;
  private currentBGMSoundId: number | null = null;

  private bgmVolume = 0.6;
  private sfxVolume = 1.0;

  /* -------------------------------------------------------------------- */
  /*  Registration                                                        */
  /* -------------------------------------------------------------------- */

  registerBGM(id: string, def: TrackDef): void {
    if (this.bgm.has(id)) return;
    this.bgm.set(
      id,
      new Howl({
        src: Array.isArray(def.src) ? def.src : [def.src],
        loop: def.loop ?? true,
        volume: (def.volume ?? 1) * this.bgmVolume,
        html5: true, // stream long tracks
      }),
    );
  }

  registerSFX(id: string, def: TrackDef): void {
    if (this.sfx.has(id)) return;
    this.sfx.set(
      id,
      new Howl({
        src: Array.isArray(def.src) ? def.src : [def.src],
        loop: def.loop ?? false,
        volume: (def.volume ?? 1) * this.sfxVolume,
        sprite: def.sprite,
      }),
    );
  }

  /* -------------------------------------------------------------------- */
  /*  Playback                                                            */
  /* -------------------------------------------------------------------- */

  playBGM(trackId: string, opts: PlayOpts = {}): void {
    const next = this.bgm.get(trackId);
    if (!next) {
      console.warn(`[audio] unknown BGM "${trackId}" — register it in tracks.ts`);
      return;
    }
    if (this.currentBGMId === trackId && next.playing()) return;

    this.stopBGM();

    if (opts.loop !== undefined) next.loop(opts.loop);
    if (opts.volume !== undefined) next.volume(opts.volume * this.bgmVolume);

    this.currentBGMSoundId = next.play(opts.sprite);
    this.currentBGMId = trackId;
  }

  stopBGM(): void {
    if (!this.currentBGMId) return;
    const cur = this.bgm.get(this.currentBGMId);
    if (cur) cur.stop(this.currentBGMSoundId ?? undefined);
    this.currentBGMId = null;
    this.currentBGMSoundId = null;
  }

  playSFX(sfxId: string, opts: PlayOpts = {}): number | null {
    const sound = this.sfx.get(sfxId);
    if (!sound) {
      console.warn(`[audio] unknown SFX "${sfxId}" — register it in tracks.ts`);
      return null;
    }
    // Some browsers leave the WebAudio context suspended even after the
    // first user gesture if Howler's auto-unlock didn't see a matching
    // event (happens in some dev tooling / iframes). Defensive resume.
    try {
      const ctx = (Howler as unknown as { ctx?: AudioContext }).ctx;
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    } catch {
      // Ignore — fall through to Howler's own play path.
    }
    if (opts.volume !== undefined) sound.volume(opts.volume * this.sfxVolume);
    return sound.play(opts.sprite);
  }

  /* -------------------------------------------------------------------- */
  /*  Volume / mute                                                       */
  /* -------------------------------------------------------------------- */

  setMasterVolume(val: number): void {
    Howler.volume(this.clamp(val));
  }

  setBGMVolume(val: number): void {
    this.bgmVolume = this.clamp(val);
    for (const h of this.bgm.values()) h.volume(this.bgmVolume);
  }

  setSFXVolume(val: number): void {
    this.sfxVolume = this.clamp(val);
    for (const h of this.sfx.values()) h.volume(this.sfxVolume);
  }

  mute(value: boolean): void {
    Howler.mute(value);
  }

  getVolumes(): { master: number; bgm: number; sfx: number } {
    return { master: Howler.volume(), bgm: this.bgmVolume, sfx: this.sfxVolume };
  }

  private clamp(v: number): number {
    return Math.min(1, Math.max(0, v));
  }
}

export const audio = new AudioManager();

// TODO: developers — call `registerBGM`/`registerSFX` for your assets in
//       `src/audio/tracks.ts`, which is imported once at app boot.
