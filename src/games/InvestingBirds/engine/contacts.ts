import type { Body, Contact, ContactImpulse } from 'planck';
import { GAME_CONFIG } from '../config';
import type { BodyUserData } from './bodies';
import type { Engine } from './world';

/**
 * A single impact recorded by the contact listener. Consumed by SimDriver
 * each frame to apply damage, emit dust, and score block destruction.
 */
export interface ImpactEvent {
  /** Which side of the pair was a bird (if any). Null for block-on-block. */
  bird: Body | null;
  /** The block involved (non-null for bird-block and block-block). */
  block: Body;
  /** A second block when this was a block-block impact. */
  otherBlock: Body | null;
  /** Speed (m/s) used to compute damage — either |bird.v| or |Δv|. */
  impactSpeed: number;
  /** World-space contact point (for floaters/dust). */
  contactX: number;
  contactY: number;
  /** Classification: bird-block = 'primary'; block-block = 'secondary'. */
  kind: 'bird-block' | 'block-block' | 'ground';
}

/**
 * Registered contact queue. Live list cleared per frame by the SimDriver.
 * We buffer here rather than dispatching directly because planck locks
 * the world while listeners run — destroying bodies or mutating state
 * must happen AFTER the step completes.
 */
export interface ContactBuffer {
  impacts: ImpactEvent[];
  /** Latest recorded |v| for each bird body (keyed by birdId), so the
   *  driver can feed the Angry Birds `minVelocity` rest check. */
  lastBirdSpeed: Map<string, number>;
}

export function createContactBuffer(): ContactBuffer {
  return { impacts: [], lastBirdSpeed: new Map() };
}

function tagOf(body: Body): BodyUserData | null {
  const ud = body.getUserData();
  return (ud as BodyUserData | null) ?? null;
}

function contactPoint(contact: Contact): { x: number; y: number } {
  const manifold = contact.getWorldManifold(null);
  if (manifold && manifold.points.length > 0) {
    const p = manifold.points[0]!;
    return { x: p.x, y: p.y };
  }
  const bodyA = contact.getFixtureA().getBody();
  const p = bodyA.getPosition();
  return { x: p.x, y: p.y };
}

/**
 * Subscribe to the planck world's post-solve callback. Planck delivers
 * the `ContactImpulse` separately from the `Contact`, which is exactly
 * what we need to compute velocity-based damage the way `Enemy.cs` does
 * in the Angry Birds reference (`damage = velocity.magnitude * k`).
 */
export function installContactListener(
  engine: Engine,
  buffer: ContactBuffer,
): () => void {
  const world = engine.world;

  const onPostSolve = (contact: Contact, _impulse: ContactImpulse) => {
    const bodyA = contact.getFixtureA().getBody();
    const bodyB = contact.getFixtureB().getBody();
    const ta = tagOf(bodyA);
    const tb = tagOf(bodyB);
    if (!ta || !tb) return;

    // Ignore sensor-only contacts; killzones are handled via begin-contact.
    if (ta.kind === 'killzone' || tb.kind === 'killzone') return;

    const pt = contactPoint(contact);

    // Bird vs Block: instant-kill behaviour is handled in the driver via
    // damage deposits, mirroring Enemy.cs where bird contact = dies.
    if ((ta.kind === 'bird' && tb.kind === 'block') ||
        (tb.kind === 'bird' && ta.kind === 'block')) {
      const birdBody = ta.kind === 'bird' ? bodyA : bodyB;
      const blockBody = ta.kind === 'block' ? bodyA : bodyB;
      const v = birdBody.getLinearVelocity();
      const speed = Math.hypot(v.x, v.y);
      if (speed < GAME_CONFIG.minImpactSpeed) return;
      buffer.impacts.push({
        bird: birdBody,
        block: blockBody,
        otherBlock: null,
        impactSpeed: speed,
        contactX: pt.x,
        contactY: pt.y,
        kind: 'bird-block',
      });
      return;
    }

    // Block vs Block: reference `Enemy.OnCollisionEnter2D` uses the
    // colliding obstacle's |velocity| as the damage scalar. We use
    // relative velocity to match both stationary-target and mutual-motion
    // scenarios.
    if (ta.kind === 'block' && tb.kind === 'block') {
      const va = bodyA.getLinearVelocity();
      const vb = bodyB.getLinearVelocity();
      const rx = va.x - vb.x;
      const ry = va.y - vb.y;
      const rel = Math.hypot(rx, ry);
      if (rel < 1.2) return; // small taps never damage — keeps settled stacks quiet
      buffer.impacts.push({
        bird: null,
        block: bodyA,
        otherBlock: bodyB,
        impactSpeed: rel,
        contactX: pt.x,
        contactY: pt.y,
        kind: 'block-block',
      });
      return;
    }

    // Anything hitting the ground: emit a low-priority impact event for
    // dust puffs.
    if (ta.kind === 'ground' || tb.kind === 'ground') {
      const other = ta.kind === 'ground' ? bodyB : bodyA;
      const otherTag = ta.kind === 'ground' ? tb : ta;
      const v = other.getLinearVelocity();
      const speed = Math.hypot(v.x, v.y);
      if (speed < 1.5) return;
      buffer.impacts.push({
        bird: otherTag.kind === 'bird' ? other : null,
        block: otherTag.kind === 'block' ? other : other,
        otherBlock: null,
        impactSpeed: speed,
        contactX: pt.x,
        contactY: 0.08,
        kind: 'ground',
      });
    }
  };

  world.on('post-solve', onPostSolve);
  return () => world.off('post-solve', onPostSolve);
}
