import type { ElementId } from './ids';

/**
 * V3-113/V3-114/V3-115: how one part of a project points at another and keeps
 * pointing at it after the target changes.
 *
 * `dimension-reference.ts` already models the reference kinds a *dimension*
 * uses. This is the general problem underneath it, which dimensions,
 * constraints, hosted objects and AI proposals all have: a reference has to
 * survive the target being split, joined, offset or replaced. Anything that
 * points at a renderer index, an array position or a topology ordering breaks
 * the first time geometry is edited, and breaks silently - it still resolves,
 * to the wrong thing.
 *
 * The failure policy is the important half and it is deliberately unhelpful:
 * when a reference cannot be resolved unambiguously, nothing here guesses. A
 * wall split into three leaves "the end of that wall" genuinely ambiguous, and
 * a resolver that picks the longest piece, or the nearest, or the first by id,
 * is choosing on the user's behalf in a way they will not see and cannot
 * review. The dimension quietly measures something else. So an ambiguous
 * resolution is an unresolved one, it names the candidates, and the dependent
 * commit is blocked rather than committed against a guess.
 */

/**
 * The named parts of an element that a reference can point at. Semantic, not
 * geometric: "the exterior face" survives the wall moving, where a stored
 * face polygon does not.
 */
export type SemanticRole =
  | 'centreline'
  | 'start-endpoint'
  | 'end-endpoint'
  | 'interior-face'
  | 'exterior-face'
  | 'centre'
  | 'start-edge'
  | 'end-edge'
  | 'level-datum';

export type StableReference =
  /** The element itself. Survives everything except deletion. */
  | { readonly kind: 'element'; readonly elementId: ElementId }
  /** A named part of an element (V3-113). */
  | { readonly kind: 'role'; readonly elementId: ElementId; readonly role: SemanticRole }
  /**
   * A bounded position along a host, as a normalised fraction. Survives the
   * host changing length, which a stored distance does not: a door 40% along a
   * wall stays 40% along it when the wall is stretched, where a door 1200mm
   * along a shortened wall may end up outside it.
   */
  | {
      readonly kind: 'parametric';
      readonly hostId: ElementId;
      readonly role: SemanticRole;
      /** 0 at the host's start, 1 at its end. */
      readonly position: number;
    }
  /**
   * A deterministic query over lineage (V3-115): "whichever successor of this
   * element still carries this role". This is the form that survives a split -
   * the others name an element that may no longer exist.
   */
  | {
      readonly kind: 'query';
      readonly predecessorId: ElementId;
      readonly role: SemanticRole;
    };

export type ReferenceUnresolvedReason =
  /** The element does not exist and lineage does not say what replaced it. */
  | 'element-missing'
  /** The element exists but the operation that produced it did not preserve this role. */
  | 'role-invalidated'
  /** Several successors carry the role and nothing distinguishes them. */
  | 'ambiguous'
  /** A parametric position outside [0, 1]. */
  | 'position-out-of-range';

export type ReferenceResolution =
  | {
      readonly status: 'resolved';
      readonly elementId: ElementId;
      readonly role?: SemanticRole;
      /** True when lineage was followed to get here, so a caller can surface it. */
      readonly viaLineage: boolean;
    }
  | {
      readonly status: 'unresolved';
      readonly reason: ReferenceUnresolvedReason;
      readonly detail: string;
      /** Named when the failure was ambiguity, so a repair can offer real choices. */
      readonly candidates: readonly ElementId[];
    };

/** What an operation did to the elements it replaced (V3-114). */
export interface LineageRecord {
  readonly operationId: string;
  readonly kind: 'split' | 'join' | 'offset' | 'replace';
  readonly predecessorIds: readonly ElementId[];
  readonly successorIds: readonly ElementId[];
  /** Which successor inherited each role. A role absent here did not survive. */
  readonly preservedRoles: readonly RolePreservation[];
  /**
   * Roles the operation explicitly destroyed. Recorded separately from simply
   * being absent, so "this role no longer exists" can be reported differently
   * from "nobody recorded what happened to it".
   */
  readonly invalidatedRoles: readonly SemanticRole[];
  readonly confidence: 'exact' | 'derived' | 'ambiguous';
  readonly requiresUserReview: boolean;
}

export interface RolePreservation {
  readonly role: SemanticRole;
  readonly successorId: ElementId;
}

export interface ReferenceResolutionContext {
  /** Whether an element currently exists in the project. */
  readonly elementExists: (id: ElementId) => boolean;
  /** Lineage records naming this element as a predecessor, newest last. */
  readonly lineageFor: (id: ElementId) => readonly LineageRecord[];
}

/**
 * Resolves one reference against current project state.
 *
 * Lineage is only consulted when the direct target is gone. An element that
 * still exists is the answer even if it also appears as a predecessor
 * somewhere - an offset that produced a new element did not stop the original
 * from being what the reference named.
 */
