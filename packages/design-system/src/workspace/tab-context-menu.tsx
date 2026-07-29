import { useEffect, useRef } from 'react';
import { tabKindContract, type WorkspaceViewTab } from '@arq/workspace';

export interface TabContextMenuActions {
  readonly onTogglePin: (tabId: string) => void;
  readonly onDuplicate: (tabId: string) => void;
  readonly onRevealInBrowser: (tabId: string) => void;
  readonly onClose: (tabId: string) => void;
  readonly onCloseOthers: (tabId: string) => void;
  readonly onCloseToRight: (tabId: string) => void;
}

export interface TabContextMenuProps extends TabContextMenuActions {
  readonly tab: WorkspaceViewTab;
  readonly onDismiss: () => void;
  /** Whether any closeable tab exists to the right, so the item can say why not. */
  readonly hasClosableTabsToRight: boolean;
  readonly hasOtherClosableTabs: boolean;
}

interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly onActivate: () => void;
  readonly disabledReason?: string;
  /** Doc 37 / context-menu registry: "Destructive action separated and labelled." */
  readonly separatedAbove?: boolean;
}

/**
 * `workspace-context-menu-registry.json` > `menus['view-tab']`:
 * Pin/Unpin, Duplicate view when supported, Split right, Split down, Reveal in
 * browser, Close, Close others, Close tabs to right.
 *
 * Split right and Split down are deliberately absent rather than present and
 * disabled. The registry's own rule is that an unavailable action "stays
 * visible with reason **when discoverability matters**" — a split view is a
 * feature this repository has no viewport host for at all, so listing it would
 * advertise a capability rather than explain a temporary state. The tools that
 * *are* built but unavailable for this tab (duplicate on a non-duplicable kind)
 * do stay visible with their reason, which is the case the rule is for.
 *
 * The registry's other three rules are implemented literally: menu order is
 * fixed by `items` below, the destructive group is separated by a rule and
 * labelled, and every disabled item carries its reason in the accessible name.
 *
 * Escape dismisses and returns focus to the tab, and focus moves into the menu
 * on open — without that the menu is unusable by keyboard, which is exactly the
 * bug found in the phone project bar's More menu.
 */
export function TabContextMenu(props: TabContextMenuProps): JSX.Element {
  const {
    tab,
    onDismiss,
    hasClosableTabsToRight,
    hasOtherClosableTabs,
    onTogglePin,
    onDuplicate,
    onRevealInBrowser,
    onClose,
    onCloseOthers,
    onCloseToRight,
  } = props;
  const menuRef = useRef<HTMLDivElement>(null);
  const contract = tabKindContract(tab.kind);

  useEffect(() => {
    menuRef.current
      ?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not([disabled])')
      ?.focus();
  }, []);

  useEffect(() => {
    function onDocumentPointerDown(event: PointerEvent): void {
      const target = event.target;
      if (target instanceof Node && menuRef.current !== null && !menuRef.current.contains(target)) {
        onDismiss();
      }
    }
    document.addEventListener('pointerdown', onDocumentPointerDown);
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
  }, [onDismiss]);

  const items: readonly MenuItem[] = [
    {
      id: 'pin',
      label: tab.pinned ? 'Unpin' : 'Pin',
      onActivate: () => onTogglePin(tab.id),
      ...(contract?.supportsPin === true
        ? {}
        : { disabledReason: `${contract?.label ?? tab.kind} views cannot be pinned` }),
    },
    {
      id: 'duplicate',
      label: 'Duplicate view',
      onActivate: () => onDuplicate(tab.id),
      ...(contract?.duplicable === true
        ? {}
        : { disabledReason: `${contract?.label ?? tab.kind} views cannot be duplicated` }),
    },
    {
      id: 'reveal',
      label: 'Reveal in project browser',
      onActivate: () => onRevealInBrowser(tab.id),
    },
    {
      id: 'close',
      label: 'Close',
      separatedAbove: true,
      onActivate: () => onClose(tab.id),
      ...(tab.closeable ? {} : { disabledReason: 'This view stays open' }),
    },
    {
      id: 'close-others',
      label: 'Close others',
      onActivate: () => onCloseOthers(tab.id),
      ...(hasOtherClosableTabs ? {} : { disabledReason: 'No other views can be closed' }),
    },
    {
      id: 'close-right',
      label: 'Close tabs to the right',
      onActivate: () => onCloseToRight(tab.id),
      ...(hasClosableTabsToRight ? {} : { disabledReason: 'No views to the right can be closed' }),
    },
  ];

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${tab.title} view actions`}
      className="arq-tab-context-menu arq-shell-panel"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onDismiss();
        }
      }}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        zIndex: 6,
        minWidth: 240,
        padding: 'var(--arq-space-micro)',
        border: '1px solid var(--arq-ui-line-default)',
        borderRadius: 'var(--arq-radius-menu)',
        background: 'var(--arq-ui-paper)',
        boxShadow: 'var(--arq-shadow-menu)',
      }}
    >
      {items.map((item) => {
        const disabled = item.disabledReason !== undefined;
        return (
          <div key={item.id}>
            {item.separatedAbove === true && (
              <hr
                aria-hidden="true"
                style={{
                  border: 0,
                  borderTop: '1px solid var(--arq-ui-line-subtle)',
                  margin: 'var(--arq-space-micro) 0',
                }}
              />
            )}
            <button
              type="button"
              role="menuitem"
              className="arq-shell-button"
              disabled={disabled}
              aria-label={disabled ? `${item.label}. ${item.disabledReason}` : undefined}
              title={item.disabledReason}
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => {
                item.onActivate();
                onDismiss();
              }}
            >
              {item.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
