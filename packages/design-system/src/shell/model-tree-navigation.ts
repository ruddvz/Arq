import type { ModelPanelNode, ModelPanelSelectionState } from './model-panel-state';

/**
 * V3-105 / AC3-082: structured model navigation offers non-canvas selection.
 *
 * The failure this rules out is "selection requires a spatial pointer". A user
 * who cannot aim - keyboard-only, screen reader, tremor, a trackpad on a train
 * - is otherwise locked out of a drawing tool entirely, because every object in
 * it is reached by clicking a shape. model-panel-state.ts (ARQ-025) already
 * gives the tree its data and its search; this gives it a cursor, keyboard
 * navigation, and selection that lands on the same ids the canvas uses.
 *
 * Sharing the id is the whole point. `ModelPanelSelectionState` is already the
 * shape plan-renderer's own selection uses, so selecting a wall in the tree and
 * selecting it on canvas produce the same state - one selection, two ways in,
 * rather than a panel that highlights its own rows and leaves the drawing
 * untouched.
 *
 * Hidden nodes are navigable and selectable. That is not an oversight: a hidden
 * object cannot be clicked at all, so the tree is the *only* way to reach it,
 * and refusing selection there would make hidden objects unreachable rather
 * than merely invisible. It matches `filterModelPanelTree`, which already
 * refuses to drop a hidden node from search results.
 *
 * Key handling follows the WAI-ARIA tree pattern rather than inventing one,
 * because a screen reader user arrives already knowing it: Down/Up move by
 * visible row, Right expands then descends, Left collapses then ascends, Home
 * and End jump to the ends, Enter and Space select. A tool that renames these
 * gains nothing and costs every user who has used a file tree before.
 */

/** A tree row as the user actually sees it: flattened, with the depth and position a screen reader announces. */
export interface ModelTreeRow {
  readonly node: ModelPanelNode;
  /** 1-based, matching aria-level. */
  readonly level: number;
  /** 1-based index among siblings, matching aria-posinset. */
  readonly positionInSet: number;
  /** Sibling count, matching aria-setsize. */
  readonly setSize: number;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
  readonly parentId: string | null;
}

export interface ModelTreeNavigationState {
  /** The focused row's node id, or null before the tree has been entered. */
  readonly cursorId: string | null;
  readonly expandedIds: ReadonlySet<string>;
  readonly selection: ModelPanelSelectionState;
}

export const EMPTY_MODEL_TREE_NAVIGATION: ModelTreeNavigationState = {
  cursorId: null,
  expandedIds: new Set(),
  selection: { primary: null, secondary: new Set() },
};

/**
 * Flattens the tree to the rows currently on screen.
 *
 * A node's children appear only while it is expanded, which is what makes
 * Down/Up move by *visible* row rather than by tree order - the two differ the
 * moment anything is collapsed, and moving by tree order would step the cursor
 * onto rows that are not rendered.
 */
export function visibleModelTreeRows(
  nodes: readonly ModelPanelNode[],
  expandedIds: ReadonlySet<string>,
): readonly ModelTreeRow[] {
  const rows: ModelTreeRow[] = [];

  function walk(siblings: readonly ModelPanelNode[], level: number, parentId: string | null): void {
    siblings.forEach((node, index) => {
      const children = node.children ?? [];
      const hasChildren = children.length > 0;
      const expanded = hasChildren && expandedIds.has(node.id);
      rows.push({
        node,
        level,
        positionInSet: index + 1,
        setSize: siblings.length,
        hasChildren,
        expanded,
        parentId,
      });
      if (expanded) {
        walk(children, level + 1, node.id);
      }
    });
  }

  walk(nodes, 1, null);
  return rows;
}

export type ModelTreeKey =
  'ArrowDown' | 'ArrowUp' | 'ArrowRight' | 'ArrowLeft' | 'Home' | 'End' | 'Enter' | ' ';

export interface ModelTreeKeyOptions {
  /** Shift or Ctrl held: adds to the selection instead of replacing it. */
  readonly extend?: boolean;
}

/**
 * Applies one key to the navigation state.
 *
 * Returns the state unchanged when a key has nothing to do - at the last row,
 * Down stays put rather than wrapping. Wrapping in a tree loses a user's place
 * silently: a screen reader announces a row, and the user has no cheap way to
 * notice they are now at the top rather than one row further down.
 */
