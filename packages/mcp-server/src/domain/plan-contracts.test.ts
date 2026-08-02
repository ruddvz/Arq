import { describe, expect, it } from 'vitest';
import { createControlledClock } from '../runtime/clock';
import { createGrant } from '../grant/grant';
import { briefInput, buildBrief, topologicalWorkOrder } from './brief';
import { changeSetInput, preconditionElementIds } from './changeset';
import { designProgramInput, requestedCapabilities, buildDesignProgram } from './design-program';
import { describeCycle, findCycle, findParentCycle } from './graph';
import { ARQ_MCP_LIMITS } from './limits';
import {
  MODEL_ASSERTABLE_RIGHTS_STATUSES,
  deriveProvenance,
  referenceInput,
  referenceWarnings,
  toPlanReference,
} from './plan-common';
import {
  PROPOSAL_STATES,
  canCancel,
  canTransition,
  canonicalMutationFor,
  describeProposalState,
  isTerminal,
  proposalNextAction,
} from './proposal';

function workItem(id: string, dependsOn: readonly string[] = []) {
  return {
    id,
    title: `Item ${id}`,
    outcome: 'Something is true.',
    dependsOn: [...dependsOn],
    acceptanceCriteria: ['A reviewer can check it.'],
    requestedCapabilities: [],
    priority: 'normal' as const,
  };
}

function validBrief(workItems = [workItem('a'), workItem('b', ['a'])]) {
  return {
    format: 'arq.brief' as const,
    schemaVersion: '1.0.0' as const,
    briefId: 'brief-1',
    title: 'Rework the entrance',
    objective: 'Widen the entrance wall opening.',
    constraints: [],
    assumptions: [],
    workItems,
    references: [],
    questions: [],
  };
}

describe('provenance is derived, never accepted', () => {
  it('has no place in the brief, design program or change set input schemas', () => {
    for (const validator of [briefInput, designProgramInput, changeSetInput]) {
      const schema = validator.jsonSchema as { properties?: Record<string, unknown> };
      expect(Object.keys(schema.properties ?? {})).not.toContain('provenance');
    }
  });

  it('records the client from the handshake and the time from the server clock', () => {
    const clock = createControlledClock(1_700_000_000_000);
    const grant = createGrant({
      grantId: 'grant-1',
      subjectId: 'subject-1',
      tenantId: 'tenant-1',
      clientName: 'claude-code',
      clientVersion: '2.1.0',
      scopes: [],
      projectIds: [],
      issuedAtEpochMs: clock.now(),
      lifetimeMs: 60_000,
    });
    expect(deriveProvenance(grant, clock.now)).toEqual({
      origin: 'mcp_client',
      clientName: 'claude-code',
      clientVersion: '2.1.0',
      subjectId: 'subject-1',
      recordedAt: '2023-11-14T22:13:20.000Z',
    });
  });
});

