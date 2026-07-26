/**
 * Doc 40 ("Inspector and Properties System") and
 * `workspace-panel-registry.json` > `P-right-inspector.tabs`.
 *
 * Doc 34's rule for the inspector is the whole design here: "Default to the
 * most relevant one for context while preserving the user's manual selection
 * during the session."
 *
 * That is two behaviours that pull against each other, so both are modelled
 * explicitly rather than left to a component's `useState`. An inspector that
 * only auto-selects fights a user who wants to stay on Relations; an inspector
 * that only remembers strands a user on a Warnings tab that is empty for the
 * thing they just selected.
 */

import { panelContract } from './registry';
import type { WorkspaceMode } from './workspace-types';

export type InspectorTab = 'properties' | 'type' | 'relations' | 'warnings' | 'history';

/** The five the registry declares, in its order. */
export const INSPECTOR_TABS: readonly InspectorTab[] = [
  'properties',
  'type',
  'relations',
  'warnings',
  'history',
];

export const INSPECTOR_TAB_LABELS: Readonly<Record<InspectorTab, string>> = {
  properties: 'Properties',
  type: 'Type',
  relations: 'Relations',
  warnings: 'Warnings',
  history: 'History',
};

/** Doc 40's own description of each tab, used as the tab's tooltip. */
export const INSPECTOR_TAB_PURPOSE: Readonly<Record<InspectorTab, string>> = {
  properties: 'Instance parameters grouped by identity, constraints, geometry and graphics',
  type: 'Shared type values, always distinguished from instance values',
  relations: 'Host, joins, containment, references and dependencies',
  warnings: 'Diagnostics for the selected element',
  history: 'Revision and change context',
};

export interface InspectorContext {
  readonly selectionCount: number;
  /** Doc 40: Warnings leads when the selected element actually has some. */
  readonly warningCount: number;
  readonly mode: WorkspaceMode;
  /**
   * Doc 40: History appears "if product capability exists". A tab that cannot
   * ever have content is not shown at all - unlike a tab that is merely empty
   * right now, which is information.
   */
  readonly historyCapabilityEnabled: boolean;
}

/**
 * Which tabs can be shown at all. History is capability-gated; Type is
 * meaningless with nothing selected, and Relations and Warnings are about a
 * specific element, so with an empty selection only Properties remains — and it
 * renders doc 40's no-selection state.
 */
export function availableInspectorTabs(context: InspectorContext): readonly InspectorTab[] {
  if (context.selectionCount === 0) {
    return ['properties'];
  }
  return INSPECTOR_TABS.filter((tab) => tab !== 'history' || context.historyCapabilityEnabled);
}

/**
 * Doc 34's "most relevant for context".
 *
 * Warnings wins when the selection has any: a user who selects an element the
 * model is complaining about should see the complaint, not have to hunt a tab
 * for it. Inspect mode otherwise leads with Properties, which is what the mode
 * is for. Everything else lands on Properties too — the honest default, since
 * inventing a cleverer rule would make the panel unpredictable.
 */
export function defaultInspectorTab(context: InspectorContext): InspectorTab {
  if (context.selectionCount === 0) {
    return 'properties';
  }
  if (context.warningCount > 0) {
    return 'warnings';
  }
  return 'properties';
}

export interface InspectorTabsState {
  readonly tab: InspectorTab;
  /** True once the user has picked a tab themselves, for this session. */
  readonly userChose: boolean;
}

export const INITIAL_INSPECTOR_TABS_STATE: InspectorTabsState = Object.freeze({
  tab: 'properties',
  userChose: false,
});

export function selectInspectorTab(
  state: InspectorTabsState,
  tab: InspectorTab,
): InspectorTabsState {
  return { tab, userChose: true };
}

/**
 * Applies the context default unless the user has chosen — the two halves of
 * doc 34's rule, in one place.
 *
 * A user choice that is not available for the new context is dropped rather
 * than honoured: keeping the user on a Type tab after they select nothing would
 * show them a panel about a type that no longer has an instance.
 */
export function reconcileInspectorTab(
  state: InspectorTabsState,
  context: InspectorContext,
): InspectorTabsState {
  const available = availableInspectorTabs(context);
  if (state.userChose && available.includes(state.tab)) {
    return state;
  }
  const next = defaultInspectorTab(context);
  const tab = available.includes(next) ? next : (available[0] ?? 'properties');
  return tab === state.tab && !state.userChose ? state : { tab, userChose: false };
}

/**
 * Doc 40 > Header: "Multi-selection header shows count and common type/
 * category." Returns the header line, or null with no selection so the caller
 * renders the no-selection state rather than a header saying "0 selected".
 */
export function inspectorHeaderLabel(
  context: InspectorContext,
  commonTypeName: string | null,
): string | null {
  if (context.selectionCount === 0) {
    return null;
  }
  if (context.selectionCount === 1) {
    return commonTypeName ?? 'Selected element';
  }
  const suffix = commonTypeName === null ? '' : ` · ${commonTypeName}`;
  return `${context.selectionCount} selected${suffix}`;
}

/** Exposed for the registry-integrity test. */
export function registryInspectorTabs(): readonly string[] {
  return panelContract('P-right-inspector')?.tabs ?? [];
}
