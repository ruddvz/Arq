import { describe, expect, it } from 'vitest';
import type { ModelPanelNode } from './model-panel-state';
import {
  EMPTY_MODEL_TREE_NAVIGATION,
  applyModelTreeKey,
  findNodePath,
  modelTreeRowAria,
  revealNode,
  selectNode,
  visibleModelTreeRows,
  type ModelTreeNavigationState,
} from './model-tree-navigation';

function node(
  id: string,
  displayName: string,
  children?: readonly ModelPanelNode[],
  hidden = false,
): ModelPanelNode {
  return {
    id,
    displayName,
    nodeType: 'element',
    hidden,
    ...(children === undefined ? {} : { children }),
  };
}

const TREE: readonly ModelPanelNode[] = [
  node('building', 'Building', [
    node('level-0', 'Ground floor', [
      node('wall-1', 'Wall 1'),
      node('wall-2', 'Wall 2', undefined, true),
    ]),
    node('level-1', 'First floor', [node('wall-3', 'Wall 3')]),
  ]),
  node('sheets', 'Sheets'),
];

function stateAt(
  cursorId: string | null,
  expanded: readonly string[] = [],
): ModelTreeNavigationState {
  return {
    cursorId,
    expandedIds: new Set(expanded),
    selection: { primary: null, secondary: new Set() },
  };
}

describe('visibleModelTreeRows', () => {
  it('shows only the rows the user can see', () => {
    const collapsed = visibleModelTreeRows(TREE, new Set());

    expect(collapsed.map((row) => row.node.id)).toEqual(['building', 'sheets']);
  });

  it('reveals children of an expanded node with their level and set position', () => {
    const rows = visibleModelTreeRows(TREE, new Set(['building']));

    expect(rows.map((row) => row.node.id)).toEqual(['building', 'level-0', 'level-1', 'sheets']);
    const levelZero = rows[1];
    expect(levelZero?.level).toBe(2);
    expect(levelZero?.positionInSet).toBe(1);
    expect(levelZero?.setSize).toBe(2);
    expect(levelZero?.parentId).toBe('building');
  });
});

describe('applyModelTreeKey', () => {
  it('puts the cursor on the first row when the tree is entered', () => {
    const next = applyModelTreeKey(EMPTY_MODEL_TREE_NAVIGATION, TREE, 'ArrowDown');

    expect(next.cursorId).toBe('building');
  });

  it('moves down and up by visible row', () => {
    const down = applyModelTreeKey(stateAt('building'), TREE, 'ArrowDown');
    expect(down.cursorId).toBe('sheets');

    const up = applyModelTreeKey(down, TREE, 'ArrowUp');
    expect(up.cursorId).toBe('building');
  });

  it('stays put at the ends rather than wrapping', () => {
    // Wrapping loses a screen reader user's place with no cheap way to notice.
    expect(applyModelTreeKey(stateAt('sheets'), TREE, 'ArrowDown').cursorId).toBe('sheets');
    expect(applyModelTreeKey(stateAt('building'), TREE, 'ArrowUp').cursorId).toBe('building');
  });

  it('expands with Right, then descends with a second Right', () => {
    const expanded = applyModelTreeKey(stateAt('building'), TREE, 'ArrowRight');
    expect([...expanded.expandedIds]).toEqual(['building']);
    expect(expanded.cursorId).toBe('building');

    const descended = applyModelTreeKey(expanded, TREE, 'ArrowRight');
    expect(descended.cursorId).toBe('level-0');
  });

  it('collapses with Left, then ascends to the parent with a second Left', () => {
    const collapsed = applyModelTreeKey(stateAt('building', ['building']), TREE, 'ArrowLeft');
    expect([...collapsed.expandedIds]).toEqual([]);

    const ascended = applyModelTreeKey(stateAt('level-0', ['building']), TREE, 'ArrowLeft');
    expect(ascended.cursorId).toBe('building');
  });

  it('does nothing on Right at a leaf', () => {
    const state = stateAt('sheets');

    expect(applyModelTreeKey(state, TREE, 'ArrowRight')).toBe(state);
  });

  it('jumps to the ends with Home and End', () => {
    expect(applyModelTreeKey(stateAt('sheets'), TREE, 'Home').cursorId).toBe('building');
    expect(applyModelTreeKey(stateAt('building', ['building']), TREE, 'End').cursorId).toBe(
      'sheets',
    );
  });

  it('selects with Enter and with Space, without a pointer anywhere in the path', () => {
    // AC3-082: selection must not require a spatial pointer.
    const byEnter = applyModelTreeKey(stateAt('sheets'), TREE, 'Enter');
    expect(byEnter.selection.primary).toBe('sheets');

    const bySpace = applyModelTreeKey(stateAt('sheets'), TREE, ' ');
    expect(bySpace.selection.primary).toBe('sheets');
  });

  it('selects a hidden node, which no pointer could ever reach', () => {
    const state = stateAt('wall-2', ['building', 'level-0']);
    const selected = applyModelTreeKey(state, TREE, 'Enter');

    expect(selected.selection.primary).toBe('wall-2');
  });

  it('extends the selection when the caller says a modifier is held', () => {
    const first = applyModelTreeKey(stateAt('sheets'), TREE, 'Enter');
    const second = applyModelTreeKey({ ...first, cursorId: 'building' }, TREE, 'Enter', {
      extend: true,
    });

    expect(second.selection.primary).toBe('building');
    expect([...second.selection.secondary]).toEqual(['sheets']);
  });
});

