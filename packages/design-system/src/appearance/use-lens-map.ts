import { useEffect, useRef, useState } from 'react';
import {
  LensMapCache,
  generateLensMap,
  normalizeLensSpec,
  type LensMapResource,
  type LensSpec,
} from './lens-map';

/**
 * One cache for the whole document.
 *
 * A per-component cache would defeat the point: two controls of the same shape
 * are the case worth sharing, and they are in different components. Module
 * scope rather than a provider because there is nothing to configure and a
 * provider nobody can vary is ceremony.
 */
let shared: LensMapCache | null = null;

function sharedCache(): LensMapCache {
  shared ??= new LensMapCache({ generate: generateLensMap });
  return shared;
}

/** For tests and teardown, so a suite does not carry maps between cases. */
export function clearLensMapCache(): void {
  shared?.clear();
  shared = null;
}

export interface LensMapState {
  /** The generated map, or null while it is being made or after it failed. */
  readonly resource: LensMapResource | null;
  /**
   * True once generation has failed.
   *
   * Feeds `resolveOpticalQuality`'s `runtimeFailed`, which drops this surface
   * to plain material. A lens that failed once on a device will fail again, and
   * retrying every render would spend a canvas per frame to keep being wrong.
   */
  readonly failed: boolean;
}

/**
 * Acquires the displacement map for a shape, and gives it back on unmount.
 *
 * `enabled` is a parameter rather than a caller-side condition because a hook
 * cannot be called conditionally, and because the disabled path still has to
 * release whatever the enabled path took. Passing false is how a surface that
 * has downgraded to material stops holding a map it is no longer drawing.
 *
 * Every effect that starts a generation also aborts it. A control that resizes
 * while its map is being made would otherwise finish the old one, take a
 * reference to it, and leak that reference when the new one replaces it.
 */
export function useLensMap(spec: LensSpec | null, enabled: boolean): LensMapState {
  const [resource, setResource] = useState<LensMapResource | null>(null);
  const [failed, setFailed] = useState(false);
  // Read in the cleanup, where the spec prop may already be the next one.
  const held = useRef<ReturnType<typeof normalizeLensSpec> | null>(null);
  /*
   * The latest shape, read inside the effect rather than depended on.
   *
   * Every caller builds its spec inline, because it comes from a measurement -
   * so the object is new on every render. Depending on it re-ran this effect
   * every render, and because each run aborts the previous one's controller,
   * no generation ever survived long enough to finish: the map failed, the
   * surface downgraded to plain material, and the downgrade looked so much like
   * correct behaviour that it took a dump of the resolved environment to see
   * `runtimeFailed: true` and realise the lens had never had a chance.
   */
  const latest = useRef(spec);
  latest.current = spec;

  const key = spec === null ? null : JSON.stringify(spec);

  useEffect(() => {
    const current = latest.current;
    if (!enabled || current === null) {
      setResource(null);
      return;
    }

    let normalized: ReturnType<typeof normalizeLensSpec>;
    try {
      normalized = normalizeLensSpec(current);
    } catch {
      // A shape this cannot generate is not an error the user should see; the
      // surface simply stays material.
      setFailed(true);
      setResource(null);
      return;
    }

    const cache = sharedCache();
    const controller = new AbortController();
    let live = true;

    void cache
      .acquire(normalized, controller.signal)
      .then((next) => {
        if (!live) {
          // Arrived after unmount: hand it straight back rather than leaving a
          // reference nothing will ever release.
          cache.release(normalized);
          return;
        }
        held.current = normalized;
        setResource(next);
      })
      .catch(() => {
        if (!live) return;
        setFailed(true);
        setResource(null);
      });

    return () => {
      live = false;
      controller.abort();
      if (held.current !== null) {
        cache.release(held.current);
        held.current = null;
      }
    };
    // Keyed on the serialised shape, never on the object. See `latest`.
  }, [key, enabled]);

  return { resource, failed };
}
