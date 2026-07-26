/**
 * ARQ-126: implement orthographic camera.
 *
 * Blueprint section 62's "First 3D features" lists "orthographic
 * camera" separately from "orbit; pan; zoom; fit selection; fit
 * project" (ARQ-127's job) - this module only creates and configures a
 * THREE.OrthographicCamera correctly (frustum sized from a world-space
 * view height and the canvas aspect ratio, plus resizing it when the
 * canvas resizes); it does not implement any interaction.
 *
 * An orthographic (not perspective) camera is what section 62 asks
 * for: parallel projection keeps a wall's length reading true at any
 * distance from the camera, matching how architectural drawings are
 * conventionally read, unlike a perspective camera's foreshortening.
 *
 * `viewSize` is the world-space height visible through the frustum at
 * the current zoom level - the same "world units visible on screen"
 * concept line-weight.ts's screen-space stability and
 * zoom-to-room-gap.ts's viewport framing already establish elsewhere in
 * this backlog, just for the 3D camera instead of the 2D viewport.
 * `updateOrthographicCameraFrustum` recomputes left/right/top/bottom
 * from a new aspect ratio or viewSize (a canvas resize, or a future
 * zoom operation, ARQ-127) without constructing a new camera - Three.js
 * requires `updateProjectionMatrix()` after changing frustum planes
 * directly, which this function calls so a caller cannot forget it.
 *
 * Default position/orientation: a camera looking at the origin from an
 * elevated, angled position - a conventional architectural "default 3D
 * view" (not a plan-straight-down view, which orthographic pan/zoom
 * alone would make indistinguishable from the 2D plan renderer, and
 * not an arbitrary perspective-only angle). Orbiting away from this
 * default is ARQ-127's job.
 */

import * as THREE from 'three';

export interface OrthographicCameraOptions {
  readonly aspect: number;
  /** World-space height visible through the frustum. Defaults to 20. */
  readonly viewSize?: number;
  readonly near?: number;
  readonly far?: number;
}

const DEFAULT_VIEW_SIZE = 20;
const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 1000;
const DEFAULT_POSITION = new THREE.Vector3(10, 10, 10);

function validateFrustumInputs(aspect: number, viewSize: number, near: number, far: number): void {
  if (!Number.isFinite(aspect) || aspect <= 0) {
    throw new RangeError('aspect must be a positive finite number');
  }
  if (!Number.isFinite(viewSize) || viewSize <= 0) {
    throw new RangeError('viewSize must be a positive finite number');
  }
  if (!Number.isFinite(near) || near <= 0) {
    throw new RangeError('near must be a positive finite number');
  }
  if (!Number.isFinite(far) || far <= near) {
    throw new RangeError('far must be a finite number greater than near');
  }
}

/** Builds a THREE.OrthographicCamera sized from `aspect`/`viewSize`, positioned at a conventional default architectural view angle looking at the origin. */
export function createOrthographicCamera(
  options: OrthographicCameraOptions,
): THREE.OrthographicCamera {
  const viewSize = options.viewSize ?? DEFAULT_VIEW_SIZE;
  const near = options.near ?? DEFAULT_NEAR;
  const far = options.far ?? DEFAULT_FAR;
  validateFrustumInputs(options.aspect, viewSize, near, far);

  const halfHeight = viewSize / 2;
  const halfWidth = halfHeight * options.aspect;
  const camera = new THREE.OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    near,
    far,
  );
  camera.position.copy(DEFAULT_POSITION);
  camera.lookAt(0, 0, 0);
  return camera;
}

/** Recomputes `camera`'s frustum for a new aspect ratio and/or viewSize (a canvas resize, or a future zoom operation) and calls updateProjectionMatrix(). */
export function updateOrthographicCameraFrustum(
  camera: THREE.OrthographicCamera,
  aspect: number,
  viewSize: number,
): void {
  validateFrustumInputs(aspect, viewSize, camera.near, camera.far);
  const halfHeight = viewSize / 2;
  const halfWidth = halfHeight * aspect;
  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}
