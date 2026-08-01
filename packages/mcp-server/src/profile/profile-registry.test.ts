import { describe, expect, it } from 'vitest';
import {
  OPENING_DERIVED_INVALIDATIONS,
  ROOM_DERIVED_INVALIDATIONS,
  WALL_TYPE_DERIVED_INVALIDATIONS,
} from '@arq/bim-core';
import { createWallCommand, createRoomCommand } from '@arq/arqscript';
import { ARCHITECTURE_PROFILE } from './architecture-profile';
import { ARQSCRIPT_OPERATION_TYPES } from './architecture-operations';
import { VEHICLE_CONCEPT_PROFILE } from './declared-profiles';
import { executableOperations, validateDomainProfile, type DomainProfile } from './domain-profile';
import {
  DomainProfileConfigurationError,
  compareSemanticVersions,
  createDefaultDomainProfileRegistry,
  createDomainProfileRegistry,
} from './profile-registry';

describe('the architecture profile is derived from the real packages', () => {
  it('takes its operation types from @arq/arqscript rather than restating them', () => {
    // If the grammar renames a command, this test fails here rather than
    // leaving the catalogue advertising an operation that no longer exists.
    expect(ARQSCRIPT_OPERATION_TYPES.wall).toBe(
      createWallCommand({ id: 'w', from: { xMm: 0, yMm: 0 }, to: { xMm: 1, yMm: 0 } })
        .operationType,
    );
    expect(ARQSCRIPT_OPERATION_TYPES.room).toBe(
      createRoomCommand({
        id: 'r',
        name: 'R',
        boundary: [
          { xMm: 0, yMm: 0 },
          { xMm: 1, yMm: 0 },
          { xMm: 1, yMm: 1 },
        ],
      }).operationType,
    );
    const wall = ARCHITECTURE_PROFILE.operations.find(
      (operation) => operation.operationType === 'architecture.wall.create',
    );
    expect(wall?.arqScriptCommand).toBe(ARQSCRIPT_OPERATION_TYPES.wall);
  });

  it('takes its derived outputs from @arq/bim-core rather than re-spelling them', () => {
    for (const invalidation of [
      ...WALL_TYPE_DERIVED_INVALIDATIONS,
      ...OPENING_DERIVED_INVALIDATIONS,
      ...ROOM_DERIVED_INVALIDATIONS,
    ]) {
      expect(ARCHITECTURE_PROFILE.derivedOutputs).toContain(invalidation);
    }
  });

  it('records the ArqScript gaps found by wiring the two together', () => {
    const wallType = ARCHITECTURE_PROFILE.operations.find(
      (operation) => operation.operationType === 'architecture.wall_type.create',
    );
    expect(wallType?.arqScriptCommand).toBe('none');
    expect(wallType?.description).toContain('ArqScript v0 has no command for this');

    const wall = ARCHITECTURE_PROFILE.operations.find(
      (operation) => operation.operationType === 'architecture.wall.create',
    );
    const schema = wall?.argumentsSchema as { required?: readonly string[] } | undefined;
    expect(schema?.required).toContain('levelId');
  });

  it('satisfies its own invariants', () => {
    expect(validateDomainProfile(ARCHITECTURE_PROFILE)).toEqual([]);
  });

  it('does not claim a native file change it does not make', () => {
    expect(ARCHITECTURE_PROFILE.fileImpact.nativeSchemaChange).toBe(false);
    expect(ARCHITECTURE_PROFILE.evidence.state).toBe('partially_verified');
  });
});

