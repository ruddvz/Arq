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
  roomLabelAnchors,
  roomLabelFits,
  roomTint,
  type RoomLabelObstacle,
  type PlanScene,
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

/**
 * Clear space around the drawing when it is fitted, in CSS pixels.
 *
 * `fitToBounds` defaults to a flat 40px a side. That is five per cent of a
 * desktop canvas and nineteen per cent of a 414px phone, so the same constant
 * that reads as a comfortable margin on a laptop throws away a fifth of a
 * phone's width - and the sheet adds its own margin on top, doubling it. A
 * proportional margin keeps the same visual breathing room at every size,
 * with a floor so a very small canvas still has an edge.
 */
function fitMarginPx(width: number, height: number): number {
  return Math.max(8, Math.min(40, Math.min(width, height) * 0.04));
}

/**
 * Fits the drawing into the part of the canvas that is actually clear.
 *
 * The view identity - "Ground floor · Plan · 1:103" - floats over the top of
 * the canvas, which is the reference composition and reads well when the
 * drawing sits below it. It stopped reading well the moment the drawing was
 * fitted to fill the canvas: on a 1024px tablet the sheet reaches the top edge
 * and the pill printed over a room. Fitting into the space under it, and then
 * pushing the drawing down into that space, is the difference between a label
 * floating above a plan and a label lying on one.
 *
 * The reserve comes from the stylesheet that positions the pill, so the two
 * cannot drift apart. It is capped at a third of the canvas so a very short
 * viewport is not given over to chrome.
 */
function fitContent(
  bounds: { readonly min: WorldPoint; readonly max: WorldPoint },
  canvas: HTMLCanvasElement,
  rect: { readonly width: number; readonly height: number },
): Viewport {
  const reserve = Math.min(readReservePx(canvas), rect.height / 3);
  const usableHeight = Math.max(1, rect.height - reserve);
  const fitted = fitToBounds(
    bounds,
    rect.width,
    usableHeight,
    fitMarginPx(rect.width, usableHeight),
  );
  /*
   * Screen y runs down and world y runs up, so raising the viewport's centre
   * moves the drawing down the screen. Half the reserve re-centres the drawing
   * in the band below the pill rather than in the whole canvas.
   */
  return {
    ...fitted,
    center: worldPoint(fitted.center.x, fitted.center.y + reserve / 2 / fitted.pixelsPerUnit),
  };
}