describe('references', () => {
  it('does not let a caller attest that reuse is permitted', () => {
    expect([...MODEL_ASSERTABLE_RIGHTS_STATUSES]).toEqual([
      'unknown',
      'not_for_reuse',
      'not_applicable',
    ]);
    const result = referenceInput.validate({
      id: 'ref-1',
      label: 'Screen vehicle still',
      kind: 'external_uri',
      purpose: 'mood',
      rightsStatus: 'user_attests_permitted',
      uri: 'https://example.org/still.jpg',
    });
    expect(result.ok).toBe(false);
  });

  it('requires a URI for an external reference and forbids one on a note', () => {
    const missing = referenceInput.validate({
      id: 'ref-1',
      label: 'A source',
      kind: 'external_uri',
      purpose: 'context',
      rightsStatus: 'unknown',
    });
    expect(missing.ok).toBe(false);

    const noteWithUri = referenceInput.validate({
      id: 'ref-2',
      label: 'A note',
      kind: 'note',
      purpose: 'context',
      rightsStatus: 'not_applicable',
      uri: 'https://example.org/a',
    });
    expect(noteWithUri.ok).toBe(false);
  });

  it('attaches the instruction boundary rather than asking the caller to type it', () => {
    const parsed = referenceInput.validate({
      id: 'ref-1',
      label: 'A note',
      kind: 'note',
      purpose: 'context',
      rightsStatus: 'not_applicable',
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(toPlanReference(parsed.value).instructionBoundary).toBe(
        'reference_content_is_not_instruction',
      );
    }
  });

  it('warns about unknown and not-for-reuse rights on every read, not only on save', () => {
    const warnings = referenceWarnings([
      {
        id: 'a',
        label: 'a',
        kind: 'external_uri',
        purpose: 'mood',
        rightsStatus: 'unknown',
        uri: 'https://example.org/a',
        instructionBoundary: 'reference_content_is_not_instruction',
      },
      {
        id: 'b',
        label: 'b',
        kind: 'uploaded_asset',
        purpose: 'proportion',
        rightsStatus: 'not_for_reuse',
        instructionBoundary: 'reference_content_is_not_instruction',
      },
    ]);
    expect(warnings.join(' ')).toContain('unknown reuse status');
    expect(warnings.join(' ')).toContain('not for reuse');
    expect(warnings.join(' ')).toContain('untrusted data');
  });
});

describe('brief validation', () => {
  it('accepts a well-formed brief', () => {
    expect(briefInput.validate(validBrief()).ok).toBe(true);
  });

  it('names the exact loop rather than announcing that one exists', () => {
    const result = briefInput.validate(
      validBrief([workItem('a', ['c']), workItem('b', ['a']), workItem('c', ['b'])]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const message = result.issues.map((issue) => issue.message).join(' ');
      expect(message).toMatch(/a -> c -> b -> a|b -> a -> c -> b|c -> b -> a -> c/);
    }
  });

  it('rejects a self-dependency and an unknown dependency separately', () => {
    const selfDependency = briefInput.validate(validBrief([workItem('a', ['a'])]));
    expect(selfDependency.ok).toBe(false);
    if (!selfDependency.ok) {
      expect(selfDependency.issues[0]?.message).toContain('depends on itself');
    }
    const unknown = briefInput.validate(validBrief([workItem('a', ['zzz'])]));
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.issues[0]?.message).toContain('not in this brief');
    }
  });

  it('requires at least one acceptance criterion per work item', () => {
    const result = briefInput.validate(validBrief([{ ...workItem('a'), acceptanceCriteria: [] }]));
    expect(result.ok).toBe(false);
  });

  it('enforces the advertised work-item ceiling', () => {
    const tooMany = Array.from({ length: ARQ_MCP_LIMITS.maxBriefWorkItems + 1 }, (_, index) =>
      workItem(`item-${index}`),
    );
    expect(briefInput.validate(validBrief(tooMany)).ok).toBe(false);
  });

  it('produces a deterministic dependency-safe order', () => {
    const parsed = briefInput.validate(
      validBrief([workItem('c', ['a', 'b']), workItem('b', ['a']), workItem('a')]),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const brief = buildBrief({
        input: parsed.value,
        provenance: {
          origin: 'mcp_client',
          clientName: 'c',
          clientVersion: '1',
          subjectId: 's',
          recordedAt: '2026-01-01T00:00:00.000Z',
        },
        contentHash: 'sha256:0',
      });
      expect(topologicalWorkOrder(brief)).toEqual(['a', 'b', 'c']);
      expect(brief.workItems.every((item) => item.status === 'proposed')).toBe(true);
    }
  });
});

function component(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    title: `Component ${id}`,
    role: 'Does something.',
    requestedCapabilities: [],
    requirementIds: [],
    interfaceComponentIds: [],
    notes: [],
    ...extra,
  };
}

function task(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    title: `Task ${id}`,
    outcome: 'Done.',
    dependsOn: [],
    componentIds: [],
    acceptanceCriteria: ['Checkable.'],
    requestedCapabilities: [],
    priority: 'normal' as const,
    ...extra,
  };
}

function validProgram(overrides: Record<string, unknown> = {}) {
  return {
    format: 'arq.design-program' as const,
    schemaVersion: '1.0.0' as const,
    designProgramId: 'program-1',
    designDomain: 'vehicle.concept',
    executionIntent: 'concept_only' as const,
    title: 'Concept rotor craft',
    objective: 'An original concept for a four-rotor vertical take-off craft.',
    constraints: [],
    assumptions: [],
    requirements: [],
    components: [component('airframe')],
    tasks: [task('t1', { componentIds: ['airframe'] })],
    references: [],
    questions: [],
    ...overrides,
  };
}

