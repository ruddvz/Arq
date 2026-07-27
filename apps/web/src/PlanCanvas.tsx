import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  screenPoint,
  worldPoint,
  worldToScreen,
  type Viewport,
  type WorldPoint,
} from '@arq/geometry-2d';
import {
  boundsFromCorners,
  createWallDrawTool,
  fitToBounds,
  panByScreenDelta,
  zoomAtScreenPoint,
} from '@arq/editor-shell';
import {
  buildPlanScene,
  paintPlanScene,
  snapGlyphPrimitives,
  withSelectionHandles,
  SNAP_GLYPH_LABEL,
  type PlanPrimitiveInput,
  type PlanSelectionState,
} from '@arq/plan-renderer';
import {
  GRID_SPACING_MM,
  clientToWorld,
  computeSnap,
  contentBounds,
  pickElementAt,
  selectWallsInRegion,
  wheelZoomFactor,
  type PlanContent,
} from './canvas/canvas-interaction';
import type { DrawnWall } from './canvas/plan-document';

/**
 * The interactive plan surface: the previously library-only editor-shell
 * tools wired to a real canvas. Pan (pan tool, middle-drag, space-drag,
 * two-pointer touch), zoom (wheel at cursor, pinch), wall drawing with the
 * ARQ-094 chain tool over the ARQ-045..052 snap pipeline, selection via
 * hit-test, and fit - all against the in-memory plan document
 * (see canvas/plan-document.ts for why that document is honest scope).
 *
 * The demo room fixture remains, labelled as such: it gives a new canvas
 * something measurable to snap to, exactly like a template would.
 */

const DEMO_ROOM_WIDTH_MM = 4200;
const DEMO_ROOM_HEIGHT_MM = 3600;
const DEMO_ROOM_ID = 'demo-room';

const DEMO_ROOM_POLYGON: readonly WorldPoint[] = [
  worldPoint(0, 0),
  worldPoint(DEMO_ROOM_WIDTH_MM, 0),
  worldPoint(DEMO_ROOM_WIDTH_MM, DEMO_ROOM_HEIGHT_MM),
  worldPoint(0, DEMO_ROOM_HEIGHT_MM),
];

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

export interface PlanCanvasProps {
  /** The workspace's active tool id - the canvas responds to select/wall/pan/fit. */
  readonly activeToolId: string | null;
  /** User-drawn walls (owned by the App so undo/redo and panels share them). */
  readonly walls: readonly DrawnWall[];
  /** Current selection, shared with the model panel and inspector. */
  readonly selection: PlanSelectionState<string>;
  /** Canvas click selected an element (null = clicked empty space). */
  readonly onSelectElement: (elementId: string | null) => void;
  /** Marquee drag selected zero or more elements (window/crossing, ARQ-041). */
  readonly onSelectMany: (elementIds: readonly string[]) => void;
  /** A finished wall chain to commit as an undoable operation. */
  readonly onCommitWalls: (walls: readonly DrawnWall[]) => void;
  /** Fit completed - the canvas asks the shell to return to Select. */
  readonly onFitCompleted: () => void;
  /** Live snap feedback for the status bar (null when not snapping). */
  readonly onActiveSnapChange?: (label: string | null) => void;
  /** Reports the world position under the pointer (null once the pointer leaves the canvas) - drives the status bar's cursor-coordinates readout (ARQ-027). */
  readonly onPointerWorldPositionChange?: (
    point: { readonly x: number; readonly y: number } | null,
  ) => void;
  /** Reports the viewport's current zoom in CSS-pixel terms (device-pixel-ratio removed) - drives the status bar's view-scale readout. */
  readonly onViewportPixelsPerUnitChange?: (cssPixelsPerUnit: number) => void;
}

interface PanState {
  readonly pointerId: number;
  readonly lastX: number;
  readonly lastY: number;
}