describe('profile invariants', () => {
  const valid = ARCHITECTURE_PROFILE;

  function mutate(changes: Partial<DomainProfile>): DomainProfile {
    return { ...valid, ...changes };
  }

  it('rejects a registered profile that still has blockers', () => {
    const issues = validateDomainProfile(mutate({ registrationBlockers: ['something'] }));
    expect(issues.some((issue) => issue.message.includes('no registration blockers'))).toBe(true);
  });

  it('rejects an unregistered profile with no blocker to report', () => {
    const issues = validateDomainProfile(
      mutate({ status: 'declared_unregistered', registrationBlockers: [] }),
    );
    expect(issues.some((issue) => issue.message.includes('at least one blocker'))).toBe(true);
  });

  it('rejects an operation that invalidates an undeclared derived output', () => {
    const issues = validateDomainProfile(
      mutate({
        operations: valid.operations.map((operation, index) =>
          index === 0 ? { ...operation, knownInvalidations: ['undeclared-cache'] } : operation,
        ),
      }),
    );
    expect(issues.some((issue) => issue.message.includes('undeclared-cache'))).toBe(true);
  });

  it('rejects an operation outside its profile namespace', () => {
    const issues = validateDomainProfile(
      mutate({
        operations: valid.operations.map((operation, index) =>
          index === 0 ? { ...operation, operationType: 'vehicle.fuselage.create' } : operation,
        ),
      }),
    );
    expect(issues.some((issue) => issue.message.includes('namespaced'))).toBe(true);
  });

  it('rejects a consequential operation that requires no review', () => {
    const issues = validateDomainProfile(
      mutate({
        operations: valid.operations.map((operation, index) =>
          index === 0 ? { ...operation, approvalClass: 'none' as const } : operation,
        ),
      }),
    );
    expect(issues.some((issue) => issue.message.includes('must require review'))).toBe(true);
  });

  it('rejects a registered operation that publishes a schema with no validator behind it', () => {
    const issues = validateDomainProfile(
      mutate({
        argumentValidators: Object.fromEntries(
          Object.entries(valid.argumentValidators).filter(
            ([operationType]) => operationType !== 'architecture.wall.create',
          ),
        ),
      }),
    );
    expect(issues.some((issue) => issue.message.includes('no validator behind it'))).toBe(true);
  });

  it('rejects a registered operation whose evidence is not something a reviewer can open', () => {
    const issues = validateDomainProfile(
      mutate({
        operations: valid.operations.map((operation, index) =>
          index === 0
            ? { ...operation, evidence: { state: 'assumed' as const, summary: 'x', sources: [] } }
            : operation,
        ),
      }),
    );
    expect(issues.some((issue) => issue.message.includes('evidence is "assumed"'))).toBe(true);
  });

  it('rejects an unregistered operation claiming to be verified', () => {
    const issues = validateDomainProfile({
      ...VEHICLE_CONCEPT_PROFILE,
      operations: VEHICLE_CONCEPT_PROFILE.operations.map((operation, index) =>
        index === 0
          ? { ...operation, evidence: { state: 'verified' as const, summary: 'x', sources: ['a'] } }
          : operation,
      ),
    });
    expect(issues.some((issue) => issue.message.includes('cannot be verified'))).toBe(true);
  });
});

describe('the declared vehicle profile', () => {
  it('is valid, specified and contributes nothing executable', () => {
    expect(validateDomainProfile(VEHICLE_CONCEPT_PROFILE)).toEqual([]);
    expect(VEHICLE_CONCEPT_PROFILE.status).toBe('declared_unregistered');
    expect(executableOperations(VEHICLE_CONCEPT_PROFILE)).toEqual([]);
    expect(VEHICLE_CONCEPT_PROFILE.registrationBlockers.length).toBeGreaterThan(3);
  });

  it('publishes no argument contract for an operation nothing can stage', () => {
    for (const operation of VEHICLE_CONCEPT_PROFILE.operations) {
      expect((operation.argumentsSchema as { type?: string }).type).toBe('null');
      expect(operation.evidence.state).toBe('blocked');
    }
  });
});

