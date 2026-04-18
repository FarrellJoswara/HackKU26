import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { SQUARE_LABELS, SQUARE_TIPS } from './tips';

const NUM_SQUARES = 12;
const BOARD_R = 6.8;
const TILE_LEN = 2.05;
const TILE_WID = 1.65;
const TILE_Y = 0.1;

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  rootEl.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.minDistance = 6;
  controls.maxDistance = 42;
  controls.target.set(0, 0.2, 0);

  const horizon = new THREE.Color(0xe8f6ff);

  const amb = new THREE.AmbientLight(0xfff4e0, 0.42);
  scene.add(amb);

  const hemi = new THREE.HemisphereLight(horizon.getHex(), 0xf0d9a8, 0.55);
  hemi.position.set(0, 40, 0);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2dd, 1.35);
  sun.position.set(-18, 26, 12);
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

  const rim = new THREE.DirectionalLight(0xb8e8ff, 0.35);
  rim.position.set(16, 8, -20);
  scene.add(rim);

  const sunDir = sun.position.clone().normalize();
  const skySun = sun.position.clone().normalize().multiplyScalar(400000);

  const skyMesh = new Sky();
  skyMesh.scale.setScalar(450000);
  const su = skyMesh.material.uniforms;
  su['turbidity']!.value = 8;
  su['rayleigh']!.value = 2.2;
  su['mieCoefficient']!.value = 0.004;
  su['mieDirectionalG']!.value = 0.85;
  (su['sunPosition']!.value as THREE.Vector3).copy(skySun);
  scene.add(skyMesh);

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
    color: new THREE.Color(0xf2e4b4),
    bumpMap: grainBump,
    bumpScale: 0.092,
  });

  const oceanWater = new Water(new THREE.PlaneGeometry(220, 220), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals,
    sunDirection: sunDir.clone(),
    sunColor: 0xffffff,
    waterColor: 0x052a42,
    distortionScale: 3.75,
    fog: false,
    clipBias: 0.0005,
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

  const lagoonWater = new Water(new THREE.CircleGeometry(LAGOON_R, 96), {
    textureWidth: 256,
    textureHeight: 256,
    waterNormals,
    sunDirection: sunDir.clone(),
    sunColor: 0xffffff,
    waterColor: 0x26c9c4,
    distortionScale: 1.55,
    fog: false,
    clipBias: 0.0005,
    alpha: 0.82,
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
      color: 0xf5fbff,
      roughness: 0.88,
      metalness: 0,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  lagoonFoam.rotation.x = -Math.PI / 2;
  lagoonFoam.position.y = 0.078;
  lagoonFoam.receiveShadow = true;
  lagoonFoam.renderOrder = 4;
  scene.add(lagoonFoam);

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

  const cloudGroup = new THREE.Group();
  cloudGroup.position.set(0, 32, 0);
  scene.add(cloudGroup);

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
      const cb = new THREE.Box3().setFromObject(cloudSrc);
      const csz = new THREE.Vector3();
      cb.getSize(csz);
      const cn = 28 / Math.max(csz.x, csz.y, csz.z, 0.001);
      cloudSrc.scale.setScalar(cn);
      const nClouds = 10;
      for (let c = 0; c < nClouds; c++) {
        const g = cloudSrc.clone();
        const ang = (c / nClouds) * tau + c * 0.7;
        const rad = 35 + (c % 3) * 12;
        g.position.set(Math.cos(ang) * rad, (c % 4) * 4 - 6, Math.sin(ang) * rad);
        g.rotation.y = ang + 1.2;
        g.scale.multiplyScalar(0.75 + (c % 3) * 0.15);
        cloudGroup.add(g);
      }

      try {
        const bananaSrc = await loadGltf(asset('models/banana-guy.glb'));
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
        placeBananaOnSquare();
      } catch (be) {
        console.warn('[Island] banana model failed', be);
      }
    } catch (e) {
      console.warn('[Island] optional models failed', e);
    }
  })();

  let playerIndex = 0;
  function placeBananaOnSquare() {
    if (bananaGroup.children.length === 0) return;
    const a = (playerIndex / NUM_SQUARES) * tau - Math.PI / 2 + tau / NUM_SQUARES / 2;
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
    const roll = 1 + Math.floor(Math.random() * 6);
    window.setTimeout(() => {
      diceFace!.textContent = String(roll);
      diceReadout!.textContent = `Last roll: ${roll}`;
      diceWrap?.classList.remove('dice-rolling');
      diceWrap?.classList.add('dice-roll-pop');
      window.setTimeout(() => diceWrap?.classList.remove('dice-roll-pop'), 320);
      playerIndex = (playerIndex + roll) % NUM_SQUARES;
      statusEl!.textContent = `You rolled ${roll}. Landed on ${SQUARE_LABELS[playerIndex]}.`;
      statusEl?.classList.remove('is-rolling');
      updateHud();
      openLanding(playerIndex);
      rolling = false;
      rollBtn.disabled = false;
    }, 520);
  });

  const qToggle = document.getElementById('quality-toggle') as HTMLInputElement | null;
  function applyQuality(high: boolean) {
    renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 2) : 1);
    sun.shadow.mapSize.setScalar(high ? 2048 : 768);
    decorGroup.visible = high;
    shells.visible = high;
    cloudGroup.visible = high;
  }
  qToggle?.addEventListener('change', () => applyQuality(!!qToggle.checked));
  applyQuality(!!qToggle?.checked);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function tick() {
    requestAnimationFrame(tick);
    const dt = clock.getDelta();
    const t = clock.elapsedTime;
    oceanWater.material.uniforms['time']!.value = t;
    lagoonWater.material.uniforms['time']!.value = t * 0.82;
    if (bananaGroup.children.length > 0) {
      bananaGroup.position.y = TILE_Y + 0.02 + Math.sin(t * 2.15) * 0.042;
    }
    cloudGroup.rotation.y += dt * 0.012;
    controls.update();
    renderer.render(scene, camera);
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
