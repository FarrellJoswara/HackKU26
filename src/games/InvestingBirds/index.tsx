import { Html, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
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
  TextureLoader,
  Vector2,
} from 'three';
import { eventBus } from '@/core/events';
import type { GameProps } from '@/core/types';
import { initAudio, setAudioConfig } from './audio';
import { fitOrthographicToViewport, type OrthoDesignBounds } from './cameraFit';
import {
  allocationKey,
  CAMERA_DESIGN,
  categoryAccent,
  CATEGORY_META,
  COLORS,
  GAME_CONFIG,
  MATERIAL_META,
} from './config';
import { COMBO_WINDOW_SEC, getInitialRunState, runReducer } from './fsm';
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
  BlockMaterial,
  InvestingBirdsInput,
  InvestingBirdsOutput,
  LevelDef,
  LevelType,
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
  shotEndedAtSec: number | null;
  scoredBlocks: Set<string>;
  nextFloaterId: number;
  nextDamageId: number;
  nextDustId: number;
  slowMoUntilSec: number;
  prevBlockY: Map<string, number>;
  pullRatio: number;
  skipRoundEnd: boolean;
  /** Captured bounding box of the currently active tower — drives C1 camera fit and C3 label. */
  towerBounds: { minX: number; maxX: number; maxY: number } | null;
  /** If > 0, cinematic round intro is still playing — input disabled. */
  introUntilSec: number;
  /** Last-shot launch velocity for the woosh streak (M6). */
  lastLaunchAt: number | null;
  lastLaunchPos: Vector2 | null;
  lastLaunchDir: Vector2 | null;
  /** Camera pan (0..1) during round intro. */
  introT: number;
  /** For haptics throttling. */
  lastHapticAtSec: number;
  /** Per-block prev-rotation for M7 / PH8 visuals. */
  prevRot: Map<string, number>;
  /** Hover info: last pointed-at block id. */
  hoverBlockId: string | null;
  /** Hover info: screen-space coords of the last hover (for tooltip). */
  hoverScreenX: number;
  hoverScreenY: number;
  /** U5: keyboard requested a launch on the next frame. */
  pendingKeyboardLaunch: boolean;
  /** G14: elapsed-sec when the current resting bird was spawned. Used for the
   * hop-onto-pouch tween (0.3s). */
  birdSpawnedAtSec: number | null;
  /** PH15: hash of the blocks' discrete state to avoid dispatching SET_BLOCKS
   * when nothing meaningful has changed. */
  lastBlocksSig: number;
  lastBlocksDispatchAtSec: number;
  /** Elapsed-sec of the bird-launch that the current slow-mo was triggered
   * by. Used to fire slow-mo at most once per shot so a bird that threads two
   * towers doesn't chain multiple slow-mo windows into molasses. */
  slowMoFiredForLaunchAt: number | null;
}

