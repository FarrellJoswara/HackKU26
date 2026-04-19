/**
 * Tiny one-shot sand-puff particle burst. We render N sprites that animate
 * outward + upward and fade out, then call `onDone` so the parent can clean
 * up. Cheap, no physics — just useFrame interpolation.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';

interface SandPuffProps {
  position: [number, number, number];
  onDone: () => void;
}

const PUFF_COUNT = 6;
const LIFETIME_S = 0.5;

export default function SandPuff({ position, onDone }: SandPuffProps) {
  const root = useRef<Group>(null);
  const meshes = useRef<Array<Mesh | null>>([]);
  const startedAt = useRef<number | null>(null);

  const directions = useMemo(
    () =>
      new Array(PUFF_COUNT).fill(0).map((_, i) => {
        const angle = (i / PUFF_COUNT) * Math.PI * 2;
        return [Math.cos(angle), 0.6 + Math.random() * 0.4, Math.sin(angle)] as [
          number,
          number,
          number,
        ];
      }),
    [],
  );

  useFrame((state) => {
    if (startedAt.current == null) startedAt.current = state.clock.getElapsedTime();
    const t = (state.clock.getElapsedTime() - startedAt.current) / LIFETIME_S;
    if (t >= 1) {
      onDone();
      return;
    }
    const ease = 1 - (1 - t) ** 2;
    meshes.current.forEach((m, i) => {
      if (!m) return;
      const dir = directions[i]!;
      const dist = ease * 0.9;
      m.position.set(dir[0] * dist, dir[1] * dist * 0.6, dir[2] * dist);
      const s = 0.18 + ease * 0.18;
      m.scale.setScalar(s);
      const mat = m.material as { opacity: number; transparent: boolean };
      mat.transparent = true;
      mat.opacity = Math.max(0, 1 - t);
    });
  });

  return (
    <group ref={root} position={position}>
      {directions.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color="#fbe6be" transparent opacity={1} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}
