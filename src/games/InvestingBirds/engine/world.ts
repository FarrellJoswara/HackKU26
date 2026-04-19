import {
  EdgeShape,
  Vec2,
  World,
  type Body,
} from 'planck';
import { GAME_CONFIG } from '../config';

/**
 * Thin wrapper around `planck.World` so the rest of the game never has to
 * know about the specific Box2D port we picked. Matches the semantics of
 * Unity's Rigidbody2D setup used in the reference Angry Birds project.
 */
export interface Engine {
  world: World;
  /** Monotonically increasing simulation time, advanced by `stepEngine`. */
  simTime: number;
  /** Fixed step size used by the planck world. */
  stepDt: number;
  /** A single static ground body, spanning the playfield. */
  ground: Body;
  /** Bodies to destroy at the top of the next frame (planck locks during steps). */
  pendingDestroy: Body[];
}

/**
 * Create a new planck world configured with the game's gravity and
 * continuous-physics flags. The gravity in `GAME_CONFIG` is positive
 * (magnitude); planck expects a signed vector so we negate Y.
 */
export function createEngine(): Engine {
  const world = new World({
    gravity: new Vec2(0, -GAME_CONFIG.gravity),
    allowSleep: true,
    warmStarting: true,
    continuousPhysics: true,
    /** Improves bullet/TOI continuous collision (reduces tunneling vs dynamics). */
    subStepping: true,
  });

  // Global floor: infinite plane at y=0. Edge shapes are the canonical way
  // to build static ground in Box2D; they resist tunneling better than a
  // thin box.
  const ground = world.createBody({ type: 'static', position: new Vec2(0, 0) });
  // Use a long horizontal edge to cover the full stage.
  ground.createFixture(
    new EdgeShape(new Vec2(-200, 0), new Vec2(200, 0)),
    {
      friction: GAME_CONFIG.groundFriction,
      restitution: 0.0,
    },
  );
  ground.setUserData({ kind: 'ground' });

  return {
    world,
    simTime: 0,
    stepDt: 1 / 60,
    ground,
    pendingDestroy: [],
  };
}

/**
 * Advance the planck world by dt, using accumulator sub-stepping so the
 * simulation stays deterministic regardless of frame rate. Also processes
 * any bodies queued for destruction last frame.
 */
export function stepEngine(engine: Engine, dt: number): void {
  // Drain pending destroys before stepping to avoid locked-world errors.
  if (engine.pendingDestroy.length > 0) {
    for (const b of engine.pendingDestroy) {
      try {
        engine.world.destroyBody(b);
      } catch {
        /* body may already be gone if something else destroyed it */
      }
    }
    engine.pendingDestroy.length = 0;
  }

  const maxDt = engine.stepDt * 6;
  let remaining = Math.min(dt, maxDt);
  let steps = 0;
  while (remaining > engine.stepDt && steps < 8) {
    engine.world.step(engine.stepDt, 12, 4);
    engine.simTime += engine.stepDt;
    remaining -= engine.stepDt;
    steps += 1;
  }
  if (steps === 0) {
    engine.world.step(Math.max(engine.stepDt * 0.5, remaining), 12, 4);
    engine.simTime += remaining;
  }
}

/**
 * Queue a body for destruction. Safe to call during a contact listener —
 * the body is actually removed at the start of the next frame.
 */
export function queueDestroy(engine: Engine, body: Body): void {
  engine.pendingDestroy.push(body);
}

/**
 * Destroy a body immediately (safe **after** `world.step`, not from contact callbacks).
 * Removes the body from the simulation so it cannot collide on the next sub-step —
 * fixes “ghost blocks” where we deleted `blockBodies[id]` but `queueDestroy` hadn’t
 * run yet.
 */
export function destroyBodyNow(engine: Engine, body: Body): void {
  const i = engine.pendingDestroy.indexOf(body);
  if (i >= 0) engine.pendingDestroy.splice(i, 1);
  try {
    engine.world.destroyBody(body);
  } catch {
    /* already destroyed */
  }
}

/**
 * Destroy every body in the world except the shared ground edge. Used on
 * round reset / allocation return.
 */
export function resetEngine(engine: Engine): void {
  // Collect non-ground bodies first; mutating the world while iterating
  // via getBodyList() is brittle.
  const toKill: Body[] = [];
  for (let b = engine.world.getBodyList(); b; b = b.getNext()) {
    if (b === engine.ground) continue;
    toKill.push(b);
  }
  for (const b of toKill) {
    try {
      engine.world.destroyBody(b);
    } catch {
      /* ignore */
    }
  }
  engine.pendingDestroy.length = 0;
  engine.simTime = 0;
}
