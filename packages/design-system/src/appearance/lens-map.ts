/**
 * The displacement map a refraction lens is made of.
 *
 * A lens is an SVG `feDisplacementMap` pointed at a small image whose red and
 * green channels encode how far to push each pixel of the backdrop. The image
 * depends only on the lens's shape, so it is generated once per shape and
 * shared by every lens with that shape - which is the entire reason this module
 * exists rather than the effect being a few lines of CSS.
 *
 * Three things make it a resource layer rather than a function:
 *
 * - The shape is quantised before it becomes a key, so a control resizing by a
 *   pixel does not regenerate an image that would look identical. Without that,
 *   a drag produces one PNG encode per frame.
 * - The cache is bounded and releases what it evicts. Every map holds an object
 *   URL, and an object URL that is never revoked is a leak the browser cannot
 *   collect - the one failure here that gets worse the longer the app is open.
 * - Generation is deduplicated in flight. Two lenses of the same shape mounting
 *   in the same frame is the normal case, not the rare one.
 */

export interface LensSpec {
  readonly width: number;
  readonly height: number;
  readonly borderRadius: number;
  /** How far the backdrop is pushed at the rim, in pixels. */
  readonly displacement: number;
  /** How sharply the push falls off towards the centre. Higher is a thinner rim. */
  readonly curvature: number;
  /** Overall strength, so a caller can dial the whole effect without re-tuning the profile. */
  readonly splay: number;
}

export type NormalizedLensSpec = LensSpec;

export interface LensMapResource {
  readonly key: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

/**
 * Bounds, and why each one is where it is.
 *
 * The area cap is the important one: a displacement map is generated pixel by
 * pixel on the main thread's canvas and then PNG-encoded, so cost is linear in
 * area with a large constant. 65,536px is a 256x256 lens, which is far larger
 * than the moving indicators this is for - anything bigger is a sign the effect
 * is being asked to do a job it is not for, and refusing is better than
 * quietly spending a frame on it.
 */
const MAX_DIMENSION = 512;
const MAX_AREA = 65_536;

/**
 * Shapes are rounded to even pixels before they become keys.
 *
 * A control that resizes by one pixel would otherwise miss the cache and
 * regenerate a map indistinguishable from the one it had. Two pixels is below
 * the point where the difference in the map is visible at any displacement this
 * allows.
 */
const QUANTUM = 2;

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return value;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const quantize = (value: number): number =>
  Math.max(QUANTUM, Math.round(value / QUANTUM) * QUANTUM);

/**
 * Clamps a requested lens into what can actually be generated.
 *
 * Clamps rather than throws for everything except a value that is not a number
 * and an area that cannot be afforded. A caller asking for a displacement of
 * 400 wants a strong lens and should get the strongest available one; a caller
 * passing `NaN` has a bug, and rendering something arbitrary would hide it.
 */
export function normalizeLensSpec(input: LensSpec): NormalizedLensSpec {
  const width = quantize(clamp(finite('width', input.width), QUANTUM, MAX_DIMENSION));
  const height = quantize(clamp(finite('height', input.height), QUANTUM, MAX_DIMENSION));
  if (width * height > MAX_AREA) {
    throw new RangeError(`lens area ${width}x${height} exceeds ${MAX_AREA}px`);
  }
  return {
    width,
    height,
    borderRadius: clamp(finite('borderRadius', input.borderRadius), 0, Math.min(width, height) / 2),
    displacement: clamp(finite('displacement', input.displacement), 0, 16),
    curvature: clamp(finite('curvature', input.curvature), 0.25, 6),
    splay: clamp(finite('splay', input.splay), 0, 2),
  };
}

/**
 * The cache key for a normalised shape.
 *
 * Leads with a version so a change to the generator's maths invalidates every
 * stored map rather than serving images produced by the previous one. Two
 * decimal places on the continuous terms, because the generator cannot resolve
 * a finer difference than that into a byte channel anyway.
 */
export function lensMapKey(spec: NormalizedLensSpec): string {
  return [
    'v1',
    spec.width,
    spec.height,
    spec.borderRadius.toFixed(2),
    spec.displacement.toFixed(2),
    spec.curvature.toFixed(2),
    spec.splay.toFixed(2),
  ].join(':');
}

/** What the cache needs of a generator, so a test can supply one without a canvas. */
export type LensMapGenerator = (
  spec: NormalizedLensSpec,
  signal?: AbortSignal,
) => Promise<LensMapResource>;

/** What the cache needs of the platform, so a test can observe what it releases. */
export interface LensMapDisposer {
  (resource: LensMapResource): void;
}

interface CacheEntry {
  readonly resource: LensMapResource;
  /** How many mounted lenses are using it. Never evicted above zero. */
  refCount: number;
}

/**
 * A bounded store of generated maps, with in-flight deduplication.
 *
 * Eviction is least-recently-used among entries nothing is holding. A map still
 * on screen is never evicted whatever its age, because evicting it would revoke
 * the URL a live filter is pointed at and the lens would render as a hole.
 */
export class LensMapCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #inFlight = new Map<string, Promise<LensMapResource>>();
  readonly #generate: LensMapGenerator;
  readonly #dispose: LensMapDisposer;
  readonly #limit: number;

