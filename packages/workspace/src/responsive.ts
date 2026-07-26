/**
 * Doc 46 ("Device Adaptation") and Package 3.0's `workspace-responsive.ts`
 * reference contract.
 *
 * The reference contract's own closing comment is the rule this module exists
 * to keep: "Device names are presentation guidance only. Layout selection is
 * content/pointer capability driven." Nothing here reads a user-agent string.
 * `'tablet-landscape'` is a *name for a band* - coarse pointer, under 1280 CSS
 * px - and an iPad in a desktop-width external display, or a touchscreen
 * laptop, lands wherever its width and pointer say it lands.
 *
 * Doc 46's hard rule, and the reason `'phone'` is a separate band rather than
 * "desktop but narrower": "Never shrink desktop three-column UI onto a phone."
 */

import { LAYOUT_SLOTS, type LayoutSlotContract } from './registry';
import type { WorkspacePlatform } from './workspace-types';

export interface ViewportProbe {
  readonly widthPx: number;
  readonly heightPx: number;
  /** `(pointer: coarse)`. Touch/Pencil primary input, not "is a tablet". */
  readonly coarsePointer: boolean;
}

/**
 * Verbatim thresholds from Package 3.0 `workspace-responsive.ts`. Kept as
 * named constants rather than inline numbers so the registry-comparison test
 * can assert them against `workspace-layout-slots.json`'s viewports.
 */
export const PHONE_MAX_WIDTH_PX = 600;
export const TABLET_PORTRAIT_MAX_WIDTH_PX = 900;
export const TABLET_LANDSCAPE_MAX_WIDTH_PX = 1280;
export const COMPACT_DESKTOP_MAX_WIDTH_PX = 1200;

export function resolveWorkspacePlatform(probe: ViewportProbe): WorkspacePlatform {
  const { widthPx, heightPx, coarsePointer } = probe;
  if (widthPx < PHONE_MAX_WIDTH_PX) {
    return 'phone';
  }
  if (coarsePointer && widthPx < TABLET_PORTRAIT_MAX_WIDTH_PX && heightPx >= widthPx) {
    return 'tablet-portrait';
  }
  if (coarsePointer && widthPx < TABLET_LANDSCAPE_MAX_WIDTH_PX) {
    return 'tablet-landscape';
  }
  if (widthPx < COMPACT_DESKTOP_MAX_WIDTH_PX) {
    return 'compact-desktop';
  }
  return 'desktop';
}

/**
 * Maps a platform band onto a `workspace-layout-slots.json` entry. Desktop
 * picks between the 1536 and 1920 slot sets by width because doc 36 gives them
 * different panel widths and a different canvas minimum (620 vs 900), not
 * merely different scale.
 */
export function resolveLayoutSlotId(platform: WorkspacePlatform, widthPx: number): string {
  switch (platform) {
    case 'desktop':
      return widthPx >= 1920 ? 'wide1920' : 'desktop1536';
    case 'compact-desktop':
      return widthPx >= 1200 ? 'compact1366' : 'desktop1024';
    case 'tablet-landscape':
      return 'ipadLandscape1194x834';
    case 'tablet-portrait':
      return 'ipadPortrait834x1194';
    case 'phone':
      return 'iphone393x852';
  }
}

export function resolveLayoutSlots(probe: ViewportProbe): LayoutSlotContract {
  const platform = resolveWorkspacePlatform(probe);
  const id = resolveLayoutSlotId(platform, probe.widthPx);
  const slots = LAYOUT_SLOTS[id];
  if (slots === undefined) {
    // Unreachable while resolveLayoutSlotId only returns registry keys; the
    // registry-integrity test asserts that, so this throw is a genuine
    // "registry and code disagree" signal rather than a runtime fallback that
    // would silently ship a wrong layout.
    throw new Error(`workspace-layout-slots.json has no layout "${id}"`);
  }
  return slots;
}

