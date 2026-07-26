import { useEffect, useState } from 'react';
import type { ViewportProbe } from '@arq/workspace';

/**
 * Measures the one thing `resolveWorkspacePlatform` needs: width, height and
 * whether the primary pointer is coarse. Deliberately *not* a device check -
 * doc 46 and the Package 3.0 responsive contract both insist layout selection
 * is "content/pointer capability driven", so this reads
 * `matchMedia('(pointer: coarse)')` and never `navigator.userAgent`.
 *
 * The pointer query is subscribed to, not sampled once: a Surface or iPad with
 * a keyboard case attached changes its primary pointer while the page is open,
 * and a workspace that only measured at mount would leave that user in the
 * wrong layout until they reloaded.
 *
 * `fallback` is used before the first effect runs and in any non-browser
 * environment, so this hook is safe to call from a component under test
 * without a DOM.
 */
export function useViewportProbe(fallback: ViewportProbe): ViewportProbe {
  const [probe, setProbe] = useState<ViewportProbe>(fallback);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const coarse = window.matchMedia('(pointer: coarse)');

    const measure = (): void => {
      setProbe({
        widthPx: window.innerWidth,
        heightPx: window.innerHeight,
        coarsePointer: coarse.matches,
      });
    };

    measure();
    window.addEventListener('resize', measure);
    coarse.addEventListener('change', measure);
    return () => {
      window.removeEventListener('resize', measure);
      coarse.removeEventListener('change', measure);
    };
  }, []);

  return probe;
}
