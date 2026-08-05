import { SNAP_SOURCE_PRIORITY, type SnapResult, type SnapSource } from './snap-result';

/**
 * V3-090/V3-091/V3-097/V3-098: the layer above the individual snap sources.
 *
 * The eight snap modules in this package each answer "is there an endpoint /
 * intersection / midpoint near the cursor". None of them answers the question
 * the drawing tools actually ask, which is "given everything that is near the
 * cursor, what am I snapping to, and how does the user pick something else".
 * `pickBestSnap` gets partway - it takes a best - but a tool needs the ranked
 * list, a way to cycle through it, and a way to switch a source off when it is
 * getting in the way.
 *
 * Two properties matter more than the ranking itself:
 *
 * **Determinism.** The same cursor position over the same geometry must produce
 * the same candidate in the same order, every frame. A candidate list that
 * reorders between frames because two results tied and the sort was unstable
 * makes the snap flicker between two points while the cursor is still, which
 * reads as the application being broken. So ties are broken all the way down to
 * a total order, ending on a key that cannot tie.
 *
 * **Cycling is positional, not spatial.** When the user presses Tab, they are
 * choosing the next candidate in the list they were shown - not the next
 * nearest thing, which would jump around as the cursor drifts a pixel. The
 * cycle index therefore lives in the caller's state and indexes the ranked
 * list, and it is reset when the candidate set genuinely changes rather than on
 * every mouse move.
 */

export interface InferenceCandidate extends SnapResult {
  /** Position in the ranked list, 0 being the default. */
  readonly rank: number;
}

export interface InferenceState {
  /** Which candidate the user cycled to, by rank. */
  readonly cycleIndex: number;
  /** Sources the user switched off, applied before ranking. */
  readonly suppressed: readonly SnapSource[];
  /**
   * Identifies the candidate set the cycle index refers to. Cycling is only
   * meaningful against the set the user was actually shown.
   */
  readonly setKey: string;
}

export const INITIAL_INFERENCE_STATE: InferenceState = {
  cycleIndex: 0,
  suppressed: [],
  setKey: '',
};

/**
 * Ranks raw snap results into a stable, total order.
 *
 * The final tiebreak is the source name, which cannot tie because a source
 * appears once per point. Without a terminal tiebreak, two candidates equal on
 * priority and distance would order by whatever the sort happened to do, and
 * `Array.prototype.sort` stability across engines is not something a drawing
 * tool should depend on for visual steadiness.
 */
export function rankCandidates(
  results: readonly SnapResult[],
  suppressed: readonly SnapSource[] = [],
): readonly InferenceCandidate[] {
  const blocked = new Set(suppressed);
  return [...results]
    .filter((result) => !blocked.has(result.source))
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.screenDistance - b.screenDistance ||
        a.point.x - b.point.x ||
        a.point.y - b.point.y ||
        a.source.localeCompare(b.source),
    )
    .map((result, index) => ({ ...result, rank: index }));
}

/**
 * A key identifying which candidates are on offer, ignoring their order.
 *
 * Used to decide whether a cycle position still means anything. Built from
 * source and point rather than distance, because distance changes on every
 * mouse move while the set of things being offered does not - keying on
 * distance would reset the user's Tab selection continuously.
 */
export function candidateSetKey(candidates: readonly InferenceCandidate[]): string {
  return candidates
    .map((candidate) => `${candidate.source}@${candidate.point.x},${candidate.point.y}`)
    .sort()
    .join('|');
}

export interface InferenceResolution {
  readonly candidates: readonly InferenceCandidate[];
  /** The candidate a commit would use, or undefined when nothing is near. */
  readonly active: InferenceCandidate | undefined;
  /** The state to carry to the next frame. */
  readonly state: InferenceState;
}

/**
 * Resolves the active inference for one frame.
 *
 * The cycle index is preserved while the candidate set is unchanged and reset
 * when it is not. Preserving it unconditionally would leave the user cycled to
 * rank 3 of a list that now has one entry; resetting it unconditionally would
 * undo their Tab the instant the cursor moved a pixel.
 */
