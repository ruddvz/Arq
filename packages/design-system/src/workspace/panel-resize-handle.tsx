import { useCallback, useRef } from 'react';
import { panelWidthBounds, type PanelId } from '@arq/workspace';

export interface PanelResizeHandleProps {
  readonly panel: PanelId;
  readonly label: string;
  /** Which edge of the canvas the panel sits on - decides drag direction. */
  readonly side: 'left' | 'right';
  readonly widthPx: number;
  readonly onResize: (widthPx: number) => void;
  /**
   * Optional because secondary/non-collapsible panels use the same resize
   * primitive. When present, dragging deliberately past the minimum or pressing
   * the shrink key once more at the minimum collapses the panel.
   */
  readonly onCollapse?: () => void;
}

/** Doc 36 keyboard resizing: one arrow press is a visible but unsurprising step. */
const KEYBOARD_STEP_PX = 16;
/**
 * A full compact rail width of travel below the registry minimum is required
 * before a pointer drag collapses. This prevents a slightly imprecise resize at
 * the minimum from unexpectedly hiding a panel.
 */
export const PANEL_COLLAPSE_DRAG_DEADBAND_PX = 48;

/**
 * The drag handle for a docked panel. `workspace-panel-registry.json` has
 * carried resizable ranges since Package 3.0 landed (browser 232-384, inspector
 * 248-420) and `clampPanelWidth` has enforced them, but nothing let the user
 * actually reach them.
 *
 * `role="separator"` with `aria-valuenow` is the ARIA window-splitter pattern,
 * so this is not a mouse-only affordance: Arrow keys resize by a step, Home and
 * End jump to the registry's own minimum and maximum. When collapse is enabled,
 * one further shrink keypress at the minimum collapses instead of silently
 * reporting another already-clamped width.
 *
 * Pointer capture rather than document-level listeners: the drag keeps working
 * when the pointer outruns the 6px handle, and it ends cleanly if the pointer is
 * cancelled. Collapse requires a deliberate 48px drag past the minimum so a
 * normal resize cannot accidentally dismiss the panel.
 *
 * Width is *reported*, never stored here. `resizePanel` in @arq/workspace owns
 * clamping and the host owns collapse state, so this component cannot become a
 * second panel-state authority.
 */
export function PanelResizeHandle(props: PanelResizeHandleProps): JSX.Element {
  const { panel, label, side, widthPx, onResize, onCollapse } = props;
  const bounds = panelWidthBounds(panel);
  const collapseThresholdPx = Math.max(0, bounds.min - PANEL_COLLAPSE_DRAG_DEADBAND_PX);
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
      const nextWidth = origin.width + (side === 'left' ? delta : -delta);
      if (onCollapse !== undefined && nextWidth <= collapseThresholdPx) {
        dragOriginRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        onCollapse();
        return;
      }
      onResize(nextWidth);
    },
    [collapseThresholdPx, onCollapse, onResize, side],
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
        if (onCollapse !== undefined && widthPx <= bounds.min) {
          onCollapse();
        } else {
          onResize(widthPx - KEYBOARD_STEP_PX);
        }
      } else if (event.key === 'Home') {
        event.preventDefault();
        onResize(bounds.min);
      } else if (event.key === 'End') {
        event.preventDefault();
        onResize(bounds.max);
      }
    },
    [bounds.max, bounds.min, onCollapse, onResize, side, widthPx],
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
      title={
        onCollapse === undefined
          ? `Resize ${label}. Double-click to reset.`
          : `Resize ${label}. Double-click to reset; shrink past minimum to collapse.`
      }
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
