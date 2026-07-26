import { useCallback, useRef } from 'react';
import { panelWidthBounds, type PanelId } from '@arq/workspace';

export interface PanelResizeHandleProps {
  readonly panel: PanelId;
  readonly label: string;
  /** Which edge of the canvas the panel sits on - decides drag direction. */
  readonly side: 'left' | 'right';
  readonly widthPx: number;
  readonly onResize: (widthPx: number) => void;
}

/** Doc 36 keyboard resizing: one arrow press is a visible but unsurprising step. */
const KEYBOARD_STEP_PX = 16;

/**
 * The drag handle for a docked panel. `workspace-panel-registry.json` has
 * carried resizable ranges since Package 3.0 landed (browser 232-384, inspector
 * 248-420) and `clampPanelWidth` has enforced them, but nothing let the user
 * actually reach them.
 *
 * `role="separator"` with `aria-valuenow` is the ARIA window-splitter pattern,
 * so this is not a mouse-only affordance: Arrow keys resize by a step, Home and
 * End jump to the registry's own minimum and maximum. Doc 36 puts the panels in
 * a resizable range; a range only reachable by dragging excludes every user who
 * does not drag.
 *
 * Pointer capture rather than document-level listeners: the drag keeps working
 * when the pointer outruns the 6px handle, and it ends cleanly if the pointer is
 * cancelled - a lost pointerup used to be how a resize got stuck to the cursor.
 *
 * The width is *reported*, never stored here. `resizePanel` in @arq/workspace
 * clamps it against the registry, so this component cannot produce a width the
 * contract forbids even if the pointer maths is wrong.
 */
export function PanelResizeHandle(props: PanelResizeHandleProps): JSX.Element {
  const { panel, label, side, widthPx, onResize } = props;
  const bounds = panelWidthBounds(panel);
  const dragOriginRef = useRef<{ readonly x: number; readonly width: number } | null>(null);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Primary button only: a right-click on the handle should open the
      // browser's menu, not start a resize the user cannot see.
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragOriginRef.current = { x: event.clientX, width: widthPx };
    },
    [widthPx],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const origin = dragOriginRef.current;
      if (origin === null) {
        return;
      }
      const delta = event.clientX - origin.x;
      // A left panel grows as the pointer moves right; a right panel grows as
      // it moves left.
      onResize(origin.width + (side === 'left' ? delta : -delta));
    },
    [onResize, side],
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragOriginRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Grow/shrink read in the direction the user sees, not the axis sign.
      const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
      const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
      if (event.key === grow) {
        event.preventDefault();
        onResize(widthPx + KEYBOARD_STEP_PX);
      } else if (event.key === shrink) {
        event.preventDefault();
        onResize(widthPx - KEYBOARD_STEP_PX);
      } else if (event.key === 'Home') {
        event.preventDefault();
        onResize(bounds.min);
      } else if (event.key === 'End') {
        event.preventDefault();
        onResize(bounds.max);
      }
    },
    [bounds.max, bounds.min, onResize, side, widthPx],
  );

  // A panel the registry gives no range cannot be resized, so it gets no
  // handle at all rather than a control that does nothing.
  if (bounds.min === bounds.max) {
    return <></>;
  }

  return (
    <div
      className={`arq-panel-resize-handle arq-panel-resize-handle--${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      aria-valuenow={widthPx}
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      aria-valuetext={`${widthPx} pixels`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onResize(bounds.defaultWidth)}
      title={`Resize ${label}. Double-click to reset.`}
      style={{
        flex: '0 0 auto',
        width: 6,
        cursor: 'col-resize',
        // The 6px hit strip is narrow for a pointer but this is a fine-pointer
        // affordance by nature; touch bands use drawers and sheets instead of
        // resizable columns, so there is no coarse-pointer target to widen.
        touchAction: 'none',
        background: 'transparent',
        alignSelf: 'stretch',
      }}
    />
  );
}
