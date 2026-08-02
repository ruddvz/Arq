/**
 * The bridge: grants and profiles on one side, the Arq host on the other.
 *
 * There is one adapter, not a fixture adapter and a real adapter. The
 * reviewed 2.0 package had only a mock, and its mock was also its entire
 * implementation - 1,070 lines of storage, validation, idempotency and
 * state machine that a real runtime adapter would have had to reimplement
 * from scratch, with no shared code and therefore no shared behaviour.
 * Here the parts that are genuinely product logic - grants, plan storage,
 * proposal lifecycle, coverage, pagination - live once, and what varies is
 * the `ArqProjectHost` behind them. A fixture run and a live run differ by
 * which host was constructed, not by which code path executes.
 *
 * Every method takes a `GrantContext` first and checks it first. There is
 * no path into the host that skips the check, because there is no method
 * without the parameter.
 */

import type { Clock, IdSource } from '../runtime/clock';
import type { AuditTrail } from '../audit/audit-trail';
import type { ArqMcpScope } from '../grant/scopes';
import type { GrantContext } from '../grant/grant';
import { describeGrant, grantState, requireProjectAccess, requireScope } from '../grant/grant';
import type { DomainProfileRegistry } from '../profile/profile-registry';
import type {
  DomainProfile,
  OperationDefinition,
  ProjectAccessState,
} from '../profile/domain-profile';
import type { ArqProjectHost, HostOperation, HostPrecondition } from '../host/project-host';
import type { JsonValue } from '../schema/json-value';
import { toJsonValue } from '../schema/json-value';
import {
  capabilityUnavailable,
  invalidState,
  projectNotAvailable,
  projectNotEditable,
  recordNotAvailable,
  staleRevision,
} from '../domain/errors';
import { ARQ_MCP_LIMITS, MAX_PROPOSALS_PER_PROJECT, PROPOSAL_LIFETIME_MS } from '../domain/limits';
import type { Brief, BriefInput } from '../domain/brief';
import { buildBrief, topologicalWorkOrder } from '../domain/brief';
import type { DesignProgram, DesignProgramInput } from '../domain/design-program';
import { buildDesignProgram } from '../domain/design-program';
import type { ChangeSet, ChangeSetInput } from '../domain/changeset';
import { deriveProvenance, referenceWarnings } from '../domain/plan-common';
import type { Proposal, ProposalState, ValidationIssueRecord } from '../domain/proposal';
import { canCancel, canonicalMutationFor, isTerminal } from '../domain/proposal';
import { contentDigest, shortDigest } from '../util/hash';
import { assessCoverage, type CoverageReport } from './coverage';
import { decodeCursor, encodeCursor } from './cursor';
import { createIdempotencyStore, type IdempotencyStore } from './idempotency';

export interface ArqBridgeOptions {
  readonly host: ArqProjectHost;
  readonly registry: DomainProfileRegistry;
  readonly clock: Clock;
  readonly idSource: IdSource;
  readonly audit: AuditTrail;
  /** How this server is reachable. Reported in capabilities so a client never has to guess. */
  readonly serverMode: 'local_runtime' | 'remote_gateway';
  readonly proposalLifetimeMs?: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
  readonly totalMatches: number;
}

export interface CapabilityFeature {
  readonly name: string;
  readonly status: 'available' | 'unavailable';
  readonly reason?: string;
}

export interface CapabilityReport {
  readonly serverMode: ArqBridgeOptions['serverMode'];
  readonly runtimeBinding: 'in_process_arq_host';
  readonly approvalModel: 'arq_side_only';
  readonly catalogRevision: string;
  readonly limits: typeof ARQ_MCP_LIMITS;
  readonly profiles: readonly {
    readonly profileId: string;
    readonly profileVersion: string;
    readonly status: DomainProfile['status'];
    readonly operationCount: number;
    readonly evidenceState: DomainProfile['evidence']['state'];
  }[];
  readonly features: readonly CapabilityFeature[];
  /** Named so a reader cannot mistake absence for an unlisted feature. There is no tool for any of these. */
  readonly absentCapabilities: readonly string[];
  readonly grant: {
    readonly state: 'active' | 'expired' | 'revoked';
    readonly scopes: readonly ArqMcpScope[];
    readonly projectCount: number;
    readonly description: string;
  };
}

export interface StoredBriefRecord {
  readonly brief: Brief;
  readonly workOrder: readonly string[];
  readonly warnings: readonly string[];
}

export interface StoredDesignProgramRecord {
  readonly designProgram: DesignProgram;
  readonly warnings: readonly string[];
}

export interface ProjectOpenRequestResult {
  readonly openRequestId: string;
  readonly projectId: string;
  readonly state: 'project_open_requested' | 'runtime_unavailable';
}

export interface UndoReviewRequest {
  readonly undoRequestId: string;
  readonly projectId: string;
  readonly undoGroupId: string;
  readonly affectedElementIds: readonly string[];
  readonly operationCount: number;
  readonly state: 'awaiting_user_approval';
}

