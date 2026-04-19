/**
 * @file Planck/Three bridge — bird/block cloning, damage, collisions helpers,
 * and slingshot clamp math used by `SimDriver` and the scene.
 */

import { Vector2 } from 'three';
import { GAME_CONFIG } from './config';
import type { Bird, Block, LevelType } from './types';

export function cloneBird(bird: Bird): Bird {
  return {
    ...bird,
    position: bird.position.clone(),
    velocity: bird.velocity.clone(),
  };
}

export function cloneBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => ({
    ...b,
    position: b.position.clone(),
    velocity: b.velocity.clone(),
  }));
}

export function createBird(variant: LevelType = 'stocks'): Bird {
  return {
    position: new Vector2(GAME_CONFIG.launchAnchor.x, GAME_CONFIG.launchAnchor.y),
    velocity: new Vector2(0, 0),
    radius: GAME_CONFIG.birdRadius,
    launched: false,
    active: true,
    settledMs: 0,
    variant,
    launchedAtSec: 0,
  };
}

export function clampDragPoint(start: Vector2, current: Vector2): Vector2 {
  const delta = current.clone().sub(start);
  if (delta.length() <= GAME_CONFIG.maxDrag) return current;
  return start.clone().add(delta.normalize().multiplyScalar(GAME_CONFIG.maxDrag));
}

export function launchVelocity(start: Vector2, end: Vector2): Vector2 {
  return start.clone().sub(end).multiplyScalar(GAME_CONFIG.forceMultiplier);
}

/**
 * Frame-rate-independent motion. Drag is applied only to horizontal velocity
 * so gravity itself is never damped (see plan PH1). The drag coefficient is
 * exponentiated against `dt*60` so a 120Hz sub-step and a 60Hz step converge.
 */
export function applyGravityAndDrag(velocity: Vector2, dt: number): void {
  velocity.y -= GAME_CONFIG.gravity * dt;
  const factor = Math.pow(GAME_CONFIG.dragDamping, dt * 60);
  velocity.x *= factor;
}

export function updateBirdPhysics(bird: Bird, dt: number): Bird {
  if (!bird.active || !bird.launched) return bird;
  const next = { ...bird, position: bird.position.clone(), velocity: bird.velocity.clone() };
  applyGravityAndDrag(next.velocity, dt);
  next.position.addScaledVector(next.velocity, dt);
  const speed = next.velocity.length();
  next.settledMs =
    speed < GAME_CONFIG.settleSpeedEpsilon ? next.settledMs + dt * 1000 : 0;
  return next;
}

interface CircleAabbOverlap {
  hit: boolean;
  normal: Vector2;
  /** Signed penetration along the normal (0 when just touching). */
  depth: number;
  closestPoint: Vector2;
  distSq: number;
}

function circleAabbOverlap(bird: Bird, block: Block): CircleAabbOverlap {
  const minX = block.position.x - block.width / 2;
  const maxX = block.position.x + block.width / 2;
  const minY = block.position.y - block.height / 2;
  const maxY = block.position.y + block.height / 2;
  const closestX = Math.max(minX, Math.min(bird.position.x, maxX));
  const closestY = Math.max(minY, Math.min(bird.position.y, maxY));
  const dx = bird.position.x - closestX;
  const dy = bird.position.y - closestY;
  const distSq = dx * dx + dy * dy;
  const r = bird.radius;
  if (distSq > r * r) {
    return {
      hit: false,
      normal: new Vector2(0, 0),
      depth: 0,
      closestPoint: new Vector2(closestX, closestY),
      distSq,
    };
  }
  const dist = Math.sqrt(distSq);
  const normal = new Vector2(dx, dy);
  if (normal.lengthSq() === 0) normal.set(0, 1);
  else normal.multiplyScalar(1 / Math.max(1e-6, dist));
  return {
    hit: true,
    normal,
    depth: r - dist,
    closestPoint: new Vector2(closestX, closestY),
    distSq,
  };
}

