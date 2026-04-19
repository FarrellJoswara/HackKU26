import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type Dispatch } from 'react';
import { Vec2, type Body } from 'planck';
import { Vector2 } from 'three';
import { eventBus } from '@/core/events';
import { categoryAccent, GAME_CONFIG } from './config';
import {
  createBirdBody,
  createBlockBody,
  launchBirdBody,
  placeBirdBody,
  syncBirdFromBody,
  syncBlockFromBody,
  type BodyUserData,
} from './engine/bodies';
import {
  createContactBuffer,
  installContactListener,
  type ContactBuffer,
} from './engine/contacts';
import {
  createEngine,
  destroyBodyNow,
  queueDestroy,
  resetEngine,
  stepEngine,
  type Engine,
} from './engine/world';
import { COMBO_WINDOW_SEC } from './fsm';
import { generateBlocksForLevel } from './levelGen';
import { cloneBird, cloneBlocks, createBird, updateBlockVisuals } from './physics';
import { useSimRef, type SimRef } from './simref';
import type {
  Bird,
  Block,
  InvestingBirdsAction,
  InvestingBirdsOutput,
  RunState,
} from './types';

interface SimDriverProps {
  state: RunState;
  stateRef: React.MutableRefObject<RunState>;
  dispatch: Dispatch<InvestingBirdsAction>;
  onRenderTick: () => void;
}

interface EngineRefs {
  engine: Engine;
  contacts: ContactBuffer;
  /** Mirror: logical block id -> planck body. */
  blockBodies: Map<string, Body>;
  /** All live bird bodies (one per shot). */
  birdBodies: Set<Body>;
  /** Main bird body that mirrors sim.bird. Null when no bird on pouch. */
  primaryBird: Body | null;
  /** Timestamp (simTime) when the main bird went dynamic. */
  thrownAtSec: number | null;
  /** Per-body rest tracking: body -> simTime when |v| first fell below minRestVel. */
  restAtSec: WeakMap<Body, number>;
}

/**
 * Single authoritative `useFrame` loop driven by the planck physics
 * engine. Replaces the old hand-rolled pairwise collision code: all
 * stacking, toppling, tunneling, and velocity-based damage is now
 * enforced by planck just like Unity's Rigidbody2D does for the
 * reference Angry Birds build.
 */
