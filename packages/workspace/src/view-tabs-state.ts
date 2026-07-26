/**
 * Doc 37 ("View Tab and Navigation System") and `workspace-tab-registry.json`.
 *
 * The single most important rule in this file, from the tab registry's own
 * `behaviors.close`: "Closing a tab closes the view instance, not the semantic
 * view definition unless explicit Delete is chosen elsewhere." That is why
 * `closeTab` returns only a new `ViewTabsState` and has no way to signal a
 * deletion, and why nothing in this module accepts a callback that could
 * perform one. A caller that wants to delete a semantic view issues a typed
 * command through @arq/operations; there is deliberately no path from a tab
 * close to that command.
 *
 * Everything here is a pure reducer over immutable state, matching how the rest
 * of the shell is built (tool-rail-state.ts, model-panel-state.ts): the
 * behaviour is testable without a DOM, and React only renders it.
 */

import { tabKindContract } from './registry';
import type { WorkspaceViewKind, WorkspaceViewTab } from './workspace-types';

export interface ViewTabsState {
  readonly tabs: readonly WorkspaceViewTab[];
  readonly activeId: string | null;
}

export const EMPTY_VIEW_TABS_STATE: ViewTabsState = { tabs: [], activeId: null };

export interface OpenTabInput {
  readonly id: string;
  readonly kind: WorkspaceViewKind;
  readonly title: string;
  readonly semanticViewId?: string;
}

/**
 * Opens a view instance, or re-activates the existing one. Pin/closeable
 * default from `workspace-tab-registry.json` rather than the caller, so a
 * surface cannot accidentally hand the user a closeable Project Overview or an
 * unclosable plan.
 */
export function openTab(state: ViewTabsState, input: OpenTabInput): ViewTabsState {
  const existing = state.tabs.find((tab) => tab.id === input.id);
  if (existing !== undefined) {
    return { ...state, activeId: existing.id };
  }
  const contract = tabKindContract(input.kind);
  const tab: WorkspaceViewTab = {
    id: input.id,
    kind: input.kind,
    title: input.title,
    pinned: false,
    closeable: contract?.closeable ?? true,
    ...(input.semanticViewId === undefined ? {} : { semanticViewId: input.semanticViewId }),
  };
  return { tabs: [...state.tabs, tab], activeId: tab.id };
}

/**
 * `workspace-tab-registry.json` > `behaviors.activation`: "Selecting a tab
 * changes view state only; never mutates model data." Activating an unknown id
 * is a no-op rather than an error - tab ids come from user gestures and stale
 * overflow menus, and clearing the active view because a menu was one frame
 * behind is worse than ignoring the click.
 */
export function activateTab(state: ViewTabsState, id: string): ViewTabsState {
  return state.tabs.some((tab) => tab.id === id) ? { ...state, activeId: id } : state;
}

/**
 * Closes a view instance. A non-closeable tab (Project Overview, Issues,
 * Compare, Model health, AI proposal per the registry) is refused outright.
 *
 * When the closed tab was active, focus moves to its neighbour - the tab to its
 * right, falling back to the one on its left. Package 3.0's reference
 * `closeTab` jumped to `tabs.at(-1)`, i.e. the far end of the strip; that loses
 * the user's place when they close a tab in the middle of a long strip, so the
 * neighbour rule is used here instead. This is the one deliberate divergence
 * from the reference file, and it is a strictly local navigation choice with no
 * contract implication.
 */
export function closeTab(state: ViewTabsState, id: string): ViewTabsState {
  const index = state.tabs.findIndex((tab) => tab.id === id);
  const target = index === -1 ? undefined : state.tabs[index];
  if (target === undefined || !target.closeable) {
    return state;
  }
  const tabs = state.tabs.filter((tab) => tab.id !== id);
  if (state.activeId !== id) {
    return { tabs, activeId: state.activeId };
  }
  const neighbour = tabs[index] ?? tabs[index - 1] ?? null;
  return { tabs, activeId: neighbour === null ? null : neighbour.id };
}

/** Doc 37 context menu: "Close others" never closes non-closeable tabs. */
export function closeOtherTabs(state: ViewTabsState, keepId: string): ViewTabsState {
  const closable = state.tabs.filter((tab) => tab.id !== keepId && tab.closeable);
  return closable.reduce((next, tab) => closeTab(next, tab.id), state);
}

/** Doc 37 context menu: "Close tabs to right". */
export function closeTabsToRight(state: ViewTabsState, fromId: string): ViewTabsState {
  const index = state.tabs.findIndex((tab) => tab.id === fromId);
  if (index === -1) {
    return state;
  }
  const closable = state.tabs.slice(index + 1).filter((tab) => tab.closeable);
  return closable.reduce((next, tab) => closeTab(next, tab.id), state);
}

/**
 * `workspace-tab-registry.json` > `tabKinds[].supportsPin`. Pinning is a UI
 * preference (registry `behaviors.reorder`: "persist user tab order as UI
 * preference, not project geometry"), so it never touches the model.
 */
export function togglePin(state: ViewTabsState, id: string): ViewTabsState {
  const target = state.tabs.find((tab) => tab.id === id);
  if (target === undefined) {
    return state;
  }
  if (tabKindContract(target.kind)?.supportsPin !== true) {
    return state;
  }
  return {
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, pinned: !tab.pinned } : tab)),
  };
}

