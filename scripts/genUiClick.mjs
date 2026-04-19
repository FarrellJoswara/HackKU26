/**
 * One-off generator for `src/assets/sounds/ui_click.wav`.
 *
 * Design goal: a soft, warm "wooden tap" that fits the island/beach
 * theme. Specifically:
 *   - low fundamental (~200 Hz) so it never feels piercing,
 *   - a quiet upper octave for some shape,
 *   - a tiny noise sliver in the first 6 ms so the attack reads as
 *     percussive (a "thock") rather than a synthesized "boop",
 *   - smooth exponential decay over ~120 ms,
 *   - 16-bit PCM mono at 22050 Hz so the file stays tiny (~6 KB) and
 *     Howler can decode it instantly without HTML5 streaming.
 *
 * Run: `node scripts/genUiClick.mjs`
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'assets', 'sounds', 'ui_click.wav');

const SAMPLE_RATE = 22050;
const DURATION_MS = 130;

const FUND_HZ = 196; // low G — warm without being muddy
const OCT_HZ = FUND_HZ * 2;
const FUND_AMP = 0.6;
const OCT_AMP = 0.18;
const NOISE_AMP = 0.22;

const PEAK = 0.28; // master gain — kept low so it sits under music

const samples = Math.floor((SAMPLE_RATE * DURATION_MS) / 1000);
const audio = new Int16Array(samples);

// Pseudo-random noise burst (deterministic so the wav byte-matches each
// regeneration). Mulberry32 PRNG — small + reproducible.
let prngState = 0x9e3779b1;
function rand() {
  prngState |= 0;
  prngState = (prngState + 0x6d2b79f5) | 0;
  let t = prngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
}

for (let i = 0; i < samples; i += 1) {
  const t = i / SAMPLE_RATE;

  // Smooth attack curve: cos-ramp from 0..1 over ~6 ms eliminates the
  // hard edge that makes synthesized pips feel "clicky".
  const attack = t < 0.006 ? 0.5 - 0.5 * Math.cos((Math.PI * t) / 0.006) : 1;

  // Body envelope — exponential decay tuned for ~110 ms to -30 dB.
  const body = Math.exp(-t * 26);

  // Tiny noise sliver only during the very first 6 ms; gives the tap a
  // wooden / mallet attack without ringing on through the decay.
  const noiseEnv = t < 0.006 ? Math.exp(-t * 320) : 0;
  const noise = rand() * NOISE_AMP * noiseEnv;

  const tone =
    Math.sin(2 * Math.PI * FUND_HZ * t) * FUND_AMP +
    Math.sin(2 * Math.PI * OCT_HZ * t) * OCT_AMP;

  const sample = (tone * body * attack + noise) * PEAK;
  const clamped = Math.max(-1, Math.min(1, sample));
  audio[i] = Math.round(clamped * 0x7fff);
}

const dataBytes = audio.length * 2;
const buffer = Buffer.alloc(44 + dataBytes);
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataBytes, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(dataBytes, 40);
for (let i = 0; i < audio.length; i += 1) {
  buffer.writeInt16LE(audio[i], 44 + i * 2);
}

if (!existsSync(dirname(OUT_PATH))) mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, buffer);
console.log(`wrote ${OUT_PATH} (${buffer.length} bytes)`);