export interface HitEvent {
  blockId: string;
  impactForce: number;
  heavy: boolean;
  /** Contact position in world space (for dust/damage placement). */
  contact: Vector2;
  /** True if this hit knocked the block's HP to zero. */
  shatter: boolean;
}

export interface CollisionResult {
  bird: Bird;
  blocks: Block[];
  hits: HitEvent[];
}

/**
 * Bird↔block collision. Resolves ONLY the deepest overlap per frame (PH6) so
 * stacked blocks don't double-dip the bird's velocity. Pushes the bird fully
 * clear of the block (PH9) and applies torque-based rotation (PH8).
 */
export function resolveCollisions(bird: Bird, blocks: Block[]): CollisionResult {
  if (!bird.active || !bird.launched) {
    return { bird, blocks, hits: [] };
  }
  const nextBird = { ...bird, position: bird.position.clone(), velocity: bird.velocity.clone() };
  const nextBlocks = blocks.map((b) => ({
    ...b,
    position: b.position.clone(),
    velocity: b.velocity.clone(),
  }));
  const hits: HitEvent[] = [];

  // PH6: find the single deepest overlap; ignore the rest this frame.
  let deepest: { block: Block; overlap: CircleAabbOverlap } | null = null;
  for (const block of nextBlocks) {
    if (block.knockedOff || block.shattered) continue;
    const overlap = circleAabbOverlap(nextBird, block);
    if (!overlap.hit) continue;
    if (!deepest || overlap.depth > deepest.overlap.depth) {
      deepest = { block, overlap };
    }
  }
  if (!deepest) return { bird: nextBird, blocks: nextBlocks, hits };
  const { block, overlap } = deepest;

  const impactVel = nextBird.velocity.clone();
  const impactSpeed = impactVel.length();
  const impactForce = impactSpeed * GAME_CONFIG.birdMassFactor;
  // Hit-consistency: convert light grazing contacts into minimum feedback so
  // players never see a visually-valid hit that does nothing.
  if (impactSpeed < 0.08) return { bird: nextBird, blocks: nextBlocks, hits };
  const minEffectImpact = 0.4;
  const effectiveImpact = Math.max(impactForce, minEffectImpact);
  const grazing = impactForce < minEffectImpact;

  block.hitFlashMs = Math.max(block.hitFlashMs, grazing ? 80 : 140);
  block.damagePulse = Math.min(0.4, block.damagePulse + 0.22);
  block.awake = true;

  const damage =
    (effectiveImpact / Math.max(0.6, block.mass)) * (grazing ? 0.35 : 1);
  block.health = Math.max(0, block.health - damage);
  if (block.health <= block.maxHealth * 0.7) {
    block.cracked = true;
  }
  const shattered = block.health <= 0 && !block.shattered;
  if (shattered) {
    block.shattered = true;
    // Destruction semantics: shattered blocks are immediately out of play.
    // They should not remain as obstacles or collision participants.
    block.knockedOff = true;
    block.falling = false;
    block.velocity.set(0, 0);
    block.rotationVel = 0;
    block.opacity = 0;
    // PH7: strong burst impulse so shattered ice/wood visibly bursts.
    const burstDir = overlap.normal.clone().multiplyScalar(-1);
    block.velocity.x += burstDir.x * 0.2;
    block.velocity.y += 0.2;
    // G5: TNT barrels blast adjacent blocks on shatter (radial impulse + HP).
    if (block.isTnt) {
      const blastRadius = 2.2;
      for (const other of nextBlocks) {
        if (other === block || other.knockedOff || other.shattered) continue;
        const dx = other.position.x - block.position.x;
        const dy = other.position.y - block.position.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > blastRadius * blastRadius) continue;
        const d = Math.max(0.2, Math.sqrt(d2));
        const falloff = 1 - d / blastRadius;
        other.velocity.x += (dx / d) * 7 * falloff;
        other.velocity.y += (dy / d) * 5 * falloff + 2 * falloff;
        other.rotationVel += (Math.random() - 0.5) * 2.4 * falloff;
        other.health = Math.max(0, other.health - 6 * falloff);
        other.falling = true;
        other.awake = true;
        other.cracked = true;
        other.damagePulse = Math.min(0.5, other.damagePulse + 0.35 * falloff);
      }
    }
  } else {
    block.falling = true;
  }

  const transfer = Math.min(
    2.8,
    (effectiveImpact / Math.max(0.6, block.mass)) * 0.5,
  );
  block.velocity.x += impactVel.x * 0.55 + overlap.normal.x * transfer * 0.9;
  block.velocity.y += Math.max(0, impactVel.y * 0.35) + transfer * 0.9;

  // PH8: torque-based rotation. contactPoint - blockCenter, crossed with impactVel.
  const contact = overlap.closestPoint;
  const rX = contact.x - block.position.x;
  const rY = contact.y - block.position.y;
  const torque = rX * impactVel.y - rY * impactVel.x;
  block.rotationVel += torque * 0.04;
  block.rotationVel = Math.max(-2.5, Math.min(2.5, block.rotationVel));

  // PH9: push the bird fully clear of the block along the normal.
  const pushOut = overlap.normal.clone().multiplyScalar(overlap.depth + 0.002);
  nextBird.position.add(pushOut);

  // Partial reflection + forward carry so the bird can punch through.
  // NOTE: we deliberately do NOT add a normal-bounce speed-up term any more;
  // it turned heavy hits into accelerations and produced the weird
  // speed-up/slow-down the player reported. A hard cap below keeps post-impact
  // speed from exceeding the pre-impact speed regardless of mass or angle.
  const forward = nextBird.velocity
    .clone()
    .multiplyScalar(grazing ? 0.7 : GAME_CONFIG.bounceDamping);
  nextBird.velocity.copy(forward);
  const maxPostImpact = Math.min(GAME_CONFIG.maxBirdSpeed, impactSpeed);
  const postSpeed = nextBird.velocity.length();
  if (postSpeed > maxPostImpact && postSpeed > 1e-5) {
    nextBird.velocity.multiplyScalar(maxPostImpact / postSpeed);
  }

  hits.push({
    blockId: block.id,
    impactForce: effectiveImpact,
    heavy: !grazing && impactForce >= GAME_CONFIG.heavyHitForce,
    contact,
    shatter: shattered,
  });

  return { bird: nextBird, blocks: nextBlocks, hits };
}

