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
import { SQUARE_LABELS, SQUARE_TIPS } from './tips';

const NUM_SQUARES = 12;
const BOARD_R = 6.8;
const TILE_LEN = 2.05;
const TILE_WID = 1.65;
const TILE_Y = 0.1;

/** Duration of one banana hop between adjacent squares (seconds). */
const BANANA_HOP_SEC = 0.42;
/** Extra pause after the last hop before the tip dialog opens (ms). */
const LANDING_AFTER_BANANA_MS = 480;
/** HUD dice tumble before showing result (ms). */
const DICE_TUMBLE_MS = 520;
const DICE_SNAP_SEC = 0.38;

/**
 * Euler (XYZ) so each die value faces the mini-camera; tweak if this GLB’s pips don’t match.
 * Camera looks toward origin from (+x,+y,+z).
 */
const DICE_VALUE_EULER: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [Math.PI / 2, 0, 0],
  3: [0, Math.PI / 2, 0],
  4: [0, -Math.PI / 2, 0],
  5: [-Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0],
};

const asset = (path: string) => {
  const b = import.meta.env.BASE_URL;
  const p = path.startsWith('/') ? path.slice(1) : path;
  return b.endsWith('/') ? b + p : `${b}/${p}`;
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

function main() {
  const rootEl = document.getElementById('canvas-root');
  const errEl = document.getElementById('webgl-error');
  if (!rootEl) return;

  const scene = new THREE.Scene();
  scene.fog = null;
  scene.background = null;

  const clock = new THREE.Clock();

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500000);
  camera.position.set(0, 12.5, 15.2);

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
  diceViewRoot.position.set(5.5, -3.7, -14.2);
  diceViewRoot.scale.setScalar(0.42);
  let diceModel: THREE.Group | null = null;
  let dicePendingFace: number | null = null;
  let diceMode: 'idle' | 'tumble' | 'snap' = 'idle';
  let diceSnapT0 = 0;
  const diceQA = new THREE.Quaternion();
  const diceQB = new THREE.Quaternion();
  const diceEu = new THREE.Euler(0, 0, 0, 'XYZ');

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
    if (!diceModel) return;
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

  void (async () => {
    try {
      const g = await loadGltf(asset('models/dice.glb'));
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
  const woodAlbedo = texLoader.load(asset('textures/wood/albedo.jpg'), (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  });
  const waterNormals = texLoader.load(asset('textures/waternormals.jpg'), (t) => {
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
  lagoonWater.receiveShadow = true;
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
  lagoonFoam.receiveShadow = true;
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
      const queen = await loadGltf(asset('models/queen-palm.glb'));
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

      const palmUrl = asset(`assets/models/nature-pack/${encodeURIComponent('Palm Trees.glb')}`);
      const palmPack = await loadGltf(palmUrl);
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

      const rockUrl = asset(`assets/models/nature-pack/${encodeURIComponent('Rocks.glb')}`);
      const rocks = await loadGltf(rockUrl);
      enableShadows(rocks, true, true);
      rocks.position.set(BOARD_R + 1.1, 0, -1.2);
      rocks.scale.setScalar(0.022);
      decorGroup.add(rocks);

      const cloudSrc = await loadGltf(asset('models/cloud.glb'));
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
      const sunSrc = await loadGltf(asset('models/sun.glb'));
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

  void (async () => {
    try {
      const { scene: bananaSrc, animations: bananaAnims } = await loadGltfWithAnimations(
        asset('models/banana-guy.glb'),
      );
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
  const landingSub = document.getElementById('landing-subtitle');
  const landingClose = document.getElementById('landing-close');
  const landingDismiss = document.getElementById('landing-dismiss');
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
    landing?.classList.remove('is-open');
    landing?.setAttribute('aria-hidden', 'true');
  }

  function openLanding(square: number) {
    if (landingText && landingSub) {
      landingSub.textContent = SQUARE_LABELS[square] ?? 'Finance tip';
      landingText.textContent = SQUARE_TIPS[square] ?? '';
    }
    landing?.classList.add('is-open');
    landing?.setAttribute('aria-hidden', 'false');
  }

  landingClose?.addEventListener('click', closeLanding);
  landingDismiss?.addEventListener('click', closeLanding);

  let rolling = false;
  rollBtn?.addEventListener('click', () => {
    if (rolling) return;
    rolling = true;
    rollBtn.disabled = true;
    statusEl?.classList.add('is-rolling');
    diceWrap?.classList.add('dice-rolling');
    diceBeginTumble();
    window.setTimeout(() => {
      const roll = 1 + Math.floor(Math.random() * 6);
      diceFace!.textContent = String(roll);
      diceReadout!.textContent = `Last roll: ${roll}`;
      diceSettleToFace(roll);
      diceWrap?.classList.remove('dice-rolling');
      diceWrap?.classList.add('dice-roll-pop');
      window.setTimeout(() => diceWrap?.classList.remove('dice-roll-pop'), 320);
      const prevIndex = playerIndex;
      playerIndex = (playerIndex + roll) % NUM_SQUARES;
      if (prevIndex !== playerIndex) {
        bananaTravel = { startI: prevIndex, roll, hopIndex: 0, t: 0 };
      }
      statusEl!.textContent = `You rolled ${roll}. Landed on ${SQUARE_LABELS[playerIndex]}.`;
      statusEl?.classList.remove('is-rolling');
      updateHud();
      const moveDelayMs =
        prevIndex !== playerIndex ? roll * BANANA_HOP_SEC * 1000 + LANDING_AFTER_BANANA_MS : 220;
      window.setTimeout(() => {
        openLanding(playerIndex);
        rolling = false;
        rollBtn.disabled = false;
      }, moveDelayMs);
    }, DICE_TUMBLE_MS);
  });

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
  qToggle?.addEventListener('change', () => applyQuality(!!qToggle.checked));
  applyQuality(!!qToggle?.checked);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  function tick() {
    requestAnimationFrame(tick);
    const dt = clock.getDelta();
    const t = clock.elapsedTime;
    oceanWater.material.uniforms['time']!.value = t;
    lagoonWater.material.uniforms['time']!.value = t * 0.82;
    shoreFoamMat.opacity = 0.32 + Math.sin(t * 1.15) * 0.07;
    diceUpdate(dt, t);
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
  tick();

  if (errEl) errEl.classList.add('hidden');
}

try {
  main();
} catch (e) {
  console.error(e);
  document.getElementById('webgl-error')?.classList.remove('hidden');
}
