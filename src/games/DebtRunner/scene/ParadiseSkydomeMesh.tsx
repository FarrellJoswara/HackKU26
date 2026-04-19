/**
 * R3F port of Island Run's ParadiseSkydome — gradient bands behind the scene.
 * @see IslandBoardWeb/src/skydome/ParadiseSkydome.ts
 */

import { useMemo } from 'react';
import { BackSide, Color, ShaderMaterial, SphereGeometry } from 'three';

const HORIZON = new Color(0xfff0c4);
const MID = new Color(0x9bd6f0);
const ZENITH = new Color(0x3aa6ee);

export default function ParadiseSkydomeMesh() {
  const { geometry, material } = useMemo(() => {
    const geo = new SphereGeometry(450000, 32, 24);
    const mat = new ShaderMaterial({
      name: 'ParadiseSkydome',
      uniforms: {
        uHorizon: { value: HORIZON.clone() },
        uMid: { value: MID.clone() },
        uZenith: { value: ZENITH.clone() },
        uHorizonLift: { value: 0.08 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(wp.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uHorizon;
        uniform vec3 uMid;
        uniform vec3 uZenith;
        uniform float uHorizonLift;
        varying vec3 vWorldDir;

        void main() {
          vec3 d = normalize(vWorldDir);
          float h = d.y;
          float tEdge = smoothstep(-0.05, 0.12 + uHorizonLift, h);
          float tMid = smoothstep(0.1, 0.55, h);
          vec3 col = mix(uHorizon, uMid, tEdge);
          col = mix(col, uZenith, tMid);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: BackSide,
      depthWrite: false,
      fog: false,
    });
    return { geometry: geo, material: mat };
  }, []);

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-999} />;
}
