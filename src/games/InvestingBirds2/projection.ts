/**
 * Pure world↔screen projection for InvestingBirds2.
 *
 * The design frustum is **fixed** (set once, re-aspect-fit only on window
 * resize). `worldToScreen` returns CSS pixels relative to the top-left of
 * the container rectangle (the ib2-root div). `screenToWorld` takes client
 * coordinates plus the container's bounding rect so pointer math survives
 * window scrolling or parent offsets.
 *
 * Having a single source of truth here is what stops the HUD/floaters from
 * drifting away from the world geometry — every consumer (Scene, Overlay,
 * InputLayer) reads the same `Frustum` value through `FrustumContext`.
 */

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

/**
 * Expand the design rectangle so that `designRect` is always fully visible
 * inside a viewport of `viewportPx`, without stretching. Whichever axis
 * needs to grow (horizontal for wide screens, vertical for tall ones)
 * expands symmetrically around the design centre. Any extra space painted
 * outside the design rectangle is filled by the ib2-root background colour
 * so it looks like more sky rather than a grey dead band.
 */
export function computeFrustum(
  viewport: ViewportPx,
  design: Frustum,
): Frustum {
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

/**
 * World → container-local CSS pixels. (0, 0) is the top-left of the
 * container. Y is flipped because world +Y goes up but DOM +Y goes down.
 */
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

/**
 * Client (event.clientX / event.clientY) → world coords.
 * `rect` is `container.getBoundingClientRect()`.
 */
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
