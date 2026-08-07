/**
 * How much of the optical material this environment actually gets.
 *
 * Optical Glass 2.0 defines three visual classes - solid, material, refraction
 * - and the whole point of resolving between them in one pure function is that
 * every surface asks the same question and gets the same answer. A component
 * that decides for itself is a component that will disagree with the next one.
 *
 * Kept free of `window`, `matchMedia` and `CSS.supports` on purpose: the caller
 * reads the environment, this decides what to do about it. That is what lets
 * the whole downgrade ladder be tested without a browser, which matters because
 * the ladder is mostly about configurations a test browser is not in.
 *
 * `off` is not a failure state. It is the complete design for anyone who has
 * asked for reduced transparency or is in forced colours, and it must lose no
 * control and no information - the same rule ADR-0031 already sets for the
 * regular material.
 */

export type OpticalQuality = 'off' | 'material' | 'refraction' | 'auto';

/** What a surface actually renders. `auto` is a request, never an outcome. */
export type ResolvedOpticalQuality = Exclude<OpticalQuality, 'auto'>;

export interface OpticalEnvironment {
  /** What the product asked for, from feature configuration. */
  readonly requested: OpticalQuality;
  readonly reducedTransparency: boolean;
  readonly increasedContrast: boolean;
  readonly forcedColors: boolean;
  readonly supportsBackdropFilter: boolean;
  /** The refraction lens is an SVG displacement map; without it there is no lens. */
  readonly supportsDisplacementMap: boolean;
  /**
   * True while a screenshot or visual baseline is being taken.
   *
   * A refraction lens samples what is behind it, so it is not reproducible
   * frame to frame - a visual baseline containing one is a baseline that fails
   * for reasons unrelated to the change under test.
   */
  readonly deterministicCapture: boolean;
  /** Set once a lens has failed to generate, so the next one does not try again. */
  readonly runtimeFailed: boolean;
}

/**
 * Resolves in order of authority: what the user's system demands, then what the
 * browser can do, then what the product asked for.
 *
 * The user's settings come first and are not negotiable against a product
 * preference - `requested: 'refraction'` does not override reduced
 * transparency, and the ordering here is the only place that is enforced.
 */
export function resolveOpticalQuality(environment: OpticalEnvironment): ResolvedOpticalQuality {
  const {
    requested,
    reducedTransparency,
    increasedContrast,
    forcedColors,
    supportsBackdropFilter,
    supportsDisplacementMap,
    deterministicCapture,
    runtimeFailed,
  } = environment;

  /*
   * Increased contrast joins the package's list. A translucent surface lowers
   * the contrast of everything drawn on it by definition, so honouring a
   * request for more contrast by keeping the blur would be answering the
   * opposite of the question - which is the reasoning `material.css` already
   * applies to the regular variant, restated here so the two cannot drift.
   */
  if (requested === 'off' || forcedColors || reducedTransparency || increasedContrast) {
    return 'off';
  }

  // Nothing above material is possible without the property that makes it.
  if (!supportsBackdropFilter) {
    return 'off';
  }

  if (requested === 'material') {
    return 'material';
  }

  /*
   * Everything that downgrades refraction to material rather than to off. The
   * surface is still glass in each of these; only the lens is gone, and the
   * lens is decorative by the package's own words - "never semantic, never the
   * only selected-state signal" - so losing it costs nothing a reader needs.
   */
  if (deterministicCapture || runtimeFailed || !supportsDisplacementMap) {
    return 'material';
  }

  return 'refraction';
}

/**
 * Reads the environment from the browser.
 *
 * Separate from the decision above so the decision stays testable, and so a
 * host with its own capability store can supply the values instead. Returns the
 * safe answer under server rendering: no window means no measurement, and
 * guessing that a filter is supported would render a translucent surface with
 * nothing resolved behind it - the one genuinely unreadable outcome.
 */
export function readOpticalEnvironment(
  requested: OpticalQuality,
  overrides: Partial<OpticalEnvironment> = {},
): OpticalEnvironment {
  const matches = (query: string): boolean =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;
  const supports = (property: string, value: string): boolean =>
    typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
      ? CSS.supports(property, value)
      : false;

  return {
    requested,
    reducedTransparency: matches('(prefers-reduced-transparency: reduce)'),
    increasedContrast: matches('(prefers-contrast: more)'),
    forcedColors: matches('(forced-colors: active)'),
    supportsBackdropFilter:
      supports('backdrop-filter', 'blur(1px)') || supports('-webkit-backdrop-filter', 'blur(1px)'),
    supportsDisplacementMap: supports('filter', 'url(#x)'),
    deterministicCapture: false,
    runtimeFailed: false,
    ...overrides,
  };
}
