import type { HTMLAttributes, ReactNode } from 'react';

export const CANVAS_OVERLAY_ZONES = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
  'center',
  'selection',
  'tool',
] as const;

export type CanvasOverlayZoneName = (typeof CANVAS_OVERLAY_ZONES)[number];

export const CANVAS_OVERLAY_ROLE_ZONE = {
  'view-identity': 'top-left',
  'level-selector': 'top-left',
  'view-controls': 'top-right',
  'transient-feedback': 'bottom-center',
  'ai-highlight': 'center',
  'selection-chrome': 'selection',
  'tool-hud': 'tool',
} as const satisfies Readonly<Record<string, CanvasOverlayZoneName>>;

export type CanvasOverlayRole = keyof typeof CANVAS_OVERLAY_ROLE_ZONE;

export interface CanvasOverlayZoneProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  readonly zone: CanvasOverlayZoneName;
  readonly children: ReactNode;
}

/**
 * Presentation-only host for canvas chrome.
 *
 * The zone itself is always pointer-transparent. Interactive descendants opt
 * back in with `arq-canvas-overlay-control`, which keeps the rest of the
 * canvas hit-testable while allowing real buttons/fields to own their bounds.
 * Selection/tool zones are geometry-anchored full-canvas hosts; corner/centre
 * zones use the workspace safe-area variables from overlay-zone-contract.css.
 * Layer ordering itself remains owned by shell-tokens.css.
 */
export function CanvasOverlayZone(props: CanvasOverlayZoneProps): JSX.Element {
  const { zone, className, children, ...rest } = props;
  return (
    <div
      {...rest}
      className={['arq-canvas-overlay-zone', className].filter(Boolean).join(' ')}
      data-arq-overlay-zone={zone}
    >
      {children}
    </div>
  );
}

export const CANVAS_OVERLAY_CONTROL_CLASS = 'arq-canvas-overlay-control';
