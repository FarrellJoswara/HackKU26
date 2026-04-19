import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { Color, type OrthographicCamera as OrthoCam } from 'three';
import { CAMERA_DESIGN } from './config';
import { computeFrustum } from './projection';

/** Same framing strategy as InvestingBirds2 `CameraRig.tsx`. */
export function OrthoCameraSetup() {
  const camera = useThree((s) => s.camera) as OrthoCam;
  const size = useThree((s) => s.size);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);

  useLayoutEffect(() => {
    const bg = new Color('#C9E8F5');
    scene.background = bg;
    gl.setClearColor(bg, 1);
  }, [scene, gl]);

  useLayoutEffect(() => {
    const design = {
      left: CAMERA_DESIGN.left,
      right: CAMERA_DESIGN.right,
      top: CAMERA_DESIGN.top,
      bottom: CAMERA_DESIGN.bottom,
    };
    const f = computeFrustum({ width: size.width, height: size.height }, design);
    camera.left = f.left;
    camera.right = f.right;
    camera.top = f.top;
    camera.bottom = f.bottom;
    camera.near = CAMERA_DESIGN.near;
    camera.far = CAMERA_DESIGN.far;
    camera.position.set(0, 0, CAMERA_DESIGN.z);
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  return null;
}
