/**
 * Lagoon-style water: Island Run water normals + animated UV scroll,
 * MeshPhysicalMaterial for fresnel/clearcoat read. Vertex motion kept subtle.
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { PlaneGeometry, RepeatWrapping, TextureLoader, Vector2, type Mesh } from 'three';

const WATER_NORMALS = '/island-board/textures/waternormals.jpg';

export default function Ocean() {
  const ref = useRef<Mesh>(null);
  const geometry = useMemo(() => new PlaneGeometry(900, 900, 48, 48), []);
  const basePositions = useMemo(
    () => geometry.attributes.position!.array.slice() as Float32Array,
    [geometry],
  );

  const normalMap = useLoader(TextureLoader, WATER_NORMALS);
  const normalScale = useMemo(() => new Vector2(0.65, 0.65), []);

  useLayoutEffect(() => {
    normalMap.wrapS = normalMap.wrapT = RepeatWrapping;
    normalMap.repeat.set(4, 4);
  }, [normalMap]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (normalMap) {
      normalMap.offset.set(t * 0.012, t * 0.008);
    }
    const arr = geometry.attributes.position!.array as Float32Array;
    const waveAmp = 0.14;
    for (let i = 0; i < arr.length; i += 3) {
      const x = basePositions[i] ?? 0;
      const y = basePositions[i + 1] ?? 0;
      arr[i + 2] =
        Math.sin(x * 0.05 + t * 0.85) * waveAmp * 0.95 + Math.cos(y * 0.045 + t * 0.65) * waveAmp * 0.75;
    }
    geometry.attributes.position!.needsUpdate = true;
  });

  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.32, 0]}
      geometry={geometry}
      renderOrder={-1}
    >
      <meshPhysicalMaterial
        color="#2ab8c4"
        emissive="#0a3d48"
        emissiveIntensity={0.06}
        roughness={0.28}
        metalness={0.12}
        normalMap={normalMap}
        normalScale={normalScale}
        clearcoat={0.55}
        clearcoatRoughness={0.35}
        ior={1.33}
        transparent
        opacity={0.96}
        depthWrite={false}
      />
    </mesh>
  );
}
