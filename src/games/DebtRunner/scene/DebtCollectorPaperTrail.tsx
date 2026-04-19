/**
 * Bounded bill "trail" behind the collector. Samples parent world position on a timer — no React state in the hot path.
 */

import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { Euler, MathUtils, Quaternion, Vector3 } from 'three';

const _euler = new Euler();

const SLOT_COUNT = 10;
const SAMPLE_INTERVAL = 0.055;

interface Slot {
  pos: Vector3;
  age: number;
  yaw: number;
}

interface Props {
  sourceRef: RefObject<Group | null>;
  intensity: number;
}

const _world = new Vector3();
const _quat = new Quaternion();

export default function DebtCollectorPaperTrail({ sourceRef, intensity }: Props) {
  const slotsRef = useRef<Slot[]>(
    Array.from({ length: SLOT_COUNT }, () => ({
      pos: new Vector3(0, -900, 0),
      age: 2,
      yaw: 0,
    })),
  );
  const meshRefs = useRef<(Mesh | null)[]>([]);
  const acc = useRef(0);
  const write = useRef(0);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  useFrame((_, dt) => {
    const src = sourceRef.current;
    const slots = slotsRef.current;
    if (!src) return;

    acc.current += dt;
    for (const s of slots) {
      s.age = Math.min(2, s.age + dt * 0.85);
    }

    while (acc.current >= SAMPLE_INTERVAL) {
      acc.current -= SAMPLE_INTERVAL;
      src.getWorldPosition(_world);
      src.getWorldQuaternion(_quat);
      _euler.setFromQuaternion(_quat, 'YXZ');
      const y = _euler.y;
      const slot = slots[write.current]!;
      slot.pos.copy(_world);
      slot.age = 0;
      slot.yaw = y;
      write.current = (write.current + 1) % SLOT_COUNT;
    }

    const baseOpacity = 0.12 + intensityRef.current * 0.38;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const s = slots[i]!;
      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      const fade = MathUtils.clamp(1 - s.age, 0, 1);
      const op = baseOpacity * fade * fade;
      const show = s.age < 0.98 && op >= 0.02;
      mesh.visible = show;
      mesh.position.set(s.pos.x, 0.12, s.pos.z);
      mesh.rotation.set(-Math.PI / 2, 0, s.yaw + (i % 2) * 0.4);
      mesh.scale.setScalar(show ? 1 : 0.001);
      const mat = mesh.material as { opacity: number };
      mat.opacity = op;
    }
  });

  return (
    <group>
      {Array.from({ length: SLOT_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
        >
          <planeGeometry args={[0.35 + intensity * 0.15, 0.45]} />
          <meshBasicMaterial color="#f5efe4" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
