/**
 * Doc 46 ("Device Adaptation") and doc 47 ("Phone Workspace") — the transient
 * presentations that replace docked columns on touch.
 *
 * `reconcileDockedPanels` closes the browser and inspector on every
 * `'drawers-only'` band, which is correct (doc 46 calls them "transient
 * drawers" and "sheets") but only half a design: a panel the user cannot summon
 * back is a panel that does not exist. This module is the other half.
 *
 * Detents rather than a boolean because doc 47 is specific about the inspector:
 * "Detents: peek, half, full. Peek shows selection identity + 2-3 highest-value
 * properties." A peeking inspector that still shows the canvas is the whole
 * reason the phone composition works at all, and it cannot be expressed as
 * open/closed.
 */

import { LAYOUT_SLOTS } from './registry';
import type { PanelId } from './panel-layout-state';
import type { WorkspacePlatform } from './workspace-types';

/** Doc 47: "Detents: peek, half, full." */
export type SheetDetent = 'closed' | 'peek' | 'half' | 'full';

export const SHEET_DETENT_ORDER: readonly SheetDetent[] = ['closed', 'peek', 'half', 'full'];

/**
 * What the phone bottom dock can raise. Doc 47's dock is "Select, Tools, View,
 * Review, More" — `select` is a tool activation rather than a sheet, so only
 * the four that open something are modelled here.
 */
export type SheetId = 'tools' | 'view-switcher' | 'project-browser' | 'inspector' | 'review';

export const SHEET_IDS: readonly SheetId[] = [
  'tools',
  'view-switcher',
  'project-browser',
  'inspector',
  'review',
];

export interface SheetState {
  /**
   * Doc 47: "One primary task at a time." Exactly one sheet is raised, so this
   * is a single id rather than a set — two half-open sheets on a 393px phone is
   * the squeezed-desktop failure doc 46 forbids, wearing a different hat.
   */
  readonly openSheet: SheetId | null;
  readonly detent: SheetDetent;
}

export const CLOSED_SHEET_STATE: SheetState = Object.freeze({ openSheet: null, detent: 'closed' });

/**
 * The detent a sheet opens at. The inspector peeks so the canvas stays visible
 * behind the selection identity (doc 47); everything else opens at half, since
 * a peeking tool list or view switcher shows nothing useful.
 */
export function initialDetentFor(sheet: SheetId): Exclude<SheetDetent, 'closed'> {
  return sheet === 'inspector' ? 'peek' : 'half';
}

export function openSheet(state: SheetState, sheet: SheetId): SheetState {
  if (state.openSheet === sheet) {
    return state;
  }
  return { openSheet: sheet, detent: initialDetentFor(sheet) };
}

export function closeSheet(): SheetState {
  return CLOSED_SHEET_STATE;
}

/** Tapping the dock control of the already-open sheet dismisses it. */
export function toggleSheet(state: SheetState, sheet: SheetId): SheetState {
  return state.openSheet === sheet ? CLOSED_SHEET_STATE : openSheet(state, sheet);
}

/**
 * Moves between detents. Dragging below `peek` dismisses, which is the gesture
 * every sheet on both platforms already teaches; there is no separate close
 * affordance to hunt for.
 */
export function setDetent(state: SheetState, detent: SheetDetent): SheetState {
  if (state.openSheet === null) {
    return state;
  }
  return detent === 'closed' ? CLOSED_SHEET_STATE : { ...state, detent };
}

export function expandSheet(state: SheetState): SheetState {
  const index = SHEET_DETENT_ORDER.indexOf(state.detent);
  const next = SHEET_DETENT_ORDER[Math.min(index + 1, SHEET_DETENT_ORDER.length - 1)];
  return next === undefined ? state : setDetent(state, next);
}

export function collapseSheet(state: SheetState): SheetState {
  const index = SHEET_DETENT_ORDER.indexOf(state.detent);
  const next = SHEET_DETENT_ORDER[Math.max(index - 1, 0)];
  return next === undefined ? state : setDetent(state, next);
}

/**
 * Doc 47 > Gestures: "system back closes overlays first." Returns the state
 * after a back gesture, and whether the gesture was consumed — an unconsumed
 * back must be allowed to reach the browser's own history, or an Android user
 * is trapped in the workspace.
 */
export function handleSystemBack(state: SheetState): {
  readonly state: SheetState;
  readonly consumed: boolean;
} {
  if (state.openSheet === null) {
    return { state, consumed: false };
  }
  return { state: CLOSED_SHEET_STATE, consumed: true };
}

/**
 * The detent a drag should settle on, given the height the user has dragged
 * the sheet to. Doc 47 lists a drag gesture; this is the "which detent did they
 * mean" half of it, kept here rather than in the component so it is testable
 * without a pointer.
 *
 * Nearest-detent rather than direction-based, because a drag that overshoots
 * and comes back should land where the sheet visibly *is*, not where the
 * gesture started. Dragging below the peek height by more than half its own
 * height dismisses - the same "drag it away" gesture every sheet already
 * teaches, and the reason `'closed'` is in the returned union.
 */
export function detentForDraggedHeight(
  platform: WorkspacePlatform,
  draggedHeightPx: number,
  viewportHeightPx: number,
): SheetDetent {
  const candidates: readonly Exclude<SheetDetent, 'closed'>[] = ['peek', 'half', 'full'];
  const peekHeight = sheetHeightPx(platform, 'peek', viewportHeightPx);
  if (draggedHeightPx < peekHeight / 2) {
    return 'closed';
  }
  let best: SheetDetent = 'peek';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = Math.abs(
      sheetHeightPx(platform, candidate, viewportHeightPx) - draggedHeightPx,
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/**
 * Sheet height in CSS px for a detent, from the layout registry's own
 * `sheetDetents` / `bottomInspectorDetents` arrays. Falls back to fractions of
 * the viewport when a layout declares none (the landscape tablet, whose panels
 * are side drawers rather than bottom sheets).
 */
export function sheetHeightPx(
  platform: WorkspacePlatform,
  detent: SheetDetent,
  viewportHeightPx: number,
): number {
  if (detent === 'closed') {
    return 0;
  }
  const slots =
    platform === 'phone'
      ? LAYOUT_SLOTS.iphone393x852
      : platform === 'tablet-portrait'
        ? LAYOUT_SLOTS.ipadPortrait834x1194
        : undefined;
  const detents = slots?.sheetDetents ?? slots?.bottomInspectorDetents;
  const index = detent === 'peek' ? 0 : detent === 'half' ? 1 : 2;
  const registryHeight = detents?.[index];
  if (registryHeight !== undefined) {
    // Never taller than the viewport: the registry heights are authored against
    // a reference device, and a shorter window must not get a sheet it cannot
    // scroll out of.
    return Math.min(registryHeight, viewportHeightPx);
  }
  const fraction = detent === 'peek' ? 0.36 : detent === 'half' ? 0.68 : 0.92;
  return Math.round(viewportHeightPx * fraction);
}

/**
 * Which panel a sheet is showing, where one corresponds. `tools`,
 * `view-switcher` and `review` have no docked-panel equivalent — the first two
 * are phone-only compositions of the rails and tab strip, so they map to
 * nothing.
 */
export function panelForSheet(sheet: SheetId): PanelId | null {
  switch (sheet) {
    case 'project-browser':
      return 'project-browser';
    case 'inspector':
      return 'inspector';
    case 'review':
      return 'review';
    case 'tools':
    case 'view-switcher':
      return null;
  }
}
