/**
 * Textured sand plane (Island Run sand albedo) + procedural grain bump,
 * aligned so the boardwalk reads as sitting on the beach.
 */

import { useLayoutEffect, useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';

const SAND_ALBEDO = '/island-board/textures/sand/albedo.jpg';

function createGrainBumpTexture(): CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 90 + Math.random() * 100;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(24, 24);
  return tex;
}

export default function BeachSand() {
  const albedo = useLoader(TextureLoader, SAND_ALBEDO);
  const bumpMap = useMemo(() => createGrainBumpTexture(), []);

  useLayoutEffect(() => {
    albedo.wrapS = albedo.wrapT = RepeatWrapping;
    albedo.repeat.set(18, 18);
    albedo.colorSpace = SRGBColorSpace;
    albedo.anisotropy = 8;
  }, [albedo]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
      <planeGeometry args={[480, 480]} />
      <meshStandardMaterial
        map={albedo}
        bumpMap={bumpMap}
        bumpScale={0.085}
        roughness={0.94}
        metalness={0}
        color="#f0d4a5"
      />
    </mesh>
  );
}
