import { describe, expect, it } from 'vitest';
import { createAuditTrail } from '../audit/audit-trail';
import { createControlledClock, createSequentialIdSource } from '../runtime/clock';
import { createGrant, revokeGrant, type GrantContext } from '../grant/grant';
import { GRANT_PRESETS } from '../grant/scopes';
import { createMemoryArqHost } from '../host/memory-project-host';
import { createDefaultDomainProfileRegistry } from '../profile/profile-registry';
import { isArqMcpError } from '../domain/errors';
import { PROPOSAL_LIFETIME_MS } from '../domain/limits';
import type { ChangeSetInput } from '../domain/changeset';
import type { DesignProgramInput } from '../domain/design-program';
import { ArqBridge } from './bridge-adapter';
import { encodeCursor } from './cursor';

const START = 1_700_000_000_000;

function harness(preset: keyof typeof GRANT_PRESETS = 'propose') {
  const clock = createControlledClock(START);
  const { host, operator } = createMemoryArqHost();
  const registry = createDefaultDomainProfileRegistry();
  const audit = createAuditTrail(clock.now);
  const bridge = new ArqBridge({
    host,
    registry,
    clock: clock.now,
    idSource: createSequentialIdSource('id'),
    audit,
    serverMode: 'local_runtime',
  });

  host.createDraft('project-a', 'Granted house');
  host.createDraft('project-secret', 'Not granted');
  operator.apply(
    'project-a',
    'rev-000000',
    [
      {
        operationId: 'seed-1',
        operationType: 'architecture.level.create',
        operationVersion: '1.0.0',
        arguments: { levelId: 'level-0', name: 'Ground', elevationMm: 0 },
        preconditions: [],
      },
      {
        operationId: 'seed-2',
        operationType: 'architecture.wall_type.create',
        operationVersion: '1.0.0',
        arguments: {
          wallTypeId: 'type-100',
          name: 'Generic 100',
          thicknessMm: 100,
          defaultHeightMm: 2700,
        },
        preconditions: [],
      },
    ],
    'operator',
  );

  const grant = createGrant({
    grantId: 'grant-1',
    subjectId: 'subject-1',
    tenantId: 'tenant-1',
    clientName: 'claude-code',
    clientVersion: '1.0.0',
    scopes: GRANT_PRESETS[preset],
    projectIds: ['project-a'],
    issuedAtEpochMs: START,
    lifetimeMs: 60 * 60 * 1000,
  });

  return { bridge, grant, clock, host, operator, registry, audit };
}

function wallChangeSet(overrides: Partial<ChangeSetInput> = {}): ChangeSetInput {
  return {
    format: 'arq.changeset',
    schemaVersion: '1.0.0',
    changeSetId: 'cs-1',
    projectId: 'project-a',
    baseRevision: 'rev-000001',
    intent: 'Add the north wall.',
    constraints: [],
    operations: [
      {
        operationId: 'op-1',
        operationType: 'architecture.wall.create',
        operationVersion: '1.0.0',
        arguments: {
          wallId: 'w1',
          levelId: 'level-0',
          wallTypeId: 'type-100',
          from: { xMm: 0, yMm: 0 },
          to: { xMm: 5000, yMm: 0 },
        },
        preconditions: [],
      },
    ],
    ...overrides,
  };
}

function vehicleProgram(overrides: Partial<DesignProgramInput> = {}): DesignProgramInput {
  return {
    format: 'arq.design-program',
    schemaVersion: '1.0.0',
    designProgramId: 'program-vtol',
    designDomain: 'vehicle.concept',
    executionIntent: 'requires_registered_operations',
    title: 'Original four-rotor concept craft',
    objective: 'An original concept for a crewed vertical take-off craft.',
    constraints: [],
    assumptions: [],
    requirements: [],
    components: [
      {
        id: 'airframe',
        title: 'Airframe',
        role: 'Primary structure.',
        requestedCapabilities: ['vehicle.concept.fuselage.create'],
        requirementIds: [],
        interfaceComponentIds: [],
        notes: [],
      },
    ],
    tasks: [
      {
        id: 't1',
        title: 'Build the airframe',
        outcome: 'The airframe exists.',
        dependsOn: [],
        componentIds: ['airframe'],
        acceptanceCriteria: ['A reviewer can see the airframe.'],
        requestedCapabilities: [],
        priority: 'high',
      },
    ],
    references: [],
    questions: ['How many crew?'],
    ...overrides,
  };
}

