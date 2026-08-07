import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { RefractionLens } from '../appearance/refraction-lens';
import {
  readOpticalEnvironment,
  resolveOpticalQuality,
  type OpticalQuality,
} from '../appearance/optical-quality';
import type { ViewTabsState, WorkspaceViewKind } from '@arq/workspace';

export interface ViewKindSegment {
  readonly kind: WorkspaceViewKind;
  readonly label: string;
  /**
   * Why this kind cannot be opened, or undefined when it can.
   *
   * A segment with a reason stays on the capsule, disabled, carrying the reason
   * in its accessible name - the same visible-and-explained treatment the tool
   * rail gives an unavailable tool and the phone dock gives Review. Removing it
   * would be quieter and would leave a reader to conclude the product has no
   * such thing at all.
   */
  readonly disabledReason?: string;
  readonly icon?: ReactNode;
}

export interface ViewKindSwitcherProps {
  readonly segments: readonly ViewKindSegment[];
  readonly state: ViewTabsState;
  /** Activate the open view of this kind, or open one if none is open yet. */
  readonly onSelectKind: (kind: WorkspaceViewKind) => void;
  /**
   * How much optical material this control may use. Defaults to `auto`, which
   * lets the environment decide; a host can pass `off` to turn it off outright
   * without touching the component.
   */
  readonly opticalQuality?: OpticalQuality;
}

/**
 * The workspace's view switcher: plan, model, sheets.
 *
 * This replaces a strip of closeable tabs that sat on a row of its own beneath
 * the project bar. The two are not the same idea and the difference matters.
 * A tab is a view *instance* - two plans can be open at once, and closing a tab
 * must leave the view itself untouched. A segment here is a view *kind*: the
 * question it answers is "how am I looking at this building", and which level
 * or which sheet is a separate question the project browser already answers.
 *
 * Splitting them that way is what lets this live in the project bar rather than
 * under it. A tab strip has to grow with the number of open views and so needs
 * a row; three kinds do not, so the row goes back to the drawing.
 *
 * No state of its own. `onSelectKind` drives the same `openTab`/`activateTab`
 * reducers the strip did, and `openTab` is idempotent by id, so "activate the
 * one that is open, or open one" is a single call at the host.
 *
 * It is still a tablist, still exposes `aria-selected`, and still keeps the
 * active segment visible without opening anything - the three properties the
 * workspace layout check asserts, which are about the user's ability to see
 * where they are rather than about tabs specifically.
 */