/** The pill's own height, as its stylesheet declares it. Zero if unset. */
function readReservePx(canvas: HTMLCanvasElement): number {
  if (typeof window === 'undefined') return 0;
  const raw = window
    .getComputedStyle(canvas)
    .getPropertyValue('--arq-view-identity-reserve')
    .trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Matches `TEXT_LINE_HEIGHT_PX` in the paint, which is what actually spaces the lines. */
const ROOM_LABEL_LINE_HEIGHT_PX = 12;

/** Every tint key the palette can carry, so the reader asks for all of them once. */
const ROOM_TINTS = [
  'room-living',
  'room-cooking',
  'room-dining',
  'room-sleeping',
  'room-wet',
  'room-service',
  'room-circulation',
  'room-outdoor',
  'room-neutral',
] as const;

/** Clear page around the drawing, as a fraction of the drawing's own size. */
const SHEET_MARGIN_FRACTION = 0.06;

/** The page's corner radius, in CSS pixels - a sheet, not a card. */
const SHEET_RADIUS_CSS_PX = 6;

/** A polygon's world-space bounding box, used to narrow an obstacle search. */
function polygonBounds(polygon: readonly WorldPoint[]): {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of polygon) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Whether a segment could possibly reach a room, allowing for its own width.
 *
 * Deliberately generous - it compares bounding boxes, so a diagonal keeps
 * things it cannot touch. Being generous costs a few extra exact tests; being
 * tight would drop a wall that really does cross the label.
 */
function segmentNearBounds(
  segment: RoomLabelObstacle,
  bounds: ReturnType<typeof polygonBounds>,
  slackMm: number,
): boolean {
  const pad = segment.clearance + slackMm;
  return (
    Math.min(segment.start.x, segment.end.x) <= bounds.maxX + pad &&
    Math.max(segment.start.x, segment.end.x) >= bounds.minX - pad &&
    Math.min(segment.start.y, segment.end.y) <= bounds.maxY + pad &&
    Math.max(segment.start.y, segment.end.y) >= bounds.minY - pad
  );
}

/** The four edges of a placed label's box, so the next label has to clear it. */
function labelKeepOut(
  anchor: WorldPoint,
  width: number,
  height: number,
): readonly RoomLabelObstacle[] {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const corners = [
    worldPoint(anchor.x - halfWidth, anchor.y - halfHeight),
    worldPoint(anchor.x + halfWidth, anchor.y - halfHeight),
    worldPoint(anchor.x + halfWidth, anchor.y + halfHeight),
    worldPoint(anchor.x - halfWidth, anchor.y + halfHeight),
  ];
  return corners.map((corner, index) => ({
    start: corner,
    end: corners[(index + 1) % corners.length]!,
    clearance: 0,
  }));
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

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
  /**
   * Reports the scene the canvas just built, with the model-space box it
   * occupies. Exists so a sheet exports the drawing that is actually on screen
   * rather than a second projection of the same model - two projections would
   * eventually disagree, and the sheet is the one nobody can check against the
   * screen once it is printed.
   */
  readonly onSceneBuilt?: (scene: {
    readonly primitives: PlanScene<string>['primitives'];
    readonly bounds: {
      readonly min: { readonly x: number; readonly y: number };
      readonly max: { readonly x: number; readonly y: number };
    };
  }) => void;
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
    onSceneBuilt,
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
  /**
   * The family the shell is set in, read from the same token the chrome uses.
   * A plan whose labels are `sans-serif` while the panel beside it is Plus
   * Jakarta Sans reads as two applications sharing a window.
   */
  const [planTextFamily, setPlanTextFamily] = useState('sans-serif');

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
        roomFills: Object.fromEntries(
          ROOM_TINTS.map((tint) => [tint, value(`--arq-plan-${tint}`, 'transparent')]),
        ),
      });
      setPlanTextFamily(value('--arq-font-ui', 'sans-serif'));
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

    /*
     * The sheet the drawing sits on.
     *
     * A plan is drawn on a page, and the reference composition shows exactly
     * that: a white sheet with a soft edge, floating on the gridded surface.
     * Before this the grid ran under the drawing and out to the window edges,
     * so the model read as marks on graph paper with no boundary of its own -
     * and the eye had nothing to tell it where the drawing stopped.
     *
     * Sized from the content and drawn in world space, so it pans and zooms
     * with the model rather than being a fixed rectangle the drawing slides
     * around inside. Skipped when there is nothing on it: an empty page is a
     * claim that something is there.
     */
    if (rooms.length > 0 || walls.length > 0) {
      const bounds = contentBounds(content);
      const marginMm = Math.max(
        (bounds.max.x - bounds.min.x) * SHEET_MARGIN_FRACTION,
        (bounds.max.y - bounds.min.y) * SHEET_MARGIN_FRACTION,
      );
      const topLeft = worldToScreen(
        currentViewport,
        worldPoint(bounds.min.x - marginMm, bounds.max.y + marginMm),
      );
      const bottomRight = worldToScreen(
        currentViewport,
        worldPoint(bounds.max.x + marginMm, bounds.min.y - marginMm),
      );
      const radius = SHEET_RADIUS_CSS_PX * devicePixelRatio;
      ctx.save();
      // The shadow is what separates the page from the surface. Kept soft and
      // low-contrast: a drawing sheet sits on a desk, it does not hover.
      ctx.shadowColor = 'rgba(15, 23, 28, 0.16)';
      ctx.shadowBlur = 24 * devicePixelRatio;
      ctx.shadowOffsetY = 4 * devicePixelRatio;
      ctx.fillStyle = palette.paper;
      ctx.beginPath();
      ctx.roundRect(
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y,
        radius,
      );
      ctx.fill();
      ctx.restore();
    }

    // The thickest wall on the level, so a room label is measured against the
    // space it can actually occupy. Zero when nothing declares a thickness,
    // which leaves the test exactly as it was.
    const maxWallThicknessMm =
      wallDimensions === undefined
        ? 0
        : [...wallDimensions.values()].reduce((max, entry) => Math.max(max, entry.thicknessMm), 0);

    /*
     * The text state is set before anything is measured, not after everything
     * is drawn.
     *
     * It used to be assigned immediately before `paintPlanScene`, three hundred
     * lines after `measureText` was called to decide whether a room label fits.
     * So the fit test measured in whatever font the context happened to be
     * carrying - the browser default 10px on the first frame - and the labels
     * were then drawn at 12px. Every label was measured about twenty per cent
     * narrower than it renders, which is why "Linen" and "Guest ensuite" passed
     * the fit and then crossed the wall between them.
     *
     * The family is the shell's own, resolved from the token rather than left
     * as `sans-serif`: a plan whose labels are set in a different typeface from
     * the panel beside it looks like two applications.
     */
    ctx.font = `${ROOM_LABEL_LINE_HEIGHT_PX * devicePixelRatio}px ${planTextFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    /*
     * The walls and their openings are built before the room labels, not after,
     * because a label has to clear the linework that will be painted over it.
     * The room's own ring cannot answer that: a wall can cross a room whose
     * boundary was calculated before that wall existed, and a door's swing arc
     * sweeps into a room by design and belongs to no room's boundary at all.
     * On the golden fixture "Linen" had an interior wall through the middle of
     * the word and "Inner hall" and "Entry foyer" each had a swing arc struck
     * through them, all three while passing a containment test that had no way
     * to know any of it was there.
     */
    const labelObstacles: RoomLabelObstacle[] = [];
    const wallPrimitives: PlanPrimitiveInput<string>[] = [];
    for (const wall of walls) {
      /*
       * A wall with a known thickness is drawn as its footprint rather than
       * its centreline. The outline comes from the same `wallOutline` the 3D
       * surface extrudes, so the two views cannot disagree about where a
       * wall's faces are - and a null result (a zero-length segment) falls
       * back to the centreline rather than dropping the wall from the plan.
       */
      const thicknessMm = wallDimensions?.get(wall.id)?.thicknessMm;
      if (thicknessMm === undefined || thicknessMm <= 0) {
        wallPrimitives.push({ kind: 'line', elementId: wall.id, points: [wall.start, wall.end] });
        labelObstacles.push({ start: wall.start, end: wall.end, clearance: 0 });
        continue;
      }
      const host = { start: wall.start, end: wall.end, thickness: thicknessMm };
      const openings = wallOpenings?.get(wall.id) ?? [];
      // Each pier keeps the wall out of a label by its own half-thickness, so a
      // 125mm partition is not held at a 250mm exterior wall's distance.
      const halfThicknessMm = thicknessMm / 2;
      if (openings.length === 0) {
        const outline = wallOutline(
          { start: wall.start, end: wall.end },
          thicknessMm,
          'centre',
          1e-6,
        );
        wallPrimitives.push(
          outline === null
            ? { kind: 'line', elementId: wall.id, points: [wall.start, wall.end] }
            : { kind: 'polygon', elementId: wall.id, points: outline, fill: 'poche' },
        );
        labelObstacles.push({
          start: wall.start,
          end: wall.end,
          clearance: halfThicknessMm,
        });
        continue;
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
      for (const pier of wallPiers(host, openings)) {
        const outline = wallOutline(pier, thicknessMm, 'centre', 1e-6);
        if (outline !== null) {
          wallPrimitives.push({
            kind: 'polygon',
            elementId: wall.id,
            points: outline,
            fill: 'poche',
          });
        }
        // The pier, not the whole wall: an opening is a gap a label may sit
        // beside, and holding it clear of the run the wall no longer occupies
        // would suppress labels for a wall that is not there.
        labelObstacles.push({
          start: pier.start,
          end: pier.end,
          clearance: halfThicknessMm,
        });
      }
      for (const opening of planOpeningsForWall(host, openings)) {
        // The jambs close the poché where the wall stops. Without them the
        // drawing shows two wall stubs and no evidence they are one wall.
        for (const jamb of opening.jambs) {
          wallPrimitives.push({
            kind: 'line',
            elementId: opening.id,
            points: [jamb.start, jamb.end],
          });
        }
        for (const glazing of opening.glazing) {
          wallPrimitives.push({
            kind: 'line',
            elementId: opening.id,
            points: [glazing.start, glazing.end],
          });
        }
        // Jambs and glazing sit within the wall's own footprint, which the
        // piers either side already keep a label clear of. The leaf and the
        // swing do not - they are the part of a door that reaches into the
        // room - so those two are the ones a label has to be told about.
        if (opening.leaf !== null) {
          wallPrimitives.push({
            kind: 'line',
            elementId: opening.id,
            points: [opening.leaf.start, opening.leaf.end],
          });
          labelObstacles.push({
            start: opening.leaf.start,
            end: opening.leaf.end,
            clearance: 0,
          });
        }
        if (opening.swing !== null) {
          const arc = swingPolyline(opening.swing);
          wallPrimitives.push({ kind: 'line', elementId: opening.id, points: arc });
          for (let index = 1; index < arc.length; index += 1) {
            labelObstacles.push({
              start: arc[index - 1]!,
              end: arc[index]!,
              clearance: 0,
            });
          }
        }
      }
    }

    const inputs: PlanPrimitiveInput<string>[] = [
      ...rooms.map((room): PlanPrimitiveInput<string> => ({
        kind: 'polygon',
        // Tinted so an enclosed area reads as a room rather than as four walls
        // that happen to meet. Drawn first, so the walls sit on top of it.
        fill: 'room',
        // Derived from the room's name, because `Room` carries no type field.
        // An unrecognised name takes the neutral tint rather than a guess.
        fillTint: roomTint(room.label),
        elementId: room.id,
        points: room.polygon,
      })),
      ...rooms.flatMap((room): PlanPrimitiveInput<string>[] => {
        /*
         * A label is drawn only where it fits: inside its own room, clear of
         * the walls that bound it, clear of the linework about to be painted
         * over it, and clear of the labels already placed. When none of the
         * positions the room offers can hold it, the room goes unnamed - it is
         * still drawn, still selectable and still names itself in the
         * Inspector, so nothing is lost except a claim that could not be read.
         *
         * Two things are tried, in this order: the fuller text first, then a
         * shorter one; and for each, the room's centre first, then positions
         * further out. Text before position, because the area is information
         * and a slightly off-centre label still reads as belonging to its room.
         *
         * The shorter text is the name without the area. A room label is two
         * lines and the rule used to be all-or-nothing: if both did not fit,
         * the room went unnamed. A drawn plan does not behave that way; it
         * drops the area first and keeps the name, because the name identifies
         * the room and the area qualifies it.
         */
        const fullLines = room.label.split('\n');
        const textCandidates =
          fullLines.length > 1 ? [fullLines, [fullLines[0] ?? '']] : [fullLines];

        /*
         * Only the linework near this room, so the search below stays cheap.
         * A level carries a few hundred segments and a room is asked about
         * dozens of positions; testing every segment against every position
         * would be a repaint's worth of work for no different answer, because
         * a wall on the far side of the building cannot cross a label here.
         */
        const bounds = polygonBounds(room.polygon);
        const nearby = labelObstacles.filter((obstacle) =>
          segmentNearBounds(obstacle, bounds, maxWallThicknessMm),
        );

        const halfWallMm = maxWallThicknessMm / 2;
        for (const lines of textCandidates) {
          /*
           * Measured in world units against the room's own shape.
           *
           * The text is measured on the canvas, at the size it will be painted,
           * because legibility is a screen-pixel question; it is then divided
           * by the scale, because containment is a question about the room.
           */
          const labelWidth =
            Math.max(...lines.map((line) => ctx.measureText(line).width)) /
            currentViewport.pixelsPerUnit;
          const labelHeight =
            (lines.length * ROOM_LABEL_LINE_HEIGHT_PX * devicePixelRatio) /
            currentViewport.pixelsPerUnit;
          for (const anchor of roomLabelAnchors(room.polygon)) {
            if (
              !roomLabelFits({
                polygon: room.polygon,
                anchor,
                labelWidth,
                labelHeight,
                // Half the thickest wall on the level: a room's boundary runs
                // to the wall centrelines, so that much of the ring is poché
                // rather than floor. The thickest is conservative and needs no
                // per-room lookup; the piers below hold each wall at its own
                // real thickness anyway.
                wallInset: halfWallMm,
                obstacles: nearby,
              })
            ) {
              continue;
            }
            /*
             * A placed label becomes something the next one has to clear.
             * Without this two rooms whose rings overlap - which the golden
             * fixture has, its "Linen" ring reaching into "South gallery" -
             * can each be told they fit and print on top of each other.
             */
            for (const edge of labelKeepOut(anchor, labelWidth, labelHeight)) {
              labelObstacles.push(edge);
            }
            return [
              { kind: 'text', elementId: `${room.id}-label`, anchor, text: lines.join('\n') },
            ];
          }
        }
        return [];
      }),
      ...wallPrimitives,
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

    paintPlanScene(ctx, currentViewport, devicePixelRatio, painted, palette);
    // Reported after painting, so what a caller receives is what was drawn -
    // not a scene that was built and then discarded by a later guard.
    onSceneBuilt?.({ primitives: scene.primitives, bounds: contentBounds(content) });

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
    planTextFamily,
    wallDimensions,
    wallOpenings,
    onSceneBuilt,
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
          const fitted = fitContent(
            emptyContentBounds({ rooms, walls }) ?? contentBounds({ rooms, walls }),
            canvas,
            rect,
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
      const fitted = fitContent(
        emptyContentBounds(content) ?? contentBounds(content),
        canvas,
        rect,
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