function caught(run: () => unknown): { code: string; state: string; nextAction: string } {
  try {
    run();
  } catch (error) {
    if (isArqMcpError(error)) {
      return { code: error.code, state: error.state, nextAction: error.nextAction };
    }
    throw error;
  }
  throw new Error('expected the call to be refused');
}

describe('capabilities', () => {
  it('reports the grant, the catalogue revision and what is absent', () => {
    const { bridge, grant } = harness();
    const report = bridge.getCapabilities(grant);
    expect(report.approvalModel).toBe('arq_side_only');
    expect(report.catalogRevision).toMatch(/^catalog:/);
    expect(report.grant.state).toBe('active');
    expect(report.grant.projectCount).toBe(1);
    expect(report.absentCapabilities).toContain('canonical.commit');
    expect(report.absentCapabilities).toContain('filesystem.path_open');
    expect(report.profiles.map((profile) => profile.profileId)).toContain('vehicle.concept');
  });

  it('advertises exactly the limits the schemas enforce', () => {
    const { bridge, grant } = harness();
    expect(bridge.getCapabilities(grant).limits.maxBriefWorkItems).toBe(200);
    expect(bridge.getCapabilities(grant).limits.inlineBinaryAllowed).toBe(false);
  });
});

describe('project isolation', () => {
  it('lists only granted projects', () => {
    const { bridge, grant } = harness();
    const page = bridge.listProjects(grant, { limit: 50 });
    expect(page.items.map((summary) => summary?.projectId)).toEqual(['project-a']);
  });

  it('answers identically for an ungranted project and one that does not exist', () => {
    const { bridge, grant } = harness();
    const ungranted = caught(() => bridge.getProjectSnapshot(grant, 'project-secret'));
    const absent = caught(() => bridge.getProjectSnapshot(grant, 'project-nowhere'));
    expect(ungranted).toEqual(absent);
    expect(ungranted.code).toBe('ARQ_PROJECT_NOT_AVAILABLE');
  });

  it('refuses everything once the grant expires or is revoked', () => {
    const { bridge, grant, clock } = harness();
    clock.set(grant.expiresAtEpochMs);
    expect(caught(() => bridge.listProjects(grant, { limit: 10 })).code).toBe('ARQ_GRANT_EXPIRED');

    const withdrawn = revokeGrant(grant);
    clock.set(START);
    expect(caught(() => bridge.listProjects(withdrawn, { limit: 10 })).code).toBe(
      'ARQ_GRANT_REVOKED',
    );
  });

  it('refuses a scope the grant does not carry', () => {
    const { bridge, grant } = harness('read_only');
    const refusal = caught(() =>
      bridge.stageChangeSet(grant, { requestId: 'r1', changeSet: wallChangeSet() }),
    );
    expect(refusal.code).toBe('ARQ_SCOPE_MISSING');
    expect(refusal.nextAction).toContain('operator');
  });
});

describe('cursors are bound to the query that issued them', () => {
  it('refuses a cursor presented to a different query', () => {
    const { bridge, grant } = harness();
    const foreign = encodeCursor(0, { tool: 'arq_list_briefs', scopeKey: { anything: 1 } });
    expect(caught(() => bridge.listProjects(grant, { cursor: foreign, limit: 10 })).code).toBe(
      'ARQ_CURSOR_INVALID',
    );
  });

  it('refuses a cursor from a query at a different revision', () => {
    const { bridge, grant, operator } = harness();
    const first = bridge.queryModel(grant, {
      projectId: 'project-a',
      snapshotRevision: 'rev-000001',
      limit: 1,
    });
    expect(first.nextCursor).toBeDefined();

    operator.apply(
      'project-a',
      'rev-000001',
      [
        {
          operationId: 'x',
          operationType: 'architecture.level.create',
          operationVersion: '1.0.0',
          arguments: { levelId: 'level-1', name: 'First', elevationMm: 3000 },
          preconditions: [],
        },
      ],
      'operator',
    );

    expect(
      caught(() =>
        bridge.queryModel(grant, {
          projectId: 'project-a',
          snapshotRevision: 'rev-000002',
          ...(first.nextCursor === undefined ? {} : { cursor: first.nextCursor }),
          limit: 1,
        }),
      ).code,
    ).toBe('ARQ_CURSOR_INVALID');
  });

  it('pages correctly when used as issued', () => {
    const { bridge, grant } = harness();
    const first = bridge.queryModel(grant, {
      projectId: 'project-a',
      snapshotRevision: 'rev-000001',
      limit: 1,
    });
    const second = bridge.queryModel(grant, {
      projectId: 'project-a',
      snapshotRevision: 'rev-000001',
      ...(first.nextCursor === undefined ? {} : { cursor: first.nextCursor }),
      limit: 1,
    });
    expect(first.items[0]?.id).not.toBe(second.items[0]?.id);
    expect(second.truncated).toBe(false);
  });
});

