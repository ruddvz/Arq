import type { WorldPoint } from '@arq/geometry-2d';

/**
 * The in-memory plan content this build can actually edit.
 *
 * Deliberately not a project store: ARQ-067's applyCreateElement and the
 * .arq persistence layer exist as libraries, but no open-project pipeline
 * connects them to the workspace yet (apps/web has no project-loading
 * dependency, and the file-open flow stops at its byte-safety verdict).
 * Until that pipeline exists, the canvas edits this typed, undoable
 * in-memory document - real interaction over honest storage limits, rather
 * than a fake "Saved" state. The shell continues to report 'no-project'.
 */

export interface DrawnWall {
  readonly id: string;
  readonly start: WorldPoint;
  readonly end: WorldPoint;
}

/**
 * The workspace's undoable operations. 'note' entries record demo actions
 * that mutate nothing (share, open account menu) so the history list stays
 * truthful about what happened without pretending those have inverses.
 */
export type WorkspaceOperation =
  | { readonly kind: 'add-walls'; readonly walls: readonly DrawnWall[] }
  | { readonly kind: 'remove-walls'; readonly wallIds: readonly string[] }
  | { readonly kind: 'note'; readonly label: string };

/** Applies `operation` to the wall list, returning the new list. */
export function applyOperation(
  walls: readonly DrawnWall[],
  operation: WorkspaceOperation,
): readonly DrawnWall[] {
  switch (operation.kind) {
    case 'add-walls': {
      // Re-adding an id that is somehow present would duplicate geometry;
      // filter first so apply stays idempotent per id (undo/redo safety).
      const incoming = new Set(operation.walls.map((wall) => wall.id));
      return [...walls.filter((wall) => !incoming.has(wall.id)), ...operation.walls];
    }
    case 'remove-walls': {
      const removing = new Set(operation.wallIds);
      return walls.filter((wall) => !removing.has(wall.id));
    }
    case 'note':
      return walls;
  }
}

/** The inverse operation, for the undo stack's (forward, inverse) pair. */
export function invertOperation(
  walls: readonly DrawnWall[],
  operation: WorkspaceOperation,
): WorkspaceOperation {
  switch (operation.kind) {
    case 'add-walls':
      return { kind: 'remove-walls', wallIds: operation.walls.map((wall) => wall.id) };
    case 'remove-walls': {
      const removing = new Set(operation.wallIds);
      return { kind: 'add-walls', walls: walls.filter((wall) => removing.has(wall.id)) };
    }
    case 'note':
      return operation;
  }
}

/** Human label for the top bar's undo/redo tooltips and the history list. */
export function operationLabel(operation: WorkspaceOperation): string {
  switch (operation.kind) {
    case 'add-walls':
      return operation.walls.length === 1 ? 'Draw wall' : `Draw ${operation.walls.length} walls`;
    case 'remove-walls':
      return operation.wallIds.length === 1
        ? 'Delete wall'
        : `Delete ${operation.wallIds.length} walls`;
    case 'note':
      return operation.label;
  }
}

/** Wall length in world units (mm), for labels and the inspector. */
export function wallLength(wall: DrawnWall): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}