function blocksIntersect(a: Block, b: Block): boolean {
  return (
    Math.abs(a.position.x - b.position.x) < (a.width + b.width) / 2 - 0.02 &&
    Math.abs(a.position.y - b.position.y) < (a.height + b.height) / 2 - 0.02
  );
}

/** Velocity + rotation clamps to prevent pinwheeling explosions (C4). */
const MAX_BLOCK_SPEED = GAME_CONFIG.maxBlockSpeed;
const MAX_BLOCK_ROT = 2.2;
/** Chain-transfer coefficient. V2: reduced from 0.18 so a hot block
 *  doesn't drag its entire column with it. */
const CHAIN_TRANSFER = 0.08;
/** Minimum frames a block must fail support before going airborne.
 *  V2: raised from 3 → 8 so partial hits don't trigger immediate cascades. */
const UNSUPPORT_FRAMES = 8;

function clampBlock(b: Block): void {
  if (b.velocity.x > MAX_BLOCK_SPEED) b.velocity.x = MAX_BLOCK_SPEED;
  else if (b.velocity.x < -MAX_BLOCK_SPEED) b.velocity.x = -MAX_BLOCK_SPEED;
  if (b.velocity.y > MAX_BLOCK_SPEED) b.velocity.y = MAX_BLOCK_SPEED;
  else if (b.velocity.y < -MAX_BLOCK_SPEED) b.velocity.y = -MAX_BLOCK_SPEED;
  if (b.rotationVel > MAX_BLOCK_ROT) b.rotationVel = MAX_BLOCK_ROT;
  else if (b.rotationVel < -MAX_BLOCK_ROT) b.rotationVel = -MAX_BLOCK_ROT;
}