describe('plans', () => {
  it('stores a design program with derived provenance and keeps questions visible', () => {
    const { bridge, grant } = harness();
    const saved = bridge.saveDesignProgram(grant, {
      requestId: 'r1',
      designProgram: vehicleProgram(),
    });
    expect(saved.designProgram.provenance.clientName).toBe('claude-code');
    expect(saved.designProgram.provenance.origin).toBe('mcp_client');
    expect(saved.designProgram.version).toBe(1);
    expect(saved.warnings.join(' ')).toContain('question');
  });

  it('versions a revised design program instead of refusing it', () => {
    const { bridge, grant } = harness();
    bridge.saveDesignProgram(grant, { requestId: 'r1', designProgram: vehicleProgram() });
    const revised = bridge.saveDesignProgram(grant, {
      requestId: 'r2',
      designProgram: vehicleProgram({ title: 'Original four-rotor concept craft, revision B' }),
    });
    expect(revised.designProgram.version).toBe(2);
  });

  it('returns the first answer for a repeated request id and refuses a changed one', () => {
    const { bridge, grant } = harness();
    const first = bridge.saveDesignProgram(grant, {
      requestId: 'r1',
      designProgram: vehicleProgram(),
    });
    const repeat = bridge.saveDesignProgram(grant, {
      requestId: 'r1',
      designProgram: vehicleProgram(),
    });
    expect(repeat.designProgram.contentHash).toBe(first.designProgram.contentHash);

    expect(
      caught(() =>
        bridge.saveDesignProgram(grant, {
          requestId: 'r1',
          designProgram: vehicleProgram({ title: 'Something else entirely' }),
        }),
      ).code,
    ).toBe('ARQ_IDEMPOTENCY_CONFLICT');
  });

  it('can read back what it stored', () => {
    const { bridge, grant } = harness();
    bridge.saveDesignProgram(grant, { requestId: 'r1', designProgram: vehicleProgram() });
    expect(bridge.getDesignProgram(grant, 'program-vtol').designProgram.title).toContain('rotor');
    expect(bridge.listDesignPrograms(grant, { limit: 10 }).totalMatches).toBe(1);
    expect(caught(() => bridge.getDesignProgram(grant, 'program-nowhere')).code).toBe(
      'ARQ_RECORD_NOT_AVAILABLE',
    );
  });
});

