import { Vector2 } from 'three';
import { GAME_CONFIG } from './config';
import type { Bird, Block } from './types';

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

export function createBird(): Bird {
  return {
    position: new Vector2(GAME_CONFIG.launchAnchor.x, GAME_CONFIG.launchAnchor.y),
    velocity: new Vector2(0, 0),
    radius: GAME_CONFIG.birdRadius,
    launched: false,
    active: true,
    settledMs: 0,
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

export function applyGravityAndDrag(velocity: Vector2, dt: number): void {
  velocity.y -= GAME_CONFIG.gravity * dt;
  velocity.multiplyScalar(GAME_CONFIG.dragDamping);
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

function circleAabbOverlap(bird: Bird, block: Block): { hit: boolean; normal: Vector2 } {
  const minX = block.position.x - block.width / 2;
  const maxX = block.position.x + block.width / 2;
  const minY = block.position.y - block.height / 2;
  const maxY = block.position.y + block.height / 2;
  const closestX = Math.max(minX, Math.min(bird.position.x, maxX));
  const closestY = Math.max(minY, Math.min(bird.position.y, maxY));
  const dx = bird.position.x - closestX;
  const dy = bird.position.y - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq > bird.radius * bird.radius) {
    return { hit: false, normal: new Vector2(0, 0) };
  }
  const normal = new Vector2(dx, dy);
  if (normal.lengthSq() === 0) normal.set(0, 1);
  else normal.normalize();
  return { hit: true, normal };
}

export interface HitEvent {
  blockId: string;
  impactForce: number;
  heavy: boolean;
}

export interface CollisionResult {
  bird: Bird;
  blocks: Block[];
  hits: HitEvent[];
}

/**
 * Bird↔block collision. Unlike chip-damage scoring, this version transfers
 * momentum into the block so it actually flies off the stack. Scoring is
 * awarded elsewhere, only once a block leaves the ground.
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

  for (const block of nextBlocks) {
    if (block.knockedOff) continue;
    const overlap = circleAabbOverlap(nextBird, block);
    if (!overlap.hit) continue;

    const impactVel = nextBird.velocity.clone();
    const impactForce = impactVel.length() * GAME_CONFIG.birdMassFactor;
    if (impactForce < 0.4) continue;

    block.hitFlashMs = 120;
    block.damagePulse = Math.min(0.35, block.damagePulse + 0.18);
    block.falling = true;

    const damage = impactForce / Math.max(0.6, block.mass);
    block.health = Math.max(0, block.health - damage);
    if (block.health <= block.maxHealth * 0.55) {
      block.cracked = true;
    }

    const transfer = Math.min(1.6, impactForce / Math.max(0.6, block.mass) * 0.22);
    block.velocity.x += impactVel.x * 0.35 * transfer * 0.18 + overlap.normal.x * transfer * 0.6;
    block.velocity.y += impactVel.y * 0.25 * transfer * 0.18 + Math.max(0.4, transfer) * 0.6;
    block.rotationVel += (Math.random() - 0.5) * 4 + impactVel.x * 0.05;

    const pushOut = overlap.normal.clone().multiplyScalar(0.1);
    nextBird.position.add(pushOut);
    const dot = nextBird.velocity.dot(overlap.normal);
    const reflected = nextBird.velocity
      .clone()
      .sub(overlap.normal.clone().multiplyScalar(2 * dot))
      .multiplyScalar(GAME_CONFIG.bounceDamping);
    nextBird.velocity.copy(reflected);

    hits.push({
      blockId: block.id,
      impactForce,
      heavy: impactForce >= 7.5,
    });
  }

  return { bird: nextBird, blocks: nextBlocks, hits };
}

/** AABB intersection between two blocks (not the bird). */
function blocksIntersect(a: Block, b: Block): boolean {
  return (
    Math.abs(a.position.x - b.position.x) < (a.width + b.width) / 2 - 0.02 &&
    Math.abs(a.position.y - b.position.y) < (a.height + b.height) / 2 - 0.02
  );
}

/**
 * Very lightweight block-block resolution: any live block is "supported" if
 * another live block sits directly below (or it is resting on the ground).
 * Unsupported blocks wake and fall. Blocks already falling continue under
 * gravity until they leave the kill floor.
 */
export function stepBlocks(blocks: Block[], dt: number): Block[] {
  const next = blocks.map((b) => ({
    ...b,
    position: b.position.clone(),
    velocity: b.velocity.clone(),
  }));

  // Structural support pass — non-falling live blocks lose support if the
  // block directly below is gone.
  for (const b of next) {
    if (b.knockedOff || b.falling) continue;
    const restingOnGround = b.position.y - b.height / 2 <= 0.05;
    if (restingOnGround) continue;
    const supported = next.some(
      (other) =>
        other !== b &&
        !other.knockedOff &&
        Math.abs(other.position.x - b.position.x) < (b.width + other.width) / 2 - 0.12 &&
        other.position.y < b.position.y &&
        b.position.y - (other.position.y + other.height / 2) < 0.25,
    );
    if (!supported) {
      b.falling = true;
    }
  }

  for (const b of next) {
    if (b.knockedOff) continue;
    if (!b.falling) {
      b.velocity.x *= 0.78;
      if (Math.abs(b.velocity.x) < 0.02) b.velocity.x = 0;
      b.rotationVel *= 0.8;
      continue;
    }

    b.velocity.y -= GAME_CONFIG.gravity * dt * 0.82;
    b.velocity.x *= 0.995;
    b.rotationVel *= 0.99;
    b.position.addScaledVector(b.velocity, dt);
    b.rotation += b.rotationVel * dt;

    const groundTop = 0;
    const halfH = b.height / 2;
    if (b.position.y - halfH <= groundTop && b.velocity.y < 0) {
      if (Math.abs(b.velocity.x) < 0.2 && Math.abs(b.velocity.y) < 1.2) {
        b.position.y = groundTop + halfH;
        b.velocity.set(0, 0);
        b.rotationVel = 0;
        b.falling = false;
      } else {
        b.position.y = groundTop + halfH;
        b.velocity.y *= -0.25;
        b.velocity.x *= 0.6;
        b.rotationVel *= 0.5;
      }
    }
  }

  // Simple pairwise separation for overlapping falling/moving blocks. Coarse
  // O(n^2) but block counts are modest.
  for (let i = 0; i < next.length; i += 1) {
    const a = next[i]!;
    if (a.knockedOff) continue;
    for (let j = i + 1; j < next.length; j += 1) {
      const b = next[j]!;
      if (b.knockedOff) continue;
      if (!blocksIntersect(a, b)) continue;
      const dx = b.position.x - a.position.x;
      const dy = b.position.y - a.position.y;
      const overlapX = (a.width + b.width) / 2 - Math.abs(dx);
      const overlapY = (a.height + b.height) / 2 - Math.abs(dy);
      if (overlapX < overlapY) {
        const push = (overlapX / 2) * Math.sign(dx || 1);
        a.position.x -= push;
        b.position.x += push;
        const v = (a.velocity.x - b.velocity.x) * 0.25;
        a.velocity.x -= v;
        b.velocity.x += v;
      } else {
        const push = (overlapY / 2) * Math.sign(dy || 1);
        a.position.y -= push;
        b.position.y += push;
        if (dy > 0) {
          b.velocity.y = Math.max(b.velocity.y, 0);
          if (!b.falling && Math.abs(b.velocity.y) < 0.1) b.velocity.y = 0;
        } else {
          a.velocity.y = Math.max(a.velocity.y, 0);
          if (!a.falling && Math.abs(a.velocity.y) < 0.1) a.velocity.y = 0;
        }
      }
    }
  }

  return next;
}

/**
 * Decay visual-only state (hit flash, scale pulse). Knocked-off blocks fade
 * out so renderer can stop drawing them.
 */
export function updateBlockVisuals(blocks: Block[], dt: number): Block[] {
  return blocks.map((b) => {
    const next = { ...b };
    next.hitFlashMs = Math.max(0, next.hitFlashMs - dt * 1000);
    next.damagePulse = Math.max(0, next.damagePulse - dt * 2.2);
    if (next.knockedOff) next.opacity = Math.max(0, next.opacity - dt * 1.6);
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
  const groundY = 0.2 + bird.radius;
  if (bird.position.y <= groundY && bird.velocity.y < 0) {
    const next = { ...bird, position: bird.position.clone(), velocity: bird.velocity.clone() };
    next.position.y = groundY;
    next.velocity.y *= -0.25;
    next.velocity.x *= 0.85;
    return next;
  }
  return bird;
}

export function sampleTrajectoryDots(
  startPos: Vector2,
  initialVelocity: Vector2,
  opts?: { maxSteps?: number; maxTime?: number },
): Vector2[] {
  const maxSteps = opts?.maxSteps ?? 90;
  const maxTime = opts?.maxTime ?? 2.2;
  const pos = startPos.clone();
  const vel = initialVelocity.clone();
  const dots: Vector2[] = [];
  let t = 0;
  for (let i = 0; i < maxSteps && t < maxTime; i += 1) {
    applyGravityAndDrag(vel, GAME_CONFIG.fixedStep);
    pos.addScaledVector(vel, GAME_CONFIG.fixedStep);
    t += GAME_CONFIG.fixedStep;
    if (i % 3 === 0) dots.push(pos.clone());
    if (pos.y < -3) break;
    if (pos.x > GAME_CONFIG.worldBounds.maxX + 2) break;
  }
  return dots;
}
