/**
 * Doc 36 ("Editor Shell Master Layout"), doc 39/40 (browser and inspector) and
 * `workspace-panel-registry.json`.
 *
 * Doc 33 > "What never happens implicitly": "Hiding a panel does not hide model
 * geometry." Nothing in this module knows what geometry is, which is how that
 * holds: a panel's state is presentation-only and no reducer here can reach the
 * model or commit project data.
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

/** Panels that have persistent desktop edges and therefore a collapsed rail. */
export type CollapsiblePanelId = 'project-browser' | 'inspector';

export const COLLAPSIBLE_PANEL_IDS: readonly CollapsiblePanelId[] = [
  'project-browser',
  'inspector',
];

export type PanelDockSide = 'left' | 'right';

/** `workspace-state-machines.json` > `machines.panel`. */
export type PanelPresentation = 'docked' | 'collapsed' | 'overlay';

export interface PanelState {
  readonly open: boolean;
  readonly mode: PanelPresentation;
  /** Last expanded width. Collapse never overwrites it, so reopen is lossless. */
  readonly widthPx: number;
  /**
   * What the user last chose on a *docking* band.
   *
   * Touch bands close both primary panels because they are transient drawers or
   * sheets. That closure is a presentation decision made by the band, not by
   * the user, so it must not become the user's preference.
   */
  readonly dockedPreferenceOpen: boolean;
  /**
   * The user's explicit collapsed/expanded preference on docking bands.
   *
   * `mode` cannot carry this preference by itself because responsive
   * reconciliation legitimately changes `mode` to `overlay`. Keeping the user
   * preference separate lets a desktop -> tablet -> desktop round trip restore
   * the collapsed rail instead of silently expanding the panel.
   */
  readonly collapsedPreference: boolean;
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

export function isCollapsiblePanel(panel: PanelId): panel is CollapsiblePanelId {
  return panel === 'project-browser' || panel === 'inspector';
}

export function panelDockSide(panel: CollapsiblePanelId): PanelDockSide {
  return panel === 'project-browser' ? 'left' : 'right';
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
    dockedPreferenceOpen: true,
    collapsedPreference: false,
  },
  inspector: {
    open: true,
    mode: 'docked',
    widthPx: panelWidthBounds('inspector').defaultWidth,
    dockedPreferenceOpen: true,
    collapsedPreference: false,
  },
  review: {
    open: false,
    mode: 'overlay',
    widthPx: panelWidthBounds('review').defaultWidth,
    dockedPreferenceOpen: false,
    collapsedPreference: false,
  },
  ai: {
    open: false,
    mode: 'overlay',
    widthPx: panelWidthBounds('ai').defaultWidth,
    dockedPreferenceOpen: false,
    collapsedPreference: false,
  },
  diagnostics: {
    open: false,
    mode: 'overlay',
    widthPx: panelWidthBounds('diagnostics').defaultWidth,
    dockedPreferenceOpen: false,
    collapsedPreference: false,
  },
  tasks: {
    open: false,
    mode: 'overlay',
    widthPx: panelWidthBounds('tasks').defaultWidth,
    dockedPreferenceOpen: false,
    collapsedPreference: false,
  },
});

/**
 * A *user* opening or closing a panel. Records the docking preference too,
 * which is what separates this from the band-driven close in
 * `reconcileDockedPanels` - only one of the two is the user's opinion.
 */
export function togglePanel(state: PanelLayoutState, panel: PanelId): PanelLayoutState {
  const current = state[panel];
  const open = !current.open;
  return { ...state, [panel]: { ...current, open, dockedPreferenceOpen: open } };
}

export function setPanelOpen(
  state: PanelLayoutState,
  panel: PanelId,
  open: boolean,
): PanelLayoutState {
  const current = state[panel];
  return current.open === open && current.dockedPreferenceOpen === open
    ? state
    : { ...state, [panel]: { ...current, open, dockedPreferenceOpen: open } };
}

/**
 * Explicit user collapse. The expanded width is intentionally untouched and
 * the panel remains logically open, so its mounted content can keep local form,
 * selection and tab state while the shell presents only the reopen rail.
 */
