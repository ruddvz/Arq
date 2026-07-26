/**
 * Doc 36 ("Editor Shell Master Layout"), doc 39/40 (browser and inspector) and
 * `workspace-panel-registry.json`.
 *
 * Doc 33 > "What never happens implicitly": "Hiding a panel does not hide model
 * geometry." Nothing in this module knows what geometry is, which is how that
 * holds: a panel's state is `open`/`mode`/`widthPx` and nothing else, and no
 * reducer here can reach the model.
 */

import { panelContract } from './registry';
import type { LayoutSlotContract } from './registry';
import {
  panelDockingPolicy,
  resolvePanelOverflowRelief,
  type CanvasWidthInput,
} from './responsive';
import type { WorkspacePlatform } from './workspace-types';

/** `workspace-panel-registry.json` > `panels[].id`, minus the `P-` prefix. */
export type PanelId = 'project-browser' | 'inspector' | 'review' | 'ai' | 'diagnostics' | 'tasks';

export const PANEL_IDS: readonly PanelId[] = [
  'project-browser',
  'inspector',
  'review',
  'ai',
  'diagnostics',
  'tasks',
];

/** `workspace-state-machines.json` > `machines.panel`. */
export type PanelPresentation = 'docked' | 'collapsed' | 'overlay';

export interface PanelState {
  readonly open: boolean;
  readonly mode: PanelPresentation;
  readonly widthPx: number;
}

export type PanelLayoutState = Readonly<Record<PanelId, PanelState>>;

/** Maps our short ids onto the registry's `P-`-prefixed ones. */
const REGISTRY_PANEL_IDS: Readonly<Record<PanelId, string>> = {
  'project-browser': 'P-left-browser',
  inspector: 'P-right-inspector',
  review: 'P-review',
  ai: 'P-ai',
  diagnostics: 'P-diagnostics',
  tasks: 'P-tasks',
};

export function registryPanelId(panel: PanelId): string {
  return REGISTRY_PANEL_IDS[panel];
}

export interface PanelWidthBounds {
  readonly defaultWidth: number;
  readonly min: number;
  readonly max: number;
}

/**
 * Width bounds come from the registry, not from component CSS. Panels the
 * registry gives no min/max (the task tray) collapse to a fixed width, which is
 * honest: an un-resizable panel should not advertise a drag handle.
 */
export function panelWidthBounds(panel: PanelId): PanelWidthBounds {
  const contract = panelContract(registryPanelId(panel));
  if (contract === null) {
    throw new Error(`workspace-panel-registry.json has no panel "${registryPanelId(panel)}"`);
  }
  const { defaultWidth, min, max } = contract.desktop;
  return {
    defaultWidth,
    min: min ?? defaultWidth,
    max: max ?? defaultWidth,
  };
}

export function clampPanelWidth(panel: PanelId, widthPx: number): number {
  const { min, max } = panelWidthBounds(panel);
  return Math.min(max, Math.max(min, widthPx));
}

/**
 * Doc 36: the browser and inspector are docked on desktop; every other panel is
 * an overlay that the user summons. Starting the secondary panels closed rather
 * than collapsed matters because "collapsed" implies a rail the user can see
 * and reopen, and there is no such rail for diagnostics or the task tray.
 */
export const INITIAL_PANEL_LAYOUT_STATE: PanelLayoutState = Object.freeze({
  'project-browser': {
    open: true,
    mode: 'docked',
    widthPx: panelWidthBounds('project-browser').defaultWidth,
  },
  inspector: { open: true, mode: 'docked', widthPx: panelWidthBounds('inspector').defaultWidth },
  review: { open: false, mode: 'overlay', widthPx: panelWidthBounds('review').defaultWidth },
  ai: { open: false, mode: 'overlay', widthPx: panelWidthBounds('ai').defaultWidth },
  diagnostics: {
    open: false,
    mode: 'overlay',
    widthPx: panelWidthBounds('diagnostics').defaultWidth,
  },
  tasks: { open: false, mode: 'overlay', widthPx: panelWidthBounds('tasks').defaultWidth },
});

export function togglePanel(state: PanelLayoutState, panel: PanelId): PanelLayoutState {
  const current = state[panel];
  return { ...state, [panel]: { ...current, open: !current.open } };
}

export function setPanelOpen(
  state: PanelLayoutState,
  panel: PanelId,
  open: boolean,
): PanelLayoutState {
  const current = state[panel];
  return current.open === open ? state : { ...state, [panel]: { ...current, open } };
}