describe('capability coverage', () => {
  it('answers a request Arq cannot serve with the owning profile and its blockers', () => {
    const { bridge, grant } = harness();
    bridge.saveDesignProgram(grant, { requestId: 'r1', designProgram: vehicleProgram() });
    const coverage = bridge.assessDesignProgramCoverage(grant, {
      designProgramId: 'program-vtol',
      projectId: 'project-a',
    });

    expect(coverage.state).toBe('blocked_by_capability');
    const row = coverage.coverage[0];
    expect(row?.status).toBe('unavailable');
    expect(row?.owningProfileId).toBe('vehicle.concept');
    expect(row?.blockers.length).toBeGreaterThan(3);
    expect(coverage.warnings.join(' ')).toContain('does not check geometry');
    expect(coverage.warnings.join(' ')).toContain('Do not substitute');
  });

  it('does not conclude readiness from an empty check', () => {
    const { bridge, grant } = harness();
    bridge.saveDesignProgram(grant, {
      requestId: 'r1',
      designProgram: vehicleProgram({
        designProgramId: 'program-empty',
        executionIntent: 'requires_registered_operations',
        components: [
          {
            id: 'airframe',
            title: 'Airframe',
            role: 'Primary structure.',
            requestedCapabilities: [],
            requirementIds: [],
            interfaceComponentIds: [],
            notes: [],
          },
        ],
      }),
    });
    const coverage = bridge.assessDesignProgramCoverage(grant, {
      designProgramId: 'program-empty',
      projectId: 'project-a',
    });
    expect(coverage.state).toBe('blocked_by_capability');
    expect(coverage.warnings.join(' ')).toContain('execution step missing');
  });

  it('reports a registered capability as available with its versions', () => {
    const { bridge, grant } = harness();
    bridge.saveDesignProgram(grant, {
      requestId: 'r1',
      designProgram: vehicleProgram({
        designProgramId: 'program-arch',
        designDomain: 'architecture',
        components: [
          {
            id: 'north-wall',
            title: 'North wall',
            role: 'Encloses the plan.',
            requestedCapabilities: ['architecture.wall.create'],
            requirementIds: [],
            interfaceComponentIds: [],
            notes: [],
          },
        ],
      }),
    });
    const coverage = bridge.assessDesignProgramCoverage(grant, {
      designProgramId: 'program-arch',
      projectId: 'project-a',
    });
    expect(coverage.state).toBe('ready_for_operation_planning');
    expect(coverage.coverage[0]?.operationVersions).toEqual(['1.0.0']);
  });

  it('reports blocked_by_state when the project cannot accept the operation', () => {
    const { bridge, grant, operator } = harness();
    bridge.saveDesignProgram(grant, {
      requestId: 'r1',
      designProgram: vehicleProgram({
        designProgramId: 'program-arch',
        designDomain: 'architecture',
        components: [
          {
            id: 'north-wall',
            title: 'North wall',
            role: 'Encloses the plan.',
            requestedCapabilities: ['architecture.wall.create'],
            requirementIds: [],
            interfaceComponentIds: [],
            notes: [],
          },
        ],
      }),
    });
    operator.setAccessState('project-a', 'migration_required');
    const coverage = bridge.assessDesignProgramCoverage(grant, {
      designProgramId: 'program-arch',
      projectId: 'project-a',
    });
    expect(coverage.coverage[0]?.status).toBe('blocked_by_state');
    expect(coverage.coverage[0]?.blockers.join(' ')).toContain('migration required');
  });

  it('reports unknown when no project is named', () => {
    const { bridge, grant } = harness();
    bridge.saveDesignProgram(grant, {
      requestId: 'r1',
      designProgram: vehicleProgram({
        designProgramId: 'program-arch',
        designDomain: 'architecture',
        components: [
          {
            id: 'north-wall',
            title: 'North wall',
            role: 'Encloses the plan.',
            requestedCapabilities: ['architecture.wall.create'],
            requirementIds: [],
            interfaceComponentIds: [],
            notes: [],
          },
        ],
      }),
    });
    const coverage = bridge.assessDesignProgramCoverage(grant, {
      designProgramId: 'program-arch',
    });
    expect(coverage.coverage[0]?.status).toBe('unknown');
  });
});

