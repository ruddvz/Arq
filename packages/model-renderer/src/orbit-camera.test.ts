import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyOrbitCameraState,
  createOrbitingCamera,
  DEFAULT_ORBIT_CAMERA_STATE,
  fitBoundingSphere,
  orbitBy,
  panBy,
  zoomBy,
} from './orbit-camera';

describe('orbitBy', () => {
  it('adds the delta angles', () => {
    const state = orbitBy(DEFAULT_ORBIT_CAMERA_STATE, 0.5, 0.1);
    expect(state.azimuthRadians).toBeCloseTo(DEFAULT_ORBIT_CAMERA_STATE.azimuthRadians + 0.5, 9);
    expect(state.polarRadians).toBeCloseTo(DEFAULT_ORBIT_CAMERA_STATE.polarRadians + 0.1, 9);
  });

  it('clamps the polar angle away from the poles (does not flip through straight up/down)', () => {
    const state = orbitBy(DEFAULT_ORBIT_CAMERA_STATE, 0, -100);
    expect(state.polarRadians).toBeGreaterThan(0);
    expect(state.polarRadians).toBeLessThan(Math.PI);
  });

  it('leaves the target and viewSize unchanged', () => {
    const state = orbitBy(DEFAULT_ORBIT_CAMERA_STATE, 1, 1);
    expect(state.target).toEqual(DEFAULT_ORBIT_CAMERA_STATE.target);
    expect(state.viewSize).toBe(DEFAULT_ORBIT_CAMERA_STATE.viewSize);
  });
});

describe('panBy', () => {
  it('moves the target by the given world-space delta', () => {
    const state = panBy(DEFAULT_ORBIT_CAMERA_STATE, { x: 1, y: 2, z: 3 });
    expect(state.target).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('leaves the orbit angles and viewSize unchanged', () => {
    const state = panBy(DEFAULT_ORBIT_CAMERA_STATE, { x: 1, y: 0, z: 0 });
    expect(state.azimuthRadians).toBe(DEFAULT_ORBIT_CAMERA_STATE.azimuthRadians);
    expect(state.viewSize).toBe(DEFAULT_ORBIT_CAMERA_STATE.viewSize);
  });
});

describe('zoomBy', () => {
  it('shrinks viewSize for a factor greater than 1 (zooming in)', () => {
    const state = zoomBy(DEFAULT_ORBIT_CAMERA_STATE, 2);
    expect(state.viewSize).toBeCloseTo(DEFAULT_ORBIT_CAMERA_STATE.viewSize / 2, 9);
  });

  it('grows viewSize for a factor less than 1 (zooming out)', () => {
    const state = zoomBy(DEFAULT_ORBIT_CAMERA_STATE, 0.5);
    expect(state.viewSize).toBeCloseTo(DEFAULT_ORBIT_CAMERA_STATE.viewSize * 2, 9);
  });

  it('rejects a non-positive factor', () => {
    expect(() => zoomBy(DEFAULT_ORBIT_CAMERA_STATE, 0)).toThrow(RangeError);
    expect(() => zoomBy(DEFAULT_ORBIT_CAMERA_STATE, -1)).toThrow(RangeError);
  });
});

describe('fitBoundingSphere', () => {
  it('sets the target to the sphere centre', () => {
    const state = fitBoundingSphere(DEFAULT_ORBIT_CAMERA_STATE, { x: 5, y: 0, z: 5 }, 10, 1);
    expect(state.target).toEqual({ x: 5, y: 0, z: 5 });
  });

  it('sizes viewSize to fit the sphere with margin at aspect 1', () => {
    const state = fitBoundingSphere(DEFAULT_ORBIT_CAMERA_STATE, { x: 0, y: 0, z: 0 }, 10, 1, 1.2);
    // requiredHalfHeight = max(10*1.2, 10*1.2/1) = 12, viewSize = 24.
    expect(state.viewSize).toBeCloseTo(24, 9);
  });

  it('uses a larger viewSize for a narrow (portrait, aspect < 1) view to still fit the sphere horizontally', () => {
    const wide = fitBoundingSphere(DEFAULT_ORBIT_CAMERA_STATE, { x: 0, y: 0, z: 0 }, 10, 2);
    const narrow = fitBoundingSphere(DEFAULT_ORBIT_CAMERA_STATE, { x: 0, y: 0, z: 0 }, 10, 0.5);
    expect(narrow.viewSize).toBeGreaterThan(wide.viewSize);
  });

  it('rejects a non-positive radius, aspect, or marginFactor', () => {
    expect(() => fitBoundingSphere(DEFAULT_ORBIT_CAMERA_STATE, { x: 0, y: 0, z: 0 }, 0, 1)).toThrow(
      RangeError,
    );
    expect(() => fitBoundingSphere(DEFAULT_ORBIT_CAMERA_STATE, { x: 0, y: 0, z: 0 }, 10, 0)).toThrow(
      RangeError,
    );
    expect(() =>
      fitBoundingSphere(DEFAULT_ORBIT_CAMERA_STATE, { x: 0, y: 0, z: 0 }, 10, 1, 0),
    ).toThrow(RangeError);
  });
});

describe('applyOrbitCameraState', () => {
  it('positions the camera at the configured distance from the target', () => {
    const camera = new THREE.OrthographicCamera();
    const state = { ...DEFAULT_ORBIT_CAMERA_STATE, target: { x: 0, y: 0, z: 0 }, distance: 15 };
    applyOrbitCameraState(camera, state, 1);
    expect(camera.position.length()).toBeCloseTo(15, 6);
  });

  it('looks at the target', () => {
    const camera = new THREE.OrthographicCamera();
    const state = { ...DEFAULT_ORBIT_CAMERA_STATE, target: { x: 3, y: 1, z: -2 } };
    applyOrbitCameraState(camera, state, 1);
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const toTarget = new THREE.Vector3(3, 1, -2).sub(camera.position).normalize();
    expect(direction.dot(toTarget)).toBeCloseTo(1, 6);
  });

  it('applies the frustum for the given viewSize/aspect', () => {
    const camera = new THREE.OrthographicCamera();
    const state = { ...DEFAULT_ORBIT_CAMERA_STATE, viewSize: 10 };
    applyOrbitCameraState(camera, state, 2);
    expect(camera.top).toBeCloseTo(5, 9);
    expect(camera.right).toBeCloseTo(10, 9);
  });
});

describe('createOrbitingCamera', () => {
  it('returns a camera already positioned per the given (or default) orbit state', () => {
    const camera = createOrbitingCamera({ aspect: 1 });
    expect(camera).toBeInstanceOf(THREE.OrthographicCamera);
    expect(camera.position.length()).toBeCloseTo(DEFAULT_ORBIT_CAMERA_STATE.distance, 6);
  });
});
