/**
 * Doc 39 ("Left Project Browser Panel") > "Performance":
 *
 *   "Virtualise large trees. Expanding a 5,000-element model must not render
 *    every row. Preserve focus/selection across virtualisation."
 *
 * The second sentence is the hard part and the reason this is state rather than
 * a rendering trick. A naive window renders only what is on screen, which means
 * the focused row can be unmounted while it still holds focus - the browser
 * moves focus to `<body>`, and a keyboard user is silently ejected from the
 * tree. `visibleTreeWindow` therefore always includes the focused row, even
 * when scrolled out of view.
 *
 * Flattening is separate from windowing on purpose: only *expanded* branches
 * contribute rows, so a collapsed 5,000-element level costs one row, not five
 * thousand, before any windowing happens at all.
 */

export interface FlatTreeNode<T> {
  readonly id: string;
  readonly depth: number;
  readonly node: T;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
}

export interface TreeSource<T> {
  readonly id: (node: T) => string;
  readonly children: (node: T) => readonly T[] | undefined;
}

/**
 * Flattens the expanded portion of a tree into the row list a virtualiser can
 * index. A collapsed branch contributes exactly one row regardless of how much
 * it contains, which is most of doc 39's performance requirement on its own.
 */
export function flattenVisibleTree<T>(
  roots: readonly T[],
  expandedIds: ReadonlySet<string>,
  source: TreeSource<T>,
): readonly FlatTreeNode<T>[] {
  const rows: FlatTreeNode<T>[] = [];

  const walk = (nodes: readonly T[], depth: number): void => {
    for (const node of nodes) {
      const id = source.id(node);
      const children = source.children(node);
      const hasChildren = children !== undefined && children.length > 0;
      const expanded = hasChildren && expandedIds.has(id);
      rows.push({ id, depth, node, hasChildren, expanded });
      if (expanded && children !== undefined) {
        walk(children, depth + 1);
      }
    }
  };

  walk(roots, 0);
  return rows;
}

export interface TreeWindowInput {
  readonly totalRows: number;
  readonly rowHeightPx: number;
  readonly scrollTopPx: number;
  readonly viewportHeightPx: number;
  /**
   * Rows rendered beyond each edge. A small buffer means a fast scroll shows
   * blank space for a frame; a large one gives back the performance the
   * virtualiser exists to win.
   */
  readonly overscanRows: number;
  /**
   * Index of the row holding keyboard focus, if any. Always rendered, however
   * far it has been scrolled out of view - see this module's own doc comment.
   */
  readonly focusedIndex?: number;
}

export interface TreeWindow {
  readonly startIndex: number;
  /** Exclusive. */
  readonly endIndex: number;
  /** Spacer height above the rendered rows, in px. */
  readonly paddingTopPx: number;
  /** Spacer height below, in px, so the scrollbar reflects the whole tree. */
  readonly paddingBottomPx: number;
  /**
   * Set when the focused row falls outside the scrolled window and is being
   * rendered anyway. The caller renders it out of flow; nothing else changes.
   */
  readonly detachedFocusIndex: number | null;
}

/**
 * The slice of rows to render for a scroll position.
 *
 * Padding above and below is what keeps the scrollbar honest: without it a
 * 5,000-row tree would scroll as though it had thirty rows, and the user's
 * sense of how big the project is would be wrong.
 */
export function visibleTreeWindow(input: TreeWindowInput): TreeWindow {
  const { totalRows, rowHeightPx, scrollTopPx, viewportHeightPx, overscanRows } = input;

  if (totalRows === 0 || rowHeightPx <= 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      paddingTopPx: 0,
      paddingBottomPx: 0,
      detachedFocusIndex: null,
    };
  }

  const firstVisible = Math.floor(Math.max(0, scrollTopPx) / rowHeightPx);
  const visibleCount = Math.ceil(viewportHeightPx / rowHeightPx);

  const startIndex = Math.max(0, firstVisible - overscanRows);
  const endIndex = Math.min(totalRows, firstVisible + visibleCount + overscanRows);

  const focusedIndex = input.focusedIndex;
  const focusOutsideWindow =
    focusedIndex !== undefined &&
    focusedIndex >= 0 &&
    focusedIndex < totalRows &&
    (focusedIndex < startIndex || focusedIndex >= endIndex);

  return {
    startIndex,
    endIndex,
    paddingTopPx: startIndex * rowHeightPx,
    paddingBottomPx: (totalRows - endIndex) * rowHeightPx,
    detachedFocusIndex: focusOutsideWindow ? focusedIndex : null,
  };
}

/**
 * How far to scroll so a row is fully in view, or null when it already is.
 * Used when selection moves by keyboard - doc 39 requires arrow keys to
 * "traverse tree semantics", which is useless if the row they land on is off
 * screen.
 */
export function scrollTopForRow(
  index: number,
  rowHeightPx: number,
  scrollTopPx: number,
  viewportHeightPx: number,
): number | null {
  const rowTop = index * rowHeightPx;
  const rowBottom = rowTop + rowHeightPx;
  if (rowTop < scrollTopPx) {
    return rowTop;
  }
  if (rowBottom > scrollTopPx + viewportHeightPx) {
    return rowBottom - viewportHeightPx;
  }
  return null;
}
