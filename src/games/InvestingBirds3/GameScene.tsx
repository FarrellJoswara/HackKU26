import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Vector2,
} from 'three';
import type { Body } from 'planck';
import {
  CATEGORY_META,
  COLORS,
  GAME_TUNING,
  MATERIAL_META,
  SLING,
} from './config';
import { OrthoCameraSetup } from './OrthoCamera';
import type { RoundSimulation } from './roundSimulation';
import {
  applyCryptoBlast,
  applyEtfRipple,
  applyStocksBoost,
  resetBird,
} from './roundSimulation';
import { sampleTrajectoryDots, velocityFromDrag } from './trajectory';
import {
  buildBirdTexture,
  buildPigTexture,
  buildWoodTexture,
  loadBeachTexture,
} from './visualTextures';
import type { BodyUserData, LevelType, UiAction } from './types';
import type { Dispatch } from 'react';

interface BlockBodyMeta {
  offstageScored: boolean;
}

function readBlockMeta(b: Body): BlockBodyMeta {
  const u = b.getUserData();
  if (u && typeof u === 'object' && 'offstageScored' in u) {
    return u as BlockBodyMeta;
  }
  return { offstageScored: false };
}

function readBlockLevelType(b: Body, fallback: LevelType): LevelType {
  const fx = b.getFixtureList();
  const ud = fx?.getUserData() as BodyUserData | null;
  return ud?.levelType ?? fallback;
}

export interface AimDragRef {
  active: boolean;
  wx: number;
  wy: number;
}

interface GameSceneProps {
  simKey: number;
  simRef: React.MutableRefObject<RoundSimulation | null>;
  phaseRef: React.MutableRefObject<string>;
  dispatch: Dispatch<UiAction>;
  birdsRemainingRef: React.MutableRefObject<number>;
  launchedRef: React.MutableRefObject<boolean>;
  abilityUsedRef: React.MutableRefObject<boolean>;
  pigEventFiredRef: React.MutableRefObject<boolean>;
  aimDragRef: React.MutableRefObject<AimDragRef>;
  towerWorldRef: React.MutableRefObject<{ x: number; y: number } | null>;
}

