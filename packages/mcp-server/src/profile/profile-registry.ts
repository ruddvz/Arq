/**
 * The registry: the only place a capability name becomes an answer.
 *
 * Three things here are direct corrections to the reviewed 2.0 package.
 *
 * The catalogue revision is a content digest of the registered profiles,
 * not the constant `fixture-catalog-1.0.0` that 2.0 returned no matter
 * what the catalogue contained. A proposal records the catalogue revision
 * it was validated against, so a constant makes that record meaningless:
 * the catalogue could change completely and every stale proposal would
 * still appear to match. A digest changes exactly when the catalogue does.
 *
 * Lookup is version-aware. 2.0's coverage compared operation *names* only,
 * so a capability could be reported available while every registered
 * version of it was incompatible with what the caller intended, and a
 * deprecated operation looked identical to a current one.
 *
 * A missing capability produces an explanation rather than a boolean.
 * `explainMissingCapability` finds the profile whose namespace owns the
 * name, and reports its status and blockers. That is what turns "Arq
 * cannot build a Quinjet" into a design program with a named profile, a
 * named operation set and a named backlog.
 */

import type { JsonValue } from '../schema/json-value';
import type { Validator } from '../schema/schema';
import { contentDigest } from '../util/hash';
import { ARCHITECTURE_PROFILE } from './architecture-profile';
import { DECLARED_PROFILES } from './declared-profiles';
import {
  type DomainProfile,
  type OperationDefinition,
  type ProfileIssue,
  executableOperations,
  validateDomainProfile,
} from './domain-profile';

export interface MissingCapabilityExplanation {
  readonly requestedCapability: string;
  /** The profile whose namespace owns the name, when one exists. */
  readonly owningProfileId?: string;
  readonly owningProfileStatus?: DomainProfile['status'];
  readonly reason: string;
  readonly blockers: readonly string[];
  /** Registered operations whose names share the requested prefix, offered as orientation - never as a substitute. */
  readonly relatedRegisteredOperations: readonly string[];
}

export interface DomainProfileRegistry {
  readonly profiles: readonly DomainProfile[];
  /** Changes whenever any registered operation changes. Recorded on every proposal. */
  readonly catalogRevision: string;
  getProfile(profileId: string): DomainProfile | undefined;
  /** Every operation a change set may name. Unregistered profiles contribute nothing. */
  registeredOperations(): readonly OperationDefinition[];
  findOperation(operationType: string, operationVersion?: string): OperationDefinition | undefined;
  /** Every registered version of a name, newest last. Empty when the name is not registered at all. */
  registeredVersions(operationType: string): readonly string[];
  /**
   * The runtime checker for an operation's arguments, so a host validates
   * against the operation's own contract instead of reinterpreting the
   * published JSON Schema. `undefined` when the operation is not registered.
   */
  argumentValidator(operationType: string): Validator<unknown> | undefined;
  explainMissingCapability(requestedCapability: string): MissingCapabilityExplanation;
}

export class DomainProfileConfigurationError extends Error {
  readonly issues: readonly ProfileIssue[];

  constructor(issues: readonly ProfileIssue[]) {
    super(
      `the domain profile registry was given ${issues.length} invalid profile entr${issues.length === 1 ? 'y' : 'ies'}: ${issues
        .map((issue) => `${issue.profileId}: ${issue.message}`)
        .join(' ')}`,
    );
    this.name = 'DomainProfileConfigurationError';
    this.issues = issues;
  }
}

/**
 * Builds a registry, refusing an invalid profile rather than degrading.
 *
 * A profile decides what an assistant may propose, so accepting a broken
 * one and hoping the rest of the system catches the consequences is the
 * wrong failure mode: it converts a configuration mistake into a
 * permissions mistake.
 */
export function createDomainProfileRegistry(
  profiles: readonly DomainProfile[],
): DomainProfileRegistry {
  const issues = profiles.flatMap(validateDomainProfile);
  const duplicateIds = profiles
    .map((profile) => profile.profileId)
    .filter((id, index, all) => all.indexOf(id) !== index);
  for (const id of new Set(duplicateIds)) {
    issues.push({ profileId: id, message: 'A profile id may only be registered once.' });
  }
  if (issues.length > 0) {
    throw new DomainProfileConfigurationError(issues);
  }

  const byId = new Map(profiles.map((profile) => [profile.profileId, profile]));
  const registered = profiles.flatMap(executableOperations);

  const duplicateOperations = registered
    .map((operation) => `${operation.operationType}@${operation.operationVersion}`)
    .filter((key, index, all) => all.indexOf(key) !== index);
  if (duplicateOperations.length > 0) {
    throw new DomainProfileConfigurationError(
      [...new Set(duplicateOperations)].map((key) => ({
        profileId: key.split('.')[0] ?? key,
        message: `Operation ${key} is registered by more than one profile.`,
      })),
    );
  }

  const validators = new Map<string, Validator<unknown>>();
  for (const profile of profiles) {
    if (profile.status !== 'registered') {
      continue;
    }
    for (const [operationType, validator] of Object.entries(profile.argumentValidators)) {
      validators.set(operationType, validator);
    }
  }

  const catalogRevision = computeCatalogRevision(registered);

  return {
    profiles,
    catalogRevision,
    getProfile(profileId) {
      return byId.get(profileId);
    },
    registeredOperations() {
      return registered;
    },
    findOperation(operationType, operationVersion) {
      return registered.find(
        (operation) =>
          operation.operationType === operationType &&
          (operationVersion === undefined || operation.operationVersion === operationVersion),
      );
    },
    argumentValidator(operationType) {
      return validators.get(operationType);
    },
    registeredVersions(operationType) {
      return registered
        .filter((operation) => operation.operationType === operationType)
        .map((operation) => operation.operationVersion)
        .sort(compareSemanticVersions);
    },
    explainMissingCapability(requestedCapability) {
      return explain(profiles, registered, requestedCapability);
    },
  };
}

