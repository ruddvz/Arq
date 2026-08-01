import { describe, expect, it } from 'vitest';
import type { HostOperation } from './project-host';
import { SEMANTIC_KINDS, createMemoryArqHost } from './memory-project-host';

let sequence = 0;
function operation(
  operationType: string,
  args: Record<string, unknown>,
  preconditions: HostOperation['preconditions'] = [],
): HostOperation {
  sequence += 1;
  return {
    operationId: `op-${sequence}`,
    operationType,
    operationVersion: '1.0.0',
    arguments: args as HostOperation['arguments'],
    preconditions,
  };
}

function seededProject() {
  const bundle = createMemoryArqHost();
  bundle.host.createDraft('project-a', 'Test house');
  const applied = bundle.operator.apply(
    'project-a',
    'rev-000000',
    [
      operation('architecture.level.create', {
        levelId: 'level-0',
        name: 'Ground',
        elevationMm: 0,
      }),
      operation('architecture.wall_type.create', {
        wallTypeId: 'type-100',
        name: 'Generic 100',
        thicknessMm: 100,
        defaultHeightMm: 2700,
      }),
    ],
    'operator',
  );
  expect(applied.status).toBe('applied');
  return bundle;
}

function wall(id: string, extra: Record<string, unknown> = {}) {
  return operation('architecture.wall.create', {
    wallId: id,
    levelId: 'level-0',
    wallTypeId: 'type-100',
    from: { xMm: 0, yMm: 0 },
    to: { xMm: 5000, yMm: 0 },
    ...extra,
  });
}

describe('validation is the real Arq validation', () => {
  it('rejects a degenerate wall with @arq/validation’s own message', () => {
    const { host } = seededProject();
    const result = host.validate('project-a', 'rev-000001', [
      wall('w1', { to: { xMm: 0, yMm: 0 } }),
    ]);
    expect(result.status).toBe('failed');
    expect(result.messages.map((m) => m.code)).toContain('WALL_TOO_SHORT');
  });

  it('rejects a self-intersecting room boundary', () => {
    const { host } = seededProject();
    const result = host.validate('project-a', 'rev-000001', [
      operation('architecture.room.create', {
        roomId: 'r1',
        levelId: 'level-0',
        name: 'Bow tie',
        boundary: [
          { xMm: 0, yMm: 0 },
          { xMm: 1000, yMm: 1000 },
          { xMm: 1000, yMm: 0 },
          { xMm: 0, yMm: 1000 },
        ],
      }),
    ]);
    expect(result.status).toBe('failed');
    expect(result.messages.map((m) => m.code)).toContain('ROOM_SELF_INTERSECTING');
  });

  it('rejects overlapping openings on the same wall', () => {
    const { host, operator } = seededProject();
    operator.apply('project-a', 'rev-000001', [wall('w1')], 'operator');
    const result = host.validate('project-a', 'rev-000002', [
      operation('architecture.door.place', {
        openingId: 'd1',
        hostWallId: 'w1',
        offsetMm: 1000,
        widthMm: 900,
      }),
      operation('architecture.window.place', {
        openingId: 'n1',
        hostWallId: 'w1',
        offsetMm: 1400,
        widthMm: 900,
        heightMm: 1000,
        sillHeightMm: 900,
      }),
    ]);
    expect(result.status).toBe('failed');
    expect(result.messages.map((m) => m.code)).toContain('OPENING_OVERLAP');
  });

  it('rejects an opening that runs past the end of its wall', () => {
    const { host, operator } = seededProject();
    operator.apply('project-a', 'rev-000001', [wall('w1')], 'operator');
    const result = host.validate('project-a', 'rev-000002', [
      operation('architecture.door.place', {
        openingId: 'd1',
        hostWallId: 'w1',
        offsetMm: 4800,
        widthMm: 900,
      }),
    ]);
    expect(result.status).toBe('failed');
    expect(result.messages.map((m) => m.code)).toContain('OPENING_EXCEEDS_HOST_LENGTH');
  });

  it('warns rather than blocks on a duplicated wall', () => {
    const { host, operator } = seededProject();
    operator.apply('project-a', 'rev-000001', [wall('w1')], 'operator');
    const result = host.validate('project-a', 'rev-000002', [wall('w2')]);
    expect(result.status).toBe('passed');
    expect(result.messages.map((m) => m.severity)).toEqual(['warning']);
  });

  it('turns a rejected constructor value into a validation result, not a crash', () => {
    const { host } = seededProject();
    const result = host.validate('project-a', 'rev-000001', [
      operation('architecture.wall_type.create', {
        wallTypeId: 'type-zero',
        name: 'Zero',
        thicknessMm: 0.5,
        defaultHeightMm: 2700,
      }),
    ]);
    // 0.5 mm passes the schema's minimum of 1? No: the schema rejects it
    // first, which is the point - the caller learns which argument was wrong.
    expect(result.status).toBe('failed');
    expect(result.messages[0]?.code).toBe('OPERATION_ARGUMENTS_INVALID');
  });

  it('names the operation that broke the batch', () => {
    const { host } = seededProject();
    const result = host.validate('project-a', 'rev-000001', [
      wall('w1'),
      wall('w2', { levelId: 'level-missing' }),
      wall('w3'),
    ]);
    expect(result.status).toBe('failed');
    expect(result.failedOperationId).toBeDefined();
    expect(result.messages.map((m) => m.code)).toContain('REFERENCE_NOT_FOUND');
  });

  it('reports a stale base revision instead of validating against the wrong state', () => {
    const { host } = seededProject();
    const result = host.validate('project-a', 'rev-000000', [wall('w1')]);
    expect(result.status).toBe('failed');
    expect(result.messages[0]?.code).toBe('BASE_REVISION_STALE');
  });
});