/**
 * Step block dynamics one sub-frame. Structural support runs with a 3-frame
 * hysteresis so marginal overlaps don't chatter. Pairwise resolution only
 * applies chain-transfer once per (a,b) pair.
 */
export function stepBlocks(blocks: Block[], dt: number): Block[] {
  const next = blocks.map((b) => ({
    ...b,
    position: b.position.clone(),
    velocity: b.velocity.clone(),
  }));

  // Structural support pass — non-falling live blocks lose support if no
  // other live block's top is near their bottom AND they catch > 35% of the
  // footprint (M8). Also counts 3 consecutive frames of no support before
  // flipping to `falling` (PH11).
  for (const b of next) {
    if (b.knockedOff || b.shattered || b.falling) continue;
    const bBottom = b.position.y - b.height / 2;
    const restingOnGround = bBottom <= 0.06;
    if (restingOnGround) {
      b.unsupportedFrames = 0;
      continue;
    }
    const supported = next.some((other) => {
      if (other === b || other.knockedOff || other.shattered) return false;
      const hOverlap =
        (b.width + other.width) / 2 - Math.abs(other.position.x - b.position.x);
      // V2: raised from 0.35 → 0.45 so a slightly-shifted block still counts
      // as supported by its neighbour and doesn't fall unnecessarily.
      if (hOverlap <= b.width * 0.45) return false;
      const gap = bBottom - (other.position.y + other.height / 2);
      return gap > -0.12 && gap < 0.18;
    });
    if (supported) {
      b.unsupportedFrames = 0;
    } else {
      b.unsupportedFrames += 1;
      if (b.unsupportedFrames >= UNSUPPORT_FRAMES) {
        b.falling = true;
        b.awake = true;
      }
    }
  }

  for (const b of next) {
    if (b.knockedOff || b.shattered) continue;
    if (!b.falling) {
      b.velocity.x *= 0.78;
      if (Math.abs(b.velocity.x) < 0.02) b.velocity.x = 0;
      b.rotationVel *= 0.8;
      // Snap to nearest right-angle rotation for resting blocks (M7).
      if (Math.abs(b.rotationVel) < 0.02) {
        const target = Math.round(b.rotation / (Math.PI / 2)) * (Math.PI / 2);
        b.rotation += (target - b.rotation) * Math.min(1, dt * 4);
      }
      continue;
    }

    // PH13: blocks use the same gravity constant as the bird.
    b.velocity.y -= GAME_CONFIG.gravity * dt;
    b.velocity.x *= 0.995;
    b.rotationVel *= 0.99;
    b.position.addScaledVector(b.velocity, dt);
    b.rotation += b.rotationVel * dt;
    clampBlock(b);

    // Unconditional floor clamp — if the block tunneled through in a single
    // big sub-step, snap it back up and kill the normal-component velocity.
    // This is what stops toppled blocks from sinking into (or past) the sand.
    const groundTop = 0;
    const halfH = b.height / 2;
    if (b.position.y - halfH < groundTop) {
      b.position.y = groundTop + halfH;
      if (b.velocity.y < 0) {
        if (Math.abs(b.velocity.x) < 0.25 && Math.abs(b.velocity.y) < 1.4) {
          b.velocity.set(0, 0);
          b.rotationVel = 0;
          b.falling = false;
        } else {
          b.velocity.y *= -0.22;
          b.velocity.x *= 0.55;
          b.rotationVel *= 0.5;
        }
      }
    }
  }

  // Pairwise separation — each unordered pair resolves at most once per frame
  // so chain-transfer doesn't compound into explosive speeds (C4 / PH6).
  for (let i = 0; i < next.length; i += 1) {
    const a = next[i]!;
    if (a.knockedOff || a.shattered) continue;
    for (let j = i + 1; j < next.length; j += 1) {
      const b = next[j]!;
      if (b.knockedOff || b.shattered) continue;
      if (!blocksIntersect(a, b)) continue;
      const dx = b.position.x - a.position.x;
      const dy = b.position.y - a.position.y;
      const overlapX = (a.width + b.width) / 2 - Math.abs(dx);
      const overlapY = (a.height + b.height) / 2 - Math.abs(dy);
      const aHot = a.falling || a.velocity.lengthSq() > 0.05;
      const bHot = b.falling || b.velocity.lengthSq() > 0.05;

      if (overlapX < overlapY) {
        const push = (overlapX / 2) * Math.sign(dx || 1);
        a.position.x -= push;
        b.position.x += push;
        if (aHot && !bHot) {
          b.velocity.x += a.velocity.x * CHAIN_TRANSFER;
          b.velocity.y += Math.max(0, a.velocity.y) * 0.12;
          b.rotationVel += (Math.random() - 0.5) * 1.2;
          b.falling = true;
          b.awake = true;
        } else if (bHot && !aHot) {
          a.velocity.x += b.velocity.x * CHAIN_TRANSFER;
          a.velocity.y += Math.max(0, b.velocity.y) * 0.12;
          a.rotationVel += (Math.random() - 0.5) * 1.2;
          a.falling = true;
          a.awake = true;
        } else {
          const v = (a.velocity.x - b.velocity.x) * 0.2;
          a.velocity.x -= v;
          b.velocity.x += v;
        }
      } else {
        const push = (overlapY / 2) * Math.sign(dy || 1);
        a.position.y -= push;
        b.position.y += push;
        if (dy > 0) {
          if (aHot && !bHot) {
            b.velocity.y = Math.max(b.velocity.y, a.velocity.y * CHAIN_TRANSFER);
            b.velocity.x += a.velocity.x * 0.25;
            b.falling = true;
            b.awake = true;
          } else {
            b.velocity.y = Math.max(b.velocity.y, 0);
            if (!b.falling && Math.abs(b.velocity.y) < 0.1) b.velocity.y = 0;
          }
        } else {
          if (bHot && !aHot) {
            a.velocity.y = Math.max(a.velocity.y, b.velocity.y * CHAIN_TRANSFER);
            a.velocity.x += b.velocity.x * 0.25;
            a.falling = true;
            a.awake = true;
          } else {
            a.velocity.y = Math.max(a.velocity.y, 0);
            if (!a.falling && Math.abs(a.velocity.y) < 0.1) a.velocity.y = 0;
          }
        }
      }
      clampBlock(a);
      clampBlock(b);
    }
  }

  // Toppled detection (C8): a block counts as "toppled" when it has left its
  // original slot by half a block or more, OR rotated past ~35 degrees from
  // upright. This is what makes the tower count as cleared when it falls.
  for (const b of next) {
    if (b.knockedOff || b.shattered || b.toppled) continue;
    const fellFromOrigin = b.initialY - b.position.y > b.height * 0.55;
    const rotated = Math.abs(normalizeAngle(b.rotation)) > 0.6;
    if (fellFromOrigin || rotated) {
      // Only count as toppled if it has come to rest OR has left the tower.
      // Small speed threshold so airborne pieces don't tick in-flight.
      if (b.velocity.lengthSq() < 1.0 || b.position.y <= b.height) {
        b.toppled = true;
      }
    }
  }

  // Final hard floor clamp after pairwise separation/topple updates.
  // Pairwise push-out can move blocks slightly below y=0 after the main floor
  // clamp above; this pass guarantees nothing finishes a frame under ground.
  for (const b of next) {
    if (b.knockedOff || b.shattered) continue;
    const halfH = b.height / 2;
    const minY = halfH;
    if (b.position.y < minY) {
      b.position.y = minY;
      if (b.velocity.y < 0) b.velocity.y = 0;
      if (Math.abs(b.velocity.x) < 0.15 && b.velocity.lengthSq() < 0.08) {
        b.velocity.set(0, 0);
        b.rotationVel = 0;
        if (!b.toppled) b.toppled = true;
        b.falling = false;
      }
    }
  }

  return next;
}

