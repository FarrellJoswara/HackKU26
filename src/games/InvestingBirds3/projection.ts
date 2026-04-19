/** World↔screen helpers aligned with InvestingBirds2 `projection.ts`. */

export interface Frustum {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ViewportPx {
  width: number;
  height: number;
}

export function computeFrustum(viewport: ViewportPx, design: Frustum): Frustum {
  const vw = Math.max(1, viewport.width);
  const vh = Math.max(1, viewport.height);
  const designW = design.right - design.left;
  const designH = design.top - design.bottom;
  const cx = (design.left + design.right) / 2;
  const cy = (design.bottom + design.top) / 2;
  const viewAspect = vw / vh;
  const designAspect = designW / designH;
  if (viewAspect >= designAspect) {
    const newW = designH * viewAspect;
    return {
      left: cx - newW / 2,
      right: cx + newW / 2,
      top: design.top,
      bottom: design.bottom,
    };
  }
  const newH = designW / viewAspect;
  return {
    left: design.left,
    right: design.right,
    top: cy + newH / 2,
    bottom: cy - newH / 2,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  frustum: Frustum,
  viewport: ViewportPx,
): { x: number; y: number } {
  const fw = frustum.right - frustum.left;
  const fh = frustum.top - frustum.bottom;
  const u = (worldX - frustum.left) / fw;
  const v = (worldY - frustum.bottom) / fh;
  return {
    x: u * viewport.width,
    y: (1 - v) * viewport.height,
  };
}

export function screenToWorld(
  clientX: number,
  clientY: number,
  frustum: Frustum,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const fw = frustum.right - frustum.left;
  const fh = frustum.top - frustum.bottom;
  const u = localX / Math.max(1, rect.width);
  const v = 1 - localY / Math.max(1, rect.height);
  return {
    x: frustum.left + u * fw,
    y: frustum.bottom + v * fh,
  };
}
