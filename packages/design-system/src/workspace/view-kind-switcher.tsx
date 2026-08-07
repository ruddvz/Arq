import { useRef, type ReactNode } from 'react';
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
  const { segments, state, onSelectKind } = props;
  const segmentRefs = useRef(new Map<WorkspaceViewKind, HTMLButtonElement>());
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

  return (
    <div
      className="arq-view-kinds"
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
