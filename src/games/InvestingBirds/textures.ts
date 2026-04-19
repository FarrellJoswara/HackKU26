import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three';
import { CATEGORY_META, COLORS } from './config';
import type { BlockMaterial, LevelType } from './types';

/** Category-tinted stone brick texture. */
export function buildStoneTexture(tint: string): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grd = ctx.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, COLORS.stoneTop);
  grd.addColorStop(0.5, COLORS.stoneLight);
  grd.addColorStop(1, COLORS.stoneMid);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);

  ctx.globalAlpha = 0.32;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;

  ctx.fillStyle = COLORS.stoneMortar;
  const rows = 3;
  const cols = 2;
  const rowH = size / rows;
  const colW = size / cols;
  for (let r = 0; r < rows; r += 1) {
    const y = r * rowH;
    ctx.fillRect(0, y, size, 3);
    const offset = r % 2 === 0 ? 0 : colW / 2;
    for (let c = 0; c <= cols; c += 1) {
      const x = c * colW + offset;
      ctx.fillRect(x - 1, y, 3, rowH);
    }
  }
  ctx.fillRect(0, size - 2, size, 2);
  for (let i = 0; i < 60; i += 1) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    ctx.fillRect(cx, cy, 2, 2);
  }

  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function buildWoodTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b7864a';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#6b3410';
  ctx.lineWidth = 2;
  for (let y = 8; y < size; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y) * 3);
    for (let x = 0; x < size; x += 8) {
      ctx.lineTo(x, y + Math.sin((x + y) * 0.08) * 2.5);
    }
    ctx.stroke();
  }
  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function buildIceTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grd = ctx.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, '#d5efff');
  grd.addColorStop(1, '#9fd6ff');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 16; i += 1) {
    ctx.beginPath();
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40);
    ctx.stroke();
  }
  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function drawBirdFace(
  ctx: CanvasRenderingContext2D,
  size: number,
  bodyColor: string,
  darkColor: string,
  mood: 'idle' | 'pulled',
) {
  ctx.clearRect(0, 0, size, size);
  const body = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.12,
    size / 2,
    size / 2,
    size * 0.5,
  );
  body.addColorStop(0, bodyColor);
  body.addColorStop(1, darkColor);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(size * 0.54, size * 0.42, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size * 0.74, size * 0.42, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  if (mood === 'pulled') {
    ctx.beginPath();
    ctx.ellipse(size * 0.56, size * 0.45, size * 0.045, size * 0.018, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(size * 0.76, size * 0.45, size * 0.04, size * 0.018, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(size * 0.46, size * 0.34);
    ctx.lineTo(size * 0.62, size * 0.38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.68, size * 0.34);
    ctx.lineTo(size * 0.82, size * 0.38);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(size * 0.56, size * 0.43, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size * 0.76, size * 0.43, size * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = COLORS.birdBeak;
  ctx.beginPath();
  ctx.moveTo(size * 0.85, size * 0.56);
  ctx.lineTo(size * 0.98, size * 0.48);
  ctx.lineTo(size * 0.98, size * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function buildBirdTexture(
  type: LevelType,
  mood: 'idle' | 'pulled' = 'idle',
): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const palette: Record<LevelType, { body: string; dark: string }> = {
    stocks: { body: '#ef4444', dark: '#7f1d1d' },
    etfs: { body: '#60a5fa', dark: '#1e3a8a' },
    bonds: { body: '#34d399', dark: '#14532d' },
    crypto: { body: '#fbbf24', dark: '#78350f' },
  };
  const p = palette[type];
  drawBirdFace(ctx, size, p.body, p.dark, mood);
  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function loadBeachTexture(): Texture {
  // Intentionally NOT using drei's `useTexture` — it throws a promise to
  // suspend and blanks the whole game subtree until the image loads. Plain
  // TextureLoader returns an empty texture immediately and fills it in.
  const tex = new TextureLoader().load(
    '/investingbirds/beach-tropical.png',
    (loaded) => {
      loaded.colorSpace = SRGBColorSpace;
    },
  );
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export interface CategoryStoneTextures {
  stocks: CanvasTexture;
  etfs: CanvasTexture;
  bonds: CanvasTexture;
  crypto: CanvasTexture;
}

export function buildStoneTexturesByCategory(): CategoryStoneTextures {
  return {
    stocks: buildStoneTexture(CATEGORY_META.stocks.accent),
    etfs: buildStoneTexture(CATEGORY_META.etfs.accent),
    bonds: buildStoneTexture(CATEGORY_META.bonds.accent),
    crypto: buildStoneTexture(CATEGORY_META.crypto.accent),
  };
}

export type MaterialTextureMap = Record<BlockMaterial, CanvasTexture | null>;