export interface PublishRequest {
  readonly publishRequestId: string;
  readonly projectId: string;
  readonly revision: string;
  readonly state: 'awaiting_user_destination';
}

/** See `planStore`: a byte that cannot appear in a tenant or subject identifier. */
const PLAN_KEY_SEPARATOR = '\u0000';

interface PlanStore {
  readonly briefs: Map<string, Brief>;
  readonly designPrograms: Map<string, DesignProgram>;
}

export class ArqBridge {
  private readonly host: ArqProjectHost;
  private readonly registry: DomainProfileRegistry;
  private readonly clock: Clock;
  private readonly idSource: IdSource;
  private readonly audit: AuditTrail;
  private readonly serverMode: ArqBridgeOptions['serverMode'];
  private readonly proposalLifetimeMs: number;
  private readonly idempotency: IdempotencyStore;
  /** Plans belong to a person in a tenant, not to a grant: renewing a grant must not lose the plan it was working on. */
  private readonly plans = new Map<string, PlanStore>();
  private readonly proposals = new Map<string, Map<string, Proposal>>();

  constructor(options: ArqBridgeOptions) {
    this.host = options.host;
    this.registry = options.registry;
    this.clock = options.clock;
    this.idSource = options.idSource;
    this.audit = options.audit;
    this.serverMode = options.serverMode;
    this.proposalLifetimeMs = options.proposalLifetimeMs ?? PROPOSAL_LIFETIME_MS;
    this.idempotency = createIdempotencyStore(options.clock);
  }

  getCapabilities(grant: GrantContext): CapabilityReport {
    // Deliberately not scope-gated beyond the capabilities scope: a client
    // that cannot discover what it may do will guess, and guessing is the
    // behaviour this whole surface exists to prevent.
    requireScope(grant, 'arq.capabilities.read', this.clock);
    const profiles = this.registry.profiles.map((profile) => ({
      profileId: profile.profileId,
      profileVersion: profile.profileVersion,
      status: profile.status,
      operationCount: profile.operations.length,
      evidenceState: profile.evidence.state,
    }));

    return {
      serverMode: this.serverMode,
      runtimeBinding: 'in_process_arq_host',
      approvalModel: 'arq_side_only',
      catalogRevision: this.registry.catalogRevision,
      limits: ARQ_MCP_LIMITS,
      profiles,
      features: this.features(),
      absentCapabilities: [
        'canonical.commit',
        'proposal.approve',
        'filesystem.path_open',
        'database.raw_query',
        'native_file.write',
        'reference.fetch',
      ],
      grant: {
        state: grantState(grant, this.clock),
        scopes: grant.scopes,
        projectCount: grant.projectIds.length,
        description: describeGrant(grant, this.clock),
      },
    };
  }

  private features(): readonly CapabilityFeature[] {
    return [
      { name: 'project.read', status: 'available' },
      { name: 'model.query', status: 'available' },
      { name: 'catalog.read', status: 'available' },
      { name: 'plan.write', status: 'available' },
      { name: 'changeset.stage', status: 'available' },
      { name: 'changeset.review_request', status: 'available' },
      { name: 'changeset.cancel', status: 'available' },
      { name: 'undo.review_request', status: 'available' },
      { name: 'publish.request', status: 'available' },
      {
        name: 'canonical.commit',
        status: 'unavailable',
        reason:
          'Committing is an Arq-side action that follows an operator decision made in Arq. No tool here can reach it.',
      },
      {
        name: 'native_arq_file',
        status: 'unavailable',
        reason:
          'The project lives in the Arq host, not in a .arq file. Writing a file is a request the operator completes in Arq by choosing a destination.',
      },
      {
        name: 'reference_fetch',
        status: 'unavailable',
        reason:
          'This server never fetches an external reference. A reference URI is recorded as data and reviewed by a person.',
      },
      {
        name: 'remote_gateway',
        status: 'unavailable',
        reason:
          'There is no hosted endpoint, OAuth authorization server or tenant isolation implementation. Remote access is a separate piece of work.',
      },
    ];
  }

  listDomainProfiles(grant: GrantContext): readonly DomainProfile[] {
    requireScope(grant, 'arq.catalog.read', this.clock);
    return this.registry.profiles;
  }

  getDomainProfile(grant: GrantContext, profileId: string): DomainProfile {
    requireScope(grant, 'arq.catalog.read', this.clock);
    const profile = this.registry.getProfile(profileId);
    if (profile === undefined) {
      throw recordNotAvailable('domain profile');
    }
    return profile;
  }

