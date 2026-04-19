import { Html, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera as OrthoCam,
  RepeatWrapping,
  Vector2,
} from 'three';
import { eventBus } from '@/core/events';
import { advanceCampaignYear } from '@/core/campaign/yearAdvance';
import type { GameProps } from '@/core/types';
import { fitOrthographicToViewport, type OrthoDesignBounds } from './cameraFit';
import {
  CAMERA_DESIGN,
  categoryAccent,
  COLORS,
  GAME_CONFIG,
} from './config';
import { getInitialRunState, runReducer } from './fsm';
import { buildLevels, generateBlocksForLevel } from './levelGen';
import {
  clampDragPoint,
  cloneBird,
  cloneBlocks,
  createBird,
  isBirdOutOfBounds,
  launchVelocity,
  resolveCollisions,
  resolveGroundCollision,
  sampleTrajectoryDots,
  stepBlocks,
  updateBirdPhysics,
  updateBlockVisuals,
} from './physics';
import type {
  Bird,
  Block,
  InvestingBirdsInput,
  InvestingBirdsOutput,
  LevelDef,
  RunState,
} from './types';
import { InvestingBirdsOverlay } from './ui';

function toWorldPoint(
  ndcX: number,
  ndcY: number,
  frustum: OrthoDesignBounds,
): Vector2 {
  return new Vector2(
    ((ndcX + 1) / 2) * (frustum.right - frustum.left) + frustum.left,
    ((ndcY + 1) / 2) * (frustum.top - frustum.bottom) + frustum.bottom,
  );
}

function seedFromInput(seed?: number): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) return Math.floor(seed);
  return 1337;
}

interface SimRef {
  elapsedSec: number;
  bird: Bird | null;
  blocks: Block[];
  dragStart: Vector2 | null;
  dragEnd: Vector2 | null;
  aiming: boolean;
  accumulator: number;
  hasLaunchedOnce: boolean;
  /** `elapsedSec` when the current bird's shot ended; null while bird is still active/unlaunched. */
  shotEndedAtSec: number | null;
  /** Avoid duplicate floaters per block. */
  scoredBlocks: Set<string>;
  nextFloaterId: number;
}

/** Build a small stone-brick texture once and reuse across blocks. */
function buildStoneTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grd = ctx.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, COLORS.stoneTop);
  grd.addColorStop(0.5, COLORS.stoneLight);
  grd.addColorStop(1, COLORS.stoneMid);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = COLORS.stoneMortar;
  const rows = 3;
  const cols = 2;
  const rowH = size / rows;
  const colW = size / cols;
  for (let r = 0; r < rows; r += 1) {
    const y = r * rowH;
    ctx.fillRect(0, y, size, 3);
    const offset = r % 2 === 0 ? 0 : colW / 2;
    for (let c = 0; c <= cols; c += 1) {
      const x = c * colW + offset;
      ctx.fillRect(x - 1, y, 3, rowH);
    }
  }
  ctx.fillRect(0, size - 2, size, 2);

  for (let i = 0; i < 60; i += 1) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    ctx.fillRect(cx, cy, 2, 2);
  }

  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Soft cloud texture with radial alpha falloff. */
function buildCloudTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const centers = [
    { x: 0.5, y: 0.55, r: 0.48 },
    { x: 0.3, y: 0.55, r: 0.32 },
    { x: 0.72, y: 0.5, r: 0.34 },
    { x: 0.62, y: 0.38, r: 0.25 },
  ];
  for (const c of centers) {
    const grad = ctx.createRadialGradient(
      c.x * size,
      c.y * size,
      0,
      c.x * size,
      c.y * size,
      c.r * size,
    );
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Angry-bird style face as a square texture, transparent background. */
function buildBirdTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  // Body
  const body = ctx.createRadialGradient(size / 2, size / 2, size * 0.12, size / 2, size / 2, size * 0.5);
  body.addColorStop(0, '#ef4444');
  body.addColorStop(1, '#991b1b');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#450a0a';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Eye whites
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(size * 0.54, size * 0.42, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size * 0.74, size * 0.42, size * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(size * 0.56, size * 0.43, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size * 0.76, size * 0.43, size * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = COLORS.birdBeak;
  ctx.beginPath();
  ctx.moveTo(size * 0.85, size * 0.56);
  ctx.lineTo(size * 0.98, size * 0.48);
  ctx.lineTo(size * 0.98, size * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 3;
  ctx.stroke();

  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export default function InvestingBirdsGame({
  inputs,
  onEvent,
}: GameProps<InvestingBirdsInput, InvestingBirdsOutput>) {
  const [state, dispatch] = useReducer(
    runReducer,
    getInitialRunState(seedFromInput(inputs.seed)),
  );
  const stateRef = useRef<RunState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const simRef = useRef<SimRef>({
    elapsedSec: 0,
    bird: null,
    blocks: [],
    dragStart: null,
    dragEnd: null,
    aiming: false,
    accumulator: 0,
    hasLaunchedOnce: false,
    shotEndedAtSec: null,
    scoredBlocks: new Set(),
    nextFloaterId: 1,
  });

  const frustumRef = useRef<OrthoDesignBounds>({
    left: CAMERA_DESIGN.left,
    right: CAMERA_DESIGN.right,
    bottom: CAMERA_DESIGN.bottom,
    top: CAMERA_DESIGN.top,
  });

  const cloudsRef = useRef<Group>(null);
  const shakeRef = useRef(0);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const { camera, size, scene, gl } = useThree();

  useLayoutEffect(() => {
    const bg = new Color(COLORS.skyBottom);
    scene.background = bg;
    gl.setClearColor(bg, 1);
  }, [scene, gl]);

  const birdMeshRef = useRef<Mesh>(null);
  const pouchRef = useRef<Mesh>(null);
  const dotsMeshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  const stoneTexture = useMemo(() => buildStoneTexture(), []);
  const cloudTexture = useMemo(() => buildCloudTexture(), []);
  const birdTexture = useMemo(() => buildBirdTexture(), []);

  const bandPositions = useMemo(() => new Float32Array(12), []);
  const bandGeometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(bandPositions, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, [bandPositions]);

  const pointerIdRef = useRef<number | null>(null);
  const pointerTargetRef = useRef<HTMLDivElement | null>(null);

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

  // Reset sim ref whenever we go back to allocate.
  useEffect(() => {
    if (state.state !== 'ALLOCATE') return;
    simRef.current = {
      elapsedSec: 0,
      bird: null,
      blocks: [],
      dragStart: null,
      dragEnd: null,
      aiming: false,
      accumulator: 0,
      hasLaunchedOnce: false,
      shotEndedAtSec: null,
      scoredBlocks: new Set(),
      nextFloaterId: 1,
    };
    if (dotsMeshRef.current) dotsMeshRef.current.count = 0;
    bandGeometry.setDrawRange(0, 0);
  }, [state.state, bandGeometry]);

  useEffect(() => {
    const startEvt = {
      kind: 'start' as const,
      payload: undefined as unknown as InvestingBirdsOutput,
    };
    eventBus.emit('game:event', startEvt);
    onEvent?.(startEvt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.state !== 'INIT_LEVELS') return;
    const levels = buildLevels(state.allocation);
    dispatch({ type: 'INIT_COMPLETE', payload: { levels, seed: state.rngSeed } });
  }, [state.state, state.allocation, state.rngSeed]);

  useEffect(() => {
    if (state.state !== 'PLAYING') return;
    if (state.currentLevelIndex >= state.levels.length) return;
    if (state.blocks.length > 0) return;
    const level = state.levels[state.currentLevelIndex];
    if (!level) return;
    const blocks = generateBlocksForLevel(level);
    const bird = createBird();
    simRef.current.blocks = cloneBlocks(blocks);
    simRef.current.bird = cloneBird(bird);
    simRef.current.dragStart = null;
    simRef.current.dragEnd = null;
    simRef.current.aiming = false;
    simRef.current.shotEndedAtSec = null;
    simRef.current.accumulator = 0;
    simRef.current.scoredBlocks = new Set();
    dispatch({
      type: 'SET_ROUND',
      payload: { blocks, bird, birdsForRound: level.birds },
    });
  }, [state.state, state.currentLevelIndex, state.levels, state.blocks.length]);

  useEffect(() => {
    if (state.state !== 'GAME_END' || !state.outcome) return;
    const out: InvestingBirdsOutput = {
      outcome: state.outcome,
      score: Math.round(state.score),
      levelsCleared: state.outcome === 'win' ? state.levels.length : state.currentLevelIndex,
      scoreByType: state.scoreByType,
    };
    const resultEvt = { kind: 'result' as const, payload: out };
    eventBus.emit('game:result', resultEvt);
    onEvent?.(resultEvt);
  }, [
    state.state,
    state.outcome,
    state.score,
    state.levels.length,
    state.currentLevelIndex,
    state.scoreByType,
    onEvent,
  ]);

  const currentLevel: LevelDef | null = state.levels[state.currentLevelIndex] ?? null;
  const accent = currentLevel ? categoryAccent(currentLevel.type) : '#ffffff';

  // Main simulation loop.
  useFrame((_, dt) => {
    if (camera instanceof OrthoCam) {
      fitOrthographicToViewport(camera, size.width, size.height, {
        left: CAMERA_DESIGN.left,
        right: CAMERA_DESIGN.right,
        bottom: CAMERA_DESIGN.bottom,
        top: CAMERA_DESIGN.top,
      });
      frustumRef.current = {
        left: camera.left,
        right: camera.right,
        bottom: camera.bottom,
        top: camera.top,
      };
    }

    const sim = simRef.current;
    const st = stateRef.current;
    sim.elapsedSec += dt;

    if (cloudsRef.current) {
      cloudsRef.current.position.x =
        ((sim.elapsedSec * GAME_CONFIG.parallaxDrift) % 24) - 12;
    }

    // Rubber-band draw helpers
    const bandAttr = bandGeometry.getAttribute('position') as BufferAttribute;
    const setBandSegment = (
      seg: 0 | 1,
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
    const showBandsAt = (attach: Vector2) => {
      setBandSegment(0, leftPost.x, leftPost.y, 0.45, attach.x, attach.y, 0.45);
      setBandSegment(1, rightPost.x, rightPost.y, 0.45, attach.x, attach.y, 0.45);
      bandAttr.needsUpdate = true;
      bandGeometry.setDrawRange(0, 4);
    };
    const hideBands = () => {
      bandGeometry.setDrawRange(0, 0);
    };

    if (st.state === 'ROUND_END') {
      hideBands();
      if (
        st.roundEndedAtSec != null &&
        sim.elapsedSec - st.roundEndedAtSec >= GAME_CONFIG.roundPauseSec
      ) {
        const lastIndex = st.levels.length - 1;
        if (st.currentLevelIndex >= lastIndex) {
          const anyCleared = (st.scoreByType.stocks ?? 0) +
            (st.scoreByType.etfs ?? 0) +
            (st.scoreByType.bonds ?? 0) +
            (st.scoreByType.crypto ?? 0) > 0;
          dispatch({ type: anyCleared ? 'WIN_GAME' : 'LOSE_GAME' });
        } else {
          dispatch({ type: 'ROUND_ADVANCE' });
          dispatch({ type: 'SET_BLOCKS', payload: [] });
          dispatch({ type: 'SET_BIRD', payload: null });
        }
      }
      return;
    }

    if (st.state !== 'PLAYING') return;
    const level = st.levels[st.currentLevelIndex];
    if (!level || !sim.bird) return;

    // Aim preview / bird tension pose.
    if (!sim.bird.launched && sim.aiming && sim.dragStart && sim.dragEnd) {
      const pull = sim.dragEnd.clone().sub(sim.dragStart);
      const pullLen = pull.length();
      if (pullLen >= GAME_CONFIG.minPullToAim) {
        const vel = launchVelocity(sim.dragStart, sim.dragEnd);
        const startPos = slingAnchor
          .clone()
          .add(pull.clone().normalize().multiplyScalar(Math.min(pullLen, GAME_CONFIG.maxDrag) * 0.55));
        const dots = sampleTrajectoryDots(startPos, vel);
        const mesh = dotsMeshRef.current;
        if (mesh) {
          const max = Math.min(dots.length, GAME_CONFIG.trajectoryMaxDots);
          for (let i = 0; i < max; i += 1) {
            const fade = max > 1 ? i / (max - 1) : 1;
            dummy.scale.setScalar(0.38 + 0.62 * fade);
            dummy.position.set(dots[i]!.x, dots[i]!.y, 0.55);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
          }
          dummy.scale.set(1, 1, 1);
          mesh.instanceMatrix.needsUpdate = true;
          mesh.count = max;
        }
        if (birdMeshRef.current) {
          birdMeshRef.current.position.set(startPos.x, startPos.y, 0.55);
          birdMeshRef.current.scale.set(1.15, 0.9, 1);
        }
        if (pouchRef.current) pouchRef.current.position.set(startPos.x, startPos.y, 0.5);
        showBandsAt(startPos);
      } else {
        if (dotsMeshRef.current) dotsMeshRef.current.count = 0;
        if (birdMeshRef.current) {
          birdMeshRef.current.position.set(slingAnchor.x, slingAnchor.y, 0.55);
          birdMeshRef.current.scale.set(1, 1, 1);
        }
        if (pouchRef.current)
          pouchRef.current.position.set(slingAnchor.x, slingAnchor.y, 0.5);
        showBandsAt(slingAnchor);
      }
    } else {
      if (dotsMeshRef.current) dotsMeshRef.current.count = 0;
      if (!sim.bird.launched) {
        if (birdMeshRef.current) {
          birdMeshRef.current.position.set(slingAnchor.x, slingAnchor.y, 0.55);
          birdMeshRef.current.scale.set(1, 1, 1);
        }
        if (pouchRef.current)
          pouchRef.current.position.set(slingAnchor.x, slingAnchor.y, 0.5);
        showBandsAt(slingAnchor);
      } else {
        hideBands();
      }
    }

    // Advance physics at a fixed step.
    if (sim.bird.launched || sim.blocks.some((b) => b.falling || !b.knockedOff)) {
      sim.accumulator += dt;
      const maxSteps = 6;
      let steps = 0;
      while (sim.accumulator >= GAME_CONFIG.fixedStep && steps < maxSteps) {
        sim.accumulator -= GAME_CONFIG.fixedStep;
        steps += 1;

        if (sim.bird.launched) {
          sim.bird = updateBirdPhysics(sim.bird, GAME_CONFIG.fixedStep);
          sim.bird = resolveGroundCollision(sim.bird);
          const collision = resolveCollisions(sim.bird, sim.blocks);
          sim.bird = collision.bird;
          sim.blocks = collision.blocks;

          for (const hit of collision.hits) {
            if (hit.heavy) {
              shakeRef.current = Math.min(0.25, shakeRef.current + hit.impactForce * 0.004);
            }
            eventBus.emit('audio:play', {
              channel: 'sfx',
              id: hit.heavy ? 'investingBirds_hit_heavy' : 'investingBirds_hit_light',
            });
          }
        }
        sim.blocks = stepBlocks(sim.blocks, GAME_CONFIG.fixedStep);

        // Detect "knocked off the stage" transitions and award score.
        for (const b of sim.blocks) {
          if (b.knockedOff || b.scored) continue;
          const offStage =
            b.position.y < GAME_CONFIG.killFloorY ||
            b.position.x < GAME_CONFIG.worldBounds.minX ||
            b.position.x > GAME_CONFIG.worldBounds.maxX;
          if (!offStage) continue;
          b.knockedOff = true;
          b.scored = true;
          if (sim.scoredBlocks.has(b.id)) continue;
          sim.scoredBlocks.add(b.id);
          const delta = Math.round(GAME_CONFIG.scorePerBlockKnockedOff * level.multiplier);
          dispatch({
            type: 'UPDATE_SCORE',
            payload: { delta, levelType: level.type },
          });
          const { left, right, bottom, top } = frustumRef.current;
          const ndcX = ((b.position.x - left) / (right - left)) * 2 - 1;
          const ndcY = ((b.position.y - bottom) / (top - bottom)) * 2 - 1;
          dispatch({
            type: 'PUSH_FLOATER',
            payload: {
              id: sim.nextFloaterId++,
              delta,
              atSec: sim.elapsedSec,
              ndcX,
              ndcY: Math.max(-0.6, Math.min(0.8, ndcY)),
            },
          });
          eventBus.emit('audio:play', { channel: 'sfx', id: 'investingBirds_break' });
        }
      }
    }

    sim.blocks = updateBlockVisuals(sim.blocks, dt);
    dispatch({ type: 'SET_BLOCKS', payload: cloneBlocks(sim.blocks) });
    if (sim.bird.launched) {
      dispatch({ type: 'SET_BIRD', payload: cloneBird(sim.bird) });
    }
    dispatch({ type: 'SET_ELAPSED', payload: sim.elapsedSec });

    if (birdMeshRef.current && sim.bird) {
      birdMeshRef.current.position.set(sim.bird.position.x, sim.bird.position.y, 0.55);
      if (sim.bird.launched) {
        birdMeshRef.current.rotation.z =
          Math.atan2(sim.bird.velocity.y, sim.bird.velocity.x) * 0.5;
      } else {
        birdMeshRef.current.rotation.z = 0;
      }
    }

    // Win/round-end conditions.
    const aliveBlocks = sim.blocks.filter((b) => !b.knockedOff);
    const allCleared = aliveBlocks.length === 0 && sim.blocks.length > 0;

    if (allCleared) {
      dispatch({
        type: 'ROUND_END',
        payload: { outcome: 'cleared', endedAtSec: sim.elapsedSec },
      });
      const bonus = Math.round(st.birdsRemaining * 50 * level.multiplier);
      if (bonus > 0) {
        dispatch({
          type: 'UPDATE_SCORE',
          payload: { delta: bonus, levelType: level.type },
        });
      }
      return;
    }

    // Shot management.
    if (sim.bird.launched && sim.bird.active) {
      const shotEnded =
        sim.bird.settledMs >= GAME_CONFIG.settleWindowMs || isBirdOutOfBounds(sim.bird);
      if (shotEnded) {
        sim.bird.active = false;
        sim.shotEndedAtSec = sim.elapsedSec;
      }
    }

    // Respawn bird if still have shots.
    if (
      sim.shotEndedAtSec != null &&
      sim.elapsedSec - sim.shotEndedAtSec >= GAME_CONFIG.respawnDelaySec
    ) {
      if (st.birdsRemaining > 0) {
        sim.bird = createBird();
        sim.shotEndedAtSec = null;
        dispatch({ type: 'SET_BIRD', payload: cloneBird(sim.bird) });
      } else if (
        // All shots done and everything has had a moment to settle.
        sim.blocks.every((b) => !b.falling || b.knockedOff)
      ) {
        const anyAlive = sim.blocks.some((b) => !b.knockedOff);
        dispatch({
          type: 'ROUND_END',
          payload: {
            outcome: anyAlive ? 'survived' : 'cleared',
            endedAtSec: sim.elapsedSec,
          },
        });
      }
    }
  });

  // Camera shake separate pass so we don't fight level-fit.
  useFrame((_, dt) => {
    shakeRef.current *= Math.exp(-dt * 15);
    if (!(camera instanceof OrthoCam)) return;
    const sim = simRef.current;
    const s = reduceMotionRef.current ? 0 : shakeRef.current;
    if (s < 1e-4) {
      camera.position.set(0, 0, CAMERA_DESIGN.z);
      return;
    }
    camera.position.set(
      Math.sin(sim.elapsedSec * 92) * 0.45 * s,
      Math.cos(sim.elapsedSec * 71) * 0.35 * s,
      CAMERA_DESIGN.z,
    );
  });

  // Pointer handlers.
  const onPointerDown = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const st = stateRef.current;
    if (st.state !== 'PLAYING') return;
    const sim = simRef.current;
    const bird = sim.bird;
    if (!bird || bird.launched || !bird.active || st.birdsRemaining <= 0) return;

    const x = (ev.clientX / window.innerWidth) * 2 - 1;
    const y = -(ev.clientY / window.innerHeight) * 2 + 1;
    const world = toWorldPoint(x, y, frustumRef.current);
    const start = slingAnchor.clone();
    if (world.distanceTo(start) > 3.2) return;

    pointerIdRef.current = ev.pointerId;
    pointerTargetRef.current = ev.currentTarget;
    ev.currentTarget.setPointerCapture(ev.pointerId);

    sim.dragStart = start;
    sim.dragEnd = world;
    sim.aiming = true;
    eventBus.emit('audio:play', { channel: 'sfx', id: 'investingBirds_pull' });
    dispatch({ type: 'SET_DRAG', payload: { start, end: world } });
  };

  const onPointerMove = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const st = stateRef.current;
    const sim = simRef.current;
    if (!sim.aiming || !sim.dragStart || st.state !== 'PLAYING') return;
    const x = (ev.clientX / window.innerWidth) * 2 - 1;
    const y = -(ev.clientY / window.innerHeight) * 2 + 1;
    const world = toWorldPoint(x, y, frustumRef.current);
    const end = clampDragPoint(sim.dragStart, world);
    sim.dragEnd = end;
    dispatch({ type: 'SET_DRAG', payload: { start: sim.dragStart, end } });
  };

  const endPointer = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const st = stateRef.current;
    const sim = simRef.current;
    if (pointerTargetRef.current && pointerIdRef.current != null) {
      try {
        pointerTargetRef.current.releasePointerCapture(pointerIdRef.current);
      } catch {
        // ignore
      }
    }
    pointerIdRef.current = null;
    pointerTargetRef.current = null;

    if (st.state !== 'PLAYING') return;
    const bird = sim.bird;
    if (!bird || bird.launched || !sim.aiming || !sim.dragStart || !sim.dragEnd) {
      sim.aiming = false;
      dispatch({ type: 'SET_DRAG', payload: { start: null, end: null } });
      return;
    }
    const pull = sim.dragEnd.clone().sub(sim.dragStart);
    if (pull.length() < GAME_CONFIG.minPullToLaunch) {
      sim.aiming = false;
      sim.dragStart = null;
      sim.dragEnd = null;
      dispatch({ type: 'SET_DRAG', payload: { start: null, end: null } });
      return;
    }

    const velocity = launchVelocity(sim.dragStart, sim.dragEnd);
    sim.bird = { ...bird, launched: true, velocity };
    sim.hasLaunchedOnce = true;
    sim.aiming = false;
    sim.dragStart = null;
    sim.dragEnd = null;
    eventBus.emit('audio:play', { channel: 'sfx', id: 'investingBirds_release' });
    dispatch({ type: 'SET_DRAG', payload: { start: null, end: null } });
    dispatch({ type: 'SET_BIRD', payload: cloneBird(sim.bird) });
    dispatch({ type: 'CONSUME_BIRD' });
    ev.preventDefault();
  };

  const visibleBlocks = useMemo(
    () => state.blocks.filter((b) => b.opacity > 0.01),
    [state.blocks],
  );

  // Static clouds positions.
  const clouds = useMemo(
    () => [
      { x: -8, y: 8.5, s: 3.2 },
      { x: -3, y: 9.5, s: 2.6 },
      { x: 2, y: 8.2, s: 3.5 },
      { x: 7, y: 9.8, s: 2.2 },
      { x: 11, y: 8.6, s: 2.8 },
    ],
    [],
  );

  const trees = useMemo(
    () => [
      { x: -10, y: 0.3, s: 1.1 },
      { x: 13, y: 0.3, s: 1.3 },
      { x: -6, y: 0.3, s: 0.9 },
    ],
    [],
  );

  return (
    <>
      <OrthographicCamera
        makeDefault
        left={CAMERA_DESIGN.left}
        right={CAMERA_DESIGN.right}
        top={CAMERA_DESIGN.top}
        bottom={CAMERA_DESIGN.bottom}
        near={CAMERA_DESIGN.near}
        far={CAMERA_DESIGN.far}
      />
      <ambientLight intensity={0.95} />
      <directionalLight position={[6, 14, 10]} intensity={0.55} />

      {/* Sky gradient — two planes. */}
      <mesh position={[0, 10, -5]}>
        <planeGeometry args={[60, 16]} />
        <meshBasicMaterial color={COLORS.skyTop} />
      </mesh>
      <mesh position={[0, 2, -4.9]}>
        <planeGeometry args={[60, 10]} />
        <meshBasicMaterial color={COLORS.skyBottom} />
      </mesh>

      {/* Sun */}
      <group position={[9, 9, -4.5]}>
        <mesh>
          <circleGeometry args={[2.0, 32]} />
          <meshBasicMaterial color={COLORS.sun} transparent opacity={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <circleGeometry args={[1.15, 32]} />
          <meshBasicMaterial color={COLORS.sun} transparent opacity={0.75} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <circleGeometry args={[0.65, 32]} />
          <meshBasicMaterial color={COLORS.sunCore} />
        </mesh>
      </group>

      {/* Drifting clouds */}
      <group ref={cloudsRef} position={[0, 0, -4]}>
        {clouds.map((c, i) => (
          <mesh key={i} position={[c.x, c.y, 0]} scale={[c.s, c.s * 0.55, 1]}>
            <planeGeometry args={[3, 3]} />
            <meshBasicMaterial map={cloudTexture} transparent depthWrite={false} />
          </mesh>
        ))}
      </group>

      {/* Far hills */}
      <mesh position={[-6, 0.9, -3.2]} rotation={[0, 0, 0]}>
        <circleGeometry args={[5.2, 3, 0, Math.PI]} />
        <meshBasicMaterial color={COLORS.hillFar} />
      </mesh>
      <mesh position={[5, 0.8, -3.1]}>
        <circleGeometry args={[4.4, 3, 0, Math.PI]} />
        <meshBasicMaterial color={COLORS.hillFar} />
      </mesh>
      <mesh position={[-2, 0.6, -2.9]}>
        <circleGeometry args={[3.2, 3, 0, Math.PI]} />
        <meshBasicMaterial color={COLORS.hillNear} />
      </mesh>
      <mesh position={[11, 0.65, -2.85]}>
        <circleGeometry args={[3.6, 3, 0, Math.PI]} />
        <meshBasicMaterial color={COLORS.hillNear} />
      </mesh>

      {/* Grass strip */}
      <mesh position={[0, -0.5, -1]}>
        <planeGeometry args={[60, 1.4]} />
        <meshBasicMaterial color={COLORS.grassDark} />
      </mesh>
      <mesh position={[0, 0.05, -0.8]}>
        <planeGeometry args={[60, 0.6]} />
        <meshBasicMaterial color={COLORS.grassLight} />
      </mesh>
      <mesh position={[0, -0.25, -0.6]}>
        <planeGeometry args={[60, 0.25]} />
        <meshBasicMaterial color={COLORS.grassHorizon} />
      </mesh>

      {/* Trees */}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, t.y, -0.9]} scale={[t.s, t.s, 1]}>
          <mesh position={[0, 0.5, 0]}>
            <planeGeometry args={[0.3, 1.2]} />
            <meshBasicMaterial color={COLORS.treeTrunk} />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <circleGeometry args={[0.9, 14]} />
            <meshBasicMaterial color={COLORS.treeCanopy} />
          </mesh>
          <mesh position={[0.4, 1.8, 0]}>
            <circleGeometry args={[0.65, 14]} />
            <meshBasicMaterial color={COLORS.treeCanopy} />
          </mesh>
          <mesh position={[-0.4, 1.8, 0]}>
            <circleGeometry args={[0.65, 14]} />
            <meshBasicMaterial color={COLORS.treeCanopy} />
          </mesh>
        </group>
      ))}

      {/* Slingshot */}
      <group position={[slingAnchor.x, 0, 0.3]}>
        {/* Trunk */}
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[0.34, 0.9, 0.3]} />
          <meshStandardMaterial color={COLORS.slingWoodLight} roughness={0.95} />
        </mesh>
        <mesh position={[-0.1, 0.45, 0.05]}>
          <boxGeometry args={[0.08, 0.9, 0.05]} />
          <meshBasicMaterial color={COLORS.slingWoodDark} />
        </mesh>
        {/* Left fork */}
        <mesh position={[-0.32, 1.1, 0]} rotation={[0, 0, 0.55]}>
          <boxGeometry args={[0.24, 0.9, 0.28]} />
          <meshStandardMaterial color={COLORS.slingWoodLight} roughness={0.95} />
        </mesh>
        {/* Right fork */}
        <mesh position={[0.32, 1.1, 0]} rotation={[0, 0, -0.55]}>
          <boxGeometry args={[0.24, 0.9, 0.28]} />
          <meshStandardMaterial color={COLORS.slingWoodLight} roughness={0.95} />
        </mesh>
        {/* Prong caps */}
        <mesh position={[leftPost.x - slingAnchor.x, leftPost.y, 0.05]}>
          <circleGeometry args={[0.13, 20]} />
          <meshBasicMaterial color={COLORS.slingWoodDark} />
        </mesh>
        <mesh position={[rightPost.x - slingAnchor.x, rightPost.y, 0.05]}>
          <circleGeometry args={[0.13, 20]} />
          <meshBasicMaterial color={COLORS.slingWoodDark} />
        </mesh>
      </group>

      {/* Rubber bands (back pair, drawn behind bird at z=0.45; front pair at z=0.65) */}
      <lineSegments geometry={bandGeometry}>
        <lineBasicMaterial color={COLORS.slingBand} linewidth={2} />
      </lineSegments>

      {/* Leather pouch renders at bird position during aim; hidden when launched */}
      {state.state === 'PLAYING' && state.currentBird && !state.currentBird.launched ? (
        <mesh ref={pouchRef} position={[slingAnchor.x, slingAnchor.y, 0.5]}>
          <circleGeometry args={[0.34, 24]} />
          <meshBasicMaterial color={COLORS.slingPouch} />
        </mesh>
      ) : null}

      {/* Bird */}
      {state.state === 'PLAYING' && state.currentBird && state.currentBird.active ? (
        <mesh ref={birdMeshRef} position={[slingAnchor.x, slingAnchor.y, 0.55]}>
          <circleGeometry args={[state.currentBird.radius * 1.35, 28]} />
          <meshBasicMaterial map={birdTexture} transparent />
        </mesh>
      ) : null}

      {/* Trajectory preview dots */}
      <instancedMesh
        ref={dotsMeshRef}
        args={[
          new CircleGeometry(0.08, 10),
          new MeshBasicMaterial({
            color: COLORS.trajectoryDot,
            transparent: true,
            opacity: 0.85,
          }),
          GAME_CONFIG.trajectoryMaxDots,
        ]}
      />

      {/* Blocks (stone bricks) */}
      {visibleBlocks.map((b) => (
        <group
          key={b.id}
          position={[b.position.x, b.position.y, 0.3]}
          rotation={[0, 0, b.rotation]}
          scale={[1 + b.damagePulse, 1 + b.damagePulse, 1]}
        >
          {/* Side/bottom face shadow (slightly larger, darker, offset down-right) */}
          <mesh position={[0.03, -0.05, -0.01]}>
            <boxGeometry args={[b.width, b.height, 0.02]} />
            <meshBasicMaterial color={COLORS.stoneDark} transparent opacity={b.opacity * 0.85} />
          </mesh>
          {/* Main stone face */}
          <mesh>
            <boxGeometry args={[b.width, b.height, 0.4]} />
            <meshStandardMaterial
              map={stoneTexture}
              color={b.hitFlashMs > 0 ? COLORS.hitFlash : '#ffffff'}
              transparent
              opacity={b.opacity}
              roughness={0.85}
              metalness={0.02}
            />
          </mesh>
          {/* Top highlight bar for 3D depth */}
          <mesh position={[0, b.height / 2 - 0.05, 0.21]}>
            <planeGeometry args={[b.width * 0.94, 0.08]} />
            <meshBasicMaterial color={COLORS.stoneTop} transparent opacity={b.opacity * 0.7} />
          </mesh>
          {b.cracked ? (
            <mesh position={[0, 0, 0.22]}>
              <planeGeometry args={[b.width * 0.8, b.height * 0.08]} />
              <meshBasicMaterial color="#111111" transparent opacity={b.opacity * 0.5} />
            </mesh>
          ) : null}
        </group>
      ))}

      {/* Current tower's label + multiplier badge (world-space via Html) */}
      {currentLevel && state.blocks.length > 0 ? (
        <Html
          position={[
            state.blocks.reduce((acc, b) => acc + b.position.x, 0) /
              Math.max(1, state.blocks.length),
            Math.max(...state.blocks.map((b) => b.position.y + b.height / 2), 0) + 1.1,
            0.6,
          ]}
          center
          transform={false}
          distanceFactor={undefined}
          pointerEvents="none"
        >
          <div className="pointer-events-none flex flex-col items-center gap-1">
            <div
              className="rounded-full px-3 py-1 text-sm font-bold tabular-nums text-white shadow-lg"
              style={{ background: accent }}
            >
              {currentLevel.multiplier.toFixed(2)}x
            </div>
            <div className="rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium tracking-wide text-white backdrop-blur-sm">
              {currentLevel.label}
            </div>
          </div>
        </Html>
      ) : null}

      {/* DOM overlay: pointer capture layer + HUD. */}
      <Html fullscreen>
        <div
          className="absolute inset-0 z-0"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        />
        <InvestingBirdsOverlay
          state={state.state}
          allocation={state.allocation}
          levels={state.levels}
          currentLevelIndex={state.currentLevelIndex}
          currentLevel={currentLevel}
          nextLevel={state.levels[state.currentLevelIndex + 1] ?? null}
          birdsRemaining={state.birdsRemaining}
          score={state.score}
          scoreByType={state.scoreByType}
          outcome={state.outcome}
          roundOutcome={state.roundOutcome}
          elapsedSec={state.elapsedSec}
          scoreFloaters={state.scoreFloaters}
          showAimHint={state.state === 'PLAYING' && !simRef.current.hasLaunchedOnce}
          onAllocationChange={(payload) =>
            dispatch({ type: 'SET_ALLOCATION', payload })
          }
          onStart={() => dispatch({ type: 'START_GAME' })}
          onRestart={() => dispatch({ type: 'RESTART' })}
          onReturnMenu={() => {
            // Investing Birds is the *year-end* mini-game on debt-free years,
            // so leaving from the end-of-game modal must close the year
            // through the unified pipeline (debt math, year++, gate reset,
            // economy roll). Destination 'menu' preserves the existing UX
            // ("Back to menu") while still applying the close-year writes.
            advanceCampaignYear({ outcome: state.outcome ?? 'skipped', destination: 'menu' });
          }}
        />
      </Html>
    </>
  );
}
