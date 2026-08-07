import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { wallOutline, type WorldPoint } from '@arq/geometry-2d';
import { extrudePolygonMesh, generateWallOpeningMeshes, type Mesh3D } from '@arq/geometry-3d';
import {
  applyOrbitCameraState,
  applySharedSelection,
  createModelScene,
  placeModelFloor,
  createOrthographicCamera,
  fitBoundingSphere,
  orbitBy,
  panBy,
  zoomBy,
  DEFAULT_ORBIT_CAMERA_STATE,
  type OrbitCameraState,
  type PlanSelectionState,
  type StyleToken,
} from '@arq/model-renderer';
import { wheelZoomFactor } from './canvas/canvas-interaction';
import { wallLength, type DrawnWall } from './canvas/plan-document';

/**
 * Release 1's "basic orthographic 3D": the same plan document, extruded.
 * Walls become real solids (geometry-3d's extrudePolygonMesh over
 * geometry-2d's wallOutline) in the model-renderer scene, under the
 * coordinate mapping model-scene.ts fixes: plan (x, y) -> 3D (x, z),
 * 3D y = height. Selection is the same object the plan canvas uses
 * (applySharedSelection resolves the same style tokens), so the two views
 * can never disagree about what is selected - blueprint section 45's
 * "plan and 3D disagreement" bug, prevented by construction.
 *
 * Deliberately plain per section 62: neutral lighting, flat monochrome
 * materials, no photorealism. Drawn walls extrude at the demo wall type's
 * 100 mm thickness and 2400 mm height - the one type this build has.
 */

const WALL_THICKNESS_MM = 100;
const WALL_HEIGHT_MM = 2400;
/**
 * How far the ground extends past the model, as a multiple of its footprint.
 *
 * It was a fixed 30m square centred on the world origin. The golden fixture is
 * a 12m house whose corner sits at the origin, so the ground was two and a half
 * times its width in each direction and the house stood in one quadrant of it -
 * and because the camera frames the model rather than the floor, the view was a
 * grey plane filling the frame with a small building off-centre in it.
 */
const FLOOR_MARGIN = 1.5;

/** The smallest ground worth drawing, so an empty scene still stands on something. */
const MIN_FLOOR_SIZE_MM = 8000;

/**
 * What an empty 3D view is framed to, since there is nothing to fit to. Six
 * metres of radius shows a room-sized volume, so the first wall a user draws
 * arrives at a legible size rather than as a speck or off the edge.
 */
const EMPTY_VIEW_RADIUS_MM = 6000;

/**
 * Material treatment per style token, brand-compliant: the only hue is
 * phthalo green (design/tokens/brand.v4.css), with secondary selection
 * distinguished by opacity - a treatment, not an invented colour - the
 * same rule the 2D backend's line treatments follow. Greys are part of
 * the monochrome scale, not hues.
 */
const TOKEN_TREATMENT: Readonly<
  Partial<Record<StyleToken, { readonly color: number; readonly opacity: number }>>
> = {
  'selected-primary': { color: 0x0b6b50, opacity: 1 },
  'selected-secondary': { color: 0x0b6b50, opacity: 0.55 },
  hover: { color: 0x4a4a4a, opacity: 1 },
};
const DEFAULT_WALL_COLOR = 0x8a8a8a;

/**
 * One opening's span through a wall, in the plain-number shape
 * `generateWallOpeningMeshes` takes. Elevation matters here and does not in
 * plan, which is why this is not the plan's opening record: a window that stops
 * short of the ceiling leaves a header panel above it, and that panel is the
 * whole difference between an opening-aware model and a hole punched through.
 */
export interface ModelOpeningSpan {
  readonly offsetFromWallStart: number;
  readonly width: number;
  readonly sillHeight: number;
  readonly height: number;
}

/** Per-wall solid dimensions, so an opened project extrudes at its own wall types. */
export interface WallSolidDimensions {
  readonly thicknessMm: number;
  readonly heightMm: number;
}

export interface ModelCanvasProps {
  readonly walls: readonly DrawnWall[];
  readonly selection: PlanSelectionState<string>;
  readonly onSelectElement: (elementId: string | null) => void;
  /**
   * Thickness and height per wall id. A wall with no entry uses the workspace's
   * own demo wall type, which is the only type the drawing tools have. An opened
   * project supplies every wall, so its walls are extruded at the dimensions its
   * own wall types declare rather than at a single borrowed default.
   */
  readonly wallDimensions?: ReadonlyMap<string, WallSolidDimensions>;
  /**
   * The hosted openings each wall carries, keyed by wall id. A wall with
   * openings is extruded as the panels around them - piers, sill and header -
   * rather than as one solid, so a door is a hole through the model and not a
   * rectangle drawn on its face.
   */
  readonly wallOpenings?: ReadonlyMap<string, readonly ModelOpeningSpan[]>;
}

