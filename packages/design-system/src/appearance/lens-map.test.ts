import { describe, expect, it, vi } from 'vitest';
import {
  LensMapCache,
  lensMapKey,
  normalizeLensSpec,
  type LensMapResource,
  type LensSpec,
  type NormalizedLensSpec,
} from './lens-map';

const spec = (overrides: Partial<LensSpec> = {}): LensSpec => ({
  width: 80,
  height: 32,
  borderRadius: 16,
  displacement: 8,
  curvature: 2,
  splay: 1,
  ...overrides,
});

function fakeResource(s: NormalizedLensSpec, url = `blob:${lensMapKey(s)}`): LensMapResource {
  return { key: lensMapKey(s), url, width: s.width, height: s.height };
}

describe('normalizeLensSpec', () => {
  it('quantises the shape, so a one-pixel resize does not regenerate the map', () => {
    // The failure this prevents is a PNG encode per frame while a control is
    // being dragged.
    // 79 and 80 both round to 80. (81 rounds to 82 - the quantum is two
    // pixels, so adjacent values straddle a boundary half the time, and that is
    // the point rather than a gap: what matters is that a range collapses.)
    expect(lensMapKey(normalizeLensSpec(spec({ width: 80 })))).toBe(
      lensMapKey(normalizeLensSpec(spec({ width: 79 }))),
    );
    // Far enough apart is still a different shape.
    expect(lensMapKey(normalizeLensSpec(spec({ width: 80 })))).not.toBe(
      lensMapKey(normalizeLensSpec(spec({ width: 120 }))),
    );
  });

  it('clamps a request it cannot honour rather than refusing it', () => {
    // Somebody asking for a displacement of 400 wants the strongest lens
    // available, and should get it.
    expect(normalizeLensSpec(spec({ displacement: 400 })).displacement).toBe(16);
    expect(normalizeLensSpec(spec({ curvature: 0 })).curvature).toBe(0.25);
    expect(normalizeLensSpec(spec({ splay: -3 })).splay).toBe(0);
  });

  it('never lets the radius exceed half the shorter side', () => {
    // A larger radius has no meaning and the generator would read past the map.
    expect(normalizeLensSpec(spec({ width: 80, height: 32, borderRadius: 999 })).borderRadius).toBe(
      16,
    );
  });

  it('refuses a value that is not a number, rather than rendering something arbitrary', () => {
    // A clamped NaN is a bug rendered as a picture. A thrown one is a bug.
    expect(() => normalizeLensSpec(spec({ width: Number.NaN }))).toThrow(TypeError);
    expect(() => normalizeLensSpec(spec({ displacement: Number.POSITIVE_INFINITY }))).toThrow(
      TypeError,
    );
  });

  it('refuses an area it cannot afford to generate', () => {
    // Cost is linear in area with a large constant - a map is written pixel by
    // pixel and then PNG-encoded. Anything this big is the effect being asked
    // to do a job it is not for.
    expect(() => normalizeLensSpec(spec({ width: 512, height: 512 }))).toThrow(RangeError);
  });

  it('versions the key, so changing the generator invalidates every stored map', () => {
    expect(lensMapKey(normalizeLensSpec(spec()))).toMatch(/^v1:/);
  });
});