export function collapsePanel(
  state: PanelLayoutState,
  panel: CollapsiblePanelId,
): PanelLayoutState {
  const current = state[panel];
  if (
    current.open &&
    current.mode === 'collapsed' &&
    current.dockedPreferenceOpen &&
    current.collapsedPreference
  ) {
    return state;
  }
  return {
    ...state,
    [panel]: {
      ...current,
      open: true,
      mode: 'collapsed',
      dockedPreferenceOpen: true,
      collapsedPreference: true,
    },
  };
}

/**
 * Explicit user reopen. Responsive reconciliation may subsequently choose an
 * overlay when the canvas floor requires it, but the user's collapsed
 * preference is cleared and the previous expanded width is retained.
 */
export function reopenPanel(
  state: PanelLayoutState,
  panel: CollapsiblePanelId,
): PanelLayoutState {
  const current = state[panel];
  if (
    current.open &&
    current.mode === 'docked' &&
    current.dockedPreferenceOpen &&
    !current.collapsedPreference
  ) {
    return state;
  }
  return {
    ...state,
    [panel]: {
      ...current,
      open: true,
      mode: 'docked',
      dockedPreferenceOpen: true,
      collapsedPreference: false,
    },
  };
}

/**
 * Closes a panel *because the band demands it*, leaving user preferences
 * untouched so returning to a docking band can restore them.
 */
