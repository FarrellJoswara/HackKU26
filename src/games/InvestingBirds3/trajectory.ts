import { Vector2 } from 'three';
import { CAMERA_DESIGN, GAME_TUNING } from './config';

export function velocityFromDrag(
  anchorX: number,
  anchorY: number,
  dragX: number,
  dragY: number,
): { vx: number; vy: number } {
  const pullX = anchorX - dragX;
  const pullY = anchorY - dragY;
  const len = Math.hypot(pullX, pullY);
  const cap = GAME_TUNING.maxDrag;
  const scale = len > cap ? cap / Math.max(len, 1e-6) : 1;
  const k = GAME_TUNING.launchImpulseScale;
  return { vx: pullX * scale * k, vy: pullY * scale * k };
}

export function sampleTrajectoryDots(
  startX: number,
  startY: number,
  vx: number,
  vy: number,
  maxSteps = 56,
  maxTime = 2.2,
): Vector2[] {
  const dots: Vector2[] = [];
  const dt = maxTime / maxSteps;
  const gy = GAME_TUNING.gravityY;
  for (let i = 1; i < maxSteps; i += 1) {
    const t = i * dt;
    const x = startX + vx * t;
    const y = startY + vy * t + 0.5 * gy * t * t;
    if (y < GAME_TUNING.killY - 0.5) break;
    if (x > CAMERA_DESIGN.right + 6) break;
    dots.push(new Vector2(x, y));
  }
  return dots;
}