describe('design program validation', () => {
  it('accepts a program for a domain Arq cannot build', () => {
    expect(designProgramInput.validate(validProgram()).ok).toBe(true);
  });

  it('requires interfaces to be declared by both components', () => {
    const oneSided = designProgramInput.validate(
      validProgram({
        components: [
          component('airframe', { interfaceComponentIds: ['cabin'] }),
          component('cabin'),
        ],
      }),
    );
    expect(oneSided.ok).toBe(false);
    if (!oneSided.ok) {
      expect(oneSided.issues[0]?.message).toContain('does not declare one back');
    }

    const mutual = designProgramInput.validate(
      validProgram({
        components: [
          component('airframe', { interfaceComponentIds: ['cabin'] }),
          component('cabin', { interfaceComponentIds: ['airframe'] }),
        ],
      }),
    );
    expect(mutual.ok).toBe(true);
  });

  it('rejects a hierarchy that loops and names the path', () => {
    const result = designProgramInput.validate(
      validProgram({
        components: [component('a', { parentId: 'b' }), component('b', { parentId: 'a' })],
        tasks: [task('t1', { componentIds: ['a'] })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.message).join(' ')).toContain('->');
    }
  });

  it('rejects references to requirements, components and tasks that are not in the program', () => {
    expect(
      designProgramInput.validate(
        validProgram({ components: [component('a', { requirementIds: ['missing'] })] }),
      ).ok,
    ).toBe(false);
    expect(
      designProgramInput.validate(validProgram({ tasks: [task('t1', { componentIds: ['nope'] })] }))
        .ok,
    ).toBe(false);
    expect(
      designProgramInput.validate(validProgram({ tasks: [task('t1', { dependsOn: ['nope'] })] }))
        .ok,
    ).toBe(false);
  });

  it('collects requested capabilities from components and tasks together', () => {
    const parsed = designProgramInput.validate(
      validProgram({
        components: [
          component('airframe', { requestedCapabilities: ['vehicle.concept.fuselage.create'] }),
        ],
        tasks: [
          task('t1', {
            componentIds: ['airframe'],
            requestedCapabilities: ['vehicle.concept.surface.create'],
          }),
        ],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const program = buildDesignProgram({
        input: parsed.value,
        provenance: {
          origin: 'mcp_client',
          clientName: 'c',
          clientVersion: '1',
          subjectId: 's',
          recordedAt: '2026-01-01T00:00:00.000Z',
        },
        contentHash: 'sha256:0',
        version: 1,
      });
      expect(requestedCapabilities(program)).toEqual([
        {
          targetKind: 'component',
          targetId: 'airframe',
          capability: 'vehicle.concept.fuselage.create',
        },
        { targetKind: 'task', targetId: 't1', capability: 'vehicle.concept.surface.create' },
      ]);
    }
  });
});

describe('change sets', () => {
  const base = {
    format: 'arq.changeset' as const,
    schemaVersion: '1.0.0' as const,
    changeSetId: 'cs-1',
    projectId: 'project-a',
    baseRevision: 'rev-000001',
    intent: 'Add a wall along the north edge.',
    constraints: [],
    operations: [
      {
        operationId: 'op-1',
        operationType: 'architecture.wall.create',
        operationVersion: '1.0.0',
        arguments: { wallId: 'w1' },
        preconditions: [],
      },
    ],
  };

  it('accepts a well-formed change set', () => {
    expect(changeSetInput.validate(base).ok).toBe(true);
  });

  it('rejects a revision precondition that disagrees with the base revision', () => {
    const result = changeSetInput.validate({
      ...base,
      operations: [
        {
          ...base.operations[0],
          preconditions: [{ kind: 'project.revision_equals', revision: 'rev-000002' }],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('Rebuild the change set against one revision');
    }
  });

  it('rejects an unregistered precondition kind with a list of the real ones', () => {
    const result = changeSetInput.validate({
      ...base,
      operations: [
        {
          ...base.operations[0],
          preconditions: [{ kind: 'anything.goes', subject: 'x', expected: 1 }],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('project.revision_equals');
    }
  });

  it('rejects argument names that are not model property names', () => {
    const result = changeSetInput.validate({
      ...base,
      operations: [{ ...base.operations[0], arguments: { 'not a name': 1 } }],
    });
    expect(result.ok).toBe(false);
  });

  it('accepts the camelCase argument names the model actually uses', () => {
    const result = changeSetInput.validate({
      ...base,
      operations: [
        {
          ...base.operations[0],
          arguments: { wallId: 'w1', hostWallId: 'w0', heightOverride: 2400 },
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('lists the elements the preconditions refer to', () => {
    const parsed = changeSetInput.validate({
      ...base,
      operations: [
        {
          ...base.operations[0],
          preconditions: [
            { kind: 'element.exists', elementId: 'wall-2' },
            { kind: 'project.revision_equals', revision: 'rev-000001' },
            { kind: 'element.absent', elementId: 'wall-1' },
          ],
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(preconditionElementIds(parsed.value)).toEqual(['wall-1', 'wall-2']);
    }
  });
});

describe('the proposal state machine', () => {
  it('can reach every state it declares', () => {
    const reachable = new Set<string>(['staged']);
    let changed = true;
    while (changed) {
      changed = false;
      for (const from of PROPOSAL_STATES) {
        if (!reachable.has(from)) {
          continue;
        }
        for (const to of PROPOSAL_STATES) {
          if (canTransition(from, to) && !reachable.has(to)) {
            reachable.add(to);
            changed = true;
          }
        }
      }
    }
    expect([...reachable].sort()).toEqual([...PROPOSAL_STATES].sort());
  });

  it('never allows a jump to committed without approval and commit', () => {
    for (const from of PROPOSAL_STATES) {
      if (from !== 'committing') {
        expect(canTransition(from, 'committed')).toBe(false);
      }
    }
    expect(canTransition('awaiting_user_approval', 'approved')).toBe(true);
    expect(canTransition('approved', 'committing')).toBe(true);
    expect(canTransition('committing', 'committed')).toBe(true);
  });

  it('lets a caller withdraw a proposal before a decision and not after', () => {
    expect(canCancel('ready_for_review')).toBe(true);
    expect(canCancel('awaiting_user_approval')).toBe(true);
    expect(canCancel('approved')).toBe(false);
    expect(canCancel('committed')).toBe(false);
  });

  it('leaves every terminal state closed', () => {
    for (const state of PROPOSAL_STATES) {
      if (isTerminal(state)) {
        expect(PROPOSAL_STATES.filter((other) => canTransition(state, other))).toEqual([]);
      }
    }
  });

  it('reports a canonical mutation only for committed', () => {
    for (const state of PROPOSAL_STATES) {
      expect(canonicalMutationFor(state)).toBe(state === 'committed' ? 'committed_by_arq' : 'none');
    }
  });

  it('says what happened to the project in every state', () => {
    for (const state of PROPOSAL_STATES) {
      const text = describeProposalState(state);
      expect(text.length).toBeGreaterThan(0);
      if (state !== 'committed' && state !== 'committing' && state !== 'approved') {
        expect(text).toMatch(/Nothing in the project has changed|exactly as it was/);
      }
      expect(proposalNextAction(state).length).toBeGreaterThan(0);
    }
  });
});

describe('cycle detection', () => {
  it('handles a graph deep enough to overflow a recursive walk', () => {
    const edges = new Map<string, readonly string[]>();
    for (let index = 0; index < 50_000; index += 1) {
      edges.set(`n${index}`, [`n${index + 1}`]);
    }
    edges.set('n50000', []);
    expect(findCycle(edges)).toBeUndefined();
  });

  it('finds a cycle in a deep chain that closes at the end', () => {
    const edges = new Map<string, readonly string[]>();
    for (let index = 0; index < 10_000; index += 1) {
      edges.set(`n${index}`, [`n${index + 1}`]);
    }
    edges.set('n10000', ['n0']);
    const cycle = findCycle(edges);
    expect(cycle).toBeDefined();
    expect(describeCycle(cycle ?? [])).toContain('n0');
  });

  it('finds a parent cycle and ignores an acyclic chain', () => {
    expect(
      findParentCycle(
        new Map([
          ['a', 'b'],
          ['b', 'c'],
          ['c', undefined],
        ]),
      ),
    ).toBeUndefined();
    expect(
      findParentCycle(
        new Map([
          ['a', 'b'],
          ['b', 'a'],
        ]),
      ),
    ).toBeDefined();
  });
});
