import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createModelScene, modelFloor, placeModelFloor } from './model-scene';

describe('createModelScene', () => {
  it('returns a THREE.Scene', () => {
    const scene = createModelScene();
    expect(scene).toBeInstanceOf(THREE.Scene);
  });

  it('adds one ambient light and one directional light', () => {
    const scene = createModelScene();
    const ambient = scene.children.filter((child) => child instanceof THREE.AmbientLight);
    const directional = scene.children.filter((child) => child instanceof THREE.DirectionalLight);
    expect(ambient).toHaveLength(1);
    expect(directional).toHaveLength(1);
  });

  it('adds exactly one floor mesh lying flat on the XZ plane', () => {
    const scene = createModelScene();
    const floor = scene.getObjectByName('arq-floor') as THREE.Mesh;
    expect(floor).toBeInstanceOf(THREE.Mesh);
    expect(floor.rotation.x).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('uses a non-PBR material for the floor (no photorealism, blueprint section 62)', () => {
    const scene = createModelScene();
    const floor = scene.getObjectByName('arq-floor') as THREE.Mesh;
    expect(floor.material).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(floor.material).not.toBeInstanceOf(THREE.MeshStandardMaterial);
  });

  it('sizes the floor geometry from floorSize', () => {
    const scene = createModelScene({ floorSize: 40 });
    const floor = scene.getObjectByName('arq-floor') as THREE.Mesh;
    const geometry = floor.geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(40);
    expect(geometry.parameters.height).toBe(40);
  });

  it('applies custom light intensities', () => {
    const scene = createModelScene({ ambientIntensity: 0.2, directionalIntensity: 1.5 });
    const ambient = scene.getObjectByName('arq-ambient-light') as THREE.AmbientLight;
    const directional = scene.getObjectByName('arq-directional-light') as THREE.DirectionalLight;
    expect(ambient.intensity).toBe(0.2);
    expect(directional.intensity).toBe(1.5);
  });

  it('rejects a non-positive floorSize', () => {
    expect(() => createModelScene({ floorSize: 0 })).toThrow(RangeError);
    expect(() => createModelScene({ floorSize: -10 })).toThrow(RangeError);
  });

  it('rejects a non-finite floorSize (adversarial: non-finite values)', () => {
    expect(() => createModelScene({ floorSize: Number.NaN })).toThrow(RangeError);
    expect(() => createModelScene({ floorSize: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });
});

describe('placeModelFloor', () => {
  it('puts the ground under the model rather than under the origin', () => {
    const scene = createModelScene({ floorSize: 100 });
    placeModelFloor(scene, { size: 18_000, x: 6000, z: 6000 });
    const floor = modelFloor(scene);
    expect(floor).not.toBeNull();
    // The golden fixture is a 12m house whose corner sits at the origin. A
    // floor centred on the origin puts it in one quadrant of its own ground.
    expect(floor?.position.x).toBe(6000);
    expect(floor?.position.z).toBe(6000);
    expect(floor?.position.y).toBe(0);
  });

  it('re-sizes the ground, so a new model does not stand on the last one', () => {
    const scene = createModelScene({ floorSize: 30_000 });
    placeModelFloor(scene, { size: 18_000, x: 0, z: 0 });
    const parameters = (modelFloor(scene)?.geometry as THREE.PlaneGeometry).parameters;
    expect(parameters.width).toBe(18_000);
    expect(parameters.height).toBe(18_000);
  });

  it('keeps it flat, so re-placing never stands the ground on its edge', () => {
    const scene = createModelScene();
    placeModelFloor(scene, { size: 5000, x: 1, z: 2 });
    expect(modelFloor(scene)?.rotation.x).toBeCloseTo(-Math.PI / 2, 10);
  });

  it('refuses a size or a centre it cannot draw', () => {
    const scene = createModelScene();
    expect(() => placeModelFloor(scene, { size: 0, x: 0, z: 0 })).toThrow(RangeError);
    expect(() => placeModelFloor(scene, { size: Number.NaN, x: 0, z: 0 })).toThrow(RangeError);
    expect(() => placeModelFloor(scene, { size: 100, x: Number.NaN, z: 0 })).toThrow(RangeError);
  });

  it('does nothing to a scene that has no ground', () => {
    const scene = new THREE.Scene();
    expect(modelFloor(scene)).toBeNull();
    expect(() => placeModelFloor(scene, { size: 100, x: 0, z: 0 })).not.toThrow();
  });
});

describe('createModelScene floorCenter', () => {
  it('leaves the ground at the origin when no centre is given', () => {
    const floor = modelFloor(createModelScene());
    expect(floor?.position.x).toBe(0);
    expect(floor?.position.z).toBe(0);
  });

  it('places it where the caller asks', () => {
    const floor = modelFloor(createModelScene({ floorCenter: { x: 300, z: -400 } }));
    expect(floor?.position.x).toBe(300);
    expect(floor?.position.z).toBe(-400);
  });
});
