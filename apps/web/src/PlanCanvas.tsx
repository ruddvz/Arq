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
  preserveWorldUnderViewportRect,
  panByScreenDelta,
  parseNumericOverlay,
  zoomAtScreenPoint,
  type NumericOverlayState,
} from '@arq/editor-shell';
import {
  ContextHud,
  isEditableEventTarget,
  type ContextHudHandle,
  type ScreenPoint as HudScreenPoint,
} from '@arq/design-system';
import { WallHudEntry } from './canvas/wall-hud-entry';
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
import type { PlanRoom } from './canvas/canvas-interaction';

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

/**
 * The workspace's own starting room, used when no project is open. It gives a new
 * canvas something measurable to snap to, exactly like a template would, and it
 * is labelled as a fixture so it is never mistaken for project content. When a
 * real project is open the caller passes that project's rooms instead and this is
 * not rendered at all - a demo room drawn over someone's house would be a lie
 * about their model.
 */
const DEMO_ROOM_WIDTH_MM = 4200;
const DEMO_ROOM_HEIGHT_MM = 3600;

const DEMO_ROOMS: readonly PlanRoom[] = [
  {
    id: 'demo-room',
    label: '4.20 m x 3.60 m (demo fixture)',
    polygon: [
      worldPoint(0, 0),
      worldPoint(DEMO_ROOM_WIDTH_MM, 0),
      worldPoint(DEMO_ROOM_WIDTH_MM, DEMO_ROOM_HEIGHT_MM),
      worldPoint(0, DEMO_ROOM_HEIGHT_MM),
    ],
  },
];

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

/**
 * Area centroid of a simple polygon, so a room label sits inside a room of any
 * shape. Falls back to the vertex average for a degenerate (zero-area) ring,
 * which cannot be a real room but can be a malformed one.
 */
function polygonCentroid(polygon: readonly WorldPoint[]): WorldPoint {
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const cross = current.x * next.y - next.x * current.y;
    twiceArea += cross;
    x += (current.x + next.x) * cross;
    y += (current.y + next.y) * cross;
  }
  if (twiceArea === 0) {
    const count = Math.max(1, polygon.length);
    return worldPoint(
      polygon.reduce((sum, point) => sum + point.x, 0) / count,
      polygon.reduce((sum, point) => sum + point.y, 0) / count,
    );
  }
  return worldPoint(x / (3 * twiceArea), y / (3 * twiceArea));
}

export interface PlanCanvasProps {
  /** The workspace's active tool id - the canvas responds to select/wall/pan/fit. */
  readonly activeToolId: string | null;
  /** The walls to draw - the workspace's own drawn walls, or an opened project's walls for the level on show. */
  readonly walls: readonly DrawnWall[];
  /**
   * The rooms to draw. Omitted means the workspace's own starting fixture; an
   * opened project passes its own rooms, and passing an empty list draws none.
   */
  readonly rooms?: readonly PlanRoom[];
  /** True when the canvas must refuse to author - an opened .arq project is inspected, not edited. */
  readonly readOnly?: boolean;
  /** Current selection, shared with the model panel and inspector. */
  readonly selection: PlanSelectionState<string>;
  /** Canvas click selected an element (null = clicked empty space). */
  readonly onSelectElement: (elementId: string | null) => void;
  /** Marquee drag selected zero or more elements (window/crossing, ARQ-041). */
  readonly onSelectMany: (elementIds: readonly string[]) => void;
  /** A finished wall chain's segments - the document allocates ids and commits. */
  readonly onCommitWalls: (
    segments: readonly { readonly start: WorldPoint; readonly end: WorldPoint }[],
  ) => void;
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
    activeToolId: requestedToolId,
    readOnly = false,
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

