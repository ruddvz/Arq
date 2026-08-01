/**
 * Capability coverage: what a design program asks for, against what Arq can
 * actually run, right now, for this project and this grant.
 *
 * The reviewed 2.0 package compared capability names to a two-entry fixture
 * catalogue and derived its verdict from the caller's stated intent. Four
 * things went wrong there, and all four are corrected here.
 *
 *   Version was ignored. A name match reported `available` even if every
 *   registered version was different from the one a caller would use.
 *
 *   Project state was ignored. A project in migration or recovery reported
 *   its capabilities as available, so an assistant could build a whole
 *   proposal that the runtime would refuse at the first step.
 *
 *   Scope was ignored. A read-only grant reported staging capabilities as
 *   available, which is the same misdirection one layer up.
 *
 *   The verdict came from `executionIntent`. A program that declared
 *   `requires_registered_operations` and requested no capabilities at all
 *   reported `ready_for_operation_planning` - readiness concluded from an
 *   empty check. A program marked `concept_only` reported
 *   `concept_plan_only` even when every capability it asked for was
 *   missing, hiding the gap rather than recording it.
 *
 * The verdict here is computed from the coverage rows. `executionIntent`
 * only decides whether an all-available program is ready to plan operations
 * or is being kept deliberately at concept level.
 */

import type { ArqMcpScope } from '../grant/scopes';
import type { GrantContext } from '../grant/grant';
import type { DomainProfileRegistry } from '../profile/profile-registry';
import type { ProjectAccessState } from '../profile/domain-profile';
import type { DesignProgram } from '../domain/design-program';
import { requestedCapabilities } from '../domain/design-program';

export type CoverageStatus = 'available' | 'unavailable' | 'blocked_by_state' | 'unknown';

export type CoverageState =
  'concept_plan_only' | 'ready_for_operation_planning' | 'blocked_by_capability';

export interface CoverageItem {
  readonly targetKind: 'component' | 'task';
  readonly targetId: string;
  readonly requestedCapability: string;
  readonly status: CoverageStatus;
  readonly operationVersions: readonly string[];
  readonly owningProfileId?: string;
  readonly reason: string;
  /** What would have to happen for this row to become `available`. Empty when it already is. */
  readonly blockers: readonly string[];
}

export interface CoverageReport {
  readonly designProgramId: string;
  readonly projectId?: string;
  readonly projectRevision?: string;
  readonly catalogRevision: string;
  readonly state: CoverageState;
  readonly coverage: readonly CoverageItem[];
  readonly warnings: readonly string[];
}

export interface AssessCoverageInput {
  readonly program: DesignProgram;
  readonly registry: DomainProfileRegistry;
  readonly grant: GrantContext;
  readonly project?: {
    readonly projectId: string;
    readonly revision: string;
    readonly accessState: ProjectAccessState;
  };
}

/**
 * The sentence that appears on every coverage result, in the tool response
 * and in the Coverage tab.
 *
 * It is repeated rather than stated once because the failure it guards
 * against is a reader seeing a column of "available" and concluding the
 * design is sound. A name match is a name match.
 */
export const COVERAGE_DISCLOSURE =
  'Coverage compares requested capability names with the operations Arq has registered. It does not check geometry, engineering, safety, regulatory compliance, manufacturability or whether the design is any good.';

export function assessCoverage(input: AssessCoverageInput): CoverageReport {
  const { program, registry, grant, project } = input;
  const requests = requestedCapabilities(program);
  const warnings: string[] = [COVERAGE_DISCLOSURE];

  const coverage = requests.map((request) => assessOne(request, registry, grant, project));

  if (project === undefined) {
    warnings.push(
      'No project was named, so nothing could be checked against a project state or a grant. Name a granted project to get a definite answer.',
    );
  }
  if (requests.length === 0) {
    warnings.push(
      'This program requests no capabilities, so there was nothing to check. Add requested capabilities to the components or tasks that would need Arq to build them.',
    );
  }
  if (program.executionIntent === 'requires_registered_operations' && requests.length === 0) {
    warnings.push(
      'The program says it needs registered operations but names none. That is not a plan Arq can act on; it is a plan with its execution step missing.',
    );
  }

  const state = deriveState(program, coverage);
  if (state === 'blocked_by_capability') {
    const missingProfiles = [
      ...new Set(
        coverage
          .filter((item) => item.status !== 'available')
          .map((item) => item.owningProfileId)
          .filter((id): id is string => id !== undefined),
      ),
    ].sort();
    if (missingProfiles.length > 0) {
      warnings.push(
        `The work Arq cannot do belongs to: ${missingProfiles.join(', ')}. Keep those components at concept level. Do not substitute an operation from a different profile.`,
      );
    }
  }

  const report: CoverageReport = {
    designProgramId: program.designProgramId,
    catalogRevision: registry.catalogRevision,
    state,
    coverage,
    warnings,
    ...(project === undefined
      ? {}
      : { projectId: project.projectId, projectRevision: project.revision }),
  };
  return report;
}

