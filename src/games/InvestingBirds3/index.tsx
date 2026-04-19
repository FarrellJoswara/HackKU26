import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Vec2 } from 'planck';
import { eventBus } from '@/core/events';
import type { GameProps } from '@/core/types';
import { CAMERA_DESIGN } from './config';
import { GameScene, fireAbilityIfNeeded, type AimDragRef } from './GameScene';
import {
  createRoundSimulation,
  launchBird,
  type RoundSimulation,
} from './roundSimulation';
import { Overlay } from './Overlay';
import { computeFrustum, screenToWorld } from './projection';
import type { InvestingBirds3Input, InvestingBirds3Output, UiState } from './types';
import { initialUiState, uiReducer } from './uiState';

function worldFromClient(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } {
  const frustum = computeFrustum(
    { width: rect.width, height: rect.height },
    {
      left: CAMERA_DESIGN.left,
      right: CAMERA_DESIGN.right,
      top: CAMERA_DESIGN.top,
      bottom: CAMERA_DESIGN.bottom,
    },
  );
  return screenToWorld(clientX, clientY, frustum, rect);
}

export default function InvestingBirds3({
  inputs,
  onEvent,
}: GameProps<InvestingBirds3Input, InvestingBirds3Output>) {
  const [ui, dispatch] = useReducer(uiReducer, null, () => initialUiState());
  const phaseRef = useRef<UiState['phase']>(ui.phase);
  phaseRef.current = ui.phase;

  const simRef = useRef<RoundSimulation | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const launchedRef = useRef(false);
  const abilityUsedRef = useRef(false);
  const pigEventFiredRef = useRef(false);
  const birdsRemainingRef = useRef(0);
  const dragRef = useRef<{ id: number; wx: number; wy: number } | null>(null);
  const downRef = useRef({ x: 0, y: 0, t: 0 });
  const aimDragRef = useRef<AimDragRef>({ active: false, wx: 0, wy: 0 });
  const towerWorldRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    void inputs;
    const startEvt = {
      kind: 'start' as const,
      payload: undefined as unknown as InvestingBirds3Output,
    };
    eventBus.emit('game:event', startEvt);
    onEvent?.(startEvt);
  }, [inputs, onEvent]);

  useEffect(() => {
    birdsRemainingRef.current = ui.birdsRemaining;
  }, [ui.birdsRemaining]);

  useEffect(() => {
    if (ui.phase !== 'playing') {
      simRef.current?.dispose();
      simRef.current = null;
      aimDragRef.current.active = false;
      return;
    }
    const plan = ui.rounds[ui.roundIndex];
    if (!plan) return undefined;
    const sim = createRoundSimulation(plan);
    simRef.current = sim;
    launchedRef.current = false;
    abilityUsedRef.current = false;
    pigEventFiredRef.current = false;
    birdsRemainingRef.current = ui.birdsRemaining;
    aimDragRef.current = {
      active: false,
      wx: sim.slingAnchor.x,
      wy: sim.slingAnchor.y,
    };
    return () => {
      sim.dispose();
      if (simRef.current === sim) simRef.current = null;
    };
  }, [ui.phase, ui.roundIndex, ui.simKey, ui.rounds]);

  const resultSentRef = useRef(false);
  useEffect(() => {
    if (ui.phase !== 'game_win' && ui.phase !== 'game_loss') {
      resultSentRef.current = false;
      return undefined;
    }
    if (resultSentRef.current) return undefined;
    resultSentRef.current = true;
    const out: InvestingBirds3Output = {
      outcome: ui.phase === 'game_win' ? 'win' : 'loss',
      score: Math.round(ui.score),
      levelsCleared:
        ui.phase === 'game_win' ? ui.rounds.length : ui.roundIndex,
      scoreByType: ui.scoreByType,
    };
    const evt = { kind: 'result' as const, payload: out };
    eventBus.emit('game:result', evt);
    onEvent?.(evt);
    return undefined;
  }, [ui.phase, ui.score, ui.roundIndex, ui.rounds.length, ui.scoreByType, onEvent]);

  const onQuit = useCallback(() => {
    eventBus.emit('navigate:request', { to: 'menu', module: null });
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    downRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (phaseRef.current !== 'playing') return;
    const sim = simRef.current;
    if (!sim) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const w = worldFromClient(e.clientX, e.clientY, rect);
    if (sim.bird.getType() === 'static') {
      dragRef.current = { id: e.pointerId, wx: w.x, wy: w.y };
      aimDragRef.current = { active: true, wx: w.x, wy: w.y };
      containerRef.current?.setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const w = worldFromClient(e.clientX, e.clientY, rect);
      d.wx = w.x;
      d.wy = w.y;
      aimDragRef.current.wx = w.x;
      aimDragRef.current.wy = w.y;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const sim = simRef.current;
    const d = dragRef.current;

    if (d && d.id === e.pointerId) {
      try {
        containerRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      dragRef.current = null;
      aimDragRef.current.active = false;
      if (sim && phaseRef.current === 'playing' && sim.bird.getType() === 'static') {
        const pull = Vec2(sim.slingAnchor.x - d.wx, sim.slingAnchor.y - d.wy);
        if (pull.length() > 0.06) {
          launchBird(sim.bird, sim.slingAnchor, Vec2(d.wx, d.wy));
          launchedRef.current = true;
        }
      }
      return;
    }

    if (
      sim &&
      phaseRef.current === 'playing' &&
      sim.bird.getType() === 'dynamic' &&
      launchedRef.current
    ) {
      const dt = performance.now() - downRef.current.t;
      const dist = Math.hypot(
        e.clientX - downRef.current.x,
        e.clientY - downRef.current.y,
      );
      if (dt < 320 && dist < 20) {
        fireAbilityIfNeeded(sim, abilityUsedRef);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      id="ib3-root"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20,
        overflow: 'hidden',
        background: '#C9E8F5',
        touchAction: 'none',
        contain: 'layout paint size',
        isolation: 'isolate',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <Canvas
          orthographic
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <GameScene
            simKey={ui.simKey}
            simRef={simRef}
            phaseRef={phaseRef}
            dispatch={dispatch}
            birdsRemainingRef={birdsRemainingRef}
            launchedRef={launchedRef}
            abilityUsedRef={abilityUsedRef}
            pigEventFiredRef={pigEventFiredRef}
            aimDragRef={aimDragRef}
            towerWorldRef={towerWorldRef}
          />
        </Canvas>
      </div>
      <Overlay
        ui={ui}
        dispatch={dispatch}
        onQuit={onQuit}
        containerRef={containerRef}
        towerWorldRef={towerWorldRef}
      />
    </div>
  );
}