export function SimDriver(props: SimDriverProps) {
  const { state, stateRef, dispatch, onRenderTick } = props;
  const simRef = useSimRef();

  const enginesRef = useRef<EngineRefs | null>(null);
  if (enginesRef.current == null) {
    const engine = createEngine();
    const contacts = createContactBuffer();
    installContactListener(engine, contacts);
    enginesRef.current = {
      engine,
      contacts,
      blockBodies: new Map(),
      birdBodies: new Set(),
      primaryBird: null,
      thrownAtSec: null,
      restAtSec: new WeakMap(),
    };
  }

  // Reset sim state + engine on return to ALLOCATE.
  useEffect(() => {
    if (state.state !== 'ALLOCATE') return;
    const sim = simRef.current;
    sim.elapsedSec = 0;
    sim.bird = null;
    sim.blocks = [];
    sim.dragStart = null;
    sim.dragEnd = null;
    sim.aiming = false;
    sim.accumulator = 0;
    sim.hasLaunchedOnce = false;
    sim.shotEndedAtSec = null;
    sim.scoredBlocks = new Set();
    sim.prevBlockY = new Map();
    sim.pullRatio = 0;
    sim.slowMoUntilSec = 0;
    sim.slowMoFiredForLaunchAt = null;
    sim.lastLaunchAt = null;
    sim.lastLaunchPos = null;
    sim.lastLaunchDir = null;
    sim.pendingKeyboardLaunch = false;
    sim.birdSpawnedAtSec = null;
    sim.outOfBirdsAtSec = null;
    sim.failureDueAtSec = null;
    sim.nextFloaterId = 1;
    sim.nextDamageId = 1;
    sim.nextDustId = 1;

    const refs = enginesRef.current;
    if (refs) {
      resetEngine(refs.engine);
      refs.blockBodies.clear();
      refs.birdBodies.clear();
      refs.primaryBird = null;
      refs.thrownAtSec = null;
      refs.contacts.impacts.length = 0;
      refs.contacts.lastBirdSpeed.clear();
    }
  }, [state.state, simRef]);

  // Build a fresh round whenever PLAYING kicks in with an empty block list.
  useEffect(() => {
    if (state.state !== 'PLAYING') return;
    if (state.currentLevelIndex >= state.levels.length) return;
    if (state.blocks.length > 0) return;
    const level = state.levels[state.currentLevelIndex];
    if (!level) return;
    const refs = enginesRef.current!;
    const blocks = generateBlocksForLevel(level);
    const bird = createBird(level.type);
    const sim = simRef.current;
    primeSimForRound(sim, blocks, bird);
    rebuildPhysics(refs, sim.blocks, bird);

    eventBus.emit('game:event', {
      kind: 'progress',
      payload: {
        phase: 'round-start',
        round: state.currentLevelIndex + 1,
        type: level.type,
        birds: level.birds,
      } as unknown as InvestingBirdsOutput,
    });
    dispatch({
      type: 'SET_ROUND',
      payload: { blocks, bird, birdsForRound: level.birds },
    });
  }, [state.state, state.currentLevelIndex, state.levels, state.blocks.length, dispatch, simRef]);

  // ----------------------------------------------------------------------
  // Main frame tick
  // ----------------------------------------------------------------------
  useFrame((_, dt) => {
    const refs = enginesRef.current!;
    const sim = simRef.current;
    const st = stateRef.current;
    if (st.paused) return;

    const scaledDt = Math.max(0, Math.min(dt, 0.1));
    sim.elapsedSec += scaledDt;

    // Periodic prune of DOM floaters — 4Hz is plenty.
    if (Math.floor(sim.elapsedSec * 4) !== Math.floor((sim.elapsedSec - scaledDt) * 4)) {
      dispatch({ type: 'PRUNE_FLOATERS', payload: { nowSec: sim.elapsedSec } });
    }

    // Combo window expiry.
    if (
      st.lastComboAtSec != null &&
      sim.elapsedSec - st.lastComboAtSec > COMBO_WINDOW_SEC &&
      st.combo > 0
    ) {
      dispatch({ type: 'COMBO_RESET' });
    }

    if (st.state === 'ROUND_END') {
      handleRoundEnd(refs, sim, stateRef, dispatch);
      return;
    }

    if (st.state !== 'PLAYING') return;
    const level = st.levels[st.currentLevelIndex];
    if (!level || !sim.bird) return;

    // Pointer / Space stage `pendingKeyboardLaunch`; commit here. Do not clear
    // the flag before calling — if commit bails, we used to swallow the launch.
    if (
      sim.pendingKeyboardLaunch &&
      sim.bird &&
      !sim.bird.launched &&
      sim.aiming &&
      sim.dragStart &&
      sim.dragEnd
    ) {
      if (commitLaunch(refs, sim, dispatch)) {
        sim.pendingKeyboardLaunch = false;
      } else {
        sim.pendingKeyboardLaunch = false;
        sim.aiming = false;
        sim.dragStart = null;
        sim.dragEnd = null;
        dispatch({ type: 'SET_DRAG', payload: { start: null, end: null } });
      }
    }

    // If still aiming (not launched), teleport the kinematic bird body to
    // follow the pouch so the physics representation and the visual stay
    // in sync. This also means a bump from a stray stray block won't drag
    // the bird off the pouch.
    if (refs.primaryBird && sim.bird && !sim.bird.launched) {
      placeBirdBody(refs.primaryBird, sim.bird.position.x, sim.bird.position.y);
    }

    // Always step while PLAYING so queued body destroys flush (see `queueDestroy` /
    // `stepEngine`) and sim time stays consistent. Skipping the step when blocks
    // and birds looked "idle" left destroyed birds stuck in the world and broke
    // the respawn timer path in `updateBirdLifecycle`.
    stepEngine(refs.engine, scaledDt);

    applyBirdGroundSlide(refs, sim, scaledDt);

    for (const b of sim.blocks) {
      if (b.shattered || b.knockedOff) continue;
      const body = refs.blockBodies.get(b.id);
      if (!body) continue;
      syncBlockFromBody(b, body);
    }
    if (refs.primaryBird && sim.bird) syncBirdFromBody(sim.bird, refs.primaryBird);

    processContacts(refs, sim, level, dispatch);

    // Block destruction / score bookkeeping.
    scoreAndDestroyBlocks(refs, sim, level, dispatch);

    // Bird rest/destroy tracking.
    updateBirdLifecycle(refs, sim, st, dispatch);

    // Visuals always tick.
    sim.blocks = updateBlockVisuals(sim.blocks, dt);
    onRenderTick();

    // Win condition.
    const aliveBlocks = sim.blocks.filter(
      (b) => !b.shattered && !b.knockedOff && !isSettledGroundDebris(b) && !b.toppled,
    );
    const hadBlocksThisRound =
      sim.scoredBlocks.size > 0 || st.blocks.length > 0;
    const allCleared = aliveBlocks.length === 0 && hadBlocksThisRound;
    if (allCleared) {
      const blocksCleared = Math.min(
        st.roundStartBlockCount,
        sim.scoredBlocks.size,
      );
      dispatch({
        type: 'ROUND_END',
        payload: {
          outcome: 'cleared',
          endedAtSec: sim.elapsedSec,
          blocksCleared,
        },
      });
      eventBus.emit('audio:play', { channel: 'sfx', id: 'clear' });
      eventBus.emit('game:event', {
        kind: 'progress',
        payload: {
          phase: 'round-end',
          outcome: 'cleared',
          round: stateRef.current.currentLevelIndex + 1,
          type: level.type,
          birdsUsed:
            stateRef.current.birdsForRound - stateRef.current.birdsRemaining,
          score: stateRef.current.score,
        } as unknown as InvestingBirdsOutput,
      });
    }
  });

  return null;
}

