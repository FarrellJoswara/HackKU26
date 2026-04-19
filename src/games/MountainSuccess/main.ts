/**
 * @file Mountain Success — financial-freedom cinematic.
 *
 * Self-contained vanilla Three.js scene: owns its own `WebGLRenderer`
 * (mounted by `App.tsx` outside the host R3F `<Canvas>`). Mirrors the
 * IslandRun bootstrap pattern — `bootstrap(opts)` returns a cleanup
 * closure that the React shell calls on unmount.
 *
 * Mood (see plan): Caspar David Friedrich's "Wanderer above the Sea of
 * Fog" but warm and hopeful. Banana on a silhouetted peak, dense layered
 * cloud sea, large back-lit sun, additive god-rays, dawn-into-open-sky
 * palette. The viewer should feel small; the moment should feel earned.
 *
 * Cinematic timeline (seconds, see plan §"Cinematic timeline"):
 *   0.0 – 2.5  rise through the cloud sea (peak hidden)
 *   2.5 – 5.5  reveal: mountain peak emerges above cloud sea
 *   5.5 – 11.0 slow wide orbit at eye level (captions fade in via CSS)
 *   11.0 – 13.5 dolly back + tilt up so the upper frame is empty sky
 *   13.5 – 15.0 hold (white fade-in driven by CSS)
 *   15.0       opts.onComplete() — React shell navigates to menu
 *
 * Cross-game reuse: the skydome shader / grade shader / GLB URLs are
 * imported directly from `../IslandRun/...`. AGENTS.md §1 only forbids
 * `ui ↔ games` boundary crossings; same-layer game→game imports of
 * pure Three.js helpers and static asset URLs are acceptable here.
 *
 * TODO: extract `ParadiseSkydome` + `ParadiseGradeShader` to
 * `src/core/three/` if a third game ever needs them.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

import { ParadiseSkydome } from '../IslandRun/skydome/ParadiseSkydome';
import { ParadiseGradeShader } from '../IslandRun/post/ParadiseGradeShader';
import bananaUrl from '../IslandRun/assets/models/banana-guy.glb?url';

import mountainUrl from '@/assets/models/mountain-success/mountain.glb?url';
import cloudAUrl from '@/assets/models/mountain-success/cloud_a.glb?url';
import cloudBUrl from '@/assets/models/mountain-success/cloud_b.glb?url';
import cloudCUrl from '@/assets/models/mountain-success/cloud_c.glb?url';
import sunsetSunUrl from '@/assets/models/mountain-success/sunset_sun.glb?url';

/** Total scene runtime in seconds. */
const SCENE_DURATION_SEC = 15;

/** Fallback summit Y before mountain model finishes loading. */
const SUMMIT_Y = 9.2;

export interface MountainSuccessBootstrapOptions {
  /**
   * Called exactly once when the cinematic completes (~15s after
   * bootstrap). The React shell forwards this to `navigate:request →
   * menu` so the host TransitionManager owns the actual hand-off.
   * Cleared automatically if the component unmounts before completion.
   */
  onComplete: () => void;
}