describe('LensMapCache', () => {
  it('generates a shape once, however many lenses ask for it', async () => {
    const generate = vi.fn(async (s: NormalizedLensSpec) => fakeResource(s));
    const cache = new LensMapCache({ generate, dispose: () => undefined });
    const shape = normalizeLensSpec(spec());

    await cache.acquire(shape);
    await cache.acquire(shape);

    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('deduplicates two requests made in the same frame', async () => {
    // The normal case when a switcher mounts, not a rare one: without this,
    // three segments of one shape produce three encodes.
    const shape = normalizeLensSpec(spec());
    // Captured outside the promise so the type is a resolver rather than
    // something narrowed to `never` by an assignment TypeScript cannot see.
    let settle!: (resource: LensMapResource) => void;
    const pending = new Promise<LensMapResource>((resolve) => {
      settle = resolve;
    });
    const generate = vi.fn((): Promise<LensMapResource> => pending);
    const cache = new LensMapCache({ generate, dispose: () => undefined });

    const both = Promise.all([cache.acquire(shape), cache.acquire(shape)]);
    settle(fakeResource(shape));
    const [first, second] = await both;

    expect(generate).toHaveBeenCalledTimes(1);
    expect(first.url).toBe(second.url);
  });

  it('releases the object URL of what it evicts', async () => {
    /*
     * The failure that gets worse the longer the app is open. An object URL the
     * browser is never told to revoke is memory it cannot collect, and a map is
     * a PNG.
     */
    const disposed: string[] = [];
    const cache = new LensMapCache({
      generate: async (s) => fakeResource(s),
      dispose: (resource) => disposed.push(resource.url),
      limit: 2,
    });

    const shapes = [64, 80, 96, 112].map((width) => normalizeLensSpec(spec({ width })));
    for (const shape of shapes) {
      await cache.acquire(shape);
      cache.release(shape);
    }

    expect(cache.size).toBeLessThanOrEqual(2);
    expect(disposed.length).toBeGreaterThan(0);
    // Oldest first: the shapes still cached are the most recent ones.
    expect(disposed[0]).toContain(':64:');
  });

  it('never evicts a map something is still using', async () => {
    /*
     * Revoking a URL a live filter points at renders the lens as a hole, which
     * is worse than any amount of memory. A shell holding more shapes than the
     * limit keeps all of them.
     */
    const disposed: string[] = [];
    const cache = new LensMapCache({
      generate: async (s) => fakeResource(s),
      dispose: (resource) => disposed.push(resource.url),
      limit: 1,
    });

    const held = [64, 80, 96].map((width) => normalizeLensSpec(spec({ width })));
    for (const shape of held) {
      await cache.acquire(shape);
    }

    expect(disposed).toEqual([]);
    expect(cache.size).toBe(3);
  });

  it('evicts only once the last holder has let go', async () => {
    // A limit of zero, so anything unheld goes immediately: what is being
    // tested is the ref count, not the eviction order.
    const disposed: string[] = [];
    const cache = new LensMapCache({
      generate: async (s) => fakeResource(s),
      dispose: (resource) => disposed.push(resource.url),
      limit: 0,
    });
    const shape = normalizeLensSpec(spec());

    // Two lenses of the same shape - a switcher with two selected states, or a
    // control that remounted before the old one tore down.
    await cache.acquire(shape);
    await cache.acquire(shape);

    cache.release(shape);
    expect(disposed).toEqual([]);
    cache.release(shape);
    expect(disposed).toHaveLength(1);
  });

  it('lets a failed generation through rather than caching the failure', async () => {
    // A cached rejection would make one bad frame permanent.
    let firstCall = true;
    const generate = async (s: NormalizedLensSpec): Promise<LensMapResource> => {
      if (firstCall) {
        firstCall = false;
        throw new Error('no 2D context');
      }
      return fakeResource(s);
    };
    const cache = new LensMapCache({ generate, dispose: () => undefined });
    const shape = normalizeLensSpec(spec());

    await expect(cache.acquire(shape)).rejects.toThrow('no 2D context');
    await expect(cache.acquire(shape)).resolves.toMatchObject({ key: lensMapKey(shape) });
  });

  it('releases everything on teardown', async () => {
    const disposed: string[] = [];
    const cache = new LensMapCache({
      generate: async (s) => fakeResource(s),
      dispose: (resource) => disposed.push(resource.url),
    });
    await cache.acquire(normalizeLensSpec(spec()));

    cache.clear();

    // Held or not: nothing is on screen once the shell is gone.
    expect(disposed).toHaveLength(1);
    expect(cache.size).toBe(0);
  });
});
