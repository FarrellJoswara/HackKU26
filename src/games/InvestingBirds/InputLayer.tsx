/**
 * @file Pointer capture for slingshot aim/drag — maps screen coords to world
 * space via `projection.ts` and dispatches FSM actions.
 */

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Vector2 } from 'three';
import { eventBus } from '@/core/events';
import { GAME_CONFIG } from './config';
import { useFrustum } from './frustumContext';
import { screenToWorld } from './projection';
import { useSimRef } from './simref';
import { clampDragPoint } from './physics';
import type { InvestingBirdsAction, RunState } from './types';

interface InputLayerProps {
  state: RunState;
  stateRef: React.MutableRefObject<RunState>;
  dispatch: Dispatch<InvestingBirdsAction>;
  containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Pointer + keyboard input. Drag state lives in `simRef`; SimDriver commits
 * launches. Window-level pointerup/pointercancel ensures release is seen even
 * when the finger leaves the overlay before lifting (fixes missed launches).
 */
export function InputLayer(props: InputLayerProps) {
  const { state, stateRef, dispatch, containerRef } = props;
  const simRef = useSimRef();
  const { frustum } = useFrustum();
  const pointerIdRef = useRef<number | null>(null);
  const pointerTargetRef = useRef<HTMLDivElement | null>(null);
  /** Removes window listeners registered at drag start (also cleared on release). */
  const pullWinCleanupRef = useRef<(() => void) | null>(null);
  const [cursorMode, setCursorMode] = useState<'default' | 'grab' | 'grabbing'>(
    'default',
  );

  const slingAnchor = new Vector2(
    GAME_CONFIG.launchAnchor.x,
    GAME_CONFIG.launchAnchor.y,
  );

  useEffect(
    () => () => {
      pullWinCleanupRef.current?.();
      pullWinCleanupRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const st = stateRef.current;
      const sim = simRef.current;
      if (e.key === 'Escape') {
        if (st.state === 'PLAYING') {
          if (sim.aiming) {
            pullWinCleanupRef.current?.();
            pullWinCleanupRef.current = null;
            if (pointerTargetRef.current && pointerIdRef.current != null) {
              try {
                pointerTargetRef.current.releasePointerCapture(pointerIdRef.current);
              } catch {
                /* noop */
              }
            }
            pointerIdRef.current = null;
            pointerTargetRef.current = null;
            sim.aiming = false;
            sim.dragStart = null;
            sim.dragEnd = null;
            sim.pullRatio = 0;
            sim.pendingKeyboardLaunch = false;
            dispatch({ type: 'SET_DRAG', payload: { start: null, end: null } });
            return;
          }
          dispatch({ type: 'SET_PAUSED', payload: !st.paused });
        }
      } else if (e.code === 'Space' || e.key === ' ') {
        if (st.state === 'ALLOCATE') {
          e.preventDefault();
          const total =
            st.allocation.stocks +
            st.allocation.etfs +
            st.allocation.bonds +
            st.allocation.crypto;
          if (total > 0) dispatch({ type: 'START_GAME' });
        } else if (
          st.state === 'PLAYING' &&
          sim.bird &&
          !sim.bird.launched &&
          sim.aiming &&
          sim.dragStart &&
          sim.dragEnd
        ) {
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
        e.preventDefault();
        if (!sim.aiming || !sim.dragStart || !sim.dragEnd) {
          sim.aiming = true;
          sim.dragStart = slingAnchor.clone();
          sim.dragEnd = sim.dragStart.clone();
        }
        const step = e.shiftKey ? 0.35 : 0.15;
        if (e.key === 'ArrowLeft') sim.dragEnd.x -= step;
        if (e.key === 'ArrowRight') sim.dragEnd.x += step;
        if (e.key === 'ArrowUp') sim.dragEnd.y += step;
        if (e.key === 'ArrowDown') sim.dragEnd.y -= step;
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

  const rect = () => containerRef.current?.getBoundingClientRect();

  const toWorld = (clientX: number, clientY: number): Vector2 | null => {
    const r = rect();
    if (!r) return null;
    const p = screenToWorld(clientX, clientY, frustum, r);
    return new Vector2(p.x, p.y);
  };

  const isInPullZone = (world: Vector2): boolean => {
    const r = rect();
    const aspect = r ? r.width / Math.max(1, r.height) : 1.6;
    const base = aspect < 1 ? 4.2 : 3.2;
    return world.distanceTo(slingAnchor) <= base;
  };

  const inputEnabled =
    state.state === 'PLAYING' &&
    !state.paused &&
    !state.settingsOpen &&
    state.roundOutcome == null;

  const completePullRelease = () => {
    const sim = simRef.current;
    const st = stateRef.current;
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

    pullWinCleanupRef.current?.();
    pullWinCleanupRef.current = null;

    const inputOk =
      st.state === 'PLAYING' &&
      !st.paused &&
      !st.settingsOpen &&
      st.roundOutcome == null;
    if (!inputOk) return;

    const bird = sim.bird;
    if (!bird || bird.launched || !sim.aiming || !sim.dragStart || !sim.dragEnd) {
      sim.aiming = false;
      dispatch({ type: 'SET_DRAG', payload: { start: null, end: null } });
      return;
    }
    if (sim.pendingKeyboardLaunch) return;

    const pull = sim.dragEnd.clone().sub(sim.dragStart);
    if (pull.length() < GAME_CONFIG.minPullToLaunch) {
      sim.aiming = false;
      sim.dragStart = null;
      sim.dragEnd = null;
      dispatch({ type: 'SET_DRAG', payload: { start: null, end: null } });
      return;
    }
    sim.pendingKeyboardLaunch = true;
  };

  const onPointerDown = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (!inputEnabled) return;
    const sim = simRef.current;
    const bird = sim.bird;
    if (!bird) return;
    if (bird.launched || !bird.active || stateRef.current.birdsRemaining <= 0) return;

    const world = toWorld(ev.clientX, ev.clientY);
    if (!world) return;
    if (!isInPullZone(world)) return;

    pointerIdRef.current = ev.pointerId;
    pointerTargetRef.current = ev.currentTarget;
    ev.currentTarget.setPointerCapture(ev.pointerId);

    const pid = ev.pointerId;
    function onWin(e: PointerEvent) {
      if (e.pointerId !== pid) return;
      window.removeEventListener('pointerup', onWin, true);
      window.removeEventListener('pointercancel', onWin, true);
      pullWinCleanupRef.current = null;
      completePullRelease();
    }
    pullWinCleanupRef.current = () => {
      window.removeEventListener('pointerup', onWin, true);
      window.removeEventListener('pointercancel', onWin, true);
    };
    window.addEventListener('pointerup', onWin, true);
    window.addEventListener('pointercancel', onWin, true);

    sim.dragStart = slingAnchor.clone();
    sim.dragEnd = world;
    sim.aiming = true;
    setCursorMode('grabbing');
    eventBus.emit('audio:play', { channel: 'sfx', id: 'pull' });
    dispatch({ type: 'SET_DRAG', payload: { start: sim.dragStart, end: world } });
  };

  const onPointerMove = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const sim = simRef.current;
    if (!inputEnabled) return;
    if (!sim.aiming && sim.bird && !sim.bird.launched) {
      const world = toWorld(ev.clientX, ev.clientY);
      if (world) {
        const next = isInPullZone(world) ? 'grab' : 'default';
        if (cursorMode !== next && cursorMode !== 'grabbing') setCursorMode(next);
      }
    }
    if (!sim.aiming || !sim.dragStart) return;
    const world = toWorld(ev.clientX, ev.clientY);
    if (!world) return;
    const end = clampDragPoint(sim.dragStart, world);
    sim.dragEnd = end;
    dispatch({ type: 'SET_DRAG', payload: { start: sim.dragStart, end } });
  };

  return (
    <div
      className="absolute inset-0"
      style={{
        pointerEvents: inputEnabled ? 'auto' : 'none',
        touchAction: 'none',
        cursor:
          cursorMode === 'grabbing'
            ? 'grabbing'
            : cursorMode === 'grab'
              ? 'grab'
              : 'default',
        zIndex: 8,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    />
  );
}