  listProjects(
    grant: GrantContext,
    input: { readonly cursor?: string; readonly limit: number },
  ): Page<ReturnType<ArqProjectHost['getSummary']>> {
    requireScope(grant, 'arq.projects.read', this.clock);
    // Intersected with the grant, not filtered after the fact: a project the
    // host knows about and the grant does not cover never enters the list.
    const summaries = grant.projectIds
      .map((projectId) => this.host.getSummary(projectId))
      .filter((summary) => summary !== undefined)
      .sort((left, right) => left.projectId.localeCompare(right.projectId));

    return this.paginate(summaries, input.cursor, input.limit, {
      tool: 'arq_list_projects',
      scopeKey: { grantId: grant.grantId, projects: [...grant.projectIds] },
    });
  }

  getProjectSnapshot(grant: GrantContext, projectId: string) {
    requireScope(grant, 'arq.projects.read', this.clock);
    requireProjectAccess(grant, projectId, this.clock);
    const snapshot = this.host.getSnapshot(projectId);
    if (snapshot === undefined) {
      throw projectNotAvailable();
    }
    return snapshot;
  }

  queryModel(
    grant: GrantContext,
    input: {
      readonly projectId: string;
      readonly snapshotRevision: string;
      readonly ids?: readonly string[];
      readonly kinds?: readonly string[];
      readonly text?: string;
      readonly fields?: readonly string[];
      readonly cursor?: string;
      readonly limit: number;
    },
  ) {
    requireScope(grant, 'arq.model.read', this.clock);
    requireProjectAccess(grant, input.projectId, this.clock);

    const summary = this.host.getSummary(input.projectId);
    if (summary === undefined) {
      throw projectNotAvailable();
    }
    if (summary.revision !== input.snapshotRevision) {
      throw staleRevision(input.snapshotRevision, summary.revision);
    }

    const binding = {
      tool: 'arq_query_model',
      scopeKey: {
        grantId: grant.grantId,
        projectId: input.projectId,
        snapshotRevision: input.snapshotRevision,
        ids: input.ids === undefined ? null : [...input.ids],
        kinds: input.kinds === undefined ? null : [...input.kinds],
        text: input.text ?? null,
        fields: input.fields === undefined ? null : [...input.fields],
      },
    };
    const offset = decodeCursor(input.cursor, binding);

    const result = this.host.query({
      projectId: input.projectId,
      snapshotRevision: input.snapshotRevision,
      offset,
      limit: input.limit,
      ...(input.ids === undefined ? {} : { ids: input.ids }),
      ...(input.kinds === undefined ? {} : { kinds: input.kinds }),
      ...(input.text === undefined ? {} : { text: input.text }),
      ...(input.fields === undefined ? {} : { fields: input.fields }),
    });
    if (result === undefined) {
      throw staleRevision(input.snapshotRevision, summary.revision);
    }

    const nextOffset = offset + result.items.length;
    return {
      projectId: input.projectId,
      snapshotRevision: result.snapshotRevision,
      items: result.items,
      totalMatches: result.totalMatches,
      truncated: nextOffset < result.totalMatches,
      ...(nextOffset < result.totalMatches
        ? { nextCursor: encodeCursor(nextOffset, binding) }
        : {}),
    };
  }

  getOperationCatalog(grant: GrantContext, projectId: string) {
    requireScope(grant, 'arq.catalog.read', this.clock);
    requireProjectAccess(grant, projectId, this.clock);
    const summary = this.host.getSummary(projectId);
    if (summary === undefined) {
      throw projectNotAvailable();
    }
    const operations = this.operationsFor(projectId);
    return {
      projectId,
      projectRevision: summary.revision,
      projectAccessState: summary.accessState,
      catalogRevision: this.registry.catalogRevision,
      operations,
      hostSubsetsCatalogue: operations.length !== this.registry.registeredOperations().length,
    };
  }

  /**
   * The operations this project can actually accept.
   *
   * The registry says what Arq knows how to do. The host says what this
   * project store can do, and a host that cannot express a room must not
   * have room creation advertised to a caller that will then build a change
   * set around it. Where the host declares nothing, it implements the whole
   * catalogue.
   */
  private operationsFor(projectId: string): readonly OperationDefinition[] {
    const registered = this.registry.registeredOperations();
    const supported = this.host.supportedOperationTypes?.(projectId);
    if (supported === undefined) {
      return registered;
    }
    const allowed = new Set(supported);
    return registered.filter((operation) => allowed.has(operation.operationType));
  }

  saveBrief(
    grant: GrantContext,
    input: { readonly requestId: string; readonly brief: BriefInput },
  ): StoredBriefRecord {
    requireScope(grant, 'arq.plans.write', this.clock);
    if (input.brief.projectId !== undefined) {
      requireProjectAccess(grant, input.brief.projectId, this.clock);
    }

    return this.idempotency.run(
      grant.grantId,
      'save_brief',
      input.requestId,
      toJsonValue(input.brief),
      () => {
        const store = this.planStore(grant);
        const contentHash = contentDigest(toJsonValue(input.brief));
        const existing = store.briefs.get(input.brief.briefId);
        if (existing !== undefined && existing.contentHash !== contentHash) {
          throw invalidState(
            'ARQ_BRIEF_ID_IN_USE',
            'idempotency_conflict',
            'That brief identifier already holds different content. Nothing was changed.',
            'Use a new brief identifier, or send the identical brief again if you meant to repeat the call.',
          );
        }

        const brief = buildBrief({
          input: input.brief,
          provenance: deriveProvenance(grant, this.clock),
          contentHash,
        });
        store.briefs.set(brief.briefId, brief);
        return this.briefRecord(brief);
      },
    );
  }