/**
 * Moves a tab to an absolute index. Used by both pointer drag and the
 * keyboard move command - doc 37 requires tab reordering to be reachable
 * without a pointer, and the cheapest way to guarantee both paths behave
 * identically is to give them one reducer.
 */
export function moveTab(state: ViewTabsState, id: string, toIndex: number): ViewTabsState {
  const from = state.tabs.findIndex((tab) => tab.id === id);
  if (from === -1) {
    return state;
  }
  const clamped = Math.min(Math.max(toIndex, 0), state.tabs.length - 1);
  if (clamped === from) {
    return state;
  }
  const tabs = [...state.tabs];
  const [moved] = tabs.splice(from, 1);
  if (moved === undefined) {
    return state;
  }
  tabs.splice(clamped, 0, moved);
  return { ...state, tabs };
}

/**
 * `workspace-tab-registry.json` > `tabKinds[].duplicable`. A duplicate is a
 * second *instance* of the same semantic view: it carries `semanticViewId`
 * across, which is exactly the case that proves closing one tab must not
 * delete the view - the other tab is still showing it.
 */
export function duplicateTab(
  state: ViewTabsState,
  id: string,
  newInstanceId: string,
): ViewTabsState {
  const source = state.tabs.find((tab) => tab.id === id);
  if (source === undefined || tabKindContract(source.kind)?.duplicable !== true) {
    return state;
  }
  if (state.tabs.some((tab) => tab.id === newInstanceId)) {
    return state;
  }
  const semanticViewId = source.semanticViewId ?? source.id;
  const copy: WorkspaceViewTab = {
    id: newInstanceId,
    kind: source.kind,
    title: source.title,
    pinned: false,
    closeable: true,
    semanticViewId,
  };
  const index = state.tabs.findIndex((tab) => tab.id === id);
  const tabs = [...state.tabs];
  tabs.splice(index + 1, 0, copy);
  return { tabs, activeId: copy.id };
}

export interface TabOverflowPartition {
  readonly visible: readonly WorkspaceViewTab[];
  readonly overflow: readonly WorkspaceViewTab[];
}

/**
 * `workspace-tab-registry.json` > `behaviors.overflow`: "Pinned first, active
 * always visible, remaining tabs in ordered overflow menu."
 *
 * "Active always visible" is the constraint that makes this more than a slice:
 * when the active tab would fall past the cut, it displaces the last visible
 * unpinned tab instead of being pushed into a menu the user then has to open to
 * see where they are. Visible tabs keep strip order; the overflow list keeps
 * strip order too, so the menu never reshuffles under the pointer.
 */
export function partitionTabsForOverflow(
  state: ViewTabsState,
  visibleSlots: number,
): TabOverflowPartition {
  if (visibleSlots >= state.tabs.length) {
    return { visible: state.tabs, overflow: [] };
  }
  if (visibleSlots <= 0) {
    return { visible: [], overflow: state.tabs };
  }

  const byPriority = [...state.tabs].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const chosen = new Set(byPriority.slice(0, visibleSlots).map((tab) => tab.id));

  if (state.activeId !== null && !chosen.has(state.activeId)) {
    const evictable = [...chosen]
      .map((id) => state.tabs.find((tab) => tab.id === id))
      .filter((tab): tab is WorkspaceViewTab => tab !== undefined && !tab.pinned)
      .at(-1);
    // With every slot held by a pinned tab there is nothing to evict, so the
    // active tab stays in overflow rather than a pin being silently dropped.
    if (evictable !== undefined) {
      chosen.delete(evictable.id);
      chosen.add(state.activeId);
    }
  }

  return {
    visible: state.tabs.filter((tab) => chosen.has(tab.id)),
    overflow: state.tabs.filter((tab) => !chosen.has(tab.id)),
  };
}

/**
 * Doc 37: keyboard navigation across the strip. Wraps, because a tab strip is a
 * ring in every editor users already know, and stops being a trap for
 * keyboard-only users at either end.
 */
export function activateAdjacentTab(state: ViewTabsState, delta: -1 | 1): ViewTabsState {
  if (state.tabs.length === 0 || state.activeId === null) {
    return state;
  }
  const index = state.tabs.findIndex((tab) => tab.id === state.activeId);
  if (index === -1) {
    return state;
  }
  const next = state.tabs[(index + delta + state.tabs.length) % state.tabs.length];
  return next === undefined ? state : { ...state, activeId: next.id };
}

/**
 * The semantic views a close would leave with no open instance. This is
 * reporting only - it exists so a caller can *ask* the question without the
 * answer being wired to anything destructive.
 */
export function semanticViewsLosingLastInstance(
  state: ViewTabsState,
  closingId: string,
): readonly string[] {
  const closing = state.tabs.find((tab) => tab.id === closingId);
  if (closing === undefined) {
    return [];
  }
  const semanticViewId = closing.semanticViewId ?? closing.id;
  const others = state.tabs.filter(
    (tab) => tab.id !== closingId && (tab.semanticViewId ?? tab.id) === semanticViewId,
  );
  return others.length === 0 ? [semanticViewId] : [];
}
