import { useMemo, useRef, useState } from 'react';
import { flattenVisibleTree, visibleTreeWindow, type TreeSource } from '@arq/workspace';
import {
  filterModelPanelTree,
  isNodePrimarySelection,
  isNodeSelected,
  type ModelPanelNode,
  type ModelPanelSelectionState,
} from './model-panel-state';

export interface ModelPanelProps {
  readonly tree: readonly ModelPanelNode[];
  readonly selection: ModelPanelSelectionState;
  readonly onSelectNode: (nodeId: string) => void;
}

/**
 * One flat row. The tree is flattened before rendering (see `flattenVisibleTree`),
 * so nesting is expressed by `aria-level` and indentation rather than nested
 * `<ul>` elements - a virtualised window slices a *list*, and a nested DOM tree
 * cannot be sliced without cutting branches out from under their parents.
 *
 * `aria-level`, `aria-posinset` and `aria-setsize` are what keep that honest for
 * a screen reader: they say "item 4,312 of 5,000 at depth 3" even though only
 * thirty rows exist in the DOM.
 */
function ModelPanelNodeRow(props: {
  readonly node: ModelPanelNode;
  readonly depth: number;
  readonly index: number;
  readonly total: number;
  readonly selection: ModelPanelSelectionState;
  readonly onSelectNode: (nodeId: string) => void;
}): JSX.Element {
  const { node, depth, index, total, selection, onSelectNode } = props;
  const hasChildren = node.children !== undefined && node.children.length > 0;
  return (
    <li
      role="treeitem"
      aria-selected={isNodeSelected(selection, node.id)}
      aria-expanded={hasChildren ? true : undefined}
      aria-level={depth + 1}
      aria-posinset={index + 1}
      aria-setsize={total}
      style={{ height: ROW_HEIGHT_PX }}
    >
      <button
        type="button"
        className="arq-shell-button"
        aria-pressed={isNodePrimarySelection(selection, node.id)}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 0,
          justifyContent: 'flex-start',
          paddingLeft: `calc(var(--arq-space-compact) + ${depth} * var(--arq-space-panel))`,
          opacity: node.hidden ? 0.5 : 1,
        }}
        onClick={() => onSelectNode(node.id)}
      >
        {/* Section 18: hidden state is never colour-only - a glyph and the
            reduced opacity together, plus the word in the accessible name. */}
        {node.hidden && <span aria-hidden="true">⊘ </span>}
        {node.displayName}
        {typeSuffixFor(node) !== null && (
          <span style={{ color: 'var(--arq-ui-text-muted)' }}> {typeSuffixFor(node)}</span>
        )}
      </button>
    </li>
  );
}

/**
 * The muted type suffix beside a row's name, or null when it would only stutter.
 *
 * The tree used to append the type unconditionally, so the top of every project
 * read "Site Site", "Building Building", "Level 1 Level" - three of the first
 * four rows a user sees, and a screen reader announced the stutter too. The
 * suffix exists to say what a row is when its name does not; when the name
 * already contains the word, it says nothing and costs a line of noise.
 *
 * Matched on a word boundary so "Wall" is suppressed for "Interior Wall 100mm"
 * but kept for a coded name like "W-101", which is exactly the case the suffix
 * is worth showing for.
 */
