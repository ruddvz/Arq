import { describe, expect, it } from 'vitest';
import {
  INITIAL_INSPECTOR_TABS_STATE,
  INSPECTOR_TABS,
  INSPECTOR_TAB_LABELS,
  availableInspectorTabs,
  defaultInspectorTab,
  inspectorHeaderLabel,
  reconcileInspectorTab,
  registryInspectorTabs,
  selectInspectorTab,
  type InspectorContext,
} from './inspector-tabs-state';

function context(overrides: Partial<InspectorContext> = {}): InspectorContext {
  return {
    selectionCount: 1,
    warningCount: 0,
    mode: 'design',
    historyCapabilityEnabled: false,
    ...overrides,
  };
}

describe('INSPECTOR_TABS', () => {
  it('matches the panel registry tabs exactly, in order', () => {
    expect(INSPECTOR_TABS.map((t) => INSPECTOR_TAB_LABELS[t])).toEqual(registryInspectorTabs());
  });
});

describe('availableInspectorTabs', () => {
  it('shows only Properties with nothing selected', () => {
    expect(availableInspectorTabs(context({ selectionCount: 0 }))).toEqual(['properties']);
  });

  /** Doc 40: History appears "if product capability exists". */
  it('hides History until the capability exists', () => {
    expect(availableInspectorTabs(context())).not.toContain('history');
    expect(availableInspectorTabs(context({ historyCapabilityEnabled: true }))).toContain(
      'history',
    );
  });

  it('shows the element tabs once something is selected', () => {
    expect(availableInspectorTabs(context())).toEqual([
      'properties',
      'type',
      'relations',
      'warnings',
    ]);
  });
});

describe('defaultInspectorTab', () => {
  /**
   * A user who selects an element the model is complaining about should see the
   * complaint, not have to find the tab holding it.
   */
  it('leads with Warnings when the selection has any', () => {
    expect(defaultInspectorTab(context({ warningCount: 3 }))).toBe('warnings');
    expect(defaultInspectorTab(context({ warningCount: 0 }))).toBe('properties');
  });

  it('is Properties with nothing selected, whatever else is true', () => {
    expect(defaultInspectorTab(context({ selectionCount: 0, warningCount: 9 }))).toBe('properties');
  });
});

describe('reconcileInspectorTab', () => {
  it('follows the context default until the user chooses', () => {
    const state = reconcileInspectorTab(INITIAL_INSPECTOR_TABS_STATE, context({ warningCount: 1 }));
    expect(state.tab).toBe('warnings');
    expect(state.userChose).toBe(false);
  });

  /** Doc 34: "preserving the user's manual selection during the session". */
  it('respects a user choice even when the default would differ', () => {
    const chosen = selectInspectorTab(INITIAL_INSPECTOR_TABS_STATE, 'relations');
    const next = reconcileInspectorTab(chosen, context({ warningCount: 5 }));
    expect(next).toBe(chosen);
    expect(next.tab).toBe('relations');
  });

  /**
   * A remembered Type tab cannot survive the selection being cleared - there is
   * no instance left for it to be the type of.
   */
  it('drops a user choice that the new context cannot offer', () => {
    const chosen = selectInspectorTab(INITIAL_INSPECTOR_TABS_STATE, 'type');
    const next = reconcileInspectorTab(chosen, context({ selectionCount: 0 }));
    expect(next.tab).toBe('properties');
    expect(next.userChose).toBe(false);
  });

  it('drops a History choice if the capability goes away', () => {
    const chosen = selectInspectorTab(INITIAL_INSPECTOR_TABS_STATE, 'history');
    expect(reconcileInspectorTab(chosen, context({ historyCapabilityEnabled: true }))).toBe(chosen);
    expect(reconcileInspectorTab(chosen, context({ historyCapabilityEnabled: false })).tab).toBe(
      'properties',
    );
  });

  it('is stable when nothing needs to change', () => {
    const state = reconcileInspectorTab(INITIAL_INSPECTOR_TABS_STATE, context());
    expect(reconcileInspectorTab(state, context())).toBe(state);
  });
});

describe('inspectorHeaderLabel', () => {
  /** Doc 40: "Multi-selection header shows count and common type/category." */
  it('describes single, multi and empty selections distinctly', () => {
    expect(inspectorHeaderLabel(context({ selectionCount: 0 }), 'Wall')).toBeNull();
    expect(inspectorHeaderLabel(context({ selectionCount: 1 }), 'Wall')).toBe('Wall');
    expect(inspectorHeaderLabel(context({ selectionCount: 4 }), 'Wall')).toBe('4 selected · Wall');
    expect(inspectorHeaderLabel(context({ selectionCount: 4 }), null)).toBe('4 selected');
  });

  it('falls back rather than showing a blank header for one unnamed element', () => {
    expect(inspectorHeaderLabel(context({ selectionCount: 1 }), null)).toBe('Selected element');
  });
});
