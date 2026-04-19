import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Group,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector2,
  type CanvasTexture,
  type Texture,
} from 'three';
import {
  categoryAccent,
  COLORS,
  GAME_CONFIG,
  MATERIAL_META,
} from './config';
import { sampleTrajectoryDots } from './physics';
import { useSimRef } from './simref';
import {
  buildBirdTexture,
  buildIceTexture,
  buildStoneTexturesByCategory,
  buildWoodTexture,
  loadBeachTexture,
  type MaterialTextureMap,
} from './textures';
import { useFrustum } from './frustumContext';
import type { Block, LevelType } from './types';

/** Matches `public/investingbirds/beach-tropical.png` — used until the image decodes. */
const DEFAULT_BEACH_TEX_ASPECT = 740 / 415;

/**
 * Smallest axis-aligned rect with aspect `texAspect` that fully covers the
 * camera frustum (CSS object-fit: cover). Crops overflow; uniform scale only.
 */
function fitCoverPlane(
  viewW: number,
  viewH: number,
  texAspect: number,
): { w: number; h: number } {
  const viewAspect = viewW / viewH;
  if (texAspect > viewAspect) {
    return { w: viewH * texAspect, h: viewH };
  }
  return { w: viewW, h: viewW / texAspect };
}

function BeachBackdrop({ map }: { map: Texture }) {
  const { frustum } = useFrustum();
  const { gl } = useThree();
  const fw = frustum.right - frustum.left;
  const fh = frustum.top - frustum.bottom;
  const [dims, setDims] = useState(() => fitCoverPlane(fw, fh, DEFAULT_BEACH_TEX_ASPECT));

  useEffect(() => {
    const sync = () => {
      const img = map.image as HTMLImageElement | undefined;
      const ar =
        img && img.naturalWidth > 0 && img.naturalHeight > 0
          ? img.naturalWidth / img.naturalHeight
          : DEFAULT_BEACH_TEX_ASPECT;
      setDims(fitCoverPlane(fw, fh, ar));
    };
    sync();
    const img = map.image as HTMLImageElement | undefined;
    img?.addEventListener('load', sync);
    return () => img?.removeEventListener('load', sync);
  }, [map, fw, fh]);

  useEffect(() => {
    map.generateMipmaps = true;
    map.minFilter = LinearMipmapLinearFilter;
    map.magFilter = LinearFilter;
    const maxA = gl.capabilities.getMaxAnisotropy();
    map.anisotropy = Math.min(16, maxA);
    map.needsUpdate = true;
  }, [map, gl]);

  const cx = (frustum.left + frustum.right) * 0.5;
  const cy = (frustum.bottom + frustum.top) * 0.5;

  return (
    <mesh position={[cx, cy, -5]} renderOrder={-1}>
      <planeGeometry args={[dims.w, dims.h]} />
      <meshBasicMaterial map={map} depthWrite={false} />
    </mesh>
  );
}

interface SceneProps {
  /** Monotonic tick bumped by SimDriver — forces React re-render of the
   *  visible-blocks list at a coarse cadence. */
  renderTick: number;
  /** Blocks snapshot taken at the latest renderTick. Visual state (rotation,
   *  position, opacity) is still driven imperatively by `SceneUpdater`. */
  blocks: Block[];
  currentLevelType: LevelType | null;
  showAimHint: boolean;
  state: 'ALLOCATE' | 'INIT_LEVELS' | 'PLAYING' | 'ROUND_END' | 'GAME_END';
}

/**
 * Pure R3F scene — no drei `<Html>`. All DOM overlays live in Overlay.tsx
 * as plain siblings of `<Canvas>`. Imperative per-frame updates happen in
 * `SceneUpdater` below; this component owns only the mesh tree.
 */