describe('staging a change set', () => {
  it('validates against the real model and never changes the project', () => {
    const { bridge, grant, host } = harness();
    const proposal = bridge.stageChangeSet(grant, { requestId: 'r1', changeSet: wallChangeSet() });
    expect(proposal.state).toBe('ready_for_review');
    expect(proposal.validation.expectedInvalidations).toContain('plan-render-cache');
    expect(proposal.canonicalMutation.state).toBe('none');
    expect(host.getSummary('project-a')?.revision).toBe('rev-000001');
  });

  it('records a validation failure as a proposal rather than throwing it away', () => {
    const { bridge, grant } = harness();
    const proposal = bridge.stageChangeSet(grant, {
      requestId: 'r1',
      changeSet: wallChangeSet({
        operations: [
          {
            operationId: 'op-1',
            operationType: 'architecture.wall.create',
            operationVersion: '1.0.0',
            arguments: {
              wallId: 'w1',
              levelId: 'level-0',
              wallTypeId: 'type-100',
              from: { xMm: 0, yMm: 0 },
              to: { xMm: 0, yMm: 0 },
            },
            preconditions: [],
          },
        ],
      }),
    });
    expect(proposal.state).toBe('validation_failed');
    expect(proposal.validation.errors.map((issue) => issue.code)).toContain('WALL_TOO_SHORT');
    expect(proposal.validation.errors[0]?.suggestedActions.length).toBeGreaterThan(0);
  });

  it('refuses an operation the catalogue does not register, with the owning profile', () => {
    const { bridge, grant } = harness();
    const refusal = caught(() =>
      bridge.stageChangeSet(grant, {
        requestId: 'r1',
        changeSet: wallChangeSet({
          operations: [
            {
              operationId: 'op-1',
              operationType: 'vehicle.concept.fuselage.create',
              operationVersion: '1.0.0',
              arguments: {},
              preconditions: [],
            },
          ],
        }),
      }),
    );
    expect(refusal.code).toBe('ARQ_CAPABILITY_UNAVAILABLE');
    expect(refusal.nextAction).toContain('Do not substitute');
  });

  it('refuses a registered operation at an unregistered version', () => {
    const { bridge, grant } = harness();
    const refusal = caught(() =>
      bridge.stageChangeSet(grant, {
        requestId: 'r1',
        changeSet: wallChangeSet({
          operations: [
            {
              operationId: 'op-1',
              operationType: 'architecture.wall.create',
              operationVersion: '9.0.0',
              arguments: {},
              preconditions: [],
            },
          ],
        }),
      }),
    );
    expect(refusal.code).toBe('ARQ_CAPABILITY_UNAVAILABLE');
  });

  it('refuses a stale base revision and a project that is not editable', () => {
    const { bridge, grant, operator } = harness();
    expect(
      caught(() =>
        bridge.stageChangeSet(grant, {
          requestId: 'r1',
          changeSet: wallChangeSet({ baseRevision: 'rev-000000' }),
        }),
      ).code,
    ).toBe('ARQ_REVISION_STALE');

    operator.setAccessState('project-a', 'recovery');
    expect(
      caught(() => bridge.stageChangeSet(grant, { requestId: 'r2', changeSet: wallChangeSet() }))
        .code,
    ).toBe('ARQ_PROJECT_NOT_EDITABLE');
  });
});

describe('the proposal lifecycle', () => {
  it('moves to review and can be withdrawn', () => {
    const { bridge, grant } = harness();
    const staged = bridge.stageChangeSet(grant, { requestId: 'r1', changeSet: wallChangeSet() });
    const queued = bridge.requestProposalReview(grant, {
      requestId: 'r2',
      projectId: 'project-a',
      proposalId: staged.proposalId,
    });
    expect(queued.state).toBe('awaiting_user_approval');
    expect(queued.approval.reviewUri).toBe(`arq://review/${staged.proposalId}`);

    const cancelled = bridge.cancelProposal(grant, {
      requestId: 'r3',
      projectId: 'project-a',
      proposalId: staged.proposalId,
    });
    expect(cancelled.state).toBe('cancelled');
    expect(cancelled.canonicalMutation.state).toBe('none');
  });

  it('expires a proposal that sat unreviewed, which 2.0 declared and never produced', () => {
    const { bridge, grant, clock } = harness();
    const staged = bridge.stageChangeSet(grant, { requestId: 'r1', changeSet: wallChangeSet() });
    bridge.requestProposalReview(grant, {
      requestId: 'r2',
      projectId: 'project-a',
      proposalId: staged.proposalId,
    });

    clock.advance(PROPOSAL_LIFETIME_MS);
    const aged = bridge.getProposal(grant, {
      projectId: 'project-a',
      proposalId: staged.proposalId,
    });
    expect(aged.state).toBe('expired');
  });

  it('supersedes a proposal once the project moves past its base revision', () => {
    const { bridge, grant, operator } = harness();
    const staged = bridge.stageChangeSet(grant, { requestId: 'r1', changeSet: wallChangeSet() });
    operator.apply(
      'project-a',
      'rev-000001',
      [
        {
          operationId: 'other',
          operationType: 'architecture.level.create',
          operationVersion: '1.0.0',
          arguments: { levelId: 'level-1', name: 'First', elevationMm: 3000 },
          preconditions: [],
        },
      ],
      'operator',
    );
    const aged = bridge.getProposal(grant, {
      projectId: 'project-a',
      proposalId: staged.proposalId,
    });
    expect(aged.state).toBe('superseded');
    expect(
      caught(() =>
        bridge.requestProposalReview(grant, {
          requestId: 'r9',
          projectId: 'project-a',
          proposalId: staged.proposalId,
        }),
      ).code,
    ).toBe('ARQ_PROPOSAL_NOT_REVIEWABLE');
  });

  it('will not queue a proposal that failed validation', () => {
    const { bridge, grant } = harness();
    const failed = bridge.stageChangeSet(grant, {
      requestId: 'r1',
      changeSet: wallChangeSet({
        operations: [
          {
            operationId: 'op-1',
            operationType: 'architecture.wall.create',
            operationVersion: '1.0.0',
            arguments: {
              wallId: 'w1',
              levelId: 'level-missing',
              wallTypeId: 'type-100',
              from: { xMm: 0, yMm: 0 },
              to: { xMm: 5000, yMm: 0 },
            },
            preconditions: [],
          },
        ],
      }),
    });
    expect(
      caught(() =>
        bridge.requestProposalReview(grant, {
          requestId: 'r2',
          projectId: 'project-a',
          proposalId: failed.proposalId,
        }),
      ).code,
    ).toBe('ARQ_PROPOSAL_NOT_REVIEWABLE');
  });
});