  getBrief(grant: GrantContext, briefId: string): StoredBriefRecord {
    requireScope(grant, 'arq.plans.read', this.clock);
    const brief = this.planStore(grant).briefs.get(briefId);
    if (brief === undefined) {
      throw recordNotAvailable('brief');
    }
    return this.briefRecord(brief);
  }

  listBriefs(
    grant: GrantContext,
    input: { readonly projectId?: string; readonly cursor?: string; readonly limit: number },
  ): Page<{
    readonly briefId: string;
    readonly title: string;
    readonly projectId?: string;
    readonly recordedAt: string;
  }> {
    requireScope(grant, 'arq.plans.read', this.clock);
    if (input.projectId !== undefined) {
      requireProjectAccess(grant, input.projectId, this.clock);
    }
    const summaries = [...this.planStore(grant).briefs.values()]
      .filter((brief) => input.projectId === undefined || brief.projectId === input.projectId)
      .sort((left, right) => left.briefId.localeCompare(right.briefId))
      .map((brief) => ({
        briefId: brief.briefId,
        title: brief.title,
        recordedAt: brief.provenance.recordedAt,
        ...(brief.projectId === undefined ? {} : { projectId: brief.projectId }),
      }));

    return this.paginate(summaries, input.cursor, input.limit, {
      tool: 'arq_list_briefs',
      scopeKey: { grantId: grant.grantId, projectId: input.projectId ?? null },
    });
  }

  private briefRecord(brief: Brief): StoredBriefRecord {
    return {
      brief,
      workOrder: topologicalWorkOrder(brief),
      warnings: [
        ...referenceWarnings(brief.references),
        ...(brief.questions.length > 0
          ? [
              `${brief.questions.length} question${brief.questions.length === 1 ? ' is' : 's are'} still open. Answer them before proposing changes rather than choosing for the operator.`,
            ]
          : []),
      ],
    };
  }

  saveDesignProgram(
    grant: GrantContext,
    input: { readonly requestId: string; readonly designProgram: DesignProgramInput },
  ): StoredDesignProgramRecord {
    requireScope(grant, 'arq.plans.write', this.clock);
    if (input.designProgram.projectId !== undefined) {
      requireProjectAccess(grant, input.designProgram.projectId, this.clock);
    }

    return this.idempotency.run(
      grant.grantId,
      'save_design_program',
      input.requestId,
      toJsonValue(input.designProgram),
      () => {
        const store = this.planStore(grant);
        const contentHash = contentDigest(toJsonValue(input.designProgram));
        const existing = store.designPrograms.get(input.designProgram.designProgramId);
        // Unlike a brief, a design program may legitimately be revised under
        // the same identifier: the History tab is specified to show design
        // program versions. Re-saving therefore increments a version rather
        // than raising a conflict, and the previous content hash is what
        // decides whether anything actually changed.
        const version =
          existing === undefined
            ? 1
            : existing.contentHash === contentHash
              ? existing.version
              : existing.version + 1;

        const designProgram = buildDesignProgram({
          input: input.designProgram,
          provenance: deriveProvenance(grant, this.clock),
          contentHash,
          version,
        });
        store.designPrograms.set(designProgram.designProgramId, designProgram);
        return this.designProgramRecord(designProgram);
      },
    );
  }

  getDesignProgram(grant: GrantContext, designProgramId: string): StoredDesignProgramRecord {
    requireScope(grant, 'arq.plans.read', this.clock);
    const program = this.planStore(grant).designPrograms.get(designProgramId);
    if (program === undefined) {
      throw recordNotAvailable('design program');
    }
    return this.designProgramRecord(program);
  }

  listDesignPrograms(
    grant: GrantContext,
    input: { readonly projectId?: string; readonly cursor?: string; readonly limit: number },
  ): Page<{
    readonly designProgramId: string;
    readonly title: string;
    readonly designDomain: string;
    readonly version: number;
    readonly projectId?: string;
  }> {
    requireScope(grant, 'arq.plans.read', this.clock);
    if (input.projectId !== undefined) {
      requireProjectAccess(grant, input.projectId, this.clock);
    }
    const summaries = [...this.planStore(grant).designPrograms.values()]
      .filter((program) => input.projectId === undefined || program.projectId === input.projectId)
      .sort((left, right) => left.designProgramId.localeCompare(right.designProgramId))
      .map((program) => ({
        designProgramId: program.designProgramId,
        title: program.title,
        designDomain: program.designDomain,
        version: program.version,
        ...(program.projectId === undefined ? {} : { projectId: program.projectId }),
      }));

    return this.paginate(summaries, input.cursor, input.limit, {
      tool: 'arq_list_design_programs',
      scopeKey: { grantId: grant.grantId, projectId: input.projectId ?? null },
    });
  }