  constructor(options: {
    readonly generate: LensMapGenerator;
    readonly dispose?: LensMapDisposer;
    /** How many unused maps to keep. Small: these are shapes, and a shell has few. */
    readonly limit?: number;
  }) {
    this.#generate = options.generate;
    this.#dispose =
      options.dispose ??
      ((resource) => {
        if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(resource.url);
        }
      });
    this.#limit = options.limit ?? 12;
  }

  /**
   * Returns the map for a shape, generating it if nobody has yet, and counts
   * the caller as holding it until they `release`.
   *
   * Two callers asking for the same shape in the same frame share one
   * generation - the normal case when a switcher mounts, not a rare one.
   */
  async acquire(spec: NormalizedLensSpec, signal?: AbortSignal): Promise<LensMapResource> {
    const key = lensMapKey(spec);
    const existing = this.#entries.get(key);
    if (existing !== undefined) {
      existing.refCount += 1;
      // Re-inserting moves it to the end, which is what makes the Map's own
      // insertion order the LRU order.
      this.#entries.delete(key);
      this.#entries.set(key, existing);
      return existing.resource;
    }

    const pending = this.#inFlight.get(key);
    if (pending !== undefined) {
      const resource = await pending;
      this.#hold(key, resource);
      return resource;
    }

    const generation = this.#generate(spec, signal).finally(() => {
      this.#inFlight.delete(key);
    });
    this.#inFlight.set(key, generation);
    const resource = await generation;
    this.#hold(key, resource);
    return resource;
  }

  /** Gives a map back. It stays cached until something newer needs the room. */
  release(spec: NormalizedLensSpec): void {
    const entry = this.#entries.get(lensMapKey(spec));
    if (entry === undefined) return;
    entry.refCount = Math.max(0, entry.refCount - 1);
    this.#evictIfOver();
  }

  /** Releases everything, held or not. For teardown, where nothing is on screen. */
  clear(): void {
    for (const entry of this.#entries.values()) {
      this.#dispose(entry.resource);
    }
    this.#entries.clear();
  }

  /** Exposed for the tests that assert this stays bounded. */
  get size(): number {
    return this.#entries.size;
  }

  #hold(key: string, resource: LensMapResource): void {
    const entry = this.#entries.get(key);
    if (entry === undefined) {
      this.#entries.set(key, { resource, refCount: 1 });
      this.#evictIfOver();
      return;
    }
    entry.refCount += 1;
  }

  #evictIfOver(): void {
    if (this.#entries.size <= this.#limit) return;
    for (const [key, entry] of this.#entries) {
      if (this.#entries.size <= this.#limit) return;
      // Held maps are skipped rather than counted out: a shell holding more
      // shapes than the limit keeps all of them, because revoking a URL a live
      // filter points at renders the lens as a hole.
      if (entry.refCount > 0) continue;
      this.#dispose(entry.resource);
      this.#entries.delete(key);
    }
  }
}