interface PinchState {
  readonly pointerIds: readonly [number, number];
  readonly lastDistance: number;
  readonly lastMidX: number;
  readonly lastMidY: number;
}

export function PlanCanvas(props: PlanCanvasProps): JSX.Element {
  const {
    activeToolId,
    walls,
    selection,
    onSelectElement,
    onSelectMany,
    onCommitWalls,
    onFitCompleted,
    onActiveSnapChange,
    onPointerWorldPositionChange,
    onViewportPixelsPerUnitChange,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const devicePixelRatioRef = useRef(1);
  const wallToolRef = useRef<ReturnType<typeof createWallDrawTool> | null>(null);
  const [draftPoints, setDraftPoints] = useState<readonly WorldPoint[]>([]);
  const [previewPoint, setPreviewPoint] = useState<WorldPoint | null>(null);
  const [snapPoint, setSnapPoint] = useState<{
    readonly point: WorldPoint;
    readonly source: keyof typeof SNAP_GLYPH_LABEL;
  } | null>(null);
  const panRef = useRef<PanState | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const spaceHeldRef = useRef(false);
  const pointerPositionsRef = useRef(new Map<number, { x: number; y: number }>());
  const wallCounterRef = useRef(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  /** In-progress marquee drag (select tool): anchor and live corner in world space. */
  const [marquee, setMarquee] = useState<{
    readonly pointerId: number;
    readonly anchor: WorldPoint;
    readonly corner: WorldPoint;
    readonly anchorScreenX: number;
    readonly anchorScreenY: number;
    readonly moved: boolean;
  } | null>(null);

  const content: PlanContent = useMemo(
    () => ({ roomId: DEMO_ROOM_ID, roomPolygon: DEMO_ROOM_POLYGON, walls }),
    [walls],
  );

  /* ------------------------------------------------------------------ */
  /* Painting                                                            */
  /* ------------------------------------------------------------------ */

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const currentViewport = viewport;
    if (canvas === null || currentViewport === null) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      return;
    }
    const devicePixelRatio = devicePixelRatioRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Light world-space grid under everything, only when legible (>= 6px
    // spacing on screen). Drawn directly - the grid is view furniture, not
    // a scene primitive, so it stays out of the renderer-neutral scene.
    const gridPx = GRID_SPACING_MM * (currentViewport.pixelsPerUnit / devicePixelRatio);
    if (gridPx >= 6) {
      const origin = worldToScreen(currentViewport, worldPoint(0, 0));
      const step = GRID_SPACING_MM * currentViewport.pixelsPerUnit;
      ctx.strokeStyle = 'rgba(128, 128, 128, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = origin.x % step; x < canvas.width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let y = origin.y % step; y < canvas.height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();
    }

    const inputs: PlanPrimitiveInput<string>[] = [
      { kind: 'polygon', elementId: DEMO_ROOM_ID, points: DEMO_ROOM_POLYGON },
      {
        kind: 'text',
        elementId: 'demo-room-label',
        anchor: worldPoint(DEMO_ROOM_WIDTH_MM / 2, DEMO_ROOM_HEIGHT_MM / 2),
        text: '4.20 m x 3.60 m (demo fixture)',
      },
      ...walls.map((wall): PlanPrimitiveInput<string> => ({
        kind: 'line',
        elementId: wall.id,
        points: [wall.start, wall.end],
      })),
    ];

    const scene = buildPlanScene(inputs, EMPTY_SET, selection, EMPTY_SET);
    // Hover is live pointer state, not project state, so it is applied on
    // top of the resolved scene (plan-scene.ts's own note: hover comes from
    // the caller). Selection outranks hover; only a default-styled primitive
    // takes the hover treatment.
    const hovered =
      hoveredId === null
        ? scene
        : {
            primitives: scene.primitives.map((primitive) =>
              primitive.elementId === hoveredId && primitive.styleToken === 'default'
                ? { ...primitive, styleToken: 'hover' as const }
                : primitive,
            ),
          };
    let painted = withSelectionHandles(hovered);

    // Draft chain + live preview segment, painted in the active-tool style.
    const draftPrimitives: PlanPrimitiveInput<string>[] = [];
    if (draftPoints.length > 1) {
      draftPrimitives.push({ kind: 'line', elementId: 'wall-draft', points: draftPoints });
    }
    if (draftPoints.length > 0 && previewPoint !== null) {
      const last = draftPoints[draftPoints.length - 1]!;
      draftPrimitives.push({
        kind: 'line',
        elementId: 'wall-preview',
        points: [last, previewPoint],
      });
    }
    if (draftPrimitives.length > 0) {
      painted = {
        primitives: [
          ...painted.primitives,
          ...draftPrimitives.map((input) => ({ ...input, styleToken: 'active-tool' as const })),
        ],
      };
    }

    if (snapPoint !== null) {
      const sizeWorld = 6 / (currentViewport.pixelsPerUnit / devicePixelRatio);
      const glyph = snapGlyphPrimitives(
        { source: snapPoint.source, point: snapPoint.point },
        'snap-glyph',
        sizeWorld,
      );
      painted = { primitives: [...painted.primitives, glyph.marker, glyph.label] };
    }

    ctx.font = `${12 * devicePixelRatio}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    paintPlanScene(ctx, currentViewport, devicePixelRatio, painted);

    // The marquee is view furniture like the grid: CAD convention, solid
    // edge for a window (left-to-right) drag, dashed for crossing.
    if (marquee !== null && marquee.moved) {
      const a = worldToScreen(currentViewport, marquee.anchor);
      const b = worldToScreen(currentViewport, marquee.corner);
      const crossing = marquee.corner.x < marquee.anchor.x;
      ctx.strokeStyle = 'rgba(11, 107, 80, 0.9)';
      ctx.lineWidth = 1;
      ctx.setLineDash(crossing ? [4 * devicePixelRatio, 4 * devicePixelRatio] : []);
      ctx.strokeRect(
        Math.min(a.x, b.x),
        Math.min(a.y, b.y),
        Math.abs(b.x - a.x),
        Math.abs(b.y - a.y),
      );
      ctx.setLineDash([]);
    }
  }, [viewport, walls, selection, draftPoints, previewPoint, snapPoint, hoveredId, marquee]);

  useEffect(() => {
    paint();
  }, [paint]);

  /* ------------------------------------------------------------------ */
  /* Sizing: initial fit + resize handling                               */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    function resize(): void {
      if (canvas === null) {
        return;
      }
      const devicePixelRatio = window.devicePixelRatio || 1;
      devicePixelRatioRef.current = devicePixelRatio;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * devicePixelRatio));
      canvas.height = Math.max(1, Math.round(rect.height * devicePixelRatio));
      setViewport((current) => {
        if (current === null) {
          const fitted = fitToBounds(
            contentBounds({ roomId: DEMO_ROOM_ID, roomPolygon: DEMO_ROOM_POLYGON, walls: [] }),
            rect.width,
            rect.height,
          );
          onViewportPixelsPerUnitChange?.(fitted.pixelsPerUnit);
          return {
            ...fitted,
            screenWidth: canvas.width,
            screenHeight: canvas.height,
            pixelsPerUnit: fitted.pixelsPerUnit * devicePixelRatio,
          };
        }
        // Keep the current view on resize - only the screen extent changes.
        return { ...current, screenWidth: canvas.width, screenHeight: canvas.height };
      });
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [onViewportPixelsPerUnitChange]);

  const updateViewport = useCallback(
    (next: Viewport) => {
      setViewport(next);
      onViewportPixelsPerUnitChange?.(next.pixelsPerUnit / devicePixelRatioRef.current);
    },
    [onViewportPixelsPerUnitChange],
  );

  /* ------------------------------------------------------------------ */
  /* Tool lifecycle                                                      */
  /* ------------------------------------------------------------------ */

  const clearDraft = useCallback(() => {
    wallToolRef.current = null;
    setDraftPoints([]);
    setPreviewPoint(null);
    setSnapPoint(null);
    setHoveredId(null);
    setMarquee(null);
    onActiveSnapChange?.(null);
  }, [onActiveSnapChange]);

  const commitDraft = useCallback(() => {
    const tool = wallToolRef.current;
    if (tool === null) {
      return;
    }
    const segments = tool.finish();
    if (segments.length > 0) {
      const committed: DrawnWall[] = segments.map((segment) => {
        wallCounterRef.current += 1;
        return {
          id: `drawn-wall-${wallCounterRef.current}`,
          start: segment.start,
          end: segment.end,
        };
      });
      onCommitWalls(committed);
    }
    // The wall tool stays active after a chain commits - re-arm a fresh
    // lifecycle so the next click starts the next chain (before this, the
    // second chain in one tool session silently did nothing).
    const next = createWallDrawTool();
    next.arm();
    next.beginPreview();
    wallToolRef.current = next;
    setDraftPoints([]);
    setPreviewPoint(null);
  }, [onCommitWalls]);

  // Arm the wall tool when it becomes active; discard any draft when the
  // active tool changes away (switching tools cancels, per the command
  // lifecycle's "commits only a valid preview" rule).
  useEffect(() => {
    if (activeToolId === 'wall') {
      const tool = createWallDrawTool();
      tool.arm();
      tool.beginPreview();
      wallToolRef.current = tool;
      return () => {
        wallToolRef.current = null;
      };
    }
    clearDraft();
    return undefined;
  }, [activeToolId, clearDraft]);

  // Fit is a one-shot verb, not a mode: perform it, then hand back to Select.
  useEffect(() => {
    if (activeToolId !== 'fit') {
      return;
    }
    const canvas = canvasRef.current;
    if (canvas !== null) {
      const rect = canvas.getBoundingClientRect();
      const devicePixelRatio = devicePixelRatioRef.current;
      const fitted = fitToBounds(contentBounds(content), rect.width, rect.height);
      updateViewport({
        ...fitted,
        screenWidth: canvas.width,
        screenHeight: canvas.height,
        pixelsPerUnit: fitted.pixelsPerUnit * devicePixelRatio,
      });
    }
    onFitCompleted();
  }, [activeToolId, content, onFitCompleted, updateViewport]);

  // Escape/Enter for the wall draft, on capture so the draft consumes the
  // key before the workspace shell's own Escape handling closes overlays.
  useEffect(() => {
    if (activeToolId !== 'wall') {
      return;
    }
    function onKeyDown(event: KeyboardEvent): void {
      const tool = wallToolRef.current;
      if (tool === null) {
        return;
      }
      if (event.key === 'Enter' && draftPoints.length > 1) {
        event.preventDefault();
        event.stopPropagation();
        commitDraft();
        return;
      }
      if (event.key === 'Escape' && draftPoints.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        tool.escape();
        const remaining = tool.snapshot().points;
        setDraftPoints(remaining);
        if (remaining.length === 0) {
          setPreviewPoint(null);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [activeToolId, draftPoints, commitDraft]);

  // Space-held panning, tracked at the window level like the shell's own
  // shortcut handling - never while a text field owns the keyboard.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target;
      const textFieldFocused =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (event.key === ' ' && !textFieldFocused) {
        spaceHeldRef.current = true;
      }
    }
    function onKeyUp(event: KeyboardEvent): void {
      if (event.key === ' ') {
        spaceHeldRef.current = false;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Wheel zoom (non-passive so the page never scroll-hijacks the plan)  */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    function onWheel(event: WheelEvent): void {
      if (canvas === null || viewport === null) {
        return;
      }
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const devicePixelRatio = devicePixelRatioRef.current;
      const anchor = screenPoint(
        (event.clientX - rect.left) * devicePixelRatio,
        (event.clientY - rect.top) * devicePixelRatio,
      );
      updateViewport(zoomAtScreenPoint(viewport, anchor, wheelZoomFactor(event.deltaY)));
    }
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [viewport, updateViewport]);

  /* ------------------------------------------------------------------ */
  /* Pointer handling                                                    */
  /* ------------------------------------------------------------------ */

  const toWorld = useCallback(
    (event: { clientX: number; clientY: number }): WorldPoint | null => {
      const canvas = canvasRef.current;
      if (canvas === null || viewport === null) {
        return null;
      }
      const rect = canvas.getBoundingClientRect();
      return clientToWorld(
        viewport,
        devicePixelRatioRef.current,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    },
    [viewport],
  );

  function beginPinchIfTwoPointers(): void {
    const positions = [...pointerPositionsRef.current.entries()];
    if (positions.length === 2) {
      const [[idA, a], [idB, b]] = positions as [
        [number, { x: number; y: number }],
        [number, { x: number; y: number }],
      ];
      pinchRef.current = {
        pointerIds: [idA, idB],
        lastDistance: Math.hypot(b.x - a.x, b.y - a.y),
        lastMidX: (a.x + b.x) / 2,
        lastMidY: (a.y + b.y) / 2,
      };
      panRef.current = null;
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const canvas = canvasRef.current;
    if (canvas === null || viewport === null) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    pointerPositionsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (event.pointerType === 'touch') {
      beginPinchIfTwoPointers();
      if (pinchRef.current !== null) {
        return;
      }
    }

    const wantsPan = activeToolId === 'pan' || event.button === 1 || spaceHeldRef.current === true;
    if (wantsPan) {
      panRef.current = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
      return;
    }

    if (event.button !== 0) {
      return;
    }
    const world = toWorld(event);
    if (world === null) {
      return;
    }

    if (activeToolId === 'wall') {
      const tool = wallToolRef.current;
      if (tool === null) {
        return;
      }
      const snapped = computeSnap(world, content, viewport)?.point ?? world;
      // Double-click-to-finish arrives as two pointerdowns at the same spot;
      // placing both would leave a zero-length trailing segment for
      // validation to reject. A repeat of the last point is a no-op instead.
      const last = tool.snapshot().points.at(-1);
      if (last !== undefined && Math.hypot(snapped.x - last.x, snapped.y - last.y) < 0.5) {
        return;
      }
      tool.placePoint(snapped);
      // The lifecycle parks in awaiting-input after a placement; re-enter
      // previewing so the next pointer move rubber-bands from this point.
      tool.beginPreview();
      setDraftPoints(tool.snapshot().points);
      setPreviewPoint(snapped);
      return;
    }

    if (activeToolId === 'select' || activeToolId === null) {
      // Selection commits on pointerup: a still click point-selects, a drag
      // becomes a window/crossing marquee (ARQ-041). Starting the marquee
      // here, unconditionally, lets pointerup decide which one happened.
      setMarquee({
        pointerId: event.pointerId,
        anchor: world,
        corner: world,
        anchorScreenX: event.clientX,
        anchorScreenY: event.clientY,
        moved: false,
      });
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const canvas = canvasRef.current;
    if (canvas === null || viewport === null) {
      return;
    }
    pointerPositionsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const pinch = pinchRef.current;
    if (pinch !== null) {
      const a = pointerPositionsRef.current.get(pinch.pointerIds[0]);
      const b = pointerPositionsRef.current.get(pinch.pointerIds[1]);
      if (a !== undefined && b !== undefined) {
        const rect = canvas.getBoundingClientRect();
        const devicePixelRatio = devicePixelRatioRef.current;
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        let next = panByScreenDelta(
          viewport,
          (midX - pinch.lastMidX) * devicePixelRatio,
          (midY - pinch.lastMidY) * devicePixelRatio,
        );
        if (pinch.lastDistance > 0 && distance > 0) {
          const anchor = {
            x: (midX - rect.left) * devicePixelRatio,
            y: (midY - rect.top) * devicePixelRatio,
          };
          next = zoomAtScreenPoint(
            next,
            anchor as Parameters<typeof zoomAtScreenPoint>[1],
            distance / pinch.lastDistance,
          );
        }
        pinchRef.current = { ...pinch, lastDistance: distance, lastMidX: midX, lastMidY: midY };
        updateViewport(next);
      }
      return;
    }

    const pan = panRef.current;
    if (pan !== null && pan.pointerId === event.pointerId) {
      const devicePixelRatio = devicePixelRatioRef.current;
      updateViewport(
        panByScreenDelta(
          viewport,
          (event.clientX - pan.lastX) * devicePixelRatio,
          (event.clientY - pan.lastY) * devicePixelRatio,
        ),
      );
      panRef.current = { pointerId: pan.pointerId, lastX: event.clientX, lastY: event.clientY };
      return;
    }

    const world = toWorld(event);
    if (world === null) {
      return;
    }
    onPointerWorldPositionChange?.({ x: world.x, y: world.y });

    if (marquee !== null && marquee.pointerId === event.pointerId) {
      const movedPx = Math.hypot(
        event.clientX - marquee.anchorScreenX,
        event.clientY - marquee.anchorScreenY,
      );
      setMarquee({ ...marquee, corner: world, moved: marquee.moved || movedPx > 4 });
      return;
    }

    if (activeToolId === 'wall' && wallToolRef.current !== null) {
      const snap = computeSnap(world, content, viewport);
      const snapped = snap?.point ?? world;
      setSnapPoint(snap === undefined ? null : { point: snap.point, source: snap.source });
      onActiveSnapChange?.(snap === undefined ? null : SNAP_GLYPH_LABEL[snap.source]);
      setPreviewPoint(draftPoints.length > 0 ? snapped : null);
      return;
    }

    if (activeToolId === 'select' || activeToolId === null) {
      setHoveredId(pickElementAt(content, world, viewport));
    }
  }

  function handlePointerUpOrCancel(event: ReactPointerEvent<HTMLCanvasElement>): void {
    pointerPositionsRef.current.delete(event.pointerId);
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
    }
    const pinch = pinchRef.current;
    if (pinch !== null && pinch.pointerIds.includes(event.pointerId)) {
      pinchRef.current = null;
    }
    if (marquee !== null && marquee.pointerId === event.pointerId) {
      setMarquee(null);
      if (event.type === 'pointercancel') {
        return;
      }
      if (!marquee.moved) {
        // A still click: ordinary point selection.
        if (viewport !== null) {
          onSelectElement(pickElementAt(content, marquee.anchor, viewport));
        }
        return;
      }
      // CAD convention: rightward drag selects fully-contained (window),
      // leftward selects touched (crossing) - decided by drag direction.
      const mode = marquee.corner.x < marquee.anchor.x ? 'crossing' : 'window';
      onSelectMany(
        selectWallsInRegion(content, boundsFromCorners(marquee.anchor, marquee.corner), mode),
      );
    }
  }

  function handleDoubleClick(): void {
    if (activeToolId === 'wall' && draftPoints.length > 1) {
      commitDraft();
    }
  }

  const cursor =
    activeToolId === 'pan' ? 'grab' : activeToolId === 'wall' ? 'crosshair' : 'default';

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onDoubleClick={handleDoubleClick}
      onPointerLeave={() => {
        onPointerWorldPositionChange?.(null);
        onActiveSnapChange?.(null);
        setHoveredId(null);
      }}
      style={{ width: '100%', height: '100%', display: 'block', cursor, touchAction: 'none' }}
      aria-label="Plan canvas"
    />
  );
}
