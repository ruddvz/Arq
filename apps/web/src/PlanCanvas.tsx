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
  wallOutline,
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
  DEFAULT_PLAN_PALETTE,
  type PlanPalette,
  snapGlyphPrimitives,
  withSelectionHandles,
  SNAP_GLYPH_LABEL,
  type PlanPrimitiveInput,
  type PlanSelectionState,
  planOpeningsForWall,
  swingPolyline,
  wallPiers,
  type PlanOpeningInput,
  roomLabelFits,
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
 */

/**
 * No content is drawn when no project is open.
 *
 * A hard-coded 4.20 x 3.60 room used to sit here, on the grounds that it gave a
 * new canvas something measurable to snap to. It was labelled "(demo fixture)",
 * which made it honest but did not make it right: it was the first thing every
 * reader saw, rendered by the real plan renderer at real world coordinates, and
 * a rectangle drawn by the product is read as the product's model whatever the
 * label says. An empty drawing surface is the truthful answer to "no project is
 * open", and the snapping it was there to demonstrate works against the walls a
 * user draws.
 */
const NO_ROOMS: readonly PlanRoom[] = [];

/**
 * The view an empty surface opens at, since there is nothing to fit to.
 * `contentBounds` over nothing returns an inverted infinite box, which
 * `fitToBounds` turns into NaN - so an empty canvas needs a starting extent
 * rather than a fit. Twelve metres across is a room-to-small-house span: near
 * enough that a drawn wall is immediately legible, wide enough that the first
 * one does not run off the edge.
 */
const EMPTY_VIEW_EXTENT_MM = 12_000;

/**
 * The starting extent for a surface with nothing on it, or null when there is
 * something to fit to. Returned rather than branched at each call site so the
 * first paint and the fit tool cannot disagree about what an empty plan shows.
 */
function emptyContentBounds(
  content: PlanContent,
): { readonly min: WorldPoint; readonly max: WorldPoint } | null {
  if (content.rooms.length > 0 || content.walls.length > 0) return null;
  const half = EMPTY_VIEW_EXTENT_MM / 2;
  return { min: worldPoint(-half, -half), max: worldPoint(half, half) };
}

/** Matches `TEXT_LINE_HEIGHT_PX` in the paint, which is what actually spaces the lines. */
const ROOM_LABEL_LINE_HEIGHT_PX = 12;