// --------------------------------------------------------------------------
// Round / bird lifecycle
// --------------------------------------------------------------------------

function rebuildPhysics(
  refs: EngineRefs,
  blocks: Block[],
  bird: Bird,
): void {
  resetEngine(refs.engine);
  refs.blockBodies.clear();
  refs.birdBodies.clear();
  refs.primaryBird = null;
  refs.thrownAtSec = null;
  refs.contacts.impacts.length = 0;
  refs.contacts.lastBirdSpeed.clear();

  for (const b of blocks) {
    const body = createBlockBody(refs.engine, b);
    refs.blockBodies.set(b.id, body);
  }

  const birdBody = createBirdBody(refs.engine, bird, 'main');
  refs.birdBodies.add(birdBody);
  refs.primaryBird = birdBody;
}

/** Full mutable sim reset for a new tower + bird (advance or first round). */
function primeSimForRound(
  sim: SimRef['current'],
  blocks: Block[],
  bird: Bird,
): void {
  sim.blocks = cloneBlocks(blocks);
  sim.bird = cloneBird(bird);
  sim.dragStart = null;
  sim.dragEnd = null;
  sim.aiming = false;
  sim.shotEndedAtSec = null;
  sim.accumulator = 0;
  sim.scoredBlocks = new Set();
  sim.prevBlockY = new Map();
  sim.pullRatio = 0;
  sim.slowMoUntilSec = 0;
  sim.slowMoFiredForLaunchAt = null;
  sim.hasLaunchedOnce = false;
  sim.lastLaunchAt = null;
  sim.lastLaunchPos = null;
  sim.lastLaunchDir = null;
  sim.pendingKeyboardLaunch = false;
  sim.birdSpawnedAtSec = sim.elapsedSec;
  sim.outOfBirdsAtSec = null;
  sim.failureDueAtSec = null;
  sim.nextFloaterId = 1;
  sim.nextDamageId = 1;
  sim.nextDustId = 1;
}

