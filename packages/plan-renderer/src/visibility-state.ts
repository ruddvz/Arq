/**
 * ARQ-129: implement hide and isolate.
 *
 * Section 62's "First 3D features" lists "hide; isolate" alongside
 * orbit/pan/zoom/fit (ARQ-127) and shared selection (ARQ-128) - the
 * rendering half of both (an invisible element / an omitted primitive)
 * is already done by resolveStyleToken/buildPlanScene (plan-scene.ts,
 * ARQ-119) and applySharedSelection (model-renderer, ARQ-128), both of
 * which already take a `hidden` set as input. What is actually left
 * for this issue is computing *that set* from "hide this" / "isolate
 * this" / "exit isolate" user intent - genuinely shared 2D/3D state,
 * so it lives alongside plan-scene.ts's other shared-renderer concepts
 * rather than being duplicated per backend, the same reasoning
 * ARQ-128's shared-selection work already established.
 *
 * Hide and isolate are deliberately kept as two separate, composable
 * concepts, not one: `hidden` is the user's explicit, persistent
 * "don't show this" set - it survives isolating and un-isolating.
 * `isolated` is a temporary overlay ("show only these, no matter what
 * else exists") that can be entered and exited without disturbing
 * `hidden` - exiting isolate restores exactly the hide state from
 * before isolating, not an empty one. This matches how "isolate" works
 * in every mainstream 3D/CAD viewer (a temporary focus mode layered on
 * top of, not replacing, whatever was already hidden) and is the
 * behaviour a caller almost certainly wants: hiding a reference layer,
 * then isolating a room to work on it, then exiting isolate, should not
 * silently bring the reference layer back.
 *
 * effectiveHiddenSet is the one function a renderer actually needs:
 * given the full universe of element ids (required only to know what
 * "everything else" means while isolating), it folds `hidden` and
 * `isolated` into the single hidden-set shape resolveStyleToken/
 * applySharedSelection already expect - this module does not touch
 * either renderer itself.
 */

export interface VisibilityState<TId> {
  readonly hidden: ReadonlySet<TId>;
  /** null when not isolating; otherwise the set of ids that remain visible while isolated. */
  readonly isolated: ReadonlySet<TId> | null;
}

export function createVisibilityState<TId>(): VisibilityState<TId> {
  return { hidden: new Set<TId>(), isolated: null };
}

/** Adds `ids` to the persistent hidden set - "hide" (section 62). Leaves isolate state untouched. */
export function hideElements<TId>(state: VisibilityState<TId>, ids: Iterable<TId>): VisibilityState<TId> {
  const hidden = new Set(state.hidden);
  for (const id of ids) {
    hidden.add(id);
  }
  return { ...state, hidden };
}

/** Removes `ids` from the persistent hidden set (the un-hide/"show" counterpart to hideElements). Leaves isolate state untouched. */
export function showElements<TId>(state: VisibilityState<TId>, ids: Iterable<TId>): VisibilityState<TId> {
  const hidden = new Set(state.hidden);
  for (const id of ids) {
    hidden.delete(id);
  }
  return { ...state, hidden };
}

/** Enters isolate mode: only `ids` remain visible (subject to `hidden` still applying on top) - "isolate" (section 62). Replaces any previous isolate set rather than combining with it. */
export function isolateElements<TId>(state: VisibilityState<TId>, ids: Iterable<TId>): VisibilityState<TId> {
  return { ...state, isolated: new Set(ids) };
}

/** Exits isolate mode, restoring the persistent `hidden` set exactly as it was before isolating - not an empty hidden set. */
export function exitIsolate<TId>(state: VisibilityState<TId>): VisibilityState<TId> {
  if (state.isolated === null) {
    return state;
  }
  return { ...state, isolated: null };
}

/**
 * The actual hidden set a renderer should apply: `hidden` alone when
 * not isolating; `hidden` plus every id from `allElementIds` not in
 * the isolated set, when isolating.
 */
export function effectiveHiddenSet<TId>(
  state: VisibilityState<TId>,
  allElementIds: Iterable<TId>,
): ReadonlySet<TId> {
  if (state.isolated === null) {
    return state.hidden;
  }
  const effective = new Set(state.hidden);
  for (const id of allElementIds) {
    if (!state.isolated.has(id)) {
      effective.add(id);
    }
  }
  return effective;
}
