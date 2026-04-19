import {
  AABB,
  Box,
  Circle,
  type Body,
  type Contact,
  type ContactImpulse,
  type Fixture,
  Vec2,
  World,
} from 'planck';
import { GAME_TUNING, towerHeightFromShare } from './config';
import type { BodyUserData, LevelType, RoundPlan } from './types';

const { plankHalfW, plankHalfH } = GAME_TUNING;

export interface PigState {
  hp: number;
  alive: boolean;
}

export interface RoundSimulation {
  world: World;
  bird: Body;
  pig: Body;
  pigState: PigState;
  blocks: Body[];
  variant: LevelType;
  multiplier: number;
  slingAnchor: Vec2;
  onPostSolve: (contact: Contact, impulse: ContactImpulse) => void;
  dispose(): void;
}

function tagFixture(fx: Fixture, data: BodyUserData): void {
  fx.setUserData(data);
}

function addGround(world: World): void {
  const g = world.createBody({ type: 'static', position: Vec2(0, -0.35) });
  const fx = g.createFixture(
    Box(48, 0.45, Vec2(0, 0)),
    { friction: 0.85, restitution: 0.02 },
  );
  tagFixture(fx, { role: 'ground' });
}

function addBlock(
  world: World,
  center: Vec2,
  angle: number,
  levelType: LevelType,
): Body {
  const b = world.createBody({
    type: 'dynamic',
    position: center,
    angle,
    linearDamping: 0.08,
    angularDamping: 0.25,
  });
  b.setUserData({ offstageScored: false });
  const fx = b.createFixture(
    Box(plankHalfW, plankHalfH),
    { density: 0.82, friction: 0.75, restitution: 0.04 },
  );
  tagFixture(fx, { role: 'block', levelType });
  return b;
}

function stackColumn(
  world: World,
  baseX: number,
  count: number,
  levelType: LevelType,
): Body[] {
  const out: Body[] = [];
  const bottomY = GAME_TUNING.plankHalfH;
  for (let i = 0; i < count; i += 1) {
    const y = bottomY + i * (plankHalfH * 2 + 0.02);
    out.push(addBlock(world, Vec2(baseX, y), 0, levelType));
  }
  return out;
}

function layoutForVariant(plan: RoundPlan, world: World): {
  blocks: Body[];
  pigPos: Vec2;
} {
  const h = towerHeightFromShare(plan.share);
  const t = plan.type;
  const blocks: Body[] = [];

  if (t === 'etfs') {
    const cols = 3;
    const spread = 2.15;
    const startX = 4.2;
    const perCol = Math.max(3, Math.min(8, Math.round(h * 0.65)));
    for (let c = 0; c < cols; c += 1) {
      blocks.push(...stackColumn(world, startX + c * spread, perCol, t));
    }
    const pigX = startX + spread;
    const pigY =
      perCol * (plankHalfH * 2 + 0.02) + GAME_TUNING.pigRadius + plankHalfH;
    return { blocks, pigPos: Vec2(pigX, pigY) };
  }

  if (t === 'bonds') {
    const cols = 4;
    const low = Math.max(3, Math.min(5, Math.round(h * 0.45)));
    for (let c = 0; c < cols; c += 1) {
      blocks.push(...stackColumn(world, 4.0 + c * 1.05, low, t));
    }
    const pigX = 5.55;
    const pigY = low * (plankHalfH * 2 + 0.02) + GAME_TUNING.pigRadius;
    return { blocks, pigPos: Vec2(pigX, pigY) };
  }

  if (t === 'crypto') {
    const cols = 2;
    const tilt = 0.09;
    const baseX = 5.0;
    const mid = Math.max(4, Math.min(9, h));
    for (let c = 0; c < cols; c += 1) {
      const xo = c * 1.35;
      for (let i = 0; i < mid; i += 1) {
        const y = plankHalfH + i * (plankHalfH * 2 + 0.03);
        blocks.push(
          addBlock(world, Vec2(baseX + xo + i * 0.04, y), c === 0 ? tilt : -tilt, t),
        );
      }
    }
    const pigY = mid * (plankHalfH * 2 + 0.03) + GAME_TUNING.pigRadius;
    return { blocks, pigPos: Vec2(baseX + 0.65, pigY) };
  }

  // stocks — single tall column
  blocks.push(...stackColumn(world, 5.4, h, t));
  const pigY = h * (plankHalfH * 2 + 0.02) + GAME_TUNING.pigRadius;
  return { blocks, pigPos: Vec2(5.4, pigY) };
}

function addPig(world: World, pos: Vec2): { body: Body; state: PigState } {
  const st: PigState = { hp: GAME_TUNING.pigMaxHp, alive: true };
  const body = world.createBody({
    type: 'dynamic',
    position: pos.clone(),
    linearDamping: 0.12,
    angularDamping: 0.4,
  });
  const fx = body.createFixture(Circle(GAME_TUNING.pigRadius), {
    density: 0.55,
    friction: 0.55,
    restitution: 0.12,
  });
  tagFixture(fx, { role: 'pig' });
  return { body, state: st };
}

function addBird(world: World, anchor: Vec2, variant: LevelType): Body {
  const density = variant === 'bonds' ? 1.45 : 1.12;
  const body = world.createBody({
    type: 'static',
    position: anchor.clone(),
    bullet: true,
  });
  const fx = body.createFixture(Circle(GAME_TUNING.birdRadius), {
    density,
    friction: 0.35,
    restitution: 0.15,
  });
  tagFixture(fx, { role: 'bird', levelType: variant });
  body.setLinearDamping(GAME_TUNING.birdLinearDamping);
  body.setAngularDamping(GAME_TUNING.birdAngularDamping);
  return body;
}

