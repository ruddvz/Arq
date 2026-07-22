import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createOrthographicCamera, updateOrthographicCameraFrustum } from './model-camera';

describe('createOrthographicCamera', () => {
  it('returns a THREE.OrthographicCamera', () => {
    const camera = createOrthographicCamera({ aspect: 16 / 9 });
    expect(camera).toBeInstanceOf(THREE.OrthographicCamera);
  });

  it('sizes the frustum from viewSize and aspect', () => {
    const camera = createOrthographicCamera({ aspect: 2, viewSize: 10 });
    expect(camera.top).toBeCloseTo(5, 9);
    expect(camera.bottom).toBeCloseTo(-5, 9);
    expect(camera.right).toBeCloseTo(10, 9);
    expect(camera.left).toBeCloseTo(-10, 9);
  });

  it('positions the camera at a conventional angled default view looking at the origin', () => {
    const camera = createOrthographicCamera({ aspect: 1 });
    expect(camera.position.length()).toBeGreaterThan(0);
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    // Looking roughly toward the origin from a positive-XYZ position means
    // the world direction should point back toward negative X/Y/Z.
    expect(direction.x).toBeLessThan(0);
    expect(direction.y).toBeLessThan(0);
    expect(direction.z).toBeLessThan(0);
  });

  it('uses default near/far when not specified', () => {
    const camera = createOrthographicCamera({ aspect: 1 });
    expect(camera.near).toBeCloseTo(0.1, 9);
    expect(camera.far).toBeCloseTo(1000, 9);
  });

  it('accepts explicit near/far', () => {
    const camera = createOrthographicCamera({ aspect: 1, near: 1, far: 50 });
    expect(camera.near).toBe(1);
    expect(camera.far).toBe(50);
  });

  it('rejects a non-positive aspect', () => {
    expect(() => createOrthographicCamera({ aspect: 0 })).toThrow(RangeError);
    expect(() => createOrthographicCamera({ aspect: -1 })).toThrow(RangeError);
  });

  it('rejects a non-positive viewSize', () => {
    expect(() => createOrthographicCamera({ aspect: 1, viewSize: 0 })).toThrow(RangeError);
  });

  it('rejects far <= near', () => {
    expect(() => createOrthographicCamera({ aspect: 1, near: 10, far: 10 })).toThrow(RangeError);
    expect(() => createOrthographicCamera({ aspect: 1, near: 10, far: 5 })).toThrow(RangeError);
  });

  it('rejects non-finite inputs (adversarial: non-finite values)', () => {
    expect(() => createOrthographicCamera({ aspect: Number.NaN })).toThrow(RangeError);
  });
});

describe('updateOrthographicCameraFrustum', () => {
  it('resizes the frustum in place and updates the projection matrix', () => {
    const camera = createOrthographicCamera({ aspect: 1, viewSize: 10 });
    const beforeMatrix = camera.projectionMatrix.clone();
    updateOrthographicCameraFrustum(camera, 2, 20);
    expect(camera.top).toBeCloseTo(10, 9);
    expect(camera.right).toBeCloseTo(20, 9);
    expect(camera.projectionMatrix.equals(beforeMatrix)).toBe(false);
  });

  it('rejects a non-positive aspect or viewSize', () => {
    const camera = createOrthographicCamera({ aspect: 1 });
    expect(() => updateOrthographicCameraFrustum(camera, 0, 10)).toThrow(RangeError);
    expect(() => updateOrthographicCameraFrustum(camera, 1, 0)).toThrow(RangeError);
  });
});
