import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { planTopBarLayout, type TopBarSlot } from '@arq/workspace';
import { Logo } from '../logo';
import {
  describeSaveState,
  describeSyncState,
  resolveProjectNameEdit,
  undoTooltip,
  redoTooltip,
  type SaveState,
  type SyncState,
} from './top-bar-state';

export interface TopBarProps {
  readonly projectName: string;
  readonly onRenameProject: (name: string) => void;
  readonly activeViewName: string;
  readonly saveState: SaveState;
  readonly syncState: SyncState;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly lastUndoActionLabel: string | null;
  readonly lastRedoActionLabel: string | null;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onOpenProject: () => void;
  readonly onShare: () => void;
  readonly onOpenCommandPalette: () => void;
  readonly onOpenAccountMenu: () => void;
}

/**
 * ARQ-023: build top bar. Blueprint section 12 > "Top application bar" - see
 * top-bar-state.ts for the section's rules and this component's non-goals.
 *
 * States: hover/focus/disabled come from shell-controls.css's shared
 * `.arq-shell-button` (every button below uses it); a native `<button
 * disabled>` is unclickable and unfocusable, matching "destructive pending
 * states must not be hidden inside menus" by keeping undo/redo directly
 * visible (disabled, not removed) rather than tucked away when unavailable.
 * Keyboard: every control is a native button/input, reachable by Tab in
 * document order; Escape/Enter on the project-name input are handled
 * explicitly below (rename is "inline but reversible", section 12).
 * iPad touch: `.arq-shell-button` enforces the 44px minimum touch target
 * (section 121) regardless of pointer type.
 */
/** Doc 36's bar order, left to right. `planTopBarLayout` never reorders it. */
const ALL_SLOTS: readonly TopBarSlot[] = [
  'project-identity',
  'active-view',
  'save-state',
  'sync-state',
  'undo',
  'redo',
  'presence',
  'open',
  'share',
  'command-search',
  'account',
];

/** `--arq-space-control-group`, the flex gap each slot also occupies. */
const GAP_PX = 12;
/** The logo plus the header's own horizontal padding. */
const RESERVED_PX = 24 + 32;
const OVERFLOW_WIDTH_PX = 44;

