import { describe, expect, it } from 'vitest';
import {
  resolveStableReference,
  decideDependentCommit,
  describeBlockedReference,
  type LineageRecord,
  type ReferenceResolutionContext,
  type StableReference,
} from './stable-reference';
import type { ElementId } from './ids';

const id = (value: string) => value as ElementId;

function context(
  existing: readonly string[],
  lineage: readonly LineageRecord[] = [],
): ReferenceResolutionContext {
  const present = new Set(existing);
  return {
    elementExists: (element) => present.has(element),
    lineageFor: (element) => lineage.filter((record) => record.predecessorIds.includes(element)),
  };
}

function splitRecord(overrides: Partial<LineageRecord> = {}): LineageRecord {
  return {
    operationId: 'op-split-1',
    kind: 'split',
    predecessorIds: [id('w1')],
    successorIds: [id('w1a'), id('w1b')],
    preservedRoles: [
      { role: 'start-endpoint', successorId: id('w1a') },
      { role: 'end-endpoint', successorId: id('w1b') },
    ],
    invalidatedRoles: [],
    confidence: 'exact',
    requiresUserReview: false,
    ...overrides,
  };
}

describe('resolveStableReference', () => {
  it('resolves an element reference while the element exists', () => {
    const reference: StableReference = { kind: 'element', elementId: id('w1') };

    expect(resolveStableReference(reference, context(['w1']))).toEqual({
      status: 'resolved',
      elementId: 'w1',
      viaLineage: false,
    });
  });

  it('reports a deleted element with no lineage as missing rather than guessing', () => {
    const reference: StableReference = { kind: 'element', elementId: id('w1') };
    const resolution = resolveStableReference(reference, context([]));

    expect(resolution).toMatchObject({ status: 'unresolved', reason: 'element-missing' });
  });

  it('resolves a role on an element that still exists', () => {
    const reference: StableReference = {
      kind: 'role',
      elementId: id('w1'),
      role: 'exterior-face',
    };

    expect(resolveStableReference(reference, context(['w1']))).toEqual({
      status: 'resolved',
      elementId: 'w1',
      role: 'exterior-face',
      viaLineage: false,
    });
  });

  /**
   * The case the module exists for: a wall was split, and the reference must
   * follow the role to whichever piece inherited it.
   */
  it('follows lineage to the successor that inherited the role', () => {
    const reference: StableReference = {
      kind: 'role',
      elementId: id('w1'),
      role: 'end-endpoint',
    };
    const resolution = resolveStableReference(reference, context(['w1a', 'w1b'], [splitRecord()]));

    expect(resolution).toEqual({
      status: 'resolved',
      elementId: 'w1b',
      role: 'end-endpoint',
      viaLineage: true,
    });
  });

  /**
   * The invisible-decision case. A resolver that picked the longest or nearest
   * piece would make the dimension measure something else with nothing to see.
   */
  it('refuses to choose when several successors carry the same role', () => {
    const reference: StableReference = {
      kind: 'query',
      predecessorId: id('w1'),
      role: 'centreline',
    };
    const resolution = resolveStableReference(
      reference,
      context(
        ['w1a', 'w1b'],
        [
          splitRecord({
            preservedRoles: [
              { role: 'centreline', successorId: id('w1a') },
              { role: 'centreline', successorId: id('w1b') },
            ],
          }),
        ],
      ),
    );

    expect(resolution).toMatchObject({ status: 'unresolved', reason: 'ambiguous' });
    if (resolution.status !== 'unresolved') return;
    expect([...resolution.candidates].sort()).toEqual(['w1a', 'w1b']);
  });

  it('reports a role the operation explicitly destroyed', () => {
    const reference: StableReference = {
      kind: 'role',
      elementId: id('w1'),
      role: 'exterior-face',
    };
    const resolution = resolveStableReference(
      reference,
      context(['w1a'], [splitRecord({ invalidatedRoles: ['exterior-face'] })]),
    );

    expect(resolution).toMatchObject({ status: 'unresolved', reason: 'role-invalidated' });
    if (resolution.status !== 'unresolved') return;
    expect(resolution.detail).toContain('op-split-1');
  });

  it('reports a role nobody recorded a successor for', () => {
    const reference: StableReference = { kind: 'role', elementId: id('w1'), role: 'centre' };
    const resolution = resolveStableReference(reference, context(['w1a'], [splitRecord()]));

    expect(resolution).toMatchObject({ status: 'unresolved', reason: 'role-invalidated' });
  });

  /** An element split then joined has two records between the reference and the answer. */
  it('follows a chain of lineage records', () => {
    const split = splitRecord();
    const join: LineageRecord = {
      operationId: 'op-join-1',
      kind: 'join',
      predecessorIds: [id('w1b')],
      successorIds: [id('w2')],
      preservedRoles: [{ role: 'end-endpoint', successorId: id('w2') }],
      invalidatedRoles: [],
      confidence: 'exact',
      requiresUserReview: false,
    };

    const resolution = resolveStableReference(
      { kind: 'role', elementId: id('w1'), role: 'end-endpoint' },
      context(['w2'], [split, join]),
    );

    expect(resolution).toEqual({
      status: 'resolved',
      elementId: 'w2',
      role: 'end-endpoint',
      viaLineage: true,
    });
  });

  it('stops rather than looping on a cyclic lineage record', () => {
    const cycle: LineageRecord = {
      operationId: 'op-bad',
      kind: 'replace',
      predecessorIds: [id('w1'), id('w2')],
      successorIds: [id('w2'), id('w1')],
      preservedRoles: [
        { role: 'centreline', successorId: id('w2') },
        { role: 'centreline', successorId: id('w1') },
      ],
      invalidatedRoles: [],
      confidence: 'ambiguous',
      requiresUserReview: true,
    };

    const resolution = resolveStableReference(
      { kind: 'query', predecessorId: id('w1'), role: 'centreline' },
      context([], [cycle]),
    );

    expect(resolution.status).toBe('unresolved');
  });

  it('prefers the element itself over lineage when it still exists', () => {
    // An offset produced a new element; that did not stop the original being
    // what the reference named.
    const offset: LineageRecord = {
      operationId: 'op-offset',
      kind: 'offset',
      predecessorIds: [id('w1')],
      successorIds: [id('w1-offset')],
      preservedRoles: [{ role: 'centreline', successorId: id('w1-offset') }],
      invalidatedRoles: [],
      confidence: 'derived',
      requiresUserReview: false,
    };

    const resolution = resolveStableReference(
      { kind: 'role', elementId: id('w1'), role: 'centreline' },
      context(['w1', 'w1-offset'], [offset]),
    );

    expect(resolution).toMatchObject({ elementId: 'w1', viaLineage: false });
  });

  describe('parametric references', () => {
    it('resolves against a host that still exists', () => {
      const reference: StableReference = {
        kind: 'parametric',
        hostId: id('w1'),
        role: 'centreline',
        position: 0.4,
      };

      expect(resolveStableReference(reference, context(['w1']))).toMatchObject({
        status: 'resolved',
        elementId: 'w1',
      });
    });

    it.each([[-0.1], [1.1], [NaN]])('rejects an out-of-range position (%p)', (position) => {
      const reference: StableReference = {
        kind: 'parametric',
        hostId: id('w1'),
        role: 'centreline',
        position,
      };

      expect(resolveStableReference(reference, context(['w1']))).toMatchObject({
        status: 'unresolved',
        reason: 'position-out-of-range',
      });
    });

    /**
     * 40% along the original is not 40% along any piece, so picking a piece
     * would silently move whatever was hosted there.
     */
    it('refuses a split host whose pieces both carry the role', () => {
      const resolution = resolveStableReference(
        { kind: 'parametric', hostId: id('w1'), role: 'centreline', position: 0.4 },
        context(
          ['w1a', 'w1b'],
          [
            splitRecord({
              preservedRoles: [
                { role: 'centreline', successorId: id('w1a') },
                { role: 'centreline', successorId: id('w1b') },
              ],
            }),
          ],
        ),
      );

      expect(resolution).toMatchObject({ status: 'unresolved', reason: 'ambiguous' });
    });
  });
});

