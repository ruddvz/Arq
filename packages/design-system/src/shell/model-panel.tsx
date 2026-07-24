import { useMemo, useState } from 'react';
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

function ModelPanelNodeRow(props: {
  readonly node: ModelPanelNode;
  readonly selection: ModelPanelSelectionState;
  readonly onSelectNode: (nodeId: string) => void;
}): JSX.Element {
  const { node, selection, onSelectNode } = props;
  return (
    <li
      role="treeitem"
      aria-selected={isNodeSelected(selection, node.id)}
      aria-expanded={node.children !== undefined ? true : undefined}
    >
      <button
        type="button"
        className="arq-shell-button"
        aria-pressed={isNodePrimarySelection(selection, node.id)}
        style={{
          width: '100%',
          justifyContent: 'flex-start',
          opacity: node.hidden ? 0.5 : 1,
        }}
        onClick={() => onSelectNode(node.id)}
      >
        {node.hidden && <span aria-hidden="true">⊘ </span>}
        {node.displayName}
        <span style={{ color: 'var(--arq-ui-text-muted)' }}> {node.nodeType}</span>
      </button>
      {node.children !== undefined && node.children.length > 0 && (
        <ul
          role="group"
          style={{ listStyle: 'none', margin: 0, paddingLeft: 'var(--arq-space-section)' }}
        >
          {node.children.map((child) => (
            <ModelPanelNodeRow
              key={child.id}
              node={child}
              selection={selection}
              onSelectNode={onSelectNode}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * ARQ-025: build model panel. Blueprint section 12 > "Model panel" - see
 * model-panel-state.ts for rules and the "renaming" non-goal.
 *
 * States: a node's `aria-pressed` marks the *primary* selection
 * (unmistakable state, matching the tool rail's convention); `aria-selected`
 * on the `<li role="treeitem">` covers secondary members too, for assistive
 * tech. A hidden node stays in the tree at reduced opacity with an
 * eye-off-style glyph (section 18) rather than being removed - "hidden
 * objects remain discoverable." Keyboard: each row is a real `<button>`,
 * reachable by Tab in document order (a full roving-tabindex/arrow-key tree
 * widget is deferred - out of scope for a "panel" shell with no virtualised
 * large-tree requirement yet, section 64's "large model strategy" concern).
 * iPad touch: rows use `.arq-shell-button`'s 44px minimum target.
 */
export function ModelPanel(props: ModelPanelProps): JSX.Element {
  const { tree, selection, onSelectNode } = props;
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterModelPanelTree(tree, query), [tree, query]);

  return (
    <nav
      className="arq-model-panel arq-shell-panel"
      aria-label="Model"
      style={{ width: 240, borderRight: '1px solid var(--arq-ui-line-subtle)' }}
    >
      <input
        aria-label="Search model"
        placeholder="Search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        style={{ width: '100%' }}
      />
      <ul role="tree" aria-label="Model tree" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {filtered.map((node) => (
          <ModelPanelNodeRow
            key={node.id}
            node={node}
            selection={selection}
            onSelectNode={onSelectNode}
          />
        ))}
      </ul>
    </nav>
  );
}
