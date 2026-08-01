/**
 * The domain profile: the contract that lets "create anything" be a real
 * promise instead of an unbounded one.
 *
 * The reviewed MCP System 2.0 package made domain profiles the centre of
 * its architecture - its creation-system document specifies a ten-row
 * profile contract, its ADR-002 requires one before any new domain, and
 * its coverage tool is meaningless without them - and then shipped no
 * profile type, no registry, no schema and no fixture. The word appeared
 * only in prose. Its operation catalogue was a hand-written array of two
 * fixture records, so a "capability available" answer proved nothing about
 * any real domain, and a "capability unavailable" answer could not say
 * which profile would have owned it.
 *
 * This module is that missing contract as code. A profile declares what
 * its domain means semantically, which typed operations exist, what each
 * one invalidates, which project states accept it, what undoing it does,
 * and - the part that keeps the whole system honest - what evidence backs
 * each claim, in the repository's own evidence vocabulary.
 *
 * The status field is what makes an honest answer possible for a request
 * Arq cannot execute. A profile is either `registered`, meaning the
 * runtime genuinely applies and validates its operations, or
 * `declared_unregistered`, meaning the domain is understood and specified
 * but nothing executes it yet. An unregistered profile still answers
 * usefully: it names the exact operations a request would need and the
 * exact blockers standing in the way, which turns "Arq cannot do that"
 * into a reviewable backlog instead of a dead end.
 */

import type { JsonObject } from '../schema/json-value';
import type { ArqMcpScope } from '../grant/scopes';

/** The project states an operation may be staged against. `editable` is the only one any mutating operation should list. */
export type ProjectAccessState = 'editable' | 'read_only' | 'migration_required' | 'recovery';

export const PROJECT_ACCESS_STATES: readonly ProjectAccessState[] = [
  'editable',
  'read_only',
  'migration_required',
  'recovery',
];

/** How much review Arq requires before an operation of this class may be committed. Never decided by a model. */
export type ApprovalClass = 'none' | 'project_review' | 'destructive_review' | 'migration_review';

/** What undoing this operation means. `not_undoable` is a reason to require a stronger approval class, not a reason to hide the fact. */
export type UndoBehaviour = 'inverse_operation' | 'grouped_only' | 'not_undoable';

/**
 * The evidence vocabulary this repository already uses to grade a claim
 * (see `.zeus/FAST-KERNEL.md`). Carrying it inside the profile means the
 * catalogue a model reads is annotated with how well each entry is
 * actually backed, rather than presenting a specification and an
 * implementation as the same kind of fact.
 */
export type EvidenceState =
  'verified' | 'partially_verified' | 'inferred' | 'assumed' | 'blocked' | 'not_inspected';

export interface EvidenceRecord {
  readonly state: EvidenceState;
  readonly summary: string;
  /** Repository-relative paths a reviewer can open. Never a URL, never a claim without a file behind it. */
  readonly sources: readonly string[];
}

export interface OperationDefinition {
  readonly operationType: string;
  readonly operationVersion: string;
  readonly title: string;
  readonly description: string;
  /**
   * The `@arq/arqscript` command kind this operation is produced from, or
   * `none` for an operation with no ArqScript surface. ADR-0014 decided
   * that AI creates typed operations through ArqScript, so an operation
   * an assistant can propose should normally be reachable from a command.
   */
  readonly arqScriptCommand: string;
  readonly argumentsSchema: JsonObject;
  readonly approvalClass: ApprovalClass;
  readonly consequential: boolean;
  readonly destructive: boolean;
  readonly allowedProjectStates: readonly ProjectAccessState[];
  readonly requiredScopes: readonly ArqMcpScope[];
  /** Derived outputs this operation makes stale. Must be a subset of the owning profile's declared derived outputs. */
  readonly knownInvalidations: readonly string[];
  /** Preview surfaces Arq can render for this operation. Empty means the reviewer sees data, not a picture, and the UI must say so. */
  readonly previewKinds: readonly string[];
  readonly undoBehaviour: UndoBehaviour;
  readonly deprecated: boolean;
  readonly replacement?: string;
  readonly evidence: EvidenceRecord;
}