function commitLaunch(
  refs: EngineRefs,
  sim: SimRef['current'],
  dispatch: Dispatch<InvestingBirdsAction>,
): boolean {
  if (!sim.bird || !sim.dragStart || !sim.dragEnd || !refs.primaryBird) return false;
  const pullVec = sim.dragEnd.clone().sub(sim.dragStart);
  const pullLen = pullVec.length();
  if (pullLen < GAME_CONFIG.minPullToLaunch) return false;
  // Reference: launch direction is opposite of the drag; magnitude scales
  // quadratically with pull length (v = dir * throwSpeed * dragLen).
  const clampedLen = Math.min(pullLen, GAME_CONFIG.maxDrag);
  const dir = sim.dragStart.clone().sub(sim.dragEnd);
  const dirLen = dir.length();
  if (dirLen < 1e-6) return false;
  dir.multiplyScalar(1 / dirLen);
  const pouchDir = pullVec.clone().multiplyScalar(clampedLen / Math.max(0.0001, pullLen));
  const startPos = new Vector2(
    GAME_CONFIG.launchAnchor.x + pouchDir.x * 0.55,
    GAME_CONFIG.launchAnchor.y + pouchDir.y * 0.55,
  );

  // Move the kinematic bird to the pouch start position, then fling.
  placeBirdBody(refs.primaryBird, startPos.x, startPos.y);
  launchBirdBody(refs.primaryBird, { x: dir.x * clampedLen, y: dir.y * clampedLen });

  sim.bird = {
    ...sim.bird,
    position: startPos.clone(),
    launched: true,
    velocity: dir.clone().multiplyScalar(
      GAME_CONFIG.bird.throwSpeed * clampedLen * clampedLen,
    ),
    launchedAtSec: sim.elapsedSec,
  };
  sim.lastLaunchAt = sim.elapsedSec;
  sim.lastLaunchPos = startPos.clone();
  sim.lastLaunchDir = dir.clone();
  sim.hasLaunchedOnce = true;
  sim.aiming = false;
  sim.dragStart = null;
  sim.dragEnd = null;
  sim.slowMoFiredForLaunchAt = null;
  sim.outOfBirdsAtSec = null;
  sim.failureDueAtSec = null;
  refs.thrownAtSec = sim.elapsedSec;

  eventBus.emit('audio:play', { channel: 'sfx', id: 'release' });
  dispatch({ type: 'SET_DRAG', payload: { start: null, end: null } });
  dispatch({ type: 'SET_BIRD', payload: cloneBird(sim.bird) });
  dispatch({ type: 'CONSUME_BIRD' });
  return true;
}

/**
 * Stronger-than-physics friction on the floor only: horizontal velocity decays
 * quickly while the bird is touching y≈0 so ground slides don’t delay respawn.
 */
function applyBirdGroundSlide(
  refs: EngineRefs,
  sim: SimRef['current'],
  dt: number,
): void {
  if (!refs.primaryBird || !sim.bird?.launched) return;
  const body = refs.primaryBird;
  if (body.getType() !== 'dynamic') return;
  const cfg = GAME_CONFIG.bird;
  const pos = body.getPosition();
  const bottomY = pos.y - sim.bird.radius;
  if (bottomY > cfg.groundContactSlop) return;
  const v = body.getLinearVelocity();
  if (Math.abs(v.x) < 0.02) return;
  const newVx = v.x * Math.exp(-cfg.groundSlideLambda * dt);
  body.setLinearVelocity(new Vec2(newVx, v.y));
}