export function setPanelPresentation(
  state: PanelLayoutState,
  panel: PanelId,
  mode: PanelPresentation,
): PanelLayoutState {
  const current = state[panel];
  return current.mode === mode ? state : { ...state, [panel]: { ...current, mode } };
}

export function resizePanel(
  state: PanelLayoutState,
  panel: PanelId,
  widthPx: number,
): PanelLayoutState {
  const clamped = clampPanelWidth(panel, widthPx);
  const current = state[panel];
  return current.widthPx === clamped
    ? state
    : { ...state, [panel]: { ...current, widthPx: clamped } };
}

export interface DockedLayoutInput {
  readonly viewportWidthPx: number;
  readonly slots: LayoutSlotContract;
  /**
   * Combined rendered width of the mode and tool rails. Passed through to
   * `availableCanvasWidthPx`; see `CanvasWidthInput.railsWidthPx` for why a
   * host's real rail width can differ from the registry's allowance and why
   * feeding the wrong one makes the canvas floor fail to fire.
   */
  readonly railsWidthPx?: number;
  /**
   * The platform band. Required, because the docking *policy* (how many columns
   * this band may have at all) has to be decided before the canvas floor (how
   * much room those columns may take), and the touch bands declare no floor.
   */
  readonly platform: WorkspacePlatform;
}

/**
 * Applies doc 46's per-band docking policy, then doc 36's canvas floor:
 * "Canvas should not fall below 620 px on a 1536 layout. Before that happens,
 * turn the Inspector into an overlay."
 *
 * On the docking bands the panels are *floated*, never closed. That distinction
 * is the whole point: the user asked for the inspector to be there, so on a
 * wider viewport - or after they drag the browser narrower - this docks it again
 * with the width they chose. Closing it would quietly discard an explicit
 * preference and make the window resize destructive.
 *
 * On the touch bands the panels are closed as well as floated, because doc 46
 * calls them "transient drawers" and "sheets": a drawer that is open before the
 * user asks for it is just a column with a shadow, and on an 834px iPad two of
 * them leave no canvas at all. This does mean a desktop user who drags their
 * window down through the tablet band and back finds the panels closed - a real
 * limitation, recorded in docs/design/WORKSPACE-3.0-INTEGRATION.md, and much
 * cheaper than the alternative of a squeezed three-column touch layout that doc
 * 46 forbids outright.
 */
export function reconcileDockedPanels(
  state: PanelLayoutState,
  input: DockedLayoutInput,
): PanelLayoutState {
  const policy = panelDockingPolicy(input.platform);

  if (policy === 'drawers-only') {
    const drawered = (['project-browser', 'inspector'] as const).reduce(
      (next, panel) => setPanelOpen(setPanelPresentation(next, panel, 'overlay'), panel, false),
      state,
    );
    return drawered;
  }

  const probe: CanvasWidthInput = {
    viewportWidthPx: input.viewportWidthPx,
    slots: input.slots,
    leftPanelOpen: state['project-browser'].open,
    rightPanelOpen: state.inspector.open,
    leftPanelWidthPx: state['project-browser'].widthPx,
    rightPanelWidthPx: state.inspector.widthPx,
    ...(input.railsWidthPx === undefined ? {} : { railsWidthPx: input.railsWidthPx }),
  };

  // The 1024 slot set's own rule: "Only one secondary side panel docked; canvas
  // first." The browser keeps the dock because losing it costs the user their
  // place in the project, while the inspector can be summoned back from it.
  if (policy === 'dock-left-only' || input.slots.rightPanel === 'overlay') {
    return setPanelPresentation(
      setPanelPresentation(state, 'inspector', 'overlay'),
      'project-browser',
      'docked',
    );
  }

  switch (resolvePanelOverflowRelief(probe)) {
    case 'none':
      return setPanelPresentation(
        setPanelPresentation(state, 'inspector', 'docked'),
        'project-browser',
        'docked',
      );
    case 'float-right-panel':
      return setPanelPresentation(
        setPanelPresentation(state, 'inspector', 'overlay'),
        'project-browser',
        'docked',
      );
    case 'float-both-panels':
      return setPanelPresentation(
        setPanelPresentation(state, 'inspector', 'overlay'),
        'project-browser',
        'overlay',
      );
  }
}

/** True when the panel takes width from the canvas rather than floating over it. */
export function occupiesLayoutWidth(state: PanelLayoutState, panel: PanelId): boolean {
  const panelState = state[panel];
  return panelState.open && panelState.mode === 'docked';
}