export type ProfileStatus = 'registered' | 'declared_unregistered' | 'deprecated';

export interface DomainProfileFileImpact {
  readonly nativeSchemaChange: boolean;
  readonly migrationRequired: boolean;
  readonly notes: string;
}

export interface DomainProfile {
  readonly profileId: string;
  readonly profileVersion: string;
  readonly title: string;
  readonly description: string;
  readonly owner: string;
  readonly status: ProfileStatus;
  /** Exactly what stands between this profile and registration. Empty if and only if the profile is registered. */
  readonly registrationBlockers: readonly string[];
  readonly semanticKinds: readonly string[];
  readonly derivedOutputs: readonly string[];
  readonly operations: readonly OperationDefinition[];
  readonly fileImpact: DomainProfileFileImpact;
  readonly evidence: EvidenceRecord;
}

export interface ProfileIssue {
  readonly profileId: string;
  readonly message: string;
}

/**
 * The invariants a profile must satisfy before a registry will accept it.
 *
 * These are checked at construction rather than trusted, because a profile
 * is the thing that decides what an assistant is allowed to propose. A
 * profile that claimed registration while its operations were unbacked, or
 * that invalidated a derived output it never declared, would quietly widen
 * the model's reach.
 */
export function validateDomainProfile(profile: DomainProfile): readonly ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  const report = (message: string): void => {
    issues.push({ profileId: profile.profileId, message });
  };

  if (profile.status === 'registered' && profile.registrationBlockers.length > 0) {
    report('A registered profile must have no registration blockers.');
  }
  if (profile.status !== 'registered' && profile.registrationBlockers.length === 0) {
    report(
      'A profile that is not registered must name at least one blocker, so a request it cannot serve produces a reviewable reason.',
    );
  }

  const declaredOutputs = new Set(profile.derivedOutputs);
  const seen = new Set<string>();

  for (const operation of profile.operations) {
    const key = `${operation.operationType}@${operation.operationVersion}`;
    if (seen.has(key)) {
      report(`Duplicate operation ${key}.`);
    }
    seen.add(key);

    if (!operation.operationType.startsWith(`${profile.profileId}.`)) {
      report(
        `Operation ${operation.operationType} must be namespaced under its profile id "${profile.profileId}".`,
      );
    }
    for (const invalidation of operation.knownInvalidations) {
      if (!declaredOutputs.has(invalidation)) {
        report(
          `Operation ${key} invalidates "${invalidation}", which the profile does not declare as a derived output.`,
        );
      }
    }
    if (operation.allowedProjectStates.length === 0) {
      report(`Operation ${key} must name at least one project state it may be staged against.`);
    }
    if (operation.consequential && operation.approvalClass === 'none') {
      report(`Consequential operation ${key} must require review.`);
    }
    if (operation.destructive && operation.approvalClass !== 'destructive_review') {
      report(`Destructive operation ${key} must use the destructive review class.`);
    }
    if (!operation.requiredScopes.includes('arq.changes.stage')) {
      report(`Operation ${key} must require the arq.changes.stage scope to be proposed at all.`);
    }
    if (operation.deprecated && operation.replacement === undefined) {
      report(`Deprecated operation ${key} must name its replacement or be removed.`);
    }

    if (profile.status === 'registered') {
      if (
        operation.evidence.state !== 'verified' &&
        operation.evidence.state !== 'partially_verified'
      ) {
        report(
          `Operation ${key} is offered by a registered profile but its evidence is "${operation.evidence.state}". A registered catalogue entry must be backed by something a reviewer can open.`,
        );
      }
      if (operation.evidence.sources.length === 0) {
        report(`Operation ${key} claims evidence with no source to inspect.`);
      }
    } else if (operation.evidence.state === 'verified') {
      report(
        `Operation ${key} belongs to an unregistered profile and therefore cannot be verified. Record it as inferred, assumed or blocked.`,
      );
    }
  }

  return issues;
}

/** Only registered profiles contribute operations a change set may name. An unregistered profile's operations are a specification, not a catalogue. */
export function executableOperations(profile: DomainProfile): readonly OperationDefinition[] {
  return profile.status === 'registered' ? profile.operations : [];
}