function updateBirdLifecycle(
  refs: EngineRefs,
  sim: SimRef['current'],
  st: RunState,
  dispatch: Dispatch<InvestingBirdsAction>,
): void {
  const { bird: birdCfg } = GAME_CONFIG;
  const nowSim = refs.engine.simTime;
  const toRemove: Body[] = [];
  for (const body of refs.birdBodies) {
    // Off-stage guard (mirrors reference Destroyer sensor).
    const pos = body.getPosition();
    if (
      pos.x < GAME_CONFIG.worldBounds.minX ||
      pos.x > GAME_CONFIG.worldBounds.maxX ||
      pos.y < GAME_CONFIG.killFloorY
    ) {
      toRemove.push(body);
      continue;
    }
    // Rest detection: mirror Bird.Update in the reference
    // (`velocity.sqrMagnitude < minVelocity -> Invoke(DestroyGameObject)`).
    if (body.getType() !== 'dynamic') continue;
    const v = body.getLinearVelocity();
    const speed = Math.hypot(v.x, v.y);
    // Sleeping bodies read ~0 vel; micro-jitter while awake can stay > minRestVel.
    const atRest = !body.isAwake() || speed < birdCfg.minRestVel;
    if (atRest) {
      const restAt = refs.restAtSec.get(body);
      if (restAt == null) {
        refs.restAtSec.set(body, nowSim);
      } else if (nowSim - restAt >= birdCfg.restDestroyDelaySec) {
        toRemove.push(body);
      }
    } else {
      refs.restAtSec.delete(body);
    }
  }

  for (const body of toRemove) {
    refs.birdBodies.delete(body);
    if (body === refs.primaryBird) refs.primaryBird = null;
    queueDestroy(refs.engine, body);
  }

  // If all birds are gone, enter respawn / out-of-birds path.
  if (refs.birdBodies.size === 0) {
    if (sim.shotEndedAtSec == null) {
      sim.shotEndedAtSec = sim.elapsedSec;
      if (sim.bird) sim.bird.active = false;
    }
  }

  // Respawn after delay.
  if (
    sim.shotEndedAtSec != null &&
    sim.elapsedSec - sim.shotEndedAtSec >= GAME_CONFIG.respawnDelaySec
  ) {
    const level = st.levels[st.currentLevelIndex];
    if (!level) return;
    if (st.birdsRemaining > 0) {
      const nextBird = createBird(level.type);
      sim.bird = cloneBird(nextBird);
      sim.shotEndedAtSec = null;
      sim.birdSpawnedAtSec = sim.elapsedSec;
      sim.outOfBirdsAtSec = null;
      sim.failureDueAtSec = null;

      const newBody = createBirdBody(refs.engine, nextBird, `main-${sim.elapsedSec.toFixed(3)}`);
      refs.birdBodies.add(newBody);
      refs.primaryBird = newBody;
      dispatch({ type: 'SET_BIRD', payload: cloneBird(sim.bird) });
    } else {
      if (sim.outOfBirdsAtSec == null) {
        sim.outOfBirdsAtSec = sim.elapsedSec;
        sim.failureDueAtSec =
          sim.elapsedSec + GAME_CONFIG.outOfBirdsRoundEndDelaySec;
      }
      if (sim.failureDueAtSec != null && sim.elapsedSec >= sim.failureDueAtSec) {
        const anyAlive = sim.blocks.some(
          (b) => !b.shattered && !b.knockedOff && !isSettledGroundDebris(b) && !b.toppled,
        );
        const blocksCleared = Math.min(
          st.roundStartBlockCount,
          sim.scoredBlocks.size,
        );
        dispatch({
          type: 'ROUND_END',
          payload: {
            outcome: anyAlive ? 'failed' : 'cleared',
            endedAtSec: sim.elapsedSec,
            blocksCleared,
          },
        });
        eventBus.emit('game:event', {
          kind: 'progress',
          payload: {
            phase: 'round-end',
            outcome: anyAlive ? 'failed' : 'cleared',
            round: st.currentLevelIndex + 1,
            type: level.type,
            birdsUsed: st.birdsForRound - st.birdsRemaining,
            score: st.score,
          } as unknown as InvestingBirdsOutput,
        });
      }
    }
  }
}