describe('validation never changes anything', () => {
  it('leaves the revision and the model untouched, whether it passes or fails', () => {
    const { host } = seededProject();
    const before = host.getSnapshot('project-a');

    host.validate('project-a', 'rev-000001', [wall('w1')]);
    host.validate('project-a', 'rev-000001', [wall('w2', { to: { xMm: 0, yMm: 0 } })]);

    expect(host.getSnapshot('project-a')).toEqual(before);
    expect(host.getSummary('project-a')?.revision).toBe('rev-000001');
  });
});

describe('application is atomic', () => {
  it('applies every operation or none, and a rejected batch leaves the revision unchanged', () => {
    const { host, operator } = seededProject();
    const rejected = operator.apply(
      'project-a',
      'rev-000001',
      [wall('w1'), wall('w2', { wallTypeId: 'type-missing' }), wall('w3')],
      'operator',
    );
    expect(rejected.status).toBe('rejected');
    expect(host.getSummary('project-a')?.revision).toBe('rev-000001');
    expect(host.getSnapshot('project-a')?.semanticCounts[SEMANTIC_KINDS.wall]).toBe(0);
  });

  it('moves exactly one revision on success and records one undo group', () => {
    const { host, operator } = seededProject();
    const applied = operator.apply(
      'project-a',
      'rev-000001',
      [
        wall('w1'),
        wall('w2', {
          from: { xMm: 0, yMm: 0 },
          to: { xMm: 0, yMm: 4000 },
        }),
      ],
      'operator',
    );
    expect(applied.status).toBe('applied');
    expect(applied.revisionAfter).toBe('rev-000002');
    expect(host.getUndoGroup('project-a', applied.undoGroupId ?? '')?.operationCount).toBe(2);
    expect(host.getSnapshot('project-a')?.semanticCounts[SEMANTIC_KINDS.wall]).toBe(2);
  });

  it('revalidates at commit time rather than trusting the staging verdict', () => {
    const { operator } = seededProject();
    // Staged against rev-000001, but the project has moved to rev-000002.
    operator.apply('project-a', 'rev-000001', [wall('w1')], 'operator');
    const stale = operator.apply('project-a', 'rev-000001', [wall('w2')], 'operator');
    expect(stale.status).toBe('rejected');
    expect(stale.messages[0]?.code).toBe('BASE_REVISION_STALE');
  });
});

describe('grouped undo', () => {
  it('restores the previous state exactly', () => {
    const { host, operator } = seededProject();
    const before = host.getSnapshot('project-a');
    const applied = operator.apply('project-a', 'rev-000001', [wall('w1')], 'operator');
    expect(host.getSnapshot('project-a')?.semanticCounts[SEMANTIC_KINDS.wall]).toBe(1);

    const undone = operator.undo('project-a', applied.undoGroupId ?? '');
    expect(undone.status).toBe('applied');
    expect(host.getSnapshot('project-a')?.semanticCounts).toEqual(before?.semanticCounts);
  });

  it('refuses to undo blind when later work sits on top', () => {
    const { host, operator } = seededProject();
    const first = operator.apply('project-a', 'rev-000001', [wall('w1')], 'operator');
    operator.apply(
      'project-a',
      'rev-000002',
      [wall('w2', { from: { xMm: 0, yMm: 0 }, to: { xMm: 0, yMm: 3000 } })],
      'operator',
    );

    expect(host.getUndoGroup('project-a', first.undoGroupId ?? '')?.hasDownstreamChanges).toBe(
      true,
    );
    const undone = operator.undo('project-a', first.undoGroupId ?? '');
    expect(undone.status).toBe('rejected');
    expect(undone.messages[0]?.code).toBe('UNDO_HAS_DOWNSTREAM_CHANGES');
  });
});