describe('the registry', () => {
  const registry = createDefaultDomainProfileRegistry();

  it('offers only registered operations to a change set', () => {
    const types = registry.registeredOperations().map((operation) => operation.operationType);
    expect(types).toContain('architecture.wall.create');
    expect(types.some((type) => type.startsWith('vehicle.'))).toBe(false);
  });

  it('derives the catalogue revision from the catalogue', () => {
    expect(registry.catalogRevision).toMatch(/^catalog:[0-9a-f]{16}$/);

    const narrowed = createDomainProfileRegistry([
      {
        ...ARCHITECTURE_PROFILE,
        operations: ARCHITECTURE_PROFILE.operations.slice(0, 3),
      },
    ]);
    expect(narrowed.catalogRevision).not.toBe(registry.catalogRevision);
  });

  it('keeps the revision stable when only help text changes', () => {
    const reworded = createDomainProfileRegistry([
      {
        ...ARCHITECTURE_PROFILE,
        operations: ARCHITECTURE_PROFILE.operations.map((operation) => ({
          ...operation,
          title: `${operation.title} (reworded)`,
          description: 'Different words, same contract.',
        })),
      },
      ...[],
    ]);
    const original = createDomainProfileRegistry([ARCHITECTURE_PROFILE]);
    expect(reworded.catalogRevision).toBe(original.catalogRevision);
  });

  it('hands a host the operation’s own argument checker rather than its published schema', () => {
    const validator = registry.argumentValidator('architecture.wall.create');
    expect(validator).toBeDefined();
    // The same contract the catalogue advertises, as something that can
    // actually run - so a host never has to reinterpret the JSON Schema.
    expect(validator?.jsonSchema).toEqual(
      registry.findOperation('architecture.wall.create')?.argumentsSchema,
    );
    expect(validator?.validate({}).ok).toBe(false);
    expect(registry.argumentValidator('vehicle.concept.fuselage.create')).toBeUndefined();
  });

  it('looks operations up by version, not only by name', () => {
    expect(registry.findOperation('architecture.wall.create', '1.0.0')).toBeDefined();
    expect(registry.findOperation('architecture.wall.create', '2.0.0')).toBeUndefined();
    expect(registry.registeredVersions('architecture.wall.create')).toEqual(['1.0.0']);
    expect(registry.registeredVersions('vehicle.concept.fuselage.create')).toEqual([]);
  });

  it('refuses a configuration where two profiles register the same operation', () => {
    expect(() =>
      createDomainProfileRegistry([
        ARCHITECTURE_PROFILE,
        { ...ARCHITECTURE_PROFILE, profileId: 'architecture' },
      ]),
    ).toThrow(DomainProfileConfigurationError);
  });
});

describe('explaining a capability Arq cannot serve', () => {
  const registry = createDefaultDomainProfileRegistry();

  it('names the owning profile, its status and its blockers', () => {
    const explanation = registry.explainMissingCapability('vehicle.concept.fuselage.create');
    expect(explanation.owningProfileId).toBe('vehicle.concept');
    expect(explanation.owningProfileStatus).toBe('declared_unregistered');
    expect(explanation.blockers.length).toBeGreaterThan(0);
    expect(explanation.reason).toContain('Do not substitute an operation from another profile');
  });

  it('says plainly when no profile claims the name at all', () => {
    const explanation = registry.explainMissingCapability('starship.warp_core.create');
    expect(explanation.owningProfileId).toBeUndefined();
    expect(explanation.blockers).toHaveLength(1);
    expect(explanation.reason).toContain('design-program level');
  });

  it('distinguishes a registered profile that lacks the specific operation', () => {
    const explanation = registry.explainMissingCapability('architecture.stair.create');
    expect(explanation.owningProfileStatus).toBe('registered');
    expect(explanation.blockers).toEqual([]);
    expect(explanation.relatedRegisteredOperations).toContain('architecture.wall.create@1.0.0');
  });
});

describe('semantic version ordering', () => {
  it('orders 1.10.0 after 1.9.0, which a string sort does not', () => {
    expect(compareSemanticVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(['1.10.0', '1.9.0'].sort(compareSemanticVersions)).toEqual(['1.9.0', '1.10.0']);
  });
});
