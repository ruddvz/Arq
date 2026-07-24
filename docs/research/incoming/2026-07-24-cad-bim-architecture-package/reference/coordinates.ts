/**
 * Coordinate helpers for a float64 canonical model and local float32 GPU data.
 * All inputs are ordinary JavaScript numbers, so callers must enforce units and
 * coordinate-frame semantics at the document boundary.
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Float32Split {
  readonly high: number;
  readonly low: number;
}

export interface SplitVec3 {
  readonly high: Vec3;
  readonly low: Vec3;
}

export function assertFiniteVec3(value: Vec3, label: string): void {
  if (
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.z)
  ) {
    throw new Error(label + " contains a non-finite coordinate.");
  }
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

/**
 * Converts world coordinates to a local render frame in f64 before the
 * Float32Array conversion. The render origin is never written back to the
 * document.
 */
export function localiseForRender(world: Vec3, renderOrigin: Vec3): Vec3 {
  assertFiniteVec3(world, "World position");
  assertFiniteVec3(renderOrigin, "Render origin");
  return subtract(world, renderOrigin);
}

export function packLocalPositions(
  worldPositions: readonly Vec3[],
  renderOrigin: Vec3,
): Float32Array {
  const packed = new Float32Array(worldPositions.length * 3);

  for (let index = 0; index < worldPositions.length; index += 1) {
    const local = localiseForRender(worldPositions[index], renderOrigin);
    packed[index * 3] = local.x;
    packed[index * 3 + 1] = local.y;
    packed[index * 3 + 2] = local.z;
  }

  return packed;
}

/**
 * Splits a JavaScript f64 into two f32-representable values. This can support
 * an RTE shader path, but it does not create native GPU f64 arithmetic.
 */
export function splitFloat64(value: number): Float32Split {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot split a non-finite coordinate.");
  }
  const high = Math.fround(value);
  const low = Math.fround(value - high);
  return { high, low };
}

export function splitVec3(value: Vec3): SplitVec3 {
  const x = splitFloat64(value.x);
  const y = splitFloat64(value.y);
  const z = splitFloat64(value.z);

  return {
    high: { x: x.high, y: y.high, z: z.high },
    low: { x: x.low, y: y.low, z: z.low },
  };
}

export function combineSplit(value: Float32Split): number {
  return value.high + value.low;
}
