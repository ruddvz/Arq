import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { wallOutline, type WorldPoint } from '@arq/geometry-2d';
import { extrudePolygonMesh } from '@arq/geometry-3d';
import {
  applyOrbitCameraState,
  applySharedSelection,
  createModelScene,
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
const FLOOR_SIZE_MM = 30000;

const DEMO_ROOM_POLYGON: readonly { readonly x: number; readonly y: number }[] = [
  { x: 0, y: 0 },
  { x: 4200, y: 0 },
  { x: 4200, y: 3600 },
  { x: 0, y: 3600 },
];

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

export interface ModelCanvasProps {
  readonly walls: readonly DrawnWall[];
  readonly selection: PlanSelectionState<string>;
  readonly onSelectElement: (elementId: string | null) => void;
}

interface ModelRefs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  wallGroup: THREE.Group;
  orbit: OrbitCameraState;
  aspect: number;
}

function toMesh(wall: DrawnWall): THREE.BufferGeometry | null {
  const outline = wallOutline(
    { start: wall.start, end: wall.end },
    WALL_THICKNESS_MM,
    'centre',
    1e-6,
  );
  if (outline === null) {
    return null;
  }
  const mesh = extrudePolygonMesh(outline, 0, WALL_HEIGHT_MM);
  if (mesh === null) {
    return null;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mesh.positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(mesh.normals), 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  return geometry;
}

function contentSphere(walls: readonly DrawnWall[]): {
  readonly center: THREE.Vector3;
  readonly radius: number;
} {
  const points = [...DEMO_ROOM_POLYGON, ...walls.flatMap((wall) => [wall.start, wall.end])];
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
  const center = new THREE.Vector3((minX + maxX) / 2, WALL_HEIGHT_MM / 2, (minZ + maxZ) / 2);
  const radius = Math.max(Math.hypot(maxX - minX, WALL_HEIGHT_MM, maxZ - minZ) / 2, 1000);
  return { center, radius };
}

export function ModelCanvas(props: ModelCanvasProps): JSX.Element {
  const { walls, selection, onSelectElement } = props;
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
    renderer.setClearColor(0xffffff, 1);

    const scene = createModelScene({ floorSize: FLOOR_SIZE_MM, floorColor: 0xf4f4f4 });
    const wallGroup = new THREE.Group();
    wallGroup.name = 'arq-drawn-walls';
    scene.add(wallGroup);

    // The demo room fixture appears as a floor outline, labelled by its
    // absence of mass - fixture context, not claimed geometry.
    const roomOutline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        DEMO_ROOM_POLYGON.map((point) => new THREE.Vector3(point.x, 1, point.y)),
      ),
      new THREE.LineBasicMaterial({ color: 0x111111 }),
    );
    roomOutline.name = 'demo-room-outline';
    scene.add(roomOutline);

    const camera = createOrthographicCamera({ aspect, viewSize: 12000, far: 200000 });
    const sphere = contentSphere([]);
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
      const geometry = toMesh(wall);
      if (geometry === null) {
        continue;
      }
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshLambertMaterial({ color: DEFAULT_WALL_COLOR }),
      );
      mesh.name = wall.id;
      mesh.userData['elementId'] = wall.id;
      refs.wallGroup.add(mesh);
      byId.set(wall.id, mesh);
    }
    applySharedSelection(byId, new Set<string>(), selection, new Set<string>());
    for (const object of byId.values()) {
      if (object instanceof THREE.Mesh) {
        const token = object.userData['styleToken'] as StyleToken | undefined;
        const treatment = token !== undefined ? TOKEN_TREATMENT[token] : undefined;
        const material = object.material as THREE.MeshLambertMaterial;
        material.color.setHex(treatment?.color ?? DEFAULT_WALL_COLOR);
        material.opacity = treatment?.opacity ?? 1;
        material.transparent = (treatment?.opacity ?? 1) < 1;
      }
    }
    renderNow();
  }, [walls, selection, renderNow]);

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