export function typeSuffixFor(node: {
  readonly displayName: string;
  readonly nodeType: string;
}): string | null {
  const pattern = new RegExp(`\\b${node.nodeType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return pattern.test(node.displayName) ? null : node.nodeType;
}

/** Row height in CSS px; the virtualiser needs a fixed one to index by. */
const ROW_HEIGHT_PX = 36;
const OVERSCAN_ROWS = 6;

const TREE_SOURCE: TreeSource<ModelPanelNode> = {
  id: (node) => node.id,
  children: (node) => node.children,
};

export function ModelPanel(props: ModelPanelProps): JSX.Element {
  const { tree, selection, onSelectNode } = props;
  const [query, setQuery] = useState('');
  const [scrollTopPx, setScrollTopPx] = useState(0);
  const [viewportHeightPx, setViewportHeightPx] = useState(480);
  const scrollRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => filterModelPanelTree(tree, query), [tree, query]);

  /*
   * Doc 39 > Performance: "Virtualise large trees. Expanding a 5,000-element
   * model must not render every row. Preserve focus/selection across
   * virtualisation."
   *
   * Two halves, both in @arq/workspace so they are testable without a DOM:
   * `flattenVisibleTree` collapses the tree to the rows that are actually
   * expanded (a collapsed level costs one row, not five thousand), and
   * `visibleTreeWindow` slices that list to the scrolled viewport - while
   * always keeping the focused row mounted, because unmounting it drops focus
   * to `<body>` and silently ejects a keyboard user from the tree.
   *
   * Every node currently renders expanded, matching this panel's previous
   * behaviour; a real disclosure control belongs with doc 39's full row anatomy
   * and is not built yet. The virtualiser is correct either way.
   */
  const expandedIds = useMemo(() => {
    const ids = new Set<string>();
    const walk = (nodes: readonly ModelPanelNode[]): void => {
      for (const node of nodes) {
        if (node.children !== undefined && node.children.length > 0) {
          ids.add(node.id);
          walk(node.children);
        }
      }
    };
    walk(filtered);
    return ids;
  }, [filtered]);

  const rows = useMemo(
    () => flattenVisibleTree(filtered, expandedIds, TREE_SOURCE),
    [filtered, expandedIds],
  );

  const focusedIndex = rows.findIndex((row) => row.id === selection.primary);
  const window = visibleTreeWindow({
    totalRows: rows.length,
    rowHeightPx: ROW_HEIGHT_PX,
    scrollTopPx,
    viewportHeightPx,
    overscanRows: OVERSCAN_ROWS,
    ...(focusedIndex === -1 ? {} : { focusedIndex }),
  });
  const rendered = rows.slice(window.startIndex, window.endIndex);
  const detached =
    window.detachedFocusIndex === null ? null : (rows[window.detachedFocusIndex] ?? null);

  return (
    <nav
      className="arq-model-panel arq-shell-panel"
      aria-label="Model"
      /*
       * Fills its dock rather than setting its own width. Package 3.0 puts
       * panel sizing in `workspace-panel-registry.json` (268px default, 232-384
       * resizable), and WorkspaceRoot applies it - a second width here would
       * leave a dead strip inside the docked slot and quietly defeat the user's
       * drag-to-resize.
       */
      style={{ width: '100%', height: '100%', borderRight: '1px solid var(--arq-ui-line-subtle)' }}
    >
      <input
        aria-label="Search model"
        placeholder="Search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        style={{ width: '100%' }}
      />
      <div
        ref={scrollRef}
        className="arq-model-panel__scroll"
        onScroll={(event) => {
          setScrollTopPx(event.currentTarget.scrollTop);
          setViewportHeightPx(event.currentTarget.clientHeight);
        }}
        style={{ overflow: 'auto', height: 'calc(100% - 44px)' }}
      >
        <ul
          role="tree"
          aria-label="Model tree"
          // The full row count, so assistive technology reports the real size of
          // the project rather than the size of the rendered window.
          aria-setsize={rows.length}
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {/* Spacers stand in for the rows above and below, so the scrollbar
              reflects the whole tree rather than the rendered slice. */}
          <li aria-hidden="true" style={{ height: window.paddingTopPx }} />
          {rendered.map((row) => (
            <ModelPanelNodeRow
              key={row.id}
              node={row.node}
              depth={row.depth}
              index={window.startIndex + rendered.indexOf(row)}
              total={rows.length}
              selection={selection}
              onSelectNode={onSelectNode}
            />
          ))}
          <li aria-hidden="true" style={{ height: window.paddingBottomPx }} />
          {detached !== null && (
            /* The focused row, scrolled out of the window but kept mounted so
               focus is not dropped. Positioned out of flow so it does not
               disturb the spacer arithmetic. */
            <li style={{ position: 'absolute', left: -9999, top: 0 }}>
              <ModelPanelNodeRow
                node={detached.node}
                depth={detached.depth}
                index={window.detachedFocusIndex ?? 0}
                total={rows.length}
                selection={selection}
                onSelectNode={onSelectNode}
              />
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
