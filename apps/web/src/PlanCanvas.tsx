import { useEffect, useRef, type PointerEvent } from 'react';
import { screenPoint, screenToWorld, worldPoint, type Viewport } from '@arq/geometry-2d';
import { fitToBounds } from '@arq/editor-shell';
import { buildPlanScene, paintPlanScene, type PlanPrimitiveInput } from '@arq/plan-renderer';

/**
 * A real (if small) proof that the whole pipeline works end to end: real
 * geometry-2d world points, a real editor-shell viewport fit, a real
 * PlanScene (ARQ-119), painted through the real ADR-0008 Canvas 2D backend -
 * not a hardcoded pixel drawing. No project/document model exists yet
 * (that's later, deeper work), so this demo scene stands in for "a project's
 * elements" until a real one can be loaded.
 */
const DEMO_ROOM_WIDTH_MM = 4200;
const DEMO_ROOM_HEIGHT_MM = 3600;

const DEMO_INPUTS: readonly PlanPrimitiveInput<string>[] = [
  {
    kind: 'polygon',
    elementId: 'demo-room',
    points: [
      worldPoint(0, 0),
      worldPoint(DEMO_ROOM_WIDTH_MM, 0),
      worldPoint(DEMO_ROOM_WIDTH_MM, DEMO_ROOM_HEIGHT_MM),
      worldPoint(0, DEMO_ROOM_HEIGHT_MM),
    ],
  },
  {
    kind: 'text',
    elementId: 'demo-room-label',
    anchor: worldPoint(DEMO_ROOM_WIDTH_MM / 2, DEMO_ROOM_HEIGHT_MM / 2),
    text: '4.20 m x 3.60 m',
  },
];

const NO_SELECTION = { primary: null, secondary: new Set<string>() };
const NONE = new Set<string>();

export interface PlanCanvasProps {
  /** Reports the world position under the pointer (null once the pointer leaves the canvas) - drives the status bar's cursor-coordinates readout (ARQ-027). */
  readonly onPointerWorldPositionChange?: (
    point: { readonly x: number; readonly y: number } | null,
  ) => void;
  /** Reports the viewport's current zoom in CSS-pixel terms (device-pixel-ratio removed) - drives the status bar's view-scale readout. */
  readonly onViewportPixelsPerUnitChange?: (cssPixelsPerUnit: number) => void;
}

export function PlanCanvas(props: PlanCanvasProps): JSX.Element {
  const { onPointerWorldPositionChange, onViewportPixelsPerUnitChange } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const devicePixelRatioRef = useRef(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      return;
    }

    function paint(): void {
      if (canvas === null || ctx === null) {
        return;
      }
      const devicePixelRatio = window.devicePixelRatio || 1;
      devicePixelRatioRef.current = devicePixelRatio;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * devicePixelRatio));
      canvas.height = Math.max(1, Math.round(rect.height * devicePixelRatio));

      const scene = buildPlanScene(DEMO_INPUTS, NONE, NO_SELECTION, NONE);
      const fitted = fitToBounds(
        { min: worldPoint(0, 0), max: worldPoint(DEMO_ROOM_WIDTH_MM, DEMO_ROOM_HEIGHT_MM) },
        rect.width,
        rect.height,
      );
      const viewport: Viewport = {
        ...fitted,
        screenWidth: canvas.width,
        screenHeight: canvas.height,
        pixelsPerUnit: fitted.pixelsPerUnit * devicePixelRatio,
      };
      viewportRef.current = viewport;
      onViewportPixelsPerUnitChange?.(fitted.pixelsPerUnit);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${14 * devicePixelRatio}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      paintPlanScene(ctx, viewport, devicePixelRatio, scene);
    }

    paint();
    window.addEventListener('resize', paint);
    return () => window.removeEventListener('resize', paint);
  }, [onViewportPixelsPerUnitChange]);

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>): void {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (canvas === null || viewport === null || onPointerWorldPositionChange === undefined) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const devicePixelRatio = devicePixelRatioRef.current;
    const world = screenToWorld(
      viewport,
      screenPoint(
        (event.clientX - rect.left) * devicePixelRatio,
        (event.clientY - rect.top) * devicePixelRatio,
      ),
    );
    onPointerWorldPositionChange({ x: world.x, y: world.y });
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onPointerWorldPositionChange?.(null)}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