/** A polygon's screen-space bounding box, which is what a label has to fit inside. */
function polygonExtentPx(
  polygon: readonly WorldPoint[],
  viewport: Viewport,
): { readonly width: number; readonly height: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of polygon) {
    const screen = worldToScreen(viewport, point);
    minX = Math.min(minX, screen.x);
    minY = Math.min(minY, screen.y);
    maxX = Math.max(maxX, screen.x);
    maxY = Math.max(maxY, screen.y);
  }
  return { width: maxX - minX, height: maxY - minY };
}

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
  /**
   * Thickness per wall id, in the same world units as the geometry.
   *
   * A wall with no entry is drawn as its centreline, which is what the drawing
   * tools produce while a chain is still being placed and what the workspace's
   * own walls are. A wall with one is drawn as its footprint - the same
   * `wallOutline` the 3D surface extrudes, so plan and model cannot disagree
   * about where a wall's faces are.
   */
  readonly wallDimensions?: ReadonlyMap<string, { readonly thicknessMm: number }>;
  /**
   * The hosted openings each wall carries, keyed by wall id. Supplied by an
   * opened project; the workspace's own drawn walls have none, and a wall with
   * no entry is drawn solid exactly as before.
   */
  readonly wallOpenings?: ReadonlyMap<string, readonly PlanOpeningInput[]>;
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
    wallDimensions,
    wallOpenings,
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

  const rooms = props.rooms ?? NO_ROOMS;
  const content: PlanContent = useMemo(() => ({ rooms, walls }), [rooms, walls]);

  /* ------------------------------------------------------------------ */
  /* Painting                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * The appearance's own ink, paper and accent, read from the resolved custom
   * properties rather than duplicated here.
   *
   * A canvas cannot inherit CSS colours the way the rest of the shell does, so
   * without this the plan kept drawing black-on-white while everything around
   * it followed the appearance - under dark that left black linework on a
   * near-black surface. Re-read whenever the appearance changes.
   */
  const [palette, setPalette] = useState<PlanPalette>(DEFAULT_PLAN_PALETTE);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || typeof window === 'undefined') {
      return;
    }
    const read = (): void => {
      const style = window.getComputedStyle(canvas);
      const value = (name: string, fallback: string): string => {
        const resolved = style.getPropertyValue(name).trim();
        return resolved === '' ? fallback : resolved;
      };
      setPalette({
        ink: value('--arq-ui-ink', DEFAULT_PLAN_PALETTE.ink),
        paper: value('--arq-ui-paper', DEFAULT_PLAN_PALETTE.paper),
        accent: value('--arq-selection-outline', DEFAULT_PLAN_PALETTE.accent),
        // Read from the appearance like everything else here, so poché stays a
        // solid against the paper in dark as well as light rather than a black
        // shape on a near-black page.
        poche: value('--arq-plan-poche', DEFAULT_PLAN_PALETTE.ink),
        roomFill: value('--arq-plan-room-fill', 'transparent'),
      });
    };
    read();
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    const contrast = window.matchMedia('(prefers-contrast: more)');
    scheme.addEventListener('change', read);
    contrast.addEventListener('change', read);
    return () => {
      scheme.removeEventListener('change', read);
      contrast.removeEventListener('change', read);
    };
  }, []);

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
      // Derived from the appearance's ink rather than a fixed grey, so the
      // grid stays a faint version of the linework in both appearances.
      ctx.strokeStyle = palette.ink;
      ctx.globalAlpha = 0.16;
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
      // Everything painted after the grid is at full strength; leaving the
      // alpha set would silently wash out the entire drawing.
      ctx.globalAlpha = 1;
    }

    const inputs: PlanPrimitiveInput<string>[] = [
      ...rooms.map((room): PlanPrimitiveInput<string> => ({
        kind: 'polygon',
        // Tinted so an enclosed area reads as a room rather than as four walls
        // that happen to meet. Drawn first, so the walls sit on top of it.
        fill: 'room',
        elementId: room.id,
        points: room.polygon,
      })),
      ...rooms.flatMap((room): PlanPrimitiveInput<string>[] => {
        /*
         * A label is drawn only when it fits inside its own room at the scale
         * being drawn. Unchecked, the golden fixture's galleries on a phone are
         * a few millimetres wide on screen and their labels are wider than the
         * rooms - three of them overlapped into an unreadable smear that also
         * hid the walls underneath. The room is still drawn, still selectable
         * and still names itself in the Inspector, so nothing is lost except a
         * claim that could not be read.
         */
        const anchor = polygonCentroid(room.polygon);
        const lines = room.label.split('\n');
        const widestLinePx = Math.max(...lines.map((line) => ctx.measureText(line).width));
        const extent = polygonExtentPx(room.polygon, currentViewport);
        if (
          !roomLabelFits({
            labelWidthPx: widestLinePx,
            labelHeightPx: lines.length * ROOM_LABEL_LINE_HEIGHT_PX * devicePixelRatio,
            roomWidthPx: extent.width,
            roomHeightPx: extent.height,
          })
        ) {
          return [];
        }
        return [
          {
            kind: 'text',
            // Labelled at the polygon's centroid rather than a fixed offset, so
            // a room of any shape carries its label inside itself.
            elementId: `${room.id}-label`,
            anchor,
            text: room.label,
          },
        ];
      }),
      ...walls.flatMap((wall): PlanPrimitiveInput<string>[] => {
        /*
         * A wall with a known thickness is drawn as its footprint rather than
         * its centreline. The outline comes from the same `wallOutline` the 3D
         * surface extrudes, so the two views cannot disagree about where a
         * wall's faces are - and a null result (a zero-length segment) falls
         * back to the centreline rather than dropping the wall from the plan.
         */
        const thicknessMm = wallDimensions?.get(wall.id)?.thicknessMm;
        if (thicknessMm === undefined || thicknessMm <= 0) {
          return [{ kind: 'line', elementId: wall.id, points: [wall.start, wall.end] }];
        }
        const host = { start: wall.start, end: wall.end, thickness: thicknessMm };
        const openings = wallOpenings?.get(wall.id) ?? [];
        if (openings.length === 0) {
          const outline = wallOutline(
            { start: wall.start, end: wall.end },
            thicknessMm,
            'centre',
            1e-6,
          );
          return outline === null
            ? [{ kind: 'line', elementId: wall.id, points: [wall.start, wall.end] }]
            : [{ kind: 'polygon', elementId: wall.id, points: outline, fill: 'poche' }];
        }

        /*
         * A wall with openings is drawn as the stretches that remain solid.
         * Painting the whole wall and then covering each opening in the paper
         * colour would look identical here and stop being a hole the moment
         * anything is layered under it - a lid, not a gap - and it would print
         * as a filled wall in a vector sheet.
         *
         * Every pier keeps the wall's own element id, so selecting any part of
         * a wall still selects the wall rather than a fragment of it.
         */
        const primitives: PlanPrimitiveInput<string>[] = [];
        for (const pier of wallPiers(host, openings)) {
          const outline = wallOutline(pier, thicknessMm, 'centre', 1e-6);
          if (outline !== null) {
            primitives.push({
              kind: 'polygon',
              elementId: wall.id,
              points: outline,
              fill: 'poche',
            });
          }
        }
        for (const opening of planOpeningsForWall(host, openings)) {
          // The jambs close the poché where the wall stops. Without them the
          // drawing shows two wall stubs and no evidence they are one wall.
          for (const jamb of opening.jambs) {
            primitives.push({
              kind: 'line',
              elementId: opening.id,
              points: [jamb.start, jamb.end],
            });
          }
          for (const glazing of opening.glazing) {
            primitives.push({
              kind: 'line',
              elementId: opening.id,
              points: [glazing.start, glazing.end],
            });
          }
          if (opening.leaf !== null) {
            primitives.push({
              kind: 'line',
              elementId: opening.id,
              points: [opening.leaf.start, opening.leaf.end],
            });
          }
          if (opening.swing !== null) {
            primitives.push({
              kind: 'line',
              elementId: opening.id,
              points: swingPolyline(opening.swing),
            });
          }
        }
        return primitives;
      }),
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
    paintPlanScene(ctx, currentViewport, devicePixelRatio, painted, palette);

    // The marquee is view furniture like the grid: CAD convention, solid
    // edge for a window (left-to-right) drag, dashed for crossing.
    if (marquee !== null && marquee.moved) {
      const a = worldToScreen(currentViewport, marquee.anchor);
      const b = worldToScreen(currentViewport, marquee.corner);
      const crossing = marquee.corner.x < marquee.anchor.x;
      ctx.strokeStyle = palette.accent;
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
  }, [
    viewport,
    rooms,
    walls,
    selection,
    draftPoints,
    previewPoint,
    snapPoint,
    hoveredId,
    marquee,
    palette,
    wallDimensions,
    wallOpenings,
  ]);

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
          /*
           * A surface with no width has no fit. The flex shell lays this canvas
           * out at 0x740 before its first real pass, and fitting into that box
           * asks fitToBounds for a scale of 1/4200, which it clamps to the
           * minimum zoom - so the plan opened at 1%, a few pixels across, and
           * stayed there, because the fit only runs while the viewport is still
           * null. Waiting for a real box costs one frame and is the difference
           * between opening on the drawing and opening on a dot.
           */
          if (rect.width <= 0 || rect.height <= 0) {
            return current;
          }
          // Fit to what is actually there on first paint: for an opened project
          // that is the project, and for an empty surface that is nothing, which
          // is a starting extent rather than a fit.
          const fitted = fitToBounds(
            emptyContentBounds({ rooms, walls }) ?? contentBounds({ rooms, walls }),
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
      // Fit on an empty surface returns to the starting extent rather than to
      // NaN - the same guard as the first paint, for the same reason.
      const fitted = fitToBounds(
        emptyContentBounds(content) ?? contentBounds(content),
        rect.width,
        rect.height,
      );
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
