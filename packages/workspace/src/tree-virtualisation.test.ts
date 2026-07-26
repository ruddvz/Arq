import { describe, expect, it } from 'vitest';
import {
  flattenVisibleTree,
  scrollTopForRow,
  visibleTreeWindow,
  type TreeSource,
} from './tree-virtualisation';

interface Node {
  readonly id: string;
  readonly children?: readonly Node[];
}

const source: TreeSource<Node> = { id: (n) => n.id, children: (n) => n.children };

/** A level holding `count` elements, as doc 39's 5,000-element case. */
function level(count: number): Node {
  return {
    id: 'level-1',
    children: Array.from({ length: count }, (_, i) => ({ id: `e${i}` })),
  };
}

describe('flattenVisibleTree', () => {
  /**
   * Doc 39: "Expanding a 5,000-element model must not render every row." Most
   * of that is won before windowing: a collapsed branch is one row.
   */
  it('costs one row for a collapsed 5,000-element level', () => {
    const rows = flattenVisibleTree([level(5000)], new Set(), source);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.hasChildren).toBe(true);
    expect(rows[0]?.expanded).toBe(false);
  });

  it('includes the children of an expanded branch, with depth', () => {
    const rows = flattenVisibleTree([level(3)], new Set(['level-1']), source);
    expect(rows.map((r) => r.id)).toEqual(['level-1', 'e0', 'e1', 'e2']);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 1]);
  });

  it('does not mark a childless node expandable, even if it is in the expanded set', () => {
    const rows = flattenVisibleTree([{ id: 'leaf' }], new Set(['leaf']), source);
    expect(rows[0]?.hasChildren).toBe(false);
    expect(rows[0]?.expanded).toBe(false);
  });

  it('walks arbitrarily deep nesting', () => {
    const deep: Node = { id: 'a', children: [{ id: 'b', children: [{ id: 'c' }] }] };
    const rows = flattenVisibleTree([deep], new Set(['a', 'b']), source);
    expect(rows.map((r) => `${r.id}@${r.depth}`)).toEqual(['a@0', 'b@1', 'c@2']);
  });
});

describe('visibleTreeWindow', () => {
  const base = {
    totalRows: 5000,
    rowHeightPx: 24,
    scrollTopPx: 0,
    viewportHeightPx: 480,
    overscanRows: 5,
  };

  /** The headline requirement: a 5,000-row tree renders tens of rows, not 5,000. */
  it('renders a small window of a very large tree', () => {
    const window = visibleTreeWindow(base);
    expect(window.endIndex - window.startIndex).toBeLessThan(40);
    expect(window.startIndex).toBe(0);
  });

  it('keeps the scrollbar honest with padding for the rows it did not render', () => {
    const window = visibleTreeWindow({ ...base, scrollTopPx: 2400 });
    const rendered = (window.endIndex - window.startIndex) * base.rowHeightPx;
    expect(window.paddingTopPx + rendered + window.paddingBottomPx).toBe(
      base.totalRows * base.rowHeightPx,
    );
  });

  it('clamps at both ends rather than windowing past the tree', () => {
    expect(visibleTreeWindow({ ...base, scrollTopPx: -100 }).startIndex).toBe(0);
    const atEnd = visibleTreeWindow({ ...base, scrollTopPx: 5000 * 24 });
    expect(atEnd.endIndex).toBe(5000);
    expect(atEnd.paddingBottomPx).toBe(0);
  });

  /**
   * The reason this is state and not a rendering trick: unmounting the focused
   * row moves focus to `<body>` and silently ejects a keyboard user from the
   * tree.
   */
  it('always renders the focused row, however far it is scrolled away', () => {
    const window = visibleTreeWindow({ ...base, scrollTopPx: 4000, focusedIndex: 3 });
    expect(window.detachedFocusIndex).toBe(3);
  });

  it('does not detach a focused row that the window already covers', () => {
    const window = visibleTreeWindow({ ...base, scrollTopPx: 0, focusedIndex: 2 });
    expect(window.detachedFocusIndex).toBeNull();
  });

  it('ignores a focus index outside the tree', () => {
    expect(visibleTreeWindow({ ...base, focusedIndex: -1 }).detachedFocusIndex).toBeNull();
    expect(visibleTreeWindow({ ...base, focusedIndex: 99999 }).detachedFocusIndex).toBeNull();
  });

  it('handles an empty tree without producing a negative window', () => {
    const window = visibleTreeWindow({ ...base, totalRows: 0 });
    expect(window).toEqual({
      startIndex: 0,
      endIndex: 0,
      paddingTopPx: 0,
      paddingBottomPx: 0,
      detachedFocusIndex: null,
    });
  });
});

describe('scrollTopForRow', () => {
  it('scrolls up to a row above the viewport and down to one below', () => {
    expect(scrollTopForRow(2, 24, 240, 480)).toBe(48);
    expect(scrollTopForRow(40, 24, 0, 480)).toBe(24 * 41 - 480);
  });

  it('returns null when the row is already fully visible', () => {
    expect(scrollTopForRow(5, 24, 0, 480)).toBeNull();
  });
});
