/**
 * Cute beach runner character.
 *
 * Visual goals:
 *  - exaggerated head-to-body ratio (chibi-ish) for personality
 *  - soft tropical palette (coral shirt + cyan shorts + sandy skin)
 *  - bouncy run cycle: vertical bob + squash/stretch + arm/leg swings
 *  - lane-shift lean is applied OUTSIDE this component (see DebtRunner index)
 *
 * Keep this file purely presentational — gameplay state lives in the parent.
 */

import { forwardRef, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

interface BeachCharacterProps {
  /** True while the character is mid-jump; pose changes (limbs tuck, no run cycle). */
  jumping: boolean;
  /** True while invulnerable after a hit; we flash the body to read damage. */
  hurtFlash: boolean;
  /** 0..1, used to mute the run cycle when stamina is gone. */
  energy: number;
  /** Draw after transparent environment overlays so the runner stays readable. */
  meshRenderOrder?: number;
}

const BeachCharacter = forwardRef<Group, BeachCharacterProps>(function BeachCharacter(
  { jumping, hurtFlash, energy, meshRenderOrder = 2 },
  ref,
) {
  const body = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Run cycle frequency tracks energy: low stamina = sluggish gait.
    const cadence = 9 + energy * 4;
    const swing = jumping ? 0 : 0.55 * (0.6 + energy * 0.5);
    const bob = jumping ? 0 : Math.sin(t * cadence) * 0.07;
    const squash = jumping ? 1.08 : 1 + Math.sin(t * cadence * 2) * 0.04;

    if (body.current) {
      body.current.position.y = bob;
      // Squash/stretch breathes life into the silhouette without animations.
      body.current.scale.set(1 / squash, squash, 1 / squash);
    }

    if (armL.current) armL.current.rotation.x = Math.sin(t * cadence) * swing;
    if (armR.current) armR.current.rotation.x = -Math.sin(t * cadence) * swing;
    if (legL.current) legL.current.rotation.x = -Math.sin(t * cadence) * swing * 1.2;
    if (legR.current) legR.current.rotation.x = Math.sin(t * cadence) * swing * 1.2;
  });

  // Pastel tropical palette; flashes coral-red on hit.
  const skin = '#ffd9b3';
  const shirt = hurtFlash ? '#ff4d4d' : '#ff8b6b';
  const shorts = '#3fc3cc';
  const hair = '#3a2418';

  return (
    <group ref={ref} position={[0, 0.7, 0]}>
      <group ref={body}>
        {/* Body (rounded torso). */}
        <mesh castShadow position={[0, 0.05, 0]} renderOrder={meshRenderOrder}>
          <capsuleGeometry args={[0.32, 0.45, 6, 14]} />
          <meshStandardMaterial color={shirt} roughness={0.6} />
        </mesh>

        {/* Shorts as a separate ring of color. */}
        <mesh position={[0, -0.35, 0]} renderOrder={meshRenderOrder}>
          <cylinderGeometry args={[0.32, 0.34, 0.22, 16]} />
          <meshStandardMaterial color={shorts} roughness={0.7} />
        </mesh>

        {/* Head — slightly oversized for cuteness. */}
        <group position={[0, 0.7, 0]}>
          <mesh castShadow renderOrder={meshRenderOrder}>
            <sphereGeometry args={[0.32, 20, 20]} />
            <meshStandardMaterial color={skin} roughness={0.6} />
          </mesh>
          {/* Hair cap. */}
          <mesh position={[0, 0.18, -0.02]} rotation={[-0.2, 0, 0]} renderOrder={meshRenderOrder}>
            <sphereGeometry args={[0.33, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={hair} roughness={0.85} />
          </mesh>
          {/* Eyes — tiny dark dots, very expressive. */}
          <mesh position={[-0.1, 0.02, 0.28]} renderOrder={meshRenderOrder}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#1d1d1d" />
          </mesh>
          <mesh position={[0.1, 0.02, 0.28]} renderOrder={meshRenderOrder}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#1d1d1d" />
          </mesh>
          {/* Cheek blush — warm coral patches. */}
          <mesh position={[-0.18, -0.05, 0.25]} renderOrder={meshRenderOrder}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#ff8b8b" transparent opacity={0.55} />
          </mesh>
          <mesh position={[0.18, -0.05, 0.25]} renderOrder={meshRenderOrder}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#ff8b8b" transparent opacity={0.55} />
          </mesh>
        </group>

        {/* Arms — short capsules pivoting at the shoulder. */}
        <group ref={armL} position={[-0.36, 0.18, 0]}>
          <mesh position={[0, -0.18, 0]} renderOrder={meshRenderOrder}>
            <capsuleGeometry args={[0.085, 0.22, 4, 8]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>
        <group ref={armR} position={[0.36, 0.18, 0]}>
          <mesh position={[0, -0.18, 0]} renderOrder={meshRenderOrder}>
            <capsuleGeometry args={[0.085, 0.22, 4, 8]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>

        {/* Legs. */}
        <group ref={legL} position={[-0.14, -0.45, 0]}>
          <mesh position={[0, -0.18, 0]} renderOrder={meshRenderOrder}>
            <capsuleGeometry args={[0.1, 0.25, 4, 8]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>
        <group ref={legR} position={[0.14, -0.45, 0]}>
          <mesh position={[0, -0.18, 0]} renderOrder={meshRenderOrder}>
            <capsuleGeometry args={[0.1, 0.25, 4, 8]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>
      </group>
    </group>
  );
});

export default BeachCharacter;
