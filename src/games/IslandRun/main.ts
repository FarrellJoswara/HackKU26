import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { ParadiseGradeShader } from './post/ParadiseGradeShader';
import { ParadiseSkydome } from './skydome/ParadiseSkydome';
import { ParadiseWater } from './water/ParadiseWater';
import { getLandingPayload } from './landingPayload';
import { SQUARE_LABELS } from './tips';
import { eventBus } from '@/core/events';
import { advanceHops } from '@/core/campaign/lapCounter';
import type {
  IslandScenarioBeat,
  IslandScenarioChoiceId,
  IslandScenarioBeatId,
} from '@/core/scenarios';

import diceUrl from './assets/models/dice.glb?url';
import bananaUrl from './assets/models/banana-guy.glb?url';
import queenPalmUrl from './assets/models/queen-palm.glb?url';
import cloudUrl from './assets/models/cloud.glb?url';
import sunUrl from './assets/models/sun.glb?url';
import palmTreesUrl from './assets/models/nature-pack/Palm Trees.glb?url';
import rocksUrl from './assets/models/nature-pack/Rocks.glb?url';
import waterNormalsUrl from './assets/textures/waternormals.jpg?url';
import woodAlbedoUrl from './assets/textures/wood/albedo.jpg?url';

const NUM_SQUARES = 12;
const BOARD_R = 6.8;
const TILE_LEN = 2.05;
const TILE_WID = 1.65;
const TILE_Y = 0.1;

/** Duration of one banana hop between adjacent squares (seconds). */
const BANANA_HOP_SEC = 0.42;
/** Extra pause after the last hop before the tip dialog opens (ms). */
const LANDING_AFTER_BANANA_MS = 480;
const DICE_SNAP_SEC = 0.38;
/** HUD center dice block: pop in during the throw, pop out after the world die settles. */
const DICE_POP_IN_SEC = 0.28;
const DICE_POP_OUT_SEC = 0.32;
/** Camera-space placement + size of the center dice block. */
const DICE_CENTER_POS = new THREE.Vector3(0, -0.35, -7.5);
const DICE_CENTER_SCALE = 1.35;
// Real-board-game toss: slower flight so the spin reads, snappy settle so the
// face is unambiguous, dwell so the player has time to actually *see* the value.
const WORLD_DICE_TUMBLE_SEC = 1.25;
const WORLD_DICE_SNAP_SEC = 0.32;
const WORLD_DICE_DWELL_SEC = 0.75;
/** Extends throw past the intended land point for a bit of overshoot/skid feel. */
const WORLD_DICE_THROW_DIST_MUL = 1.05;
/** Maps world die mesh to Y-up; tune if top face ≠ HUD. */
const WORLD_DICE_OFFSET = new THREE.Euler(Math.PI / 2, 0, 0, 'XYZ');

/**
 * Euler (XYZ) that brings each die value's pip face to the camera.
 * Calibrated against this specific dice GLB on 2026-04-19; if the GLB asset
 * is swapped, re-verify by snapping each face and inspecting visible pips.
 */
const DICE_VALUE_EULER: Record<number, [number, number, number]> = {
  1: [Math.PI, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  3: [0, -Math.PI / 2, 0],
  4: [0, Math.PI / 2, 0],
  5: [Math.PI / 2, 0, 0],
  6: [0, 0, 0],
};

/** Fine grain for sand bump only (no photo albedo). */
function createGrainBumpTexture(): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 90 + Math.random() * 100;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function enableShadows(root: THREE.Object3D, cast: boolean, receive: boolean) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
}

/** `clone(true)` can still share materials; clone so HUD and world dice never alias. */
function cloneMeshMaterialsUnique(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = mats.map((mat) => mat.clone()) as typeof mesh.material;
  });
}

function setCloudMaterialsDoubleSided(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if ('side' in mat) (mat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
        if ('depthWrite' in mat) (mat as THREE.MeshStandardMaterial).depthWrite = true;
        if ('transparent' in mat && (mat as THREE.Material).transparent) {
          (mat as THREE.MeshStandardMaterial).opacity = Math.min(
            1,
            (mat as THREE.MeshStandardMaterial).opacity || 0.95,
          );
        }
      }
    }
  });
}

/** Warm emissive on authored sun mesh so grade/bloom reads a clear disc. */
function boostSunDiscMaterials(root: THREE.Object3D) {
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
      if (std.emissive) std.emissive.copy(warm).lerp(halo, 0.35);
      std.emissiveIntensity = Math.max(std.emissiveIntensity ?? 0, 0.85);
      std.toneMapped = true;
    }
  });
}

/** Softer, brighter clouds for tropical sky mood. */
function lightenCloudMaterials(root: THREE.Object3D) {
  const white = new THREE.Color(0xffffff);
  const em = new THREE.Color(0xe8f4ff);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      if (std.color) std.color.lerp(white, 0.44);
      std.emissive.copy(em);
      std.emissiveIntensity = 0.11;
    }
  });
}

