/**
 * ARQ-123: add Three.js WebGL scene.
 *
 * Blueprint section 62 ("3D renderer"): "Three.js with WebGL as the
 * stable first backend," and its "First 3D features" list includes
 * "neutral ambient and directional lighting; simple floor... no
 * photorealism." This module is that foundation - a bare THREE.Scene
 * with lighting and a ground plane - that the later, more specific 3D
 * issues build on: orthographic camera (ARQ-126), orbit and fit
 * (ARQ-127), 2D/3D shared selection (ARQ-128), hide and isolate
 * (ARQ-129), and wall/opening mesh generation (ARQ-124/125). None of
 * those are implemented here; this issue only wires up Three.js itself
 * and the scene those features attach objects to.
 *
 * Coordinate mapping (a real, working choice, documented rather than
 * left implicit): this app's 2D plan world is y-up in the XY plane
 * (geometry-2d's coordinate-system.ts). Three.js's own convention is
 * y-up with the ground plane in XZ. This module maps plan (x, y) to
 * 3D (x, z) - the ground plane - leaving 3D y for building height
 * (levels/elevation, bim-core's Length unit, a separate axis from the
 * 2D plan's own x/y entirely). Every later mesh-generation issue
 * (ARQ-124/125) must follow this same mapping for plan and 3D to agree,
 * per blueprint section 45's "plan and 3D disagreement" bug to prevent.
 *
 * MeshLambertMaterial (not a PBR material) is used for the floor
 * deliberately - "no photorealism" (section 62) rules out
 * MeshStandardMaterial/MeshPhysicalMaterial's specular/metalness
 * pipeline for this first, deliberately plain scene.
 *
 * Only the parts of Three.js that run without an actual WebGL context
 * (Scene, Object3D, lights, geometries, materials) are exercised by
 * this module's own tests: THREE.WebGLRenderer itself needs a real
 * <canvas>/GL context this headless test environment does not have, so
 * constructing one is this module's caller's job (a browser-hosted
 * component), not something this module's tests can or should fake.
 */

import * as THREE from 'three';

export interface ModelSceneOptions {
  /** Ground plane extent in world units (metres/mm per whichever ADR-0004 eventually decides, D-014 - this module treats it as a plain number, the same provisional stance geometry-2d's WorldPoint already takes). Defaults to 100. */
  readonly floorSize?: number;
  /**
   * Where the ground sits under the model, in world units. Defaults to the
   * origin, which is only the right answer for a model that happens to be
   * centred there - see `placeModelFloor`.
   */
  readonly floorCenter?: { readonly x: number; readonly z: number };
  readonly floorColor?: THREE.ColorRepresentation;
  readonly ambientIntensity?: number;
  readonly directionalIntensity?: number;
}

const DEFAULT_FLOOR_SIZE = 100;
const DEFAULT_FLOOR_COLOR: THREE.ColorRepresentation = 0xf4f4f4; // design-system's surface-2 token
const DEFAULT_AMBIENT_INTENSITY = 0.6;
const DEFAULT_DIRECTIONAL_INTENSITY = 0.8;

/**
 * Builds the foundational THREE.Scene: neutral ambient + directional
 * lighting, and a simple flat floor on the XZ plane centred at the
 * origin - section 62's "neutral ambient and directional lighting;
 * simple floor," nothing else. Rejects a non-positive/non-finite
 * floorSize rather than constructing a degenerate or inside-out floor
 * mesh.
 */
export function createModelScene(options: ModelSceneOptions = {}): THREE.Scene {
  const floorSize = options.floorSize ?? DEFAULT_FLOOR_SIZE;
  if (!Number.isFinite(floorSize) || floorSize <= 0) {
    throw new RangeError('floorSize must be a positive finite number');
  }

  const scene = new THREE.Scene();

  const ambientLight = new THREE.AmbientLight(
    0xffffff,
    options.ambientIntensity ?? DEFAULT_AMBIENT_INTENSITY,
  );
  ambientLight.name = 'arq-ambient-light';
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(
    0xffffff,
    options.directionalIntensity ?? DEFAULT_DIRECTIONAL_INTENSITY,
  );
  directionalLight.name = 'arq-directional-light';
  directionalLight.position.set(1, 2, 1);
  scene.add(directionalLight);

  const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
  const floorMaterial = new THREE.MeshLambertMaterial({
    color: options.floorColor ?? DEFAULT_FLOOR_COLOR,
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.name = 'arq-floor';
  // PlaneGeometry is authored in the XY plane by default; rotate -90
  // degrees about X so it lies flat on XZ (this module's ground plane).
  floor.rotation.x = -Math.PI / 2;
  if (options.floorCenter !== undefined) {
    floor.position.set(options.floorCenter.x, 0, options.floorCenter.z);
  }
  scene.add(floor);

  return scene;
}

/** The scene's ground plane, or null if the scene has none. */
export function modelFloor(scene: THREE.Scene): THREE.Mesh | null {
  const found = scene.getObjectByName('arq-floor');
  return found instanceof THREE.Mesh ? found : null;
}

/**
 * Re-sizes and re-places the ground under whatever the model currently is.
 *
 * The floor was built once, at a fixed 30m square centred on the world origin,
 * and never touched again. A model is neither of those things: the golden
 * fixture is a 12m house whose corner is at the origin, so the ground was two
 * and a half times its width in each direction and the house stood in one
 * quadrant of it. The camera frames the model, not the floor, so the result was
 * a grey plane filling the viewport with a small building somewhere off-centre
 * in it - the ground reading as the subject.
 *
 * Ground is context. It says "this stands on something" and should extend far
 * enough past the building to say it, and no further.
 */
export function placeModelFloor(
  scene: THREE.Scene,
  placement: { readonly size: number; readonly x: number; readonly z: number },
): void {
  const floor = modelFloor(scene);
  if (floor === null) return;
  if (!Number.isFinite(placement.size) || placement.size <= 0) {
    throw new RangeError('floor size must be a positive finite number');
  }
  if (!Number.isFinite(placement.x) || !Number.isFinite(placement.z)) {
    throw new RangeError('floor centre must be finite');
  }
  floor.geometry.dispose();
  floor.geometry = new THREE.PlaneGeometry(placement.size, placement.size);
  floor.position.set(placement.x, 0, placement.z);
}
