import type { ElementId } from './ids';

/**
 * V3-089: what deleting an element does to everything that depended on it.
 *
 * `relationships-property-group.ts` already models that relationships exist and
 * can be displayed. This decides what they *mean* when one end goes away, which
 * is the question with consequences: a wall hosting three doors, dimensioned
 * twice and referenced by a constraint, is not a thing that can simply be
 * removed from a collection.
 *
 * There are only three honest answers and the model names all three, because
 * collapsing them is where projects get quietly damaged:
 *
 * - **cascade** - the dependent cannot exist without its host and must go with
 *   it. A door in a deleted wall is not a door somewhere else; it is not a door.
 * - **detach** - the dependent survives but loses meaning it must now show. A
 *   dimension whose reference disappeared still exists, and must display as
 *   detached rather than silently measuring something new.
 * - **block** - the deletion is refused, because carrying it out would need a
 *   decision the product cannot make on the user's behalf.
 *
 * The failure mode this exists to prevent is a fourth, unnamed answer: delete
 * the element, leave the dependents pointing at nothing, and discover it later
 * as a render crash or a schedule counting doors that are not there.
 */

export type DependencyKind =
  /** The dependent is physically carried by the target. A door in a wall. */
  | 'hosted'
  /** The dependent measures or points at the target. A dimension, a constraint. */
  | 'reference'
  /** The dependent aggregates the target. A room bounded by walls, a schedule row. */
  | 'aggregate'
  /** The dependent is a type definition the target instantiates. */
  | 'type';

export type DeletionDisposition = 'cascade' | 'detach' | 'block';

export interface DependencyEdge {
  /** The element that would be affected. */
  readonly dependentId: ElementId;
  /** The element being deleted. */
  readonly targetId: ElementId;
  readonly kind: DependencyKind;
  /**
   * Set when the dependent is the *last* thing keeping something valid - a room
   * losing its final bounding wall, a schedule losing its only row. Aggregates
   * normally detach; the last one cannot.
   */
  readonly isLastSupport?: boolean;
}

/**
 * The default disposition per dependency kind.
 *
 * `type` blocks rather than cascading, and that asymmetry is deliberate:
 * deleting a wall type that fifty walls use is not a request to delete fifty
 * walls. A user who means that has to say so, because a cascade here is
 * unbounded and effectively irreversible in one gesture.
 */
export function defaultDisposition(edge: DependencyEdge): DeletionDisposition {
  switch (edge.kind) {
    case 'hosted':
      return 'cascade';
    case 'reference':
      return 'detach';
    case 'aggregate':
      // An aggregate normally survives with one fewer contributor. Losing its
      // last one is different: a room with no bounding walls is not a smaller
      // room, it is not a room, and silently keeping it would leave an element
      // that cannot be drawn or scheduled.
      return edge.isLastSupport === true ? 'block' : 'detach';
    case 'type':
      return 'block';
  }
}

export interface DeletionEffect {
  readonly dependentId: ElementId;
  readonly kind: DependencyKind;
  readonly disposition: DeletionDisposition;
  readonly reason: string;
}

export interface DeletionPlan {
  readonly targetIds: readonly ElementId[];
  /** True only when nothing blocks. A blocked plan is not partially applicable. */
  readonly canDelete: boolean;
  /** Elements that would be removed alongside the targets, transitively. */
  readonly cascadeIds: readonly ElementId[];
  /** Elements that would survive but must be shown as detached. */
  readonly detachIds: readonly ElementId[];
  /** Why the deletion is refused, empty when it is not. */
  readonly blocked: readonly DeletionEffect[];
  readonly effects: readonly DeletionEffect[];
}

export interface DeletionContext {
  /** Everything that depends on this element, directly. */
  readonly dependentsOf: (id: ElementId) => readonly DependencyEdge[];
  /** Overrides the default disposition, for a user who has explicitly chosen. */
  readonly dispositionFor?: (edge: DependencyEdge) => DeletionDisposition;
}

