/**
 * Procedural Web Audio UI sound effects.
 *
 * Why procedural instead of WAV files?
 *   - The hackathon repo intentionally avoids shipping new binary assets
 *     (see existing comment in tracks.ts about asset weight). Synthesising
 *     short tones with the WebAudio API gives us pleasant, on-theme blips
 *     and chimes without adding any files to the bundle.
 *   - Lazy AudioContext creation also satisfies modern browser autoplay
 *     policies — the context only resumes after the first real user
 *     gesture, so we never spam a console warning at boot.
 *
 * Design notes:
 *   - Every sound is short (≤ 700ms) so it can stack with other feedback
 *     without dragging the UX. The longest are the win/lose stings.
 *   - `triangle` / `sine` voices for positive moods, `sawtooth` for
 *     negative moods. A small dynamic envelope (attack / decay) keeps
 *     each blip from clipping or popping.
 *   - All playback paths early-return safely if the AudioContext can't
 *     be created (SSR, locked-down embedded webview, etc.) — this module
 *     must NEVER throw and break gameplay.
 */

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      /* swallow — autoplay policy will retry on next user gesture */
    });
  }
  return ctx;
}

/** Mute (or un-mute) every UI SFX produced by this module. */
export function setUiSfxMuted(value: boolean): void {
  muted = value;
}

interface ToneOpts {
  type?: OscillatorType;
  duration?: number;
  volume?: number;
  detune?: number;
  attack?: number;
}

function playTone(freq: number, opts: ToneOpts = {}): void {
  const c = getCtx();
  if (!c || muted) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.value = freq;
  if (opts.detune) osc.detune.value = opts.detune;
  osc.connect(gain);
  gain.connect(c.destination);

  // Exponential AR envelope so blips never click on start/end.
  const peak = Math.max(0.001, opts.volume ?? 0.15);
  const attack = Math.max(0.001, opts.attack ?? 0.005);
  const duration = Math.max(0.04, opts.duration ?? 0.18);
  const t = c.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + duration);

  osc.start(t);
  osc.stop(t + attack + duration + 0.05);
}

/**
 * Bright, very short blip used for every UI button click. Intentionally
 * quiet so a chatty UI session doesn't get fatiguing.
 */
export function playClickSfx(): void {
  playTone(880, { type: 'triangle', duration: 0.05, volume: 0.09 });
  // A very faint upper octave shimmer makes it feel "polished" without
  // lengthening the perceived duration.
  playTone(1320, { type: 'sine', duration: 0.04, volume: 0.04 });
}

/**
 * Cheerful rising arpeggio (C5-E5-G5, major). Used for landing on a
 * positive scenario tier (`good` / `excellent`).
 */
export function playPositiveSfx(): void {
  const notes: Array<[number, number]> = [
    [523.25, 0],
    [659.25, 70],
    [783.99, 140],
  ];
  for (const [freq, delay] of notes) {
    window.setTimeout(
      () =>
        playTone(freq, { type: 'triangle', duration: 0.22, volume: 0.14 }),
      delay,
    );
  }
}

/**
 * Brief descending sawtooth motif. Used for landing on a negative tier
 * (`bad` / `terrible`).
 */
export function playNegativeSfx(): void {
  const notes: Array<[number, number]> = [
    [392.0, 0], // G4
    [311.13, 95], // Eb4
    [261.63, 195], // C4
  ];
  for (const [freq, delay] of notes) {
    window.setTimeout(
      () =>
        playTone(freq, { type: 'sawtooth', duration: 0.26, volume: 0.13 }),
      delay,
    );
  }
}

/**
 * Big upward fanfare for the win screen. Five-note ascending major
 * arpeggio with a held high note at the end.
 */
export function playWinSfx(): void {
  const notes: Array<[number, number, number]> = [
    [523.25, 0, 0.18], // C5
    [659.25, 110, 0.18], // E5
    [783.99, 220, 0.18], // G5
    [1046.5, 340, 0.22], // C6
    [1318.51, 470, 0.6], // E6 sustain
  ];
  for (const [freq, delay, dur] of notes) {
    window.setTimeout(
      () =>
        playTone(freq, { type: 'triangle', duration: dur, volume: 0.18 }),
      delay,
    );
  }
}

/**
 * Sad descending sting for the loss screen. Five-note descending motif
 * with a held low note at the end.
 */
export function playLoseSfx(): void {
  const notes: Array<[number, number, number]> = [
    [440, 0, 0.2], // A4
    [415.3, 130, 0.2], // Ab4
    [392, 260, 0.2], // G4
    [369.99, 390, 0.2], // F#4
    [329.63, 530, 0.7], // E4 sustain
  ];
  for (const [freq, delay, dur] of notes) {
    window.setTimeout(
      () =>
        playTone(freq, { type: 'sawtooth', duration: dur, volume: 0.16 }),
      delay,
    );
  }
}

/**
 * Tiny upward "boing" used per banana hop on the Island Run board.
 * Implemented as a short triangle tone with an exponential pitch ramp
 * (low → high) so it reads as a springy bounce rather than a plain
 * blip. Kept VERY quiet because at roll=6 it fires six times in quick
 * succession and would otherwise become fatiguing.
 */
export function playHopSfx(): void {
  const c = getCtx();
  if (!c || muted) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  const t = c.currentTime;
  // Pitch sweep: 520Hz → 880Hz over the 100ms hop body (a perfect 5th
  // up, which sounds cheerful without being saccharine).
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
  osc.connect(gain);
  gain.connect(c.destination);
  // AR envelope tuned for a quick "tick-pop" feel.
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.08, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  osc.start(t);
  osc.stop(t + 0.2);
}

/**
 * Rapid wood-on-wood "rolling dice" tick stream. Used when the dice-roll
 * button is clicked, layered under the regular click blip.
 */
export function playDiceRollSfx(): void {
  for (let i = 0; i < 7; i += 1) {
    const delay = i * 38;
    const freq = 200 + Math.random() * 220;
    window.setTimeout(
      () => playTone(freq, { type: 'square', duration: 0.04, volume: 0.05 }),
      delay,
    );
  }
}