/**
 * Writes the displacement map for a shape.
 *
 * Browser-only by nature: it needs a canvas and a PNG encoder. Server rendering
 * never reaches this - `resolveOpticalQuality` returns `off` without a measured
 * environment - and a host without a 2D context gets a rejection the cache
 * passes through, which downgrades that lens to plain material rather than
 * failing the frame.
 *
 * Only a quarter of the image is computed. A lens is symmetric about both axes,
 * so the other three quadrants are the same values with the signs flipped, and
 * writing all four from one calculation is the difference between one pass and
 * four over the most expensive loop here.
 */
export async function generateLensMap(
  spec: NormalizedLensSpec,
  signal?: AbortSignal,
): Promise<LensMapResource> {
  signal?.throwIfAborted();
  const { width, height } = spec;
  const surface = createLensCanvas(width, height);
  const image = surface.context.createImageData(width, height);

  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const rx = Math.max(1, cx);
  const ry = Math.max(1, cy);

  const write = (x: number, y: number, dx: number, dy: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = (y * width + x) * 4;
    /*
     * A displacement map encodes offset as a colour, with the mid-point of each
     * channel meaning "no offset". 128 is that mid-point, so a flat grey image
     * is a lens that does nothing - which is also what a failed or clamped map
     * degrades to rather than tearing the backdrop apart.
     */
    image.data[index] = toByte(128 + dx);
    image.data[index + 1] = toByte(128 + dy);
    image.data[index + 2] = 128;
    image.data[index + 3] = 255;
  };

  for (let y = 0; y < Math.ceil(height / 2); y += 1) {
    // Checked per row rather than per pixel: often enough to abandon a map
    // whose control has already gone, cheap enough not to matter.
    if ((y & 15) === 0) signal?.throwIfAborted();
    for (let x = 0; x < Math.ceil(width / 2); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const radial = Math.sqrt(nx * nx + ny * ny);
      const inside = radial <= 1;
      // Zero at the centre, strongest at the rim: glass bends light where it
      // is thickest in section, which is at its edge.
      const profile = inside ? Math.pow(Math.max(0, 1 - radial), spec.curvature) : 0;
      const magnitude = spec.displacement * spec.splay * profile;
      const dx = inside ? nx * magnitude : 0;
      const dy = inside ? ny * magnitude : 0;
      const mx = width - 1 - x;
      const my = height - 1 - y;
      write(x, y, dx, dy);
      write(mx, y, -dx, dy);
      write(x, my, dx, -dy);
      write(mx, my, -dx, -dy);
    }
  }

  surface.context.putImageData(image, 0, 0);
  signal?.throwIfAborted();
  const blob = await surface.toBlob();
  signal?.throwIfAborted();
  return {
    key: lensMapKey(spec),
    url: URL.createObjectURL(blob),
    width,
    height,
  };
}

const toByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

interface LensCanvas {
  readonly context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  toBlob(): Promise<Blob>;
}

/**
 * `OffscreenCanvas` where it exists, a detached element where it does not.
 *
 * The offscreen path keeps the map off the document, so generating one never
 * triggers layout. Both are the same arithmetic; only where the pixels live
 * differs.
 */
function createLensCanvas(width: number, height: number): LensCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: false });
    if (context === null) throw new Error('no offscreen 2D context for a lens map');
    return { context, toBlob: () => canvas.convertToBlob({ type: 'image/png' }) };
  }
  if (typeof document === 'undefined') {
    throw new Error('a lens map needs a browser');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: false });
  if (context === null) throw new Error('no 2D context for a lens map');
  return {
    context,
    toBlob: () =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) =>
            blob === null ? reject(new Error('lens map PNG export failed')) : resolve(blob),
          'image/png',
        );
      }),
  };
}