describe('undo and publish are requests, not actions', () => {
  it('describes the group a grouped undo would affect', () => {
    const { bridge, grant, operator } = harness();
    const applied = operator.apply(
      'project-a',
      'rev-000001',
      [
        {
          operationId: 'op-1',
          operationType: 'architecture.wall.create',
          operationVersion: '1.0.0',
          arguments: {
            wallId: 'w1',
            levelId: 'level-0',
            wallTypeId: 'type-100',
            from: { xMm: 0, yMm: 0 },
            to: { xMm: 5000, yMm: 0 },
          },
          preconditions: [],
        },
      ],
      'operator',
    );
    const request = bridge.requestUndo(grant, {
      requestId: 'r1',
      projectId: 'project-a',
      undoGroupId: applied.undoGroupId ?? '',
    });
    expect(request.state).toBe('awaiting_user_approval');
    expect(request.affectedElementIds).toContain('w1');
  });

  it('refuses to queue a publish at a revision that is not current', () => {
    const { bridge, grant } = harness();
    expect(
      caught(() =>
        bridge.requestPublish(grant, {
          requestId: 'r1',
          projectId: 'project-a',
          revision: 'rev-000000',
        }),
      ).code,
    ).toBe('ARQ_REVISION_STALE');

    const queued = bridge.requestPublish(grant, {
      requestId: 'r2',
      projectId: 'project-a',
      revision: 'rev-000001',
    });
    expect(queued.state).toBe('awaiting_user_destination');
  });
});

describe('the bridge has no way to commit', () => {
  it('exposes no method that changes canonical state', () => {
    const { bridge } = harness();
    const surface = bridge as unknown as Record<string, unknown>;
    for (const forbidden of ['apply', 'commit', 'approve', 'undo', 'publish', 'openPath']) {
      expect(typeof surface[forbidden]).not.toBe('function');
    }
  });

  it('reports canonicalMutation none on every proposal it can produce', () => {
    const { bridge, grant } = harness();
    const staged = bridge.stageChangeSet(grant, { requestId: 'r1', changeSet: wallChangeSet() });
    const reviewed = bridge.requestProposalReview(grant, {
      requestId: 'r2',
      projectId: 'project-a',
      proposalId: staged.proposalId,
    });
    for (const proposal of [staged, reviewed]) {
      expect(proposal.canonicalMutation.state).toBe('none');
      expect(proposal.canonicalMutation.revisionAfter).toBeUndefined();
    }
  });
});

