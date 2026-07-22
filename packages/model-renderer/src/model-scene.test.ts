import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createModelScene } from './model-scene';

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