/**
 * How many side panels a platform band may dock, from doc 46 ("Device
 * Adaptation") and `workspace-layout-slots.json`'s per-layout rules.
 *
 * - `'dock-both'` - doc 36's desktop composition.
 * - `'dock-left-only'` - the 1024 slot set's rule: "Only one secondary side
 *   panel docked; canvas first."
 * - `'drawers-only'` - every touch band. iPad landscape is "canvas first;
 *   browser and inspector are transient drawers"; iPad portrait is "No left+
 *   right desktop columns. Browser and inspector are sheets"; phone is "One
 *   primary task at a time... never squeezed side by side."
 *
 * This is a separate decision from the canvas floor because the touch layouts
 * declare no `canvasMinWidth` at all - they have nothing for a floor to
 * measure, since docked columns are not how they are composed in the first
 * place. Reading the absence of a floor as "nothing to reconcile" is what let a
 * 834px iPad render two docked columns and a zero-width canvas.
 */
export type PanelDockingPolicy = 'dock-both' | 'dock-left-only' | 'drawers-only';

export function panelDockingPolicy(platform: WorkspacePlatform): PanelDockingPolicy {
  switch (platform) {
    case 'desktop':
      return 'dock-both';
    case 'compact-desktop':
      return 'dock-left-only';
    case 'tablet-landscape':
    case 'tablet-portrait':
    case 'phone':
      return 'drawers-only';
  }
}

export interface CanvasWidthInput {
  readonly viewportWidthPx: number;
  readonly slots: LayoutSlotContract;
  readonly leftPanelOpen: boolean;
  readonly rightPanelOpen: boolean;
  readonly leftPanelWidthPx: number;
  readonly rightPanelWidthPx: number;
  /**
   * Combined width of the mode and tool rails *as the host actually renders
   * them*. Defaults to the registry's `modeRail + toolRail`.
   *
   * The override exists because the two numbers genuinely differ in this
   * repository: `workspace-layout-slots.json` specifies a 48 px icon tool rail,
   * while the repository's `ToolRail` is a 200 px text-labelled rail (a
   * deliberate choice - `design/icons/svg/` has no category glyphs, and
   * blueprint section 174 warns that a generic invented icon is worse than a
   * clear word). Feeding the registry number into a floor calculation about the
   * *rendered* layout would make it optimistic by ~150 px, so the floor could
   * fail to fire while the canvas was already below its minimum. A layout rule
   * has to measure the layout that exists.
   */
  readonly railsWidthPx?: number;
}

/** The registry's own rail allowance, used when a host does not override it. */
export function registryRailsWidthPx(slots: LayoutSlotContract): number {
  return (slots.modeRail ?? 0) + (slots.toolRail ?? 0);
}

/**
 * Doc 36: "Canvas should not fall below 620 px on a 1536 layout. Before that
 * happens, turn the Inspector into an overlay." The rule is a *layout
 * decision*, so it is computed here from real widths rather than hard-coded per
 * breakpoint - a user who has dragged the browser panel out to its 384 px
 * maximum hits the floor at a wider viewport than one who left it at 268 px,
 * and only measuring catches that.
 */
export function availableCanvasWidthPx(input: CanvasWidthInput): number {
  const rails = input.railsWidthPx ?? registryRailsWidthPx(input.slots);
  const left = input.leftPanelOpen ? input.leftPanelWidthPx : 0;
  const right = input.rightPanelOpen ? input.rightPanelWidthPx : 0;
  return input.viewportWidthPx - rails - left - right;
}

export type PanelOverflowRelief = 'none' | 'float-right-panel' | 'float-both-panels';

/**
 * Returns which docked panels must become overlays for the canvas to keep its
 * registry minimum. Doc 36 and `workspace-layout-slots.json` >
 * `compact1366.collapsePriority` both put the Inspector first, so the right
 * panel floats before the Project Browser does: the browser is *navigation*
 * and losing it costs the user their place in the project, while the inspector
 * is *about the current selection* and can be summoned back from it.
 *
 * Returns `'none'` when the layout declares no `canvasMinWidth` - the tablet
 * and phone layouts do not, because there the panels are already drawers and
 * sheets rather than docked columns.
 */
export function resolvePanelOverflowRelief(input: CanvasWidthInput): PanelOverflowRelief {
  const minimum = input.slots.canvasMinWidth;
  if (minimum === undefined) {
    return 'none';
  }
  if (availableCanvasWidthPx(input) >= minimum) {
    return 'none';
  }
  const withoutRight = availableCanvasWidthPx({ ...input, rightPanelOpen: false });
  if (withoutRight >= minimum) {
    return 'float-right-panel';
  }
  return 'float-both-panels';
}
