import { describe, expect, it } from 'vitest';
import {
  BROWSER_SECTION_LABELS,
  FIXED_BROWSER_SECTIONS,
  INITIAL_BROWSER_PANEL_STATE,
  browserSectionsForMode,
  defaultBrowserSection,
  reconcileBrowserSection,
  registryBrowserTabs,
  selectBrowserSection,
} from './browser-panel-state';
import { WORKSPACE_MODES } from './workspace-types';

describe('FIXED_BROWSER_SECTIONS', () => {
  it('matches the panel registry tabs exactly, in order', () => {
    expect(FIXED_BROWSER_SECTIONS.map((s) => BROWSER_SECTION_LABELS[s])).toEqual(
      registryBrowserTabs(),
    );
  });
});

describe('browserSectionsForMode', () => {
  /**
   * Doc 39: Review "can add Issues contextually, but should not permanently
   * overload the browser for every user".
   */
  it('adds Issues only in Review mode, and only with the capability', () => {
    expect(browserSectionsForMode('review', true)).toContain('issues');
    expect(browserSectionsForMode('review', false)).not.toContain('issues');
    for (const mode of WORKSPACE_MODES.filter((m) => m !== 'review')) {
      expect(browserSectionsForMode(mode, true)).not.toContain('issues');
    }
  });

  it('always offers the four registry sections', () => {
    for (const mode of WORKSPACE_MODES) {
      for (const section of FIXED_BROWSER_SECTIONS) {
        expect(browserSectionsForMode(mode, true)).toContain(section);
      }
    }
  });
});

describe('defaultBrowserSection', () => {
  it('leads with the section each mode is about', () => {
    expect(defaultBrowserSection('design')).toBe('project');
    expect(defaultBrowserSection('inspect')).toBe('project');
    expect(defaultBrowserSection('document')).toBe('documents');
    expect(defaultBrowserSection('review')).toBe('issues');
    expect(defaultBrowserSection('present')).toBe('views');
  });
});

describe('reconcileBrowserSection', () => {
  it('follows the mode default until the user chooses', () => {
    let state = INITIAL_BROWSER_PANEL_STATE;
    state = reconcileBrowserSection(state, 'document', true);
    expect(state.section).toBe('documents');
    state = reconcileBrowserSection(state, 'design', true);
    expect(state.section).toBe('project');
  });

  /** Doc 34's rule: preserve the user's manual selection during the session. */
  it('respects a user choice across mode switches', () => {
    const chosen = selectBrowserSection(INITIAL_BROWSER_PANEL_STATE, 'files');
    const afterSwitch = reconcileBrowserSection(chosen, 'document', true);
    expect(afterSwitch.section).toBe('files');
    expect(afterSwitch).toBe(chosen);
  });

  /**
   * A choice that no longer exists cannot be honoured - showing an empty panel
   * would be worse than falling back.
   */
  it('falls back when the chosen section is unavailable in the new mode', () => {
    const chosen = selectBrowserSection(INITIAL_BROWSER_PANEL_STATE, 'issues');
    const afterSwitch = reconcileBrowserSection(chosen, 'design', true);
    expect(afterSwitch.section).toBe('project');
    expect(afterSwitch.userChose).toBe(false);
  });

  it('falls back to project when review capability removes the default', () => {
    // Review mode defaults to Issues, but with collaboration off it does not exist.
    const state = reconcileBrowserSection(INITIAL_BROWSER_PANEL_STATE, 'review', false);
    expect(state.section).toBe('project');
  });

  it('is stable when nothing needs to change', () => {
    const state = reconcileBrowserSection(INITIAL_BROWSER_PANEL_STATE, 'design', true);
    expect(reconcileBrowserSection(state, 'design', true)).toBe(state);
  });
});

describe('selectBrowserSection', () => {
  it('records that the choice was the user’s', () => {
    const state = selectBrowserSection(INITIAL_BROWSER_PANEL_STATE, 'views');
    expect(state).toEqual({ section: 'views', userChose: true });
  });
});