export function applyModelTreeKey(
  state: ModelTreeNavigationState,
  nodes: readonly ModelPanelNode[],
  key: ModelTreeKey,
  options: ModelTreeKeyOptions = {},
): ModelTreeNavigationState {
  const rows = visibleModelTreeRows(nodes, state.expandedIds);
  if (rows.length === 0) {
    return state;
  }

  const index = rows.findIndex((row) => row.node.id === state.cursorId);
  // Entering the tree with no cursor puts it on the first row, whichever key
  // arrived: an empty cursor is a state the user cannot see or act on.
  if (index === -1) {
    const first = rows[0];
    return first === undefined ? state : { ...state, cursorId: first.node.id };
  }

  const row = rows[index];
  if (row === undefined) {
    return state;
  }

  switch (key) {
    case 'ArrowDown': {
      const next = rows[index + 1];
      return next === undefined ? state : { ...state, cursorId: next.node.id };
    }
    case 'ArrowUp': {
      const previous = rows[index - 1];
      return previous === undefined ? state : { ...state, cursorId: previous.node.id };
    }
    case 'Home': {
      const first = rows[0];
      return first === undefined ? state : { ...state, cursorId: first.node.id };
    }
    case 'End': {
      const last = rows[rows.length - 1];
      return last === undefined ? state : { ...state, cursorId: last.node.id };
    }
    case 'ArrowRight': {
      if (row.hasChildren && !row.expanded) {
        return { ...state, expandedIds: withId(state.expandedIds, row.node.id) };
      }
      if (row.expanded) {
        const child = rows[index + 1];
        return child === undefined ? state : { ...state, cursorId: child.node.id };
      }
      return state;
    }
    case 'ArrowLeft': {
      if (row.expanded) {
        return { ...state, expandedIds: withoutId(state.expandedIds, row.node.id) };
      }
      return row.parentId === null ? state : { ...state, cursorId: row.parentId };
    }
    case 'Enter':
    case ' ':
      return {
        ...state,
        selection: selectNode(state.selection, row.node.id, options.extend ?? false),
      };
    default:
      return state;
  }
}

/**
 * Selects a node id.
 *
 * Extending moves the previous primary into the secondary set so the newest
 * pick is always the primary - the inspector shows the primary's properties,
 * and a user extending a selection expects the panel to follow what they just
 * added rather than what they started from.
 */
export function selectNode(
  selection: ModelPanelSelectionState,
  nodeId: string,
  extend: boolean,
): ModelPanelSelectionState {
  if (!extend) {
    return { primary: nodeId, secondary: new Set() };
  }
  if (selection.primary === nodeId) {
    return selection;
  }
  const secondary = new Set(selection.secondary);
  secondary.delete(nodeId);
  if (selection.primary !== null) {
    secondary.add(selection.primary);
  }
  return { primary: nodeId, secondary };
}

/**
 * The accessibility attributes for one row.
 *
 * Derived rather than left to each renderer, because these are the difference
 * between a tree a screen reader can describe and a list of unrelated buttons.
 * `aria-expanded` is omitted entirely on a leaf: present-and-false announces a
 * collapsed branch, which is a claim there is something inside to open.
 */
export interface ModelTreeRowAria {
  readonly role: 'treeitem';
  readonly 'aria-level': number;
  readonly 'aria-posinset': number;
  readonly 'aria-setsize': number;
  readonly 'aria-selected': boolean;
  readonly 'aria-expanded'?: boolean;
  /** Screen readers do not see opacity. A hidden object has to say so. */
  readonly 'aria-description'?: string;
  readonly tabIndex: 0 | -1;
}

export function modelTreeRowAria(
  row: ModelTreeRow,
  state: ModelTreeNavigationState,
): ModelTreeRowAria {
  const selected =
    state.selection.primary === row.node.id || state.selection.secondary.has(row.node.id);
  return {
    role: 'treeitem',
    'aria-level': row.level,
    'aria-posinset': row.positionInSet,
    'aria-setsize': row.setSize,
    'aria-selected': selected,
    ...(row.hasChildren ? { 'aria-expanded': row.expanded } : {}),
    ...(row.node.hidden ? { 'aria-description': 'Hidden' } : {}),
    // One tab stop for the whole tree, arrows move within it - the ARIA tree
    // pattern. A tab stop per row makes tabbing past a large model impossible.
    tabIndex: state.cursorId === row.node.id ? 0 : -1,
  };
}

/**
 * Expands every ancestor of `nodeId` and puts the cursor on it.
 *
 * This is how a selection made anywhere else - on canvas, from a search result,
 * from a warning - becomes visible in the tree. Without it the tree can hold a
 * selected row inside a collapsed branch, and the panel shows nothing selected
 * while the model says something is.
 */
export function revealNode(
  state: ModelTreeNavigationState,
  nodes: readonly ModelPanelNode[],
  nodeId: string,
): ModelTreeNavigationState {
  const path = findNodePath(nodes, nodeId);
  if (path === null) {
    return state;
  }
  const expandedIds = new Set(state.expandedIds);
  // The last entry is the node itself; expanding it would open its children,
  // which the user did not ask for.
  for (const ancestorId of path.slice(0, -1)) {
    expandedIds.add(ancestorId);
  }
  return { ...state, expandedIds, cursorId: nodeId };
}

/** Ids from the root down to `nodeId` inclusive, or null if the id is not in the tree. */
export function findNodePath(
  nodes: readonly ModelPanelNode[],
  nodeId: string,
): readonly string[] | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return [node.id];
    }
    const childPath = node.children ? findNodePath(node.children, nodeId) : null;
    if (childPath !== null) {
      return [node.id, ...childPath];
    }
  }
  return null;
}

function withId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids);
  next.add(id);
  return next;
}

function withoutId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}
