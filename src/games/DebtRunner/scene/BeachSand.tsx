/**
 * @file Procedural sand plane — fine grain bump on a warm sand color, no external
 * texture file (we don't ship a sand albedo). Aligned so the boardwalk reads
 * as sitting on the beach.
 */

import { useMemo } from 'react';
import { CanvasTexture, RepeatWrapping } from 'three';

function createSandTextures(): { albedo: CanvasTexture; bump: CanvasTexture } {
  const size = 128;

  // Albedo: warm sand color with subtle per-pixel variation so it doesn't
  // look like a flat plastic plane in motion.
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d');
  if (!aCtx) throw new Error('2d context');
  const aImg = aCtx.createImageData(size, size);
  for (let i = 0; i < aImg.data.length; i += 4) {
    const jitter = Math.random() * 18 - 9;
    aImg.data[i] = Math.max(0, Math.min(255, 240 + jitter));
    aImg.data[i + 1] = Math.max(0, Math.min(255, 212 + jitter));
    aImg.data[i + 2] = Math.max(0, Math.min(255, 165 + jitter));
    aImg.data[i + 3] = 255;
  }
  aCtx.putImageData(aImg, 0, 0);
  const albedo = new CanvasTexture(albedoCanvas);
  albedo.wrapS = albedo.wrapT = RepeatWrapping;
  albedo.repeat.set(18, 18);
  albedo.anisotropy = 8;

  // Bump: tighter noise for the grain feel.
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');
  if (!bCtx) throw new Error('2d context');
  const bImg = bCtx.createImageData(size, size);
  for (let i = 0; i < bImg.data.length; i += 4) {
    const v = 90 + Math.random() * 100;
    bImg.data[i] = v;
    bImg.data[i + 1] = v;
    bImg.data[i + 2] = v;
    bImg.data[i + 3] = 255;
  }
  bCtx.putImageData(bImg, 0, 0);
  const bump = new CanvasTexture(bumpCanvas);
  bump.wrapS = bump.wrapT = RepeatWrapping;
  bump.repeat.set(24, 24);

  return { albedo, bump };
}

export default function BeachSand() {
  const { albedo, bump } = useMemo(() => createSandTextures(), []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
      <planeGeometry args={[480, 480]} />
      <meshStandardMaterial
        map={albedo}
        bumpMap={bump}
        bumpScale={0.085}
        roughness={0.94}
        metalness={0}
        color="#f0d4a5"
      />
    </mesh>
  );
}