describe('decideDependentCommit', () => {
  it('allows a commit when every reference resolves', () => {
    const decision = decideDependentCommit(
      [
        { referenceId: 'dim-1', reference: { kind: 'element', elementId: id('w1') } },
        {
          referenceId: 'dim-2',
          reference: { kind: 'role', elementId: id('w1'), role: 'centreline' },
        },
      ],
      context(['w1']),
    );

    expect(decision.canCommit).toBe(true);
    expect(decision.blocking).toEqual([]);
  });

  /**
   * All-or-nothing. Committing the resolvable subset would leave some
   * dimensions moved with the edit and others silently not, which is harder to
   * notice and harder to repair than a refusal.
   */
  it('blocks the whole commit when any single reference fails', () => {
    const decision = decideDependentCommit(
      [
        { referenceId: 'dim-1', reference: { kind: 'element', elementId: id('w1') } },
        { referenceId: 'dim-2', reference: { kind: 'element', elementId: id('gone') } },
      ],
      context(['w1']),
    );

    expect(decision.canCommit).toBe(false);
    expect(decision.blocking).toHaveLength(1);
    expect(decision.blocking[0]?.referenceId).toBe('dim-2');
  });

  it('names every blocked dependent rather than counting them', () => {
    const decision = decideDependentCommit(
      [
        { referenceId: 'dim-1', reference: { kind: 'element', elementId: id('gone-a') } },
        { referenceId: 'constraint-7', reference: { kind: 'element', elementId: id('gone-b') } },
      ],
      context([]),
    );

    expect(decision.blocking.map((check) => check.referenceId)).toEqual(['dim-1', 'constraint-7']);
  });

  it('describes a blocked reference with its candidates, so a repair can offer choices', () => {
    const decision = decideDependentCommit(
      [
        {
          referenceId: 'dim-1',
          reference: { kind: 'query', predecessorId: id('w1'), role: 'centreline' },
        },
      ],
      context(
        ['w1a', 'w1b'],
        [
          splitRecord({
            preservedRoles: [
              { role: 'centreline', successorId: id('w1a') },
              { role: 'centreline', successorId: id('w1b') },
            ],
          }),
        ],
      ),
    );

    const described = describeBlockedReference(decision.blocking[0]!);

    expect(described).toContain('dim-1');
    expect(described).toContain('w1a');
    expect(described).toContain('w1b');
  });
});
