import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  describeSaveState,
  describeSyncState,
  type SaveState,
  type SyncState,
} from '../shell/top-bar-state';

export interface PhoneProjectMenuItem {
  readonly id: string;
  readonly label: string;
  readonly onActivate: () => void;
  readonly disabledReason?: string;
}

export interface PhoneProjectBarProps {
  readonly projectName: string;
  readonly saveState: SaveState;
  readonly syncState: SyncState;
  readonly onBackToProjects: () => void;
  readonly menuItems: readonly PhoneProjectMenuItem[];
  readonly logo?: ReactNode;
}

/**
 * Doc 47 > "Base screen": "Top bar: Back/Projects, project name, active view,
 * status chip, More."
 *
 * This exists because the desktop `TopBar` is the wrong composition for a
 * phone, not merely a wide one. Measured at 393px it wrapped to three rows and
 * 173px against the registry's 48px allowance, taking a fifth of the screen
 * from a canvas doc 47 wants dominant. Wrapping was the right emergency fix for
 * a horizontal overflow; it is not a phone design.
 *
 * Doc 36's collapse priority — "presence labels, low-priority status text and
 * secondary collaboration actions collapse first", while "project identity and
 * active view never disappear" — is implemented here literally: identity and
 * status stay on the bar, and undo, redo, share, open and account move into
 * More. That is the overflow menu the earlier pass said was missing.
 *
 * Save and sync stay two separate words in one chip. Blueprint section 12's
 * rule is that they are "separate concepts", which is about not collapsing them
 * into a single status *enum* — "Saved · Offline" keeps both facts legible,
 * where a merged "Synced" would hide a local-save failure behind a network
 * state.
 */
export function PhoneProjectBar(props: PhoneProjectBarProps): JSX.Element {
  const { projectName, saveState, syncState, onBackToProjects, menuItems, logo } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    /*
     * Move focus to the first enabled item when the menu opens. Without this,
     * focus stays on the trigger *outside* the menu, so the menu's own Escape
     * handler never receives the key and a keyboard user has no way to dismiss
     * it - which is exactly what happened before this was added. It is also the
     * standard menu-button pattern: opening a menu should put the user in it.
     */
    const firstEnabled = menuRef.current?.querySelector<HTMLButtonElement>(
      'button[role="menuitem"]:not([disabled])',
    );
    firstEnabled?.focus();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onDocumentPointerDown(event: PointerEvent): void {
      const target = event.target;
      if (
        target instanceof Node &&
        menuRef.current !== null &&
        !menuRef.current.contains(target) &&
        triggerRef.current !== null &&
        !triggerRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('pointerdown', onDocumentPointerDown);
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
  }, [menuOpen]);

  function closeMenuAndRestoreFocus(): void {
    setMenuOpen(false);
    // Focus must come back to the trigger, or a keyboard or switch user is
    // dropped at the top of the document every time they dismiss the menu.
    triggerRef.current?.focus();
  }

  return (
    <header
      className="arq-phone-project-bar arq-shell-panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--arq-space-compact)',
        padding: '0 var(--arq-space-compact)',
        borderBottom: '1px solid var(--arq-ui-line-subtle)',
        // Doc 47 gestures / iOS: keep the bar clear of the notch and status bar.
        paddingTop: 'env(safe-area-inset-top, 0px)',
        position: 'relative',
        minWidth: 0,
      }}
    >
      <button
        type="button"
        className="arq-shell-button"
        aria-label="Back to projects"
        onClick={onBackToProjects}
        style={{ flex: '0 0 auto' }}
      >
        <span aria-hidden="true">‹</span>
      </button>

      {logo}

      <span
        className="arq-phone-project-bar__name"
        // Doc 36: project identity never disappears. It truncates rather than
        // wrapping or being dropped, and the full name stays in the title.
        title={projectName}
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 600,
        }}
      >
        {projectName}
      </span>

      <span
        className="arq-phone-project-bar__status"
        aria-live="polite"
        style={{
          flex: '0 0 auto',
          fontSize: '0.75em',
          color: 'var(--arq-ui-text-secondary)',
          whiteSpace: 'nowrap',
        }}
      >
        {describeSaveState(saveState)} · {describeSyncState(syncState)}
      </span>

      <button
        type="button"
        ref={triggerRef}
        className="arq-shell-button"
        aria-label="More project actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        style={{ flex: '0 0 auto' }}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Project actions"
          className="arq-shell-panel"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              closeMenuAndRestoreFocus();
            }
          }}
          style={{
            position: 'absolute',
            top: '100%',
            right: 'var(--arq-space-compact)',
            zIndex: 6,
            minWidth: 200,
            padding: 'var(--arq-space-micro)',
            border: '1px solid var(--arq-ui-line-default)',
            borderRadius: 'var(--arq-radius-menu)',
            background: 'var(--arq-ui-paper)',
            boxShadow: '0 4px 16px rgb(0 0 0 / 18%)',
          }}
        >
          {menuItems.map((item) => {
            const disabled = item.disabledReason !== undefined;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className="arq-shell-button"
                disabled={disabled}
                aria-label={disabled ? `${item.label}. ${item.disabledReason}` : undefined}
                title={item.disabledReason}
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  item.onActivate();
                  closeMenuAndRestoreFocus();
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