  private designProgramRecord(designProgram: DesignProgram): StoredDesignProgramRecord {
    return {
      designProgram,
      warnings: [
        ...referenceWarnings(designProgram.references),
        ...(designProgram.questions.length > 0
          ? [
              `${designProgram.questions.length} question${designProgram.questions.length === 1 ? ' is' : 's are'} still open. They stay visible until someone answers them.`,
            ]
          : []),
      ],
    };
  }

  assessDesignProgramCoverage(
    grant: GrantContext,
    input: { readonly designProgramId: string; readonly projectId?: string },
  ): CoverageReport {
    requireScope(grant, 'arq.catalog.read', this.clock);
    const program = this.planStore(grant).designPrograms.get(input.designProgramId);
    if (program === undefined) {
      throw recordNotAvailable('design program');
    }

    const requestedProjectId = input.projectId ?? program.projectId;
    if (requestedProjectId !== undefined) {
      requireProjectAccess(grant, requestedProjectId, this.clock);
    }
    if (
      input.projectId !== undefined &&
      program.projectId !== undefined &&
      input.projectId !== program.projectId
    ) {
      throw invalidState(
        'ARQ_PLAN_PROJECT_MISMATCH',
        'project_mismatch',
        'That design program is attached to a different project. Nothing was read or changed.',
        'Assess it against the project it is attached to, or save a copy attached to this one.',
      );
    }

    const summary =
      requestedProjectId === undefined ? undefined : this.host.getSummary(requestedProjectId);
    if (requestedProjectId !== undefined && summary === undefined) {
      throw projectNotAvailable();
    }

    return assessCoverage({
      program,
      registry: this.registry,
      grant,
      ...(summary === undefined
        ? {}
        : {
            project: {
              projectId: summary.projectId,
              revision: summary.revision,
              accessState: summary.accessState,
            },
          }),
    });
  }

  createProjectDraft(
    grant: GrantContext,
    input: { readonly requestId: string; readonly name: string },
  ) {
    requireScope(grant, 'arq.project.draft_create', this.clock);
    return this.idempotency.run(
      grant.grantId,
      'create_project_draft',
      input.requestId,
      toJsonValue({ name: input.name }),
      () => {
        // The identifier is derived from the request rather than chosen by
        // the caller, so a client can never name a project into existence
        // that collides with one it was not granted.
        const projectId = `project-${shortDigest({ grantId: grant.grantId, requestId: input.requestId })}`;
        const summary = this.host.createDraft(projectId, input.name);
        return {
          project: summary,
          requiresDestinationSelection: true as const,
          nativeFileState: 'not_published' as const,
          grantNote:
            'The draft exists in Arq. This grant does not automatically cover it: the operator decides what to share.',
        };
      },
    );
  }

  requestProjectOpen(
    grant: GrantContext,
    input: { readonly requestId: string; readonly projectId: string },
  ): ProjectOpenRequestResult {
    requireScope(grant, 'arq.project.open_request', this.clock);
    requireProjectAccess(grant, input.projectId, this.clock);
    return this.idempotency.run(
      grant.grantId,
      'request_project_open',
      input.requestId,
      toJsonValue({ projectId: input.projectId }),
      () => ({
        openRequestId: `open-${this.idSource()}`,
        projectId: input.projectId,
        state: this.host.requestOpen(input.projectId),
      }),
    );
  }

  stageChangeSet(
    grant: GrantContext,
    input: { readonly requestId: string; readonly changeSet: ChangeSetInput },
  ): Proposal {
    requireScope(grant, 'arq.changes.stage', this.clock);
    requireProjectAccess(grant, input.changeSet.projectId, this.clock);

    return this.idempotency.run(
      grant.grantId,
      'stage_changeset',
      input.requestId,
      toJsonValue(input.changeSet),
      () => this.stageInternal(grant, input.changeSet),
    );
  }

