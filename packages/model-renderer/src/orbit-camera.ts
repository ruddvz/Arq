/**
 * ARQ-127: implement orbit and fit.
 *
 * Blueprint section 62's "First 3D features": "orbit; pan; zoom; fit
 * selection; fit project" - the interaction half of the 3D camera,
 * building on ARQ-126's plain THREE.OrthographicCamera construction/
 * frustum-resize.
 *
 * OrbitCameraState is deliberately plain data (spherical coordinates
 * around a target, plus the orthographic viewSize), not a THREE object
 * itself - the same "pure state, apply to a real object at the edge"
 * split viewport-controller.ts (ARQ-033) already uses for the 2D
 * viewport, so orbitBy/panBy/zoomBy/fitBoundingSphere are all
 * ordinary, independently-testable pure functions; applyOrbitCameraState
 * is the one place that actually touches a THREE.OrthographicCamera.
 *
 * Distance vs. viewSize: for an orthographic camera, moving the camera
 * closer to or farther from its target does not change apparent scale
 * (that is the entire point of parallel projection) - only viewSize
 * does. `distance` here only affects where the camera physically sits
 * (near/far clipping headroom), matching how orthographic "zoom" is
 * conventionally implemented; zoomBy changes viewSize, not distance.
 *
 * zoomBy's sign convention matches viewport-controller.ts's
 * zoomAtScreenPoint exactly: factor > 1 zooms in (here: viewSize
 * shrinks, seeing a smaller, more magnified area), factor < 1 zooms
 * out - the same direction across both the 2D and 3D cameras in this
 * codebase, not an arbitrary reversal.
 *
 * fitBoundingSphere is the 3D analogue of viewport-controller.ts's
 * fitToBounds - "fit selection"/"fit project" (section 62) both reduce
 * to "frame this bounding volume," and a sphere (centre + radius) is
 * the simplest volume that already covers an axis-aligned box (its
 * bounding sphere) without needing this module to reason about box
 * corners under an arbitrary orbit angle.
 *
 * panBy takes an already-world-space delta rather than a screen-space
 * one: converting a screen-space drag into a world-space pan requires
 * the camera's current right/up vectors, which is a renderer/input
 * concern (the same "caller owns the viewport conversion" pattern
 * zoom-to-room-gap.ts and snap-glyph-rendering.ts already establish),
 * not something this pure-state module computes itself.
 */

import * as THREE from 'three';
import {
  createOrthographicCamera,
  updateOrthographicCameraFrustum,
  type OrthographicCameraOptions,
} from './model-camera';

export interface Vector3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface OrbitCameraState {
  readonly target: Vector3Like;
  /** Rotation around the up (Y) axis, radians. */
  readonly azimuthRadians: number;
  /** Angle from the +Y axis, radians - clamped away from the poles to avoid the camera flipping through straight up/down. */
  readonly polarRadians: number;
  readonly distance: number;
  /** World-space height visible through the orthographic frustum - the actual "zoom" level (see this module's doc comment). */
  readonly viewSize: number;
}

const MIN_POLAR_RADIANS = 0.001;
const MAX_POLAR_RADIANS = Math.PI - 0.001;
const MIN_DISTANCE = 0.001;
const MIN_VIEW_SIZE = 0.001;

export const DEFAULT_ORBIT_CAMERA_STATE: OrbitCameraState = {
  target: { x: 0, y: 0, z: 0 },
  azimuthRadians: Math.PI / 4,
  polarRadians: Math.PI / 3,
  distance: 20,
  viewSize: 20,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Rotates the camera around its target - "orbit" (section 62). Polar angle is clamped away from the poles. */
export function orbitBy(
  state: OrbitCameraState,
  deltaAzimuthRadians: number,
  deltaPolarRadians: number,
): OrbitCameraState {
  return {
    ...state,
    azimuthRadians: state.azimuthRadians + deltaAzimuthRadians,
    polarRadians: clamp(
      state.polarRadians + deltaPolarRadians,
      MIN_POLAR_RADIANS,
      MAX_POLAR_RADIANS,
    ),
  };
}

/** Moves the target (and, since the camera tracks it, the whole view) by a world-space delta - "pan" (section 62). */
export function panBy(state: OrbitCameraState, deltaWorld: Vector3Like): OrbitCameraState {
  return {
    ...state,
    target: {
      x: state.target.x + deltaWorld.x,
      y: state.target.y + deltaWorld.y,
      z: state.target.z + deltaWorld.z,
    },
  };
}

/** Scales viewSize by `factor` - "zoom" (section 62). factor > 1 zooms in (smaller viewSize); factor < 1 zooms out, matching viewport-controller.ts's zoomAtScreenPoint convention. */
export function zoomBy(state: OrbitCameraState, factor: number): OrbitCameraState {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new RangeError('zoom factor must be a positive finite number');
  }
  return { ...state, viewSize: Math.max(MIN_VIEW_SIZE, state.viewSize / factor) };
}

/**
 * Frames a bounding sphere - "fit selection"/"fit project" (section 62)
 * both reduce to this. Keeps the current orbit angles (fitting reframes
 * the view, it does not reset how the user was looking at the model)
 * and picks a viewSize large enough for the sphere to fit in *either*
 * screen dimension, not just vertically, using `aspect` (width/height).
 */
export function fitBoundingSphere(
  state: OrbitCameraState,
  center: Vector3Like,
  radius: number,
  aspect: number,
  marginFactor = 1.2,
): OrbitCameraState {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new RangeError('radius must be a positive finite number');
  }
  if (!Number.isFinite(aspect) || aspect <= 0) {
    throw new RangeError('aspect must be a positive finite number');
  }
  if (!Number.isFinite(marginFactor) || marginFactor <= 0) {
    throw new RangeError('marginFactor must be a positive finite number');
  }
  const requiredHalfHeight = Math.max(radius * marginFactor, (radius * marginFactor) / aspect);
  return {
    ...state,
    target: center,
    viewSize: Math.max(MIN_VIEW_SIZE, requiredHalfHeight * 2),
  };
}

/** Converts spherical (azimuth, polar, distance) around `target` into a Cartesian world position - Y-up, matching model-scene.ts's coordinate convention. */
function orbitPosition(state: OrbitCameraState): Vector3Like {
  const distance = Math.max(MIN_DISTANCE, state.distance);
  const sinPolar = Math.sin(state.polarRadians);
  return {
    x: state.target.x + distance * sinPolar * Math.sin(state.azimuthRadians),
    y: state.target.y + distance * Math.cos(state.polarRadians),
    z: state.target.z + distance * sinPolar * Math.cos(state.azimuthRadians),
  };
}

/** Applies `state` to a real THREE.OrthographicCamera: position, lookAt, and frustum - the one place this module touches Three.js. */
export function applyOrbitCameraState(
  camera: THREE.OrthographicCamera,
  state: OrbitCameraState,
  aspect: number,
): void {
  const position = orbitPosition(state);
  camera.position.set(position.x, position.y, position.z);
  camera.lookAt(state.target.x, state.target.y, state.target.z);
  updateOrthographicCameraFrustum(camera, aspect, state.viewSize);
}

/** Convenience: builds a camera already positioned at the given (or default) orbit state - a caller does not have to remember to call applyOrbitCameraState right after createOrthographicCamera. */
export function createOrbitingCamera(
  options: OrthographicCameraOptions,
  state: OrbitCameraState = DEFAULT_ORBIT_CAMERA_STATE,
): THREE.OrthographicCamera {
  const camera = createOrthographicCamera(options);
  applyOrbitCameraState(camera, state, options.aspect);
  return camera;
}
