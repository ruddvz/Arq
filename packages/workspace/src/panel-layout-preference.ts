import {
  COLLAPSIBLE_PANEL_IDS,
  clampPanelWidth,
  type CollapsiblePanelId,
  type PanelLayoutState,
} from './panel-layout-state';

export const PANEL_LAYOUT_PREFERENCE_VERSION = 1 as const;
export const PANEL_LAYOUT_PREFERENCE_STORAGE_KEY = 'arq.workspace.panel-layout.v1';

export interface PanelLayoutPreferenceEntry {
  readonly widthPx: number;
  readonly dockedPreferenceOpen: boolean;
  readonly collapsedPreference: boolean;
}

export interface PanelLayoutPreference {
  readonly version: typeof PANEL_LAYOUT_PREFERENCE_VERSION;
  readonly panels: Readonly<Record<CollapsiblePanelId, PanelLayoutPreferenceEntry>>;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStoredPreference(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function panelLayoutPreferenceFromState(state: PanelLayoutState): PanelLayoutPreference {
  return {
    version: PANEL_LAYOUT_PREFERENCE_VERSION,
    panels: {
      'project-browser': {
        widthPx: state['project-browser'].widthPx,
        dockedPreferenceOpen: state['project-browser'].dockedPreferenceOpen,
        collapsedPreference: state['project-browser'].collapsedPreference,
      },
      inspector: {
        widthPx: state.inspector.widthPx,
        dockedPreferenceOpen: state.inspector.dockedPreferenceOpen,
        collapsedPreference: state.inspector.collapsedPreference,
      },
    },
  };
}

export function serializePanelLayoutPreference(state: PanelLayoutState): string {
  return JSON.stringify(panelLayoutPreferenceFromState(state));
}

/**
 * Restores only durable user preferences.
 *
 * `open` and `mode` are deliberately not persisted because responsive
 * reconciliation owns them. A panel may be an overlay merely because the
 * viewport is narrow; restoring that transient mode on a desktop would turn a
 * responsive decision into a user preference. Call `reconcileDockedPanels`
 * after restoration for the current viewport.
 *
 * Invalid JSON, unknown versions and malformed fields recover per field to the
 * caller-provided state. This function has no storage side effects and can be
 * used with localStorage, IndexedDB or a future settings provider without
 * moving presentation state into the `.arq` project model.
 */
export function restorePanelLayoutPreference(
  state: PanelLayoutState,
  storedValue: unknown,
): PanelLayoutState {
  const parsed = parseStoredPreference(storedValue);
  if (!isRecord(parsed) || parsed.version !== PANEL_LAYOUT_PREFERENCE_VERSION) {
    return state;
  }
  const storedPanels = isRecord(parsed.panels) ? parsed.panels : null;
  if (storedPanels === null) {
    return state;
  }

  return COLLAPSIBLE_PANEL_IDS.reduce((next, panel) => {
    const candidate = storedPanels[panel];
    if (!isRecord(candidate)) {
      return next;
    }

    const current = next[panel];
    const rawWidth = candidate.widthPx;
    const widthPx =
      typeof rawWidth === 'number' && Number.isFinite(rawWidth)
        ? clampPanelWidth(panel, rawWidth)
        : current.widthPx;
    const dockedPreferenceOpen =
      typeof candidate.dockedPreferenceOpen === 'boolean'
        ? candidate.dockedPreferenceOpen
        : current.dockedPreferenceOpen;
    const collapsedPreference =
      typeof candidate.collapsedPreference === 'boolean'
        ? candidate.collapsedPreference
        : current.collapsedPreference;

    if (
      widthPx === current.widthPx &&
      dockedPreferenceOpen === current.dockedPreferenceOpen &&
      collapsedPreference === current.collapsedPreference
    ) {
      return next;
    }

    return {
      ...next,
      [panel]: {
        ...current,
        widthPx,
        dockedPreferenceOpen,
        collapsedPreference,
      },
    };
  }, state);
}