  private stageInternal(grant: GrantContext, changeSetInput: ChangeSetInput): Proposal {
    const summary = this.host.getSummary(changeSetInput.projectId);
    if (summary === undefined) {
      throw projectNotAvailable();
    }
    if (summary.accessState !== 'editable') {
      throw projectNotEditable(summary.accessState);
    }
    if (summary.revision !== changeSetInput.baseRevision) {
      throw staleRevision(changeSetInput.baseRevision, summary.revision);
    }

    // Catalogue membership, project state, scope and deprecation are checked
    // before anything reaches the host, so an unregistered operation is
    // refused as a capability question with an explanation rather than as an
    // opaque runtime rejection.
    const availableHere = new Map(
      this.operationsFor(changeSetInput.projectId).map((operation) => [
        `${operation.operationType}@${operation.operationVersion}`,
        operation,
      ]),
    );
    for (const operation of changeSetInput.operations) {
      const definition = availableHere.get(
        `${operation.operationType}@${operation.operationVersion}`,
      );
      if (definition === undefined) {
        const explanation = this.registry.explainMissingCapability(operation.operationType);
        const versions = this.registry.registeredVersions(operation.operationType);
        const hostSupports = this.operationsFor(changeSetInput.projectId).some(
          (candidate) => candidate.operationType === operation.operationType,
        );
        throw capabilityUnavailable(
          `${operation.operationType}@${operation.operationVersion}`,
          versions.length === 0
            ? explanation.reason
            : !hostSupports
              ? `Arq registers that operation, but this project cannot accept it. Read arq_get_operation_catalog for this project rather than assuming the whole catalogue applies.`
              : `Arq registers that operation at ${versions.join(', ')} and not at ${operation.operationVersion}.`,
        );
      }
      if (!definition.allowedProjectStates.includes(summary.accessState)) {
        throw projectNotEditable(summary.accessState);
      }
      const missing = definition.requiredScopes.filter((scope) => !grant.scopes.includes(scope));
      if (missing.length > 0) {
        requireScope(grant, missing[0]!, this.clock);
      }
    }

    const contentHash = contentDigest(toJsonValue(changeSetInput));
    const changeSet: ChangeSet = { ...changeSetInput, contentHash };
    const proposals = this.proposalsFor(changeSetInput.projectId);

    const existing = [...proposals.values()].find(
      (proposal) => proposal.changeSetId === changeSet.changeSetId,
    );
    if (existing !== undefined) {
      if (existing.proposalHash !== contentHash) {
        throw invalidState(
          'ARQ_CHANGESET_ID_IN_USE',
          'idempotency_conflict',
          'That change-set identifier already holds different operations. Nothing was changed.',
          'Use a new change-set identifier rather than editing one that was already staged.',
        );
      }
      return this.refresh(existing, summary.revision);
    }

    const validation = this.host.validate(
      changeSet.projectId,
      changeSet.baseRevision,
      changeSet.operations.map(toHostOperation),
    );

    const errors = validation.messages
      .filter((issue) => issue.severity === 'error')
      .map(toIssueRecord);
    const warnings = validation.messages
      .filter((issue) => issue.severity !== 'error')
      .map(toIssueRecord);

    const now = this.clock();
    const state: ProposalState =
      validation.status === 'passed' ? 'ready_for_review' : 'validation_failed';
    const proposal: Proposal = {
      proposalId: `proposal-${shortDigest({ projectId: changeSet.projectId, contentHash })}`,
      changeSetId: changeSet.changeSetId,
      projectId: changeSet.projectId,
      proposalHash: contentHash,
      state,
      changeSet,
      validation: {
        status: validation.status,
        catalogRevision: this.registry.catalogRevision,
        errors,
        warnings,
        affectedElementIds: validation.affectedElementIds,
        expectedInvalidations: validation.expectedInvalidations,
        availablePreviews: validation.availablePreviews,
      },
      approval: { required: true, state: 'not_requested' },
      canonicalMutation: { state: 'none', revisionBefore: changeSet.baseRevision },
      stagedAtEpochMs: now,
      expiresAtEpochMs: now + this.proposalLifetimeMs,
      stateChangedAtEpochMs: now,
    };

    proposals.set(proposal.proposalId, proposal);
    this.evictProposals(proposals);
    return proposal;
  }

  getProposal(
    grant: GrantContext,
    input: { readonly projectId: string; readonly proposalId: string },
  ): Proposal {
    requireScope(grant, 'arq.plans.read', this.clock);
    requireProjectAccess(grant, input.projectId, this.clock);
    const proposal = this.proposalsFor(input.projectId).get(input.proposalId);
    if (proposal === undefined) {
      throw recordNotAvailable('proposal');
    }
    const summary = this.host.getSummary(input.projectId);
    return this.refresh(proposal, summary?.revision ?? proposal.canonicalMutation.revisionBefore);
  }

  listProposals(
    grant: GrantContext,
    input: { readonly projectId: string; readonly cursor?: string; readonly limit: number },
  ): Page<{
    readonly proposalId: string;
    readonly changeSetId: string;
    readonly state: ProposalState;
    readonly operationCount: number;
    readonly baseRevision: string;
  }> {
    requireScope(grant, 'arq.plans.read', this.clock);
    requireProjectAccess(grant, input.projectId, this.clock);
    const summary = this.host.getSummary(input.projectId);
    const currentRevision = summary?.revision ?? '';

    const summaries = [...this.proposalsFor(input.projectId).values()]
      .map((proposal) => this.refresh(proposal, currentRevision))
      .sort((left, right) => right.stagedAtEpochMs - left.stagedAtEpochMs)
      .map((proposal) => ({
        proposalId: proposal.proposalId,
        changeSetId: proposal.changeSetId,
        state: proposal.state,
        operationCount: proposal.changeSet.operations.length,
        baseRevision: proposal.changeSet.baseRevision,
      }));

    return this.paginate(summaries, input.cursor, input.limit, {
      tool: 'arq_list_changesets',
      scopeKey: { grantId: grant.grantId, projectId: input.projectId },
    });
  }

