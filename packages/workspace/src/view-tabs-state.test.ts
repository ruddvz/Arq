import { describe, expect, it } from 'vitest';
import {
  EMPTY_VIEW_TABS_STATE,
  activateAdjacentTab,
  activateTab,
  closeOtherTabs,
  closeTab,
  closeTabsToRight,
  duplicateTab,
  moveTab,
  openTab,
  partitionTabsForOverflow,
  semanticViewsLosingLastInstance,
  togglePin,
  type ViewTabsState,
} from './view-tabs-state';

function withTabs(): ViewTabsState {
  let state = openTab(EMPTY_VIEW_TABS_STATE, {
    id: 'overview',
    kind: 'project-overview',
    title: 'Project overview',
  });
  state = openTab(state, {
    id: 'plan-l1',
    kind: 'plan',
    title: 'Level 1 Plan',
    semanticViewId: 'v-plan-l1',
  });
  state = openTab(state, { id: 'view-3d', kind: '3d', title: '3D' });
  state = openTab(state, { id: 'sheet-a101', kind: 'sheet', title: 'Sheet A101' });
  return state;
}

describe('openTab', () => {
  it('takes closeable from the tab registry rather than the caller', () => {
    const state = withTabs();
    expect(state.tabs.find((t) => t.id === 'overview')?.closeable).toBe(false);
    expect(state.tabs.find((t) => t.id === 'plan-l1')?.closeable).toBe(true);
  });

  it('re-activates an already-open instance instead of opening a duplicate', () => {
    const state = openTab(withTabs(), { id: 'plan-l1', kind: 'plan', title: 'Level 1 Plan' });
    expect(state.tabs.filter((t) => t.id === 'plan-l1')).toHaveLength(1);
    expect(state.activeId).toBe('plan-l1');
  });
});

describe('closeTab', () => {
  it('refuses to close a non-closeable tab', () => {
    const state = withTabs();
    expect(closeTab(state, 'overview')).toBe(state);
  });

  it('activates the right-hand neighbour when the active tab closes', () => {
    const state = activateTab(withTabs(), 'plan-l1');
    expect(closeTab(state, 'plan-l1').activeId).toBe('view-3d');
  });

  it('falls back to the left-hand neighbour when closing the last tab', () => {
    const state = activateTab(withTabs(), 'sheet-a101');
    expect(closeTab(state, 'sheet-a101').activeId).toBe('view-3d');
  });

  it('leaves the active tab alone when a background tab closes', () => {
    const state = activateTab(withTabs(), 'overview');
    expect(closeTab(state, 'view-3d').activeId).toBe('overview');
  });

  /**
   * The registry's headline rule: "Closing a tab closes the view instance, not
   * the semantic view definition." A second instance of the same semantic view
   * must survive its sibling being closed.
   */
  it('closing one instance leaves another instance of the same semantic view open', () => {
    const state = duplicateTab(activateTab(withTabs(), 'plan-l1'), 'plan-l1', 'plan-l1-copy');
    const closed = closeTab(state, 'plan-l1');
    expect(closed.tabs.map((t) => t.id)).toContain('plan-l1-copy');
    expect(closed.tabs.find((t) => t.id === 'plan-l1-copy')?.semanticViewId).toBe('v-plan-l1');
  });
});

describe('closeOtherTabs / closeTabsToRight', () => {
  it('never closes non-closeable tabs', () => {
    const closed = closeOtherTabs(withTabs(), 'plan-l1');
    expect(closed.tabs.map((t) => t.id)).toEqual(['overview', 'plan-l1']);
  });

  it('closes only closeable tabs to the right', () => {
    const closed = closeTabsToRight(withTabs(), 'plan-l1');
    expect(closed.tabs.map((t) => t.id)).toEqual(['overview', 'plan-l1']);
  });
});

describe('togglePin', () => {
  it('pins a tab kind that supports pinning', () => {
    const state = togglePin(withTabs(), 'plan-l1');
    expect(state.tabs.find((t) => t.id === 'plan-l1')?.pinned).toBe(true);
  });

  it('is a no-op for an unknown tab', () => {
    const state = withTabs();
    expect(togglePin(state, 'nope')).toBe(state);
  });
});