function assessOne(
  request: {
    readonly targetKind: 'component' | 'task';
    readonly targetId: string;
    readonly capability: string;
  },
  registry: DomainProfileRegistry,
  grant: GrantContext,
  project: AssessCoverageInput['project'],
): CoverageItem {
  const versions = registry.registeredVersions(request.capability);
  const base = {
    targetKind: request.targetKind,
    targetId: request.targetId,
    requestedCapability: request.capability,
  } as const;

  if (versions.length === 0) {
    const explanation = registry.explainMissingCapability(request.capability);
    return {
      ...base,
      status: 'unavailable',
      operationVersions: [],
      reason: explanation.reason,
      blockers: explanation.blockers,
      ...(explanation.owningProfileId === undefined
        ? {}
        : { owningProfileId: explanation.owningProfileId }),
    };
  }

  const definition = registry.findOperation(request.capability, versions[versions.length - 1]);
  const owningProfileId = request.capability.split('.')[0] ?? request.capability;

  if (project === undefined) {
    return {
      ...base,
      status: 'unknown',
      operationVersions: versions,
      owningProfileId,
      reason: `Arq registers ${request.capability} at ${versions.join(', ')}, but no project was named, so whether it can be used here is unknown.`,
      blockers: ['Name a granted project so the project state and the grant can be checked.'],
    };
  }

  const blockers: string[] = [];
  if (definition !== undefined && !definition.allowedProjectStates.includes(project.accessState)) {
    blockers.push(
      `The project is ${project.accessState.replace(/_/gu, ' ')}. This operation may only be staged against a project that is ${definition.allowedProjectStates.join(' or ')}.`,
    );
  }
  const missingScopes = (definition?.requiredScopes ?? []).filter(
    (scope: ArqMcpScope) => !grant.scopes.includes(scope),
  );
  if (missingScopes.length > 0) {
    blockers.push(
      `The grant does not carry ${missingScopes.join(', ')}. Ask the operator to widen it in Arq.`,
    );
  }
  if (definition?.deprecated === true) {
    blockers.push(
      definition.replacement === undefined
        ? 'This operation is deprecated.'
        : `This operation is deprecated. Use ${definition.replacement} instead.`,
    );
  }

  if (blockers.length > 0) {
    return {
      ...base,
      status: 'blocked_by_state',
      operationVersions: versions,
      owningProfileId,
      reason: `Arq registers ${request.capability}, but it cannot be used in this project right now.`,
      blockers,
    };
  }

  return {
    ...base,
    status: 'available',
    operationVersions: versions,
    owningProfileId,
    reason: `Arq registers ${request.capability} at ${versions.join(', ')} and this project can accept it. Read the operation's argument contract before building a change set.`,
    blockers: [],
  };
}

function deriveState(program: DesignProgram, coverage: readonly CoverageItem[]): CoverageState {
  if (coverage.length === 0) {
    // Nothing was requested, so nothing is blocked and nothing is ready.
    // Declaring an execution intent does not create a capability.
    return program.executionIntent === 'requires_registered_operations'
      ? 'blocked_by_capability'
      : 'concept_plan_only';
  }
  if (coverage.some((item) => item.status !== 'available')) {
    return 'blocked_by_capability';
  }
  return program.executionIntent === 'concept_only'
    ? 'concept_plan_only'
    : 'ready_for_operation_planning';
}

/** The one-line summary a tool result leads with. Written so it cannot be read as "the design is validated". */
export function describeCoverageState(state: CoverageState): string {
  switch (state) {
    case 'concept_plan_only':
      return 'This program is a concept plan. No part of it is queued to change a project.';
    case 'ready_for_operation_planning':
      return 'Every requested capability is registered and usable in this project. That is a name and version match, not a design review. Build and stage each operation separately.';
    case 'blocked_by_capability':
      return 'Some of this program needs capabilities Arq cannot provide here. Those parts stay as a concept plan, with the exact blockers recorded.';
  }
}