export function GameScene({
  simKey,
  simRef,
  phaseRef,
  dispatch,
  birdsRemainingRef,
  launchedRef,
  abilityUsedRef,
  pigEventFiredRef,
  aimDragRef,
  towerWorldRef,
}: GameSceneProps) {
  const acc = useRef(0);
  const settleAcc = useRef(0);
  const lastHp = useRef(-1);
  const blocksRootRef = useRef<Group>(null);

  useEffect(() => {
    lastHp.current = -1;
    settleAcc.current = 0;
    acc.current = 0;
  }, [simKey]);

  const beachTexture = useMemo(() => loadBeachTexture(), []);
  const woodTexture = useMemo(() => buildWoodTexture(), []);
  const pigTexture = useMemo(() => buildPigTexture(), []);
  const birdIdle = useMemo(
    () =>
      ({
        stocks: buildBirdTexture('stocks', 'idle'),
        etfs: buildBirdTexture('etfs', 'idle'),
        bonds: buildBirdTexture('bonds', 'idle'),
        crypto: buildBirdTexture('crypto', 'idle'),
      }) as Record<LevelType, ReturnType<typeof buildBirdTexture>>,
    [],
  );
  const birdPulled = useMemo(
    () =>
      ({
        stocks: buildBirdTexture('stocks', 'pulled'),
        etfs: buildBirdTexture('etfs', 'pulled'),
        bonds: buildBirdTexture('bonds', 'pulled'),
        crypto: buildBirdTexture('crypto', 'pulled'),
      }) as Record<LevelType, ReturnType<typeof buildBirdTexture>>,
    [],
  );

  const dotsGeom = useMemo(() => new CircleGeometry(0.08, 10), []);
  const dotsMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLORS.trajectoryDot,
        transparent: true,
        opacity: 0.9,
      }),
    [],
  );

  const slingAnchor = useMemo(
    () => new Vector2(SLING.launchAnchor.x, SLING.launchAnchor.y),
    [],
  );
  const leftPost = useMemo(
    () =>
      new Vector2(
        slingAnchor.x - SLING.postOffset.x,
        slingAnchor.y + SLING.postOffset.y + SLING.postSize.h / 2,
      ),
    [slingAnchor],
  );
  const rightPost = useMemo(
    () =>
      new Vector2(
        slingAnchor.x + SLING.postOffset.x,
        slingAnchor.y + SLING.postOffset.y + SLING.postSize.h / 2,
      ),
    [slingAnchor],
  );

  const bandPositions = useMemo(() => new Float32Array(24), []);
  const bandGeometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(bandPositions, 3));
    g.setDrawRange(0, 0);
    return g;
  }, [bandPositions]);

  const birdMeshRef = useRef<Mesh>(null);
  const pouchRef = useRef<Mesh>(null);
  const dotsMeshRef = useRef<InstancedMesh>(null);
  const blockPoolRef = useRef<Group[]>([]);
  const dummy = useMemo(() => new Object3D(), []);

  const bw = GAME_TUNING.plankHalfW * 2;
  const bh = GAME_TUNING.plankHalfH * 2;

  useFrame((_, dt) => {
    const sim = simRef.current;
    const blocksRoot = blocksRootRef.current;
    if (!sim || !blocksRoot || phaseRef.current !== 'playing') {
      towerWorldRef.current = null;
      return;
    }

    const world = sim.world;
    const sub = GAME_TUNING.fixedStep;
    acc.current += dt;
    while (acc.current >= sub) {
      world.step(sub);
      acc.current -= sub;
    }

    const bird = sim.bird;
    const pig = sim.pig;
    const { pigState, multiplier, variant, blocks, slingAnchor: sAnchorPl } = sim;
    const sAnchor = new Vector2(sAnchorPl.x, sAnchorPl.y);

    if (pigState.alive && lastHp.current < 0) {
      lastHp.current = pigState.hp;
    }
    if (pigState.alive && pigState.hp < lastHp.current) {
      const delta = lastHp.current - pigState.hp;
      lastHp.current = pigState.hp;
      const pts = Math.round(delta * GAME_TUNING.scorePerPigHit * multiplier);
      if (pts > 0) {
        dispatch({
          type: 'ADD_SCORE',
          payload: { amount: pts, levelType: variant },
        });
      }
    }

    if (pigState.alive && pig.getPosition().y < GAME_TUNING.killY) {
      pigState.alive = false;
    }

    if (!pigState.alive && !pigEventFiredRef.current) {
      pigEventFiredRef.current = true;
      const bonus = Math.round(GAME_TUNING.scorePerPigClear * multiplier);
      dispatch({
        type: 'ADD_SCORE',
        payload: { amount: bonus, levelType: variant },
      });
      dispatch({ type: 'PIG_DEFEATED' });
      try {
        world.destroyBody(pig);
      } catch {
        /* noop */
      }
    }

    for (const b of blocks) {
      const meta = readBlockMeta(b);
      if (meta.offstageScored) continue;
      if (b.getPosition().y < GAME_TUNING.killY) {
        meta.offstageScored = true;
        const lt = readBlockLevelType(b, variant);
        const pts = Math.round(GAME_TUNING.scorePerBlockOffstage * multiplier);
        dispatch({
          type: 'ADD_SCORE',
          payload: { amount: pts, levelType: lt },
        });
      }
    }

    if (bird.getType() === 'dynamic' && launchedRef.current && pigState.alive) {
      const sp = bird.getLinearVelocity().length();
      if (sp < GAME_TUNING.settleSpeed) {
        settleAcc.current += dt;
      } else {
        settleAcc.current = 0;
      }
      if (settleAcc.current >= GAME_TUNING.settleHoldSec) {
        settleAcc.current = 0;
        launchedRef.current = false;
        abilityUsedRef.current = false;
        const pigAlive = pigState.alive;
        const brAfter = Math.max(0, birdsRemainingRef.current - 1);
        dispatch({ type: 'BIRD_LANDED', payload: { pigAlive } });
        birdsRemainingRef.current = brAfter;
        if (pigAlive && brAfter > 0) {
          resetBird(bird, sAnchorPl);
        }
      }
    }

    const standing = blocks.filter((b) => {
      if (readBlockMeta(b).offstageScored) return false;
      return b.getPosition().y > 0.15;
    });
    if (standing.length > 0) {
      let sx = 0;
      let top = -Infinity;
      for (const b of standing) {
        sx += b.getPosition().x;
        const t = b.getPosition().y + GAME_TUNING.plankHalfH;
        if (t > top) top = t;
      }
      towerWorldRef.current = { x: sx / standing.length, y: top + 1.0 };
    } else {
      towerWorldRef.current = null;
    }

    const bandAttr = bandGeometry.getAttribute('position') as BufferAttribute;
    const setBand = (
      seg: number,
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
    ) => {
      const o = seg * 6;
      bandPositions[o + 0] = ax;
      bandPositions[o + 1] = ay;
      bandPositions[o + 2] = az;
      bandPositions[o + 3] = bx;
      bandPositions[o + 4] = by;
      bandPositions[o + 5] = bz;
    };
    const aim = aimDragRef.current;
    const pullX = sAnchor.x - aim.wx;
    const pullY = sAnchor.y - aim.wy;
    const pullLen = Math.hypot(pullX, pullY);
    const aiming =
      bird.getType() === 'static' &&
      aim.active &&
      pullLen > GAME_TUNING.maxDrag * 0.04;
    let attachX = sAnchor.x;
    let attachY = sAnchor.y;
    if (aiming) {
      const nx = pullX / pullLen;
      const ny = pullY / pullLen;
      const d = Math.min(pullLen, GAME_TUNING.maxDrag) * 0.55;
      attachX = sAnchor.x + nx * d;
      attachY = sAnchor.y + ny * d;
    }
    if (bird.getType() === 'static' && (aiming || pullLen > 0.02)) {
      setBand(0, leftPost.x, leftPost.y, 0.45, attachX, attachY, 0.45);
      setBand(1, rightPost.x, rightPost.y, 0.45, attachX, attachY, 0.45);
      setBand(2, leftPost.x, leftPost.y, 0.65, attachX, attachY, 0.65);
      setBand(3, rightPost.x, rightPost.y, 0.65, attachX, attachY, 0.65);
      bandAttr.needsUpdate = true;
      bandGeometry.setDrawRange(0, 8);
    } else {
      bandGeometry.setDrawRange(0, 0);
    }

    const birdMesh = birdMeshRef.current;
    const pouch = pouchRef.current;
    const lv = variant;
    if (birdMesh) {
      birdMesh.visible = true;
      let bx: number;
      let by: number;
      let ang: number;
      if (bird.getType() === 'dynamic') {
        bx = bird.getPosition().x;
        by = bird.getPosition().y;
        ang = bird.getAngle();
      } else if (aiming) {
        bx = attachX;
        by = attachY;
        ang = 0;
      } else {
        bx = sAnchor.x;
        by = sAnchor.y;
        ang = 0;
      }
      birdMesh.position.set(bx, by, 0.55);
      birdMesh.rotation.z = ang;
      const mat = birdMesh.material as MeshBasicMaterial;
      mat.map = aiming ? birdPulled[lv] : birdIdle[lv];
      mat.needsUpdate = true;
    }
    if (pouch) {
      pouch.visible = aiming;
      if (aiming) pouch.position.set(attachX, attachY, 0.5);
    }

    const dots = dotsMeshRef.current;
    if (dots && aiming) {
      const { vx, vy } = velocityFromDrag(sAnchor.x, sAnchor.y, aim.wx, aim.wy);
      const path = sampleTrajectoryDots(attachX, attachY, vx, vy);
      const n = Math.min(path.length, GAME_TUNING.trajectoryMaxDots);
      dots.count = n;
      for (let i = 0; i < n; i += 1) {
        const p = path[i]!;
        dummy.position.set(p.x, p.y, 0.58);
        dummy.updateMatrix();
        dots.setMatrixAt(i, dummy.matrix);
      }
      dots.instanceMatrix.needsUpdate = true;
    } else if (dots) {
      dots.count = 0;
    }

    const pool = blockPoolRef.current;
    let bi = 0;
    for (const b of blocks) {
      const p = b.getPosition();
      const lt = readBlockLevelType(b, variant);
      const accent = CATEGORY_META[lt].accent;
      let g = pool[bi];
      if (!g) {
        g = new Group();
        const shadow = new Mesh(
          new BoxGeometry(1, 1, 0.02),
          new MeshBasicMaterial({
            color: COLORS.stoneDark,
            transparent: true,
            opacity: 0.85,
          }),
        );
        shadow.name = 'shadow';
        const main = new Mesh(
          new BoxGeometry(1, 1, 0.4),
          new MeshStandardMaterial({
            map: woodTexture,
            color: MATERIAL_META.wood.tint,
            roughness: 0.85,
            metalness: 0.02,
            emissive: new Color('#000000'),
            emissiveIntensity: 0.08,
          }),
        );
        main.name = 'main';
        const top = new Mesh(
          new PlaneGeometry(1, 0.08),
          new MeshBasicMaterial({ transparent: true, opacity: 0.65 }),
        );
        top.name = 'top';
        g.add(shadow, main, top);
        blocksRoot.add(g);
        pool.push(g);
      }
      g.visible = true;
      g.position.set(p.x, p.y, 0.3);
      g.rotation.set(0, 0, b.getAngle());
      const shadow = g.children[0] as Mesh;
      const main = g.children[1] as Mesh;
      const top = g.children[2] as Mesh;
      shadow.scale.set(bw * 1.02, bh * 1.02, 1);
      shadow.position.set(0.03, -0.05, -0.01);
      main.scale.set(bw, bh, 1);
      const mainMat = main.material as MeshStandardMaterial;
      mainMat.map = woodTexture;
      mainMat.color.set(MATERIAL_META.wood.tint);
      mainMat.emissive.set(accent);
      mainMat.emissiveIntensity = 0.08;
      top.scale.set(bw * 0.94, 1, 1);
      top.position.set(0, bh / 2 - 0.05, 0.21);
      (top.material as MeshBasicMaterial).color.set(accent);
      bi += 1;
    }
    for (let j = bi; j < pool.length; j += 1) pool[j]!.visible = false;
  });

  return (
    <>
      <OrthoCameraSetup />
      <ambientLight intensity={0.95} />
      <directionalLight position={[6, 14, 10]} intensity={0.55} />

      <mesh position={[2, 4, -5]} renderOrder={-1}>
        <planeGeometry args={[48, 30]} />
        <meshBasicMaterial
          map={beachTexture}
          transparent
          opacity={0.75}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, -0.35, -0.6]}>
        <planeGeometry args={[120, 0.7]} />
        <meshBasicMaterial color="#e8d9a8" transparent opacity={0.55} />
      </mesh>

      <group position={[slingAnchor.x, 0, 0.3]}>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[0.34, 0.9, 0.3]} />
          <meshStandardMaterial color={COLORS.slingWoodLight} roughness={0.95} />
        </mesh>
        <mesh position={[-0.1, 0.45, 0.05]}>
          <boxGeometry args={[0.08, 0.9, 0.05]} />
          <meshBasicMaterial color={COLORS.slingWoodDark} />
        </mesh>
        <mesh position={[-0.32, 1.1, 0]} rotation={[0, 0, 0.55]}>
          <boxGeometry args={[0.24, 0.9, 0.28]} />
          <meshStandardMaterial color={COLORS.slingWoodLight} roughness={0.95} />
        </mesh>
        <mesh position={[0.32, 1.1, 0]} rotation={[0, 0, -0.55]}>
          <boxGeometry args={[0.24, 0.9, 0.28]} />
          <meshStandardMaterial color={COLORS.slingWoodLight} roughness={0.95} />
        </mesh>
        <mesh position={[leftPost.x - slingAnchor.x, leftPost.y, 0.05]}>
          <circleGeometry args={[0.13, 20]} />
          <meshBasicMaterial color={COLORS.slingWoodDark} />
        </mesh>
        <mesh position={[rightPost.x - slingAnchor.x, rightPost.y, 0.05]}>
          <circleGeometry args={[0.13, 20]} />
          <meshBasicMaterial color={COLORS.slingWoodDark} />
        </mesh>
      </group>

      <lineSegments geometry={bandGeometry}>
        <lineBasicMaterial color={COLORS.slingBand} linewidth={2} />
      </lineSegments>

      <mesh ref={pouchRef} position={[slingAnchor.x, slingAnchor.y, 0.5]} visible={false}>
        <circleGeometry args={[0.34, 24]} />
        <meshBasicMaterial color={COLORS.slingPouch} />
      </mesh>

      <mesh ref={birdMeshRef} position={[slingAnchor.x, slingAnchor.y, 0.55]} visible>
        <circleGeometry args={[GAME_TUNING.birdRadius * 1.35, 28]} />
        <meshBasicMaterial map={birdIdle.stocks} transparent />
      </mesh>

      <instancedMesh
        ref={dotsMeshRef}
        args={[dotsGeom, dotsMat, GAME_TUNING.trajectoryMaxDots]}
      />

      <group ref={blocksRootRef} />

      <PigMesh simRef={simRef} pigTexture={pigTexture} phaseRef={phaseRef} />
    </>
  );
}