function handleRoundEnd(
  refs: EngineRefs,
  sim: SimRef['current'],
  stateRef: React.MutableRefObject<RunState>,
  dispatch: Dispatch<InvestingBirdsAction>,
): void {
  const st = stateRef.current;
  const readyFromTime =
    st.roundEndedAtSec != null &&
    sim.elapsedSec - st.roundEndedAtSec >= GAME_CONFIG.roundPauseSec;
  if (!readyFromTime) return;
  const lastIndex = st.levels.length - 1;
  if (st.currentLevelIndex >= lastIndex) {
    // Loss UI only when total return is negative (score below starting notional).
    const beatPar = st.score >= st.initialPortfolioTotal;
    dispatch({ type: beatPar ? 'WIN_GAME' : 'LOSE_GAME' });
  } else {
    dispatch({ type: 'ROUND_ADVANCE' });
    dispatch({ type: 'SET_BLOCKS', payload: { blocks: [], scoredBlockCount: 0 } });
    dispatch({ type: 'SET_BIRD', payload: null });
    // Reset engine for next round.
    resetEngine(refs.engine);
    refs.blockBodies.clear();
    refs.birdBodies.clear();
    refs.primaryBird = null;
    refs.contacts.impacts.length = 0;
    refs.contacts.lastBirdSpeed.clear();
    sim.bird = null;
    sim.blocks = [];
  }
}

// --------------------------------------------------------------------------
// Damage / scoring
// --------------------------------------------------------------------------

function processContacts(
  refs: EngineRefs,
  sim: SimRef['current'],
  level: RunState['levels'][number],
  dispatch: Dispatch<InvestingBirdsAction>,
): void {
  const impacts = refs.contacts.impacts;
  if (impacts.length === 0) return;
  for (const evt of impacts) {
    if (evt.kind === 'ground') {
      dispatch({
        type: 'PUSH_DUST',
        payload: {
          id: sim.nextDustId++,
          atSec: sim.elapsedSec,
          worldX: evt.contactX,
          worldY: 0.08,
          size: 0.45 + Math.min(0.8, evt.impactSpeed * 0.04),
          tint: evt.bird
            ? categoryAccent(sim.bird?.variant ?? 'stocks')
            : '#d8d1c4',
        },
      });
      eventBus.emit('audio:play', { channel: 'sfx', id: 'ground' });
      continue;
    }
    if (evt.kind === 'bird-block') {
      const tag = evt.block.getUserData() as BodyUserData | null;
      if (tag?.kind !== 'block') continue;
      if (!refs.blockBodies.has(tag.blockId)) continue;
      const block = sim.blocks.find((b) => b.id === tag.blockId);
      if (!block || block.shattered || block.knockedOff) continue;
      const damage = evt.impactSpeed * GAME_CONFIG.birdDamageK;
      block.health = Math.max(0, block.health - damage);
      block.hitFlashMs = Math.max(block.hitFlashMs, 140);
      block.damagePulse = Math.min(0.5, block.damagePulse + 0.25);
      block.awake = true;
      block.falling = true;
      if (block.health <= block.maxHealth * 0.7) block.cracked = true;

      const heavy = evt.impactSpeed > 6.5;
      dispatch({
        type: 'PUSH_DAMAGE',
        payload: {
          id: sim.nextDamageId++,
          delta: Math.max(1, Math.round(damage)),
          atSec: sim.elapsedSec,
          worldX: evt.contactX,
          worldY: evt.contactY,
        },
      });
      const dustTint = categoryAccent(block.type);
      const puffCount = heavy ? 4 : 2;
      for (let i = 0; i < puffCount; i += 1) {
        dispatch({
          type: 'PUSH_DUST',
          payload: {
            id: sim.nextDustId++,
            atSec: sim.elapsedSec,
            worldX: evt.contactX + (Math.random() - 0.5) * 0.35,
            worldY: evt.contactY + (Math.random() - 0.5) * 0.35,
            size: 0.45 + Math.random() * 0.25,
            tint: dustTint,
          },
        });
      }
      if (heavy) {
        dispatch({ type: 'HEAVY_HIT', payload: { atSec: sim.elapsedSec } });
      }
      eventBus.emit('audio:play', {
        channel: 'sfx',
        id: block.health <= 0 ? 'break' : heavy ? 'hit-heavy' : 'hit-light',
      });
      continue;
    }
    if (evt.kind === 'block-block') {
      const tagA = evt.block.getUserData() as BodyUserData | null;
      const tagB = evt.otherBlock?.getUserData() as BodyUserData | null;
      const damage = evt.impactSpeed * GAME_CONFIG.obstacleDamageK * 0.35;
      if (damage < 2) continue;
      for (const tag of [tagA, tagB]) {
        if (!tag || tag.kind !== 'block') continue;
        if (!refs.blockBodies.has(tag.blockId)) continue;
        const block = sim.blocks.find((b) => b.id === tag.blockId);
        if (!block || block.shattered || block.knockedOff) continue;
        block.health = Math.max(0, block.health - damage);
        block.damagePulse = Math.min(0.4, block.damagePulse + 0.15);
        if (block.health <= block.maxHealth * 0.7) block.cracked = true;
      }
    }
  }
  impacts.length = 0;
  // Tiny dust floor for block-block impacts so the player still sees feedback.
  // (Already handled above with per-hit dust where applicable.)
  void level;
}