describe('moveTab', () => {
  it('reorders and clamps out-of-range targets', () => {
    const state = moveTab(withTabs(), 'sheet-a101', 0);
    expect(state.tabs.map((t) => t.id)).toEqual(['sheet-a101', 'overview', 'plan-l1', 'view-3d']);
    expect(moveTab(state, 'sheet-a101', 99).tabs.map((t) => t.id)).toEqual([
      'overview',
      'plan-l1',
      'view-3d',
      'sheet-a101',
    ]);
  });
});

describe('duplicateTab', () => {
  it('refuses kinds the registry marks non-duplicable', () => {
    const state = withTabs();
    expect(duplicateTab(state, 'overview', 'overview-2')).toBe(state);
  });

  it('carries the semantic view id onto the copy', () => {
    const state = duplicateTab(withTabs(), 'view-3d', 'view-3d-2');
    // The source had no explicit semanticViewId, so its own id becomes the
    // shared semantic identity - both tabs now point at one view.
    expect(state.tabs.find((t) => t.id === 'view-3d-2')?.semanticViewId).toBe('view-3d');
    expect(state.activeId).toBe('view-3d-2');
  });
});

describe('partitionTabsForOverflow', () => {
  it('keeps pinned tabs visible first', () => {
    const state = togglePin(withTabs(), 'sheet-a101');
    const { visible } = partitionTabsForOverflow(state, 2);
    expect(visible.map((t) => t.id)).toContain('sheet-a101');
  });

  it('never hides the active tab', () => {
    const state = activateTab(withTabs(), 'sheet-a101');
    const { visible, overflow } = partitionTabsForOverflow(state, 2);
    expect(visible.map((t) => t.id)).toContain('sheet-a101');
    expect(overflow.map((t) => t.id)).not.toContain('sheet-a101');
  });

  it('preserves strip order in both lists', () => {
    const state = activateTab(withTabs(), 'sheet-a101');
    const { visible, overflow } = partitionTabsForOverflow(state, 2);
    const order = state.tabs.map((t) => t.id);
    const rank = (id: string): number => order.indexOf(id);
    expect(visible.map((t) => rank(t.id))).toEqual(
      [...visible.map((t) => rank(t.id))].sort((a, b) => a - b),
    );
    expect(overflow.map((t) => rank(t.id))).toEqual(
      [...overflow.map((t) => rank(t.id))].sort((a, b) => a - b),
    );
  });

  it('does not drop a pin to make room for the active tab', () => {
    let state = togglePin(togglePin(withTabs(), 'plan-l1'), 'view-3d');
    state = activateTab(state, 'sheet-a101');
    const { visible } = partitionTabsForOverflow(state, 2);
    expect(visible.map((t) => t.id)).toEqual(['plan-l1', 'view-3d']);
  });

  it('returns everything when there is room', () => {
    const state = withTabs();
    expect(partitionTabsForOverflow(state, 10).overflow).toHaveLength(0);
  });
});

describe('activateAdjacentTab', () => {
  it('wraps at both ends', () => {
    const state = activateTab(withTabs(), 'overview');
    expect(activateAdjacentTab(state, -1).activeId).toBe('sheet-a101');
    expect(activateAdjacentTab(activateTab(state, 'sheet-a101'), 1).activeId).toBe('overview');
  });

  it('is a no-op with no tabs', () => {
    expect(activateAdjacentTab(EMPTY_VIEW_TABS_STATE, 1)).toBe(EMPTY_VIEW_TABS_STATE);
  });
});

describe('semanticViewsLosingLastInstance', () => {
  it('reports the view when the closing tab is its only instance', () => {
    expect(semanticViewsLosingLastInstance(withTabs(), 'plan-l1')).toEqual(['v-plan-l1']);
  });

  it('reports nothing when another instance remains', () => {
    const state = duplicateTab(withTabs(), 'plan-l1', 'plan-l1-copy');
    expect(semanticViewsLosingLastInstance(state, 'plan-l1')).toEqual([]);
  });
});
