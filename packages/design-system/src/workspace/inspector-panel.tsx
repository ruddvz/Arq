import type { ReactNode } from 'react';
import {
  INSPECTOR_TAB_LABELS,
  INSPECTOR_TAB_PURPOSE,
  availableInspectorTabs,
  inspectorHeaderLabel,
  type InspectorContext,
  type InspectorTab,
  type InspectorTabsState,
} from '@arq/workspace';

export interface InspectorPanelProps {
  readonly state: InspectorTabsState;
  readonly context: InspectorContext;
  /** Doc 40 header: the common type/category name, or null when unknown. */
  readonly commonTypeName: string | null;
  readonly onSelectTab: (tab: InspectorTab) => void;
  readonly tabs: Partial<Record<InspectorTab, ReactNode>>;
}

function EmptyTab(props: { readonly tab: InspectorTab }): JSX.Element {
  return (
    <p style={{ padding: 'var(--arq-space-panel)', color: 'var(--arq-ui-text-muted)', margin: 0 }}>
      Nothing to show. {INSPECTOR_TAB_PURPOSE[props.tab]}.
    </p>
  );
}

/**
 * Doc 40 ("Inspector and Properties System").
 *
 * Doc 40's opening line sets the boundary: "The Inspector is the canonical
 * property-editing surface. Cursor HUDs are accelerators, not a competing data
 * model." So this panel owns the five tabs the registry declares, and the
 * existing `InspectorShell` becomes the *Properties* tab's body rather than
 * being replaced — the grouped property rows it already renders are exactly
 * what doc 40 asks Properties to contain.
 *
 * The header is sticky. Doc 40's responsive rule for the phone sheet asks for
 * "a sticky selection header", and the reason generalises: scrolling a long
 * property list until you can no longer see *what* you are editing is how a
 * user changes the wrong element.
 *
 * Which tab is shown is not this component's decision — `reconcileInspectorTab`
 * in @arq/workspace holds doc 34's "default to the most relevant for context
 * while preserving the user's manual selection", which is a rule about session
 * memory that a render function has no business owning.
 */
export function InspectorPanel(props: InspectorPanelProps): JSX.Element {
  const { state, context, commonTypeName, onSelectTab, tabs } = props;
  const available = availableInspectorTabs(context);
  const active = available.includes(state.tab) ? state.tab : (available[0] ?? 'properties');
  const header = inspectorHeaderLabel(context, commonTypeName);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) {
      return;
    }
    event.preventDefault();
    const index = available.indexOf(active);
    const next = available[(index + delta + available.length) % available.length];
    if (next !== undefined) {
      onSelectTab(next);
    }
  }

  return (
    <aside
      className="arq-inspector-panel arq-shell-panel"
      aria-label="Inspector"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        borderLeft: '1px solid var(--arq-ui-line-subtle)',
      }}
    >
      <div
        className="arq-inspector-panel__header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          flex: '0 0 auto',
          padding: 'var(--arq-space-compact) var(--arq-space-panel)',
          borderBottom: '1px solid var(--arq-ui-line-subtle)',
          background: 'var(--arq-ui-surface-1)',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }} aria-live="polite">
          {header ?? 'No selection'}
        </p>
        {context.warningCount > 0 && (
          // Section 126: status is never colour-only. The count is written out.
          <p style={{ margin: 0, fontSize: '0.875em', color: 'var(--arq-ui-text-secondary)' }}>
            {context.warningCount} warning{context.warningCount === 1 ? '' : 's'}
          </p>
        )}
      </div>

      <div
        role="tablist"
        aria-label="Inspector sections"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="arq-inspector-panel__tabs"
        style={{
          display: 'flex',
          flex: '0 0 auto',
          borderBottom: '1px solid var(--arq-ui-line-subtle)',
          overflowX: 'auto',
        }}
      >
        {available.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`arq-inspector-tab-${tab}`}
            aria-selected={tab === active}
            aria-controls={`arq-inspector-panel-${tab}`}
            tabIndex={tab === active ? 0 : -1}
            title={INSPECTOR_TAB_PURPOSE[tab]}
            className="arq-shell-button arq-inspector-panel__tab"
            style={{ flex: 1, minWidth: 0 }}
            onClick={() => onSelectTab(tab)}
          >
            {INSPECTOR_TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`arq-inspector-panel-${active}`}
        aria-labelledby={`arq-inspector-tab-${active}`}
        style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
      >
        {tabs[active] ?? <EmptyTab tab={active} />}
      </div>
    </aside>
  );
}
