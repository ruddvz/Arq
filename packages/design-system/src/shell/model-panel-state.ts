/**
 * ARQ-025: build model panel.
 *
 * Blueprint section 12 > "Model panel": site, building, levels, views,
 * sheets, schedules, imports, design options later, warnings - modelled
 * generically as a tree (`ModelPanelNode`) rather than importing
 * @arq/bim-core's concrete Wall/Room/etc. types, the same domain-agnostic
 * layering plan-renderer's `PlanPrimitive<TId>` already established: a
 * caller that does depend on @arq/bim-core builds this tree from its real
 * project data.
 *
 * Rules modelled here: "hidden objects remain discoverable" -
 * `filterModelPanelTree` never excludes a hidden node from a search match,
 * it only marks it (the caller renders `node.hidden` as an eye-off icon
 * plus reduced opacity, per section 18 - not omission, unlike a PlanScene
 * primitive, which *is* omitted when hidden: the model panel's tree and the
 * canvas's rendered scene have different "hidden" semantics on purpose,
 * matching plan-scene.ts's own note that hiding a tree row is a distinct
 * concept from omitting a canvas primitive). "Search works by display name,
 * type, ID and selected properties" - `nodeMatchesQuery` covers
 * displayName/nodeType/id; "selected properties" needs a live selected
 * element's own property values, which this generic tree has no concept
 * of, so it is left to a caller-supplied `extraSearchText` per node
 * (defaulting to none) rather than this module inventing what a property
 * is.
 *
 * Non-goal: "renaming never changes stable IDs" is an invariant about
 * whatever store the caller's real IDs come from (ARQ-033's ids.ts already
 * establishes bim-core IDs are stable) - nothing to implement in this
 * UI-only module, since `ModelPanelNode.id` is opaque to it either way.
 */

export interface ModelPanelNode {
  readonly id: string;
  readonly displayName: string;
  readonly nodeType: string;
  readonly hidden: boolean;
  readonly extraSearchText?: string;
  readonly children?: readonly ModelPanelNode[];
}

export function nodeMatchesQuery(node: ModelPanelNode, query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return true;
  }
  const q = trimmed.toLowerCase();
  return (
    node.displayName.toLowerCase().includes(q) ||
    node.nodeType.toLowerCase().includes(q) ||
    node.id.toLowerCase().includes(q) ||
    (node.extraSearchText?.toLowerCase().includes(q) ?? false)
  );
}

/**
 * Keeps a node if it matches the query directly, or any descendant does
 * (so an ancestor stays visible to reach a matching descendant) - never
 * drops a node purely for being hidden (section 12: "hidden objects remain
 * discoverable"). An empty query returns the tree unchanged.
 */
export function filterModelPanelTree(
  nodes: readonly ModelPanelNode[],
  query: string,
): readonly ModelPanelNode[] {
  if (query.trim().length === 0) {
    return nodes;
  }
  const result: ModelPanelNode[] = [];
  for (const node of nodes) {
    const filteredChildren =
      node.children === undefined ? undefined : filterModelPanelTree(node.children, query);
    const selfMatches = nodeMatchesQuery(node, query);
    const hasMatchingDescendant = filteredChildren !== undefined && filteredChildren.length > 0;
    if (selfMatches || hasMatchingDescendant) {
      const children = selfMatches ? node.children : filteredChildren;
      result.push(children === undefined ? { ...node } : { ...node, children });
    }
  }
  return result;
}

/** Mirrors plan-renderer's PlanSelectionState by value (see plan-scene.ts) - the model panel and canvas coordinate through this same shape, per a caller that owns both. */
export interface ModelPanelSelectionState {
  readonly primary: string | null;
  readonly secondary: ReadonlySet<string>;
}

export function isNodeSelected(state: ModelPanelSelectionState, nodeId: string): boolean {
  return state.primary === nodeId || state.secondary.has(nodeId);
}

export function isNodePrimarySelection(state: ModelPanelSelectionState, nodeId: string): boolean {
  return state.primary === nodeId;
}
