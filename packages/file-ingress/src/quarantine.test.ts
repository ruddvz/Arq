import { describe, expect, it } from 'vitest';
import {
  QUARANTINE_SAMPLE_LIMIT,
  groupQuarantined,
  quarantineIssues,
  quarantinePayloadBytes,
  unaccountedSourceObjects,
  type QuarantinedEntity,
} from './quarantine';

function entity(overrides: Partial<QuarantinedEntity> = {}): QuarantinedEntity {
  return {
    sourceObjectId: 'e-1',
    sourceType: 'SPLINE',
    reason: 'unsupported-type',
    detail: 'Arq does not read splines yet',
    rawPayload: '0\nSPLINE\n',
    ...overrides,
  };
}

describe('groupQuarantined', () => {
  it('groups by type and reason, not by type alone', () => {
    // "40 SPLINE entities, 37 unsupported and 3 degenerate" is two problems
    // with two answers; collapsing them hides the smaller one.
    const groups = groupQuarantined([
      entity({ sourceObjectId: 'a' }),
      entity({ sourceObjectId: 'b' }),
      entity({ sourceObjectId: 'c', reason: 'degenerate-geometry' }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ sourceType: 'SPLINE', reason: 'unsupported-type', count: 2 });
    expect(groups[1]).toMatchObject({ reason: 'degenerate-geometry', count: 1 });
  });

  it('orders by count descending, then deterministically', () => {
    const groups = groupQuarantined([
      entity({ sourceObjectId: 'a', sourceType: 'ZEBRA' }),
      entity({ sourceObjectId: 'b', sourceType: 'ACAD_PROXY' }),
      entity({ sourceObjectId: 'c', sourceType: 'ACAD_PROXY' }),
    ]);

    expect(groups.map((group) => group.sourceType)).toEqual(['ACAD_PROXY', 'ZEBRA']);
  });

  it('caps samples so the examples do not become the report', () => {
    const many = Array.from({ length: 40 }, (_, index) => entity({ sourceObjectId: `e-${index}` }));

    const group = groupQuarantined(many)[0];

    expect(group?.count).toBe(40);
    expect(group?.sampleSourceObjectIds).toHaveLength(QUARANTINE_SAMPLE_LIMIT);
  });

  it('collects the layers, so a surface can show the user where the gaps are', () => {
    const groups = groupQuarantined([
      entity({ sourceObjectId: 'a', sourceLayer: 'A-WALL' }),
      entity({ sourceObjectId: 'b', sourceLayer: 'A-ANNO' }),
      entity({ sourceObjectId: 'c', sourceLayer: 'A-WALL' }),
    ]);

    expect(groups[0]?.layers).toEqual(['A-ANNO', 'A-WALL']);
  });

  it('is empty for nothing quarantined', () => {
    expect(groupQuarantined([])).toEqual([]);
  });
});

describe('quarantineIssues', () => {
  it('reports a warning, never an error', () => {
    // The import succeeded and something needs attention. Errors on every
    // successful import are how the one that mattered gets missed.
    const issues = quarantineIssues(groupQuarantined([entity()]));

    expect(issues[0]?.severity).toBe('warning');
  });

  it('says what was quarantined and that it was kept', () => {
    const issues = quarantineIssues(
      groupQuarantined([
        entity({ sourceObjectId: 'a', sourceLayer: 'A-WALL' }),
        entity({ sourceObjectId: 'b', sourceLayer: 'A-WALL' }),
      ]),
    );

    expect(issues[0]?.message).toContain('2 SPLINE entities');
    expect(issues[0]?.message).toContain('A-WALL');
    expect(issues[0]?.message).toContain('Kept in the project');
  });

  it('uses the singular for one entity', () => {
    expect(quarantineIssues(groupQuarantined([entity()]))[0]?.message).toContain('1 SPLINE entity');
  });

  it('carries a stable code per reason', () => {
    const issues = quarantineIssues(groupQuarantined([entity({ reason: 'unresolved-reference' })]));

    expect(issues[0]?.code).toBe('ARQ_IMPORT_QUARANTINED_UNRESOLVED_REFERENCE');
  });
});

describe('quarantinePayloadBytes', () => {
  it('reports what keeping everything cost', () => {
    // A project that grew by 40MB of quarantined splines should say so.
    expect(
      quarantinePayloadBytes([entity({ rawPayload: 'abcd' }), entity({ rawPayload: 'ef' })]),
    ).toBe(6);
  });
});

describe('unaccountedSourceObjects', () => {
  it('finds a source object that was neither converted nor quarantined', () => {
    // An object in neither was dropped, which is the thing this exists to
    // prevent, and without this check it would be invisible.
    const dropped = unaccountedSourceObjects(
      ['a', 'b', 'c'],
      ['a'],
      [entity({ sourceObjectId: 'b' })],
    );

    expect(dropped).toEqual(['c']);
  });

  it('is empty when everything is accounted for', () => {
    expect(unaccountedSourceObjects(['a', 'b'], ['a'], [entity({ sourceObjectId: 'b' })])).toEqual(
      [],
    );
  });

  it('is empty for a source with no objects', () => {
    expect(unaccountedSourceObjects([], [], [])).toEqual([]);
  });
});
