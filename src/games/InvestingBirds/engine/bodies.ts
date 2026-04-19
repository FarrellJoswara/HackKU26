/**
 * @file Planck body factories and sync — bird circle, block polygons, launch/place.
 */

import {
  BoxShape,
  CircleShape,
  Vec2,
  type Body,
} from 'planck';
import { GAME_CONFIG } from '../config';
import type { Bird, Block, BlockMaterial, LevelType } from '../types';
import type { Engine } from './world';

/**
 * Discriminated user-data tag attached to every planck.Body we create.
 * Contact listeners read `.getUserData() as BodyUserData` to decide what
 * kind of collision this is.
 */
export type BodyUserData =
  | { kind: 'block'; blockId: string }
  | { kind: 'bird'; birdId: string }
  | { kind: 'ground' }
  | { kind: 'killzone' };

/**
 * Translate (LevelType, BlockMaterial) into Box2D fixture tunables. Higher
 * density = heavier blocks (bigger block-on-block damage via the v*k rule
 * in the reference Enemy.cs). Restitution low so towers don't jitter. We
 * boost friction on stone so stacks settle quickly.
 */
function fixtureDefsForBlock(
  type: LevelType,
  material: BlockMaterial,
): { density: number; friction: number; restitution: number } {
  const baseByType: Record<LevelType, { density: number; friction: number; restitution: number }> = {
    bonds:  { density: 0.9,  friction: 0.60, restitution: 0.05 },
    etfs:   { density: 1.1,  friction: 0.55, restitution: 0.05 },
    stocks: { density: 1.25, friction: 0.50, restitution: 0.04 },
    crypto: { density: 0.9,  friction: 0.20, restitution: 0.15 },
  };
  const matMul: Record<BlockMaterial, { density: number; friction: number; restitution: number }> = {
    wood:  { density: 0.9,  friction: 0.95, restitution: 0.95 },
    stone: { density: 1.25, friction: 1.05, restitution: 0.80 },
    ice:   { density: 0.75, friction: 0.55, restitution: 1.30 },
  };
  const b = baseByType[type];
  const m = matMul[material];
  return {
    density: b.density * m.density,
    friction: Math.min(1.2, b.friction * m.friction),
    restitution: Math.min(0.35, b.restitution * m.restitution),
  };
}

/**
 * Build a planck body for a block. The block's mirror data (position,
 * rotation, velocity, width/height) is used to place the fixture. The
 * block gains a back-reference to its body and vice versa.
 */
export function createBlockBody(
  engine: Engine,
  block: Block,
): Body {
  const { world } = engine;
  const body = world.createBody({
    type: 'dynamic',
    position: new Vec2(block.position.x, block.position.y),
    angle: block.rotation,
    linearDamping: 0.02,
    angularDamping: 0.3,
    allowSleep: true,
  });

  const fix = fixtureDefsForBlock(block.type, block.material);
  body.createFixture(
    new BoxShape(block.width / 2, block.height / 2),
    {
      density: fix.density,
      friction: fix.friction,
      restitution: fix.restitution,
    },
  );
  body.resetMassData();
  body.setUserData({ kind: 'block', blockId: block.id } satisfies BodyUserData);
  return body;
}

/**
 * Build a planck body for the currently-loaded bird. The body starts as
 * KINEMATIC (same as `Bird.Start` in the reference, which disables the
 * rigidbody until `Shoot` is called). When the player launches, the
 * SimDriver flips it to dynamic and sets linear velocity.
 */
export function createBirdBody(
  engine: Engine,
  bird: Bird,
  birdId: string,
): Body {
  const { world } = engine;
  const body = world.createBody({
    type: 'kinematic',
    position: new Vec2(bird.position.x, bird.position.y),
    bullet: true,
    linearDamping: GAME_CONFIG.bird.linearDamping,
    angularDamping: GAME_CONFIG.bird.angularDamping,
    allowSleep: true,
    fixedRotation: false,
  });
  body.createFixture(new CircleShape(bird.radius), {
    density: 2.2,
    friction: GAME_CONFIG.bird.friction,
    restitution: GAME_CONFIG.bird.restitution,
  });
  body.resetMassData();
  body.setUserData({ kind: 'bird', birdId } satisfies BodyUserData);
  return body;
}

/**
 * Convert a launched bird to a dynamic body with an initial velocity,
 * matching the reference `Bird.Shoot(velocity, distance, speed)` where
 * `RigidBody.velocity = velocity * speed * distance` (quadratic in drag
 * length, which is what gives Angry Birds its satisfying "power shot"
 * feel).
 */
export function launchBirdBody(
  body: Body,
  pull: { x: number; y: number },
): void {
  const dragLen = Math.hypot(pull.x, pull.y);
  const throwSpeed = GAME_CONFIG.bird.throwSpeed;
  body.setType('dynamic');
  // Must stay enabled on dynamic bodies so continuous collision vs moving blocks works.
  body.setBullet(true);
  body.setLinearVelocity(
    new Vec2(pull.x * throwSpeed * dragLen, pull.y * throwSpeed * dragLen),
  );
  body.setAngularVelocity(0);
}

/**
 * Copy body transform/velocity back into the plain-data `Block`. Visual
 * state (opacity, hitFlash, cracked) is left untouched; the SimDriver
 * manages that separately.
 */
export function syncBlockFromBody(block: Block, body: Body): void {
  const p = body.getPosition();
  block.position.set(p.x, p.y);
  block.rotation = body.getAngle();
  const v = body.getLinearVelocity();
  block.velocity.set(v.x, v.y);
  block.rotationVel = body.getAngularVelocity();
  if (!block.awake && body.isAwake() && (v.x * v.x + v.y * v.y) > 0.02) {
    block.awake = true;
  }
  if (block.awake && !block.falling && (v.x * v.x + v.y * v.y) > 0.12) {
    block.falling = true;
  }
}

/**
 * Copy body transform/velocity back into the plain-data `Bird`.
 */
export function syncBirdFromBody(bird: Bird, body: Body): void {
  const p = body.getPosition();
  bird.position.set(p.x, p.y);
  const v = body.getLinearVelocity();
  bird.velocity.set(v.x, v.y);
}

/**
 * Move a kinematic bird body to a specific world point (used while the
 * player drags the slingshot pouch around).
 */
export function placeBirdBody(body: Body, x: number, y: number): void {
  body.setTransform(new Vec2(x, y), body.getAngle());
  body.setLinearVelocity(new Vec2(0, 0));
}