/**
 * Works out the full effect of deleting one or more elements, without deleting
 * anything.
 *
 * Cascades transitively, because the dependent of a cascaded element is just as
 * gone: deleting a wall removes its doors, and a dimension measuring one of
 * those doors is now measuring nothing. Computing only the first level is how a
 * "safe" delete still leaves orphans one hop out.
 */
export function planDeletion(
  targetIds: readonly ElementId[],
  context: DeletionContext,
): DeletionPlan {
  const disposition = context.dispositionFor ?? defaultDisposition;

  const cascade = new Set<ElementId>();
  const detach = new Set<ElementId>();
  const blocked: DeletionEffect[] = [];
  const effects: DeletionEffect[] = [];

  const removed = new Set<ElementId>(targetIds);
  const queue: ElementId[] = [...targetIds];
  const visited = new Set<ElementId>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      // A dependency cycle would otherwise loop forever. Visiting once is
      // correct as well as terminating: an element already scheduled for
      // removal does not become more removed.
      continue;
    }
    visited.add(current);

    for (const edge of context.dependentsOf(current)) {
      // A dependent that is itself already being deleted needs no disposition:
      // "the door goes with the wall" is not a finding when the user asked to
      // delete the door too.
      if (removed.has(edge.dependentId)) {
        continue;
      }

      const decided = disposition(edge);
      const effect: DeletionEffect = {
        dependentId: edge.dependentId,
        kind: edge.kind,
        disposition: decided,
        reason: describeReason(edge, decided),
      };
      effects.push(effect);

      if (decided === 'block') {
        blocked.push(effect);
        continue;
      }
      if (decided === 'cascade') {
        cascade.add(edge.dependentId);
        removed.add(edge.dependentId);
        queue.push(edge.dependentId);
        continue;
      }
      detach.add(edge.dependentId);
    }
  }

  return {
    targetIds,
    canDelete: blocked.length === 0,
    // Sorted so a plan is a deterministic function of the project, not of
    // traversal order - the same reason the constraint solver sorts.
    cascadeIds: [...cascade].sort(),
    detachIds: [...detach].filter((id) => !cascade.has(id)).sort(),
    blocked,
    effects,
  };
}

function describeReason(edge: DependencyEdge, disposition: DeletionDisposition): string {
  switch (disposition) {
    case 'cascade':
      return `${edge.dependentId} is hosted by ${edge.targetId} and cannot exist without it`;
    case 'detach':
      return edge.kind === 'aggregate'
        ? `${edge.dependentId} loses ${edge.targetId} as a contributor`
        : `${edge.dependentId} references ${edge.targetId} and would become detached`;
    case 'block':
      return edge.kind === 'type'
        ? `${edge.dependentId} is an instance of ${edge.targetId}; delete the instances first or change their type`
        : `${edge.targetId} is the last support for ${edge.dependentId}`;
  }
}

/** One line per blocking reason, for the confirmation the user actually reads. */
export function describeDeletionBlockers(plan: DeletionPlan): readonly string[] {
  return plan.blocked.map((effect) => effect.reason);
}

/**
 * A short summary of what the user is about to lose.
 *
 * Counts rather than lists, but never hides a cascade: "and 12 other elements"
 * is the wording that gets a project deleted, so the cascade count is always
 * stated even when it is large.
 */
export function summariseDeletion(plan: DeletionPlan): string {
  if (!plan.canDelete) {
    return `Cannot delete: ${plan.blocked.length} dependent element(s) block it.`;
  }
  const parts = [`Deletes ${plan.targetIds.length} element(s)`];
  if (plan.cascadeIds.length > 0) {
    parts.push(`removes ${plan.cascadeIds.length} hosted element(s) with them`);
  }
  if (plan.detachIds.length > 0) {
    parts.push(`detaches ${plan.detachIds.length} reference(s)`);
  }
  return `${parts.join(', ')}.`;
}