function readFixtureTag(fx: Fixture): BodyUserData | null {
  const u = fx.getUserData();
  return u && typeof u === 'object' && 'role' in u ? (u as BodyUserData) : null;
}

export function createRoundSimulation(plan: RoundPlan): RoundSimulation {
  const world = new World(Vec2(0, GAME_TUNING.gravityY));
  world.setAllowSleeping(true);

  addGround(world);

  const { blocks, pigPos } = layoutForVariant(plan, world);
  const { body: pig, state: pigState } = addPig(world, pigPos);

  const sling = Vec2(GAME_TUNING.slingAnchor.x, GAME_TUNING.slingAnchor.y);
  const bird = addBird(world, sling, plan.type);

  const onPostSolve = (contact: Contact, impulse: ContactImpulse): void => {
    if (!contact.isTouching()) return;
    const fa = contact.getFixtureA();
    const fb = contact.getFixtureB();
    const ta = readFixtureTag(fa);
    const tb = readFixtureTag(fb);
    if (!ta || !tb) return;

    let impulseSum = 0;
    for (const n of impulse.normalImpulses) impulseSum += n;

    const hitPig =
      (ta.role === 'bird' && tb.role === 'pig') ||
      (ta.role === 'pig' && tb.role === 'bird');
    if (hitPig && pigState.alive && impulseSum > 0.15) {
      pigState.hp -= impulseSum * GAME_TUNING.pigDamagePerImpulse;
      if (pigState.hp <= 0) {
        pigState.alive = false;
      }
    }
  };

  world.on('post-solve', onPostSolve);

  return {
    world,
    bird,
    pig,
    pigState,
    blocks,
    variant: plan.type,
    multiplier: plan.multiplier,
    slingAnchor: sling,
    onPostSolve,
    dispose() {
      world.off('post-solve', onPostSolve);
      let b = world.getBodyList();
      while (b) {
        const next = b.getNext();
        world.destroyBody(b);
        b = next;
      }
    },
  };
}

export function launchBird(bird: Body, anchor: Vec2, dragEnd: Vec2): void {
  bird.setType('dynamic');
  bird.setAwake(true);
  const pull = Vec2(anchor.x - dragEnd.x, anchor.y - dragEnd.y);
  const len = pull.length();
  const cap = GAME_TUNING.maxDrag;
  const scale =
    len > cap ? cap / Math.max(len, 1e-6) : 1;
  const vx = pull.x * scale * GAME_TUNING.launchImpulseScale;
  const vy = pull.y * scale * GAME_TUNING.launchImpulseScale;
  bird.setLinearVelocity(Vec2(vx, vy));
}

export function resetBird(bird: Body, anchor: Vec2): void {
  bird.setType('static');
  bird.setTransform(anchor, 0);
  bird.setLinearVelocity(Vec2.zero());
  bird.setAngularVelocity(0);
}

/** ETFs: nudge dynamic blocks in an AABB around the bird. */
export function applyEtfRipple(world: World, bird: Body): void {
  const p = bird.getPosition();
  const r = GAME_TUNING.etfRippleRadius;
  const aabb = new AABB(Vec2(p.x - r, p.y - r), Vec2(p.x + r, p.y + r));
  world.queryAABB(aabb, (fx: Fixture) => {
    const tag = readFixtureTag(fx);
    if (tag?.role !== 'block') return true;
    const b = fx.getBody();
    if (b.getType() !== 'dynamic') return true;
    const bp = b.getPosition();
    const d = Vec2(bp.x - p.x, bp.y - p.y);
    const m = d.length();
    if (m < 1e-3) return true;
    d.mul(1 / m);
    b.applyLinearImpulse(
      Vec2(d.x * GAME_TUNING.etfRippleImpulse, d.y * GAME_TUNING.etfRippleImpulse),
      bp,
      true,
    );
    return true;
  });
}

/** Crypto: radial impulse to neighbors. */
export function applyCryptoBlast(world: World, bird: Body): void {
  const p = bird.getPosition();
  const r = GAME_TUNING.cryptoBlastRadius;
  const aabb = new AABB(Vec2(p.x - r, p.y - r), Vec2(p.x + r, p.y + r));
  const K = GAME_TUNING.cryptoBlastImpulse;
  world.queryAABB(aabb, (fx: Fixture) => {
    const tag = readFixtureTag(fx);
    if (tag?.role !== 'block' && tag?.role !== 'pig') return true;
    const b = fx.getBody();
    if (b.getType() !== 'dynamic') return true;
    const bp = b.getPosition();
    const d = Vec2(bp.x - p.x, bp.y - p.y);
    const m = d.length();
    if (m < 1e-3 || m > r) return true;
    const f = (1 - m / r) * K;
    d.mul(f / m);
    b.applyLinearImpulse(d, bp, true);
    return true;
  });
}

/** Stocks: impulse along current velocity. */
export function applyStocksBoost(bird: Body): void {
  const v = bird.getLinearVelocity();
  const m = v.length();
  if (m < 1e-3) return;
  const nx = v.x / m;
  const ny = v.y / m;
  bird.applyLinearImpulse(
    Vec2(nx * GAME_TUNING.stocksBoostImpulse, ny * GAME_TUNING.stocksBoostImpulse),
    bird.getWorldCenter(),
    true,
  );
}
