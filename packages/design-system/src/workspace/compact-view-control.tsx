import { tabKindContract, type ViewTabsState } from '@arq/workspace';

export interface CompactViewControlProps {
  readonly state: ViewTabsState;
  readonly onOpenViewSwitcher: () => void;
  readonly viewSwitcherOpen: boolean;
}

/**
 * Doc 34 > "View tabs": "on phone, tabs become a compact current-view control
 * plus a full-height View Switcher."
 *
 * A phone does not get the tab strip. Rendering the strip at a phone width
 * produces one visible tab and an overflow menu holding everything else, which
 * is the desktop composition wearing a disguise — the user cannot see where
 * they are without opening a menu, and doc 36's rule that a user should
 * "understand `where I am` before `what tool I am using`" is lost.
 *
 * This shows the active view and its kind, always, and opens the View Switcher
 * sheet. One control, one tap, nothing hidden behind an ellipsis.
 */
export function CompactViewControl(props: CompactViewControlProps): JSX.Element {
  const { state, onOpenViewSwitcher, viewSwitcherOpen } = props;
  const active = state.tabs.find((tab) => tab.id === state.activeId) ?? null;
  const kind = active === null ? null : tabKindContract(active.kind);
  const count = state.tabs.length;

  return (
    <div
      className="arq-compact-view-control arq-shell-panel"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '1px solid var(--arq-ui-line-subtle)',
      }}
    >
      <button
        type="button"
        className="arq-shell-button"
        aria-haspopup="dialog"
        aria-expanded={viewSwitcherOpen}
        aria-label={
          active === null
            ? 'No view open. Open the view switcher.'
            : `Current view: ${active.title}, ${kind?.label ?? active.kind}. ${count} view${count === 1 ? '' : 's'} open. Open the view switcher.`
        }
        onClick={onOpenViewSwitcher}
        style={{ flex: 1, justifyContent: 'space-between', minWidth: 0 }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {active === null ? 'No view open' : active.title}
        </span>
        <span aria-hidden="true" style={{ color: 'var(--arq-ui-text-muted)' }}>
          {count > 1 ? `${count} ▾` : '▾'}
        </span>
      </button>
    </div>
  );
}