export function bootstrap(opts: MountainSuccessBootstrapOptions): () => void {
  const rootEl = document.getElementById('mountain-canvas-root');
  const errEl = document.getElementById('mountain-webgl-error');
  if (!rootEl) return () => {};

  let disposed = false;
  let rafId = 0;

  /* ------------------------------------------------------------------ *
   * Renderer + scene + camera. Match IslandRun's color pipeline so the
   * grade shader produces consistent results.
   * ------------------------------------------------------------------ */
  const scene = new THREE.Scene();
  scene.fog = null;
  scene.background = null;

  const clock = new THREE.Clock();

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    500_000,
  );
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xffd1a8, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  rootEl.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gradePass = new ShaderPass(ParadiseGradeShader);
  // Slightly hotter highlights than IslandRun so the sun + god-rays glow.
  const gu = gradePass.material.uniforms;
  gu['saturation']!.value = 1.2;
  gu['warmth']!.value = 0.55;
  gu['highlightBloom']!.value = 0.32;
  composer.addPass(gradePass);
  const outputPass = new OutputPass();
  outputPass.needsSwap = false;
  composer.addPass(outputPass);

  /* ------------------------------------------------------------------ *
   * Skydome. The single most important color call — a tall vivid blue
   * zenith so the final "tilt up" beat reveals open sky, not a muddy
   * sunset gradient.
   * ------------------------------------------------------------------ */
  const skydome = new ParadiseSkydome({
    radius: 450_000,
    horizonColor: new THREE.Color(0xff8a4a),
    midColor: new THREE.Color(0xffd1a8),
    zenithColor: new THREE.Color(0x3aa2ff),
  });
  scene.add(skydome);

  /* ------------------------------------------------------------------ *
   * Lighting. Warm key from behind the peak for sunset shape/rim, cool
   * fill from camera-front-left to preserve mountain contour detail.
   * ------------------------------------------------------------------ */
  const sunDir = new THREE.Vector3(-3, 7, -16).normalize();

  const keyLight = new THREE.DirectionalLight(0xffd49a, 1.6);
  keyLight.position.copy(sunDir.clone().multiplyScalar(40));
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 80;
  keyLight.shadow.camera.left = -18;
  keyLight.shadow.camera.right = 18;
  keyLight.shadow.camera.top = 18;
  keyLight.shadow.camera.bottom = -18;
  keyLight.shadow.bias = -0.00012;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x9ed4ff, 0.4);
  fillLight.position.set(18, 6, 22);
  scene.add(fillLight);

  scene.add(new THREE.HemisphereLight(0xa3c8ff, 0x5a4a3a, 0.55));
  scene.add(new THREE.AmbientLight(0xfff4ea, 0.35));

  /* ------------------------------------------------------------------ *
   * Hero mountain model (user requested Poly Pizza model). We scale to
   * a consistent world height and track its summit for camera framing.
   * ------------------------------------------------------------------ */
  const mountainGroup = new THREE.Group();
  scene.add(mountainGroup);
  const summitPoint = new THREE.Vector3(0, SUMMIT_Y, 0);
  const bananaGroup = new THREE.Group();
  scene.add(bananaGroup);
  let bananaMixer: THREE.AnimationMixer | null = null;

  /* ------------------------------------------------------------------ *
   * Cloud sea (the hero element). Two altitude bands of `cloud.glb`
   * instances + a radial fog-wash plane underneath so distant gaps
   * read as "endless" instead of "scattered puffs."
   * ------------------------------------------------------------------ */
  const cloudGroup = new THREE.Group();
  scene.add(cloudGroup);

  // Per-instance bob — tracked so we can update y in the RAF without
  // re-traversing the group.
  const cloudBobs: { mesh: THREE.Object3D; baseY: number; phase: number }[] = [];

  // Fog-wash plane: covers the full radius so even when cloud.glb
  // hasn't loaded yet (or in the gaps between instances) we see a
  // soft white floor that reads as the top of the cloud sea.
  const fogTex = createRadialAlphaTexture(256);
  const fogWash = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180, 1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xfff4e0,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      alphaMap: fogTex,
      side: THREE.DoubleSide,
    }),
  );
  fogWash.rotation.x = -Math.PI / 2;
  fogWash.position.y = 2.2;
  fogWash.renderOrder = 2;
  scene.add(fogWash);

  // Second, larger fog plane lower down — sells "deep sea below."
  const fogBelow = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220, 1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xf2c8a0,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      alphaMap: fogTex,
      side: THREE.DoubleSide,
    }),
  );
  fogBelow.rotation.x = -Math.PI / 2;
  fogBelow.position.y = 0.4;
  fogBelow.renderOrder = 1;
  scene.add(fogBelow);

  /* ------------------------------------------------------------------ *
   * Sun (the second hero element). Large back-lit billboard placed
   * roughly behind the peak from the camera's nominal viewing angle.
   * Animates upward over the first 7s.
   * ------------------------------------------------------------------ */
  const sunGroup = new THREE.Group();
  // Fixed XZ behind the peak (camera nominally looks from +x +z toward
  // origin during orbit, so -x -z reads as "behind the mountain").
  sunGroup.position.set(-10, 4, -58);
  scene.add(sunGroup);

  /* ------------------------------------------------------------------ *
   * God-rays — single inverted cone with vertical alpha gradient,
   * additive-blended, slow rotation. Cheap, high payoff: visible
   * light shafts piercing the cloud sea.
   * ------------------------------------------------------------------ */
  const raysAlpha = createVerticalAlphaTexture(64);
  const raysMat = new THREE.MeshBasicMaterial({
    color: 0xffe6b0,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    alphaMap: raysAlpha,
    opacity: 0.78,
  });
  // Cone defaults to apex at +Y. We want apex at the sun (top) and the
  // base spreading downward toward the cloud sea, so we use the default
  // orientation and position the cone center below the sun.
  const RAYS_HEIGHT = 42;
  const raysGeo = new THREE.ConeGeometry(18, RAYS_HEIGHT, 26, 1, true);
  const raysMesh = new THREE.Mesh(raysGeo, raysMat);
  raysMesh.position.set(0, -RAYS_HEIGHT / 2, 0);
  raysMesh.renderOrder = 3;
  sunGroup.add(raysMesh);

  /* ------------------------------------------------------------------ *
   * Async asset loads. Late returns are guarded by `disposed` so a
   * teardown mid-load doesn't touch a dead scene.
   * ------------------------------------------------------------------ */

  let sunDiscRoot: THREE.Group | null = null;

  void (async () => {
    try {
      const mountainSrc = await loadGltf(mountainUrl);
      if (disposed) return;
      enableShadows(mountainSrc, true, true);
      const box = new THREE.Box3().setFromObject(mountainSrc);
      const size = new THREE.Vector3();
      box.getSize(size);
      const targetH = 16.5;
      const s = targetH / Math.max(size.y, 0.001);
      mountainSrc.scale.setScalar(s);
      // Center and place base at y=0.
      const box2 = new THREE.Box3().setFromObject(mountainSrc);
      const center = new THREE.Vector3();
      box2.getCenter(center);
      mountainSrc.position.sub(center);
      const box3 = new THREE.Box3().setFromObject(mountainSrc);
      mountainSrc.position.y -= box3.min.y;

      // Add gentle warm tint for sunset readability.
      mountainSrc.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.material) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial;
          if (std.color) std.color.lerp(new THREE.Color(0xb5916c), 0.18);
          if (std.roughness !== undefined) std.roughness = Math.max(0.75, std.roughness);
        }
      });

      mountainGroup.add(mountainSrc);
      mountainGroup.updateWorldMatrix(true, true);
      const apex = findObjectApexWorld(mountainGroup);
      if (apex) {
        summitPoint.copy(apex);
        summitPoint.y += 0.02;
      } else {
        const box4 = new THREE.Box3().setFromObject(mountainGroup);
        summitPoint.set(0, box4.max.y + 0.2, 0);
      }
    } catch (e) {
      console.warn('[MountainSuccess] mountain failed to load', e);
    }
  })();

  void (async () => {
    try {
      const { scene: bananaSrc, animations } = await loadGltfWithAnimations(bananaUrl);
      if (disposed) return;
      enableShadows(bananaSrc, true, false);
      const box = new THREE.Box3().setFromObject(bananaSrc);
      const size = new THREE.Vector3();
      box.getSize(size);
      // Keep the hero intentionally tiny so the mountain/sky scale feels epic.
      const targetH = 0.9;
      const scale = targetH / Math.max(size.y, 0.001);
      bananaSrc.scale.setScalar(scale);

      // Center local origin under the feet for stable summit placement.
      const centered = new THREE.Box3().setFromObject(bananaSrc);
      const center = new THREE.Vector3();
      centered.getCenter(center);
      bananaSrc.position.sub(center);
      const feetBox = new THREE.Box3().setFromObject(bananaSrc);
      bananaSrc.position.y -= feetBox.min.y;

      bananaGroup.add(bananaSrc);
      if (animations.length > 0) {
        bananaMixer = new THREE.AnimationMixer(bananaSrc);
        bananaMixer.clipAction(animations[0]!).play();
      }
    } catch (e) {
      console.warn('[MountainSuccess] banana failed to load', e);
    }
  })();

  function inCameraSafeCorridor(x: number, y: number, z: number): boolean {
    // Keep a clear pocket around camera key points and orbit volume.
    const anchors = [
      [2, 10.4, 8],
      [6, 13.6, 13],
      [13, 16.8, 20],
      [10, 18.8, 28],
    ] as const;
    for (const [ax, ay, az] of anchors) {
      const dx = x - ax;
      const dy = y - ay;
      const dz = z - az;
      if (dx * dx + dy * dy + dz * dz < 11 * 11) return true;
    }

    // Guard the orbit lane so large foreground meshes don't sweep
    // across the silhouette/caption beat.
    const radial = Math.hypot(x, z);
    if (radial > 11 && radial < 28 && y > 8 && y < 24) return true;
    return false;
  }

  void (async () => {
    try {
      const cloudSources = await Promise.all([
        loadGltf(cloudAUrl),
        loadGltf(cloudBUrl),
        loadGltf(cloudCUrl),
      ]);
      if (disposed) return;
      for (const src of cloudSources) lightenCloudMaterials(src);
      const cloudInfos = cloudSources.map((src) => {
        const cb = new THREE.Box3().setFromObject(src);
        const csz = new THREE.Vector3();
        cb.getSize(csz);
        // These are different cloud models; normalize each to a
        // moderate envelope so the stacked layer feels cohesive.
        const baseScale = 7.5 / Math.max(csz.x, csz.y, csz.z, 0.001);
        src.scale.setScalar(baseScale);
        return src;
      });
      const rng = createRng(0x5eedc10d);

      const spawnBand = (cfg: {
        count: number;
        radiusMin: number;
        radiusMax: number;
        yMid: number;
        yJitter: number;
        scaleMin: number;
        scaleMax: number;
        angleOffset?: number;
      }) => {
        let placed = 0;
        let attempts = 0;
        const maxAttempts = cfg.count * 12;
        while (placed < cfg.count && attempts < maxAttempts) {
          attempts++;
          const ang =
            ((placed + sampleRange(-0.32, 0.32, rng)) / cfg.count) * Math.PI * 2
            + (cfg.angleOffset ?? 0);
          const radius = sampleRange(cfg.radiusMin, cfg.radiusMax, rng);
          const y = cfg.yMid + sampleRange(-cfg.yJitter, cfg.yJitter, rng);
          const x = Math.cos(ang) * radius;
          const z = Math.sin(ang) * radius;
          if (inCameraSafeCorridor(x, y, z)) continue;

          const src = cloudInfos[Math.floor(sampleRange(0, cloudInfos.length, rng))]!;
          const m = src.clone();
          m.position.set(x, y, z);
          m.rotation.y = sampleRange(0, Math.PI * 2, rng);
          m.scale.multiplyScalar(sampleRange(cfg.scaleMin, cfg.scaleMax, rng));
          cloudGroup.add(m);
          cloudBobs.push({
            mesh: m,
            baseY: y,
            phase: sampleRange(0, Math.PI * 2, rng),
          });
          placed++;
        }
      };

      // Near band: still present for depth, but outside camera path.
      spawnBand({
        count: 34,
        radiusMin: 18,
        radiusMax: 34,
        yMid: 3.8,
        yJitter: 0.6,
        scaleMin: 0.82,
        scaleMax: 1.35,
      });
      // Far band: horizon carpet.
      spawnBand({
        count: 54,
        radiusMin: 34,
        radiusMax: 74,
        yMid: 4.7,
        yJitter: 0.8,
        scaleMin: 0.95,
        scaleMax: 1.6,
        angleOffset: 0.18,
      });
      // Small low wisps near the mountain base.
      spawnBand({
        count: 12,
        radiusMin: 10,
        radiusMax: 20,
        yMid: 2.2,
        yJitter: 0.35,
        scaleMin: 0.55,
        scaleMax: 1.05,
        angleOffset: 0.35,
      });
    } catch (e) {
      console.warn('[MountainSuccess] clouds failed to load', e);
    }
  })();

  void (async () => {
    try {
      const sunSrc = await loadGltf(sunsetSunUrl);
      if (disposed) return;
      enableShadows(sunSrc, false, false);
      boostSunDiscMaterials(sunSrc);
      const sb = new THREE.Box3().setFromObject(sunSrc);
      const ssz = new THREE.Vector3();
      sb.getSize(ssz);
      // Crank the disc to ~14 world units; reads BIG behind the peak
      // and survives the ACES tonemap with the bloom in the grade pass.
      const target = 28;
      const sn = target / Math.max(ssz.x, ssz.y, ssz.z, 0.001);
      sunSrc.scale.setScalar(sn);
      const sb2 = new THREE.Box3().setFromObject(sunSrc);
      const ctr = new THREE.Vector3();
      sb2.getCenter(ctr);
      sunSrc.position.sub(ctr);
      sunDiscRoot = sunSrc;
      sunGroup.add(sunSrc);
    } catch (e) {
      console.warn('[MountainSuccess] sun failed to load', e);
    }
  })();

  /* ------------------------------------------------------------------ *
   * Cinematic camera — pure function of `t`. Reuses scratch vectors so
   * the RAF doesn't allocate.
   * ------------------------------------------------------------------ */

  // Keyframes (positions reused across timeline segments).
  const ORBIT_RADIUS = 22;
  const ORBIT_OMEGA = 0.06; // rad/s
  const ORBIT_BASE_ANGLE = 0.18 * Math.PI;

  const camPosScratch = new THREE.Vector3();
  const camTargetScratch = new THREE.Vector3();
  const heroFocusScratch = new THREE.Vector3();

  function lerpV3(out: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, k: number) {
    out.set(
      a.x + (b.x - a.x) * k,
      a.y + (b.y - a.y) * k,
      a.z + (b.z - a.z) * k,
    );
  }

  function evalCamera(t: number): void {
    // Keep banana centered in all beats. If banana hasn't loaded yet,
    // fallback to the mountain summit anchor.
    const heroX = bananaGroup.children.length > 0 ? bananaGroup.position.x : summitPoint.x;
    const heroY = bananaGroup.children.length > 0 ? bananaGroup.position.y : summitPoint.y;
    const heroZ = bananaGroup.children.length > 0 ? bananaGroup.position.z : summitPoint.z;
    heroFocusScratch.set(heroX, heroY + 0.45, heroZ);

    const summitY = summitPoint.y;
    const closePos = new THREE.Vector3(2.1, summitY + 0.8, 6.2);
    const witnessPos = new THREE.Vector3(5.8, summitY + 1.8, 11.5);
    const revealPos = new THREE.Vector3(12.8, summitY + 4.7, 22.0);
    // Final pullback centers the summit hero in frame.
    const finalPos = new THREE.Vector3(0, summitY + 7.2, 31.0);

    if (t < 3.0) {
      const u = easeOutCubic(t / 3.0);
      lerpV3(camPosScratch, closePos, witnessPos, u);
      camTargetScratch.copy(heroFocusScratch);
    } else if (t < 7.0) {
      const u = easeInOutCubic((t - 3.0) / 4.0);
      lerpV3(camPosScratch, witnessPos, revealPos, u);
      camTargetScratch.copy(heroFocusScratch);
    } else if (t < 11.0) {
      const ang = ORBIT_BASE_ANGLE + (t - 7.0) * ORBIT_OMEGA;
      const yU = easeInOutCubic(Math.min(1, (t - 7.0) / 4.0));
      camPosScratch.set(
        Math.cos(ang) * ORBIT_RADIUS,
        summitY + 3.8 - 1.2 * yU,
        Math.sin(ang) * ORBIT_RADIUS,
      );
      camTargetScratch.copy(heroFocusScratch);
    } else if (t < 13.5) {
      const u = easeInOutCubic((t - 11.0) / 2.5);
      const orbitEndAngle = ORBIT_BASE_ANGLE + (11.0 - 7.0) * ORBIT_OMEGA;
      const orbitEndPos = new THREE.Vector3(
        Math.cos(orbitEndAngle) * ORBIT_RADIUS,
        summitY + 2.6,
        Math.sin(orbitEndAngle) * ORBIT_RADIUS,
      );
      lerpV3(camPosScratch, orbitEndPos, finalPos, u);
      camTargetScratch.copy(heroFocusScratch);
    } else {
      camPosScratch.copy(finalPos);
      camTargetScratch.copy(heroFocusScratch);
    }
    camera.position.copy(camPosScratch);
    camera.lookAt(camTargetScratch);
  }

  function evalSunY(t: number): number {
    const u = easeOutCubic(Math.min(1, t / 7));
    return THREE.MathUtils.lerp(4, 19, u);
  }

  /* ------------------------------------------------------------------ *
   * Main loop.
   * ------------------------------------------------------------------ */
  function tick() {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    evalCamera(t);

    // Sun rises over the first 7s. The rays cone follows the sun.
    sunGroup.position.y = evalSunY(t);

    // Slow rotation on rays for that lazy "shafts shifting through fog"
    // feel; rotation around Y so the spread stays visually consistent
    // regardless of camera angle.
    raysMesh.rotation.y += dt * 0.18;

    // Sun disc faces camera — read as a flat hot disc, not a 3D ball.
    if (sunDiscRoot) {
      sunDiscRoot.lookAt(camera.position);
    }

    // Clouds drift collectively + per-instance bob so the carpet
    // breathes rather than rigidly spinning.
    cloudGroup.rotation.y += dt * 0.012;
    for (let i = 0; i < cloudBobs.length; i++) {
      const b = cloudBobs[i]!;
      b.mesh.position.y = b.baseY + Math.sin(t * 0.6 + b.phase) * 0.06;
    }

    bananaMixer?.update(dt);
    if (bananaGroup.children.length > 0) {
      // Snap banana feet directly to the mountain apex so the character
      // is visibly standing on the peak (not floating off-center).
      bananaGroup.position.set(
        summitPoint.x,
        summitPoint.y + 0.003,
        summitPoint.z,
      );
      bananaGroup.lookAt(sunGroup.position.x, summitPoint.y + 0.8, sunGroup.position.z);
    }

    composer.render();
  }
  rafId = requestAnimationFrame(tick);

  /* ------------------------------------------------------------------ *
   * Completion — single-shot timer. Cleared on cleanup so an early
   * unmount (e.g. user navigates away) doesn't fire after the scene is
   * torn down.
   * ------------------------------------------------------------------ */
  let completionFired = false;
  const completionTimer = window.setTimeout(() => {
    if (disposed || completionFired) return;
    completionFired = true;
    try {
      opts.onComplete();
    } catch (e) {
      console.error('[MountainSuccess] onComplete handler threw', e);
    }
  }, SCENE_DURATION_SEC * 1000);

  /* ------------------------------------------------------------------ *
   * Resize.
   * ------------------------------------------------------------------ */
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  if (errEl) errEl.classList.add('hidden');

  return () => {
    disposed = true;
    cancelAnimationFrame(rafId);
    window.clearTimeout(completionTimer);
    window.removeEventListener('resize', onResize);

    fogTex.dispose();
    raysAlpha.dispose();
    raysGeo.dispose();
    raysMat.dispose();

    renderer.dispose();
    renderer.forceContextLoss();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  };
}

