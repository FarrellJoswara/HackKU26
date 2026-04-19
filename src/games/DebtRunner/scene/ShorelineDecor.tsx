/**
 * @file Wet-sand band + foam ring between ocean and dry sand (Island Run lagoonFoam echo).
 * Large static rings read as distant shoreline from the runner camera.
 */

import { DoubleSide } from 'three';

export default function ShorelineDecor() {
  return (
    <group renderOrder={-2}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.168, 0]}>
        <ringGeometry args={[260, 290, 96]} />
        <meshStandardMaterial
          color="#c4a574"
          roughness={0.9}
          metalness={0}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <ringGeometry args={[288, 302, 96]} />
        <meshStandardMaterial
          color="#fff6e8"
          roughness={0.88}
          metalness={0}
          transparent
          opacity={0.48}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
