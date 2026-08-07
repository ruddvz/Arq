import { useEffect, useId } from 'react';
import { useLensMap } from './use-lens-map';
import type { LensSpec } from './lens-map';

export interface RefractionLensProps {
  /** The shape to bend, in CSS pixels. Measured by the caller, never assumed. */
  readonly spec: LensSpec | null;
  /** False once the quality policy has resolved below `refraction`. */
  readonly enabled: boolean;
  /** Told when generation fails, so the host can stop asking. */
  readonly onFailed?: () => void;
}

/**
 * The optical distortion behind a small moving indicator.
 *
 * Decorative, and the package is emphatic about what that means: "never
 * semantic, never the only selected-state signal". Everything a reader needs to
 * know which segment is selected is already carried by `aria-selected`, the
 * raised surface and the weight of the label. This adds the one thing those
 * cannot - the sense that the indicator is a physical object with the backdrop
 * bending through it - and it is completely absent for anyone whose settings or
 * browser rule it out, with nothing lost.
 *
 * Hidden from assistive technology and from input, because it is a picture of
 * an effect rather than a control. `pointer-events: none` in the stylesheet
 * matters as much as `aria-hidden`: a lens sits over the button it decorates,
 * and a decoration that swallows the click is worse than no decoration.
 *
 * Renders nothing at all until the map exists. A displacement filter pointed at
 * a URL that is not there yet renders the backdrop as a black rectangle in some
 * engines, which is the one failure mode worse than the effect being missing.
 */
export function RefractionLens(props: RefractionLensProps): JSX.Element | null {
  const { spec, enabled, onFailed } = props;
  const filterId = useId();
  const { resource, failed } = useLensMap(spec, enabled);

  /*
   * Reported from an effect, not from the render.
   *
   * `onFailed` sets state in the parent, and calling it while this component is
   * rendering is the "cannot update a component while rendering a different
   * component" error - React may drop the update, which would leave the host
   * asking for a lens that has already failed, every frame.
   */
  useEffect(() => {
    if (failed) onFailed?.();
  }, [failed, onFailed]);

  if (failed) {
    return null;
  }
  if (!enabled || spec === null || resource === null) {
    return null;
  }

  return (
    <span
      className="arq-refraction-lens"
      aria-hidden="true"
      style={{
        width: spec.width,
        height: spec.height,
        borderRadius: spec.borderRadius,
        // The filter is what does the work; the element is only its bounds.
        backdropFilter: `url(#${filterId})`,
        WebkitBackdropFilter: `url(#${filterId})`,
      }}
    >
      <svg className="arq-refraction-lens__defs" aria-hidden="true" focusable="false">
        <filter
          id={filterId}
          /*
           * `userSpaceOnUse` with explicit bounds rather than the default
           * fractional box. A filter region expressed in fractions of the
           * element grows with it, and a region larger than the lens is a
           * larger area for the compositor to resolve for no visible gain.
           */
          filterUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={spec.width}
          height={spec.height}
        >
          <feImage href={resource.url} result="map" preserveAspectRatio="none" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={spec.displacement}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
    </span>
  );
}
