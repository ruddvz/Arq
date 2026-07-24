/**
 * ARQ-030/ARQ-031: prototype iPad landscape/portrait shells.
 *
 * Blueprint section 13 ("iPad shell"): landscape has a "full-screen canvas
 * toggle"; portrait's inspector is "a resizable bottom sheet." Both are
 * simple two-state toggles here (`toggleFullScreenCanvas`,
 * `toggleBottomSheetExpanded`) - a real freeform drag-to-resize bottom
 * sheet is a distinct, larger gesture-handling feature (pointer tracking,
 * velocity/snap-point physics) that no other issue in this backlog has
 * built the input-gesture plumbing for yet; two states (collapsed enough to
 * see the canvas, expanded enough to work in the inspector) is the honest
 * "prototype" scope the issue title asks for, not the full resizable
 * gesture.
 */

export function toggleFullScreenCanvas(current: boolean): boolean {
  return !current;
}

export function toggleBottomSheetExpanded(current: boolean): boolean {
  return !current;
}
