import type { OrthographicCamera } from 'three';

/** World-space design frustum (matches authored level coordinates). */
export interface OrthoDesignBounds {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

/**
 * Adjust orthographic camera so the full design rectangle is visible and the
 * viewport aspect ratio is respected (no huge empty bands inside the canvas).
 */
export function fitOrthographicToViewport(
  camera: OrthographicCamera,
  viewportWidthPx: number,
  viewportHeightPx: number,
  design: OrthoDesignBounds,
): void {
  const aspect = viewportWidthPx / Math.max(1, viewportHeightPx);
  const cx = (design.left + design.right) / 2;
  const cy = (design.bottom + design.top) / 2;
  let vw = design.right - design.left;
  let vh = design.top - design.bottom;
  if (vw / vh < aspect) {
    vw = vh * aspect;
  } else {
    vh = vw / aspect;
  }
  camera.left = cx - vw / 2;
  camera.right = cx + vw / 2;
  camera.bottom = cy - vh / 2;
  camera.top = cy + vh / 2;
  camera.updateProjectionMatrix();
}
