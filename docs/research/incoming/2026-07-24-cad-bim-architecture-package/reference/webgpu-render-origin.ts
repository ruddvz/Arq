/**
 * Render packets are camera-independent. Positions are localised against a
 * stable render-chunk origin in f64 before being written to a Float32Array.
 *
 * Camera movement updates a local view-projection uniform. It does not rebuild
 * every vertex buffer. Use high/low shader arithmetic only for a measured
 * mega-site case where a chunk origin is not sufficient.
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RenderChunk {
  readonly origin: Vec3;
  readonly positions: Float32Array;
  readonly vertexCount: number;
}

export interface HighLowVec3 {
  readonly high: Vec3;
  readonly low: Vec3;
}

export function createRenderChunk(
  worldPositions: readonly Vec3[],
  origin: Vec3,
): RenderChunk {
  assertFinite(origin, "Render origin");

  const positions = new Float32Array(worldPositions.length * 3);
  for (let index = 0; index < worldPositions.length; index += 1) {
    const world = worldPositions[index];
    assertFinite(world, "World position");

    // The subtraction happens as JavaScript f64 before the Float32Array cast.
    positions[index * 3] = world.x - origin.x;
    positions[index * 3 + 1] = world.y - origin.y;
    positions[index * 3 + 2] = world.z - origin.z;
  }

  return {
    origin,
    positions,
    vertexCount: worldPositions.length,
  };
}

export function cameraInChunk(
  cameraWorld: Vec3,
  chunkOrigin: Vec3,
): Vec3 {
  assertFinite(cameraWorld, "Camera position");
  assertFinite(chunkOrigin, "Render origin");
  return {
    x: cameraWorld.x - chunkOrigin.x,
    y: cameraWorld.y - chunkOrigin.y,
    z: cameraWorld.z - chunkOrigin.z,
  };
}

/**
 * Split an f64 into two f32-representable values for an optional high/low
 * shader path. This does not make WGSL operate in native f64.
 */
export function splitForHighLow(value: Vec3): HighLowVec3 {
  assertFinite(value, "Coordinate");
  const x = splitScalar(value.x);
  const y = splitScalar(value.y);
  const z = splitScalar(value.z);

  return {
    high: { x: x.high, y: y.high, z: z.high },
    low: { x: x.low, y: y.low, z: z.low },
  };
}

function splitScalar(value: number): { high: number; low: number } {
  const high = Math.fround(value);
  return {
    high,
    low: Math.fround(value - high),
  };
}

function assertFinite(value: Vec3, label: string): void {
  if (
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.z)
  ) {
    throw new Error(label + " must contain finite coordinates.");
  }
}
