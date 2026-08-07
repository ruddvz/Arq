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
  /**
   * The view switcher, already built by the host - plan, model, sheets.
   *
   * This slot used to be a text readout of the open view's name, on the bar
   * beside four other phrases, while the switching itself happened on a row of
   * closeable tabs underneath. The reference composition has one control in the
   * centre of the bar and no second row, so the readout became the control: the
   * view's name is on the drawing's own identity chip, which is where a reader
   * looks for it.
   */
  readonly viewSwitcher: ReactNode;
  /** Opens the project overview. The logo is its entrance - see the render. */
  readonly onOpenProjectOverview: () => void;
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
  /**
   * Already-resolved glyphs for the actions that have one, keyed by slot. The
   * same seam `ToolRail` keeps with `categoryIcons`: this package names no icon
   * library. A slot with no glyph keeps its text label, which is what every one
   * of them showed before.
   */
  readonly actionIcons?: Readonly<Partial<Record<TopBarSlot, ReactNode>>>;
  /**
   * What the project is, under its name: revision, units, whatever identifies
   * this file rather than this session. Absent renders nothing, which is what
   * the bar showed before.
   */
  readonly projectSubtitle?: string;
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
/**
 * The first slot that is an action rather than an identity.
 *
 * Everything before it says *what you are looking at* - project, view, whether
 * it is saved and synced. Everything from here on is something you can *do*.
 * The bar used to render both groups as one undifferentiated run of buttons
 * pinned left, so the project's name had the same weight as Redo and the
 * critique's "navigation and commands were not sufficiently separated" was
 * literally true of the top of the window.
 */
/**
 * Which of the bar's three regions each slot belongs to.
 *
 * The bar is a three-column grid, not a flex row with a gutter in it, and the
 * difference is the reason the switcher is actually in the middle. Two equal
 * flex gutters only centre a child when the content either side of them is
 * equally wide, and here it never is - the project's name on the left against
 * two state readouts and six buttons on the right. The capsule sat visibly left
 * of centre for exactly that reason. `1fr auto 1fr` centres it whatever flanks
 * it.
 *
 * Exhaustive over `TopBarSlot`, so a new slot has to declare where it lives
 * rather than defaulting into a region by accident.
 */
const SLOT_REGION: Readonly<Record<TopBarSlot, 'lead' | 'centre' | 'trail'>> = {
  'project-identity': 'lead',
  'view-switcher': 'centre',
  'save-state': 'trail',
  'sync-state': 'trail',
  undo: 'trail',
  redo: 'trail',
  presence: 'trail',
  open: 'trail',
  share: 'trail',
  'command-search': 'trail',
  account: 'trail',
};

/*
 * Order is the reading order, and the identity group is now one thing: the
 * project's name with what the project is beneath it. The view name and the two
 * state readouts moved after the spacer, to the right-hand group.
 *
 * They were left of it, so the bar opened with four unrelated phrases in a row
 * - "Courtyard House Reference", "Level 1 Plan", "Unsaved changes", "Sync not
 * configured" - and the one a reader actually looks for was the hardest to pick
 * out. None of them is dropped; state is reported where state belongs.
 */