function PigMesh({
  simRef,
  pigTexture,
  phaseRef,
}: {
  simRef: React.MutableRefObject<RoundSimulation | null>;
  pigTexture: ReturnType<typeof buildPigTexture>;
  phaseRef: React.MutableRefObject<string>;
}) {
  const meshRef = useRef<Mesh>(null);
  useFrame(() => {
    const sim = simRef.current;
    const m = meshRef.current;
    if (!sim || !m || phaseRef.current !== 'playing') {
      if (m) m.visible = false;
      return;
    }
    if (!sim.pigState.alive) {
      m.visible = false;
      return;
    }
    try {
      const p = sim.pig.getPosition();
      m.visible = true;
      m.position.set(p.x, p.y, 0.35);
      m.rotation.z = sim.pig.getAngle();
    } catch {
      m.visible = false;
    }
  });
  return (
    <mesh ref={meshRef} visible={false}>
      <circleGeometry args={[GAME_TUNING.pigRadius * 1.2, 28]} />
      <meshBasicMaterial map={pigTexture} transparent />
    </mesh>
  );
}

export function fireAbilityIfNeeded(
  sim: RoundSimulation,
  abilityUsedRef: React.MutableRefObject<boolean>,
): void {
  if (abilityUsedRef.current) return;
  const bird = sim.bird;
  if (bird.getType() !== 'dynamic') return;
  abilityUsedRef.current = true;
  const v = sim.variant;
  if (v === 'stocks') applyStocksBoost(bird);
  else if (v === 'etfs') applyEtfRipple(sim.world, bird);
  else if (v === 'crypto') applyCryptoBlast(sim.world, bird);
}