export function Scene(props: SceneProps) {
  const { blocks, currentLevelType, showAimHint, state } = props;

  const beachTexture = useMemo(loadBeachTexture, []);
  const woodTexture = useMemo(buildWoodTexture, []);
  const iceTexture = useMemo(buildIceTexture, []);
  const stoneTexturesByCategory = useMemo(buildStoneTexturesByCategory, []);
  const materialTextures = useMemo<MaterialTextureMap>(
    () => ({ wood: woodTexture, ice: iceTexture, stone: null }),
    [woodTexture, iceTexture],
  );
  const birdTexturesByVariant = useMemo(
    () =>
      ({
        stocks: buildBirdTexture('stocks', 'idle'),
        etfs: buildBirdTexture('etfs', 'idle'),
        bonds: buildBirdTexture('bonds', 'idle'),
        crypto: buildBirdTexture('crypto', 'idle'),
      }) as Record<LevelType, CanvasTexture>,
    [],
  );
  const birdPulledTexturesByVariant = useMemo(
    () =>
      ({
        stocks: buildBirdTexture('stocks', 'pulled'),
        etfs: buildBirdTexture('etfs', 'pulled'),
        bonds: buildBirdTexture('bonds', 'pulled'),
        crypto: buildBirdTexture('crypto', 'pulled'),
      }) as Record<LevelType, CanvasTexture>,
    [],
  );

  const slingAnchor = useMemo(
    () => new Vector2(GAME_CONFIG.launchAnchor.x, GAME_CONFIG.launchAnchor.y),
    [],
  );
  const leftPost = useMemo(
    () =>
      new Vector2(
        slingAnchor.x - GAME_CONFIG.slingPostOffset.x,
        slingAnchor.y + GAME_CONFIG.slingPostOffset.y + GAME_CONFIG.slingPostSize.h / 2,
      ),
    [slingAnchor],
  );
  const rightPost = useMemo(
    () =>
      new Vector2(
        slingAnchor.x + GAME_CONFIG.slingPostOffset.x,
        slingAnchor.y + GAME_CONFIG.slingPostOffset.y + GAME_CONFIG.slingPostSize.h / 2,
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
  const streakRef = useRef<Mesh>(null);
  const dotsMeshRef = useRef<InstancedMesh>(null);
  const blocksGroupRef = useRef<Group>(null);

  const visibleBlocks = useMemo(
    () => blocks.filter((b) => b.opacity > 0.01),
    [blocks],
  );

  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[6, 14, 10]} intensity={0.55} />

      <BeachBackdrop map={beachTexture} />

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

      {/* Rubber bands */}
      <lineSegments geometry={bandGeometry}>
        <lineBasicMaterial color={COLORS.slingBand} linewidth={2} />
      </lineSegments>

      {/* Pouch (always mounted during PLAYING; SceneUpdater toggles visibility) */}
      <mesh ref={pouchRef} position={[slingAnchor.x, slingAnchor.y, 0.5]} visible={false}>
        <circleGeometry args={[0.34, 24]} />
        <meshBasicMaterial color={COLORS.slingPouch} />
      </mesh>

      {/* Bird */}
      <mesh
        ref={birdMeshRef}
        position={[slingAnchor.x, slingAnchor.y, 0.55]}
        visible={false}
      >
        <circleGeometry args={[GAME_CONFIG.birdRadius * 1.35, 28]} />
        <meshBasicMaterial
          map={
            currentLevelType
              ? birdTexturesByVariant[currentLevelType]
              : birdTexturesByVariant.stocks
          }
          transparent
        />
      </mesh>

      {/* Launch streak */}
      <mesh ref={streakRef} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.0} depthWrite={false} />
      </mesh>

      {/* Aim hint arrow */}
      {showAimHint ? (
        <group position={[slingAnchor.x - 1.6, slingAnchor.y - 0.1, 0.62]}>
          <mesh rotation={[0, 0, Math.PI]}>
            <planeGeometry args={[0.8, 0.15]} />
            <meshBasicMaterial color="#fef3c7" transparent opacity={0.85} />
          </mesh>
          <mesh position={[-0.45, 0, 0]} rotation={[0, 0, Math.PI]}>
            <circleGeometry args={[0.18, 3]} />
            <meshBasicMaterial color="#fef3c7" transparent opacity={0.85} />
          </mesh>
        </group>
      ) : null}

      {/* Trajectory dots */}
      <instancedMesh
        ref={dotsMeshRef}
        args={[
          new CircleGeometry(0.08, 10),
          new MeshBasicMaterial({
            color: COLORS.trajectoryDot,
            transparent: true,
            opacity: 0.9,
          }),
          GAME_CONFIG.trajectoryMaxDots,
        ]}
      />

      {/* Blocks */}
      <group ref={blocksGroupRef}>
        {visibleBlocks.map((b) => {
          const massScale = Math.max(0.92, Math.min(1.12, 0.85 + b.mass * 0.18));
          const pulseS = 1 + b.damagePulse;
          const grounded = b.position.y - b.height / 2 <= 0.08;
          const clearedVisual = b.knockedOff || b.shattered || b.toppled;
          const activeStructure = !clearedVisual;
          return (
            <group
              key={b.id}
              position={[b.position.x, b.position.y, 0.3]}
              rotation={[0, 0, b.rotation]}
              scale={[massScale * pulseS, massScale * pulseS, 1]}
            >
              <mesh position={[0.03, -0.05, -0.01]}>
                <boxGeometry args={[b.width, b.height, 0.02]} />
                <meshBasicMaterial
                  color={COLORS.stoneDark}
                  transparent
                  opacity={(clearedVisual ? 0.22 : 0.85) * b.opacity}
                />
              </mesh>
              <mesh>
                <boxGeometry args={[b.width, b.height, 0.4]} />
                <meshStandardMaterial
                  map={
                    materialTextures[b.material] ??
                    stoneTexturesByCategory[b.type]
                  }
                  color={
                    b.hitFlashMs > 0
                      ? COLORS.hitFlash
                      : clearedVisual
                        ? '#374151'
                      : b.isTnt
                        ? '#991b1b'
                        : MATERIAL_META[b.material].tint
                  }
                  transparent
                  opacity={clearedVisual ? b.opacity * 0.35 : b.opacity}
                  emissive={activeStructure ? categoryAccent(b.type) : '#000000'}
                  emissiveIntensity={activeStructure ? 0.08 : 0}
                  roughness={b.material === 'ice' ? 0.35 : 0.85}
                  metalness={b.material === 'ice' ? 0.15 : 0.02}
                />
              </mesh>
              {b.isTnt && !b.shattered && !b.knockedOff ? (
                <>
                  <mesh position={[0, 0, 0.23]}>
                    <planeGeometry args={[b.width * 0.7, b.height * 0.28]} />
                    <meshBasicMaterial
                      color="#fde047"
                      transparent
                      opacity={b.opacity * 0.95}
                    />
                  </mesh>
                  <mesh position={[0, 0, 0.24]}>
                    <planeGeometry args={[b.width * 0.58, b.height * 0.14]} />
                    <meshBasicMaterial
                      color="#111111"
                      transparent
                      opacity={b.opacity * 0.9}
                    />
                  </mesh>
                </>
              ) : null}
              <mesh position={[0, b.height / 2 - 0.05, 0.21]}>
                <planeGeometry args={[b.width * 0.94, 0.08]} />
                <meshBasicMaterial
                  color={categoryAccent(b.type)}
                  transparent
                  opacity={activeStructure ? b.opacity * 0.65 : b.opacity * 0.12}
                />
              </mesh>
              {b.cracked ? (
                <mesh position={[0, 0, 0.22]}>
                  <planeGeometry args={[b.width * 0.8, b.height * 0.08]} />
                  <meshBasicMaterial
                    color="#111111"
                    transparent
                    opacity={b.opacity * 0.5}
                  />
                </mesh>
              ) : null}
              {/* Removed target-coin ornament for clarity; active structure is now
                  communicated by contrast (bright active vs dim cleared debris). */}
              {grounded && clearedVisual ? (
                <mesh position={[0, -b.height / 2 + 0.03, 0.22]}>
                  <planeGeometry args={[b.width * 0.9, 0.05]} />
                  <meshBasicMaterial color="#94a3b8" transparent opacity={0.28} />
                </mesh>
              ) : null}
            </group>
          );
        })}
      </group>

      <SceneUpdater
        state={state}
        currentLevelType={currentLevelType}
        slingAnchor={slingAnchor}
        leftPost={leftPost}
        rightPost={rightPost}
        bandGeometry={bandGeometry}
        bandPositions={bandPositions}
        birdMeshRef={birdMeshRef}
        pouchRef={pouchRef}
        streakRef={streakRef}
        dotsMeshRef={dotsMeshRef}
        birdTexturesByVariant={birdTexturesByVariant}
        birdPulledTexturesByVariant={birdPulledTexturesByVariant}
      />
    </>
  );
}