  requestProposalReview(
    grant: GrantContext,
    input: { readonly requestId: string; readonly projectId: string; readonly proposalId: string },
  ): Proposal {
    requireScope(grant, 'arq.changes.review_request', this.clock);
    requireProjectAccess(grant, input.projectId, this.clock);

    return this.idempotency.run(
      grant.grantId,
      'request_review',
      input.requestId,
      toJsonValue({ projectId: input.projectId, proposalId: input.proposalId }),
      () => {
        const current = this.getProposal(grant, input);
        if (current.state === 'awaiting_user_approval') {
          return current;
        }
        if (current.state !== 'ready_for_review') {
          throw invalidState(
            'ARQ_PROPOSAL_NOT_REVIEWABLE',
            current.state,
            'That proposal cannot be sent for review from its current state. Nothing was changed.',
            'Read the proposal for its state and next action before requesting review again.',
          );
        }

        const updated: Proposal = {
          ...current,
          state: 'awaiting_user_approval',
          approval: {
            required: true,
            state: 'awaiting_user',
            reviewUri: `arq://review/${current.proposalId}`,
          },
          stateChangedAtEpochMs: this.clock(),
        };
        this.proposalsFor(input.projectId).set(updated.proposalId, updated);
        return updated;
      },
    );
  }

  cancelProposal(
    grant: GrantContext,
    input: {
      readonly requestId: string;
      readonly projectId: string;
      readonly proposalId: string;
      readonly reason?: string;
    },
  ): Proposal {
    requireScope(grant, 'arq.changes.stage', this.clock);
    requireProjectAccess(grant, input.projectId, this.clock);

    return this.idempotency.run(
      grant.grantId,
      'cancel_changeset',
      input.requestId,
      toJsonValue({ projectId: input.projectId, proposalId: input.proposalId }),
      () => {
        const current = this.getProposal(grant, input);
        if (current.state === 'cancelled') {
          return current;
        }
        if (!canCancel(current.state)) {
          throw invalidState(
            'ARQ_PROPOSAL_NOT_CANCELLABLE',
            current.state,
            'That proposal can no longer be withdrawn. Nothing was changed.',
            'Read the proposal for its state. A decision already made in Arq is the operator’s to reverse, not a tool’s.',
          );
        }
        const updated: Proposal = {
          ...current,
          state: 'cancelled',
          approval: { required: true, state: 'not_requested' },
          stateChangedAtEpochMs: this.clock(),
        };
        this.proposalsFor(input.projectId).set(updated.proposalId, updated);
        return updated;
      },
    );
  }

  requestUndo(
    grant: GrantContext,
    input: {
      readonly requestId: string;
      readonly projectId: string;
      readonly undoGroupId: string;
      readonly reason?: string;
    },
  ): UndoReviewRequest {
    requireScope(grant, 'arq.undo.request', this.clock);
    requireProjectAccess(grant, input.projectId, this.clock);

    return this.idempotency.run(
      grant.grantId,
      'request_undo',
      input.requestId,
      toJsonValue({ projectId: input.projectId, undoGroupId: input.undoGroupId }),
      () => {
        const group = this.host.getUndoGroup(input.projectId, input.undoGroupId);
        if (group === undefined) {
          throw recordNotAvailable('undo group');
        }
        if (group.hasDownstreamChanges) {
          throw invalidState(
            'ARQ_UNDO_HAS_DOWNSTREAM_CHANGES',
            'stale_undo_context',
            'The project changed after that group, so Arq must reconcile the later work before it can be undone. Nothing was changed.',
            'Undo the later groups first, or ask the operator to reconcile them in Arq.',
          );
        }
        return {
          undoRequestId: `undo-request-${this.idSource()}`,
          projectId: input.projectId,
          undoGroupId: input.undoGroupId,
          affectedElementIds: group.affectedElementIds,
          operationCount: group.operationCount,
          state: 'awaiting_user_approval' as const,
        };
      },
    );
  }

  requestPublish(
    grant: GrantContext,
    input: { readonly requestId: string; readonly projectId: string; readonly revision: string },
  ): PublishRequest {
    requireScope(grant, 'arq.publish.request', this.clock);
    requireProjectAccess(grant, input.projectId, this.clock);

    return this.idempotency.run(
      grant.grantId,
      'request_publish',
      input.requestId,
      toJsonValue({ projectId: input.projectId, revision: input.revision }),
      () => {
        const summary = this.host.getSummary(input.projectId);
        if (summary === undefined) {
          throw projectNotAvailable();
        }
        if (summary.revision !== input.revision) {
          throw staleRevision(input.revision, summary.revision);
        }
        return {
          publishRequestId: `publish-request-${this.idSource()}`,
          projectId: input.projectId,
          revision: input.revision,
          state: 'awaiting_user_destination' as const,
        };
      },
    );
  }

