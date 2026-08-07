/**
 * Doc 36 ("Editor Shell Master Layout") > "Top project bar placement":
 *
 *   "At compact widths, project identity and active view never disappear.
 *    Presence labels, low-priority status text and secondary collaboration
 *    actions collapse first."
 *
 * And `workspace-layout-slots.json` > `compact1366.collapsePriority`, which
 * names the same order: presence labels, low-priority status text, then the
 * inspector to overlay.
 *
 * That is a *ranking*, so it is modelled as one. The alternative - a stack of
 * `@media` rules that each guess which controls happen to fit - drifts the
 * moment a control's label changes length, and cannot state which things are
 * protected. Here the protected set is a named list that a test asserts.
 */

export type TopBarSlot =
  | 'project-identity'
  | 'view-switcher'
  | 'save-state'
  | 'sync-state'
  | 'undo'
  | 'redo'
  | 'open'
  | 'command-search'
  | 'share'
  | 'presence'
  | 'account';

/**
 * Doc 36's protected set: these never collapse, at any width. Project identity
 * answers "which building am I in" and the view switcher answers "which drawing,
 * and how do I get to the others" - a user who cannot see either has lost their
 * place, which is worse than any amount of crowding.
 *
 * The second slot used to be `active-view`, a text readout of the open view's
 * name. It is a control now rather than a label, which raises the stakes rather
 * than lowering them: collapsing it into an overflow menu would put the only
 * way between plan, model and sheets behind a button marked with three dots.
 */
export const NEVER_COLLAPSED_SLOTS: readonly TopBarSlot[] = ['project-identity', 'view-switcher'];

/**
 * Collapse order, lowest value collapsing first. Read straight from doc 36's
 * sentence and the registry's `collapsePriority`, in that order:
 *
 * 1. presence labels
 * 2. low-priority status text (save and sync words)
 * 3. secondary collaboration actions (share)
 *
 * Undo, redo and command search rank above those because they are the bar's
 * *working* controls; they still collapse before the protected pair, since an
 * overflow menu keeps them reachable while nothing keeps a lost project name
 * reachable.
 */
const COLLAPSE_RANK: Readonly<Record<TopBarSlot, number>> = {
  presence: 0,
  'save-state': 1,
  'sync-state': 1,
  share: 2,
  account: 3,
  open: 4,
  redo: 5,
  undo: 6,
  'command-search': 7,
  'view-switcher': 98,
  'project-identity': 99,
};

export interface TopBarLayoutPlan {
  /** Rendered directly on the bar, in the caller's original order. */
  readonly visible: readonly TopBarSlot[];
  /** Moved into the overflow menu, in collapse order so the menu is stable. */
  readonly collapsed: readonly TopBarSlot[];
}

/**
 * Decides which slots stay on the bar at a given width.
 *
 * `availableWidthPx` and `slotWidthsPx` are measured by the caller, because the
 * only honest way to know whether a control fits is to measure the control -
 * the phone bar's predecessor wrapped to three rows precisely because a
 * breakpoint guessed and was wrong.
 *
 * The protected slots are reserved before anything else is admitted, so they
 * cannot be squeezed out by a long chain of buttons. If even they do not fit,
 * they are still returned: doc 36 says they never disappear, and a bar that
 * truncates a project name is better than one that hides it.
 */
export function planTopBarLayout(
  slots: readonly TopBarSlot[],
  availableWidthPx: number,
  slotWidthsPx: Readonly<Partial<Record<TopBarSlot, number>>>,
  overflowButtonWidthPx: number,
): TopBarLayoutPlan {
  const width = (slot: TopBarSlot): number => slotWidthsPx[slot] ?? 0;
  const protectedSlots = slots.filter((slot) => NEVER_COLLAPSED_SLOTS.includes(slot));
  const optional = slots.filter((slot) => !NEVER_COLLAPSED_SLOTS.includes(slot));

  const protectedWidth = protectedSlots.reduce((sum, slot) => sum + width(slot), 0);

  // Everything fits: no overflow button is needed, so it costs no width either.
  const totalWidth = protectedWidth + optional.reduce((sum, slot) => sum + width(slot), 0);
  if (totalWidth <= availableWidthPx) {
    return { visible: slots, collapsed: [] };
  }

  // Admit optional slots from the highest rank down, since the lowest-ranked
  // are the ones doc 36 wants gone first.
  const byRankDescending = [...optional].sort((a, b) => COLLAPSE_RANK[b] - COLLAPSE_RANK[a]);
  const budget = availableWidthPx - protectedWidth - overflowButtonWidthPx;
  const admitted = new Set<TopBarSlot>();
  let used = 0;
  for (const slot of byRankDescending) {
    const next = used + width(slot);
    if (next <= budget) {
      admitted.add(slot);
      used = next;
    }
  }

  return {
    visible: slots.filter((slot) => protectedSlots.includes(slot) || admitted.has(slot)),
    collapsed: optional
      .filter((slot) => !admitted.has(slot))
      .sort((a, b) => COLLAPSE_RANK[a] - COLLAPSE_RANK[b]),
  };
}

/** True when a slot may never be moved into the overflow menu. */
export function isProtectedTopBarSlot(slot: TopBarSlot): boolean {
  return NEVER_COLLAPSED_SLOTS.includes(slot);
}