interface SceneUpdaterProps {
  state: SceneProps['state'];
  currentLevelType: LevelType | null;
  slingAnchor: Vector2;
  leftPost: Vector2;
  rightPost: Vector2;
  bandGeometry: BufferGeometry;
  bandPositions: Float32Array;
  birdMeshRef: React.RefObject<Mesh>;
  pouchRef: React.RefObject<Mesh>;
  streakRef: React.RefObject<Mesh>;
  dotsMeshRef: React.RefObject<InstancedMesh>;
  birdTexturesByVariant: Record<LevelType, CanvasTexture>;
  birdPulledTexturesByVariant: Record<LevelType, CanvasTexture>;
}

/**
 * Pure-read `useFrame` that moves bird / pouch / bands / trajectory dots /
 * streak every frame based on the shared `simRef`. Writes go directly to
 * mesh refs — no React reconciliation per frame.
 */
function SceneUpdater(props: SceneUpdaterProps) {
  const simRef = useSimRef();
  const dummy = useMemo(() => new Object3D(), []);

  useFrame(() => {
    const sim = simRef.current;
    const bandAttr = props.bandGeometry.getAttribute('position') as BufferAttribute;

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
      props.bandPositions[o + 0] = ax;
      props.bandPositions[o + 1] = ay;
      props.bandPositions[o + 2] = az;
      props.bandPositions[o + 3] = bx;
      props.bandPositions[o + 4] = by;
      props.bandPositions[o + 5] = bz;
    };
    const showBandsAt = (attach: Vector2) => {
      setBand(0, props.leftPost.x, props.leftPost.y, 0.45, attach.x, attach.y, 0.45);
      setBand(1, props.rightPost.x, props.rightPost.y, 0.45, attach.x, attach.y, 0.45);
      setBand(2, props.leftPost.x, props.leftPost.y, 0.65, attach.x, attach.y, 0.65);
      setBand(3, props.rightPost.x, props.rightPost.y, 0.65, attach.x, attach.y, 0.65);
      bandAttr.needsUpdate = true;
      props.bandGeometry.setDrawRange(0, 8);
    };
    const hideBands = () => {
      props.bandGeometry.setDrawRange(0, 0);
    };

    const birdMesh = props.birdMeshRef.current;
    const pouch = props.pouchRef.current;
    const streak = props.streakRef.current;
    const dots = props.dotsMeshRef.current;

    // Default: hide everything. SceneUpdater only turns pieces on when the
    // state warrants it.
    if (props.state !== 'PLAYING' || !sim.bird) {
      if (birdMesh) birdMesh.visible = false;
      if (pouch) pouch.visible = false;
      if (streak) streak.visible = false;
      if (dots) dots.count = 0;
      hideBands();
      return;
    }

    const bird = sim.bird;
    const levelType = props.currentLevelType ?? 'stocks';

    // Aiming preview
    if (!bird.launched && sim.aiming && sim.dragStart && sim.dragEnd) {
      const pull = sim.dragEnd.clone().sub(sim.dragStart);
      const pullLen = pull.length();
      if (pullLen >= GAME_CONFIG.minPullToAim * 1.4) {
        const startPos = props.slingAnchor
          .clone()
          .add(
            pull
              .clone()
              .normalize()
              .multiplyScalar(Math.min(pullLen, GAME_CONFIG.maxDrag) * 0.55),
          );
        // Reference formula: v = dir * throwSpeed * dragLen (quadratic).
        const dir = pull.clone().negate().normalize();
        const clampedLen = Math.min(pullLen, GAME_CONFIG.maxDrag);
        const vel = dir.multiplyScalar(
          GAME_CONFIG.bird.throwSpeed * clampedLen * clampedLen,
        );
        let stopX: number | undefined;
        for (const b of sim.blocks) {
          if (b.knockedOff || b.toppled) continue;
          const left = b.position.x - b.width / 2;
          if (left > startPos.x && (stopX === undefined || left < stopX)) {
            stopX = left;
          }
        }
        const dotsArr = sampleTrajectoryDots(startPos, vel, { stopX });
        if (dots) {
          const max = Math.min(dotsArr.length, GAME_CONFIG.trajectoryMaxDots);
          for (let i = 0; i < max; i += 1) {
            const fade = max > 1 ? i / (max - 1) : 1;
            const sizeMul = i % 3 === 0 ? 1.25 : 0.85;
            dummy.scale.setScalar((0.32 + 0.5 * fade) * sizeMul);
            dummy.position.set(dotsArr[i]!.x, dotsArr[i]!.y, 0.6);
            dummy.updateMatrix();
            dots.setMatrixAt(i, dummy.matrix);
          }
          dummy.scale.set(1, 1, 1);
          dots.instanceMatrix.needsUpdate = true;
          dots.count = max;
        }
        if (birdMesh) {
          birdMesh.visible = true;
          birdMesh.position.set(startPos.x, startPos.y, 0.55);
          birdMesh.scale.set(1.15, 0.9, 1);
          birdMesh.rotation.z =
            -Math.min(1, pullLen / GAME_CONFIG.maxDrag) * 0.2;
          const mat = (birdMesh as Mesh).material as MeshBasicMaterial;
          const wanted = props.birdPulledTexturesByVariant[levelType];
          if (mat && mat.map !== wanted) {
            mat.map = wanted;
            mat.needsUpdate = true;
          }
        }
        if (pouch) {
          pouch.visible = true;
          pouch.position.set(startPos.x, startPos.y, 0.5);
        }
        showBandsAt(startPos);
        bird.position.set(startPos.x, startPos.y);
      } else {
        if (dots) dots.count = 0;
        if (birdMesh) {
          birdMesh.visible = true;
          birdMesh.position.set(props.slingAnchor.x, props.slingAnchor.y, 0.55);
          birdMesh.scale.set(1, 1, 1);
          birdMesh.rotation.z = 0;
        }
        if (pouch) {
          pouch.visible = true;
          pouch.position.set(props.slingAnchor.x, props.slingAnchor.y, 0.5);
        }
        showBandsAt(props.slingAnchor);
        bird.position.set(props.slingAnchor.x, props.slingAnchor.y);
      }
      if (streak) streak.visible = false;
      return;
    }

    // Bird at rest on pouch
    if (!bird.launched) {
      if (dots) dots.count = 0;
      // Hop-onto-pouch tween
      const spawnAge =
        sim.birdSpawnedAtSec != null
          ? sim.elapsedSec - sim.birdSpawnedAtSec
          : 999;
      const hopDur = 0.32;
      const hopping = spawnAge >= 0 && spawnAge < hopDur;
      const tRaw = hopping ? Math.max(0, Math.min(1, spawnAge / hopDur)) : 1;
      const t = 1 - Math.pow(1 - tRaw, 2.2);
      const hopStart = { x: props.slingAnchor.x - 4, y: props.slingAnchor.y + 4 };
      const renderX = hopping
        ? hopStart.x + (props.slingAnchor.x - hopStart.x) * t
        : props.slingAnchor.x;
      const arc = hopping ? Math.sin(tRaw * Math.PI) * 1.1 : 0;
      const renderY = hopping
        ? hopStart.y + (props.slingAnchor.y - hopStart.y) * t + arc
        : props.slingAnchor.y;
      if (birdMesh) {
        birdMesh.visible = true;
        const breathe = hopping
          ? 1
          : 1 + Math.sin(sim.elapsedSec * 2.4) * 0.035;
        birdMesh.position.set(renderX, renderY, 0.55);
        birdMesh.scale.set(breathe, breathe, 1);
        birdMesh.rotation.z = hopping ? (1 - tRaw) * 0.6 : 0;
        const mat = (birdMesh as Mesh).material as MeshBasicMaterial;
        const wanted = props.birdTexturesByVariant[levelType];
        if (mat && mat.map !== wanted) {
          mat.map = wanted;
          mat.needsUpdate = true;
        }
      }
      if (pouch) {
        pouch.visible = true;
        pouch.position.set(props.slingAnchor.x, props.slingAnchor.y, 0.5);
      }
      showBandsAt(props.slingAnchor);
      bird.position.set(props.slingAnchor.x, props.slingAnchor.y);
      if (streak) streak.visible = false;
      return;
    }

    // Bird in flight
    hideBands();
    if (pouch) pouch.visible = false;
    if (dots) dots.count = 0;
    if (birdMesh) {
      birdMesh.visible = bird.active;
      birdMesh.position.set(bird.position.x, bird.position.y, 0.55);
      birdMesh.scale.set(1, 1, 1);
      birdMesh.rotation.z =
        Math.atan2(bird.velocity.y, bird.velocity.x) * 0.5;
    }

    // Launch streak
    if (streak) {
      if (sim.lastLaunchAt != null) {
        const age = sim.elapsedSec - sim.lastLaunchAt;
        if (age >= 0 && age <= GAME_CONFIG.launchStreakSec) {
          const opacity = 1 - age / GAME_CONFIG.launchStreakSec;
          const fromX = sim.lastLaunchPos?.x ?? bird.position.x;
          const fromY = sim.lastLaunchPos?.y ?? bird.position.y;
          streak.position.set(
            (bird.position.x + fromX) / 2,
            (bird.position.y + fromY) / 2,
            0.5,
          );
          const dx = bird.position.x - fromX;
          const dy = bird.position.y - fromY;
          const len = Math.max(0.3, Math.sqrt(dx * dx + dy * dy));
          streak.rotation.z = Math.atan2(dy, dx);
          streak.scale.set(len * 1.2, 0.18, 1);
          const m = streak.material as MeshBasicMaterial;
          if (m) m.opacity = opacity * 0.8;
          streak.visible = true;
        } else {
          streak.visible = false;
        }
      } else {
        streak.visible = false;
      }
    }
  });

  return null;
}