/** Clamp radians to (-pi, pi] for a stable "how far from upright" check. */
function normalizeAngle(rad: number): number {
  let r = rad % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

export function updateBlockVisuals(blocks: Block[], dt: number): Block[] {
  return blocks.map((b) => {
    const next = { ...b };
    next.hitFlashMs = Math.max(0, next.hitFlashMs - dt * 1000);
    next.damagePulse = Math.max(0, next.damagePulse - dt * 2.2);
    if (next.knockedOff || next.shattered) {
      const rate = next.shattered ? 2.2 : 1.6;
      next.opacity = Math.max(0, next.opacity - dt * rate);
    } else if (next.toppled) {
      // Debris remains visible for readability, but clearly de-emphasized.
      next.opacity = Math.max(0.28, next.opacity - dt * 0.9);
    } else {
      // Active structure blocks recover to full opacity.
      next.opacity = Math.min(1, next.opacity + dt * 1.2);
    }
    return next;
  });
}

export function isBirdOutOfBounds(bird: Bird): boolean {
  const { minX, maxX, minY, maxY } = GAME_CONFIG.worldBounds;
  return (
    bird.position.x < minX ||
    bird.position.x > maxX ||
    bird.position.y < minY ||
    bird.position.y > maxY
  );
}

export function resolveGroundCollision(bird: Bird): Bird {
  // PH2: bird ground line matches block ground (y=0).
  // Unconditional floor clamp — if the bird's bottom would end up below the
  // ground plane we snap it up regardless of velocity sign. This prevents
  // tunneling at high speeds (which is what caused the "phases through the
  // floor" bug on heavy shots).
  const groundY = bird.radius;
  if (bird.position.y < groundY) {
    const next = { ...bird, position: bird.position.clone(), velocity: bird.velocity.clone() };
    next.position.y = groundY;
    if (next.velocity.y < 0) {
      next.velocity.y *= -0.2;
      next.velocity.x *= 0.82;
    }
    return next;
  }
  return bird;
}

/**
 * Ballistic trajectory preview using the reference Angry Birds formula:
 * `p(t) = p0 + v0*t + 0.5*g*t^2`. This matches `SlingShooter.DisplayTrajectory`
 * in the reference Unity project and the motion that planck will actually
 * integrate under constant gravity.
 */
export function sampleTrajectoryDots(
  startPos: Vector2,
  initialVelocity: Vector2,
  opts?: { maxSteps?: number; maxTime?: number; stopX?: number },
): Vector2[] {
  const maxSteps = opts?.maxSteps ?? 64;
  const maxTime = opts?.maxTime ?? 2.4;
  const stopX = opts?.stopX;
  const gY = -GAME_CONFIG.gravity;
  const dots: Vector2[] = [];
  const dt = maxTime / maxSteps;
  for (let i = 1; i <= maxSteps; i += 1) {
    const t = i * dt;
    const x = startPos.x + initialVelocity.x * t;
    const y = startPos.y + initialVelocity.y * t + 0.5 * gY * t * t;
    if (y < -2) break;
    if (x > GAME_CONFIG.worldBounds.maxX + 2) break;
    if (stopX != null && x >= stopX) break;
    dots.push(new Vector2(x, y));
  }
  return dots;
}
