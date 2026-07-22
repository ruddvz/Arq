/**
 * ARQ-115: benchmark Canvas 2D.
 *
 * Generates a synthetic scene matching benchmarks/PERFORMANCE-BUDGETS.json's
 * benchmarkModel exactly (150 walls, 80 doors/windows, 60 rooms, 200
 * annotations) - not a real floor plan, but the same object *counts* the
 * protected benchmark defines, which is what actually stresses a 2D
 * renderer's per-frame draw-call volume. Deterministic (no Math.random)
 * so repeated runs are directly comparable.
 *
 * Plain script, no bundler/build step: loaded directly by
 * canvas-2d-benchmark.html via a <script> tag over file://, and reused
 * as-is by run-canvas-2d-benchmark.mjs's Playwright driver.
 */

/* global window */

function buildScene() {
  const cols = 10;
  const rows = 6; // 10 x 6 = 60 rooms, matching benchmarkModel.rooms
  const roomWidth = 4000;
  const roomHeight = 3000;
  const wallThickness = 100;

  const walls = [];
  const rooms = [];
  const openings = [];
  const annotations = [];

  // Vertical grid lines: (cols + 1) x rows wall segments.
  for (let c = 0; c <= cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      walls.push({
        x: c * roomWidth - wallThickness / 2,
        y: r * roomHeight,
        w: wallThickness,
        h: roomHeight,
      });
    }
  }
  // Horizontal grid lines: (rows + 1) x cols wall segments.
  for (let r = 0; r <= rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      walls.push({
        x: c * roomWidth,
        y: r * roomHeight - wallThickness / 2,
        w: roomWidth,
        h: wallThickness,
      });
    }
  }
  // Grid lines alone give (cols+1)*rows + (rows+1)*cols wall segments.
  // Pad with short interior partition walls up to exactly 150.
  const targetWalls = 150;
  let partitionIndex = 0;
  while (walls.length < targetWalls) {
    const c = partitionIndex % cols;
    const r = Math.floor(partitionIndex / cols) % rows;
    walls.push({
      x: c * roomWidth + roomWidth / 2 - wallThickness / 2,
      y: r * roomHeight,
      w: wallThickness,
      h: roomHeight / 2,
    });
    partitionIndex += 1;
  }

  // 60 rooms: one per grid cell, inset by half the wall thickness.
  let roomIndex = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x0 = c * roomWidth + wallThickness / 2;
      const y0 = r * roomHeight + wallThickness / 2;
      const x1 = (c + 1) * roomWidth - wallThickness / 2;
      const y1 = (r + 1) * roomHeight - wallThickness / 2;
      rooms.push({
        polygon: [
          { x: x0, y: y0 },
          { x: x1, y: y0 },
          { x: x1, y: y1 },
          { x: x0, y: y1 },
        ],
        label: `Room ${roomIndex + 1}`,
        labelX: (x0 + x1) / 2 - 24,
        labelY: (y0 + y1) / 2,
      });
      roomIndex += 1;
    }
  }

  // 80 openings, distributed roughly evenly across the wall list.
  const targetOpenings = 80;
  const openingStride = walls.length / targetOpenings;
  for (let i = 0; i < targetOpenings; i += 1) {
    const wall = walls[Math.floor(i * openingStride) % walls.length];
    const horizontal = wall.w >= wall.h;
    openings.push(
      horizontal
        ? { x: wall.x + wall.w / 2 - 450, y: wall.y, w: 900, h: wall.h }
        : { x: wall.x, y: wall.y + wall.h / 2 - 450, w: wall.w, h: 900 },
    );
  }

  // 200 annotations: one dimension label per wall (150) plus 50 extra note labels.
  for (let i = 0; i < walls.length; i += 1) {
    const wall = walls[i];
    annotations.push({
      text: `${Math.round(wall.w >= wall.h ? wall.w : wall.h)}`,
      x: wall.x + wall.w / 2,
      y: wall.y + wall.h / 2 - 10,
    });
  }
  for (let i = 0; i < 200 - walls.length; i += 1) {
    const room = rooms[i % rooms.length];
    annotations.push({
      text: `Note ${i + 1}`,
      x: room.labelX,
      y: room.labelY + 20,
    });
  }

  const worldWidth = cols * roomWidth;
  const worldHeight = rows * roomHeight;

  return { walls, rooms, openings, annotations, worldWidth, worldHeight };
}

function countsOf(scene) {
  return {
    walls: scene.walls.length,
    rooms: scene.rooms.length,
    openings: scene.openings.length,
    annotations: scene.annotations.length,
  };
}

if (typeof window !== 'undefined') {
  window.ArqBenchmarkScene = { buildScene, countsOf };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildScene, countsOf };
}
