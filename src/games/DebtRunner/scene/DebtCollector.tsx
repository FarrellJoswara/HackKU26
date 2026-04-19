/**
 * Stylized "Debt Collector" — suit, briefcase, clipboard, phone; cute but stressful.
 * Animation cadence scales with `intensity` (chase tightness) and `stage`.
 */

import { forwardRef, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { RunnerHudState } from '@/core/runner/hudTypes';

export interface DebtCollectorProps {
  /** 0 = far / calm, 1 = on your heels. */
  intensity: number;
  monsterStage: RunnerHudState['monsterStage'];
}

const DebtCollector = forwardRef<Group, DebtCollectorProps>(function DebtCollector(
  { intensity, monsterStage },
  ref,
) {
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const briefcase = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);

  const stageBoost =
    monsterStage === 'overwhelming'
      ? 1.25
      : monsterStage === 'dangerous'
        ? 1.1
        : monsterStage === 'threatening'
          ? 1.04
          : 1;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const cadence = (5.5 + intensity * 9 * stageBoost) * stageBoost;
    const bob = Math.sin(t * cadence) * (0.045 + intensity * 0.05);
    const sway = Math.sin(t * cadence * 0.5) * (0.02 + intensity * 0.03);

    if (torso.current) {
      torso.current.position.y = 0.85 + bob;
      torso.current.rotation.z = sway * 0.35;
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(t * cadence * 0.35) * (0.12 + intensity * 0.1);
      head.current.rotation.x = Math.sin(t * cadence * 0.7) * 0.04;
    }
    if (armL.current) {
      armL.current.rotation.x = Math.sin(t * cadence) * (0.55 + intensity * 0.2);
    }
    if (armR.current) {
      armR.current.rotation.x = -Math.sin(t * cadence + 0.4) * (0.5 + intensity * 0.18);
    }
    if (legL.current) {
      legL.current.rotation.x = Math.sin(t * cadence) * 0.35;
    }
    if (legR.current) {
      legR.current.rotation.x = -Math.sin(t * cadence) * 0.35;
    }
    if (briefcase.current) {
      briefcase.current.rotation.z = Math.sin(t * cadence * 1.1) * (0.18 + intensity * 0.12);
      briefcase.current.rotation.x = 0.25 + Math.sin(t * cadence) * 0.06;
    }
  });

  const skin = '#f5d4b8';
  const suit = `rgb(${Math.round(32 + intensity * 28)}, ${Math.round(42 + intensity * 20)}, ${Math.round(72 + intensity * 18)})`;
  const suitDark = `rgb(${Math.round(18 + intensity * 22)}, ${Math.round(26 + intensity * 16)}, ${Math.round(48 + intensity * 14)})`;
  const tie = `rgb(${Math.round(200 - intensity * 40)}, ${Math.round(55 - intensity * 15)}, ${Math.round(48 - intensity * 12)})`;
  const briefMetal = '#6a7a8a';
  const paper = '#f8f4ea';
  const eyeEmissive = intensity * 0.55 + (monsterStage === 'overwhelming' ? 0.35 : 0);

  return (
    <group ref={ref}>
      <group>
        {/* Ground shadow — reads pressure without extra lights */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
          <circleGeometry args={[1.15 + intensity * 0.35, 24]} />
          <meshBasicMaterial color="#1a1020" transparent opacity={0.28 + intensity * 0.22} depthWrite={false} />
        </mesh>

        <group ref={torso} position={[0, 0.85, 0]}>
          {/* Legs */}
          <group ref={legL} position={[-0.22, -0.55, 0]}>
            <mesh position={[0, -0.28, 0]}>
              <capsuleGeometry args={[0.11, 0.38, 4, 8]} />
              <meshStandardMaterial color={suitDark} roughness={0.75} />
            </mesh>
          </group>
          <group ref={legR} position={[0.22, -0.55, 0]}>
            <mesh position={[0, -0.28, 0]}>
              <capsuleGeometry args={[0.11, 0.38, 4, 8]} />
              <meshStandardMaterial color={suitDark} roughness={0.75} />
            </mesh>
          </group>

          {/* Jacket */}
          <mesh castShadow>
            <boxGeometry args={[0.72, 0.78, 0.42]} />
            <meshStandardMaterial color={suit} roughness={0.62} metalness={0.08} />
          </mesh>
          <mesh position={[0, 0.02, 0.22]} castShadow>
            <boxGeometry args={[0.5, 0.65, 0.08]} />
            <meshStandardMaterial color={suitDark} roughness={0.7} />
          </mesh>
          {/* Tie */}
          <mesh position={[0, 0.08, 0.24]} castShadow>
            <boxGeometry args={[0.12, 0.52, 0.04]} />
            <meshStandardMaterial color={tie} roughness={0.45} emissive={tie} emissiveIntensity={0.06 + intensity * 0.12} />
          </mesh>

          {/* Arms */}
          <group ref={armL} position={[-0.44, 0.12, 0]}>
            <mesh position={[0, -0.22, 0]} castShadow rotation={[0.2, 0, 0]}>
              <capsuleGeometry args={[0.09, 0.36, 4, 8]} />
              <meshStandardMaterial color={suit} roughness={0.65} />
            </mesh>
          </group>
          <group ref={armR} position={[0.44, 0.12, 0]}>
            <mesh position={[0, -0.22, 0]} castShadow rotation={[0.15, 0, 0]}>
              <capsuleGeometry args={[0.09, 0.36, 4, 8]} />
              <meshStandardMaterial color={suit} roughness={0.65} />
            </mesh>
            {/* Phone in right hand */}
            <mesh position={[0.02, -0.42, 0.06]} rotation={[0.25, 0, 0.15]} castShadow>
              <boxGeometry args={[0.1, 0.16, 0.03]} />
              <meshStandardMaterial
                color="#2a2a38"
                roughness={0.35}
                metalness={0.25}
                emissive="#7af0c8"
                emissiveIntensity={0.15 + intensity * 0.35}
              />
            </mesh>
          </group>

          {/* Briefcase + papers (left side) */}
          <group ref={briefcase} position={[-0.52, -0.18, 0.12]} rotation={[0.25, 0.35, 0.15]}>
            <mesh castShadow>
              <boxGeometry args={[0.38, 0.28, 0.1]} />
              <meshStandardMaterial color={briefMetal} roughness={0.4} metalness={0.35} />
            </mesh>
            <mesh position={[0.08, 0.18, 0.02]} rotation={[0.4, 0, 0.2]}>
              <boxGeometry args={[0.22, 0.02, 0.28]} />
              <meshStandardMaterial color={paper} roughness={0.9} />
            </mesh>
            <mesh position={[-0.06, 0.2, -0.04]} rotation={[0.5, -0.2, 0]}>
              <boxGeometry args={[0.18, 0.02, 0.24]} />
              <meshStandardMaterial color="#eee8dc" roughness={0.92} />
            </mesh>
          </group>

          {/* Clipboard */}
          <group position={[0.48, 0.05, 0.18]} rotation={[0.1, -0.25, 0.08]}>
            <mesh castShadow>
              <boxGeometry args={[0.26, 0.34, 0.025]} />
              <meshStandardMaterial color="#5c4033" roughness={0.85} />
            </mesh>
            <mesh position={[0, 0, 0.02]}>
              <boxGeometry args={[0.22, 0.3, 0.01]} />
              <meshStandardMaterial color={paper} roughness={0.88} />
            </mesh>
          </group>

          {/* Head */}
          <group ref={head} position={[0, 0.62, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.38, 20, 16]} />
              <meshStandardMaterial color={skin} roughness={0.55} />
            </mesh>
            {/* Hair */}
            <mesh position={[0, 0.28, -0.05]} castShadow>
              <sphereGeometry args={[0.36, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#3d2a22" roughness={0.9} />
            </mesh>
            {/* Eyes */}
            <mesh position={[-0.12, 0.06, 0.32]}>
              <sphereGeometry args={[0.07, 10, 10]} />
              <meshStandardMaterial color="#fffaf2" />
            </mesh>
            <mesh position={[0.12, 0.06, 0.32]}>
              <sphereGeometry args={[0.07, 10, 10]} />
              <meshStandardMaterial color="#fffaf2" />
            </mesh>
            <mesh position={[-0.12, 0.06, 0.38]}>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshStandardMaterial
                color="#1a0508"
                emissive="#ff4422"
                emissiveIntensity={eyeEmissive}
              />
            </mesh>
            <mesh position={[0.12, 0.06, 0.38]}>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshStandardMaterial
                color="#1a0508"
                emissive="#ff4422"
                emissiveIntensity={eyeEmissive}
              />
            </mesh>
            {/* Brow */}
            <mesh position={[0, 0.18, 0.3]} rotation={[0.35, 0, 0]}>
              <boxGeometry args={[0.38, 0.06, 0.08]} />
              <meshStandardMaterial color="#2a1810" roughness={0.9} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
});

export default DebtCollector;
