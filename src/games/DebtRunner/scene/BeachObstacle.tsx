/**
 * Tropical obstacle props. Each `kind` maps to a themed silhouette:
 *   block  -> coconut on the sand
 *   low    -> grumpy crab (jump over it)
 *   high   -> overhead palm-leaf bar (slide / duck)
 *   hazard -> water puddle / wet sand (causes slip)
 *
 * Geometry is procedural so we don't depend on external models. Simple
 * useFrame wobble adds life without significant cost.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { ObstacleKind } from '../types';

interface BeachObstacleProps {
  kind: ObstacleKind;
  position: [number, number, number];
}

export default function BeachObstacle({ kind, position }: BeachObstacleProps) {
  const root = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!root.current) return;
    // Tiny idle wobble keeps the world from feeling static.
    const t = clock.getElapsedTime() + position[0] * 1.7;
    if (kind === 'low') {
      // Crabs scuttle in place.
      root.current.position.x = position[0] + Math.sin(t * 4) * 0.08;
      root.current.rotation.y = Math.sin(t * 4) * 0.25;
    } else if (kind === 'hazard') {
      // Puddles shimmer (scale pulse).
      const s = 1 + Math.sin(t * 2.4) * 0.05;
      root.current.scale.set(s, 1, s);
    } else {
      // Coconuts / leaves sway softly.
      root.current.rotation.z = Math.sin(t * 1.6) * 0.06;
    }
  });

  if (kind === 'block') {
    // Coconut: brown sphere with a darker top patch.
    return (
      <group ref={root} position={position}>
        <mesh castShadow position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.5, 18, 18]} />
          <meshStandardMaterial color="#5a3a1f" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <sphereGeometry args={[0.18, 10, 10]} />
          <meshStandardMaterial color="#3a2410" roughness={0.9} />
        </mesh>
      </group>
    );
  }

  if (kind === 'low') {
    // Crab: wide coral body + claws + eyes.
    return (
      <group ref={root} position={position}>
        <mesh castShadow position={[0, 0.35, 0]}>
          <sphereGeometry args={[0.55, 16, 12]} />
          <meshStandardMaterial color="#ff6b5e" roughness={0.55} />
        </mesh>
        {/* Claws. */}
        <mesh position={[-0.55, 0.35, 0.1]} rotation={[0, 0, 0.6]}>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshStandardMaterial color="#e8493e" />
        </mesh>
        <mesh position={[0.55, 0.35, 0.1]} rotation={[0, 0, -0.6]}>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshStandardMaterial color="#e8493e" />
        </mesh>
        {/* Eye stalks. */}
        <mesh position={[-0.15, 0.7, 0.2]}>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshStandardMaterial color="#fffaf2" />
        </mesh>
        <mesh position={[0.15, 0.7, 0.2]}>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshStandardMaterial color="#fffaf2" />
        </mesh>
      </group>
    );
  }

  if (kind === 'high') {
    // Overhead palm-leaf bar — two posts + a leafy beam to slide under.
    return (
      <group ref={root} position={position}>
        <mesh position={[-0.7, 0.85, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.7, 10]} />
          <meshStandardMaterial color="#7a4f24" roughness={0.85} />
        </mesh>
        <mesh position={[0.7, 0.85, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.7, 10]} />
          <meshStandardMaterial color="#7a4f24" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.65, 0]}>
          <boxGeometry args={[1.7, 0.18, 0.18]} />
          <meshStandardMaterial color="#3fa57a" roughness={0.65} />
        </mesh>
        {/* Leafy fringe. */}
        <mesh position={[0, 1.5, 0.05]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[1.5, 0.05, 0.4]} />
          <meshStandardMaterial color="#1f7a52" />
        </mesh>
      </group>
    );
  }

  // 'hazard' — water puddle / wet sand patch (causes slip on contact).
  return (
    <group ref={root} position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.7, 24]} />
        <meshStandardMaterial
          color="#5fc7d0"
          metalness={0.3}
          roughness={0.2}
          emissive="#1a4d5c"
          emissiveIntensity={0.15}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.45, 0.55, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
