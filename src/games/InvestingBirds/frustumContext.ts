import { createContext, useContext } from 'react';
import { CAMERA_DESIGN } from './config';
import type { Frustum, ViewportPx } from './projection';

/**
 * Shared, resize-only-updated frustum + viewport size. All consumers
 * (CameraRig, Scene, Overlay, InputLayer) read this so world↔screen math
 * is consistent everywhere.
 */
export interface FrustumState {
  frustum: Frustum;
  viewport: ViewportPx;
}

const DEFAULT_FRUSTUM_STATE: FrustumState = {
  frustum: {
    left: CAMERA_DESIGN.left,
    right: CAMERA_DESIGN.right,
    top: CAMERA_DESIGN.top,
    bottom: CAMERA_DESIGN.bottom,
  },
  viewport: { width: 1, height: 1 },
};

export const FrustumContext = createContext<FrustumState>(DEFAULT_FRUSTUM_STATE);

export function useFrustum(): FrustumState {
  return useContext(FrustumContext);
}