export function ViewKindSwitcher(props: ViewKindSwitcherProps): JSX.Element {
  const { segments, state, onSelectKind, opticalQuality = 'auto' } = props;
  const segmentRefs = useRef(new Map<WorkspaceViewKind, HTMLButtonElement>());
  const trackRef = useRef<HTMLDivElement>(null);
  const [runtimeFailed, setRuntimeFailed] = useState(false);
  /**
   * The selected segment's box, measured rather than computed.
   *
   * The package is explicit that index arithmetic is not allowed here, and the
   * reason is visible in this very control: "Plan", "3D" and "Sheets" are three
   * different widths, so the nth segment is not at n times anything. Measuring
   * is also what keeps the lens correct after a font loads, a label is
   * translated, or the capsule is resized.
   */
  const [indicator, setIndicator] = useState<{
    readonly x: number;
    readonly width: number;
    readonly height: number;
  } | null>(null);
  const activeKind = state.tabs.find((tab) => tab.id === state.activeId)?.kind ?? null;
  const enabled = segments.filter((segment) => segment.disabledReason === undefined);
  /*
   * Where the single Tab stop sits.
   *
   * Normally the selected segment. But the active view can be a kind this
   * capsule does not carry - Project overview is reachable from the logo and is
   * deliberately not a segment - and then nothing here is selected. Without a
   * fallback every segment would be `tabIndex={-1}` and the only route between
   * plan, model and sheets would be unreachable from the keyboard.
   */
  const focusableKind =
    enabled.find((segment) => segment.kind === activeKind)?.kind ?? enabled[0]?.kind ?? null;

  /*
   * Moving *and* activating, in that order, which is the whole point.
   *
   * The first version only activated: it called `onSelectKind` and left the
   * browser's focus on the segment the user had arrowed away from. The roving
   * tab stop moved with the selection, so focus and the tab stop ended up on
   * different buttons - the visible focus ring sat on "Plan" while "3D" was
   * selected, and a second Tab press left the capsule from the wrong place.
   * Selection is not focus, and a roving tabindex only works if something
   * actually rove.
   *
   * Activation follows focus deliberately (the ARIA "automatic activation"
   * tablist pattern, and what the tab strip this replaced already did): showing
   * a view the user has arrowed to is the thing they were asking for, and
   * requiring Enter afterwards would make switching a two-key gesture that no
   * other switcher in this shell requires.
   */
  function moveFocus(from: WorkspaceViewKind, delta: -1 | 1): void {
    if (enabled.length === 0) return;
    const index = enabled.findIndex((segment) => segment.kind === from);
    // Wraps, as a tablist should. A disabled segment is skipped rather than
    // focused-and-inert, which is why this walks `enabled` and not `segments`.
    const next = enabled[(index + delta + enabled.length) % enabled.length];
    if (next === undefined) return;
    segmentRefs.current.get(next.kind)?.focus();
    onSelectKind(next.kind);
  }

  /*
   * Resolved once per render rather than held in state: the environment can
   * change under the user (a system setting, a window moved to another
   * display), and a value cached at mount would keep rendering the material
   * somebody has since asked not to see.
   */
  const quality = resolveOpticalQuality(readOpticalEnvironment(opticalQuality, { runtimeFailed }));

  /*
   * Measured in a layout effect so the lens is placed in the same frame the
   * selection moves in. In a passive effect the user sees one frame of the lens
   * on the old segment, which on a control this small reads as a glitch rather
   * than as motion.
   */
  useLayoutEffect(() => {
    const measure = (): void => {
      const track = trackRef.current;
      const selected = activeKind === null ? undefined : segmentRefs.current.get(activeKind);
      if (track === undefined || track === null || selected === undefined) {
        setIndicator(null);
        return;
      }
      const trackBox = track.getBoundingClientRect();
      const box = selected.getBoundingClientRect();
      setIndicator({ x: box.left - trackBox.left, width: box.width, height: box.height });
    };
    measure();
    const track = trackRef.current;
    if (track === null || typeof ResizeObserver === 'undefined') return;
    // The capsule resizes when a label changes or the bar reflows, and the lens
    // has to follow rather than being measured once at mount.
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [activeKind, segments]);

  useEffect(() => {
    if (quality !== 'refraction') setIndicator((current) => current);
  }, [quality]);

  return (
    <div
      ref={trackRef}
      /*
       * The resolved quality, on the element, so a browser test can assert the
       * downgrade ladder from outside rather than by reaching into React. The
       * package's test matrix asks for exactly this: forced colours, reduced
       * transparency and an unsupported filter each have to be observable.
       */
      data-optical-quality={quality}
      data-lens-measured={
        indicator === null ? 'no' : `${Math.round(indicator.width)}x${Math.round(indicator.height)}`
      }
      className="arq-view-kinds arq-material arq-material--optical"
      role="tablist"
      aria-label="View kind"
      aria-orientation="horizontal"
      onKeyDown={(event) => {
        const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : null;
        if (delta === null || focusableKind === null) return;
        event.preventDefault();
        moveFocus(focusableKind, delta);
      }}
    >
      {/*
       * Positioned behind the labels and in front of the track, so the
       * distortion reads as the selected segment's own glass. It is drawn from
       * the measured box rather than from the segment's index, and it is simply
       * absent whenever the quality policy has resolved below refraction.
       */}
      {quality === 'refraction' && indicator !== null && (
        <span
          className="arq-refraction-lens__slot"
          aria-hidden="true"
          style={{ transform: `translate3d(${indicator.x}px, 0, 0)` }}
        >
          <RefractionLens
            enabled
            onFailed={() => setRuntimeFailed(true)}
            spec={{
              width: indicator.width,
              height: indicator.height,
              // A capsule's radius is half its height, and the lens has to
              // match the shape it sits in or the bend shows outside it.
              borderRadius: indicator.height / 2,
              displacement: 6,
              curvature: 2.2,
              splay: 1,
            }}
          />
        </span>
      )}
      {segments.map((segment) => {
        const disabled = segment.disabledReason !== undefined;
        const selected = !disabled && segment.kind === activeKind;
        return (
          <button
            key={segment.kind}
            ref={(node) => {
              if (node === null) segmentRefs.current.delete(segment.kind);
              else segmentRefs.current.set(segment.kind, node);
            }}
            type="button"
            role="tab"
            className="arq-shell-button arq-view-kinds__segment"
            aria-selected={selected}
            /*
             * The reason travels in the accessible name, not only in a
             * tooltip: a tooltip is a pointer affordance, and the reader most
             * likely to need the explanation is the one who cannot hover.
             */
            aria-label={disabled ? `${segment.label}. ${segment.disabledReason}` : segment.label}
            title={segment.disabledReason}
            disabled={disabled}
            // Roving tabindex: one stop for the whole capsule, arrows within.
            tabIndex={segment.kind === focusableKind ? 0 : -1}
            onClick={() => onSelectKind(segment.kind)}
          >
            {segment.icon}
            <span>{segment.label}</span>
          </button>
        );
      })}
    </div>
  );
}
