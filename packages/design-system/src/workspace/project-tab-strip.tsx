import { useState, type KeyboardEvent } from 'react';
import {
  partitionTabsForOverflow,
  tabKindContract,
  type ViewTabsState,
  type WorkspaceViewTab,
} from '@arq/workspace';
import { TabContextMenu, type TabContextMenuActions } from './tab-context-menu';

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
  /**
   * Doc 37's per-tab actions. Optional so a surface that only needs a read-only
   * strip is not forced to implement six handlers - when absent, no context
   * menu is offered rather than an empty one appearing.
   */
  readonly contextMenuActions?: TabContextMenuActions;
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
  const {
    state,
    visibleSlots,
    onActivateTab,
    onCloseTab,
    onTogglePin,
    onActivateAdjacent,
    contextMenuActions,
  } = props;
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [menuTabId, setMenuTabId] = useState<string | null>(null);
  const { visible, overflow } = partitionTabsForOverflow(state, visibleSlots);

  /**
   * Doc 37 lists middle click as a close path but requires "keyboard/menu
   * equivalents". The context menu is that equivalent, reachable three ways:
   * right-click, the Menu/ContextMenu key, and Shift+F10 - the two keyboard
   * paths every desktop platform already teaches.
   */
  function openMenuFor(tabId: string): void {
    if (contextMenuActions !== undefined) {
      setMenuTabId(tabId);
    }
  }

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
              style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}
              onContextMenu={(event) => {
                if (contextMenuActions === undefined) {
                  return;
                }
                event.preventDefault();
                openMenuFor(tab.id);
              }}
              onAuxClick={(event) => {
                // Doc 37: "middle click may close on desktop", never as the
                // only path - the close button and this menu are the others.
                if (event.button === 1 && tab.closeable) {
                  event.preventDefault();
                  onCloseTab(tab.id);
                }
              }}
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
                onKeyDown={(event) => {
                  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                    event.preventDefault();
                    openMenuFor(tab.id);
                  }
                }}
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
              {menuTabId === tab.id && contextMenuActions !== undefined && (
                <TabContextMenu
                  tab={tab}
                  {...contextMenuActions}
                  hasOtherClosableTabs={state.tabs.some((t) => t.id !== tab.id && t.closeable)}
                  hasClosableTabsToRight={state.tabs
                    .slice(state.tabs.findIndex((t) => t.id === tab.id) + 1)
                    .some((t) => t.closeable)}
                  onDismiss={() => {
                    setMenuTabId(null);
                    document.getElementById(`arq-tab-${tab.id}`)?.focus();
                  }}
                />
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
