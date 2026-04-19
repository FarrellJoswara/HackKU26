/**
 * @file Gradient sunset skydome mesh shared by Island Run and other tropical scenes.
 */

import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry } from 'three';

export interface ParadiseSkydomeOptions {
  /** Sphere radius (match scale of scene / sky) */
  radius?: number;
  /** Horizon band (warm orange–coral) */
  horizonColor?: Color;
  /** Mid sky (pink–magenta) */
  midColor?: Color;
  /** Zenith (cerulean–azure) */
  zenithColor?: Color;
}

/**
 * Stylized gradient sky (fantasy sunset bands). Renders as an inverted sphere behind the scene.
 */
export class ParadiseSkydome extends Mesh {
  declare material: ShaderMaterial;

  constructor(options: ParadiseSkydomeOptions = {}) {
    const radius = options.radius ?? 450000;
    const horizonColor = options.horizonColor ?? new Color(0xff8a45);
    const midColor = options.midColor ?? new Color(0xe8a8d0);
    const zenithColor = options.zenithColor ?? new Color(0x4ba8f8);

    const geo = new SphereGeometry(radius, 32, 24);

    const mat = new ShaderMaterial({
      name: 'ParadiseSkydome',
      uniforms: {
        uHorizon: { value: horizonColor.clone() },
        uMid: { value: midColor.clone() },
        uZenith: { value: zenithColor.clone() },
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

    super(geo, mat);
    this.frustumCulled = false;
    this.renderOrder = -999;
  }

  /** Keep colors editable at runtime */
  setColors(horizon: Color, mid: Color, zenith: Color): void {
    const u = this.material.uniforms;
    (u['uHorizon']!.value as Color).copy(horizon);
    (u['uMid']!.value as Color).copy(mid);
    (u['uZenith']!.value as Color).copy(zenith);
  }
}