/* ============================================================ *
 * Background variant — used by the Playthrough Summary screen
 * to render the mountain scene as a quietly orbiting backdrop.
 *
 * Same hero composition as the cinematic (mountain + banana on
 * peak, cloud sea, big back-lit sun, warm sky) but:
 *   - no captions / letterbox / fade (those are CSS in
 *     `style.css`, scoped to the cinematic shell)
 *   - no completion timer (it's a backdrop, not a cutscene)
 *   - sun sits at its final height immediately so the first
 *     frame already looks like the "after the climb" beat
 *   - camera orbits indefinitely at a wider, eye-level radius
 *     so summary cards never compete with the silhouette
 * ============================================================ */

export interface MountainBackgroundOptions {
  /** Optional override for the orbit angular speed (rad/s). */
  orbitSpeed?: number;
}

export function bootstrapMountainBackground(
  rootEl: HTMLElement,
  opts: MountainBackgroundOptions = {},
): () => void {
  let disposed = false;
  let rafId = 0;

  const scene = new THREE.Scene();
  scene.fog = null;
  scene.background = null;

  const clock = new THREE.Clock();

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    500_000,
  );
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xffd1a8, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  rootEl.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gradePass = new ShaderPass(ParadiseGradeShader);
  const gu = gradePass.material.uniforms;
  gu['saturation']!.value = 1.18;
  gu['warmth']!.value = 0.5;
  gu['highlightBloom']!.value = 0.3;
  composer.addPass(gradePass);
  const outputPass = new OutputPass();
  outputPass.needsSwap = false;
  composer.addPass(outputPass);

  const skydome = new ParadiseSkydome({
    radius: 450_000,
    horizonColor: new THREE.Color(0xff8a4a),
    midColor: new THREE.Color(0xffd1a8),
    zenithColor: new THREE.Color(0x3aa2ff),
  });
  scene.add(skydome);

  const sunDir = new THREE.Vector3(-3, 7, -16).normalize();

  const keyLight = new THREE.DirectionalLight(0xffd49a, 1.6);
  keyLight.position.copy(sunDir.clone().multiplyScalar(40));
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 80;
  keyLight.shadow.camera.left = -18;
  keyLight.shadow.camera.right = 18;
  keyLight.shadow.camera.top = 18;
  keyLight.shadow.camera.bottom = -18;
  keyLight.shadow.bias = -0.00012;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x9ed4ff, 0.4);
  fillLight.position.set(18, 6, 22);
  scene.add(fillLight);

  scene.add(new THREE.HemisphereLight(0xa3c8ff, 0x5a4a3a, 0.55));
  scene.add(new THREE.AmbientLight(0xfff4ea, 0.35));

  const mountainGroup = new THREE.Group();
  scene.add(mountainGroup);
  const summitPoint = new THREE.Vector3(0, SUMMIT_Y, 0);
  const bananaGroup = new THREE.Group();
  scene.add(bananaGroup);
  let bananaMixer: THREE.AnimationMixer | null = null;

  const cloudGroup = new THREE.Group();
  scene.add(cloudGroup);
  const cloudBobs: { mesh: THREE.Object3D; baseY: number; phase: number }[] = [];

  const fogTex = createRadialAlphaTexture(256);
  const fogWash = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180, 1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xfff4e0,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      alphaMap: fogTex,
      side: THREE.DoubleSide,
    }),
  );
  fogWash.rotation.x = -Math.PI / 2;
  fogWash.position.y = 2.2;
  fogWash.renderOrder = 2;
  scene.add(fogWash);

  const fogBelow = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220, 1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xf2c8a0,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      alphaMap: fogTex,
      side: THREE.DoubleSide,
    }),
  );
  fogBelow.rotation.x = -Math.PI / 2;
  fogBelow.position.y = 0.4;
  fogBelow.renderOrder = 1;
  scene.add(fogBelow);

  // Sun parked at its final cinematic height so frame 0 already
  // reads as the post-climb tableau.
  const sunGroup = new THREE.Group();
  sunGroup.position.set(-10, 19, -58);
  scene.add(sunGroup);

  const raysAlpha = createVerticalAlphaTexture(64);
  const raysMat = new THREE.MeshBasicMaterial({
    color: 0xffe6b0,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    alphaMap: raysAlpha,
    opacity: 0.78,
  });
  const RAYS_HEIGHT = 42;
  const raysGeo = new THREE.ConeGeometry(18, RAYS_HEIGHT, 26, 1, true);
  const raysMesh = new THREE.Mesh(raysGeo, raysMat);
  raysMesh.position.set(0, -RAYS_HEIGHT / 2, 0);
  raysMesh.renderOrder = 3;
  sunGroup.add(raysMesh);

  let sunDiscRoot: THREE.Group | null = null;

  void (async () => {
    try {
      const mountainSrc = await loadGltf(mountainUrl);
      if (disposed) return;
      enableShadows(mountainSrc, true, true);
      const box = new THREE.Box3().setFromObject(mountainSrc);
      const size = new THREE.Vector3();
      box.getSize(size);
      const targetH = 16.5;
      const s = targetH / Math.max(size.y, 0.001);
      mountainSrc.scale.setScalar(s);
      const box2 = new THREE.Box3().setFromObject(mountainSrc);
      const center = new THREE.Vector3();
      box2.getCenter(center);
      mountainSrc.position.sub(center);
      const box3 = new THREE.Box3().setFromObject(mountainSrc);
      mountainSrc.position.y -= box3.min.y;

      mountainSrc.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.material) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial;
          if (std.color) std.color.lerp(new THREE.Color(0xb5916c), 0.18);
          if (std.roughness !== undefined) std.roughness = Math.max(0.75, std.roughness);
        }
      });

      mountainGroup.add(mountainSrc);
      mountainGroup.updateWorldMatrix(true, true);
      const apex = findObjectApexWorld(mountainGroup);
      if (apex) {
        summitPoint.copy(apex);
        summitPoint.y += 0.02;
      } else {
        const box4 = new THREE.Box3().setFromObject(mountainGroup);
        summitPoint.set(0, box4.max.y + 0.2, 0);
      }
    } catch (e) {
      console.warn('[MountainBackground] mountain failed to load', e);
    }
  })();

  void (async () => {
    try {
      const { scene: bananaSrc, animations } = await loadGltfWithAnimations(bananaUrl);
      if (disposed) return;
      enableShadows(bananaSrc, true, false);
      const box = new THREE.Box3().setFromObject(bananaSrc);
      const size = new THREE.Vector3();
      box.getSize(size);
      const targetH = 0.9;
      const scale = targetH / Math.max(size.y, 0.001);
      bananaSrc.scale.setScalar(scale);

      const centered = new THREE.Box3().setFromObject(bananaSrc);
      const center = new THREE.Vector3();
      centered.getCenter(center);
      bananaSrc.position.sub(center);
      const feetBox = new THREE.Box3().setFromObject(bananaSrc);
      bananaSrc.position.y -= feetBox.min.y;

      bananaGroup.add(bananaSrc);
      if (animations.length > 0) {
        bananaMixer = new THREE.AnimationMixer(bananaSrc);
        bananaMixer.clipAction(animations[0]!).play();
      }
    } catch (e) {
      console.warn('[MountainBackground] banana failed to load', e);
    }
  })();

  void (async () => {
    try {
      const cloudSources = await Promise.all([
        loadGltf(cloudAUrl),
        loadGltf(cloudBUrl),
        loadGltf(cloudCUrl),
      ]);
      if (disposed) return;
      for (const src of cloudSources) lightenCloudMaterials(src);
      const cloudInfos = cloudSources.map((src) => {
        const cb = new THREE.Box3().setFromObject(src);
        const csz = new THREE.Vector3();
        cb.getSize(csz);
        const baseScale = 7.5 / Math.max(csz.x, csz.y, csz.z, 0.001);
        src.scale.setScalar(baseScale);
        return src;
      });
      const rng = createRng(0x5eedc10d);

      const spawnBand = (cfg: {
        count: number;
        radiusMin: number;
        radiusMax: number;
        yMid: number;
        yJitter: number;
        scaleMin: number;
        scaleMax: number;
        angleOffset?: number;
      }) => {
        for (let placed = 0; placed < cfg.count; placed++) {
          const ang =
            ((placed + sampleRange(-0.32, 0.32, rng)) / cfg.count) * Math.PI * 2
            + (cfg.angleOffset ?? 0);
          const radius = sampleRange(cfg.radiusMin, cfg.radiusMax, rng);
          const y = cfg.yMid + sampleRange(-cfg.yJitter, cfg.yJitter, rng);
          const x = Math.cos(ang) * radius;
          const z = Math.sin(ang) * radius;

          const src = cloudInfos[Math.floor(sampleRange(0, cloudInfos.length, rng))]!;
          const m = src.clone();
          m.position.set(x, y, z);
          m.rotation.y = sampleRange(0, Math.PI * 2, rng);
          m.scale.multiplyScalar(sampleRange(cfg.scaleMin, cfg.scaleMax, rng));
          cloudGroup.add(m);
          cloudBobs.push({
            mesh: m,
            baseY: y,
            phase: sampleRange(0, Math.PI * 2, rng),
          });
        }
      };

      spawnBand({
        count: 30,
        radiusMin: 22,
        radiusMax: 38,
        yMid: 3.8,
        yJitter: 0.6,
        scaleMin: 0.82,
        scaleMax: 1.35,
      });
      spawnBand({
        count: 50,
        radiusMin: 40,
        radiusMax: 78,
        yMid: 4.7,
        yJitter: 0.8,
        scaleMin: 0.95,
        scaleMax: 1.6,
        angleOffset: 0.18,
      });
    } catch (e) {
      console.warn('[MountainBackground] clouds failed to load', e);
    }
  })();

  void (async () => {
    try {
      const sunSrc = await loadGltf(sunsetSunUrl);
      if (disposed) return;
      enableShadows(sunSrc, false, false);
      boostSunDiscMaterials(sunSrc);
      const sb = new THREE.Box3().setFromObject(sunSrc);
      const ssz = new THREE.Vector3();
      sb.getSize(ssz);
      const target = 28;
      const sn = target / Math.max(ssz.x, ssz.y, ssz.z, 0.001);
      sunSrc.scale.setScalar(sn);
      const sb2 = new THREE.Box3().setFromObject(sunSrc);
      const ctr = new THREE.Vector3();
      sb2.getCenter(ctr);
      sunSrc.position.sub(ctr);
      sunDiscRoot = sunSrc;
      sunGroup.add(sunSrc);
    } catch (e) {
      console.warn('[MountainBackground] sun failed to load', e);
    }
  })();

  // Slow continuous orbit. Wider than the cinematic "reveal" beat
  // and slightly elevated so the summit silhouette anchors the
  // composition, leaving the upper third of the frame for sky
  // (i.e. for the summary card to sit on).
  const ORBIT_RADIUS = 30;
  const ORBIT_HEIGHT_OFFSET = 6.4;
  const ORBIT_SPEED = opts.orbitSpeed ?? 0.045; // rad/s — full lap ~140s
  const ORBIT_BASE_ANGLE = 0.18 * Math.PI;

  const camTargetScratch = new THREE.Vector3();
  const heroFocusScratch = new THREE.Vector3();

  function tick() {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    const heroX = bananaGroup.children.length > 0 ? bananaGroup.position.x : summitPoint.x;
    const heroY = bananaGroup.children.length > 0 ? bananaGroup.position.y : summitPoint.y;
    const heroZ = bananaGroup.children.length > 0 ? bananaGroup.position.z : summitPoint.z;
    heroFocusScratch.set(heroX, heroY + 0.45, heroZ);

    const ang = ORBIT_BASE_ANGLE + t * ORBIT_SPEED;
    camera.position.set(
      Math.cos(ang) * ORBIT_RADIUS,
      summitPoint.y + ORBIT_HEIGHT_OFFSET,
      Math.sin(ang) * ORBIT_RADIUS,
    );
    camTargetScratch.copy(heroFocusScratch);
    camera.lookAt(camTargetScratch);

    raysMesh.rotation.y += dt * 0.18;

    if (sunDiscRoot) {
      sunDiscRoot.lookAt(camera.position);
    }

    cloudGroup.rotation.y += dt * 0.012;
    for (let i = 0; i < cloudBobs.length; i++) {
      const b = cloudBobs[i]!;
      b.mesh.position.y = b.baseY + Math.sin(t * 0.6 + b.phase) * 0.06;
    }

    bananaMixer?.update(dt);
    if (bananaGroup.children.length > 0) {
      bananaGroup.position.set(summitPoint.x, summitPoint.y + 0.003, summitPoint.z);
      bananaGroup.lookAt(sunGroup.position.x, summitPoint.y + 0.8, sunGroup.position.z);
    }

    composer.render();
  }
  rafId = requestAnimationFrame(tick);

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  return () => {
    disposed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);

    fogTex.dispose();
    raysAlpha.dispose();
    raysGeo.dispose();
    raysMat.dispose();

    renderer.dispose();
    renderer.forceContextLoss();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  };
}