/** The registry this server runs with: architecture registered, everything else specified. */
export function createDefaultDomainProfileRegistry(): DomainProfileRegistry {
  return createDomainProfileRegistry([ARCHITECTURE_PROFILE, ...DECLARED_PROFILES]);
}

/**
 * The digest covers exactly the fields a proposal's validity depends on.
 *
 * Titles and descriptions are excluded deliberately: rewording an
 * operation's help text must not invalidate every staged proposal in the
 * system, whereas changing its argument schema, approval class, allowed
 * states or invalidations must.
 */
function computeCatalogRevision(operations: readonly OperationDefinition[]): string {
  const material: JsonValue = operations
    .map((operation) => ({
      operationType: operation.operationType,
      operationVersion: operation.operationVersion,
      argumentsSchema: operation.argumentsSchema,
      approvalClass: operation.approvalClass,
      consequential: operation.consequential,
      destructive: operation.destructive,
      allowedProjectStates: [...operation.allowedProjectStates],
      requiredScopes: [...operation.requiredScopes],
      knownInvalidations: [...operation.knownInvalidations],
      undoBehaviour: operation.undoBehaviour,
      deprecated: operation.deprecated,
    }))
    .sort((left, right) =>
      `${left.operationType}@${left.operationVersion}`.localeCompare(
        `${right.operationType}@${right.operationVersion}`,
      ),
    );
  return `catalog:${contentDigest(material).slice('sha256:'.length, 'sha256:'.length + 16)}`;
}

function explain(
  profiles: readonly DomainProfile[],
  registered: readonly OperationDefinition[],
  requestedCapability: string,
): MissingCapabilityExplanation {
  // The owning profile is the one with the longest matching namespace, so
  // `vehicle.concept.fuselage.create` resolves to `vehicle.concept` and not
  // to a hypothetical `vehicle`.
  const owner = profiles
    .filter((profile) => requestedCapability.startsWith(`${profile.profileId}.`))
    .sort((left, right) => right.profileId.length - left.profileId.length)[0];

  const related = registered
    .filter((operation) => sharesFirstSegment(operation.operationType, requestedCapability))
    .map((operation) => `${operation.operationType}@${operation.operationVersion}`)
    .sort();

  if (owner === undefined) {
    return {
      requestedCapability,
      reason:
        'No domain profile claims this capability name. Arq has neither an implementation nor a specification for it, so the work stays at design-program level until a profile is proposed.',
      blockers: [
        'No domain profile owns this namespace. Proposing one is an architecture decision that needs an ADR, an owner and an evidence plan.',
      ],
      relatedRegisteredOperations: related,
    };
  }

  if (owner.status === 'registered') {
    const versions = registered
      .filter((operation) => operation.operationType === requestedCapability)
      .map((operation) => operation.operationVersion);
    return {
      requestedCapability,
      owningProfileId: owner.profileId,
      owningProfileStatus: owner.status,
      reason:
        versions.length === 0
          ? `The ${owner.profileId} profile is registered but has no operation called ${requestedCapability}. Use one of its registered operations or keep this component at concept level.`
          : `The ${owner.profileId} profile registers ${requestedCapability} at ${versions.join(', ')}. If a request still failed, the mismatch is the version or the project state, not the capability.`,
      blockers: [],
      relatedRegisteredOperations: related,
    };
  }

  return {
    requestedCapability,
    owningProfileId: owner.profileId,
    owningProfileStatus: owner.status,
    reason: `The ${owner.profileId} profile specifies ${requestedCapability} but is not registered, so Arq cannot execute it. The design program remains valid as a concept plan and this is the exact work that would make it executable. Do not substitute an operation from another profile.`,
    blockers: owner.registrationBlockers,
    relatedRegisteredOperations: related,
  };
}

function sharesFirstSegment(left: string, right: string): boolean {
  const leftSegment = left.split('.')[0];
  return leftSegment !== undefined && leftSegment === right.split('.')[0];
}

/** Orders `1.10.0` after `1.9.0`, which a string sort does not. */
export function compareSemanticVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}
