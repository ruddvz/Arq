import { describe, expect, it } from 'vitest';
import {
  filterModelPanelTree,
  isNodePrimarySelection,
  isNodeSelected,
  nodeMatchesQuery,
  type ModelPanelNode,
} from './model-panel-state';

const TREE: readonly ModelPanelNode[] = [
  {
    id: 'level-1',
    displayName: 'Level 1',
    nodeType: 'Level',
    hidden: false,
    children: [
      { id: 'wall-1', displayName: 'Interior Wall 100mm', nodeType: 'Wall', hidden: false },
      { id: 'wall-2', displayName: 'Exterior Wall', nodeType: 'Wall', hidden: true },
    ],
  },
  { id: 'sheet-1', displayName: 'A101 Ground Floor Plan', nodeType: 'Sheet', hidden: false },
];

describe('nodeMatchesQuery', () => {
  it('matches by display name, type, or id, case-insensitively', () => {
    expect(nodeMatchesQuery(TREE[0]!, 'level')).toBe(true);
    expect(nodeMatchesQuery(TREE[0]!, 'LEVEL-1')).toBe(true);
    expect(nodeMatchesQuery(TREE[1]!, 'sheet')).toBe(true);
  });

  it('matches everything for an empty/whitespace query', () => {
    expect(nodeMatchesQuery(TREE[0]!, '')).toBe(true);
    expect(nodeMatchesQuery(TREE[0]!, '   ')).toBe(true);
  });

  it('matches extraSearchText when provided', () => {
    const node: ModelPanelNode = {
      id: 'a',
      displayName: 'A',
      nodeType: 'X',
      hidden: false,
      extraSearchText: 'steel',
    };
    expect(nodeMatchesQuery(node, 'steel')).toBe(true);
  });
});

describe('filterModelPanelTree', () => {
  it('returns the tree unchanged for an empty query', () => {
    expect(filterModelPanelTree(TREE, '')).toBe(TREE);
  });

  it('keeps a hidden node when it matches - hidden objects remain discoverable', () => {
    const filtered = filterModelPanelTree(TREE, 'exterior');
    const level = filtered.find((n) => n.id === 'level-1');
    expect(level?.children?.some((c) => c.id === 'wall-2')).toBe(true);
  });

  it('keeps an ancestor visible to reach a matching descendant', () => {
    const filtered = filterModelPanelTree(TREE, 'wall-1');
    expect(filtered.map((n) => n.id)).toContain('level-1');
    expect(filtered.find((n) => n.id === 'level-1')?.children?.map((c) => c.id)).toEqual([
      'wall-1',
    ]);
  });

  it('drops branches with no match at all', () => {
    const filtered = filterModelPanelTree(TREE, 'ground floor');
    expect(filtered.map((n) => n.id)).toEqual(['sheet-1']);
  });
});

describe('isNodeSelected / isNodePrimarySelection', () => {
  const state = { primary: 'wall-1', secondary: new Set(['wall-2']) };

  it('treats both primary and secondary members as selected', () => {
    expect(isNodeSelected(state, 'wall-1')).toBe(true);
    expect(isNodeSelected(state, 'wall-2')).toBe(true);
    expect(isNodeSelected(state, 'sheet-1')).toBe(false);
  });

  it('distinguishes the primary selection from secondary members', () => {
    expect(isNodePrimarySelection(state, 'wall-1')).toBe(true);
    expect(isNodePrimarySelection(state, 'wall-2')).toBe(false);
  });
});