describe('selectNode', () => {
  it('replaces the whole selection when not extending', () => {
    const result = selectNode({ primary: 'a', secondary: new Set(['b']) }, 'c', false);

    expect(result).toEqual({ primary: 'c', secondary: new Set() });
  });

  it('makes the newest pick primary so the inspector follows what was just added', () => {
    const result = selectNode({ primary: 'a', secondary: new Set() }, 'b', true);

    expect(result.primary).toBe('b');
    expect([...result.secondary]).toEqual(['a']);
  });

  it('is a no-op when extending onto the current primary', () => {
    const selection = { primary: 'a', secondary: new Set(['b']) };

    expect(selectNode(selection, 'a', true)).toBe(selection);
  });
});

describe('modelTreeRowAria', () => {
  it('describes level, position and set size so a reader can place the row', () => {
    const rows = visibleModelTreeRows(TREE, new Set(['building']));
    const levelOne = rows[2];
    expect(levelOne).toBeDefined();

    const aria = modelTreeRowAria(levelOne!, stateAt('level-1', ['building']));

    expect(aria['aria-level']).toBe(2);
    expect(aria['aria-posinset']).toBe(2);
    expect(aria['aria-setsize']).toBe(2);
    expect(aria.role).toBe('treeitem');
  });

  it('omits aria-expanded on a leaf rather than announcing a branch with nothing in it', () => {
    const rows = visibleModelTreeRows(TREE, new Set());
    const sheets = rows[1];
    expect(sheets).toBeDefined();

    expect(modelTreeRowAria(sheets!, stateAt('sheets'))).not.toHaveProperty('aria-expanded');
    expect(modelTreeRowAria(rows[0]!, stateAt('building'))['aria-expanded']).toBe(false);
  });

  it('announces hidden, which opacity alone never does', () => {
    const rows = visibleModelTreeRows(TREE, new Set(['building', 'level-0']));
    const hiddenWall = rows.find((row) => row.node.id === 'wall-2');
    expect(hiddenWall).toBeDefined();

    expect(modelTreeRowAria(hiddenWall!, stateAt('wall-2'))['aria-description']).toBe('Hidden');
  });

  it('keeps one tab stop for the whole tree', () => {
    const rows = visibleModelTreeRows(TREE, new Set(['building']));
    const state = stateAt('level-0', ['building']);
    const tabStops = rows.filter((row) => modelTreeRowAria(row, state).tabIndex === 0);

    expect(tabStops).toHaveLength(1);
    expect(tabStops[0]?.node.id).toBe('level-0');
  });
});

describe('revealNode', () => {
  it('expands every ancestor so an externally made selection becomes visible', () => {
    const revealed = revealNode(EMPTY_MODEL_TREE_NAVIGATION, TREE, 'wall-3');

    expect(revealed.cursorId).toBe('wall-3');
    expect([...revealed.expandedIds].sort()).toEqual(['building', 'level-1']);
  });

  it('does not expand the target itself', () => {
    const revealed = revealNode(EMPTY_MODEL_TREE_NAVIGATION, TREE, 'level-0');

    expect(revealed.expandedIds.has('level-0')).toBe(false);
  });

  it('leaves the state alone for an id that is not in the tree', () => {
    const state = stateAt('building');

    expect(revealNode(state, TREE, 'missing')).toBe(state);
  });
});

describe('findNodePath', () => {
  it('returns the ids from the root down to the node', () => {
    expect(findNodePath(TREE, 'wall-1')).toEqual(['building', 'level-0', 'wall-1']);
  });

  it('returns null for an unknown id', () => {
    expect(findNodePath(TREE, 'nope')).toBeNull();
  });
});