const ALL_SLOTS: readonly TopBarSlot[] = [
  'project-identity',
  'view-switcher',
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

/** The slots that compete for the trailing column. See the measure loop. */
const TRAIL_SLOTS: readonly TopBarSlot[] = ALL_SLOTS.filter(
  (slot) => SLOT_REGION[slot] === 'trail',
);

/** `--arq-space-control-group`, the flex gap each slot also occupies. */
const GAP_PX = 12;
/**
 * Slack kept inside the trailing column, in CSS pixels.
 *
 * The column's own width already excludes the bar's padding - it is a grid
 * track, not the bar - so this is only a margin of error against sub-pixel
 * rounding and the gap between the last control and the column's edge.
 */
const TRAIL_RESERVE_PX = 8;
const OVERFLOW_WIDTH_PX = 44;

export function TopBar(props: TopBarProps): JSX.Element {
  const {
    projectName,
    onRenameProject,
    viewSwitcher,
    onOpenProjectOverview,
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
    actionIcons,
    projectSubtitle,
  } = props;

  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  const [menuOpen, setMenuOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
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
      /*
       * The budget is the trailing region's own width, not the bar's.
       *
       * The bar is `1fr auto 1fr` and the switcher is the `auto`, so keeping it
       * centred means the two side columns are equal by construction: whatever
       * space is left after the switcher, the trailing controls can only have
       * half of it. Planning against the whole bar told them they had twice
       * what they do, so at 1366px "Sheets" and "Unsaved changes" were painted
       * on top of each other.
       *
       * Measured rather than derived, because a `1fr` column's width is a fact
       * the browser already knows and any arithmetic here would be a second
       * opinion about it.
       */
      const trail = trailRef.current;
      const available = (trail?.clientWidth ?? bar.clientWidth) - TRAIL_RESERVE_PX;
      setMeasuredAvailable(available);
      // Only the trailing slots are planned. The other two are protected and
      // live in their own columns, so they are not competing for this space and
      // including them would have the planner reserve room twice.
      setPlan(planTopBarLayout(TRAIL_SLOTS, available, widths, OVERFLOW_WIDTH_PX));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
    /*
     * `viewSwitcher` is in the dependencies because the capsule's width changes
     * with what is in it - a project with sheets is wider than one without -
     * and a plan measured against the old width would collapse the wrong slot.
     */
  }, [projectName, viewSwitcher, saveState, syncState]);

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
        /*
         * Two lines, and the second is what the project *is* - its revision and
         * units. The bar used to set the name beside a run of session state
         * ("Level 1 Plan", "Unsaved changes", "Sync not configured"), four
         * unrelated phrases in one horizontal line, so the one thing a reader
         * looks for was the hardest to find. The state is still reported; it is
         * reported where state belongs.
         */
        <button
          type="button"
          className="arq-shell-button arq-top-bar__identity"
          aria-label={`Project name: ${projectName}. Activate to rename.`}
          onClick={beginEdit}
        >
          <span className="arq-top-bar__identity-name">{projectName}</span>
          {projectSubtitle !== undefined && projectSubtitle !== '' && (
            <span className="arq-top-bar__identity-detail">{projectSubtitle}</span>
          )}
        </button>
      ),
    },
    'view-switcher': { label: 'View kind', node: viewSwitcher },
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
          {actionIcons?.['undo'] ?? 'Undo'}
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
          {actionIcons?.['redo'] ?? 'Redo'}
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
    /*
     * Every one of these carries an explicit accessible name, and that is not
     * belt-and-braces: a button whose only child is a glyph has *no* accessible
     * name at all. Replacing the word "Open" with a mark took the name away
     * with it, so the control announced nothing and could not be found by name
     * - the blueprint's "no mystery icons" rule failing in the most literal
     * way, and how it was caught.
     */
    open: {
      label: 'Open project',
      node: (
        <button
          type="button"
          className="arq-shell-button"
          aria-label="Open"
          onClick={onOpenProject}
        >
          {actionIcons?.['open'] ?? 'Open'}
        </button>
      ),
    },
    share: {
      label: 'Share',
      node: (
        <button type="button" className="arq-shell-button" aria-label="Share" onClick={onShare}>
          {actionIcons?.['share'] ?? 'Share'}
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
          {actionIcons?.['command-search'] ?? 'Search'}
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
          {actionIcons?.['account'] ?? 'Account'}
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

  const overflow =
    plan.collapsed.length === 0 ? null : (
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
    );

  return (
    <header
      ref={barRef}
      /*
       * The optical material, from `material.css` - the only file permitted to
       * declare `backdrop-filter` (ADR-0031). The bar is a bounded navigation
       * shell floating over the canvas, which is the package's first case for
       * it, and its own fallbacks travel with the class.
       */
      className="arq-top-bar arq-shell-panel arq-material arq-material--optical"
      /*
       * The collapse plan, exposed for the workspace layout capability check.
       * Doc 36's priority is a layout promise, and a promise that cannot be
       * asserted from outside is one nobody notices breaking.
       */
      data-collapsed-slots={plan.collapsed.join(',')}
      data-measured-available={measuredAvailable}
      style={{
        display: 'grid',
        /*
         * `minmax(0, 1fr)`, not `1fr`. A grid track's default minimum is
         * `auto`, so a `1fr` side column grows to fit its content rather than
         * shrinking - and the project's name is wide enough to push the centre
         * column off centre, which is the one thing this layout exists to
         * prevent. The name already truncates with an ellipsis, which is what
         * doc 36's "identity never disappears" means at a width where it cannot
         * all be shown.
         */
        gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
        alignItems: 'center',
        gap: 'var(--arq-space-control-group)',
        padding: 'var(--arq-space-compact) var(--arq-space-panel)',
        borderBottom: '1px solid var(--arq-ui-line-subtle)',
        minWidth: 0,
        position: 'relative',
      }}
    >
      {(['lead', 'centre', 'trail'] as const).map((region) => (
        <div
          key={region}
          ref={region === 'trail' ? trailRef : undefined}
          className={`arq-top-bar__region arq-top-bar__region--${region}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--arq-space-control-group)',
            /*
             * `nowrap` is safe because `planTopBarLayout` folds the
             * lowest-priority controls into the overflow menu rather than
             * letting them run on - before that plan existed this bar wrapped
             * to three rows and cost 173px at phone width.
             */
            flexWrap: 'nowrap',
            minWidth: 0,
            justifyContent: region === 'trail' ? 'flex-end' : 'flex-start',
          }}
        >
          {region === 'lead' && (
            <>
              {/*
               * The logo is the way back to the project overview.
               *
               * The overview used to be the first tab on a strip this bar
               * replaced, and the reference composition has no entrance for it
               * at all. Rather than lose a whole surface or add a fourth
               * segment the reference does not have, the mark becomes the
               * control - which is where a reader of almost any application
               * already expects "take me to the top" to be. It is the one
               * affordance here not taken from the reference, and it is a
               * button with a name rather than a picture that happens to be
               * clickable.
               */}
              <button
                type="button"
                className="arq-shell-button arq-top-bar__home"
                aria-label="Project overview"
                onClick={onOpenProjectOverview}
              >
                <Logo variant="symbol" heightPx={24} />
              </button>
            </>
          )}
          {ALL_SLOTS.filter((slot) => SLOT_REGION[slot] === region).map((slot) => {
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
                  // space and are unreachable, so the plan can restore them
                  // when the window widens again.
                  /*
                   * Only the trailing column is planned, so only it can hide a
                   * slot. The lead and the centre are protected and have
                   * columns of their own; asking the plan about them would
                   * report them collapsed and blank the bar.
                   */
                  display: region !== 'trail' || visible.has(slot) ? 'inline-flex' : 'none',
                }}
              >
                {content.node}
              </span>
            );
          })}
          {region === 'trail' && overflow}
        </div>
      ))}
    </header>
  );
}