async function loadGltf(url: string): Promise<THREE.Group> {
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

async function loadGltfWithAnimations(url: string): Promise<{
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}> {
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

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Boots the Island Run scene into the existing `#canvas-root` element and
 * wires the HUD DOM (`#roll-btn`, `#status`, `#dice-face`, etc.) that the
 * React shell renders. Returns a cleanup closure that the shell calls on
 * unmount to cancel RAF, remove listeners, and dispose GPU resources.
 * Three notable deltas from a vanilla Three.js `main()`:
 *   1. Asset URLs come from Vite `?url` imports instead of runtime helpers.
 *   2. `main()` is renamed `bootstrap()` and returns a cleanup function.
 *   3. A `disposed` flag guards async IIFEs so late model loads don't touch
 *      a torn-down scene.
 */
export interface IslandRunBootstrapOptions {
  /**
   * Called every time a landing dialog is about to open so funding ratios
   * passed to `getLandingPayload` reflect the **current** Box allocations,
   * not a value captured at bootstrap time. Returning `null` falls back to
   * the seeded demo ratios in `getBoardLandingScenarioBody`.
   *
   * Pure read — must not mutate the store.
   */
  getPlayerSnapshot?: () => {
    annualSalary: number;
    fundingRatioByCategory: Partial<Record<string, number>>;
  } | null;
  /**
   * Called once per lap (`totalHops % NUM_SQUARES === 0` after a roll).
   * The shell forwards this to the campaign router via the typed Event
   * Bus so `core` never imports games. Receives `{ totalHops, laps }`.
   */
  onLapComplete?: (info: { totalHops: number; laps: number }) => void;
  /**
   * Hop counter to start from (cumulative hops across all prior Island
   * Run sessions for the active save). Lets the React shell keep the
   * lap counter continuous across remounts so a year-end can never be
   * lost or fired twice when the player navigates away mid-year and
   * comes back.
   */
  initialTotalHops?: number;
}

export function bootstrap(opts: IslandRunBootstrapOptions = {}): () => void {
  const rootEl = document.getElementById('canvas-root');
  const errEl = document.getElementById('webgl-error');
  if (!rootEl) return () => {};

  let disposed = false;
  let rafId = 0;

  const scene = new THREE.Scene();
  scene.fog = null;
  scene.background = null;

  const clock = new THREE.Clock();

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500000);
  camera.position.set(0, 12.5, 15.2);
  /** So `camera.add(diceViewRoot)` is traversed by the scene graph (HUD die + EffectComposer). */
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  /** Scene renders linear HDR; `OutputPass` applies ACES + sRGB at end of composer chain. */
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  rootEl.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const gradePass = new ShaderPass(ParadiseGradeShader);
  const g = gradePass.material.uniforms;
  g['saturation']!.value = 1.14;
  g['warmth']!.value = 0.42;
  g['highlightBloom']!.value = 0.22;
  const outputPass = new OutputPass();
  outputPass.needsSwap = false;
  composer.addPass(renderPass);
  composer.addPass(gradePass);
  composer.addPass(outputPass);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.minDistance = 6;
  controls.maxDistance = 42;
  controls.target.set(0, 0.2, 0);

  const diceViewRoot = new THREE.Group();
  camera.add(diceViewRoot);
  diceViewRoot.position.copy(DICE_CENTER_POS);
  diceViewRoot.scale.setScalar(0);
  diceViewRoot.visible = false;
  let diceModel: THREE.Group | null = null;
  let dicePendingFace: number | null = null;
  let diceMode: 'idle' | 'tumble' | 'snap' = 'idle';
  let diceSnapT0 = 0;
  const diceQA = new THREE.Quaternion();
  const diceQB = new THREE.Quaternion();
  const diceEu = new THREE.Euler(0, 0, 0, 'XYZ');
  /** 0 = hidden, 1 = fully popped in. Drives scale/visibility of the center dice. */
  let dicePopT = 0;
  let dicePopTarget = 0;

  const worldDiceGroup = new THREE.Group();
  worldDiceGroup.renderOrder = 5;
  scene.add(worldDiceGroup);
  let worldDiceModel: THREE.Group | null = null;
  let worldDiceReady = false;
  let worldDiceLandY = 0.12;
  let worldDiceStartX = 0;
  let worldDiceStartZ = 0;
  let worldDiceStartY = 0.35;
  let worldDiceEndX = 0;
  let worldDiceEndZ = 0;
  let worldDiceArcH = 0.55;
  type WorldDiceMode = 'idle' | 'tumble' | 'snap' | 'dwell';
  let worldDiceMode: WorldDiceMode = 'idle';
  let worldDiceRollValue = 1;
  let worldDiceTumbleT0 = 0;
  let worldDiceSnapT0 = 0;
  let worldDiceDwellT0 = 0;
  // Per-roll randomized spin velocity (rad/s) — set in worldDiceBeginRoll so
  // each throw has its own unique tumble instead of a procedural sine wobble.
  let worldSpinVX = 10;
  let worldSpinVY = 14;
  let worldSpinVZ = 8;
  const wDiceEu = new THREE.Euler(0, 0, 0, 'XYZ');
  const worldDiceQA = new THREE.Quaternion();
  const worldDiceQB = new THREE.Quaternion();
  const worldDiceOffsetQuat = new THREE.Quaternion().setFromEuler(WORLD_DICE_OFFSET);

  function worldTargetQuatForRoll(roll: number): THREE.Quaternion {
    const trip = DICE_VALUE_EULER[roll] ?? DICE_VALUE_EULER[1]!;
    wDiceEu.set(trip[0], trip[1], trip[2]);
    const qFace = new THREE.Quaternion().setFromEuler(wDiceEu);
    return worldDiceOffsetQuat.clone().multiply(qFace);
  }

  function applyDiceFaceInstant(value: number) {
    if (!diceModel) return;
    const trip = DICE_VALUE_EULER[value] ?? DICE_VALUE_EULER[1]!;
    diceEu.set(trip[0], trip[1], trip[2]);
    diceModel.setRotationFromEuler(diceEu);
  }
  function diceBeginTumble() {
    diceMode = 'tumble';
  }
  function diceSettleToFace(value: number) {
    if (!diceModel) {
      dicePendingFace = value;
      return;
    }
    diceMode = 'snap';
    diceQA.copy(diceModel.quaternion);
    const trip = DICE_VALUE_EULER[value] ?? DICE_VALUE_EULER[1]!;
    diceEu.set(trip[0], trip[1], trip[2]);
    diceQB.setFromEuler(diceEu);
    diceSnapT0 = clock.elapsedTime;
  }
  function diceUpdate(dt: number, elapsed: number) {
    if (diceModel) {
      if (diceMode === 'tumble') {
        diceModel.rotation.x += dt * (10 + Math.sin(elapsed * 31) * 4);
        diceModel.rotation.y += dt * 14;
        diceModel.rotation.z += dt * (8 + Math.cos(elapsed * 19) * 3);
      } else if (diceMode === 'snap') {
        const u = Math.min(1, (elapsed - diceSnapT0) / DICE_SNAP_SEC);
        const k = easeOutCubic(u);
        diceModel.quaternion.copy(diceQA).slerp(diceQB, k);
        if (u >= 1) diceMode = 'idle';
      }
    }
    // Mario-Party center pop: tween dicePopT toward target, derive scale + bob.
    const popDur = dicePopTarget > dicePopT ? DICE_POP_IN_SEC : DICE_POP_OUT_SEC;
    const step = dt / Math.max(0.0001, popDur);
    if (dicePopTarget > dicePopT) dicePopT = Math.min(dicePopTarget, dicePopT + step);
    else if (dicePopTarget < dicePopT) dicePopT = Math.max(dicePopTarget, dicePopT - step);
    const k = easeOutCubic(dicePopT);
    diceViewRoot.scale.setScalar(DICE_CENTER_SCALE * k);
    diceViewRoot.visible = k > 0.001;
    // Subtle hover + slow spin around Y while visible — feels like a floating block.
    diceViewRoot.position.x = DICE_CENTER_POS.x;
    diceViewRoot.position.y = DICE_CENTER_POS.y + Math.sin(elapsed * 2.4) * 0.06 * k;
    diceViewRoot.position.z = DICE_CENTER_POS.z;
  }

  void (async () => {
    try {
      const g = await loadGltf(diceUrl);
      if (disposed) return;
      enableShadows(g, true, true);
      const box = new THREE.Box3().setFromObject(g);
      const sz = new THREE.Vector3();
      box.getSize(sz);
      const sc = 0.95 / Math.max(sz.x, sz.y, sz.z, 0.001);
      g.scale.setScalar(sc);
      const b2 = new THREE.Box3().setFromObject(g);
      g.position.x -= (b2.min.x + b2.max.x) / 2;
      g.position.y -= b2.min.y;
      g.position.z -= (b2.min.z + b2.max.z) / 2;
      diceModel = g;
      diceViewRoot.add(g);
      if (dicePendingFace !== null) {
        applyDiceFaceInstant(dicePendingFace);
        dicePendingFace = null;
        diceMode = 'idle';
      }

      const w = g.clone(true);
      cloneMeshMaterialsUnique(w);
      enableShadows(w, true, true);
      w.scale.copy(g.scale);
      w.position.copy(g.position);
      w.quaternion.identity();
      worldDiceModel = w;
      worldDiceGroup.add(w);
      worldDiceGroup.scale.setScalar(1.45);
      // setFromObject applies the world transform, so wsz is already scaled by
      // the parent group — do NOT multiply by group.scale again (prior bug made
      // the die hover ~2x its actual height above the sand).
      const wb = new THREE.Box3().setFromObject(w);
      const wsz = new THREE.Vector3();
      wb.getSize(wsz);
      worldDiceLandY = 0.04 + wsz.y * 0.5 + 0.03;
      worldDiceGroup.position.set(0, worldDiceLandY, 0);
      worldDiceGroup.visible = false;
      // Guarantee the group renders even if a parent bounds check tries to cull it.
      worldDiceGroup.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.frustumCulled = false;
      });
      worldDiceReady = true;
      console.log('[IslandDice] ready', {
        worldDiceReady,
        landY: worldDiceLandY,
        height: wsz.y,
      });
    } catch (e) {
      console.warn('[Island] dice model failed', e);
    }
  })();

  const zenithSky = new THREE.Color(0x5bb8ff);

  const amb = new THREE.AmbientLight(0xfff4ea, 0.52);
  scene.add(amb);

  const hemi = new THREE.HemisphereLight(zenithSky.getHex(), 0xedd4a8, 0.68);
  hemi.position.set(0, 40, 0);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe8cc, 1.48);
  sun.position.set(-22, 15, 13);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.bias = -0.00012;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0xb8dcff, 0.46);
  rim.position.set(18, 6, -22);
  scene.add(rim);

  const sunDir = sun.position.clone().normalize();

  const skyDome = new ParadiseSkydome({
    radius: 450000,
    horizonColor: new THREE.Color(0xff7a3d),
    midColor: new THREE.Color(0xe8a0c8),
    zenithColor: new THREE.Color(0x47a8f2),
  });
  scene.add(skyDome);

  const texLoader = new THREE.TextureLoader();
  const woodAlbedo = texLoader.load(woodAlbedoUrl, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  });
  const waterNormals = texLoader.load(waterNormalsUrl, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  });

  const grainBump = createGrainBumpTexture();

  const LAGOON_R = BOARD_R - 0.35;
  const ISLAND_RADIUS = 12.6;

  const sandMat = new THREE.MeshStandardMaterial({
    roughness: 0.94,
    metalness: 0,
    color: new THREE.Color(0xf0d4a5),
    bumpMap: grainBump,
    bumpScale: 0.092,
  });

  const oceanWater = new ParadiseWater(new THREE.PlaneGeometry(220, 220), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals,
    sunDirection: sunDir.clone(),
    sunColor: 0xffe8c8,
    waterColor: 0x0c7aa0,
    distortionScale: 4.0,
    fog: false,
    clipBias: 0.0005,
    reflectanceScale: 0.74,
    reflectionSampleWeight: 0.5,
    scatterBoost: 1.36,
  });
  oceanWater.rotation.x = -Math.PI / 2;
  oceanWater.position.y = -0.22;
  oceanWater.renderOrder = 0;
  scene.add(oceanWater);

  const islandSand = new THREE.Mesh(new THREE.CircleGeometry(ISLAND_RADIUS, 128), sandMat);
  islandSand.rotation.x = -Math.PI / 2;
  islandSand.position.y = 0.04;
  islandSand.receiveShadow = true;
  islandSand.renderOrder = 1;
  scene.add(islandSand);

  const lagoonWater = new ParadiseWater(new THREE.CircleGeometry(LAGOON_R, 96), {
    textureWidth: 256,
    textureHeight: 256,
    waterNormals,
    sunDirection: sunDir.clone(),
    sunColor: 0xfff0d8,
    waterColor: 0x4ae8e0,
    distortionScale: 1.68,
    fog: false,
    clipBias: 0.0005,
    alpha: 0.88,
    reflectanceScale: 0.58,
    reflectionSampleWeight: 0.42,
    scatterBoost: 1.62,
  });
  lagoonWater.rotation.x = -Math.PI / 2;
  lagoonWater.position.y = 0.07;
  lagoonWater.receiveShadow = false;
  lagoonWater.renderOrder = 3;
  lagoonWater.material.depthWrite = false;
  lagoonWater.material.transparent = true;
  lagoonWater.material.polygonOffset = true;
  lagoonWater.material.polygonOffsetFactor = 1;
  lagoonWater.material.polygonOffsetUnits = 1;
  scene.add(lagoonWater);

  const lagoonFoam = new THREE.Mesh(
    new THREE.RingGeometry(LAGOON_R - 0.22, LAGOON_R + 0.18, 96),
    new THREE.MeshStandardMaterial({
      color: 0xfff6e8,
      roughness: 0.88,
      metalness: 0,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  lagoonFoam.rotation.x = -Math.PI / 2;
  lagoonFoam.position.y = 0.078;
  lagoonFoam.receiveShadow = false;
  lagoonFoam.renderOrder = 4;
  scene.add(lagoonFoam);

  const shoreFoamMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const shoreFoam = new THREE.Mesh(
    new THREE.RingGeometry(ISLAND_RADIUS - 0.42, ISLAND_RADIUS + 0.08, 128),
    shoreFoamMat,
  );
  shoreFoam.rotation.x = -Math.PI / 2;
  shoreFoam.position.y = 0.075;
  shoreFoam.receiveShadow = true;
  shoreFoam.renderOrder = 4;
  scene.add(shoreFoam);

  const woodMat = new THREE.MeshStandardMaterial({
    map: woodAlbedo,
    roughness: 0.62,
    metalness: 0.04,
    color: new THREE.Color(0xffffff),
  });
  woodMat.map!.repeat.set(1.2, 1.2);

  const tileMeshes: THREE.Mesh[] = [];
  const tileMats: THREE.MeshStandardMaterial[] = [];
  const tau = Math.PI * 2;

  for (let i = 0; i < NUM_SQUARES; i++) {
    const a = (i / NUM_SQUARES) * tau - Math.PI / 2 + tau / NUM_SQUARES / 2;
    const x = Math.cos(a) * BOARD_R;
    const z = Math.sin(a) * BOARD_R;
    const mat = woodMat.clone();
    mat.map = woodAlbedo.clone();
    mat.map!.repeat.set(1.15 + (i % 3) * 0.06, 1.15);
    mat.map!.offset.set((i % 4) * 0.1, (i % 2) * 0.05);
    mat.emissive = new THREE.Color(0x000000);
    mat.emissiveIntensity = 0;
    tileMats.push(mat);
    const geo = new THREE.BoxGeometry(TILE_LEN, 0.16, TILE_WID);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, TILE_Y, z);
    mesh.lookAt(0, TILE_Y, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    tileMeshes.push(mesh);
  }

  const rope = new THREE.Mesh(
    new THREE.TorusGeometry(BOARD_R + 0.55, 0.06, 10, 96),
    new THREE.MeshStandardMaterial({ color: 0x6b4420, roughness: 0.75 }),
  );
  rope.rotation.x = Math.PI / 2;
  rope.position.y = 0.11;
  rope.castShadow = true;
  scene.add(rope);

  const shellGeo = new THREE.SphereGeometry(0.07, 10, 8);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xf5ead8, roughness: 0.55 });
  const shells = new THREE.InstancedMesh(shellGeo, shellMat, 48);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  for (let i = 0; i < 48; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = BOARD_R + 2.1 + Math.random() * 2.8;
    p.set(Math.cos(ang) * rad, 0.03 + Math.random() * 0.02, Math.sin(ang) * rad);
    q.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
    s.setScalar(0.85 + Math.random() * 0.45);
    m.compose(p, q, s);
    shells.setMatrixAt(i, m);
  }
  shells.instanceMatrix.needsUpdate = true;
  shells.castShadow = true;
  shells.receiveShadow = true;
  scene.add(shells);

  const decorGroup = new THREE.Group();
  scene.add(decorGroup);

  const bananaGroup = new THREE.Group();
  scene.add(bananaGroup);
  let bananaMixer: THREE.AnimationMixer | null = null;
  let bananaTravel: { startI: number; roll: number; hopIndex: number; t: number } | null = null;

  const cloudGroup = new THREE.Group();
  cloudGroup.position.set(0, 32, 0);
  scene.add(cloudGroup);

  const sunDiscGroup = new THREE.Group();
  scene.add(sunDiscGroup);
  let sunDiscRoot: THREE.Group | null = null;
  /** World distance for sun billboard; direction blends toward horizon so the disc sits lower. */
  const SUN_DISC_DISTANCE = 208;
  const sunDiscDirScratch = new THREE.Vector3();
  const sunDiscHorizScratch = new THREE.Vector3();

  void (async () => {
    try {
      const queen = await loadGltf(queenPalmUrl);
      if (disposed) return;
      enableShadows(queen, true, false);
      const qb = new THREE.Box3().setFromObject(queen);
      const qsize = new THREE.Vector3();
      qb.getSize(qsize);
      const qn = 4.2 / Math.max(qsize.x, qsize.y, qsize.z, 0.001);
      queen.scale.setScalar(qn);
      const nQueen = 11;
      for (let i = 0; i < nQueen; i++) {
        const g = queen.clone();
        const ang = (i / nQueen) * tau + 0.2;
        const rad = BOARD_R + 3.2 + (i % 2) * 0.35;
        g.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
        g.rotation.y = ang + Math.PI + (Math.random() - 0.5) * 0.4;
        g.scale.multiplyScalar(0.92 + Math.random() * 0.2);
        decorGroup.add(g);
      }

      const palmPack = await loadGltf(palmTreesUrl);
      if (disposed) return;
      enableShadows(palmPack, true, false);
      for (let k = 0; k < 4; k++) {
        const g = palmPack.clone();
        const ang = k * (tau / 4) + 0.55;
        const rad = BOARD_R + 2.1;
        g.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
        g.rotation.y = ang + Math.PI;
        g.scale.setScalar(0.018 + k * 0.002);
        decorGroup.add(g);
      }

      const rocks = await loadGltf(rocksUrl);
      if (disposed) return;
      enableShadows(rocks, true, true);
      rocks.position.set(BOARD_R + 1.1, 0, -1.2);
      rocks.scale.setScalar(0.022);
      decorGroup.add(rocks);

      const cloudSrc = await loadGltf(cloudUrl);
      if (disposed) return;
      setCloudMaterialsDoubleSided(cloudSrc);
      lightenCloudMaterials(cloudSrc);
      const cb = new THREE.Box3().setFromObject(cloudSrc);
      const csz = new THREE.Vector3();
      cb.getSize(csz);
      const cn = 28 / Math.max(csz.x, csz.y, csz.z, 0.001);
      cloudSrc.scale.setScalar(cn);
      const nClouds = 24;
      for (let c = 0; c < nClouds; c++) {
        const g = cloudSrc.clone();
        const layer = c % 6;
        const ang = (c / nClouds) * tau + c * 0.55;
        const rad = 26 + layer * 7.5 + (c % 3) * 5;
        const y = layer * 2.8 - 9 + (c % 4) * 2.2;
        g.position.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
        g.rotation.y = ang + 1.05 + (c % 5) * 0.35;
        g.rotation.z = (c % 3) * 0.08;
        g.scale.multiplyScalar(0.62 + (c % 4) * 0.14 + (layer % 2) * 0.1);
        cloudGroup.add(g);
      }

    } catch (e) {
      console.warn('[Island] optional models failed', e);
    }
  })();

  void (async () => {
    try {
      const sunSrc = await loadGltf(sunUrl);
      if (disposed) return;
      enableShadows(sunSrc, false, false);
      boostSunDiscMaterials(sunSrc);
      const sb = new THREE.Box3().setFromObject(sunSrc);
      const ssz = new THREE.Vector3();
      sb.getSize(ssz);
      const target = 32;
      const sn = target / Math.max(ssz.x, ssz.y, ssz.z, 0.001);
      sunSrc.scale.setScalar(sn);
      const sb2 = new THREE.Box3().setFromObject(sunSrc);
      const ctr = new THREE.Vector3();
      sb2.getCenter(ctr);
      sunSrc.position.sub(ctr);
      sunDiscRoot = sunSrc;
      sunDiscGroup.add(sunSrc);
    } catch (se) {
      console.warn('[Island] sun disc model failed', se);
    }
  })();

  let playerIndex = 0;
  function angleForSquare(i: number): number {
    return (i / NUM_SQUARES) * tau - Math.PI / 2 + tau / NUM_SQUARES / 2;
  }
  function placeBananaOnSquare() {
    if (bananaGroup.children.length === 0) return;
    if (bananaTravel) return;
    const a = angleForSquare(playerIndex);
    const x = Math.cos(a) * BOARD_R;
    const z = Math.sin(a) * BOARD_R;
    bananaGroup.position.x = x;
    bananaGroup.position.z = z;
    bananaGroup.lookAt(0, TILE_Y, 0);
  }
  function highlightSquare() {
    for (let i = 0; i < NUM_SQUARES; i++) {
      const on = i === playerIndex;
      const mat = tileMats[i];
      if (!mat) continue;
      mat.emissive.set(on ? 0x22ffcc : 0x000000);
      mat.emissiveIntensity = on ? 0.42 : 0;
    }
    placeBananaOnSquare();
  }
  highlightSquare();

  function worldDiceBeginRoll(roll: number) {
    if (!worldDiceModel || !worldDiceReady) return;
    worldDiceRollValue = roll;

    const lagoonR = BOARD_R - 0.35;
    let sx: number;
    let sz: number;
    if (bananaGroup.children.length > 0) {
      sx = bananaGroup.position.x;
      sz = bananaGroup.position.z;
      // Start at banana's "hand" height — well above his body so the toss is
      // clearly coming FROM him, not spawning on top of him.
      worldDiceStartY = Math.max(TILE_Y + 0.95, bananaGroup.position.y + 0.85);
    } else {
      const a = angleForSquare(playerIndex);
      sx = Math.cos(a) * BOARD_R;
      sz = Math.sin(a) * BOARD_R;
      worldDiceStartY = TILE_Y + 1.0;
    }

    const bx = sx;
    const bz = sz;

    // Aim into the lagoon, offset from dead-center so consecutive rolls don't
    // stack in the exact same spot. toward∈[0.55,0.8] maps to ~20–45% of the way
    // from banana to origin.
    const toward = 0.55 + Math.random() * 0.25;
    let ex = bx * (1 - toward);
    let ez = bz * (1 - toward);
    const jAng = Math.random() * Math.PI * 2;
    const jR = 0.4 + Math.random() * 0.6;
    ex += Math.cos(jAng) * jR;
    ez += Math.sin(jAng) * jR;

    // Correct clamp: the die must land INSIDE the lagoon (radius < lagoonR − margin)
    // and not in dead center. Previous code had minR > maxR which silently snapped
    // every throw to a 0.25-unit radius band right next to the banana's feet.
    const minR = 0.5;
    const maxR = lagoonR - 0.55;
    const len = Math.hypot(ex, ez);
    if (len > 1e-5) {
      if (len < minR) {
        const s = minR / len;
        ex *= s;
        ez *= s;
      } else if (len > maxR) {
        const s = maxR / len;
        ex *= s;
        ez *= s;
      }
    }

    const tdx = ex - bx;
    const tdz = ez - bz;
    const tdLen = Math.hypot(tdx, tdz);
    const windBack = 0.55 + Math.random() * 0.25;
    if (tdLen > 1e-4) {
      sx = bx - (tdx / tdLen) * windBack;
      sz = bz - (tdz / tdLen) * windBack;
    }

    const dx0 = ex - sx;
    const dz0 = ez - sz;
    let ex2 = sx + dx0 * WORLD_DICE_THROW_DIST_MUL;
    let ez2 = sz + dz0 * WORLD_DICE_THROW_DIST_MUL;
    const r2 = Math.hypot(ex2, ez2);
    if (r2 > 1e-5) {
      if (r2 < minR) {
        const s = minR / r2;
        ex2 *= s;
        ez2 *= s;
      } else if (r2 > maxR) {
        const s = maxR / r2;
        ex2 *= s;
        ez2 *= s;
      }
    }

    worldDiceStartX = sx;
    worldDiceStartZ = sz;
    worldDiceEndX = ex2;
    worldDiceEndZ = ez2;
    const dist = Math.hypot(ex2 - sx, ez2 - sz);
    // Taller arc for a satisfying board-game toss silhouette.
    worldDiceArcH = 0.9 + dist * 0.28;

    // Randomize the spin axes per-roll so no two tumbles look identical.
    const sign = () => (Math.random() < 0.5 ? -1 : 1);
    worldSpinVX = sign() * (9 + Math.random() * 7);
    worldSpinVY = sign() * (11 + Math.random() * 9);
    worldSpinVZ = sign() * (7 + Math.random() * 6);

    worldDiceModel.rotation.set(0, 0, 0);
    worldDiceModel.quaternion.identity();
    worldDiceGroup.position.set(sx, worldDiceStartY, sz);
    worldDiceTumbleT0 = clock.elapsedTime;
    worldDiceMode = 'tumble';
    worldDiceGroup.visible = true;
    console.log('[IslandDice] throw', {
      roll,
      start: [sx.toFixed(2), worldDiceStartY.toFixed(2), sz.toFixed(2)],
      end: [ex2.toFixed(2), worldDiceLandY.toFixed(2), ez2.toFixed(2)],
      arcH: worldDiceArcH.toFixed(2),
      dist: dist.toFixed(2),
    });
  }

  function worldDiceUpdate(dt: number, elapsed: number) {
    if (!worldDiceModel || worldDiceMode === 'idle') return;
    const m = worldDiceModel;
    if (worldDiceMode === 'tumble') {
      const u = Math.min(1, (elapsed - worldDiceTumbleT0) / WORLD_DICE_TUMBLE_SEC);
      if (u < 0.02) {
        console.log('[IslandDice] tumble start', {
          pos: [
            worldDiceGroup.position.x.toFixed(2),
            worldDiceGroup.position.y.toFixed(2),
            worldDiceGroup.position.z.toFixed(2),
          ],
          visible: worldDiceGroup.visible,
        });
      }
      const k = easeInOutCubic(u);
      worldDiceGroup.position.x = THREE.MathUtils.lerp(worldDiceStartX, worldDiceEndX, k);
      worldDiceGroup.position.z = THREE.MathUtils.lerp(worldDiceStartZ, worldDiceEndZ, k);
      const yBase = THREE.MathUtils.lerp(worldDiceStartY, worldDiceLandY, k);
      worldDiceGroup.position.y = yBase + worldDiceArcH * 4 * k * (1 - k);
      // Linear angular damping — starts full speed, eases out as the die nears the ground.
      const spinDamp = 1 - u * 0.55;
      m.rotation.x += dt * worldSpinVX * spinDamp;
      m.rotation.y += dt * worldSpinVY * spinDamp;
      m.rotation.z += dt * worldSpinVZ * spinDamp;
      if (u >= 1) {
        worldDiceGroup.position.set(worldDiceEndX, worldDiceLandY, worldDiceEndZ);
        worldDiceMode = 'snap';
        worldDiceQA.copy(m.quaternion);
        worldDiceQB.copy(worldTargetQuatForRoll(worldDiceRollValue));
        worldDiceSnapT0 = elapsed;
      }
    } else if (worldDiceMode === 'snap') {
      const u = Math.min(1, (elapsed - worldDiceSnapT0) / WORLD_DICE_SNAP_SEC);
      const k = easeOutCubic(u);
      m.quaternion.copy(worldDiceQA).slerp(worldDiceQB, k);
      if (u >= 1) {
        worldDiceMode = 'dwell';
        worldDiceDwellT0 = elapsed;
      }
    } else if (worldDiceMode === 'dwell') {
      if (elapsed - worldDiceDwellT0 >= WORLD_DICE_DWELL_SEC) {
        worldDiceMode = 'idle';
        worldDiceGroup.visible = false;
        console.log('[IslandDice] hide', { elapsed: elapsed.toFixed(2) });
      }
    }
  }

  void (async () => {
    try {
      const { scene: bananaSrc, animations: bananaAnims } = await loadGltfWithAnimations(
        bananaUrl,
      );
      if (disposed) return;
      enableShadows(bananaSrc, true, false);
      const bananaBox = new THREE.Box3().setFromObject(bananaSrc);
      const bananaSize = new THREE.Vector3();
      bananaBox.getSize(bananaSize);
      const bananaTargetH = 1.55;
      const bananaScale = bananaTargetH / Math.max(bananaSize.y, 0.001);
      bananaSrc.scale.setScalar(bananaScale);
      const bananaBox2 = new THREE.Box3().setFromObject(bananaSrc);
      const bananaCenter = new THREE.Vector3();
      bananaBox2.getCenter(bananaCenter);
      bananaSrc.position.sub(bananaCenter);
      const bananaBox3 = new THREE.Box3().setFromObject(bananaSrc);
      bananaSrc.position.y -= bananaBox3.min.y;
      bananaGroup.add(bananaSrc);
      if (bananaAnims.length > 0) {
        bananaMixer = new THREE.AnimationMixer(bananaSrc);
        bananaMixer.clipAction(bananaAnims[0]!).play();
      }
      placeBananaOnSquare();
    } catch (be) {
      console.warn('[Island] banana model failed', be);
    }
  })();

  const rollBtn = document.getElementById('roll-btn') as HTMLButtonElement | null;
  const statusEl = document.getElementById('status');
  const diceFace = document.getElementById('dice-face');
  const diceReadout = document.getElementById('dice-readout');
  const positionReadout = document.getElementById('position-readout');
  const diceWrap = document.getElementById('dice-chip-wrap');
  const landing = document.getElementById('landing-overlay');
  const landingText = document.getElementById('landing-text');
  const landingTitle = document.getElementById('landing-title');
  const landingClose = document.getElementById('landing-close');
  const landingDismiss = document.getElementById('landing-dismiss');
  const landingChoices = document.getElementById('landing-choices');
  const choiceBtnA = document.getElementById('landing-choice-a') as HTMLButtonElement | null;
  const choiceBtnB = document.getElementById('landing-choice-b') as HTMLButtonElement | null;
  const segs = Array.from(document.querySelectorAll<HTMLSpanElement>('.progress-seg'));

  function updateHud() {
    positionReadout!.textContent = `Square: ${playerIndex + 1} — ${SQUARE_LABELS[playerIndex]}`;
    segs.forEach((el, i) => {
      el.classList.remove('is-active', 'is-current', 'is-done');
      if (i < playerIndex) el.classList.add('is-done');
      if (i === playerIndex) {
        el.classList.add('is-active');
        el.classList.add('is-current');
      }
    });
    highlightSquare();
  }
  updateHud();

  function closeLanding() {
    landing?.classList.remove('is-open', 'is-choice');
    landing?.setAttribute('aria-hidden', 'true');
    landingChoices?.classList.remove('is-visible');
    activeBeat = null;
  }

  function paintChoiceButton(
    btn: HTMLButtonElement | null,
    choice: IslandScenarioBeat['optionA'] | IslandScenarioBeat['optionB'],
  ) {
    if (!btn) return;
    const labelEl = btn.querySelector<HTMLElement>('[data-role="label"]');
    const outcomeEl = btn.querySelector<HTMLElement>('[data-role="outcome"]');
    if (labelEl) labelEl.textContent = choice.label;
    if (outcomeEl) outcomeEl.textContent = choice.outcome;
    btn.dataset['choiceId'] = choice.id;
  }

  let activeBeat: IslandScenarioBeat | null = null;

  function openLanding(square: number) {
    // Always re-read player snapshot so a Box edit between rolls is
    // reflected on the *next* landing without remounting the game.
    const snap = opts.getPlayerSnapshot?.() ?? null;
    const ratios = snap?.fundingRatioByCategory;
    const payload = getLandingPayload(square, ratios as never);
    if (landingTitle) landingTitle.textContent = SQUARE_LABELS[square] ?? 'Money tip';
    if (payload.kind === 'choice') {
      activeBeat = payload.beat;
      if (landingText) landingText.textContent = payload.beat.setup;
      paintChoiceButton(choiceBtnA, payload.beat.optionA);
      paintChoiceButton(choiceBtnB, payload.beat.optionB);
      landingChoices?.classList.add('is-visible');
      landing?.classList.add('is-choice');
    } else {
      activeBeat = null;
      if (landingText) landingText.textContent = payload.body;
      landingChoices?.classList.remove('is-visible');
      landing?.classList.remove('is-choice');
    }
    landing?.classList.add('is-open');
    landing?.setAttribute('aria-hidden', 'false');
  }

  function onChoiceClick(ev: Event) {
    if (!activeBeat) return;
    const btn = ev.currentTarget as HTMLButtonElement;
    const choiceId = btn.dataset['choiceId'] as IslandScenarioChoiceId | undefined;
    if (!choiceId) return;
    const beatId: IslandScenarioBeatId = activeBeat.id;
    eventBus.emit('island:scenarioChoice', { v: 1, beatId, choiceId });
    closeLanding();
  }

  landingClose?.addEventListener('click', closeLanding);
  landingDismiss?.addEventListener('click', closeLanding);
  choiceBtnA?.addEventListener('click', onChoiceClick);
  choiceBtnB?.addEventListener('click', onChoiceClick);

  let rolling = false;
  // Single-source lap counter — the rule
  // (`totalHops > 0 && totalHops % NUM_SQUARES === 0`) is implemented in
  // `src/core/campaign/lapCounter.ts` and referenced in GAME_DESIGN.md.
  // We increment in exactly ONE place (after the dice settles) so a lap
  // can never fire twice or get lost across re-mounts of the React shell.
  // Seed from persisted `campaign.islandTotalHops` so the in-progress
  // year is preserved across remounts (the React shell mounts/unmounts
  // whenever the player navigates away from the map).
  let totalHops =
    typeof opts.initialTotalHops === 'number' && opts.initialTotalHops > 0
      ? Math.floor(opts.initialTotalHops)
      : 0;
  function finishRollAfterAnimation(roll: number) {
    diceWrap?.classList.remove('dice-rolling');
    diceWrap?.classList.add('dice-roll-pop');
    window.setTimeout(() => diceWrap?.classList.remove('dice-roll-pop'), 320);
    const prevIndex = playerIndex;
    playerIndex = (playerIndex + roll) % NUM_SQUARES;
    if (prevIndex !== playerIndex) {
      bananaTravel = { startI: prevIndex, roll, hopIndex: 0, t: 0 };
    }
    const step = advanceHops(totalHops, roll, NUM_SQUARES);
    totalHops = step.totalHops;
    if (step.lapCompletedThisStep) {
      // Fire once — the React shell forwards to `island:yearComplete`.
      try {
        opts.onLapComplete?.({ totalHops: step.totalHops, laps: step.laps });
      } catch (e) {
        console.error('[IslandRun] onLapComplete handler threw', e);
      }
    }
    statusEl!.textContent = `You rolled ${roll}. You landed on ${SQUARE_LABELS[playerIndex]}.`;
    statusEl?.classList.remove('is-rolling');
    updateHud();
    const moveDelayMs =
      prevIndex !== playerIndex ? roll * BANANA_HOP_SEC * 1000 + LANDING_AFTER_BANANA_MS : 220;
    window.setTimeout(() => {
      if (disposed) return;
      openLanding(playerIndex);
      rolling = false;
      if (rollBtn) rollBtn.disabled = false;
    }, moveDelayMs);
  }

  const onRollClick = () => {
    if (rolling) return;
    if (!diceModel) {
      statusEl!.textContent = 'Loading the dice... try again in a moment.';
      return;
    }
    rolling = true;
    if (rollBtn) rollBtn.disabled = true;
    statusEl?.classList.add('is-rolling');
    diceWrap?.classList.add('dice-rolling');
    const roll = 1 + Math.floor(Math.random() * 6);

    // Banana physically throws the world die (arcs over the lagoon, tumbles,
    // snaps to the rolled face). The HUD "center-pop" mini-die (driven by
    // dicePopTarget) is popped in alongside so both dice animate together.
    if (!worldDiceReady) {
      statusEl!.textContent = 'Loading the dice... try again in a moment.';
      rolling = false;
      if (rollBtn) rollBtn.disabled = false;
      statusEl?.classList.remove('is-rolling');
      diceWrap?.classList.remove('dice-rolling');
      return;
    }
    dicePopTarget = 1;
    diceBeginTumble();
    worldDiceBeginRoll(roll);

    const tumbleMs = WORLD_DICE_TUMBLE_SEC * 1000;
    const settleMs = (WORLD_DICE_SNAP_SEC + WORLD_DICE_DWELL_SEC) * 1000;

    window.setTimeout(() => {
      if (disposed) return;
      diceFace!.textContent = String(roll);
      diceReadout!.textContent = `Last roll: ${roll}`;
      diceSettleToFace(roll);
    }, tumbleMs);

    window.setTimeout(() => {
      if (disposed) return;
      dicePopTarget = 0;
    }, tumbleMs + settleMs);

    window.setTimeout(() => {
      if (disposed) return;
      finishRollAfterAnimation(roll);
    }, tumbleMs + settleMs + DICE_POP_OUT_SEC * 1000);
  };
  rollBtn?.addEventListener('click', onRollClick);

  const qToggle = document.getElementById('quality-toggle') as HTMLInputElement | null;
  function applyQuality(high: boolean) {
    const pr = high ? Math.min(window.devicePixelRatio, 2) : 1;
    renderer.setPixelRatio(pr);
    composer.setPixelRatio(pr);
    sun.shadow.mapSize.setScalar(high ? 2048 : 768);
    decorGroup.visible = high;
    shells.visible = high;
    cloudGroup.visible = high;
    gradePass.enabled = high;
    g['saturation']!.value = high ? 1.14 : 1.06;
    g['warmth']!.value = high ? 0.42 : 0.28;
    g['highlightBloom']!.value = high ? 0.22 : 0.1;
  }
  const onQualityChange = () => applyQuality(!!qToggle?.checked);
  qToggle?.addEventListener('change', onQualityChange);
  applyQuality(!!qToggle?.checked);

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  function tick() {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);
    const dt = clock.getDelta();
    const t = clock.elapsedTime;
    oceanWater.material.uniforms['time']!.value = t;
    lagoonWater.material.uniforms['time']!.value = t * 0.82;
    shoreFoamMat.opacity = 0.32 + Math.sin(t * 1.15) * 0.07;
    diceUpdate(dt, t);
    worldDiceUpdate(dt, t);
    bananaMixer?.update(dt);
    if (bananaGroup.children.length > 0) {
      if (bananaTravel) {
        const bt = bananaTravel;
        bt.t += dt / BANANA_HOP_SEC;
        const k = Math.min(1, easeOutCubic(bt.t));
        const fromI = (bt.startI + bt.hopIndex) % NUM_SQUARES;
        const toI = (bt.startI + bt.hopIndex + 1) % NUM_SQUARES;
        const a0 = angleForSquare(fromI);
        const a1 = angleForSquare(toI);
        let delta = a1 - a0;
        while (delta > Math.PI) delta -= tau;
        while (delta < -Math.PI) delta += tau;
        const ang = a0 + delta * k;
        const hop = Math.sin(k * Math.PI) * 0.48;
        bananaGroup.position.x = Math.cos(ang) * BOARD_R;
        bananaGroup.position.z = Math.sin(ang) * BOARD_R;
        bananaGroup.position.y = TILE_Y + 0.02 + hop + Math.sin(t * 2.15) * 0.022;
        bananaGroup.lookAt(0, TILE_Y, 0);
        if (bt.t >= 1) {
          bt.hopIndex += 1;
          bt.t = 0;
          if (bt.hopIndex >= bt.roll) {
            bananaTravel = null;
            placeBananaOnSquare();
          }
        }
      } else {
        bananaGroup.position.y = TILE_Y + 0.02 + Math.sin(t * 2.15) * 0.042;
      }
    }
    cloudGroup.rotation.y += dt * 0.012;
    if (sunDiscRoot) {
      const towardHorizon = 0.64;
      sunDiscHorizScratch.set(sunDir.x, 0, sunDir.z);
      if (sunDiscHorizScratch.lengthSq() < 1e-8) sunDiscHorizScratch.set(1, 0, 0);
      else sunDiscHorizScratch.normalize();
      sunDiscDirScratch
        .copy(sunDir)
        .multiplyScalar(1 - towardHorizon)
        .addScaledVector(sunDiscHorizScratch, towardHorizon)
        .normalize()
        .multiplyScalar(SUN_DISC_DISTANCE);
      sunDiscGroup.position.copy(sunDiscDirScratch);
      sunDiscGroup.up.set(0, 1, 0);
      sunDiscGroup.lookAt(camera.position);
    }
    controls.update();
    composer.render();
  }
  rafId = requestAnimationFrame(tick);

  if (errEl) errEl.classList.add('hidden');

  return () => {
    disposed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    rollBtn?.removeEventListener('click', onRollClick);
    qToggle?.removeEventListener('change', onQualityChange);
    landingClose?.removeEventListener('click', closeLanding);
    landingDismiss?.removeEventListener('click', closeLanding);
    choiceBtnA?.removeEventListener('click', onChoiceClick);
    choiceBtnB?.removeEventListener('click', onChoiceClick);
    controls.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  };
}
