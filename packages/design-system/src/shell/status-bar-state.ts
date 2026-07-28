/**
 * ARQ-027: build status bar.
 *
 * Blueprint section 12 > "Bottom status bar": units, cursor coordinates,
 * active snap, selection count, current level, view scale, model health,
 * local journal state, sync state, performance warning when support mode is
 * enabled.
 *
 * Kept decoupled from @arq/geometry-2d/@arq/editor-shell/@arq/bim-core on
 * purpose (the same domain-agnostic layering plan-renderer's
 * snap-glyph-rendering.ts already established for a UI-adjacent package):
 * this module only formats already-resolved primitive values a caller
 * supplies (a plain `{x, y}` pair, a snap label string, a model-health
 * count) - it does not know what a WorldPoint, SnapSource, or
 * ValidationMessage is.
 *
 * Non-goal: the "performance warning when support mode is enabled" bullet
 * needs a real "support mode" concept, which does not exist anywhere in
 * this repository yet - `formatPerformanceWarning` below accepts a plain
 * boolean flag so a future caller can wire it in without this module
 * changing, rather than this module inventing what "support mode" means.
 */

export interface StatusBarCoordinates {
  readonly x: number;
  readonly y: number;
}

/**
 * `null` coordinates means the pointer is currently outside the canvas. Say so
 * in words, the way `formatActiveSnap` and `formatSelectionCount` already do,
 * rather than "0, 0" (a real, misleading position) or a bare dash (which a
 * screen reader announces as nothing and which the house style keeps out of
 * rendered copy).
 */
export function formatCoordinates(
  coordinates: StatusBarCoordinates | null,
  unitLabel: string,
  fractionDigits = 0,
): string {
  if (coordinates === null) {
    return 'Off canvas';
  }
  return `${coordinates.x.toFixed(fractionDigits)}${unitLabel}, ${coordinates.y.toFixed(fractionDigits)}${unitLabel}`;
}

/** `null` means no active snap - text, not an icon alone (section 126: "status not colour-only"). */
export function formatActiveSnap(snapLabel: string | null): string {
  return snapLabel ?? 'No snap';
}

export function formatSelectionCount(count: number): string {
  if (count < 0 || !Number.isInteger(count)) {
    throw new RangeError('count must be a non-negative integer');
  }
  if (count === 0) {
    return 'No selection';
  }
  return count === 1 ? '1 selected' : `${count} selected`;
}

/** Canvas pan/zoom (Viewport.pixelsPerUnit, @arq/geometry-2d) expressed as a percentage - the editor's own zoom, distinct from browser page zoom (section 126). */
export function formatViewScale(pixelsPerUnit: number): string {
  if (!Number.isFinite(pixelsPerUnit) || pixelsPerUnit <= 0) {
    throw new RangeError('pixelsPerUnit must be a positive finite number');
  }
  return `${Math.round(pixelsPerUnit * 100)}%`;
}

export interface ModelHealthSummary {
  readonly errorCount: number;
  readonly warningCount: number;
}

/** Section 139 ("Model warnings"): a written summary, never a colour-only badge. */
export function formatModelHealth(summary: ModelHealthSummary): string {
  if (summary.errorCount === 0 && summary.warningCount === 0) {
    return 'No issues';
  }
  const parts: string[] = [];
  if (summary.errorCount > 0) {
    parts.push(`${summary.errorCount} error${summary.errorCount === 1 ? '' : 's'}`);
  }
  if (summary.warningCount > 0) {
    parts.push(`${summary.warningCount} warning${summary.warningCount === 1 ? '' : 's'}`);
  }
  return parts.join(', ');
}

/** null when support mode is off (the common case) - no warning text to show at all, not an empty-but-present one. */
export function formatPerformanceWarning(supportModeEnabled: boolean): string | null {
  return supportModeEnabled ? 'Support mode: performance may be reduced' : null;
}