  getAuditTrail(grant: GrantContext, limit: number) {
    requireScope(grant, 'arq.audit.read', this.clock);
    return {
      events: this.audit.read(grant, limit),
      note: 'Each entry records a fingerprint of the request, never its content.',
    };
  }

  /** The trace identifier every result carries, minted once per call by the service layer. */
  nextTraceId(): string {
    return `trace-${this.idSource()}`;
  }

  private planStore(grant: GrantContext): PlanStore {
    // A separator no identifier can contain. A space would let
    // ("tenant a", "subject") and ("tenant", "a subject") collide onto one
    // key, which would show one person another person's plans. Written as
    // an escape rather than a literal control character so the source stays
    // text and the intent is visible.
    const key = `${grant.tenantId}${PLAN_KEY_SEPARATOR}${grant.subjectId}`;
    const existing = this.plans.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const store: PlanStore = { briefs: new Map(), designPrograms: new Map() };
    this.plans.set(key, store);
    return store;
  }

  private proposalsFor(projectId: string): Map<string, Proposal> {
    const existing = this.proposals.get(projectId);
    if (existing !== undefined) {
      return existing;
    }
    const created = new Map<string, Proposal>();
    this.proposals.set(projectId, created);
    return created;
  }

  /**
   * Ages a proposal forward before anyone reads it.
   *
   * Expiry and supersession are computed on read rather than on a timer, so
   * a caller can never observe a proposal that is nominally reviewable but
   * was built against a revision that has moved, or one that sat past its
   * lifetime.
   */
  private refresh(proposal: Proposal, currentRevision: string): Proposal {
    // A terminal proposal is finished, including a committed one. Nothing
    // ages it further, and re-deriving that from the individual state names
    // would be a second, drifting copy of the state machine.
    if (isTerminal(proposal.state)) {
      return proposal;
    }

    // Supersession is checked before expiry: when both are true, the more
    // useful thing to tell a caller is that the project moved on, because
    // that names what to rebuild against.
    const movedOn = currentRevision !== '' && currentRevision !== proposal.changeSet.baseRevision;
    const aged = this.clock() >= proposal.expiresAtEpochMs;
    if (!movedOn && !aged) {
      return proposal;
    }

    const next: Proposal = {
      ...proposal,
      state: movedOn ? 'superseded' : 'expired',
      stateChangedAtEpochMs: this.clock(),
    };
    this.proposalsFor(proposal.projectId).set(proposal.proposalId, next);
    return next;
  }

  /**
   * Drops the oldest finished proposals when a project accumulates too many.
   *
   * A live proposal is never evicted, and neither is a committed one: a
   * committed proposal is the record of a change the project actually
   * carries, so it is the last thing to discard rather than the first.
   */
  private evictProposals(proposals: Map<string, Proposal>): void {
    if (proposals.size <= MAX_PROPOSALS_PER_PROJECT) {
      return;
    }
    const discardable = [...proposals.values()]
      .filter(
        (proposal) => isTerminal(proposal.state) && canonicalMutationFor(proposal.state) === 'none',
      )
      .sort((left, right) => left.stagedAtEpochMs - right.stagedAtEpochMs);
    for (const proposal of discardable) {
      if (proposals.size <= MAX_PROPOSALS_PER_PROJECT) {
        return;
      }
      proposals.delete(proposal.proposalId);
    }
  }

  private paginate<T>(
    all: readonly T[],
    cursor: string | undefined,
    limit: number,
    binding: { readonly tool: string; readonly scopeKey: JsonValue },
  ): Page<T> {
    const offset = decodeCursor(cursor, binding);
    const items = all.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    return {
      items,
      totalMatches: all.length,
      ...(nextOffset < all.length ? { nextCursor: encodeCursor(nextOffset, binding) } : {}),
    };
  }
}

function toHostOperation(operation: ChangeSetInput['operations'][number]): HostOperation {
  return {
    operationId: operation.operationId,
    operationType: operation.operationType,
    operationVersion: operation.operationVersion,
    arguments: operation.arguments,
    preconditions: operation.preconditions as readonly HostPrecondition[],
  };
}

function toIssueRecord(issue: {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly title: string;
  readonly explanation: string;
  readonly affectedElementIds: readonly string[];
  readonly suggestedActions: readonly string[];
}): ValidationIssueRecord {
  return {
    code: issue.code,
    severity: issue.severity,
    title: issue.title,
    message: issue.explanation,
    affectedElementIds: [...issue.affectedElementIds],
    suggestedActions: [...issue.suggestedActions],
  };
}

export type { ProjectAccessState };