describe('preconditions', () => {
  it('checks existence, absence, version and revision', () => {
    const { host, operator } = seededProject();
    operator.apply('project-a', 'rev-000001', [wall('w1')], 'operator');

    const good = host.validate('project-a', 'rev-000002', [
      operation('architecture.wall.update', { wallId: 'w1', heightMm: 2400 }, [
        { kind: 'project.revision_equals', revision: 'rev-000002' },
        { kind: 'element.exists', elementId: 'w1' },
        { kind: 'element.absent', elementId: 'w9' },
        { kind: 'element.version_equals', elementId: 'w1', version: 1 },
      ]),
    ]);
    expect(good.status).toBe('passed');

    const bad = host.validate('project-a', 'rev-000002', [
      operation('architecture.wall.update', { wallId: 'w1', heightMm: 2400 }, [
        { kind: 'element.version_equals', elementId: 'w1', version: 7 },
      ]),
    ]);
    expect(bad.status).toBe('failed');
    expect(bad.messages[0]?.code).toBe('PRECONDITION_FAILED');
  });
});

describe('downstream impact', () => {
  it('reports an opening that a wall change would no longer contain', () => {
    const { host, operator } = seededProject();
    operator.apply('project-a', 'rev-000001', [wall('w1')], 'operator');
    operator.apply(
      'project-a',
      'rev-000002',
      [
        operation('architecture.door.place', {
          openingId: 'd1',
          hostWallId: 'w1',
          offsetMm: 500,
          widthMm: 900,
          heightMm: 2100,
        }),
      ],
      'operator',
    );

    const result = host.validate('project-a', 'rev-000003', [
      operation('architecture.wall.update', { wallId: 'w1', heightMm: 1000 }),
    ]);
    expect(result.status).toBe('failed');
    expect(result.messages.map((m) => m.code)).toContain('OPENING_EXCEEDS_HOST_HEIGHT');
    expect(result.affectedElementIds).toContain('d1');
  });

  it('lists the derived outputs a passing batch would invalidate', () => {
    const { host } = seededProject();
    const result = host.validate('project-a', 'rev-000001', [wall('w1')]);
    expect(result.status).toBe('passed');
    expect(result.expectedInvalidations).toContain('plan-render-cache');
    expect(result.availablePreviews).toContain('plan');
  });
});

describe('queries', () => {
  it('projects only the requested fields and pages deterministically', () => {
    const { host, operator } = seededProject();
    operator.apply(
      'project-a',
      'rev-000001',
      [
        wall('w1'),
        wall('w2', { from: { xMm: 0, yMm: 0 }, to: { xMm: 0, yMm: 3000 } }),
        wall('w3', { from: { xMm: 1, yMm: 1 }, to: { xMm: 4000, yMm: 1 } }),
      ],
      'operator',
    );

    const page = host.query({
      projectId: 'project-a',
      snapshotRevision: 'rev-000002',
      kinds: [SEMANTIC_KINDS.wall],
      fields: ['wallId', 'hostedOpeningIds'],
      offset: 0,
      limit: 2,
    });
    expect(page?.totalMatches).toBe(3);
    expect(page?.items).toHaveLength(2);
    expect(Object.keys(page?.items[0]?.data ?? {}).sort()).toEqual(['hostedOpeningIds', 'wallId']);
    expect(page?.items.map((item) => item.id)).toEqual(['w1', 'w2']);
  });

  it('refuses a query against a revision that is no longer current', () => {
    const { host } = seededProject();
    expect(
      host.query({
        projectId: 'project-a',
        snapshotRevision: 'rev-000000',
        offset: 0,
        limit: 10,
      }),
    ).toBeUndefined();
  });

  it('searches case-insensitively without a locale-sensitive fold', () => {
    const { host } = seededProject();
    const page = host.query({
      projectId: 'project-a',
      snapshotRevision: 'rev-000001',
      text: 'GENERIC',
      offset: 0,
      limit: 10,
    });
    expect(page?.items.map((item) => item.id)).toEqual(['type-100']);
  });
});

describe('opening a project', () => {
  it('reports honestly when no Arq application is listening', () => {
    const bundle = createMemoryArqHost({ applicationRunning: false });
    bundle.host.createDraft('project-a', 'Test');
    expect(bundle.host.requestOpen('project-a')).toBe('runtime_unavailable');
  });

  it('never resolves a project it does not have', () => {
    const { host } = seededProject();
    expect(host.requestOpen('project-elsewhere')).toBe('runtime_unavailable');
  });
});

describe('the read half has no way to change anything', () => {
  it('exposes no apply, undo or publish method', () => {
    const { host } = seededProject();
    const surface = host as unknown as Record<string, unknown>;
    for (const forbidden of ['apply', 'undo', 'commit', 'markPublished', 'setAccessState']) {
      expect(surface[forbidden]).toBeUndefined();
    }
  });
});