export function resolveInference(
  results: readonly SnapResult[],
  state: InferenceState = INITIAL_INFERENCE_STATE,
): InferenceResolution {
  const candidates = rankCandidates(results, state.suppressed);
  const setKey = candidateSetKey(candidates);
  const sameSet = setKey === state.setKey;
  const cycleIndex = sameSet ? state.cycleIndex : 0;

  const active = candidates.length === 0 ? undefined : candidates[cycleIndex % candidates.length];

  return {
    candidates,
    active,
    state: { ...state, cycleIndex, setKey },
  };
}

/**
 * Advances to the next candidate.
 *
 * Wraps, so repeated presses always return to the default rather than sticking
 * at the end with no way back except moving the cursor away and returning.
 */
export function cycleInference(
  state: InferenceState,
  candidateCount: number,
  direction: 1 | -1 = 1,
): InferenceState {
  if (candidateCount <= 0) {
    return state;
  }
  const next = (state.cycleIndex + direction + candidateCount) % candidateCount;
  return { ...state, cycleIndex: next };
}

/**
 * Switches a snap source off.
 *
 * Suppression is per source rather than per candidate: a user turning off grid
 * snapping means all of it, and having to reject each grid point individually
 * would be the same problem repeated. Cycling resets, because the position they
 * had cycled to referred to a list that no longer exists.
 */
export function suppressSource(state: InferenceState, source: SnapSource): InferenceState {
  if (state.suppressed.includes(source)) {
    return state;
  }
  return {
    ...state,
    suppressed: [...state.suppressed, source].sort(),
    cycleIndex: 0,
    setKey: '',
  };
}

export function unsuppressSource(state: InferenceState, source: SnapSource): InferenceState {
  if (!state.suppressed.includes(source)) {
    return state;
  }
  return {
    ...state,
    suppressed: state.suppressed.filter((entry) => entry !== source),
    cycleIndex: 0,
    setKey: '',
  };
}

/**
 * Clears the transient inference state for Escape: the cycle position and the
 * remembered candidate set.
 *
 * Suppressions deliberately survive. Escape cancels what is in progress; a
 * switched-off snap source is a setting the user chose, and silently turning
 * grid snapping back on because they pressed Escape for an unrelated reason
 * would be the application undoing a decision they did not revisit.
 */
export function clearInference(state: InferenceState): InferenceState {
  return { ...INITIAL_INFERENCE_STATE, suppressed: state.suppressed };
}

/**
 * The accessible description of what is being snapped to.
 *
 * A snap indicator that is only a coloured dot is invisible to a screen reader
 * and ambiguous to anyone who cannot distinguish the colours, and the position
 * in the cycle has to be spoken too - otherwise Tab appears to do nothing.
 */
export function describeInference(resolution: InferenceResolution): string {
  if (!resolution.active) {
    return 'No snap';
  }
  const total = resolution.candidates.length;
  const position = total > 1 ? ` (${resolution.active.rank + 1} of ${total})` : '';
  const constraint = resolution.active.suggestedConstraint
    ? `, ${describeConstraint(resolution.active.suggestedConstraint)}`
    : '';
  return `${describeSource(resolution.active.source)}${constraint}${position}`;
}

function describeSource(source: SnapSource): string {
  switch (source) {
    case 'endpoint':
      return 'Endpoint';
    case 'intersection':
      return 'Intersection';
    case 'midpoint':
      return 'Midpoint';
    case 'perpendicular':
      return 'Perpendicular';
    case 'centre':
      return 'Centre';
    case 'grid':
      return 'Grid';
    case 'extension':
      return 'Extension';
    case 'nearest':
      return 'Nearest point';
  }
}

function describeConstraint(constraint: NonNullable<SnapResult['suggestedConstraint']>): string {
  switch (constraint.type) {
    case 'horizontal':
      return 'horizontal';
    case 'vertical':
      return 'vertical';
    case 'along-angle':
      return `at ${Math.round((constraint.angleRadians * 180) / Math.PI)} degrees`;
  }
}

/** Re-exported so a caller ranking its own results does not reach past this module. */
export { SNAP_SOURCE_PRIORITY };
