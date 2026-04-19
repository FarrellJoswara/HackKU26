/**
 * @file Static orthographic camera rig — reads `FrustumContext` and pins the
 * view to the design frustum (no follow cam, no gameplay camera shake).
 */

import { OrthographicCamera } from '@react-three/drei';
import { useLayoutEffect, useRef } from 'react';
import { Color, type OrthographicCamera as OrthoCam } from 'three';
import { useThree } from '@react-three/fiber';
import { CAMERA_DESIGN } from './config';
import { useFrustum } from './frustumContext';

/**
 * Static orthographic camera. The frustum is mutated only when the
 * `FrustumContext` value changes (resize-only). Camera position is pinned
 * to the frustum centre and never translates during gameplay — no follow,
 * no shake, no intro pan. This is the key change that eliminates the
 * grey-strip overlay bug in v1.
 */
export function CameraRig() {
  const { frustum } = useFrustum();
  const camRef = useRef<OrthoCam>(null);
  const { scene, gl } = useThree();

  useLayoutEffect(() => {
    const bg = new Color('#C9E8F5');
    scene.background = bg;
    gl.setClearColor(bg, 1);
  }, [scene, gl]);

  useLayoutEffect(() => {
    const cam = camRef.current;
    if (!cam) return;
    cam.left = frustum.left;
    cam.right = frustum.right;
    cam.top = frustum.top;
    cam.bottom = frustum.bottom;
    // `frustum` values are already in world coordinates (used by
    // worldToScreen/screenToWorld), so the ortho camera must stay at origin
    // on X/Y. Centering the camera here double-offsets the view and produces
    // the "zoomed into sky" bug.
    cam.position.set(0, 0, CAMERA_DESIGN.z);
    cam.updateProjectionMatrix();
  }, [frustum]);

  return (
    <OrthographicCamera
      ref={camRef}
      makeDefault
      left={frustum.left}
      right={frustum.right}
      top={frustum.top}
      bottom={frustum.bottom}
      near={CAMERA_DESIGN.near}
      far={CAMERA_DESIGN.far}
    />
  );
}