interface ModelRefs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  wallGroup: THREE.Group;
  orbit: OrbitCameraState;
  aspect: number;
}

function toGeometry(mesh: Mesh3D): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mesh.positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(mesh.normals), 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  return geometry;
}

/**
 * The solids one wall contributes.
 *
 * A wall with no openings is one box, exactly as before. A wall with openings
 * becomes the panels that survive them - a pier either side, a sill below and a
 * header above - which is `generateWallOpeningMeshes`, written for this and
 * never called by anything but its own tests. Several meshes rather than one
 * because a door is an absence, and an absence cannot be added to a solid.
 */
function toMeshes(
  wall: DrawnWall,
  dimensions: WallSolidDimensions,
  openings: readonly ModelOpeningSpan[],
): readonly THREE.BufferGeometry[] {
  if (openings.length > 0) {
    const panels = generateWallOpeningMeshes(
      { start: wall.start, end: wall.end },
      dimensions.thicknessMm,
      'centre',
      dimensions.heightMm,
      0,
      openings,
      1e-6,
    );
    // A null result means the decomposition could not be trusted for this wall.
    // Falling through to the solid below draws the wall without its openings,
    // which is wrong but visible; dropping the wall would silently delete part
    // of someone's building.
    if (panels !== null) {
      return panels.map(toGeometry);
    }
  }

  const outline = wallOutline(
    { start: wall.start, end: wall.end },
    dimensions.thicknessMm,
    'centre',
    1e-6,
  );
  if (outline === null) {
    return [];
  }
  const mesh = extrudePolygonMesh(outline, 0, dimensions.heightMm);
  return mesh === null ? [] : [toGeometry(mesh)];
}

/**
 * The extent the camera frames, or a starting one when there is nothing to
 * frame.
 *
 * The empty case is not hypothetical and was not reachable before: a demo room
 * outline used to be drawn whenever no project was open, so the point set was
 * never empty. Removing it left the bounds at positive and negative infinity,
 * which produced a NaN radius, and `fitBoundingSphere` threw "radius must be a
 * positive finite number" during render - so the 3D canvas never mounted at
 * all. The plan surface needed the same guard for the same reason on the same
 * removal; this is its other half.
 */
function contentSphere(walls: readonly DrawnWall[]): {
  readonly center: THREE.Vector3;
  readonly radius: number;
} {
  const footprint = contentFootprint(walls);
  if (footprint === null) {
    return {
      center: new THREE.Vector3(0, WALL_HEIGHT_MM / 2, 0),
      radius: EMPTY_VIEW_RADIUS_MM,
    };
  }
  const center = new THREE.Vector3(footprint.centerX, WALL_HEIGHT_MM / 2, footprint.centerZ);
  const radius = Math.max(Math.hypot(footprint.width, WALL_HEIGHT_MM, footprint.depth) / 2, 1000);
  return { center, radius };
}

/** The model's plan-view extent, or null when there is no model. */
function contentFootprint(walls: readonly DrawnWall[]): {
  readonly centerX: number;
  readonly centerZ: number;
  readonly width: number;
  readonly depth: number;
} | null {
  const points = walls.flatMap((wall) => [wall.start, wall.end]);
  if (points.length === 0) {
    return null;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minZ = Math.min(minZ, point.y);
    maxX = Math.max(maxX, point.x);
    maxZ = Math.max(maxZ, point.y);
  }
  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}

/** Ground sized and placed for what is actually being drawn. */
function floorPlacement(walls: readonly DrawnWall[]): {
  readonly size: number;
  readonly x: number;
  readonly z: number;
} {
  const footprint = contentFootprint(walls);
  if (footprint === null) {
    return { size: MIN_FLOOR_SIZE_MM, x: 0, z: 0 };
  }
  return {
    size: Math.max(MIN_FLOOR_SIZE_MM, Math.max(footprint.width, footprint.depth) * FLOOR_MARGIN),
    x: footprint.centerX,
    z: footprint.centerZ,
  };
}

/**
 * The appearance's surface, floor and ink as three.js colour numbers.
 *
 * Reads the same `--arq-ui-*` custom properties the rest of the shell uses, so
 * the 3D view cannot drift from the appearance the way a second hard-coded
 * palette would. Falls back to the light values when a property is missing or
 * unparseable, which is what a non-browser or a stripped stylesheet gets.
 */
