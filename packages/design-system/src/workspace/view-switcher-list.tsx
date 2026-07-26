import { useMemo, useState } from 'react';
import { tabKindContract, type ViewTabsState, type WorkspaceViewTab } from '@arq/workspace';

export interface ViewSwitcherListProps {
  readonly state: ViewTabsState;
  readonly onActivateTab: (tabId: string) => void;
  readonly onCloseTab: (tabId: string) => void;
}

/**
 * Doc 47 > "View switcher": "Search, then grouped views. Tap switches and
 * closes sheet. Long names wrap to two lines, never marquee."
 *
 * Grouped by tab kind, because on a phone a flat list of fourteen views with
 * mixed types is a scroll, while "Plans / Sheets / Reports" is a glance. The
 * groups come from the tab registry's own labels rather than a second
 * vocabulary invented here.
 *
 * Search filters but never reorders: a list that reshuffles as the user types
 * makes the target move under their thumb.
 */
export function ViewSwitcherList(props: ViewSwitcherListProps): JSX.Element {
  const { state, onActivateTab, onCloseTab } = props;
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const matching =
      trimmed.length === 0
        ? state.tabs
        : state.tabs.filter((tab) => tab.title.toLowerCase().includes(trimmed));

    const byKind = new Map<string, WorkspaceViewTab[]>();
    for (const tab of matching) {
      const label = tabKindContract(tab.kind)?.label ?? tab.kind;
      const existing = byKind.get(label);
      if (existing === undefined) {
        byKind.set(label, [tab]);
      } else {
        existing.push(tab);
      }
    }
    return [...byKind.entries()];
  }, [state.tabs, query]);

  const total = groups.reduce((sum, [, tabs]) => sum + tabs.length, 0);

  return (
    <div className="arq-view-switcher" style={{ padding: 'var(--arq-space-compact)' }}>
      <input
        type="search"
        aria-label="Search views"
        placeholder="Search views"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 'var(--arq-space-compact)' }}
      />

      {/* Announced so a search that matches nothing is not a silently empty pane. */}
      <p
        aria-live="polite"
        className="arq-visually-quiet"
        style={{ margin: 0, fontSize: '0.875em', color: 'var(--arq-ui-text-muted)' }}
      >
        {total === 0 ? 'No views match' : `${total} view${total === 1 ? '' : 's'}`}
      </p>

      {groups.map(([label, tabs]) => (
        <section key={label} aria-label={label}>
          <h3
            style={{
              margin: 'var(--arq-space-compact) 0 var(--arq-space-micro) 0',
              fontSize: '0.875em',
              color: 'var(--arq-ui-text-secondary)',
            }}
          >
            {label}
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {tabs.map((tab) => (
              <li key={tab.id} style={{ display: 'flex', alignItems: 'stretch' }}>
                <button
                  type="button"
                  className="arq-shell-button"
                  aria-current={tab.id === state.activeId ? 'true' : undefined}
                  onClick={() => onActivateTab(tab.id)}
                  style={{
                    flex: 1,
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    // Doc 47: "Long names wrap to two lines, never marquee."
                    whiteSpace: 'normal',
                    fontWeight: tab.id === state.activeId ? 600 : 400,
                  }}
                >
                  {tab.title}
                </button>
                {tab.closeable && (
                  <button
                    type="button"
                    className="arq-shell-button"
                    aria-label={`Close ${tab.title}. The view itself is kept.`}
                    onClick={() => onCloseTab(tab.id)}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
