import { describe, expect, it } from 'vitest';
import {
  NEVER_COLLAPSED_SLOTS,
  isProtectedTopBarSlot,
  planTopBarLayout,
  type TopBarSlot,
} from './collapse-priority';

const ALL: readonly TopBarSlot[] = [
  'project-identity',
  'active-view',
  'save-state',
  'sync-state',
  'undo',
  'redo',
  'open',
  'command-search',
  'share',
  'presence',
  'account',
];

/** Every slot 100px wide, so the arithmetic in each case is obvious. */
const EVEN: Readonly<Partial<Record<TopBarSlot, number>>> = Object.fromEntries(
  ALL.map((slot) => [slot, 100]),
);

describe('planTopBarLayout', () => {
  it('collapses nothing when everything fits, and needs no overflow button', () => {
    const plan = planTopBarLayout(ALL, 1100, EVEN, 40);
    expect(plan.collapsed).toEqual([]);
    expect(plan.visible).toEqual(ALL);
  });

  /**
   * Doc 36: "At compact widths, project identity and active view never
   * disappear." The strongest form of the test - a width that fits almost
   * nothing.
   */
  it('never collapses project identity or the active view, however tight', () => {
    for (const width of [0, 50, 150, 300]) {
      const plan = planTopBarLayout(ALL, width, EVEN, 40);
      expect(plan.visible).toContain('project-identity');
      expect(plan.visible).toContain('active-view');
      expect(plan.collapsed).not.toContain('project-identity');
      expect(plan.collapsed).not.toContain('active-view');
    }
  });

  /**
   * Doc 36's order: "Presence labels, low-priority status text and secondary
   * collaboration actions collapse first."
   */
  it('collapses presence first, then status text, then share', () => {
    // Room for the two protected slots, the overflow button and four others.
    const plan = planTopBarLayout(ALL, 200 + 40 + 400, EVEN, 40);
    expect(plan.collapsed.slice(0, 4)).toEqual(['presence', 'save-state', 'sync-state', 'share']);
  });

  it('keeps the working controls longest', () => {
    const plan = planTopBarLayout(ALL, 200 + 40 + 200, EVEN, 40);
    expect(plan.visible).toContain('command-search');
    expect(plan.visible).toContain('undo');
    expect(plan.collapsed).toContain('presence');
  });

  it('reserves the overflow button width so the menu itself always fits', () => {
    // 200 protected + 40 overflow leaves 160 for optional slots: one 100px slot.
    const plan = planTopBarLayout(ALL, 400, EVEN, 40);
    const optionalVisible = plan.visible.filter((slot) => !isProtectedTopBarSlot(slot));
    expect(optionalVisible).toHaveLength(1);
  });

  it('preserves the caller’s order on the bar and collapse order in the menu', () => {
    const plan = planTopBarLayout(ALL, 640, EVEN, 40);
    const rank = (slot: TopBarSlot): number => ALL.indexOf(slot);
    expect(plan.visible.map(rank)).toEqual([...plan.visible.map(rank)].sort((a, b) => a - b));
    // The menu leads with what collapsed first, so it does not reshuffle as the
    // window narrows further.
    expect(plan.collapsed[0]).toBe('presence');
  });

  it('accounts every slot exactly once', () => {
    for (const width of [0, 300, 640, 900, 2000]) {
      const plan = planTopBarLayout(ALL, width, EVEN, 40);
      expect([...plan.visible, ...plan.collapsed].sort()).toEqual([...ALL].sort());
    }
  });

  it('treats an unmeasured slot as costless rather than crashing', () => {
    const plan = planTopBarLayout(ALL, 300, {}, 40);
    expect(plan.collapsed).toEqual([]);
  });
});

describe('NEVER_COLLAPSED_SLOTS', () => {
  it('is exactly doc 36’s protected pair', () => {
    expect([...NEVER_COLLAPSED_SLOTS].sort()).toEqual(['active-view', 'project-identity']);
    expect(isProtectedTopBarSlot('share')).toBe(false);
  });
});
