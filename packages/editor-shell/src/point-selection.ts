/**
 * ARQ-040: point selection.
 *
 * Single-target, click-based selection built on the ARQ-039 hit-test
 * interface: a point-shaped HitTestable (a circular tolerance zone around
 * a world point, since a point has no area of its own to click on), and a
 * minimal selection-state tracker holding at most one selected id.
 *
 * Window selection (drag a rectangle, ARQ-041), crossing selection
 * (ARQ-042), and cycling between overlapping candidates (ARQ-043) are
 * separate, later issues - out of scope here on purpose.
 *
 * Escape/Enter: Escape clears the current selection. Enter has no defined
 * behaviour here - selection is a passive query with no preview/commit
 * step (unlike a drawing tool's command lifecycle, ARQ-038), so there is
 * nothing for Enter to commit.
 */

import type { WorldPoint } from '@arq/geometry-2d';
import type { HitTestable } from './hit-test';

export function createPointHitTestable(target: WorldPoint): HitTestable {
  return {
    hitTest(point: WorldPoint, toleranceWorld: number): boolean {
      const dx = point.x - target.x;
      const dy = point.y - target.y;
      return dx * dx + dy * dy <= toleranceWorld * toleranceWorld;
    },
  };
}

export interface SelectionSnapshot<TId> {
  readonly selectedId: TId | null;
}

export function createSingleSelection<TId>() {
  let selectedId: TId | null = null;

  function snapshot(): SelectionSnapshot<TId> {
    return { selectedId };
  }

  /** Selecting `null` (a pick that hit nothing) deselects, matching "click empty space clears selection". */
  function select(id: TId | null): SelectionSnapshot<TId> {
    selectedId = id;
    return snapshot();
  }

  function escape(): SelectionSnapshot<TId> {
    selectedId = null;
    return snapshot();
  }

  return { snapshot, select, escape };
}