function readAppearanceColours(element: HTMLElement): {
  readonly paper: number;
  readonly floor: number;
  readonly ink: number;
} {
  const fallback = { paper: 0xffffff, floor: 0xf4f4f4, ink: 0x111111 };
  if (typeof window === 'undefined') {
    return fallback;
  }
  const style = window.getComputedStyle(element);
  const read = (name: string, missing: number): number => {
    const raw = style.getPropertyValue(name).trim();
    const match = /^#([0-9a-fA-F]{6})$/.exec(raw);
    return match === null ? missing : Number.parseInt(match[1]!, 16);
  };
  return {
    paper: read('--arq-ui-paper', fallback.paper),
    floor: read('--arq-ui-surface-2', fallback.floor),
    ink: read('--arq-ui-ink', fallback.ink),
  };
}

export function ModelCanvas(props: ModelCanvasProps): JSX.Element {
  const { walls, selection, onSelectElement, wallDimensions, wallOpenings } = props;
  const dimensionsFor = useCallback(
    (wallId: string): WallSolidDimensions =>
      wallDimensions?.get(wallId) ?? {
        thicknessMm: WALL_THICKNESS_MM,
        heightMm: WALL_HEIGHT_MM,
      },
    [wallDimensions],
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refsRef = useRef<ModelRefs | null>(null);
  const dragRef = useRef<{
    readonly pointerId: number;
    readonly mode: 'orbit' | 'pan';
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);

  const renderNow = useCallback(() => {
    const refs = refsRef.current;
    if (refs !== null) {
      applyOrbitCameraState(refs.camera, refs.orbit, refs.aspect);
      refs.renderer.render(refs.scene, refs.camera);
    }
  }, []);

  /* One-time scene/renderer setup; resize via ResizeObserver. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const aspect = Math.max(rect.width, 1) / Math.max(rect.height, 1);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(Math.max(rect.width, 1), Math.max(rect.height, 1), false);
    /*
     * The 3D surface follows the appearance for the same reason the plan does:
     * a WebGL clear colour cannot inherit CSS, so a hard-coded white left a lit
     * white box sitting in dark chrome. Read from the resolved tokens so there
     * is one source for the surface colour rather than a second palette here.
     */
    const appearance = readAppearanceColours(canvas);
    renderer.setClearColor(appearance.paper, 1);

    const placement = floorPlacement(walls);
    const scene = createModelScene({
      floorSize: placement.size,
      floorCenter: { x: placement.x, z: placement.z },
      floorColor: appearance.floor,
    });
    const wallGroup = new THREE.Group();
    wallGroup.name = 'arq-drawn-walls';
    scene.add(wallGroup);

    /*
     * No starting-room outline. It was drawn here whenever no project was open,
     * on the same reasoning as the plan's demo rectangle and with the same
     * problem: a loop drawn at real world coordinates by the real renderer
     * reads as the model, and a caption cannot undo that. The plan stopped
     * drawing its version; this is the other half of the same removal.
     */

    const camera = createOrthographicCamera({ aspect, viewSize: 12000, far: 200000 });
    const sphere = contentSphere(walls);
    const orbit = fitBoundingSphere(
      { ...DEFAULT_ORBIT_CAMERA_STATE, distance: 40000 },
      sphere.center,
      sphere.radius,
      aspect,
    );
    refsRef.current = { renderer, scene, camera, wallGroup, orbit, aspect };
    renderNow();

    const observer = new ResizeObserver(() => {
      const refs = refsRef.current;
      if (refs === null || canvas === null) {
        return;
      }
      const size = canvas.getBoundingClientRect();
      refs.aspect = Math.max(size.width, 1) / Math.max(size.height, 1);
      refs.renderer.setSize(Math.max(size.width, 1), Math.max(size.height, 1), false);
      renderNow();
    });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      wallGroup.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      refsRef.current = null;
    };
  }, [renderNow]);

  /* Rebuild wall meshes when the document changes; restyle on selection. */
  useEffect(() => {
    const refs = refsRef.current;
    if (refs === null) {
      return;
    }
    // The ground follows the model. It is built at mount from whatever was
    // there then, and a project opened afterwards replaces every wall - so
    // without this the floor stays at the size and place of the previous model,
    // or of no model at all.
    placeModelFloor(refs.scene, floorPlacement(walls));
    for (const child of [...refs.wallGroup.children]) {
      refs.wallGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    const byId = new Map<string, THREE.Object3D>();
    for (const wall of walls) {
      if (wallLength(wall) === 0) {
        continue;
      }
      const geometries = toMeshes(wall, dimensionsFor(wall.id), wallOpenings?.get(wall.id) ?? []);
      if (geometries.length === 0) {
        continue;
      }
      /*
       * Every panel carries the wall's element id, so a raycast that lands on a
       * pier between two windows still selects the wall. Selection is a
       * statement about the model, and the model has one wall there however
       * many solids it takes to draw it.
       */
      for (const geometry of geometries) {
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshLambertMaterial({ color: DEFAULT_WALL_COLOR }),
        );
        mesh.name = wall.id;
        mesh.userData['elementId'] = wall.id;
        refs.wallGroup.add(mesh);
        // The first panel is the one selection styling reads and writes; the
        // rest follow it below. Keyed by wall id either way, so nothing
        // downstream learns that a wall can be more than one mesh.
        if (!byId.has(wall.id)) byId.set(wall.id, mesh);
      }
    }
    applySharedSelection(byId, new Set<string>(), selection, new Set<string>());
    // Resolved once per wall, then applied to every panel of it. Styling only
    // the representative panel would leave a selected wall highlighted between
    // its openings and plain beside them.
    const treatmentByWall = new Map<string, (typeof TOKEN_TREATMENT)[StyleToken] | undefined>();
    for (const [wallId, object] of byId) {
      const token = object.userData['styleToken'] as StyleToken | undefined;
      treatmentByWall.set(wallId, token === undefined ? undefined : TOKEN_TREATMENT[token]);
    }
    for (const object of refs.wallGroup.children) {
      if (!(object instanceof THREE.Mesh)) continue;
      const wallId = object.userData['elementId'] as string | undefined;
      const treatment = wallId === undefined ? undefined : treatmentByWall.get(wallId);
      const material = object.material as THREE.MeshLambertMaterial;
      material.color.setHex(treatment?.color ?? DEFAULT_WALL_COLOR);
      material.opacity = treatment?.opacity ?? 1;
      material.transparent = (treatment?.opacity ?? 1) < 1;
    }
    renderNow();
  }, [walls, selection, dimensionsFor, wallOpenings, renderNow]);

  /* Orbit / pan / zoom / pick. */
  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      mode: event.button === 1 || event.shiftKey ? 'pan' : 'orbit',
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const refs = refsRef.current;
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (refs === null || drag === null || canvas === null || drag.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 0) {
      drag.moved = true;
    }
    if (drag.mode === 'orbit') {
      refs.orbit = orbitBy(refs.orbit, -dx * 0.005, -dy * 0.005);
    } else {
      const rect = canvas.getBoundingClientRect();
      const worldPerPixel = refs.orbit.viewSize / Math.max(rect.height, 1);
      const right = new THREE.Vector3().setFromMatrixColumn(refs.camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(refs.camera.matrix, 1);
      const delta = right
        .multiplyScalar(-dx * worldPerPixel)
        .add(up.multiplyScalar(dy * worldPerPixel));
      refs.orbit = panBy(refs.orbit, { x: delta.x, y: delta.y, z: delta.z });
    }
    renderNow();
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const refs = refsRef.current;
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    dragRef.current = null;
    if (refs === null || drag === null || canvas === null || event.type === 'pointercancel') {
      return;
    }
    if (!drag.moved && event.button === 0) {
      // A still click picks: raycast into the wall meshes, sharing the same
      // selection state as the plan view.
      const rect = canvas.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, refs.camera);
      const hit = raycaster
        .intersectObjects(refs.wallGroup.children, false)
        .find((intersection) => typeof intersection.object.userData['elementId'] === 'string');
      onSelectElement(hit === undefined ? null : (hit.object.userData['elementId'] as string));
    }
  }

  function handleDoubleClick(): void {
    const refs = refsRef.current;
    if (refs === null) {
      return;
    }
    const sphere = contentSphere(walls);
    refs.orbit = fitBoundingSphere(refs.orbit, sphere.center, sphere.radius, refs.aspect);
    renderNow();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    function onWheel(event: WheelEvent): void {
      const refs = refsRef.current;
      if (refs === null) {
        return;
      }
      event.preventDefault();
      refs.orbit = zoomBy(refs.orbit, wheelZoomFactor(event.deltaY));
      renderNow();
    }
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [renderNow]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      aria-label="3D model view"
    />
  );
}
