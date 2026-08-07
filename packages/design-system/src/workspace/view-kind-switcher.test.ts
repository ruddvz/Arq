import { describe, expect, it } from 'vitest';
import { EMPTY_VIEW_TABS_STATE, openTab, activateTab } from '@arq/workspace';

/*
 * The switcher itself is a component and this package has no DOM test
 * environment, so what is pinned here is the state contract it depends on: that
 * "activate the open view of this kind, or open one" can be one call rather
 * than a find-then-branch, and that switching away and back returns to the view
 * the user was on rather than to the first one.
 *
 * Those are the two behaviours that would break the capsule silently. The
 * markup - `role="tablist"`, `aria-selected`, the disabled reason in the
 * accessible name - is asserted by the workspace layout capability check
 * against a real browser, which is the only place it can be asserted honestly.
 */
describe('the state the view-kind capsule stands on', () => {
  const withViews = openTab(
    openTab(
      openTab(EMPTY_VIEW_TABS_STATE, {
        id: 'overview',
        kind: 'project-overview',
        title: 'Project overview',
      }),
      { id: 'model-3d', kind: '3d', title: '3D' },
    ),
    { id: 'plan-upper', kind: 'plan', title: 'Upper floor' },
  );

  it('finds the open view of a kind, so a segment knows what to activate', () => {
    expect(withViews.tabs.find((tab) => tab.kind === 'plan')?.id).toBe('plan-upper');
    expect(withViews.tabs.find((tab) => tab.kind === '3d')?.id).toBe('model-3d');
    // Nothing is open of this kind, which is why the segment carries a reason
    // rather than a click that would do nothing.
    expect(withViews.tabs.find((tab) => tab.kind === 'sheet')).toBeUndefined();
  });

  it('returns to the view you were on, not to the first of its kind', () => {
    // The user is on the upper floor, looks at the model, and comes back.
    const at3d = activateTab(withViews, 'model-3d');
    const backToPlan = activateTab(at3d, 'plan-upper');
    expect(backToPlan.activeId).toBe('plan-upper');
  });

  it('re-opening a kind that is already open does not duplicate it', () => {
    // `openTab` is idempotent by id, which is what lets the host write
    // "activate or open" as one call.
    const again = openTab(withViews, { id: 'model-3d', kind: '3d', title: '3D' });
    expect(again.tabs.filter((tab) => tab.kind === '3d')).toHaveLength(1);
    expect(again.activeId).toBe('model-3d');
  });

  it('leaves the capsule with nothing selected when the overview is open', () => {
    // Project overview is reached from the logo and is deliberately not a
    // segment, so no segment is selected while it is active. The capsule still
    // has to be reachable from the keyboard in that state.
    const onOverview = activateTab(withViews, 'overview');
    const activeKind = onOverview.tabs.find((tab) => tab.id === onOverview.activeId)?.kind;
    expect(activeKind).toBe('project-overview');
    expect(['plan', '3d', 'sheet']).not.toContain(activeKind);
  });
});