export function TopBar(props: TopBarProps): JSX.Element {
  const {
    projectName,
    onRenameProject,
    activeViewName,
    saveState,
    syncState,
    canUndo,
    canRedo,
    lastUndoActionLabel,
    lastRedoActionLabel,
    onUndo,
    onRedo,
    onOpenProject,
    onShare,
    onOpenCommandPalette,
    onOpenAccountMenu,
  } = props;

  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  const [menuOpen, setMenuOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const slotRefs = useRef(new Map<TopBarSlot, HTMLElement>());
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [plan, setPlan] = useState<{
    readonly visible: readonly TopBarSlot[];
    readonly collapsed: readonly TopBarSlot[];
  }>({ visible: ALL_SLOTS, collapsed: [] });
  const [measuredAvailable, setMeasuredAvailable] = useState(0);
  /*
   * Natural widths, captured once per slot and never re-measured while that
   * slot is collapsed. A collapsed slot is `display: none` and therefore
   * measures zero - feeding that back into the plan would say "it fits now",
   * un-collapse it, and oscillate forever. Remembering the width it had when it
   * was last visible is what makes the plan stable and reversible.
   */
  const naturalWidths = useRef(new Map<TopBarSlot, number>());

  /*
   * Measure, then plan. Doc 36's collapse priority is about what *fits*, and
   * the only honest way to know that is to measure the rendered controls -
   * every attempt to guess from a breakpoint has been wrong here, most visibly
   * when this bar wrapped to three rows on a phone.
   *
   * `useLayoutEffect` so the plan is applied before paint: measuring in a
   * passive effect shows the user one frame of the overflowing bar.
   */
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (bar === null) {
      return;
    }
    const measure = (): void => {
      for (const [slot, node] of slotRefs.current) {
        const width = node.getBoundingClientRect().width;
        // Zero means this slot is currently collapsed (`display: none`). Keep
        // the width it had when last visible: feeding the zero back in would
        // say "it fits now", un-collapse it, and oscillate forever.
        if (width > 0) {
          naturalWidths.current.set(slot, width + GAP_PX);
        }
      }
      const widths = Object.fromEntries(naturalWidths.current) as Partial<
        Record<TopBarSlot, number>
      >;
      const available = bar.clientWidth - RESERVED_PX;
      setMeasuredAvailable(available);
      setPlan(planTopBarLayout(ALL_SLOTS, available, widths, OVERFLOW_WIDTH_PX));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [projectName, activeViewName, saveState, syncState]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    // Same rule as the phone bar's More menu: opening a menu must put the user
    // in it, or Escape never reaches the menu's own handler.
    menuRef.current
      ?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not([disabled])')
      ?.focus();
  }, [menuOpen]);

  function closeMenuAndRestoreFocus(): void {
    setMenuOpen(false);
    triggerRef.current?.focus();
  }

  function registerSlot(slot: TopBarSlot) {
    return (node: HTMLElement | null): void => {
      if (node === null) {
        slotRefs.current.delete(slot);
      } else {
        slotRefs.current.set(slot, node);
      }
    };
  }

  const visible = new Set(plan.visible);

  function beginEdit(): void {
    setDraftName(projectName);
    setIsEditingName(true);
  }

  function endEdit(committed: boolean): void {
    const resolved = resolveProjectNameEdit(projectName, draftName, committed);
    if (committed && resolved !== projectName) {
      onRenameProject(resolved);
    }
    setIsEditingName(false);
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      endEdit(true);
    } else if (event.key === 'Escape') {
      endEdit(false);
    }
  }

  const SLOT_CONTENT: Readonly<Record<TopBarSlot, { label: string; node: ReactNode }>> = {
    'project-identity': {
      label: 'Project name',
      node: isEditingName ? (
        <input
          autoFocus
          aria-label="Project name"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={() => endEdit(true)}
          onKeyDown={handleNameKeyDown}
        />
      ) : (
        <button
          type="button"
          className="arq-shell-button"
          aria-label={`Project name: ${projectName}. Activate to rename.`}
          onClick={beginEdit}
          style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
        >
          {projectName}
        </button>
      ),
    },
    'active-view': {
      label: 'Active view',
      node: (
        <span
          aria-label="Active view"
          style={{
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'inline-block',
          }}
        >
          {activeViewName}
        </span>
      ),
    },
    undo: {
      label: 'Undo',
      node: (
        <button
          type="button"
          className="arq-shell-button"
          disabled={!canUndo}
          title={undoTooltip({ canUndo, canRedo }, lastUndoActionLabel) ?? undefined}
          aria-label="Undo"
          onClick={onUndo}
        >
          Undo
        </button>
      ),
    },
    redo: {
      label: 'Redo',
      node: (
        <button
          type="button"
          className="arq-shell-button"
          disabled={!canRedo}
          title={redoTooltip({ canUndo, canRedo }, lastRedoActionLabel) ?? undefined}
          aria-label="Redo"
          onClick={onRedo}
        >
          Redo
        </button>
      ),
    },
    /* Section 12: "save and sync must be separate concepts" - two independent
       indicators, never merged, even when both collapse together. */
    'save-state': {
      label: describeSaveState(saveState),
      node: <span aria-live="polite">{describeSaveState(saveState)}</span>,
    },
    'sync-state': {
      label: describeSyncState(syncState),
      node: <span aria-live="polite">{describeSyncState(syncState)}</span>,
    },
    open: {
      label: 'Open project',
      node: (
        <button type="button" className="arq-shell-button" onClick={onOpenProject}>
          Open
        </button>
      ),
    },
    share: {
      label: 'Share',
      node: (
        <button type="button" className="arq-shell-button" onClick={onShare}>
          Share
        </button>
      ),
    },
    'command-search': {
      label: 'Search commands',
      node: (
        <button
          type="button"
          className="arq-shell-button"
          aria-label="Search commands"
          onClick={onOpenCommandPalette}
        >
          Search
        </button>
      ),
    },
    account: {
      label: 'Account menu',
      node: (
        <button
          type="button"
          className="arq-shell-button"
          aria-label="Account menu"
          onClick={onOpenAccountMenu}
        >
          Account
        </button>
      ),
    },
    /* Presence is the first thing doc 36 collapses, and this build has no
       collaboration backend, so it renders nothing at all rather than an empty
       avatar strip that implies absent colleagues. */
    presence: { label: 'Presence', node: null },
  };

  /* An action that collapsed into the menu still has to *do* something there.
     A status word does not - it is read, not pressed - so it renders as a
     non-interactive row. */
  const MENU_ACTIONS: Partial<Record<TopBarSlot, () => void>> = {
    undo: onUndo,
    redo: onRedo,
    open: onOpenProject,
    share: onShare,
    'command-search': onOpenCommandPalette,
    account: onOpenAccountMenu,
  };

  return (
    <header
      ref={barRef}
      className="arq-top-bar arq-shell-panel"
      /*
       * The collapse plan, exposed for the workspace layout capability check.
       * Doc 36's priority is a layout promise, and a promise that cannot be
       * asserted from outside is one nobody notices breaking.
       */
      data-collapsed-slots={plan.collapsed.join(',')}
      data-measured-available={measuredAvailable}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--arq-space-control-group)',
        padding: 'var(--arq-space-compact) var(--arq-space-panel)',
        borderBottom: '1px solid var(--arq-ui-line-subtle)',
        /*
         * Doc 36's collapse priority, implemented in `planTopBarLayout`: the bar
         * measures itself and folds the lowest-priority controls into the
         * overflow menu, protecting project identity and active view at any
         * width. `nowrap` is safe now precisely because nothing is left to
         * overflow - before the plan existed this had to wrap, costing three
         * rows and 173px at phone width.
         */
        flexWrap: 'nowrap',
        minWidth: 0,
        position: 'relative',
      }}
    >
      <Logo variant="symbol" heightPx={24} />

      {ALL_SLOTS.map((slot) => {
        const content = SLOT_CONTENT[slot];
        if (content.node === null) {
          return null;
        }
        return (
          <span
            key={slot}
            ref={registerSlot(slot)}
            data-top-bar-slot={slot}
            style={{
              flex: '0 0 auto',
              minWidth: 0,
              // Collapsed slots keep their box for measurement but take no
              // space and are unreachable, so the plan can restore them when
              // the window widens again.
              display: visible.has(slot) ? 'inline-flex' : 'none',
            }}
          >
            {content.node}
          </span>
        );
      })}

      <div style={{ flex: 1 }} />

      {plan.collapsed.length > 0 && (
        <>
          <button
            type="button"
            ref={triggerRef}
            className="arq-shell-button arq-top-bar__overflow"
            aria-label={`${plan.collapsed.length} more project controls`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">⋯</span>
          </button>
          {menuOpen && (
            <div
              ref={menuRef}
              role="menu"
              aria-label="More project controls"
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
                right: 'var(--arq-space-panel)',
                zIndex: 8,
                minWidth: 220,
                padding: 'var(--arq-space-micro)',
                border: '1px solid var(--arq-ui-line-default)',
                borderRadius: 'var(--arq-radius-menu)',
                background: 'var(--arq-ui-paper)',
                boxShadow: 'var(--arq-shadow-menu)',
              }}
            >
              {plan.collapsed.map((slot) => {
                const action = MENU_ACTIONS[slot];
                const content = SLOT_CONTENT[slot];
                if (content.node === null) {
                  return null;
                }
                if (action === undefined) {
                  return (
                    <p
                      key={slot}
                      role="presentation"
                      style={{
                        margin: 0,
                        padding: 'var(--arq-space-compact) var(--arq-space-control-group)',
                        color: 'var(--arq-ui-text-secondary)',
                      }}
                    >
                      {content.label}
                    </p>
                  );
                }
                return (
                  <button
                    key={slot}
                    type="button"
                    role="menuitem"
                    className="arq-shell-button"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => {
                      action();
                      closeMenuAndRestoreFocus();
                    }}
                  >
                    {content.label}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </header>
  );
}