  /**
   * An authoring tool never arms over a read-only project, however it was
   * activated - rail, command palette or keyboard. The shell also hides those
   * tools, but a canvas that would draw if asked is one forgotten branch away
   * from drawing on a project this build must not modify.
   */
  const activeToolId = readOnly && requestedToolId === 'wall' ? 'select' : requestedToolId;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const devicePixelRatioRef = useRef(1);
  /** The surface's last measured CSS rect, for the stability rule in `resize`. */
  const previousCssRectRef = useRef<{
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  } | null>(null);
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  /**
   * Wall Context HUD (interaction foundation pilot). The overlay text state
   * is mirrored from the tool (low frequency: keystrokes only); the anchor
   * is a mutable ref in client coordinates so per-pointer-move repositioning
   * is an imperative call, never a React render of its own. The fallback
   * distance/angle pair is the cursor-derived preview the numeric override
   * resolves against (wall-draw-tool.previewPoint).
   */
  const [overlayState, setOverlayState] = useState<NumericOverlayState | null>(null);
  const hudHandleRef = useRef<ContextHudHandle>(null);
  const hudAnchorRef = useRef<HudScreenPoint | null>(null);
  const hudInputRef = useRef<HTMLInputElement>(null);
  const previewFallbackRef = useRef<{ distance: number; angleRadians: number } | null>(null);
  /** In-progress marquee drag (select tool): anchor and live corner in world space. */
  const [marquee, setMarquee] = useState<{
    readonly pointerId: number;
    readonly anchor: WorldPoint;
    readonly corner: WorldPoint;
    readonly anchorScreenX: number;
    readonly anchorScreenY: number;
    readonly moved: boolean;
  } | null>(null);

