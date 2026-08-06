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
 * The size is observed rather than only listened for, and that is not belt and
 * braces. The mount measurement can land before the layout viewport has
 * settled - a phone applying its viewport meta, browser chrome collapsing on
 * first scroll, a restored tab - and the correction that follows does not
 * always arrive as a `resize` event. Measured in headless Chromium at 430x932,
 * the mount read returned a stale ~980px and no resize ever fired, so the
 * workspace rendered the tablet composition on a phone: desktop tab strip,
 * drawer bar, no phone dock, and it stayed that way. Dispatching a synthetic
 * resize corrected it immediately, which is what identified the cause.
 *
 * A `ResizeObserver` on the document element sees the layout viewport change
 * itself rather than an event somebody has to remember to fire, so the probe
 * converges on the truth however the viewport got there.
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
      /*
       * The document element's client box, not `window.innerWidth`.
       *
       * That box is the CSS layout viewport - the same one media queries
       * resolve against - so the band this picks always agrees with the CSS
       * around it. `window.innerWidth` includes the classic scrollbar and, on a
       * phone, reports the visual viewport, which drifts from the layout
       * viewport while zooming or when the browser chrome collapses. Measured
       * under mobile emulation at 430x932 the two disagreed and the workspace
       * chose the tablet composition on a phone.
       */
      const element = document.documentElement;
      setProbe({
        widthPx: element.clientWidth || window.innerWidth,
        heightPx: element.clientHeight || window.innerHeight,
        coarsePointer: coarse.matches,
      });
    };

    measure();
    window.addEventListener('resize', measure);
    coarse.addEventListener('change', measure);

    // Fires on observe and on every subsequent layout-viewport change, so a
    // viewport that settles after first paint is picked up without depending on
    // a resize event that may never come.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(document.documentElement);

    return () => {
      window.removeEventListener('resize', measure);
      coarse.removeEventListener('change', measure);
      observer?.disconnect();
    };
  }, []);

  return probe;
}