function scoreAndDestroyBlocks(
  refs: EngineRefs,
  sim: SimRef['current'],
  level: RunState['levels'][number],
  dispatch: Dispatch<InvestingBirdsAction>,
): void {
  for (const b of sim.blocks) {
    if (b.scored && b.shattered) continue;
    // Off-stage check (destroyer sensor analogue).
    const offStage =
      b.position.x < GAME_CONFIG.worldBounds.minX ||
      b.position.x > GAME_CONFIG.worldBounds.maxX ||
      b.position.y < GAME_CONFIG.killFloorY;
    if (offStage && !b.knockedOff) {
      b.knockedOff = true;
    }
    const shatter = b.health <= 0 && !b.shattered;
    if (shatter) {
      b.shattered = true;
      b.knockedOff = true;
      b.falling = false;
      b.velocity.set(0, 0);
      b.rotationVel = 0;
      b.opacity = Math.min(b.opacity, 0.75);
    }

    if (shatter || b.knockedOff) {
      const body = refs.blockBodies.get(b.id);
      if (body) {
        refs.blockBodies.delete(b.id);
        // Immediate destroy: queued destroy left bodies in the world until the next
        // step, so birds still collided with “ghost” fixtures after knockOff/shatter.
        destroyBodyNow(refs.engine, body);
      }
    }

    if ((shatter || b.knockedOff) && !b.scored) {
      b.scored = true;
      if (!sim.scoredBlocks.has(b.id)) {
        sim.scoredBlocks.add(b.id);
        dispatch({ type: 'COMBO_TICK', payload: { atSec: sim.elapsedSec } });
        eventBus.emit('audio:play', { channel: 'sfx', id: 'break' });
      }
    }
  }
  // Finally, physically remove fully-cleared entries from sim.blocks so
  // the scene never keeps rendering bodyless logical blocks.
  sim.blocks = sim.blocks.filter((b) => !(b.shattered && b.opacity <= 0.02));
  void level;
}

// --------------------------------------------------------------------------
// Objective helpers
// --------------------------------------------------------------------------

function normalizeAngle(rad: number): number {
  let r = rad % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

function isSettledGroundDebris(b: Block): boolean {
  const bottom = b.position.y - b.height / 2;
  const grounded = bottom <= 0.08;
  const settled = b.velocity.lengthSq() < 0.12 && !b.falling;
  const visiblyFallen =
    Math.abs(normalizeAngle(b.rotation)) > 0.5 ||
    b.initialY - b.position.y > b.height * 0.32;
  return grounded && settled && visiblyFallen;
}

export { commitLaunch };