  const rooms = props.rooms ?? DEMO_ROOMS;
  const content: PlanContent = useMemo(() => ({ rooms, walls }), [rooms, walls]);

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
      ...rooms.map((room): PlanPrimitiveInput<string> => ({
        kind: 'polygon',
        elementId: room.id,
        points: room.polygon,
      })),
      ...rooms.map((room): PlanPrimitiveInput<string> => ({
        kind: 'text',
        // Labelled at the polygon's centroid rather than a fixed offset, so a
        // room of any shape carries its label inside itself.
        elementId: `${room.id}-label`,
        anchor: polygonCentroid(room.polygon),
        text: room.label,
      })),
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
  }, [viewport, rooms, walls, selection, draftPoints, previewPoint, snapPoint, hoveredId, marquee]);

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

      // Kept in CSS pixels and scaled by the *current* ratio on both sides
      // below, so a window dragged to a display with a different pixel ratio
      // compares like with like rather than mixing two pixel spaces.
      const previousCssRect = previousCssRectRef.current;
      previousCssRectRef.current = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };

      setViewport((current) => {
        if (current === null) {
          // Fit to what is actually there on first paint: for an opened project
          // that is the project, not a fixture room it does not contain.
          const fitted = fitToBounds(contentBounds({ rooms, walls }), rect.width, rect.height);
          onViewportPixelsPerUnitChange?.(fitted.pixelsPerUnit);
          return {
            ...fitted,
            screenWidth: canvas.width,
            screenHeight: canvas.height,
            pixelsPerUnit: fitted.pixelsPerUnit * devicePixelRatio,
          };
        }
        if (previousCssRect === null) {
          return { ...current, screenWidth: canvas.width, screenHeight: canvas.height };
        }
        /*
         * Doc 09's stability rule: opening the Navigator or Inspector must not
         * move the model. Carrying `center` across unchanged - what this did
         * before - keeps the world point at the canvas *centre* fixed, but a
         * panel opening on the left moves that centre rightwards on screen, so
         * every wall slid out from under a stationary cursor. Nothing refitted,
         * yet the drawing moved.
         *
         * Scale is untouched either way: a resize is not a view command.
         */
        const scale = (value: number): number => value * devicePixelRatio;
        return preserveWorldUnderViewportRect(
          current,
          {
            left: scale(previousCssRect.left),
            top: scale(previousCssRect.top),
            width: scale(previousCssRect.width),
            height: scale(previousCssRect.height),
          },
          {
            left: scale(rect.left),
            top: scale(rect.top),
            width: canvas.width,
            height: canvas.height,
          },
        );
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

  /**
   * World -> client conversion for the HUD anchor: the one explicit boundary
   * where a world point becomes a DOM coordinate (viewport transform, then
   * device-pixel ratio removed, then the canvas's client offset added).
   * Mutates the anchor ref and asks the HUD to reposition - no React state,
   * so following the pointer costs no extra renders.
   */
  const updateHudAnchor = useCallback(
    (world: WorldPoint | null) => {
      const canvas = canvasRef.current;
      if (world === null || canvas === null || viewport === null) {
        hudAnchorRef.current = null;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const screen = worldToScreen(viewport, world);
      const devicePixelRatio = devicePixelRatioRef.current;
      hudAnchorRef.current = {
        x: rect.left + screen.x / devicePixelRatio,
        y: rect.top + screen.y / devicePixelRatio,
      };
      hudHandleRef.current?.reposition();
    },
    [viewport],
  );

  /**
   * Re-resolves the live preview after overlay text changes. Only a field
   * that actually parses engages the override path - when nothing is typed
   * the preview keeps the EXACT snapped coordinates (a distance/angle
   * round-trip would drift by float error and break endpoint-snap
   * exactness, which is Level 0 precision territory).
   */
  const applyOverlayPreview = useCallback(
    (tool: NonNullable<typeof wallToolRef.current>) => {
      const fallback = previewFallbackRef.current;
      if (fallback === null) {
        return;
      }
      const parsed = parseNumericOverlay(tool.snapshot().overlay);
      if (parsed.distance === null && parsed.angleRadians === null) {
        return;
      }
      const resolved = tool.previewPoint(fallback.distance, fallback.angleRadians);
      if (resolved !== null) {
        setPreviewPoint(resolved);
        updateHudAnchor(resolved);
      }
    },
    [updateHudAnchor],
  );

  const clearDraft = useCallback(() => {
    wallToolRef.current = null;
    setDraftPoints([]);
    setPreviewPoint(null);
    setSnapPoint(null);
    setHoveredId(null);
    setMarquee(null);
    setOverlayState(null);
    hudAnchorRef.current = null;
    previewFallbackRef.current = null;
    onActiveSnapChange?.(null);
  }, [onActiveSnapChange]);

  const commitDraft = useCallback(() => {
    const tool = wallToolRef.current;
    if (tool === null) {
      return;
    }
    const segments = tool.finish();
    if (segments.length > 0) {
      onCommitWalls(segments);
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
    setOverlayState(null);
    hudAnchorRef.current = null;
    previewFallbackRef.current = null;
    // The HUD unmounts with the draft; if focus was in its input, hand it
    // back to the workspace canvas slot so keyboard flow continues rather
    // than falling to <body>.
    if (document.activeElement === hudInputRef.current) {
      document.getElementById('arq-workspace-canvas')?.focus();
    }
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

  // Escape cancels an in-progress marquee before anything else - the
  // region-selection contract's own rule - on capture, so the shell's
  // Escape handling never sees the press.
  useEffect(() => {
    if (marquee === null) {
      return;
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setMarquee(null);
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [marquee]);

  // Escape/Enter for the wall draft, on capture so the draft consumes the
  // key before the workspace shell's own Escape handling closes overlays.
  // This one listener is the single dispatch point for the wall tool's
  // keyboard contract, HUD input included - Enter and Escape behave
  // identically whether focus is on the canvas or in the length field, and
  // the tool's own three-tier escape (clear field -> pop point -> exit)
  // stays the only cancellation authority.
  useEffect(() => {
    if (activeToolId !== 'wall') {
      return;
    }
    function onKeyDown(event: KeyboardEvent): void {
      const tool = wallToolRef.current;
      if (tool === null || event.isComposing) {
        return;
      }
      const overlay = tool.snapshot().overlay;
      const hasTypedText = overlay.distanceText !== '' || overlay.angleText !== '';

      if (event.key === 'Enter') {
        // Key repeat must never place or commit twice: one press, one intent.
        if (event.repeat) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (
          hasTypedText &&
          tool.snapshot().points.length > 0 &&
          previewFallbackRef.current !== null
        ) {
          event.preventDefault();
          event.stopPropagation();
          const parsed = parseNumericOverlay(overlay);
          if (overlay.distanceText !== '' && parsed.distance === null) {
            // Invalid text never reaches a semantic command: the field shows
            // its error state and the press does nothing else.
            return;
          }
          const fallback = previewFallbackRef.current;
          const resolved = tool.previewPoint(fallback.distance, fallback.angleRadians);
          if (resolved !== null) {
            const last = tool.snapshot().points.at(-1);
            if (last === undefined || Math.hypot(resolved.x - last.x, resolved.y - last.y) >= 0.5) {
              // Same chain path a click uses: placePoint -> beginPreview.
              tool.placePoint(resolved);
              tool.beginPreview();
              setDraftPoints(tool.snapshot().points);
              setPreviewPoint(resolved);
              updateHudAnchor(resolved);
            }
            setOverlayState(tool.snapshot().overlay);
          }
          return;
        }
        if (tool.snapshot().points.length > 1) {
          event.preventDefault();
          event.stopPropagation();
          commitDraft();
        }
        return;
      }

      if (event.key === 'Escape' && (tool.snapshot().points.length > 0 || hasTypedText)) {
        event.preventDefault();
        event.stopPropagation();
        tool.escape();
        // Escape's pop tiers park the lifecycle in 'armed' (last point) or
        // 'awaiting-input' (mid-chain); placePoint refuses both, so without
        // re-entering preview the still-active tool silently swallowed the
        // next click - a defect the old flow had too (first click after an
        // Escape-pop did nothing). beginPreview is exactly that re-entry
        // and no-ops from every other state.
        tool.beginPreview();
        const after = tool.snapshot();
        setOverlayState(after.overlay);
        setDraftPoints(after.points);
        if (after.points.length === 0) {
          setPreviewPoint(null);
          hudAnchorRef.current = null;
          if (document.activeElement === hudInputRef.current) {
            document.getElementById('arq-workspace-canvas')?.focus();
          }
        } else {
          applyOverlayPreview(tool);
        }
        return;
      }

      // Dynamic input: typing a digit while previewing focuses the HUD's
      // length field and lands the digit there, so keyboard-only wall entry
      // needs no pointer trip to the HUD. Only bare digits/dot - modified
      // keys stay shortcuts, and anything typed while an input already has
      // focus flows through the input itself.
      if (
        tool.snapshot().points.length > 0 &&
        !isEditableEventTarget(event.target) &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        /^[0-9.]$/.test(event.key)
      ) {
        event.preventDefault();
        tool.overlay.focusField('distance');
        tool.overlay.typeChar(event.key);
        setOverlayState(tool.snapshot().overlay);
        hudInputRef.current?.focus();
        applyOverlayPreview(tool);
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [activeToolId, draftPoints, commitDraft, applyOverlayPreview, updateHudAnchor]);

  // Space-held panning, tracked at the window level like the shell's own
  // shortcut handling - never while a text field owns the keyboard.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === ' ' && !isEditableEventTarget(event.target)) {
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
      // The first finger may have started a marquee before the second
      // arrived; a pinch is navigation, and letting the marquee survive it
      // would fire a phantom point-selection when the fingers lift.
      setMarquee(null);
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
      // A typed numeric override wins over the raw click position - the
      // preview line already shows the resolved point, and placing anything
      // else would commit geometry the user was not looking at. With no
      // override the EXACT snapped point is placed (never a distance/angle
      // round-trip of it - snap exactness is Level 0 precision).
      let place = snapped;
      const priorPoints = tool.snapshot().points;
      if (priorPoints.length > 0) {
        const from = priorPoints[priorPoints.length - 1]!;
        const fallbackDistance = Math.hypot(snapped.x - from.x, snapped.y - from.y);
        const fallbackAngle = Math.atan2(snapped.y - from.y, snapped.x - from.x);
        const parsed = parseNumericOverlay(tool.snapshot().overlay);
        if (parsed.distance !== null || parsed.angleRadians !== null) {
          place = tool.previewPoint(fallbackDistance, fallbackAngle) ?? snapped;
        }
      }
      // Double-click-to-finish arrives as two pointerdowns at the same spot;
      // placing both would leave a zero-length trailing segment for
      // validation to reject. A repeat of the last point is a no-op instead.
      const last = priorPoints.at(-1);
      if (last !== undefined && Math.hypot(place.x - last.x, place.y - last.y) < 0.5) {
        return;
      }
      tool.placePoint(place);
      // The lifecycle parks in awaiting-input after a placement; re-enter
      // previewing so the next pointer move rubber-bands from this point.
      tool.beginPreview();
      setDraftPoints(tool.snapshot().points);
      setPreviewPoint(place);
      setOverlayState(tool.snapshot().overlay);
      updateHudAnchor(place);
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
      const tool = wallToolRef.current;
      const snap = computeSnap(world, content, viewport);
      const snapped = snap?.point ?? world;
      setSnapPoint(snap === undefined ? null : { point: snap.point, source: snap.source });
      onActiveSnapChange?.(snap === undefined ? null : SNAP_GLYPH_LABEL[snap.source]);
      // The tool's own point list, never the draftPoints render mirror: a
      // pointer move can arrive in the same frame as the click that placed a
      // point, before React re-renders, and reading the stale mirror here
      // left the preview fallback unset - which silently disabled Enter's
      // numeric placement (found by the wall-hud capability check).
      const toolPoints = tool.snapshot().points;
      if (toolPoints.length === 0) {
        setPreviewPoint(null);
        previewFallbackRef.current = null;
        hudAnchorRef.current = null;
        return;
      }
      const from = toolPoints[toolPoints.length - 1]!;
      const fallbackDistance = Math.hypot(snapped.x - from.x, snapped.y - from.y);
      const fallbackAngle = Math.atan2(snapped.y - from.y, snapped.x - from.x);
      previewFallbackRef.current = { distance: fallbackDistance, angleRadians: fallbackAngle };
      // A parsed numeric override resolves the preview; otherwise the exact
      // snapped point is the preview (see handlePointerDown on why the
      // no-override path must never round-trip through distance/angle).
      const parsed = parseNumericOverlay(tool.snapshot().overlay);
      const resolved =
        parsed.distance !== null || parsed.angleRadians !== null
          ? (tool.previewPoint(fallbackDistance, fallbackAngle) ?? snapped)
          : snapped;
      setPreviewPoint(resolved);
      updateHudAnchor(resolved);
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
    if (activeToolId === 'wall' && (wallToolRef.current?.snapshot().points.length ?? 0) > 1) {
      commitDraft();
    }
  }

  const cursor =
    activeToolId === 'pan' ? 'grab' : activeToolId === 'wall' ? 'crosshair' : 'default';

  /*
   * Wall Context HUD: open only while the wall tool is previewing from a
   * placed point AND the anchor is valid - a stale or missing anchor closes
   * the HUD rather than floating it over dead space. The displayed
   * placeholder is the live cursor-derived length; typed text lives in the
   * tool's own numeric overlay.
   */
  const hudOpen =
    activeToolId === 'wall' &&
    draftPoints.length > 0 &&
    previewPoint !== null &&
    hudAnchorRef.current !== null;
  const lastDraftPoint = draftPoints.length > 0 ? draftPoints[draftPoints.length - 1]! : null;
  const liveLengthMm =
    lastDraftPoint !== null && previewPoint !== null
      ? Math.round(Math.hypot(previewPoint.x - lastDraftPoint.x, previewPoint.y - lastDraftPoint.y))
      : 0;
  const distanceText = overlayState?.distanceText ?? '';
  const distanceInvalid =
    distanceText !== '' &&
    parseNumericOverlay(overlayState ?? { field: null, distanceText: '', angleText: '' })
      .distance === null;

  const handleHudValueChange = useCallback(
    (text: string) => {
      const tool = wallToolRef.current;
      if (tool === null) {
        return;
      }
      tool.overlay.setFieldText('distance', text);
      setOverlayState(tool.snapshot().overlay);
      applyOverlayPreview(tool);
    },
    [applyOverlayPreview],
  );

  return (
    <>
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
      <ContextHud
        ref={hudHandleRef}
        open={hudOpen}
        anchorRef={hudAnchorRef}
        label="Wall length entry"
        testId="arq-wall-hud"
      >
        <WallHudEntry
          valueText={distanceText}
          placeholder={String(liveLengthMm)}
          invalid={distanceInvalid}
          onValueChange={handleHudValueChange}
          inputRef={hudInputRef}
        />
      </ContextHud>
    </>
  );
}