function setPanelOpenForBand(
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPanelPresentation(value: unknown): value is PanelPresentation {
  return value === 'docked' || value === 'collapsed' || value === 'overlay';
}

/**
 * Defensive boundary for any existing or future presentation-preference
 * provider. This function does not read or write storage. It only prevents
 * malformed/stale values from escaping into shell layout state.
 */
export function normalizePanelLayoutState(value: unknown): PanelLayoutState {
  const source = isRecord(value) ? value : {};
  const entries = PANEL_IDS.map((panel) => {
    const fallback = INITIAL_PANEL_LAYOUT_STATE[panel];
    const candidate = isRecord(source[panel]) ? source[panel] : {};
    const open = typeof candidate.open === 'boolean' ? candidate.open : fallback.open;
    const dockedPreferenceOpen =
      typeof candidate.dockedPreferenceOpen === 'boolean'
        ? candidate.dockedPreferenceOpen
        : open;
    const rawWidth = candidate.widthPx;
    const widthPx =
      typeof rawWidth === 'number' && Number.isFinite(rawWidth)
        ? clampPanelWidth(panel, rawWidth)
        : fallback.widthPx;

    let mode = isPanelPresentation(candidate.mode) ? candidate.mode : fallback.mode;
    let collapsedPreference = false;
    if (isCollapsiblePanel(panel)) {
      collapsedPreference =
        typeof candidate.collapsedPreference === 'boolean'
          ? candidate.collapsedPreference
          : mode === 'collapsed';
      if (mode === 'collapsed') {
        collapsedPreference = true;
      }
    } else if (mode === 'collapsed') {
      // Secondary panels have no collapsed rail. Old or corrupt preference data
      // must not manufacture an unreachable state.
      mode = 'overlay';
    }

    return [
      panel,
      { open, mode, widthPx, dockedPreferenceOpen, collapsedPreference } satisfies PanelState,
    ] as const;
  });

  return Object.fromEntries(entries) as PanelLayoutState;
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
  /**
   * How the band presents its side panels.
   *
   * `'docked'` is the historical behaviour and the default: a panel takes width
   * from the canvas and shares an edge with it. `'floating'` is the canvas-first
   * composition, where the drawing runs the full width of the workspace and the
   * panels rest on top of it.
   *
   * This is a presentation choice rather than an overflow response, which is
   * why it is an input and not something `resolvePanelOverflowRelief` could
   * decide: the relief logic floats panels because they no longer *fit*, and a
   * floating composition floats them because that is the design even when there
   * is room to spare.
   */
  readonly composition?: 'docked' | 'floating';
}

/**
 * Responsive presentation may float a panel, but it must never overwrite an
 * explicit collapsed preference. This helper is deliberately private so only
 * the user reducers above can change that preference.
 */
function setResponsivePresentation(
  state: PanelLayoutState,
  panel: CollapsiblePanelId,
  mode: Exclude<PanelPresentation, 'collapsed'>,
): PanelLayoutState {
  const current = state[panel];
  return current.open && current.collapsedPreference
    ? setPanelPresentation(state, panel, 'collapsed')
    : setPanelPresentation(state, panel, mode);
}

/**
 * Applies doc 46's per-band docking policy, then doc 36's canvas floor:
 * "Canvas should not fall below 620 px on a 1536 layout. Before that happens,
 * turn the Inspector into an overlay."
 *
 * On the docking bands expanded panels are *floated*, never closed. A collapsed
 * panel remains collapsed because that state is an explicit user choice and
 * consumes no expanded panel width.
 *
 * On touch bands the primary panels are closed and presented by drawers/sheets.
 * Their open and collapsed preferences are retained. Returning to a docking
 * band therefore restores exactly what the user chose instead of treating a
 * responsive transition as an edit to panel preferences.
 */
export function reconcileDockedPanels(
  state: PanelLayoutState,
  input: DockedLayoutInput,
): PanelLayoutState {
  const policy = panelDockingPolicy(input.platform);

  if (policy === 'drawers-only') {
    return COLLAPSIBLE_PANEL_IDS.reduce(
      (next, panel) =>
        setPanelOpenForBand(setPanelPresentation(next, panel, 'overlay'), panel, false),
      state,
    );
  }

  // Back on a docking band: restore what the user last chose, not what the
  // touch band imposed on the way through.
  state = COLLAPSIBLE_PANEL_IDS.reduce(
    (next, panel) => setPanelOpenForBand(next, panel, next[panel].dockedPreferenceOpen),
    state,
  );

  /*
   * A canvas-first band floats expanded panels regardless of room. A collapsed
   * rail is a user preference, not an overflow response, so it stays collapsed.
   */
  if (input.composition === 'floating') {
    return setResponsivePresentation(
      setResponsivePresentation(state, 'inspector', 'overlay'),
      'project-browser',
      'overlay',
    );
  }

  const probe: CanvasWidthInput = {
    viewportWidthPx: input.viewportWidthPx,
    slots: input.slots,
    // Collapsed rails are presentation chrome, not expanded panel widths. They
    // must not trick the canvas-floor calculation into floating another panel.
    leftPanelOpen: state['project-browser'].open && !state['project-browser'].collapsedPreference,
    rightPanelOpen: state.inspector.open && !state.inspector.collapsedPreference,
    leftPanelWidthPx: state['project-browser'].widthPx,
    rightPanelWidthPx: state.inspector.widthPx,
    ...(input.railsWidthPx === undefined ? {} : { railsWidthPx: input.railsWidthPx }),
  };

  // The 1024 slot set's own rule: "Only one secondary side panel docked; canvas
  // first." The browser keeps the dock because losing it costs the user their
  // place in the project, while the inspector can be summoned back from it.
  if (policy === 'dock-left-only' || input.slots.rightPanel === 'overlay') {
    return setResponsivePresentation(
      setResponsivePresentation(state, 'inspector', 'overlay'),
      'project-browser',
      'docked',
    );
  }

  switch (resolvePanelOverflowRelief(probe)) {
    case 'none':
      return setResponsivePresentation(
        setResponsivePresentation(state, 'inspector', 'docked'),
        'project-browser',
        'docked',
      );
    case 'float-right-panel':
      return setResponsivePresentation(
        setResponsivePresentation(state, 'inspector', 'overlay'),
        'project-browser',
        'docked',
      );
    case 'float-both-panels':
      return setResponsivePresentation(
        setResponsivePresentation(state, 'inspector', 'overlay'),
        'project-browser',
        'overlay',
      );
  }
}

/** True when the panel takes expanded width from the canvas rather than floating or collapsing. */
export function occupiesLayoutWidth(state: PanelLayoutState, panel: PanelId): boolean {
  const panelState = state[panel];
  return panelState.open && panelState.mode === 'docked';
}
