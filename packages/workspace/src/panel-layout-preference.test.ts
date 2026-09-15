import { describe, expect, it } from 'vitest';
import {
  INITIAL_PANEL_LAYOUT_STATE,
  collapsePanel,
  resizePanel,
  setPanelOpen,
} from './panel-layout-state';
import {
  PANEL_LAYOUT_PREFERENCE_STORAGE_KEY,
  PANEL_LAYOUT_PREFERENCE_VERSION,
  panelLayoutPreferenceFromState,
  restorePanelLayoutPreference,
  serializePanelLayoutPreference,
} from './panel-layout-preference';

describe('panel layout preference persistence', () => {
  it('serializes only durable primary-panel preferences', () => {
    const state = collapsePanel(
      resizePanel(INITIAL_PANEL_LAYOUT_STATE, 'inspector', 400),
      'inspector',
    );
    const preference = panelLayoutPreferenceFromState(state);

    expect(PANEL_LAYOUT_PREFERENCE_STORAGE_KEY).toBe('arq.workspace.panel-layout.v1');
    expect(preference).toEqual({
      version: PANEL_LAYOUT_PREFERENCE_VERSION,
      panels: {
        'project-browser': {
          widthPx: INITIAL_PANEL_LAYOUT_STATE['project-browser'].widthPx,
          dockedPreferenceOpen: true,
          collapsedPreference: false,
        },
        inspector: {
          widthPx: 400,
          dockedPreferenceOpen: true,
          collapsedPreference: true,
        },
      },
    });
    expect(serializePanelLayoutPreference(state)).not.toContain('"mode"');
    expect(serializePanelLayoutPreference(state)).not.toContain('"open"');
  });

  it('restores preferences without overwriting transient presentation mode/open state', () => {
    const transient = {
      ...INITIAL_PANEL_LAYOUT_STATE,
      inspector: {
        ...INITIAL_PANEL_LAYOUT_STATE.inspector,
        open: false,
        mode: 'overlay' as const,
      },
    };

    const restored = restorePanelLayoutPreference(
      transient,
      JSON.stringify({
        version: PANEL_LAYOUT_PREFERENCE_VERSION,
        panels: {
          'project-browser': {
            widthPx: 300,
            dockedPreferenceOpen: false,
            collapsedPreference: true,
          },
          inspector: {
            widthPx: 390,
            dockedPreferenceOpen: true,
            collapsedPreference: true,
          },
        },
      }),
    );

    expect(restored['project-browser']).toMatchObject({
      widthPx: 300,
      dockedPreferenceOpen: false,
      collapsedPreference: true,
    });
    expect(restored.inspector).toMatchObject({
      open: false,
      mode: 'overlay',
      widthPx: 390,
      dockedPreferenceOpen: true,
      collapsedPreference: true,
    });
  });

  it('clamps valid numeric widths and falls back field-by-field for corrupt values', () => {
    const baseline = setPanelOpen(INITIAL_PANEL_LAYOUT_STATE, 'project-browser', false);
    const restored = restorePanelLayoutPreference(baseline, {
      version: PANEL_LAYOUT_PREFERENCE_VERSION,
      panels: {
        'project-browser': {
          widthPx: 1,
          dockedPreferenceOpen: 'not-a-boolean',
          collapsedPreference: true,
        },
        inspector: {
          widthPx: Number.POSITIVE_INFINITY,
          dockedPreferenceOpen: false,
          collapsedPreference: 'not-a-boolean',
        },
      },
    });

    expect(restored['project-browser'].widthPx).toBe(232);
    expect(restored['project-browser'].dockedPreferenceOpen).toBe(false);
    expect(restored['project-browser'].collapsedPreference).toBe(true);
    expect(restored.inspector.widthPx).toBe(INITIAL_PANEL_LAYOUT_STATE.inspector.widthPx);
    expect(restored.inspector.dockedPreferenceOpen).toBe(false);
    expect(restored.inspector.collapsedPreference).toBe(false);
  });

  it('ignores malformed JSON, unknown versions and missing panel payloads', () => {
    expect(restorePanelLayoutPreference(INITIAL_PANEL_LAYOUT_STATE, '{bad json')).toBe(
      INITIAL_PANEL_LAYOUT_STATE,
    );
    expect(
      restorePanelLayoutPreference(INITIAL_PANEL_LAYOUT_STATE, {
        version: 99,
        panels: {},
      }),
    ).toBe(INITIAL_PANEL_LAYOUT_STATE);
    expect(
      restorePanelLayoutPreference(INITIAL_PANEL_LAYOUT_STATE, {
        version: PANEL_LAYOUT_PREFERENCE_VERSION,
        panels: {},
      }),
    ).toBe(INITIAL_PANEL_LAYOUT_STATE);
  });
});