export function resolveStableReference(
  reference: StableReference,
  context: ReferenceResolutionContext,
): ReferenceResolution {
  switch (reference.kind) {
    case 'element':
      return context.elementExists(reference.elementId)
        ? { status: 'resolved', elementId: reference.elementId, viaLineage: false }
        : missing(reference.elementId);

    case 'role':
      if (context.elementExists(reference.elementId)) {
        return {
          status: 'resolved',
          elementId: reference.elementId,
          role: reference.role,
          viaLineage: false,
        };
      }
      return followLineage(reference.elementId, reference.role, context);

    case 'parametric': {
      if (
        !Number.isFinite(reference.position) ||
        reference.position < 0 ||
        reference.position > 1
      ) {
        return {
          status: 'unresolved',
          reason: 'position-out-of-range',
          detail: `parametric position ${reference.position} is outside 0 to 1`,
          candidates: [],
        };
      }
      if (context.elementExists(reference.hostId)) {
        return {
          status: 'resolved',
          elementId: reference.hostId,
          role: reference.role,
          viaLineage: false,
        };
      }
      // A host that was split cannot carry a normalised position forward: 40%
      // along the original is not 40% along any of the pieces, and picking a
      // piece would silently move whatever was hosted there.
      return followLineage(reference.hostId, reference.role, context);
    }

    case 'query':
      return followLineage(reference.predecessorId, reference.role, context);
  }
}

/**
 * Walks lineage from a predecessor to whichever successor still carries the
 * role.
 *
 * Follows chains, since an element split once and then joined has two records
 * between the reference and the answer. Refuses on ambiguity rather than
 * ranking candidates - the ranking is exactly the invisible decision this
 * module exists to avoid.
 */
function followLineage(
  predecessorId: ElementId,
  role: SemanticRole,
  context: ReferenceResolutionContext,
  seen: ReadonlySet<ElementId> = new Set(),
): ReferenceResolution {
  if (seen.has(predecessorId)) {
    // A lineage cycle is a corrupt record rather than a resolvable history.
    // Returning missing beats looping.
    return missing(predecessorId);
  }

  const records = context.lineageFor(predecessorId);
  if (records.length === 0) {
    return missing(predecessorId);
  }

  // Newest record wins: it describes the most recent thing that happened to
  // this element.
  const record = records[records.length - 1]!;

  if (record.invalidatedRoles.includes(role)) {
    return {
      status: 'unresolved',
      reason: 'role-invalidated',
      detail: `the ${record.kind} in operation ${record.operationId} did not preserve "${role}"`,
      candidates: record.successorIds,
    };
  }

  const preserved = record.preservedRoles.filter((mapping) => mapping.role === role);
  if (preserved.length === 0) {
    return {
      status: 'unresolved',
      reason: 'role-invalidated',
      detail: `operation ${record.operationId} recorded no successor for "${role}"`,
      candidates: record.successorIds,
    };
  }

  const distinct = [...new Set(preserved.map((mapping) => mapping.successorId))];
  if (distinct.length > 1) {
    return {
      status: 'unresolved',
      reason: 'ambiguous',
      detail: `"${role}" survived into ${distinct.length} elements after operation ${record.operationId}`,
      candidates: distinct,
    };
  }

  const successorId = distinct[0]!;
  if (context.elementExists(successorId)) {
    return { status: 'resolved', elementId: successorId, role, viaLineage: true };
  }

  // The successor was itself replaced. Keep walking.
  return followLineage(successorId, role, context, new Set([...seen, predecessorId]));
}

function missing(elementId: ElementId): ReferenceResolution {
  return {
    status: 'unresolved',
    reason: 'element-missing',
    detail: `${elementId} no longer exists and no lineage records what replaced it`,
    candidates: [],
  };
}

export interface ReferenceCheck {
  readonly referenceId: string;
  readonly reference: StableReference;
  readonly resolution: ReferenceResolution;
}

export interface DependentCommitDecision {
  /** False when any reference failed. The commit must not proceed. */
  readonly canCommit: boolean;
  /** The dependents a user has to repair, named rather than counted (V3-119). */
  readonly blocking: readonly ReferenceCheck[];
}

/**
 * Resolves every reference a pending commit depends on and decides whether it
 * may proceed.
 *
 * All-or-nothing, deliberately. Committing the resolvable subset would leave
 * the project in a state where some dimensions moved with the edit and others
 * silently did not, which is harder to notice and harder to repair than the
 * edit simply being refused.
 */
export function decideDependentCommit(
  references: readonly { readonly referenceId: string; readonly reference: StableReference }[],
  context: ReferenceResolutionContext,
): DependentCommitDecision {
  const checks: ReferenceCheck[] = references.map((entry) => ({
    referenceId: entry.referenceId,
    reference: entry.reference,
    resolution: resolveStableReference(entry.reference, context),
  }));
  const blocking = checks.filter((check) => check.resolution.status === 'unresolved');
  return { canCommit: blocking.length === 0, blocking };
}

/** One line per blocked dependent, for the repair prompt. */
export function describeBlockedReference(check: ReferenceCheck): string {
  if (check.resolution.status === 'resolved') {
    return `${check.referenceId} resolved`;
  }
  const candidates =
    check.resolution.candidates.length > 0
      ? ` Candidates: ${check.resolution.candidates.join(', ')}.`
      : '';
  return `${check.referenceId}: ${check.resolution.detail}.${candidates}`;
}
