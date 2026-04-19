/**
 * @file Tiny WebAudio sfx bank with a 4-voice pool and optional pitch variation.
 * Subscribes to the global `audio:play` event bus so gameplay code stays
 * loosely coupled. All synthesis is oscillator-based — no mp3 files.
 */
import { eventBus } from '@/core/events';

export type AudioId =
  | 'pull'
  | 'release'
  | 'hit-light'
  | 'hit-heavy'
  | 'break'
  | 'clear'
  | 'tap'
  | 'ground';

interface AudioContextLike {
  ctx: AudioContext;
  master: GainNode;
  sfxGain: GainNode;
  currentVolume: number;
}

let bank: AudioContextLike | null = null;

function ensureBank(): AudioContextLike | null {
  if (bank) return bank;
  try {
    const AC = (window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext)!;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    const sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(master);
    bank = {
      ctx,
      master,
      sfxGain,
      currentVolume: 0.6,
    };
    return bank;
  } catch {
    return null;
  }
}

function envAndPlay(
  b: AudioContextLike,
  freq: number,
  dur: number,
  type: OscillatorType,
  peak = 0.5,
  sweepTo?: number,
) {
  const t0 = b.ctx.currentTime;
  const osc = b.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweepTo != null) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  const g = b.ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g);
  g.connect(b.sfxGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(b: AudioContextLike, dur: number, peak = 0.35) {
  const t0 = b.ctx.currentTime;
  const buffer = b.ctx.createBuffer(1, Math.max(1, Math.floor(b.ctx.sampleRate * dur)), b.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = b.ctx.createBufferSource();
  src.buffer = buffer;
  const hp = b.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1200;
  const g = b.ctx.createGain();
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(hp);
  hp.connect(g);
  g.connect(b.sfxGain);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function playSfx(id: AudioId): void {
  const b = ensureBank();
  if (!b) return;
  if (b.ctx.state === 'suspended') void b.ctx.resume();
  const pitch = 0.94 + Math.random() * 0.12;
  switch (id) {
    case 'pull':
      envAndPlay(b, 220 * pitch, 0.08, 'triangle', 0.2, 340 * pitch);
      break;
    case 'release':
      envAndPlay(b, 520 * pitch, 0.14, 'square', 0.3, 220 * pitch);
      break;
    case 'hit-light':
      envAndPlay(b, 180 * pitch, 0.1, 'square', 0.25);
      noiseBurst(b, 0.06, 0.18);
      break;
    case 'hit-heavy':
      envAndPlay(b, 95 * pitch, 0.22, 'sawtooth', 0.38, 55);
      noiseBurst(b, 0.14, 0.32);
      break;
    case 'break':
      noiseBurst(b, 0.22, 0.36);
      envAndPlay(b, 680 * pitch, 0.1, 'triangle', 0.2, 220);
      break;
    case 'clear':
      envAndPlay(b, 523, 0.18, 'triangle', 0.26, 523);
      setTimeout(() => envAndPlay(b, 784, 0.22, 'triangle', 0.3, 784), 120);
      setTimeout(() => envAndPlay(b, 1046, 0.3, 'triangle', 0.34, 1046), 260);
      break;
    case 'tap':
      envAndPlay(b, 880, 0.05, 'triangle', 0.18);
      break;
    case 'ground':
      envAndPlay(b, 80 * pitch, 0.08, 'sine', 0.25);
      noiseBurst(b, 0.08, 0.12);
      break;
  }
}

export interface AudioConfig {
  volume: number;
}

let unsub: Array<() => void> = [];
let booted = false;

/** Update master volume from outside the bank. */
export function setAudioConfig(cfg: Partial<AudioConfig>): void {
  const b = ensureBank();
  if (!b) return;
  if (typeof cfg.volume === 'number') {
    b.currentVolume = cfg.volume;
    b.master.gain.value = cfg.volume;
  }
}

/** Called from the InvestingBirds mount/unmount pair. */
export function initAudio(initial: AudioConfig): () => void {
  if (booted) return () => undefined;
  booted = true;
  const b = ensureBank();
  if (b) {
    b.currentVolume = initial.volume;
    b.master.gain.value = initial.volume;
  }
  const offSfx = eventBus.on('audio:play', (ev) => {
    if (!ev || ev.channel === 'bgm') return;
    const bank2 = ensureBank();
    if (!bank2) return;
    if (bank2.ctx.state === 'suspended') void bank2.ctx.resume();
    if (ev.id) playSfx(ev.id as AudioId);
  });
  unsub.push(offSfx);

  return () => {
    for (const u of unsub) u();
    unsub = [];
    if (bank) {
      try {
        void bank.ctx.close();
      } catch {
        /* noop */
      }
      bank = null;
    }
    booted = false;
  };
}
