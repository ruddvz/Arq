import { describe, expect, it } from 'vitest';
import {
  planDeletion,
  defaultDisposition,
  describeDeletionBlockers,
  summariseDeletion,
  type DependencyEdge,
  type DeletionContext,
} from './deletion-policy';
import type { ElementId } from './ids';

const id = (value: string) => value as ElementId;

function edge(
  dependentId: string,
  targetId: string,
  kind: DependencyEdge['kind'],
  isLastSupport = false,
): DependencyEdge {
  return { dependentId: id(dependentId), targetId: id(targetId), kind, isLastSupport };
}

function context(edges: readonly DependencyEdge[]): DeletionContext {
  return {
    dependentsOf: (element) => edges.filter((entry) => entry.targetId === element),
  };
}

describe('defaultDisposition', () => {
  it('cascades a hosted element, since it cannot exist without its host', () => {
    expect(defaultDisposition(edge('door-1', 'wall-1', 'hosted'))).toBe('cascade');
  });

  it('detaches a reference, so it can be shown as detached rather than silently remeasured', () => {
    expect(defaultDisposition(edge('dim-1', 'wall-1', 'reference'))).toBe('detach');
  });

  it('detaches an aggregate that still has other contributors', () => {
    expect(defaultDisposition(edge('room-1', 'wall-1', 'aggregate'))).toBe('detach');
  });

  /**
   * A room with no bounding walls is not a smaller room, it is not a room.
   * Keeping it would leave an element that cannot be drawn or scheduled.
   */
  it('blocks when the target is an aggregate’s last support', () => {
    expect(defaultDisposition(edge('room-1', 'wall-1', 'aggregate', true))).toBe('block');
  });

  /**
   * Deleting a wall type that fifty walls use is not a request to delete fifty
   * walls. The cascade would be unbounded and irreversible in one gesture.
   */
  it('blocks a type deletion rather than cascading to its instances', () => {
    expect(defaultDisposition(edge('wall-1', 'wall-type-1', 'type'))).toBe('block');
  });
});

describe('planDeletion', () => {
  it('allows deleting an element nothing depends on', () => {
    const plan = planDeletion([id('wall-1')], context([]));

    expect(plan.canDelete).toBe(true);
    expect(plan.cascadeIds).toEqual([]);
    expect(plan.detachIds).toEqual([]);
  });

  it('takes hosted elements with the host', () => {
    const plan = planDeletion(
      [id('wall-1')],
      context([edge('door-1', 'wall-1', 'hosted'), edge('window-1', 'wall-1', 'hosted')]),
    );

    expect(plan.canDelete).toBe(true);
    expect(plan.cascadeIds).toEqual(['door-1', 'window-1']);
  });

  /**
   * The orphan case. Deleting a wall removes its doors, and a dimension
   * measuring one of those doors is now measuring nothing. Computing only the
   * first level is how a "safe" delete still leaves orphans one hop out.
   */
  it('follows cascades transitively to the dependents of cascaded elements', () => {
    const plan = planDeletion(
      [id('wall-1')],
      context([
        edge('door-1', 'wall-1', 'hosted'),
        edge('handle-1', 'door-1', 'hosted'),
        edge('dim-1', 'door-1', 'reference'),
      ]),
    );

    expect(plan.cascadeIds).toEqual(['door-1', 'handle-1']);
    expect(plan.detachIds).toEqual(['dim-1']);
  });

  it('detaches a dimension rather than deleting it', () => {
    const plan = planDeletion([id('wall-1')], context([edge('dim-1', 'wall-1', 'reference')]));

    expect(plan.canDelete).toBe(true);
    expect(plan.cascadeIds).toEqual([]);
    expect(plan.detachIds).toEqual(['dim-1']);
  });

  it('blocks the whole deletion when any dependent blocks', () => {
    const plan = planDeletion(
      [id('wall-1')],
      context([edge('door-1', 'wall-1', 'hosted'), edge('room-1', 'wall-1', 'aggregate', true)]),
    );

    expect(plan.canDelete).toBe(false);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0]?.dependentId).toBe('room-1');
  });

  it('explains each blocker in terms the user can act on', () => {
    const plan = planDeletion(
      [id('wall-type-1')],
      context([edge('wall-1', 'wall-type-1', 'type')]),
    );

    const reasons = describeDeletionBlockers(plan);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/delete the instances first or change their type/);
  });

  /**
   * "The door goes with the wall" is not a finding when the user asked to
   * delete the door too.
   */
  it('does not report a dependent that is itself being deleted', () => {
    const plan = planDeletion(
      [id('wall-1'), id('door-1')],
      context([edge('door-1', 'wall-1', 'hosted')]),
    );

    expect(plan.effects).toEqual([]);
    expect(plan.cascadeIds).toEqual([]);
  });

  it('terminates on a dependency cycle rather than looping', () => {
    const plan = planDeletion(
      [id('a')],
      context([edge('b', 'a', 'hosted'), edge('a', 'b', 'hosted')]),
    );

    expect(plan.canDelete).toBe(true);
    expect(plan.cascadeIds).toEqual(['b']);
  });

  it('does not list an element as both cascaded and detached', () => {
    const plan = planDeletion(
      [id('wall-1')],
      context([edge('door-1', 'wall-1', 'hosted'), edge('door-1', 'wall-1', 'reference')]),
    );

    expect(plan.cascadeIds).toContain('door-1');
    expect(plan.detachIds).not.toContain('door-1');
  });

  it('produces a deterministic plan regardless of the order dependents are returned in', () => {
    const edges = [
      edge('door-2', 'wall-1', 'hosted'),
      edge('door-1', 'wall-1', 'hosted'),
      edge('door-3', 'wall-1', 'hosted'),
    ];
    const forward = planDeletion([id('wall-1')], context(edges));
    const reversed = planDeletion([id('wall-1')], context([...edges].reverse()));

    expect(forward.cascadeIds).toEqual(['door-1', 'door-2', 'door-3']);
    expect(reversed.cascadeIds).toEqual(forward.cascadeIds);
  });

  it('lets an explicit user choice override the default disposition', () => {
    const plan = planDeletion([id('wall-type-1')], {
      dependentsOf: (element) =>
        element === id('wall-type-1') ? [edge('wall-1', 'wall-type-1', 'type')] : [],
      // The user has confirmed they mean to delete the instances too.
      dispositionFor: () => 'cascade',
    });

    expect(plan.canDelete).toBe(true);
    expect(plan.cascadeIds).toEqual(['wall-1']);
  });
});

describe('summariseDeletion', () => {
  it('says the deletion is refused when anything blocks', () => {
    const plan = planDeletion(
      [id('wall-type-1')],
      context([edge('wall-1', 'wall-type-1', 'type')]),
    );

    expect(summariseDeletion(plan)).toMatch(/Cannot delete/);
  });

  /** "and 12 other elements" is the wording that gets a project deleted. */
  it('always states the cascade count rather than hiding it behind a total', () => {
    const plan = planDeletion(
      [id('wall-1')],
      context([
        edge('door-1', 'wall-1', 'hosted'),
        edge('door-2', 'wall-1', 'hosted'),
        edge('dim-1', 'wall-1', 'reference'),
      ]),
    );

    const summary = summariseDeletion(plan);
    expect(summary).toContain('2 hosted element(s)');
    expect(summary).toContain('1 reference(s)');
  });

  it('reports a clean deletion without inventing consequences', () => {
    const plan = planDeletion([id('wall-1')], context([]));

    expect(summariseDeletion(plan)).toBe('Deletes 1 element(s).');
  });
});