describe('plans belong to a person, not to a grant', () => {
  it('keeps a stored plan visible to a renewed grant for the same subject', () => {
    const { bridge, grant } = harness();
    bridge.saveDesignProgram(grant, { requestId: 'r1', designProgram: vehicleProgram() });

    const renewed: GrantContext = createGrant({
      grantId: 'grant-2',
      subjectId: grant.subjectId,
      tenantId: grant.tenantId,
      clientName: 'cursor',
      clientVersion: '1.0.0',
      scopes: GRANT_PRESETS.plan,
      projectIds: ['project-a'],
      issuedAtEpochMs: START,
      lifetimeMs: 60_000,
    });
    expect(bridge.getDesignProgram(renewed, 'program-vtol').designProgram.version).toBe(1);
  });

  it('hides a plan from a different subject in the same tenant', () => {
    const { bridge, grant } = harness();
    bridge.saveDesignProgram(grant, { requestId: 'r1', designProgram: vehicleProgram() });

    const other = createGrant({
      grantId: 'grant-3',
      subjectId: 'subject-2',
      tenantId: grant.tenantId,
      clientName: 'cursor',
      clientVersion: '1.0.0',
      scopes: GRANT_PRESETS.plan,
      projectIds: ['project-a'],
      issuedAtEpochMs: START,
      lifetimeMs: 60_000,
    });
    expect(caught(() => bridge.getDesignProgram(other, 'program-vtol')).code).toBe(
      'ARQ_RECORD_NOT_AVAILABLE',
    );
  });
});

describe('a host that implements only part of the catalogue', () => {
  /**
   * The browser build edits a plan document of walls and has nowhere to put
   * a room. Without the intersection, the catalogue would advertise room
   * creation, an assistant would build a change set around it, and the
   * failure would arrive at staging as "unregistered operation" - which is
   * both late and untrue.
   */
  function narrowHarness() {
    const base = harness();
    const wallsOnly = ['architecture.wall.create', 'architecture.wall.update'];
    const narrowedHost = {
      ...base.host,
      supportedOperationTypes: () => wallsOnly,
      // Method identity matters: spreading an object literal keeps the
      // functions, and every one of them still closes over the same store.
      listProjectIds: () => base.host.listProjectIds(),
      getSummary: (projectId: string) => base.host.getSummary(projectId),
      getSnapshot: (projectId: string) => base.host.getSnapshot(projectId),
      query: (query: Parameters<typeof base.host.query>[0]) => base.host.query(query),
      validate: (
        projectId: string,
        baseRevision: string,
        operations: Parameters<typeof base.host.validate>[2],
      ) => base.host.validate(projectId, baseRevision, operations),
      createDraft: (projectId: string, name: string) => base.host.createDraft(projectId, name),
      requestOpen: (projectId: string) => base.host.requestOpen(projectId),
      getUndoGroup: (projectId: string, undoGroupId: string) =>
        base.host.getUndoGroup(projectId, undoGroupId),
    };

    const bridge = new ArqBridge({
      host: narrowedHost,
      registry: base.registry,
      clock: base.clock.now,
      idSource: createSequentialIdSource('id'),
      audit: base.audit,
      serverMode: 'local_runtime',
    });
    return { ...base, bridge };
  }

  it('advertises only what the project can accept, and says the catalogue is narrowed', () => {
    const { bridge, grant } = narrowHarness();
    const catalog = bridge.getOperationCatalog(grant, 'project-a');
    expect(catalog.operations.map((operation) => operation.operationType).sort()).toEqual([
      'architecture.wall.create',
      'architecture.wall.update',
    ]);
    expect(catalog.hostSubsetsCatalogue).toBe(true);
  });

  it('refuses an operation Arq has but this project cannot take, and says which it is', () => {
    const { bridge, grant } = narrowHarness();
    const refusal = caught(() =>
      bridge.stageChangeSet(grant, {
        requestId: 'r1',
        changeSet: wallChangeSet({
          operations: [
            {
              operationId: 'op-1',
              operationType: 'architecture.room.create',
              operationVersion: '1.0.0',
              arguments: {},
              preconditions: [],
            },
          ],
        }),
      }),
    );
    expect(refusal.code).toBe('ARQ_CAPABILITY_UNAVAILABLE');
    expect(refusal.state).toBe('blocked_by_capability');
  });

  it('still accepts what the project does support', () => {
    const { bridge, grant } = narrowHarness();
    const proposal = bridge.stageChangeSet(grant, { requestId: 'r1', changeSet: wallChangeSet() });
    expect(proposal.state).toBe('ready_for_review');
  });

  it('leaves a host that declares nothing with the whole catalogue', () => {
    const { bridge, grant, registry } = harness();
    const catalog = bridge.getOperationCatalog(grant, 'project-a');
    expect(catalog.operations).toHaveLength(registry.registeredOperations().length);
    expect(catalog.hostSubsetsCatalogue).toBe(false);
  });
});