/* ============================================================ *
 * Helpers — copy-pasted from IslandRun's main.ts so this game
 * stays self-contained (no reach into another game's internals
 * for non-shader logic). Each one is tiny and stable.
 * ============================================================ */

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleRange(min: number, max: number, rand: () => number): number {
  return min + (max - min) * rand();
}

function findObjectApexWorld(root: THREE.Object3D): THREE.Vector3 | null {
  let best: THREE.Vector3 | null = null;
  const tmp = new THREE.Vector3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry?.getAttribute('position');
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      mesh.localToWorld(tmp);
      if (!best || tmp.y > best.y) {
        best = tmp.clone();
      }
    }
  });
  return best;
}

function loadGltf(url: string): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}

function loadGltfWithAnimations(
  url: string,
): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations }),
      undefined,
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}

function enableShadows(root: THREE.Object3D, cast: boolean, receive: boolean): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
}

function lightenCloudMaterials(root: THREE.Object3D): void {
  const white = new THREE.Color(0xffffff);
  const em = new THREE.Color(0xfff0d4);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      if ('color' in std && std.color) std.color.lerp(white, 0.55);
      if ('emissive' in std && std.emissive) {
        std.emissive.copy(em);
        std.emissiveIntensity = 0.18;
      }
      if ('side' in std) std.side = THREE.DoubleSide;
    }
  });
}

function boostSunDiscMaterials(root: THREE.Object3D): void {
  const warm = new THREE.Color(0xfff2cc);
  const halo = new THREE.Color(0xffd080);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
        const b = mat as THREE.MeshBasicMaterial;
        b.color.copy(warm).lerp(halo, 0.25);
        b.toneMapped = true;
        continue;
      }
      const std = mat as THREE.MeshStandardMaterial;
      if (std.emissive) std.emissive.copy(warm).lerp(halo, 0.4);
      std.emissiveIntensity = Math.max(std.emissiveIntensity ?? 0, 1.05);
      std.toneMapped = true;
    }
  });
}

/**
 * Soft radial gradient (white center → transparent edges). Used as
 * `alphaMap` on the fog-wash planes so they fade to nothing at the
 * edges instead of showing a hard square boundary.
 */
function createRadialAlphaTexture(size: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context');
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/**
 * Vertical alpha gradient (bright at top → transparent at bottom)
 * used as `alphaMap` on the god-rays cone so the shafts fade out as
 * they spread away from the sun.
 */
function createVerticalAlphaTexture(size: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context');
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
