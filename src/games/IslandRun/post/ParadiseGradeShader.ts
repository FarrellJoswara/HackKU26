/**
 * @file Full-screen grade after scene render: saturation, warmth, subtle highlight lift (post-bloom feel).
 * Intended for use with `ShaderPass` + `OutputPass` (linear HDR in, ACES + sRGB out).
 */
export const ParadiseGradeShader = {
  name: 'ParadiseGradeShader',

  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.14 },
    warmth: { value: 0.42 },
    highlightBloom: { value: 0.22 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float warmth;
    uniform float highlightBloom;
    varying vec2 vUv;

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 rgb = tex.rgb;
      float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
      rgb = mix(vec3(luma), rgb, saturation);
      rgb.r += warmth * 0.055;
      rgb.g += warmth * 0.012;
      rgb.b -= warmth * 0.035;
      float peak = max(max(rgb.r, rgb.g), rgb.b);
      rgb += pow(max(peak - 0.52, 0.0), 2.0) * highlightBloom;
      gl_FragColor = vec4(rgb, tex.a);
    }
  `,
};
