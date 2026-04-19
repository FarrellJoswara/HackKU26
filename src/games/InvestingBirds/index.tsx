import { Canvas } from '@react-three/fiber';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { eventBus } from '@/core/events';
import type { GameProps } from '@/core/types';
import { initAudio, setAudioConfig } from './audio';
import { CameraRig } from './CameraRig';
import { allocationKey, CAMERA_DESIGN } from './config';
import { FrustumContext, type FrustumState } from './frustumContext';
import { getInitialRunState, runReducer } from './fsm';
import { InputLayer } from './InputLayer';
import { buildLevels } from './levelGen';
import { Overlay } from './Overlay';
import { computeFrustum } from './projection';
import { Scene } from './Scene';
import { SimDriver } from './SimDriver';
import { cloneBird, cloneBlocks } from './physics';
import { createSimData, SimRefContext, type SimData } from './simref';
import type {
  InvestingBirdsInput,
  InvestingBirdsOutput,
  RunState,
} from './types';

function seedFromInput(seed?: number): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) return Math.floor(seed);
  return 1337;
}

const DESIGN = {
  left: CAMERA_DESIGN.left,
  right: CAMERA_DESIGN.right,
  top: CAMERA_DESIGN.top,
  bottom: CAMERA_DESIGN.bottom,
};

function loadBestScore(key: string): number | null {
  try {
    const v = window.localStorage.getItem(`ib2.best.${key}`);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
function saveBestScore(key: string, score: number): void {
  try {
    window.localStorage.setItem(`ib2.best.${key}`, String(Math.round(score)));
  } catch {
    /* noop */
  }
}

/**
 * Top-level component for Investing Birds. Mounts as a full-screen
 * fixed-position div **outside** the shared `<Canvas>` so no parent layout
 * can distort it. Owns the run-state reducer, the shared SimRef, the
 * resize-only Frustum state, and all cross-module eventing.
 *
 * This build bypasses the in-game allocation UI entirely. The FSM starts
 * directly in INIT_LEVELS using demo fallback allocation data.
 */
export default function InvestingBirds({
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

  const simRef = useRef<SimData>(createSimData());
  const containerRef = useRef<HTMLDivElement>(null);

  // Frustum lives in React state so CameraRig / Scene / Overlay / InputLayer
  // all agree on the same projection. Updated on mount and on window resize
  // only — never per-frame.
  const [frustumState, setFrustumState] = useState<FrustumState>(() => {
    const vp = { width: window.innerWidth, height: window.innerHeight };
    return { frustum: computeFrustum(vp, DESIGN), viewport: vp };
  });

  useLayoutEffect(() => {
    const recompute = () => {
      const el = containerRef.current;
      const vp = el
        ? { width: el.clientWidth, height: el.clientHeight }
        : { width: window.innerWidth, height: window.innerHeight };
      setFrustumState({
        frustum: computeFrustum(vp, DESIGN),
        viewport: vp,
      });
    };
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('orientationchange', recompute);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('orientationchange', recompute);
    };
  }, []);

  // Audio init
  useEffect(() => {
    const cleanup = initAudio({
      volume: state.settings.volume,
      musicOn: state.settings.musicOn,
    });
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setAudioConfig({
      volume: state.settings.volume,
      musicOn: state.settings.musicOn,
    });
  }, [state.settings.volume, state.settings.musicOn]);

  // Persist high score per allocation (localStorage; not shown in UI).
  useEffect(() => {
    if (state.state !== 'GAME_END') return;
    const key = allocationKey(state.allocation);
    const existing = loadBestScore(key);
    const score = Math.round(state.score);
    if (existing == null || score > existing) {
      saveBestScore(key, score);
    }
  }, [state.state, state.score, state.allocation]);

  // INIT_LEVELS → PLAYING
  useEffect(() => {
    if (state.state !== 'INIT_LEVELS') return;
    const levels = buildLevels(state.allocation);
    dispatch({ type: 'INIT_COMPLETE', payload: { levels, seed: state.rngSeed } });
  }, [state.state, state.allocation, state.rngSeed]);

  // Start event
  useEffect(() => {
    const startEvt = {
      kind: 'start' as const,
      payload: undefined as unknown as InvestingBirdsOutput,
    };
    eventBus.emit('game:event', startEvt);
    onEvent?.(startEvt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GAME_END → result event
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

  // Render tick throttling. We still avoid 120Hz reducer churn, but 120ms was
  // visually too coarse and could make the scene feel like the view was
  // stuttering. 30 FPS-equivalent keeps it smooth without full per-frame
  // React updates.
  const [renderTick, setRenderTick] = useState(0);
  const lastTickAtRef = useRef(0);
  const onRenderTick = useCallback(() => {
    const now = simRef.current.elapsedSec;
    if (now - lastTickAtRef.current >= 1 / 30) {
      lastTickAtRef.current = now;
      setRenderTick((n) => (n + 1) & 0xffff);
    }
  }, []);

  // Dispatch SET_BLOCKS whenever renderTick ticks (keeps the reducer-backed
  // blocks list in sync for the Overlay). Must sync empty arrays too — otherwise
  // after the last block is removed from the sim, React keeps stale blocks and
  // the top bar / counts lie until the next round.
  useEffect(() => {
    const sim = simRef.current;
    dispatch({
      type: 'SET_BLOCKS',
      payload: { blocks: cloneBlocks(sim.blocks), scoredBlockCount: sim.scoredBlocks.size },
    });
    if (sim.bird) dispatch({ type: 'SET_BIRD', payload: cloneBird(sim.bird) });
    dispatch({ type: 'SET_ELAPSED', payload: sim.elapsedSec });
  }, [renderTick]);

  const currentLevelType = useMemo(
    () => state.levels[state.currentLevelIndex]?.type ?? null,
    [state.levels, state.currentLevelIndex],
  );

  const showAimHint =
    state.state === 'PLAYING' && !simRef.current.hasLaunchedOnce && state.elapsedSec < 6;

  return (
    <FrustumContext.Provider value={frustumState}>
      <SimRefContext.Provider value={simRef}>
        <div
          ref={containerRef}
          id="ib2-root"
          style={{
            position: 'fixed',
            inset: 0,
            overflow: 'hidden',
            background: '#C9E8F5',
            zIndex: 20,
            contain: 'layout paint size',
            isolation: 'isolate',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            <Canvas
              dpr={[1, 2]}
              gl={{ antialias: true, alpha: false }}
              style={{ width: '100%', height: '100%', display: 'block' }}
            >
              <CameraRig />
              <Scene
                renderTick={renderTick}
                blocks={state.blocks}
                currentLevelType={currentLevelType}
                showAimHint={showAimHint}
                state={state.state}
              />
              <SimDriver
                state={state}
                stateRef={stateRef}
                dispatch={dispatch}
                onRenderTick={onRenderTick}
              />
            </Canvas>
          </div>
          <InputLayer
            state={state}
            stateRef={stateRef}
            dispatch={dispatch}
            containerRef={containerRef}
          />
          <Overlay
            state={state}
            hasLaunchedOnce={simRef.current.hasLaunchedOnce}
            dispatch={dispatch}
          />
        </div>
      </SimRefContext.Provider>
    </FrustumContext.Provider>
  );
}