/** Build a category-tinted stone-brick texture. */
function buildStoneTexture(tint: string): CanvasTexture {
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

  ctx.globalAlpha = 0.32;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;

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

function buildWoodTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b7864a';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#6b3410';
  ctx.lineWidth = 2;
  for (let y = 8; y < size; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y) * 3);
    for (let x = 0; x < size; x += 8) {
      ctx.lineTo(x, y + Math.sin((x + y) * 0.08) * 2.5);
    }
    ctx.stroke();
  }
  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function buildIceTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grd = ctx.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, '#d5efff');
  grd.addColorStop(1, '#9fd6ff');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 16; i += 1) {
    ctx.beginPath();
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40);
    ctx.stroke();
  }
  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function drawBirdFace(
  ctx: CanvasRenderingContext2D,
  size: number,
  bodyColor: string,
  darkColor: string,
  mood: 'idle' | 'pulled',
) {
  ctx.clearRect(0, 0, size, size);
  const body = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.12,
    size / 2,
    size / 2,
    size * 0.5,
  );
  body.addColorStop(0, bodyColor);
  body.addColorStop(1, darkColor);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1f2937';
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
  if (mood === 'pulled') {
    ctx.beginPath();
    ctx.ellipse(size * 0.56, size * 0.45, size * 0.045, size * 0.018, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(size * 0.76, size * 0.45, size * 0.04, size * 0.018, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(size * 0.46, size * 0.34);
    ctx.lineTo(size * 0.62, size * 0.38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.68, size * 0.34);
    ctx.lineTo(size * 0.82, size * 0.38);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(size * 0.56, size * 0.43, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size * 0.76, size * 0.43, size * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
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
}

function buildBirdTexture(type: LevelType, mood: 'idle' | 'pulled' = 'idle'): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const palette: Record<LevelType, { body: string; dark: string }> = {
    stocks: { body: '#ef4444', dark: '#7f1d1d' },
    etfs: { body: '#60a5fa', dark: '#1e3a8a' },
    bonds: { body: '#34d399', dark: '#14532d' },
    crypto: { body: '#fbbf24', dark: '#78350f' },
  };
  const p = palette[type];
  drawBirdFace(ctx, size, p.body, p.dark, mood);
  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Persist best score per allocation in localStorage. */
function loadBestScore(key: string): number | null {
  try {
    const v = window.localStorage.getItem(`ib.best.${key}`);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
function saveBestScore(key: string, score: number): void {
  try {
    window.localStorage.setItem(`ib.best.${key}`, String(Math.round(score)));
  } catch {
    /* noop */
  }
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
    nextDamageId: 1,
    nextDustId: 1,
    slowMoUntilSec: 0,
    prevBlockY: new Map(),
    pullRatio: 0,
    skipRoundEnd: false,
    towerBounds: null,
    introUntilSec: 0,
    lastLaunchAt: null,
    lastLaunchPos: null,
    lastLaunchDir: null,
    introT: 0,
    lastHapticAtSec: 0,
    prevRot: new Map(),
    hoverBlockId: null,
    hoverScreenX: 0,
    hoverScreenY: 0,
    pendingKeyboardLaunch: false,
    birdSpawnedAtSec: null,
    lastBlocksSig: 0,
    lastBlocksDispatchAtSec: 0,
    slowMoFiredForLaunchAt: null,
  });

  const frustumRef = useRef<OrthoDesignBounds>({
    left: CAMERA_DESIGN.left,
    right: CAMERA_DESIGN.right,
    bottom: CAMERA_DESIGN.bottom,
    top: CAMERA_DESIGN.top,
  });

  const shakeRef = useRef(0);
  const reduceMotionRef = useRef(false);
  const [cursorMode, setCursorMode] = useState<'default' | 'grab' | 'grabbing'>('default');
  const [hoverBlockInfo, setHoverBlockInfo] = useState<{
    id: string;
    hp: number;
    maxHp: number;
    material: BlockMaterial;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Reduced-motion binding to settings once they arrive from the pause menu.
  useEffect(() => {
    reduceMotionRef.current =
      state.settings.reducedMotion ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, [state.settings.reducedMotion]);

  // Audio bank lifecycle.
  useEffect(() => {
    const cleanup = initAudio({
      volume: state.settings.volume,
      musicOn: state.settings.musicOn,
    });
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setAudioConfig({ volume: state.settings.volume, musicOn: state.settings.musicOn });
  }, [state.settings.volume, state.settings.musicOn]);

  // Load best score when allocation changes and we enter PLAYING.
  useEffect(() => {
    if (state.state === 'INIT_LEVELS' || state.state === 'PLAYING') {
      const best = loadBestScore(allocationKey(state.allocation));
      if (best != null) dispatch({ type: 'SET_BEST_SCORE', payload: best });
    }
  }, [state.state, state.allocation]);

  // Persist best score on game end.
  useEffect(() => {
    if (state.state !== 'GAME_END') return;
    const key = allocationKey(state.allocation);
    const existing = loadBestScore(key);
    const score = Math.round(state.score);
    if (existing == null || score > existing) {
      saveBestScore(key, score);
      dispatch({ type: 'SET_BEST_SCORE', payload: score });
    }
  }, [state.state, state.score, state.allocation]);

  // Keyboard controls.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const st = stateRef.current;
      const sim = simRef.current;
      if (e.key === 'Escape') {
        if (st.state === 'PLAYING') {
          if (sim.aiming) {
            sim.aiming = false;
            sim.dragStart = null;
            sim.dragEnd = null;
            sim.pullRatio = 0;
            dispatch({ type: 'SET_DRAG', payload: { start: null, end: null } });
            return;
          }
          dispatch({ type: 'SET_PAUSED', payload: !st.paused });
        } else if (st.state === 'ROUND_END') {
          sim.skipRoundEnd = true;
        }
      } else if (e.code === 'Space' || e.key === ' ') {
        if (st.state === 'ROUND_END') {
          e.preventDefault();
          sim.skipRoundEnd = true;
        } else if (st.state === 'ALLOCATE') {
          e.preventDefault();
          if (
            st.allocation.stocks +
              st.allocation.etfs +
              st.allocation.bonds +
              st.allocation.crypto >
            0
          ) {
            dispatch({ type: 'START_GAME' });
          }
        } else if (st.state === 'PLAYING' && sim.bird && sim.bird.launched && !sim.bird.abilityUsed) {
          e.preventDefault();
          triggerBirdAbility();
        } else if (
          st.state === 'PLAYING' &&
          sim.bird &&
          !sim.bird.launched &&
          sim.aiming &&
          sim.dragStart &&
          sim.dragEnd
        ) {
          // U5: keyboard launch via Space when a pull is staged.
          const pull = sim.dragEnd.clone().sub(sim.dragStart);
          if (pull.length() >= GAME_CONFIG.minPullToLaunch) {
            e.preventDefault();
            sim.pendingKeyboardLaunch = true;
          }
        }
      } else if (
        st.state === 'PLAYING' &&
        sim.bird &&
        !sim.bird.launched &&
        (e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown')
      ) {
        // U5: arrow-key aim. Build a virtual drag vector from slingAnchor.
        e.preventDefault();
        if (!sim.aiming || !sim.dragStart || !sim.dragEnd) {
          sim.aiming = true;
          sim.dragStart = new Vector2(
            GAME_CONFIG.launchAnchor.x,
            GAME_CONFIG.launchAnchor.y,
          );
          sim.dragEnd = sim.dragStart.clone();
        }
        const step = e.shiftKey ? 0.35 : 0.15;
        if (e.key === 'ArrowLeft') sim.dragEnd.x -= step;
        if (e.key === 'ArrowRight') sim.dragEnd.x += step;
        if (e.key === 'ArrowUp') sim.dragEnd.y += step;
        if (e.key === 'ArrowDown') sim.dragEnd.y -= step;
        // Clamp to maxDrag ring relative to dragStart.
        const rel = sim.dragEnd.clone().sub(sim.dragStart);
        if (rel.length() > GAME_CONFIG.maxDrag * 1.1) {
          rel.setLength(GAME_CONFIG.maxDrag * 1.1);
          sim.dragEnd.copy(sim.dragStart).add(rel);
        }
        dispatch({
          type: 'SET_DRAG',
          payload: {
            start: sim.dragStart.clone(),
            end: sim.dragEnd.clone(),
          },
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { camera, size, scene, gl } = useThree();

  useLayoutEffect(() => {
    // Sky blue fallback behind the beach texture in case it's still loading.
    const bg = new Color('#C9E8F5');
    scene.background = bg;
    gl.setClearColor(bg, 1);
  }, [scene, gl]);

  const birdMeshRef = useRef<Mesh>(null);
  const pouchRef = useRef<Mesh>(null);
  const streakRef = useRef<Mesh>(null);
  const pullLineRef = useRef<Mesh>(null);
  const pullArrowRef = useRef<Mesh>(null);
  const aimHintRef = useRef<Group>(null);
  const dotsMeshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  // NOTE: we deliberately DON'T use drei's `useTexture` here — it throws a
  // Promise to suspend the component, which in turn unmounts the whole game
  // subtree until the image finishes loading. With our alpha-transparent
  // Canvas that shows as a black screen (the HTML body background), which
  // looks like the game is broken. `TextureLoader.load` returns immediately
  // with an empty Texture that gets populated in-place when the image is
  // ready, so the scene can render (with its sky-blue clear) on first frame.
  const beachTexture = useMemo(() => {
    const loader = new TextureLoader();
    return loader.load('/investingbirds/beach.png');
  }, []);
  const woodTexture = useMemo(() => buildWoodTexture(), []);
  const iceTexture = useMemo(() => buildIceTexture(), []);

  /** One tinted stone texture per category (M3). */
  const stoneTexturesByCategory = useMemo(() => {
    const m: Record<LevelType, CanvasTexture> = {
      stocks: buildStoneTexture(CATEGORY_META.stocks.accent),
      etfs: buildStoneTexture(CATEGORY_META.etfs.accent),
      bonds: buildStoneTexture(CATEGORY_META.bonds.accent),
      crypto: buildStoneTexture(CATEGORY_META.crypto.accent),
    };
    return m;
  }, []);

  const materialTextures: Record<BlockMaterial, CanvasTexture | null> = useMemo(
    () => ({ wood: woodTexture, ice: iceTexture, stone: null }),
    [woodTexture, iceTexture],
  );

  const birdTexturesByVariant = useMemo(() => {
    const m: Record<LevelType, CanvasTexture> = {
      stocks: buildBirdTexture('stocks', 'idle'),
      etfs: buildBirdTexture('etfs', 'idle'),
      bonds: buildBirdTexture('bonds', 'idle'),
      crypto: buildBirdTexture('crypto', 'idle'),
    };
    return m;
  }, []);
  const birdPulledTexturesByVariant = useMemo(() => {
    const m: Record<LevelType, CanvasTexture> = {
      stocks: buildBirdTexture('stocks', 'pulled'),
      etfs: buildBirdTexture('etfs', 'pulled'),
      bonds: buildBirdTexture('bonds', 'pulled'),
      crypto: buildBirdTexture('crypto', 'pulled'),
    };
    return m;
  }, []);

  // Four rubber-band segments (two behind, two in front of bird) — M5.
  const bandPositions = useMemo(() => new Float32Array(24), []);
  const bandGeometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(bandPositions, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, [bandPositions]);

  const pointerIdRef = useRef<number | null>(null);
  const pointerTargetRef = useRef<HTMLDivElement | null>(null);
  const pointerDownAtRef = useRef<{ x: number; y: number; t: number } | null>(null);

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

  // Reset sim ref when we enter ALLOCATE.
  useEffect(() => {
    if (state.state !== 'ALLOCATE') return;
    simRef.current = {
      ...simRef.current,
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
      slowMoUntilSec: 0,
      prevBlockY: new Map(),
      pullRatio: 0,
      skipRoundEnd: false,
      towerBounds: null,
      introUntilSec: 0,
      lastLaunchAt: null,
      lastLaunchPos: null,
      lastLaunchDir: null,
      introT: 0,
      prevRot: new Map(),
      hoverBlockId: null,
      hoverScreenX: 0,
      hoverScreenY: 0,
      pendingKeyboardLaunch: false,
      birdSpawnedAtSec: null,
      lastBlocksSig: 0,
      lastBlocksDispatchAtSec: 0,
      slowMoFiredForLaunchAt: null,
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
    const bird = createBird(level.type);
    const sim = simRef.current;
    sim.blocks = cloneBlocks(blocks);
    sim.bird = cloneBird(bird);
    sim.dragStart = null;
    sim.dragEnd = null;
    sim.aiming = false;
    sim.shotEndedAtSec = null;
    sim.accumulator = 0;
    sim.scoredBlocks = new Set();
    sim.birdSpawnedAtSec = sim.elapsedSec;
    // Compute tower bounds for C1 camera fit + C3 label.
    if (blocks.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const b of blocks) {
        const left = b.position.x - b.width / 2;
        const right = b.position.x + b.width / 2;
        const top = b.position.y + b.height / 2;
        if (left < minX) minX = left;
        if (right > maxX) maxX = right;
        if (top > maxY) maxY = top;
      }
      sim.towerBounds = { minX, maxX, maxY };
    }
    // Round intro pan (G10) — 1.2s. Gates pointer input.
    sim.introUntilSec = sim.elapsedSec + (sim.hasLaunchedOnce ? 0 : 1.2);
    sim.introT = 0;
    // Emit round-start telemetry (U26).
    eventBus.emit('game:event', {
      kind: 'progress',
      payload: {
        phase: 'round-start',
        round: state.currentLevelIndex + 1,
        type: level.type,
        multiplier: level.multiplier,
        birds: level.birds,
      } as unknown as InvestingBirdsOutput,
    });
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
      levelsCleared:
        state.outcome === 'win' ? state.levels.length : state.currentLevelIndex,
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

  /** Bird-variant ability (G1 / G2): one-shot per-launch. */
  function triggerBirdAbility(): void {
    const sim = simRef.current;
    const b = sim.bird;
    if (!b || !b.launched || b.abilityUsed) return;
    b.abilityUsed = true;
    switch (b.variant) {
      case 'stocks': {
        // Zigzag: flip horizontal velocity sign slightly.
        b.velocity.y += 4.2;
        b.velocity.x += (Math.random() > 0.5 ? 1 : -1) * 1.2;
        break;
      }
      case 'etfs': {
        // Speed boost — adds to current heading.
        const dir = b.velocity.clone().normalize();
        b.velocity.addScaledVector(dir, 5);
        break;
      }
      case 'bonds': {
        // Boulder: accelerate straight down.
        b.velocity.y -= 8;
        break;
      }
      case 'crypto': {
        // Detonate: radial impulse on nearby blocks.
        const radius = 2.2;
        for (const blk of sim.blocks) {
          if (blk.knockedOff) continue;
          const dx = blk.position.x - b.position.x;
          const dy = blk.position.y - b.position.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > radius * radius) continue;
          const d = Math.sqrt(Math.max(1e-3, d2));
          const f = (1 - d / radius) * 8;
          blk.velocity.x += (dx / d) * f;
          blk.velocity.y += (dy / d) * f + 2;
          blk.rotationVel += (Math.random() - 0.5) * 2;
          blk.falling = true;
          blk.awake = true;
          blk.health = Math.max(0, blk.health - 4);
        }
        // Bird itself stops.
        b.velocity.multiplyScalar(0.2);
        break;
      }
    }
    eventBus.emit('audio:play', { channel: 'sfx', id: 'tap' });
    if (!reduceMotionRef.current && 'vibrate' in navigator) {
      try { navigator.vibrate(14); } catch { /* noop */ }
    }
  }

  // Dynamic camera fit (C1): compute design frustum from slingshot + current tower.
  useFrame(() => {
    const sim = simRef.current;
    if (!(camera instanceof OrthoCam)) return;
    const margin = 2.0;
    let left = CAMERA_DESIGN.left;
    let right = CAMERA_DESIGN.right;
    let top = CAMERA_DESIGN.top;
    const bottom = CAMERA_DESIGN.bottom;
    if (sim.towerBounds) {
      left = Math.min(GAME_CONFIG.launchAnchor.x - margin, sim.towerBounds.minX - margin);
      right = Math.max(sim.towerBounds.maxX + margin, CAMERA_DESIGN.right);
      top = Math.max(CAMERA_DESIGN.top, sim.towerBounds.maxY + 2.2);
    } else {
      left = GAME_CONFIG.launchAnchor.x - margin;
      right = CAMERA_DESIGN.right;
      top = CAMERA_DESIGN.top;
    }
    fitOrthographicToViewport(camera, size.width, size.height, {
      left,
      right,
      bottom,
      top,
    });
    frustumRef.current = {
      left: camera.left,
      right: camera.right,
      bottom: camera.bottom,
      top: camera.top,
    };
  });

  // Main simulation loop.
  useFrame((_, dt) => {
    const sim = simRef.current;
    const st = stateRef.current;
    const reduceMotion = reduceMotionRef.current;

    if (st.paused) return;

    const inSlowMo = !reduceMotion && sim.slowMoUntilSec > sim.elapsedSec;
    const dtScale = inSlowMo ? 0.35 : 1.0;
    const scaledDt = dt * dtScale;
    sim.elapsedSec += scaledDt;

    // Live camera offset — re-read once per tick so every `worldToNdc` call
    // below this line agrees on the same shake/follow/pan state. Without this
    // the NDC values would lag behind the actual camera by the current offset
    // and HUD/floater positions would drift with the world.
    const camPos = { x: camera.position.x, y: camera.position.y };

    if (Math.floor(sim.elapsedSec * 4) !== Math.floor((sim.elapsedSec - scaledDt) * 4)) {
      dispatch({ type: 'PRUNE_FLOATERS', payload: { nowSec: sim.elapsedSec } });
    }

    // PH5: shared COMBO_WINDOW_SEC from fsm.ts.
    if (
      st.lastComboAtSec != null &&
      sim.elapsedSec - st.lastComboAtSec > COMBO_WINDOW_SEC &&
      st.combo > 0
    ) {
      dispatch({ type: 'COMBO_RESET' });
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
    const showBandsAt = (attach: Vector2) => {
      // Two back bands (z=0.45) + two front bands (z=0.65) — M5.
      setBand(0, leftPost.x, leftPost.y, 0.45, attach.x, attach.y, 0.45);
      setBand(1, rightPost.x, rightPost.y, 0.45, attach.x, attach.y, 0.45);
      setBand(2, leftPost.x, leftPost.y, 0.65, attach.x, attach.y, 0.65);
      setBand(3, rightPost.x, rightPost.y, 0.65, attach.x, attach.y, 0.65);
      bandAttr.needsUpdate = true;
      bandGeometry.setDrawRange(0, 8);
    };
    const hideBands = () => {
      bandGeometry.setDrawRange(0, 0);
    };

    if (st.state === 'ROUND_END') {
      hideBands();
      const readyFromTime =
        st.roundEndedAtSec != null &&
        sim.elapsedSec - st.roundEndedAtSec >= GAME_CONFIG.roundPauseSec;
      if (readyFromTime || sim.skipRoundEnd) {
        sim.skipRoundEnd = false;

        // Survived — the tower is still standing and we're out of birds. The
        // player must redo this level instead of advancing. Applies to the
        // last level too: you can only lose by quitting from the pause menu.
        if (st.roundOutcome === 'survived') {
          const payload = regenerateCurrentLevel();
          if (payload) {
            dispatch({
              type: 'RESET_LEVEL_SCORE',
              payload: { levelType: payload.levelType },
            });
            dispatch({ type: 'RETRY_ROUND' });
            dispatch({
              type: 'SET_ROUND',
              payload: {
                blocks: payload.blocks,
                bird: payload.bird,
                birdsForRound: payload.birdsForRound,
              },
            });
          }
          return;
        }

        const lastIndex = st.levels.length - 1;
        if (st.currentLevelIndex >= lastIndex) {
          const anyCleared =
            (st.scoreByType.stocks ?? 0) +
              (st.scoreByType.etfs ?? 0) +
              (st.scoreByType.bonds ?? 0) +
              (st.scoreByType.crypto ?? 0) >
            0;
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

    // Intro pan progress (0..1) — used to ease camera from tower to slingshot.
    if (sim.introUntilSec > sim.elapsedSec) {
      sim.introT = 1 - (sim.introUntilSec - sim.elapsedSec) / 1.2;
    } else {
      sim.introT = 1;
    }

    // U5: keyboard-requested launch — commit it here in the simulation.
    if (
      sim.pendingKeyboardLaunch &&
      sim.bird &&
      !sim.bird.launched &&
      sim.aiming &&
      sim.dragStart &&
      sim.dragEnd
    ) {
      sim.pendingKeyboardLaunch = false;
      const pull = sim.dragEnd.clone().sub(sim.dragStart);
      if (pull.length() >= GAME_CONFIG.minPullToLaunch) {
        const startPos = slingAnchor
          .clone()
          .add(
            pull
              .clone()
              .normalize()
              .multiplyScalar(Math.min(pull.length(), GAME_CONFIG.maxDrag) * 0.55),
          );
        const velocity = launchVelocity(sim.dragStart, sim.dragEnd);
        sim.bird = {
          ...sim.bird,
          position: startPos.clone(),
          launched: true,
          velocity,
          launchedAtSec: sim.elapsedSec,
          abilityUsed: false,
        };
        sim.lastLaunchAt = sim.elapsedSec;
        sim.lastLaunchPos = startPos.clone();
        sim.lastLaunchDir = velocity.clone().normalize();
        sim.hasLaunchedOnce = true;
        sim.aiming = false;
        sim.dragStart = null;
        sim.dragEnd = null;
        sim.slowMoFiredForLaunchAt = null;
        eventBus.emit('audio:play', { channel: 'sfx', id: 'release' });
        dispatch({ type: 'SET_DRAG', payload: { start: null, end: null } });
        dispatch({ type: 'SET_BIRD', payload: cloneBird(sim.bird) });
        dispatch({ type: 'CONSUME_BIRD' });
      }
    }

    // Aim preview / bird tension pose.
    if (!sim.bird.launched && sim.aiming && sim.dragStart && sim.dragEnd) {
      const pull = sim.dragEnd.clone().sub(sim.dragStart);
      const pullLen = pull.length();
      sim.pullRatio = Math.min(1, pullLen / GAME_CONFIG.maxDrag);
      if (pullLen >= GAME_CONFIG.minPullToAim * 1.4) {
        const vel = launchVelocity(sim.dragStart, sim.dragEnd);
        // PH12: preview starts from the same position the launch will start.
        const startPos = slingAnchor
          .clone()
          .add(
            pull
              .clone()
              .normalize()
              .multiplyScalar(Math.min(pullLen, GAME_CONFIG.maxDrag) * 0.55),
          );
        // U20: cut trajectory at the first standing block.
        let stopX: number | undefined;
        for (const b of sim.blocks) {
          if (b.knockedOff || b.toppled) continue;
          const left = b.position.x - b.width / 2;
          if (left > startPos.x && (stopX === undefined || left < stopX)) {
            stopX = left;
          }
        }
        const dots = sampleTrajectoryDots(startPos, vel, { stopX });
        const mesh = dotsMeshRef.current;
        if (mesh) {
          const max = Math.min(dots.length, GAME_CONFIG.trajectoryMaxDots);
          for (let i = 0; i < max; i += 1) {
            const fade = max > 1 ? i / (max - 1) : 1;
            // P5: alternating-size dots; every third is larger.
            const sizeMul = i % 3 === 0 ? 1.25 : 0.85;
            dummy.scale.setScalar((0.32 + 0.5 * fade) * sizeMul);
            dummy.position.set(dots[i]!.x, dots[i]!.y, 0.6);
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
          // M4: tilt toward the target slightly.
          birdMeshRef.current.rotation.z = -sim.pullRatio * 0.2;
          // Swap to the "squinting" pulled texture.
          const mat = (birdMeshRef.current as Mesh).material as MeshBasicMaterial;
          if (mat && mat.map !== birdPulledTexturesByVariant[level.type]) {
            mat.map = birdPulledTexturesByVariant[level.type];
            mat.needsUpdate = true;
          }
        }
        if (pouchRef.current)
          pouchRef.current.position.set(startPos.x, startPos.y, 0.5);
        showBandsAt(startPos);
        sim.bird.position.set(startPos.x, startPos.y);
        // U27: pull indicator line from sling to bird with rotating arrow.
        const dx = startPos.x - slingAnchor.x;
        const dy = startPos.y - slingAnchor.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (pullLineRef.current) {
          pullLineRef.current.visible = len > 0.1;
          pullLineRef.current.position.set(
            (startPos.x + slingAnchor.x) / 2,
            (startPos.y + slingAnchor.y) / 2,
            0.48,
          );
          pullLineRef.current.rotation.z = Math.atan2(dy, dx);
          pullLineRef.current.scale.set(len, 0.04, 1);
          const m = pullLineRef.current.material as MeshBasicMaterial;
          if (m) m.opacity = 0.35 + sim.pullRatio * 0.4;
        }
        if (pullArrowRef.current) {
          pullArrowRef.current.visible = len > 0.2;
          // Arrow pointing along the launch direction (opposite to pull).
          const launchAngle = Math.atan2(-dy, -dx);
          pullArrowRef.current.position.set(
            startPos.x + Math.cos(launchAngle) * 0.55,
            startPos.y + Math.sin(launchAngle) * 0.55,
            0.58,
          );
          // Cone's default tip is +Y, so subtract PI/2 to align with +X axis.
          pullArrowRef.current.rotation.z = launchAngle - Math.PI / 2;
        }
      } else {
        if (dotsMeshRef.current) dotsMeshRef.current.count = 0;
        if (birdMeshRef.current) {
          birdMeshRef.current.position.set(slingAnchor.x, slingAnchor.y, 0.55);
          birdMeshRef.current.scale.set(1, 1, 1);
          birdMeshRef.current.rotation.z = 0;
        }
        if (pouchRef.current)
          pouchRef.current.position.set(slingAnchor.x, slingAnchor.y, 0.5);
        showBandsAt(slingAnchor);
        sim.bird.position.set(slingAnchor.x, slingAnchor.y);
        if (pullLineRef.current) pullLineRef.current.visible = false;
        if (pullArrowRef.current) pullArrowRef.current.visible = false;
      }
    } else {
      sim.pullRatio = 0;
      if (dotsMeshRef.current) dotsMeshRef.current.count = 0;
      if (!sim.bird.launched) {
        // G14: hop-onto-pouch tween (0.3s) when a bird is freshly spawned.
        // Tween origin is the HUD queue location in world coords (top-left of
        // the frustum, slightly below the top bar). Ease-out.
        const spawnAge =
          sim.birdSpawnedAtSec != null ? sim.elapsedSec - sim.birdSpawnedAtSec : 999;
        const hopDur = 0.32;
        const hopping = spawnAge >= 0 && spawnAge < hopDur;
        const tRaw = hopping ? Math.max(0, Math.min(1, spawnAge / hopDur)) : 1;
        const t = 1 - Math.pow(1 - tRaw, 2.2);
        const hopStart = {
          x: frustumRef.current.left + 1.4,
          y: frustumRef.current.top - 1.6,
        };
        const renderX = hopping
          ? hopStart.x + (slingAnchor.x - hopStart.x) * t
          : slingAnchor.x;
        // Arc the vertical — peak above the sling at t=0.5 by about 1.2 units.
        const arc = hopping ? Math.sin(tRaw * Math.PI) * 1.1 : 0;
        const renderY = hopping
          ? hopStart.y + (slingAnchor.y - hopStart.y) * t + arc
          : slingAnchor.y;
        if (birdMeshRef.current) {
          // U19: gentle breathing idle (disabled while hopping).
          const breathe = hopping
            ? 1
            : 1 + Math.sin(sim.elapsedSec * 2.4) * 0.035;
          birdMeshRef.current.position.set(renderX, renderY, 0.55);
          birdMeshRef.current.scale.set(breathe, breathe, 1);
          birdMeshRef.current.rotation.z = hopping ? (1 - tRaw) * 0.6 : 0;
          const mat = (birdMeshRef.current as Mesh).material as MeshBasicMaterial;
          if (mat && mat.map !== birdTexturesByVariant[level.type]) {
            mat.map = birdTexturesByVariant[level.type];
            mat.needsUpdate = true;
          }
        }
        if (pouchRef.current)
          pouchRef.current.position.set(slingAnchor.x, slingAnchor.y, 0.5);
        showBandsAt(slingAnchor);
        sim.bird.position.set(slingAnchor.x, slingAnchor.y);
        if (pullLineRef.current) pullLineRef.current.visible = false;
        if (pullArrowRef.current) pullArrowRef.current.visible = false;
      } else {
        hideBands();
        if (pullLineRef.current) pullLineRef.current.visible = false;
        if (pullArrowRef.current) pullArrowRef.current.visible = false;
      }
    }

    // Advance physics. We clamp the incoming dt BEFORE adding to the
    // accumulator — a slow frame (e.g. tab refocus) used to dump hundreds of
    // ms into the accumulator and then either stall inside `maxSteps` or
    // produce a single massive step that tunneled the bird through the floor.
    if (sim.bird.launched || sim.blocks.some((b) => b.falling || !b.knockedOff)) {
      const clampedDt = Math.min(scaledDt, GAME_CONFIG.fixedStep * 12);
      sim.accumulator += clampedDt;
      const maxSteps = 12;
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

          // Global bird-velocity cap. Collision response is already clamped
          // per-hit in `resolveCollisions`, but pair-wise block collisions,
          // chain transfers, and TNT blasts can still nudge the bird above
          // the cap between steps. One hard clamp here keeps the simulation
          // deterministic and prevents the runaway-speed tunneling we saw.
          {
            const v = sim.bird.velocity;
            const speed = v.length();
            if (speed > GAME_CONFIG.maxBirdSpeed && speed > 1e-5) {
              v.multiplyScalar(GAME_CONFIG.maxBirdSpeed / speed);
            }
          }

          for (const hit of collision.hits) {
            shakeRef.current = Math.min(
              0.32,
              shakeRef.current + Math.max(0.012, hit.impactForce * 0.003),
            );
            const ndc = worldToNdc(hit.contact.x, hit.contact.y, frustumRef.current, camPos);
            dispatch({
              type: 'PUSH_DAMAGE',
              payload: {
                id: sim.nextDamageId++,
                delta: Math.round(hit.impactForce),
                atSec: sim.elapsedSec,
                ndcX: ndc.x,
                ndcY: Math.max(-0.85, Math.min(0.85, ndc.y)),
              },
            });
            // P13: multiple tinted dust puffs with outward velocity.
            const puffCount = hit.heavy ? 4 : 2;
            const hitBlock = sim.blocks.find((b) => b.id === hit.blockId);
            const dustTint = hitBlock ? categoryAccent(hitBlock.type) : '#d8d1c4';
            for (let i = 0; i < puffCount; i += 1) {
              const offX = (Math.random() - 0.5) * 0.08;
              const offY = (Math.random() - 0.5) * 0.08;
              dispatch({
                type: 'PUSH_DUST',
                payload: {
                  id: sim.nextDustId++,
                  atSec: sim.elapsedSec,
                  ndcX: ndc.x + offX,
                  ndcY: Math.max(-0.9, Math.min(0.9, ndc.y + offY)),
                  size: 0.45 + Math.min(0.6, hit.impactForce * 0.028) + Math.random() * 0.15,
                  tint: dustTint,
                },
              });
            }

            if (hit.heavy) {
              dispatch({ type: 'HEAVY_HIT', payload: { atSec: sim.elapsedSec } });
              // Slow-mo fires at most once per shot — chained heavy hits on
              // the same flight used to re-arm the 0.28s window every impact
              // which made the bird feel like it was "sticking" in molasses.
              const thisLaunch = sim.lastLaunchAt ?? sim.elapsedSec;
              const alreadyFired =
                sim.slowMoFiredForLaunchAt != null &&
                Math.abs(sim.slowMoFiredForLaunchAt - thisLaunch) < 1e-4;
              if (!reduceMotion && !alreadyFired) {
                sim.slowMoUntilSec = sim.elapsedSec + 0.28;
                sim.slowMoFiredForLaunchAt = thisLaunch;
              }
              // G18: haptics on heavy hits.
              if (!reduceMotion && 'vibrate' in navigator) {
                const last = sim.lastHapticAtSec;
                if (sim.elapsedSec - last > 0.15) {
                  sim.lastHapticAtSec = sim.elapsedSec;
                  try { navigator.vibrate(24); } catch { /* noop */ }
                }
              }
            }

            eventBus.emit('audio:play', {
              channel: 'sfx',
              id: hit.shatter ? 'break' : hit.heavy ? 'hit-heavy' : 'hit-light',
            });
          }
        }

        // Ground-impact dust.
        for (const b of sim.blocks) {
          if (b.knockedOff) continue;
          const prevY = sim.prevBlockY.get(b.id);
          const halfH = b.height / 2;
          const onGround = b.position.y - halfH <= 0.02;
          const wasAbove = prevY != null && prevY - halfH > 0.12;
          if (b.falling && onGround && wasAbove && b.velocity.length() > 1.5) {
            const ndc = worldToNdc(b.position.x, b.position.y, frustumRef.current, camPos);
            dispatch({
              type: 'PUSH_DUST',
              payload: {
                id: sim.nextDustId++,
                atSec: sim.elapsedSec,
                ndcX: ndc.x,
                ndcY: Math.max(-0.9, Math.min(0.9, ndc.y)),
                size: 0.5 + Math.random() * 0.3,
                tint: categoryAccent(b.type),
              },
            });
            eventBus.emit('audio:play', { channel: 'sfx', id: 'ground' });
          }
          sim.prevBlockY.set(b.id, b.position.y);
        }

        sim.blocks = stepBlocks(sim.blocks, GAME_CONFIG.fixedStep);

        // Award score for off-stage OR toppled blocks (C8).
        for (const b of sim.blocks) {
          if (b.scored) continue;
          const offStage =
            b.position.y < GAME_CONFIG.killFloorY ||
            b.position.x < GAME_CONFIG.worldBounds.minX ||
            b.position.x > GAME_CONFIG.worldBounds.maxX;
          if (offStage) {
            b.knockedOff = true;
          }
          const cleared = offStage || b.toppled || b.shattered;
          if (!cleared) continue;
          b.scored = true;
          if (sim.scoredBlocks.has(b.id)) continue;
          sim.scoredBlocks.add(b.id);
          dispatch({ type: 'COMBO_TICK', payload: { atSec: sim.elapsedSec } });
          const comboMul =
            1 + Math.min(4, Math.max(0, stateRef.current.combo)) * 0.25;
          const delta = Math.round(
            GAME_CONFIG.scorePerBlockKnockedOff * level.multiplier * comboMul,
          );
          dispatch({
            type: 'UPDATE_SCORE',
            payload: { delta, levelType: level.type },
          });
          const ndc = worldToNdc(b.position.x, b.position.y + b.height / 2, frustumRef.current, camPos);
          dispatch({
            type: 'PUSH_FLOATER',
            payload: {
              id: sim.nextFloaterId++,
              delta,
              atSec: sim.elapsedSec,
              ndcX: ndc.x,
              ndcY: Math.max(-0.6, Math.min(0.8, ndc.y)),
              levelType: level.type,
            },
          });
          eventBus.emit('audio:play', { channel: 'sfx', id: 'break' });
          // G4: +500 bonus if this was the tower's target block.
          if (b.isTarget) {
            const bonus = Math.round(500 * level.multiplier);
            dispatch({
              type: 'UPDATE_SCORE',
              payload: { delta: bonus, levelType: level.type },
            });
            dispatch({
              type: 'PUSH_FLOATER',
              payload: {
                id: sim.nextFloaterId++,
                delta: bonus,
                atSec: sim.elapsedSec + 0.05,
                ndcX: ndc.x,
                ndcY: Math.max(-0.55, Math.min(0.85, ndc.y + 0.06)),
                levelType: level.type,
              },
            });
            eventBus.emit('audio:play', { channel: 'sfx', id: 'clear' });
          }
        }
      }
    }

    sim.blocks = updateBlockVisuals(sim.blocks, dt);
    // PH15: dispatch SET_BLOCKS only when counts/states change (knockedOff,
    // toppled, shattered, falling, cracked) or every 120ms at most. Visual
    // position/rotation is driven imperatively by the render below so we don't
    // pay for a React reconciliation every frame.
    {
      let sig = 0;
      for (const b of sim.blocks) {
        sig =
          (sig * 31 +
            (b.knockedOff ? 1 : 0) +
            (b.toppled ? 2 : 0) +
            (b.shattered ? 4 : 0) +
            (b.falling ? 8 : 0) +
            (b.cracked ? 16 : 0)) |
          0;
      }
      if (
        sig !== sim.lastBlocksSig ||
        sim.elapsedSec - sim.lastBlocksDispatchAtSec >= 0.12
      ) {
        dispatch({ type: 'SET_BLOCKS', payload: cloneBlocks(sim.blocks) });
        sim.lastBlocksSig = sig;
        sim.lastBlocksDispatchAtSec = sim.elapsedSec;
      }
    }
    if (sim.bird.launched) {
      dispatch({ type: 'SET_BIRD', payload: cloneBird(sim.bird) });
    }
    dispatch({ type: 'SET_ELAPSED', payload: sim.elapsedSec });

    if (birdMeshRef.current && sim.bird && sim.bird.launched) {
      birdMeshRef.current.position.set(sim.bird.position.x, sim.bird.position.y, 0.55);
      birdMeshRef.current.scale.set(1, 1, 1);
      birdMeshRef.current.rotation.z =
        Math.atan2(sim.bird.velocity.y, sim.bird.velocity.x) * 0.5;
    }

    // Launch streak (M6): visible for 0.35s after launch.
    if (streakRef.current) {
      const streak = streakRef.current;
      if (sim.bird.launched && sim.lastLaunchAt != null) {
        const age = sim.elapsedSec - sim.lastLaunchAt;
        if (age >= 0 && age <= GAME_CONFIG.launchStreakSec) {
          const opacity = 1 - age / GAME_CONFIG.launchStreakSec;
          streak.position.set(
            (sim.bird.position.x + (sim.lastLaunchPos?.x ?? sim.bird.position.x)) / 2,
            (sim.bird.position.y + (sim.lastLaunchPos?.y ?? sim.bird.position.y)) / 2,
            0.5,
          );
          const dx = sim.bird.position.x - (sim.lastLaunchPos?.x ?? 0);
          const dy = sim.bird.position.y - (sim.lastLaunchPos?.y ?? 0);
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

    // Win/round-end: counts toppled+knockedOff+shattered as cleared (C8).
    const aliveBlocks = sim.blocks.filter(
      (b) => !b.knockedOff && !b.toppled && !b.shattered,
    );
    const allCleared = aliveBlocks.length === 0 && sim.blocks.length > 0;

    if (allCleared) {
      dispatch({
        type: 'ROUND_END',
        payload: { outcome: 'cleared', endedAtSec: sim.elapsedSec },
      });
      // Birds-saved bonus + tighter perfect threshold (P9).
      const bonus = Math.round(st.birdsRemaining * 50 * level.multiplier);
      if (bonus > 0) {
        dispatch({
          type: 'UPDATE_SCORE',
          payload: { delta: bonus, levelType: level.type },
        });
      }
      const perfect =
        st.birdsRemaining >= Math.ceil(st.birdsForRound * 0.66);
      if (perfect) {
        dispatch({
          type: 'UPDATE_SCORE',
          payload: { delta: 500, levelType: level.type },
        });
      }
      eventBus.emit('audio:play', { channel: 'sfx', id: 'clear' });
      // U26: round-cleared telemetry.
      eventBus.emit('game:event', {
        kind: 'progress',
        payload: {
          phase: 'round-end',
          outcome: 'cleared',
          round: stateRef.current.currentLevelIndex + 1,
          type: level.type,
          birdsUsed: stateRef.current.birdsForRound - stateRef.current.birdsRemaining,
          score: stateRef.current.score,
        } as unknown as InvestingBirdsOutput,
      });
      return;
    }

    if (sim.bird.launched && sim.bird.active) {
      const onGround = sim.bird.position.y - sim.bird.radius <= 0.02;
      const groundRestOver =
        onGround && sim.bird.velocity.length() < GAME_CONFIG.settleSpeedEpsilon &&
        sim.bird.settledMs >= GAME_CONFIG.groundRestSec * 1000;
      const shotEnded =
        sim.bird.settledMs >= GAME_CONFIG.settleWindowMs ||
        isBirdOutOfBounds(sim.bird) ||
        groundRestOver;
      if (shotEnded) {
        sim.bird.active = false;
        sim.shotEndedAtSec = sim.elapsedSec;
      }
    }

    if (
      sim.shotEndedAtSec != null &&
      sim.elapsedSec - sim.shotEndedAtSec >= GAME_CONFIG.respawnDelaySec
    ) {
      if (st.birdsRemaining > 0) {
        sim.bird = createBird(level.type);
        sim.shotEndedAtSec = null;
        sim.birdSpawnedAtSec = sim.elapsedSec;
        dispatch({ type: 'SET_BIRD', payload: cloneBird(sim.bird) });
      } else if (sim.blocks.every((b) => !b.falling || b.knockedOff)) {
        const anyAlive = sim.blocks.some(
          (b) => !b.knockedOff && !b.toppled && !b.shattered,
        );
        dispatch({
          type: 'ROUND_END',
          payload: {
            outcome: anyAlive ? 'survived' : 'cleared',
            endedAtSec: sim.elapsedSec,
          },
        });
        eventBus.emit('game:event', {
          kind: 'progress',
          payload: {
            phase: 'round-end',
            outcome: anyAlive ? 'survived' : 'cleared',
            round: stateRef.current.currentLevelIndex + 1,
            type: level.type,
            birdsUsed: stateRef.current.birdsForRound - stateRef.current.birdsRemaining,
            score: stateRef.current.score,
          } as unknown as InvestingBirdsOutput,
        });
      }
    }
  });

  // Camera shake + bird-follow + intro pan.
  const camFollowRef = useRef(0);
  useFrame((_, dt) => {
    shakeRef.current *= Math.exp(-dt * 15);
    if (!(camera instanceof OrthoCam)) return;
    const sim = simRef.current;
    const reduce = reduceMotionRef.current;
    const s = reduce ? 0 : shakeRef.current;

    // Intro pan: swing briefly from tower center to slingshot for first launch (G10).
    let introPan = 0;
    if (!reduce && sim.introUntilSec > sim.elapsedSec && sim.towerBounds) {
      const cx = (sim.towerBounds.minX + sim.towerBounds.maxX) / 2;
      const slingX = GAME_CONFIG.launchAnchor.x;
      // Ease: start at tower, end at sling.
      const t = Math.min(1, Math.max(0, sim.introT));
      const eased = 1 - Math.pow(1 - t, 3);
      introPan = (cx - slingX) * (1 - eased) * 0.4;
    }

    let targetX = 0;
    let targetY = 0;
    if (!reduce && sim.bird && sim.bird.launched && sim.bird.active) {
      const bx = sim.bird.position.x;
      const rawOffset = bx - GAME_CONFIG.launchAnchor.x - 2;
      targetX = Math.max(-1.5, Math.min(8, rawOffset)) * 0.35;
      const by = sim.bird.position.y;
      targetY = Math.max(-0.5, Math.min(3, (by - 2) * 0.12));
    }
    const followSpeed = 2.6;
    camFollowRef.current =
      camFollowRef.current + (targetX - camFollowRef.current) * Math.min(1, dt * followSpeed);
    const followY =
      camFollowRef.current !== 0 || targetY !== 0 ? targetY : 0;

    camera.position.set(
      camFollowRef.current +
        introPan +
        (s > 1e-4 ? Math.sin(sim.elapsedSec * 92) * 0.45 * s : 0),
      followY + (s > 1e-4 ? Math.cos(sim.elapsedSec * 71) * 0.35 * s : 0),
      CAMERA_DESIGN.z,
    );
  });

  /** Return true if we should accept a pull gesture given the pointer world position. */
  function isInPullZone(world: Vector2): boolean {
    // U1: scale pull zone up a bit on narrow screens.
    const aspect = size.width / Math.max(1, size.height);
    const base = aspect < 1 ? 4.2 : 3.2;
    return world.distanceTo(slingAnchor) <= base;
  }

  const onPointerDown = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const st = stateRef.current;
    if (st.state !== 'PLAYING' || st.paused) return;
    const sim = simRef.current;
    const bird = sim.bird;
    if (!bird) return;
    const x = (ev.clientX / window.innerWidth) * 2 - 1;
    const y = -(ev.clientY / window.innerHeight) * 2 + 1;
    const world = toWorldPoint(x, y, frustumRef.current);
    pointerDownAtRef.current = { x: ev.clientX, y: ev.clientY, t: sim.elapsedSec };

    // G2: tap-in-air ability trigger.
    if (bird.launched && bird.active && !bird.abilityUsed) {
      triggerBirdAbility();
      ev.preventDefault();
      return;
    }

    if (bird.launched || !bird.active || st.birdsRemaining <= 0) return;
    if (!isInPullZone(world)) return;
    if (sim.introUntilSec > sim.elapsedSec) return;

    pointerIdRef.current = ev.pointerId;
    pointerTargetRef.current = ev.currentTarget;
    ev.currentTarget.setPointerCapture(ev.pointerId);

    sim.dragStart = slingAnchor.clone();
    sim.dragEnd = world;
    sim.aiming = true;
    setCursorMode('grabbing');
    eventBus.emit('audio:play', { channel: 'sfx', id: 'pull' });
    dispatch({ type: 'SET_DRAG', payload: { start: sim.dragStart, end: world } });
  };

  const onPointerMove = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const st = stateRef.current;
    const sim = simRef.current;
    // Cursor management (U4).
    if (st.state === 'PLAYING' && !st.paused && !sim.aiming && sim.bird && !sim.bird.launched) {
      const x = (ev.clientX / window.innerWidth) * 2 - 1;
      const y = -(ev.clientY / window.innerHeight) * 2 + 1;
      const world = toWorldPoint(x, y, frustumRef.current);
      const next = isInPullZone(world) ? 'grab' : 'default';
      if (cursorMode !== next && cursorMode !== 'grabbing') setCursorMode(next);
    }
    // G15 / U21: block hover tooltip while not aiming.
    if (
      st.state === 'PLAYING' &&
      !st.paused &&
      !sim.aiming &&
      ev.pointerType === 'mouse'
    ) {
      const x = (ev.clientX / window.innerWidth) * 2 - 1;
      const y = -(ev.clientY / window.innerHeight) * 2 + 1;
      const world = toWorldPoint(x, y, frustumRef.current);
      let found: Block | null = null;
      for (const b of sim.blocks) {
        if (b.knockedOff || b.shattered) continue;
        const dx = Math.abs(world.x - b.position.x);
        const dy = Math.abs(world.y - b.position.y);
        if (dx <= b.width / 2 + 0.05 && dy <= b.height / 2 + 0.05) {
          found = b;
          break;
        }
      }
      if (found) {
        if (hoverBlockInfo?.id !== found.id) {
          setHoverBlockInfo({
            id: found.id,
            hp: found.health,
            maxHp: found.maxHealth,
            material: found.material,
            x: ev.clientX,
            y: ev.clientY,
          });
        } else if (hoverBlockInfo) {
          sim.hoverScreenX = ev.clientX;
          sim.hoverScreenY = ev.clientY;
        }
      } else if (hoverBlockInfo) {
        setHoverBlockInfo(null);
      }
    }
    if (!sim.aiming || !sim.dragStart || st.state !== 'PLAYING' || st.paused) return;
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
    setCursorMode('default');
    if (pointerTargetRef.current && pointerIdRef.current != null) {
      try {
        pointerTargetRef.current.releasePointerCapture(pointerIdRef.current);
      } catch {
        /* noop */
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

    // PH12: launch from the pulled position (same as preview origin).
    const startPos = slingAnchor
      .clone()
      .add(pull.clone().normalize().multiplyScalar(Math.min(pull.length(), GAME_CONFIG.maxDrag) * 0.55));
    const velocity = launchVelocity(sim.dragStart, sim.dragEnd);
    sim.bird = {
      ...bird,
      position: startPos.clone(),
      launched: true,
      velocity,
      launchedAtSec: sim.elapsedSec,
      abilityUsed: false,
    };
    sim.lastLaunchAt = sim.elapsedSec;
    sim.lastLaunchPos = startPos.clone();
    sim.lastLaunchDir = velocity.clone().normalize();
    sim.hasLaunchedOnce = true;
    sim.aiming = false;
    sim.dragStart = null;
    sim.dragEnd = null;
    sim.slowMoFiredForLaunchAt = null;
    eventBus.emit('audio:play', { channel: 'sfx', id: 'release' });
    if (!reduceMotionRef.current && 'vibrate' in navigator) {
      try { navigator.vibrate(18); } catch { /* noop */ }
    }
    // U26: per-launch telemetry.
    eventBus.emit('game:event', {
      kind: 'progress',
      payload: {
        phase: 'launch',
        round: stateRef.current.currentLevelIndex + 1,
        type: stateRef.current.levels[stateRef.current.currentLevelIndex]?.type,
        power: Math.min(1, pull.length() / GAME_CONFIG.maxDrag),
        angle: Math.atan2(velocity.y, velocity.x),
      } as unknown as InvestingBirdsOutput,
    });
    dispatch({ type: 'SET_DRAG', payload: { start: null, end: null } });
    dispatch({ type: 'SET_BIRD', payload: cloneBird(sim.bird) });
    dispatch({ type: 'CONSUME_BIRD' });
    ev.preventDefault();
  };

  /**
   * Regenerates blocks + bird for the current level and resets all sim
   * bookkeeping. Shared between the manual retry button, the space-bar
   * shortcut, and the survived-round auto-retry path so every code path
   * performs the same teardown.
   */
  const regenerateCurrentLevel = () => {
    const sim = simRef.current;
    const level = stateRef.current.levels[stateRef.current.currentLevelIndex];
    if (!level) return null;
    const blocks = generateBlocksForLevel(level);
    const bird = createBird(level.type);
    sim.blocks = cloneBlocks(blocks);
    sim.bird = cloneBird(bird);
    sim.dragStart = null;
    sim.dragEnd = null;
    sim.aiming = false;
    sim.shotEndedAtSec = null;
    sim.accumulator = 0;
    sim.scoredBlocks = new Set();
    sim.prevBlockY = new Map();
    sim.slowMoUntilSec = 0;
    sim.birdSpawnedAtSec = sim.elapsedSec;
    sim.introUntilSec = sim.elapsedSec + 1.0;
    return { blocks, bird, birdsForRound: level.birds, levelType: level.type };
  };

  const onRetryRound = () => {
    const payload = regenerateCurrentLevel();
    if (!payload) return;
    dispatch({
      type: 'RESET_LEVEL_SCORE',
      payload: { levelType: payload.levelType },
    });
    dispatch({ type: 'RETRY_ROUND' });
    dispatch({
      type: 'SET_ROUND',
      payload: {
        blocks: payload.blocks,
        bird: payload.bird,
        birdsForRound: payload.birdsForRound,
      },
    });
  };

  const visibleBlocks = useMemo(
    () => state.blocks.filter((b) => b.opacity > 0.01),
    [state.blocks],
  );

  // Standing blocks only — used for C3 tower label.
  const standingBlocks = useMemo(
    () => state.blocks.filter((b) => !b.knockedOff && !b.toppled && !b.shattered && b.position.y > 0.15),
    [state.blocks],
  );
  const towerInitialTopY = simRef.current.towerBounds?.maxY ?? 6;
  const towerLabelPos = useMemo(() => {
    if (standingBlocks.length === 0) return null;
    let sumX = 0;
    let maxTop = -Infinity;
    for (const b of standingBlocks) {
      sumX += b.position.x;
      const top = b.position.y + b.height / 2;
      if (top > maxTop) maxTop = top;
    }
    const avgX = sumX / standingBlocks.length;
    const y = Math.min(maxTop + 1.1, towerInitialTopY + 1.3);
    return { x: avgX, y };
  }, [standingBlocks, towerInitialTopY]);

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

      {/* Beach background — single full-bleed textured plane at slightly
          reduced opacity so foreground gameplay pops. Drawn before anything
          else so its depth sits behind all gameplay layers. */}
      <mesh position={[2, 4, -5]} renderOrder={-1}>
        <planeGeometry args={[48, 30]} />
        <meshBasicMaterial
          map={beachTexture}
          transparent
          opacity={0.75}
          depthWrite={false}
        />
      </mesh>

      {/* Sandy floor band — keeps the bird/blocks visually grounded at y=0. */}
      <mesh position={[0, -0.35, -0.6]}>
        <planeGeometry args={[120, 0.7]} />
        <meshBasicMaterial color="#e8d9a8" transparent opacity={0.55} />
      </mesh>

      {/* Slingshot */}
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

      {/* Rubber bands (4 segments: 2 back + 2 front) */}
      <lineSegments geometry={bandGeometry}>
        <lineBasicMaterial color={COLORS.slingBand} linewidth={2} />
      </lineSegments>

      {/* Pouch */}
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
          <meshBasicMaterial
            map={birdTexturesByVariant[state.currentBird.variant]}
            transparent
          />
        </mesh>
      ) : null}

      {/* Launch streak (M6) */}
      <mesh ref={streakRef} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.0} depthWrite={false} />
      </mesh>

      {/* U27: pull indicator line (sling -> bird) */}
      <mesh ref={pullLineRef} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>
      {/* U27: rotating arrow head */}
      <mesh ref={pullArrowRef} visible={false}>
        <coneGeometry args={[0.16, 0.32, 3]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthWrite={false} />
      </mesh>

      {/* Aim hint arrow (G9 / U2) */}
      {state.state === 'PLAYING' &&
      !simRef.current.hasLaunchedOnce &&
      state.currentBird &&
      !state.currentBird.launched ? (
        <group
          ref={aimHintRef}
          position={[slingAnchor.x - 1.6, slingAnchor.y - 0.1, 0.62]}
        >
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

      {/* Trajectory preview dots */}
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
      {visibleBlocks.map((b) => {
        // PH14: heavier blocks render slightly wider + taller so players can
        // see that they're dense. Scale factor keyed on mass (~0.6..1.6).
        const massScale = Math.max(0.92, Math.min(1.12, 0.85 + b.mass * 0.18));
        const pulseS = 1 + b.damagePulse;
        return (
        <group
          key={b.id}
          position={[b.position.x, b.position.y, 0.3]}
          rotation={[0, 0, b.rotation]}
          scale={[massScale * pulseS, massScale * pulseS, 1]}
        >
          {/* Shadow face */}
          <mesh position={[0.03, -0.05, -0.01]}>
            <boxGeometry args={[b.width, b.height, 0.02]} />
            <meshBasicMaterial color={COLORS.stoneDark} transparent opacity={b.opacity * 0.85} />
          </mesh>
          {/* Main face — texture depends on material (M3 / G3). TNT overrides colour. */}
          <mesh>
            <boxGeometry args={[b.width, b.height, 0.4]} />
            <meshStandardMaterial
              map={materialTextures[b.material] ?? stoneTexturesByCategory[b.type]}
              color={
                b.hitFlashMs > 0
                  ? COLORS.hitFlash
                  : b.isTnt
                  ? '#991b1b'
                  : MATERIAL_META[b.material].tint
              }
              transparent
              opacity={b.opacity}
              roughness={b.material === 'ice' ? 0.35 : 0.85}
              metalness={b.material === 'ice' ? 0.15 : 0.02}
            />
          </mesh>
          {/* G5: TNT label — renders "TNT" on the front face in bright yellow. */}
          {b.isTnt && !b.shattered && !b.knockedOff ? (
            <>
              <mesh position={[0, 0, 0.23]}>
                <planeGeometry args={[b.width * 0.7, b.height * 0.28]} />
                <meshBasicMaterial color="#fde047" transparent opacity={b.opacity * 0.95} />
              </mesh>
              <mesh position={[0, 0, 0.24]}>
                <planeGeometry args={[b.width * 0.58, b.height * 0.14]} />
                <meshBasicMaterial color="#111111" transparent opacity={b.opacity * 0.9} />
              </mesh>
            </>
          ) : null}
          <mesh position={[0, b.height / 2 - 0.05, 0.21]}>
            <planeGeometry args={[b.width * 0.94, 0.08]} />
            <meshBasicMaterial
              color={categoryAccent(b.type)}
              transparent
              opacity={b.opacity * 0.6}
            />
          </mesh>
          {b.cracked ? (
            <mesh position={[0, 0, 0.22]}>
              <planeGeometry args={[b.width * 0.8, b.height * 0.08]} />
              <meshBasicMaterial color="#111111" transparent opacity={b.opacity * 0.5} />
            </mesh>
          ) : null}
          {/* G4: target ornament — a coin sitting on top of the tower. */}
          {b.isTarget && !b.knockedOff && !b.shattered ? (
            <group position={[0, b.height / 2 + 0.22, 0.35]}>
              <mesh>
                <circleGeometry args={[0.18, 24]} />
                <meshStandardMaterial
                  color="#fbbf24"
                  emissive="#facc15"
                  emissiveIntensity={0.55}
                  metalness={0.75}
                  roughness={0.25}
                  transparent
                  opacity={b.opacity}
                />
              </mesh>
              <mesh position={[0, 0, 0.02]}>
                <circleGeometry args={[0.12, 24]} />
                <meshBasicMaterial color="#92400e" transparent opacity={b.opacity * 0.85} />
              </mesh>
            </group>
          ) : null}
        </group>
        );
      })}

      {/* Tower label — only when standing blocks remain, clamped to initial top (C3). */}
      {currentLevel && towerLabelPos ? (
        <Html
          position={[towerLabelPos.x, towerLabelPos.y, 0.6]}
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

      {/* DOM overlay.
          drei's `<Html fullscreen>` runs a separate `react-dom/client` root
          under the hood, so DOM children (`<div>`, `<button>`) are reconciled
          by react-dom instead of R3F's reconciler. Using react-dom's
          `createPortal` directly inside an R3F tree does NOT work — the R3F
          reconciler tries to treat `<div>` as a three.js primitive and
          throws, blanking the entire canvas.

          The old positional-drift bug (HUD getting pushed off-screen by the
          asymmetric, live-fitted frustum) is handled by `OverlayAnchor`
          syncing the wrapping group to the live camera center each frame;
          screen-space floater positions use the camera-aware `worldToNdc`. */}
      <OverlayAnchor>
        <Html
          fullscreen
          prepend
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div
            className="absolute inset-0 z-0"
            style={{
              touchAction: 'none',
              pointerEvents: 'auto',
              cursor:
                cursorMode === 'grabbing'
                  ? 'grabbing'
                  : cursorMode === 'grab'
                    ? 'grab'
                    : 'default',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
          />
          {/* G15 / U21: block hover tooltip */}
          {hoverBlockInfo ? (
            <div
              className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-[120%] rounded-md border border-white/30 bg-slate-950/90 px-2 py-1 text-[11px] font-semibold text-white shadow-lg backdrop-blur"
              style={{
                left: hoverBlockInfo.x,
                top: hoverBlockInfo.y,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="uppercase tracking-wide text-white/75">
                  {hoverBlockInfo.material}
                </span>
                <span className="tabular-nums">
                  HP {Math.max(0, Math.round(hoverBlockInfo.hp))}/
                  {hoverBlockInfo.maxHp}
                </span>
              </div>
            </div>
          ) : null}
          <InvestingBirdsOverlay
            state={state.state}
            allocation={state.allocation}
            levels={state.levels}
            currentLevelIndex={state.currentLevelIndex}
            currentLevel={currentLevel}
            nextLevel={state.levels[state.currentLevelIndex + 1] ?? null}
            birdsRemaining={state.birdsRemaining}
            birdsForRound={state.birdsForRound}
            score={state.score}
            scoreByType={state.scoreByType}
            outcome={state.outcome}
            roundOutcome={state.roundOutcome}
            elapsedSec={state.elapsedSec}
            scoreFloaters={state.scoreFloaters}
            damageFloaters={state.damageFloaters}
            dustPuffs={state.dustPuffs}
            lastHeavyHitAtSec={state.lastHeavyHitAtSec}
            combo={state.combo}
            lastComboAtSec={state.lastComboAtSec}
            paused={state.paused}
            settingsOpen={state.settingsOpen}
            settings={state.settings}
            bestScore={state.bestScore}
            blocks={state.blocks}
            pullRatio={
              state.state === 'PLAYING' && state.dragStart && state.dragEnd
                ? Math.min(
                    1,
                    new Vector2(
                      state.dragEnd.x - state.dragStart.x,
                      state.dragEnd.y - state.dragStart.y,
                    ).length() / GAME_CONFIG.maxDrag,
                  )
                : 0
            }
            showAimHint={
              state.state === 'PLAYING' &&
              !simRef.current.hasLaunchedOnce &&
              state.elapsedSec < 6
            }
            onAllocationChange={(payload) =>
              dispatch({ type: 'SET_ALLOCATION', payload })
            }
            onStart={() => dispatch({ type: 'START_GAME' })}
            onReturnMenu={() =>
              eventBus.emit('navigate:request', { to: 'menu', module: null })
            }
            onTogglePause={() =>
              dispatch({ type: 'SET_PAUSED', payload: !state.paused })
            }
            onOpenSettings={(open) =>
              dispatch({ type: 'OPEN_SETTINGS', payload: open })
            }
            onUpdateSettings={(patch) =>
              dispatch({ type: 'UPDATE_SETTINGS', payload: patch })
            }
            onRetryRound={onRetryRound}
          />
        </Html>
      </OverlayAnchor>
    </>
  );
}

/**
 * Keeps its children anchored to the current orthographic-camera center.
 * drei's `<Html fullscreen>` positions its DOM root by projecting the wrapping
 * group's world position through the active camera. Our orthographic frustum
 * is asymmetric AND re-fit each frame, so a group at (0,0,0) drifts off
 * screen. Syncing the group to the camera's live (cx, cy) keeps the overlay
 * glued to the viewport. Camera-shake and bird-follow offsets applied to
 * `camera.position` are also reflected here so the HUD tracks them exactly.
 */
function OverlayAnchor({ children }: { children: ReactNode }) {
  const groupRef = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    if (camera instanceof OrthoCam) {
      const cx = (camera.left + camera.right) / 2;
      const cy = (camera.top + camera.bottom) / 2;
      groupRef.current.position.set(cx, cy, 0);
    }
  });
  return <group ref={groupRef}>{children}</group>;
}

/**
 * Projects a world point to normalized device coordinates in [-1, 1] for the
 * currently-fit orthographic frustum, accounting for any per-frame offsets
 * applied to `camera.position` (shake, bird-follow, intro pan). Feeding the
 * live camera position is what keeps screen-space HUD effects glued to the
 * viewer rather than drifting with the world.
 */
function worldToNdc(
  x: number,
  y: number,
  frustum: OrthoDesignBounds,
  camPos: { x: number; y: number },
) {
  const cx = (frustum.left + frustum.right) / 2 + camPos.x;
  const cy = (frustum.bottom + frustum.top) / 2 + camPos.y;
  const halfW = (frustum.right - frustum.left) / 2;
  const halfH = (frustum.top - frustum.bottom) / 2;
  return { x: (x - cx) / halfW, y: (y - cy) / halfH };
}
