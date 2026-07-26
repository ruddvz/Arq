import { useState, type KeyboardEvent } from 'react';
import {
  partitionTabsForOverflow,
  tabKindContract,
  type ViewTabsState,
  type WorkspaceViewTab,
} from '@arq/workspace';

export interface ProjectTabStripProps {
  readonly state: ViewTabsState;
  /**
   * How many tabs fit before overflow. The strip does not measure itself: doc
   * 37's overflow rules are pure state (`partitionTabsForOverflow`), and the
   * host - which knows its own width - passes the slot count in. That keeps the
   * behaviour testable without a layout engine.
   */
  readonly visibleSlots: number;
  readonly onActivateTab: (tabId: string) => void;
  readonly onCloseTab: (tabId: string) => void;
  readonly onTogglePin: (tabId: string) => void;
  readonly onActivateAdjacent: (delta: -1 | 1) => void;
}

function tabLabel(tab: WorkspaceViewTab): string {
  const kind = tabKindContract(tab.kind);
  const kindLabel = kind === null ? tab.kind : kind.label;
  return tab.pinned ? `${tab.title}, ${kindLabel}, pinned` : `${tab.title}, ${kindLabel}`;
}

/**
 * Package 3.0 doc 37 ("View Tab and Navigation System").
 *
 * Doc 36 puts this strip "directly under the project bar... not mixed into the
 * tool bar", so that "a user can understand `where I am` before `what tool I am
 * using`". The strip is therefore its own landmark rather than a row inside the
 * header.
 *
 * The close control is a real nested `<button>`, not a click region on the tab,
 * because `workspace-tab-registry.json` requires closing to be reachable by
 * keyboard and menu - a hover-only ✕ fails that outright, and doc 37 names
 * middle-click as an *additional* path, never the only one.
 *
 * Non-closeable tabs (Project overview, Issues, Compare, Model health, AI
 * proposal per the registry) render no close control at all rather than a
 * disabled one: there is no user action that would ever enable it, so a
 * disabled button would be a permanently dead target.
 *
 * Keyboard: the strip is a `tablist` with roving tabindex - only the active tab
 * is in the Tab order, and Arrow keys move between tabs. That is the standard
 * WAI-ARIA tabs pattern, so a keyboard user does not have to Tab through
 * fourteen views to reach the canvas.
 */
export function ProjectTabStrip(props: ProjectTabStripProps): JSX.Element {
  const { state, visibleSlots, onActivateTab, onCloseTab, onTogglePin, onActivateAdjacent } = props;
  const [overflowOpen, setOverflowOpen] = useState(false);
  const { visible, overflow } = partitionTabsForOverflow(state, visibleSlots);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onActivateAdjacent(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onActivateAdjacent(-1);
    }
  }

  return (
    <div
      className="arq-tab-strip arq-shell-panel"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 'var(--arq-space-micro)',
        padding: '0 var(--arq-space-compact)',
        borderBottom: '1px solid var(--arq-ui-line-subtle)',
      }}
    >
      <div
        role="tablist"
        aria-label="Open views"
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 'var(--arq-space-micro)',
          minWidth: 0,
        }}
      >
        {visible.map((tab) => {
          const active = tab.id === state.activeId;
          return (
            <span
              key={tab.id}
              className="arq-tab-strip__tab"
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              <button
                type="button"
                role="tab"
                id={`arq-tab-${tab.id}`}
                className="arq-shell-button arq-tab-strip__label"
                aria-selected={active}
                aria-controls={`arq-view-${tab.id}`}
                tabIndex={active ? 0 : -1}
                aria-label={tabLabel(tab)}
                onClick={() => onActivateTab(tab.id)}
                onDoubleClick={() => onTogglePin(tab.id)}
              >
                {tab.pinned && <span aria-hidden="true">📌</span>}
                {tab.title}
              </button>
              {tab.closeable && (
                <button
                  type="button"
                  className="arq-shell-button arq-tab-strip__close"
                  aria-label={`Close ${tab.title}`}
                  /*
                   * Doc 33: "Closing a view tab does not delete the view
                   * definition." The wording matters on the control itself -
                   * "Close", never "Remove" or "Delete".
                   */
                  title={`Close ${tab.title}. The view itself is kept.`}
                  onClick={() => onCloseTab(tab.id)}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              )}
            </span>
          );
        })}
      </div>

      {overflow.length > 0 && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            className="arq-shell-button"
            aria-expanded={overflowOpen}
            aria-haspopup="menu"
            aria-label={`${overflow.length} more views`}
            onClick={() => setOverflowOpen((open) => !open)}
          >
            +{overflow.length}
          </button>
          {overflowOpen && (
            <ul
              role="menu"
              aria-label="More views"
              className="arq-shell-panel arq-tab-strip__overflow"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                zIndex: 3,
                listStyle: 'none',
                margin: 0,
                padding: 'var(--arq-space-micro)',
                border: '1px solid var(--arq-ui-line-default)',
                borderRadius: 'var(--arq-radius-menu)',
              }}
            >
              {overflow.map((tab) => (
                <li key={tab.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="arq-shell-button"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => {
                      onActivateTab(tab.id);
                      setOverflowOpen(false);
                    }}
                  >
                    {tabLabel(tab)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
