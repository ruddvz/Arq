/**
 * Doc 39 ("Left Project Browser Panel") and `workspace-panel-registry.json` >
 * `P-left-browser.tabs`.
 *
 * The registry gives the left panel three stable sections — Views, Model,
 * Sheets — and doc 39's opening line is the reason they matter: "The left panel
 * is a browser, not a second command system." Named sections answer "where does
 * this thing live", which one undifferentiated tree does not.
 *
 * It gave four before: Project, Views, Documents and Files. The Version 12
 * reference names three, and the two that went were the two nothing filled —
 * Documents and Files both rendered "Nothing here yet" in every mode, so the
 * panel opened with half its tabs promising content that does not exist. What
 * was `project` is `model` now, which is what that section actually holds: the
 * building's walls, doors, windows and rooms.
 *
 * Doc 39 also allows Review to "add Issues contextually, but should not
 * permanently overload the browser for every user", so Issues is a *conditional
 * fourth* section rather than a fixed one — see `browserSectionsForMode`.
 */

import { panelContract } from './registry';
import type { WorkspaceMode } from './workspace-types';

export type BrowserSection = 'views' | 'model' | 'sheets' | 'issues';

/** The three the registry declares, in its order. */
export const FIXED_BROWSER_SECTIONS: readonly BrowserSection[] = ['views', 'model', 'sheets'];

export const BROWSER_SECTION_LABELS: Readonly<Record<BrowserSection, string>> = {
  views: 'Views',
  model: 'Model',
  sheets: 'Sheets',
  issues: 'Issues',
};

/** Doc 39's own one-line description of each section, for the tab's tooltip. */
export const BROWSER_SECTION_PURPOSE: Readonly<Record<BrowserSection, string>> = {
  views: 'Floor plans, 3D views, sections and elevations',
  model: 'Levels, walls, doors, windows and rooms',
  sheets: 'Sheets, schedules and reports',
  issues: 'Review items in the current context',
};

/**
 * Doc 39: Review mode may add Issues; no other mode does. Returning the list
 * per mode rather than showing all five always is what keeps the promise not to
 * "permanently overload the browser for every user".
 */
export function browserSectionsForMode(
  mode: WorkspaceMode,
  reviewCapabilityEnabled: boolean,
): readonly BrowserSection[] {
  if (mode === 'review' && reviewCapabilityEnabled) {
    return [...FIXED_BROWSER_SECTIONS, 'issues'];
  }
  return FIXED_BROWSER_SECTIONS;
}

/**
 * Doc 34: each mode leads with the section it is about. Design leads with the
 * project hierarchy, Document with sheets and schedules, Review with issues.
 *
 * This is a *default*, applied when the user has not chosen. Doc 34's rule for
 * the inspector — "preserving the user's manual selection during the session" —
 * applies here for the same reason: a panel that keeps re-deciding where the
 * user should be looking every time they switch mode is fighting them.
 */
export function defaultBrowserSection(mode: WorkspaceMode): BrowserSection {
  switch (mode) {
    case 'design':
    case 'inspect':
      /*
       * Views, not Model. Doc 34 says Design "leads with the project
       * hierarchy", and the counted elements are that hierarchy - but they are
       * not what a reader arrives needing. Opening a project, the first thing
       * you do is choose which drawing to look at, and the floor plans are
       * here. A panel that opens on "Walls 79" has answered a question nobody
       * asked yet.
       */
      return 'views';
    case 'document':
      return 'sheets';
    case 'review':
      return 'issues';
    case 'present':
      return 'views';
  }
}

export interface BrowserPanelState {
  readonly section: BrowserSection;
  /** True once the user has picked a section themselves. */
  readonly userChose: boolean;
}

export const INITIAL_BROWSER_PANEL_STATE: BrowserPanelState = Object.freeze({
  section: 'views',
  userChose: false,
});

export function selectBrowserSection(
  state: BrowserPanelState,
  section: BrowserSection,
): BrowserPanelState {
  return { section, userChose: true };
}

/**
 * Applies the mode's default section, unless the user has chosen one — or
 * unless their choice is not available in the new mode, in which case falling
 * back to the default beats showing an empty panel.
 */
export function reconcileBrowserSection(
  state: BrowserPanelState,
  mode: WorkspaceMode,
  reviewCapabilityEnabled: boolean,
): BrowserPanelState {
  const available = browserSectionsForMode(mode, reviewCapabilityEnabled);
  if (state.userChose && available.includes(state.section)) {
    return state;
  }
  const fallback = defaultBrowserSection(mode);
  // Last resort when even the mode's own default is unavailable. Views, for
  // the same reason it is the arrival default: it is the section that answers
  // "what can I look at", which is the question that survives any mode.
  const section = available.includes(fallback) ? fallback : 'views';
  return section === state.section && !state.userChose ? state : { section, userChose: false };
}

/** Exposed for the registry-integrity test. */
export function registryBrowserTabs(): readonly string[] {
  return panelContract('P-left-browser')?.tabs ?? [];
}
