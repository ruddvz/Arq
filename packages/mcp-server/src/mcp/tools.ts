/**
 * The tool surface, as data.
 *
 * Twenty-four tools, none of which commits, approves, opens a path, runs a
 * query language or writes a file. That is not a claim in a document that a
 * reviewer has to check by reading handlers: `TOOL_SCOPES` in
 * `grant/scopes.ts` is the closed list of names, this table must cover it
 * exactly, and a test asserts both directions. A tool added without a scope
 * cannot be registered, and a scope without a tool fails the same test.
 *
 * Descriptions are written for the reader that actually has to act on them.
 * A model chooses a tool from its description and nothing else, so each one
 * says what the tool does, what it does not do, and what the caller must
 * have read first. The recurring "nothing in the project changed" is
 * deliberate repetition: the single most damaging failure this system can
 * produce is an assistant telling someone their drawing was updated when it
 * was not.
 *
 * The reviewed 2.0 package had twelve tools and an asymmetric surface - a
 * caller could store a brief and a design program but never read either
 * back, so an assistant that lost its context had no way to recover what it
 * had already planned and would write it again under a new identifier. The
 * read side is here, along with the withdrawal and audit tools it lacked.
 */

import type { JsonObject, JsonValue } from '../schema/json-value';
import { toJsonValue } from '../schema/json-value';
import type { ArqMcpToolName } from '../grant/scopes';
import type { GrantContext } from '../grant/grant';
import type { ArqBridge } from '../adapter/bridge-adapter';
import type { ToolOutcome } from '../service/tool-service';
import { ARQ_MCP_LIMITS } from '../domain/limits';
import { briefInput } from '../domain/brief';
import { designProgramInput } from '../domain/design-program';
import { changeSetInput } from '../domain/changeset';
import { describeProposalState, proposalNextAction } from '../domain/proposal';
import { COVERAGE_DISCLOSURE, describeCoverageState } from '../adapter/coverage';
import {
  boundedText,
  fieldName,
  opaqueId,
  profileId,
  semanticKindName,
} from '../schema/identifiers';
import {
  arrayValue,
  integerValue,
  objectValue,
  stringValue,
  type Validator,
} from '../schema/schema';
import { ARQ_MCP_TEXT_LIMITS } from '../domain/limits';

export interface ToolContext {
  readonly bridge: ArqBridge;
  readonly grant: GrantContext;
}

export interface ToolAnnotations {
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
}

export interface ToolDefinition {
  readonly name: ArqMcpToolName;
  readonly title: string;
  readonly description: string;
  readonly input: Validator<unknown>;
  readonly annotations: ToolAnnotations;
  /** Which project the call touches, for the audit entry. Absent for tools that touch none. */
  readonly projectIdOf: (input: unknown) => string | undefined;
  readonly run: (context: ToolContext, input: unknown) => ToolOutcome<JsonValue>;
}

interface ToolSpec<T> {
  readonly name: ArqMcpToolName;
  readonly title: string;
  readonly description: string;
  readonly input: Validator<T>;
  readonly annotations: ToolAnnotations;
  readonly projectIdOf?: (input: T) => string | undefined;
  readonly run: (context: ToolContext, input: T) => ToolOutcome<JsonValue>;
}

function defineTool<T>(spec: ToolSpec<T>): ToolDefinition {
  return {
    name: spec.name,
    title: spec.title,
    description: spec.description,
    input: spec.input as Validator<unknown>,
    annotations: spec.annotations,
    projectIdOf: (input) => spec.projectIdOf?.(input as T),
    run: (context, input) => spec.run(context, input as T),
  };
}

/** A read that touches no project and changes nothing. */
const READ: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

/** A request that Arq records but that changes no canonical project state. */
const REQUEST: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const emptyInput = objectValue({ required: {}, title: 'No arguments' });

const requestId = opaqueId(
  'A fresh identifier for this call. Sending the same one twice returns the first answer instead of acting twice.',
);

const limitInput = integerValue({
  minimum: 1,
  maximum: ARQ_MCP_LIMITS.maxQueryPageSize,
  description: `How many items to return. Defaults to 50, at most ${ARQ_MCP_LIMITS.maxQueryPageSize}.`,
});

const cursorInput = stringValue({
  minLength: 1,
  maxLength: 512,
  description:
    'The nextCursor from the previous page of this same query. A cursor from a different query, project or revision is refused.',
});

function pageLimit(limit: number | undefined): number {
  return limit ?? 50;
}

function pageData(page: {
  readonly items: readonly unknown[];
  readonly nextCursor?: string;
  readonly totalMatches: number;
}): JsonValue {
  return toJsonValue({
    items: page.items,
    totalMatches: page.totalMatches,
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
  });
}

export const ARQ_MCP_TOOLS: readonly ToolDefinition[] = [
  defineTool({
    name: 'arq_get_capabilities',
    title: 'What Arq can do right now',
    description:
      'Call this first, before anything else. Returns the registered domain profiles, the catalogue revision, the limits every other tool enforces, the scopes this connection actually holds, and an explicit list of things this server cannot do. Do not infer a capability from the tool list: a tool existing does not mean the current grant or the current project can use it.',
    input: emptyInput,
    annotations: READ,
    run: ({ bridge, grant }) => {
      const report = bridge.getCapabilities(grant);
      return {
        code: 'ARQ_CAPABILITIES_REPORTED',
        state: 'capabilities_reported',
        message: `Arq is reachable with ${report.profiles.filter((profile) => profile.status === 'registered').length} registered domain profile(s) and ${report.grant.projectCount} shared project(s).`,
        nextAction:
          'Read the profiles and the absent capabilities before planning. Then call arq_list_projects.',
        data: toJsonValue(report),
      };
    },
  }),

  defineTool({
    name: 'arq_list_domain_profiles',
    title: 'List domain profiles',
    description:
      'Lists every design domain Arq knows about, registered or not. A registered profile has operations that genuinely run. An unregistered profile is a specification: it names the operations such work would need and the exact blockers standing in the way. Read this before telling anyone Arq cannot do something, so the answer names the profile and the blockers rather than stopping at no.',
    input: emptyInput,
    annotations: READ,
    run: ({ bridge, grant }) => {
      const profiles = bridge.listDomainProfiles(grant);
      const registered = profiles.filter((profile) => profile.status === 'registered');
      return {
        code: 'ARQ_DOMAIN_PROFILES_LISTED',
        state: 'profiles_listed',
        message: `${registered.length} of ${profiles.length} domain profile(s) are registered and executable.`,
        nextAction:
          'Read a specific profile with arq_get_domain_profile before requesting any of its capabilities.',
        data: toJsonValue(profiles),
      };
    },
  }),

  defineTool({
    name: 'arq_get_domain_profile',
    title: 'Read one domain profile',
    description:
      'Returns one profile in full: its semantic entities, its derived outputs, every operation with its argument contract, approval class, allowed project states and undo behaviour, and the evidence backing each claim. For an unregistered profile this is the implementation backlog that would make the domain real.',
    input: objectValue({ required: { profileId: profileId() } }),
    annotations: READ,
    run: ({ bridge, grant }, input) => {
      const profile = bridge.getDomainProfile(grant, input.profileId);
      return {
        code: 'ARQ_DOMAIN_PROFILE_RETURNED',
        state: profile.status,
        message:
          profile.status === 'registered'
            ? `The ${profile.profileId} profile is registered with ${profile.operations.length} executable operation(s).`
            : `The ${profile.profileId} profile is specified but not registered. Arq cannot execute any of it, and ${profile.registrationBlockers.length} blocker(s) say why.`,
        nextAction:
          profile.status === 'registered'
            ? 'Read the argument contract of the operation you need before building a change set.'
            : 'Keep this domain at design-program level and record the blockers. Do not substitute an operation from another profile.',
        data: toJsonValue(profile),
      };
    },
  }),

  defineTool({
    name: 'arq_list_projects',
    title: 'List shared projects',
    description:
      'Lists only the projects the operator chose to share with this connection. Returns opaque identifiers and revisions, never a file path. A project that is not listed is not visible to this connection and asking for it by identifier will not reveal whether it exists.',
    input: objectValue({ required: {}, optional: { cursor: cursorInput, limit: limitInput } }),
    annotations: READ,
    run: ({ bridge, grant }, input) => {
      const page = bridge.listProjects(grant, {
        limit: pageLimit(input.limit),
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      });
      return {
        code: 'ARQ_PROJECTS_LISTED',
        state: 'projects_listed',
        message: `${page.totalMatches} project(s) are shared with this connection.`,
        nextAction:
          'Read a project with arq_get_project_snapshot and note its revision before doing anything else.',
        data: pageData(page),
      };
    },
  }),

  defineTool({
    name: 'arq_get_project_snapshot',
    title: 'Read a project’s current state',
    description:
      'Returns the project’s exact current revision, whether it can be edited at all, how many of each kind of element it holds, which derived outputs are stale, and any warnings Arq chose to expose. Every change set must be built against the revision this returns. Read it again after anything is committed.',
    input: objectValue({ required: { projectId: opaqueId() } }),
    annotations: READ,
    projectIdOf: (input) => input.projectId,
    run: ({ bridge, grant }, input) => {
      const snapshot = bridge.getProjectSnapshot(grant, input.projectId);
      return {
        code: 'ARQ_PROJECT_SNAPSHOT_RETURNED',
        state: snapshot.summary.accessState,
        message: `Project "${snapshot.summary.name}" is at revision ${snapshot.summary.revision} and is ${snapshot.summary.accessState.replace(/_/gu, ' ')}.`,
        nextAction:
          snapshot.summary.accessState === 'editable'
            ? 'Use this revision as the base for any change set. Query the model before proposing anything.'
            : 'The project cannot accept changes in this state. Ask the operator to resolve it in Arq.',
        warnings: snapshot.warnings,
        data: toJsonValue(snapshot),
      };
    },
  }),

  defineTool({
    name: 'arq_query_model',
    title: 'Query the semantic model',
    description:
      'Reads elements from a project by identifier, kind, or bounded text search, with an explicit field projection and paging. This is not a query language and it accepts no expressions. The revision you name must still be current: if the project has moved, the query is refused rather than answered from a state that no longer exists.',
    input: objectValue({
      required: { projectId: opaqueId(), snapshotRevision: opaqueId() },
      optional: {
        ids: arrayValue(opaqueId(), { maxItems: ARQ_MCP_LIMITS.maxQueryPageSize }),
        kinds: arrayValue(semanticKindName(), { maxItems: 50 }),
        text: boundedText(200, 'Case-insensitive substring match on identifiers and text fields.'),
        fields: arrayValue(fieldName(), {
          maxItems: ARQ_MCP_LIMITS.maxProjectedFields,
          description:
            'Return only these properties. Names are spelled as the Arq model spells them, for example hostWallId.',
        }),
        cursor: cursorInput,
        limit: limitInput,
      },
    }),
    annotations: READ,
    projectIdOf: (input) => input.projectId,
    run: ({ bridge, grant }, input) => {
      const result = bridge.queryModel(grant, {
        projectId: input.projectId,
        snapshotRevision: input.snapshotRevision,
        limit: pageLimit(input.limit),
        ...(input.ids === undefined ? {} : { ids: input.ids }),
        ...(input.kinds === undefined ? {} : { kinds: input.kinds }),
        ...(input.text === undefined ? {} : { text: input.text }),
        ...(input.fields === undefined ? {} : { fields: input.fields }),
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      });
      return {
        code: 'ARQ_MODEL_QUERY_RETURNED',
        state: result.truncated ? 'partial_page' : 'complete_page',
        message: `Returned ${result.items.length} of ${result.totalMatches} matching element(s) at revision ${result.snapshotRevision}.`,
        nextAction: result.truncated
          ? 'Follow nextCursor for the rest, or narrow the query. Do not draw conclusions from a partial page.'
          : 'This is the complete result for that query at that revision.',
        data: toJsonValue(result),
      };
    },
  }),

  defineTool({
    name: 'arq_get_operation_catalog',
    title: 'Read the operation catalogue',
    description:
      'Returns the exact operations that can be staged against this project: types, versions, argument schemas, approval classes, allowed project states and what each one makes stale. Never propose an operation that is not in this result, and never assume a version. The catalogue revision returned here is recorded on every proposal.',
    input: objectValue({ required: { projectId: opaqueId() } }),
    annotations: READ,
    projectIdOf: (input) => input.projectId,
    run: ({ bridge, grant }, input) => {
      const catalog = bridge.getOperationCatalog(grant, input.projectId);
      return {
        code: 'ARQ_OPERATION_CATALOG_RETURNED',
        state: 'catalog_returned',
        message: `${catalog.operations.length} operation(s) are registered at catalogue revision ${catalog.catalogRevision}.`,
        nextAction:
          'Build each operation against its own argument schema from this result, then stage them as one change set.',
        data: toJsonValue(catalog),
      };
    },
  }),

  defineTool({
    name: 'arq_save_brief',
    title: 'Store a brief',
    description:
      'Stores a non-executable brief: the objective, hard constraints, assumptions, a dependency-ordered work list with acceptance criteria, cited sources, and the questions still open. It changes nothing in any project. Write the open questions honestly: an assistant that resolves an ambiguity by guessing has made a decision that belonged to the operator.',
    input: objectValue({ required: { requestId, brief: briefInput } }),
    annotations: REQUEST,
    projectIdOf: (input) => input.brief.projectId,
    run: ({ bridge, grant }, input) => {
      const stored = bridge.saveBrief(grant, { requestId: input.requestId, brief: input.brief });
      return {
        code: 'ARQ_BRIEF_STORED',
        state: 'stored_non_executable',
        message:
          'The brief was stored as planning data. Nothing in any project was created, opened or changed.',
        nextAction:
          'Answer the open questions with the operator, then read the project and its catalogue before proposing anything.',
        warnings: stored.warnings,
        data: toJsonValue(stored),
      };
    },
  }),

  defineTool({
    name: 'arq_get_brief',
    title: 'Read a brief back',
    description:
      'Returns a stored brief with its derived dependency-safe work order and its outstanding warnings. Use this to recover context rather than rewriting a plan you already stored under a new identifier.',
    input: objectValue({ required: { briefId: opaqueId() } }),
    annotations: READ,
    run: ({ bridge, grant }, input) => {
      const stored = bridge.getBrief(grant, input.briefId);
      return {
        code: 'ARQ_BRIEF_RETURNED',
        state: 'stored_non_executable',
        message: `Brief "${stored.brief.title}" has ${stored.brief.workItems.length} work item(s).`,
        nextAction: 'Work through the items in the returned order.',
        warnings: stored.warnings,
        data: toJsonValue(stored),
      };
    },
  }),

  defineTool({
    name: 'arq_list_briefs',
    title: 'List stored briefs',
    description: 'Lists the briefs stored by this operator, optionally limited to one project.',
    input: objectValue({
      required: {},
      optional: { projectId: opaqueId(), cursor: cursorInput, limit: limitInput },
    }),
    annotations: READ,
    projectIdOf: (input) => input.projectId,
    run: ({ bridge, grant }, input) => {
      const page = bridge.listBriefs(grant, {
        limit: pageLimit(input.limit),
        ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      });
      return {
        code: 'ARQ_BRIEFS_LISTED',
        state: 'briefs_listed',
        message: `${page.totalMatches} brief(s) stored.`,
        nextAction: 'Read one with arq_get_brief.',
        data: pageData(page),
      };
    },
  }),

  defineTool({
    name: 'arq_save_design_program',
    title: 'Store a design program',
    description:
      'Stores a non-executable design program: what the thing is, as a component hierarchy with mutual interfaces, verifiable requirements, a dependency-ordered task graph, cited sources with their reuse status, and open questions. Any design domain may be described here, including ones Arq cannot build - that is the point of the layer. It creates no geometry, no project and no file. Re-saving the same identifier stores a new version rather than failing.',
    input: objectValue({ required: { requestId, designProgram: designProgramInput } }),
    annotations: REQUEST,
    projectIdOf: (input) => input.designProgram.projectId,
    run: ({ bridge, grant }, input) => {
      const stored = bridge.saveDesignProgram(grant, {
        requestId: input.requestId,
        designProgram: input.designProgram,
      });
      return {
        code: 'ARQ_DESIGN_PROGRAM_STORED',
        state: 'stored_non_executable',
        message: `Design program "${stored.designProgram.title}" was stored as version ${stored.designProgram.version}. It did not create or change a project.`,
        nextAction:
          'Call arq_assess_design_program_coverage to find out which parts Arq can actually build. Do not assume any of them.',
        warnings: stored.warnings,
        data: toJsonValue(stored),
      };
    },
  }),

  defineTool({
    name: 'arq_get_design_program',
    title: 'Read a design program back',
    description:
      'Returns a stored design program with its current version and outstanding warnings, including any reference whose reuse status is unresolved.',
    input: objectValue({ required: { designProgramId: opaqueId() } }),
    annotations: READ,
    run: ({ bridge, grant }, input) => {
      const stored = bridge.getDesignProgram(grant, input.designProgramId);
      return {
        code: 'ARQ_DESIGN_PROGRAM_RETURNED',
        state: 'stored_non_executable',
        message: `Design program "${stored.designProgram.title}" is at version ${stored.designProgram.version} with ${stored.designProgram.components.length} component(s).`,
        nextAction: 'Assess its coverage before treating any component as buildable.',
        warnings: stored.warnings,
        data: toJsonValue(stored),
      };
    },
  }),

  defineTool({
    name: 'arq_list_design_programs',
    title: 'List stored design programs',
    description:
      'Lists the design programs stored by this operator, optionally limited to one project.',
    input: objectValue({
      required: {},
      optional: { projectId: opaqueId(), cursor: cursorInput, limit: limitInput },
    }),
    annotations: READ,
    projectIdOf: (input) => input.projectId,
    run: ({ bridge, grant }, input) => {
      const page = bridge.listDesignPrograms(grant, {
        limit: pageLimit(input.limit),
        ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      });
      return {
        code: 'ARQ_DESIGN_PROGRAMS_LISTED',
        state: 'design_programs_listed',
        message: `${page.totalMatches} design program(s) stored.`,
        nextAction: 'Read one with arq_get_design_program.',
        data: pageData(page),
      };
    },
  }),

  defineTool({
    name: 'arq_assess_design_program_coverage',
    title: 'Check what Arq can actually build',
    description: `Compares the capabilities a design program asks for against the operations Arq has registered, for a named project and this connection's permissions. Every row is available, unavailable, blocked by the project's state, or unknown, with the owning profile and the exact blockers. ${COVERAGE_DISCLOSURE}`,
    input: objectValue({
      required: { designProgramId: opaqueId() },
      optional: { projectId: opaqueId() },
    }),
    annotations: READ,
    projectIdOf: (input) => input.projectId,
    run: ({ bridge, grant }, input) => {
      const coverage = bridge.assessDesignProgramCoverage(grant, {
        designProgramId: input.designProgramId,
        ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
      });
      return {
        code: 'ARQ_DESIGN_PROGRAM_COVERAGE_REPORTED',
        state: coverage.state,
        message: describeCoverageState(coverage.state),
        nextAction:
          coverage.state === 'ready_for_operation_planning'
            ? 'Read each operation’s argument contract from the catalogue, then stage one change set.'
            : 'Keep the uncovered components as a concept plan and report the blockers. Do not substitute a different operation to make something appear buildable.',
        warnings: coverage.warnings,
        data: toJsonValue(coverage),
      };
    },
  }),

  defineTool({
    name: 'arq_create_project_draft',
    title: 'Ask Arq for a new draft project',
    description:
      'Asks Arq to create an application-managed working copy. It accepts no path and writes no file: where the project eventually lives is the operator’s choice, made in Arq. The new draft is not automatically shared with this connection.',
    input: objectValue({
      required: {
        requestId,
        name: boundedText(ARQ_MCP_TEXT_LIMITS.name, 'A name for the project.'),
      },
    }),
    annotations: REQUEST,
    run: ({ bridge, grant }, input) => {
      const draft = bridge.createProjectDraft(grant, {
        requestId: input.requestId,
        name: input.name,
      });
      return {
        code: 'ARQ_PROJECT_DRAFT_CREATED',
        state: 'working_copy_created',
        message: `Arq created a working copy called "${draft.project.name}". No file was written and no destination was chosen.`,
        nextAction:
          'Ask the operator to share the draft with this connection if you need to read or change it.',
        data: toJsonValue(draft),
      };
    },
  }),

  defineTool({
    name: 'arq_request_project_open',
    title: 'Ask Arq to open a project',
    description:
      'Asks the Arq application to bring a shared project to the front. It takes an opaque project identifier and nothing else: no path, no file, no directory. It reads and changes nothing. If Arq is not running, that is what it reports.',
    input: objectValue({ required: { requestId, projectId: opaqueId() } }),
    annotations: REQUEST,
    projectIdOf: (input) => input.projectId,
    run: ({ bridge, grant }, input) => {
      const result = bridge.requestProjectOpen(grant, {
        requestId: input.requestId,
        projectId: input.projectId,
      });
      return {
        code: 'ARQ_PROJECT_OPEN_REQUESTED',
        state: result.state,
        message:
          result.state === 'project_open_requested'
            ? 'Arq was asked to open the project. No project data was read or changed.'
            : 'Arq is not available to open the project. No project data was read or changed.',
        nextAction:
          result.state === 'project_open_requested'
            ? 'Read the project snapshot to show its current state.'
            : 'Tell the operator that Arq is not running. Your plans remain separate from project data.',
        data: toJsonValue(result),
      };
    },
  }),

  defineTool({
    name: 'arq_stage_changeset',
    title: 'Stage a change set for validation',
    description:
      'Submits a revision-bound list of typed operations. Arq validates them against the real semantic model and reports what would be affected and what would go stale. Staging changes nothing: a staged proposal that passes validation is a request, not an edit. Never report a staged change as applied.',
    input: objectValue({ required: { requestId, changeSet: changeSetInput } }),
    annotations: REQUEST,
    projectIdOf: (input) => input.changeSet.projectId,
    run: ({ bridge, grant }, input) => {
      const proposal = bridge.stageChangeSet(grant, {
        requestId: input.requestId,
        changeSet: input.changeSet,
      });
      return {
        code:
          proposal.state === 'validation_failed'
            ? 'ARQ_CHANGESET_VALIDATION_FAILED'
            : 'ARQ_CHANGESET_STAGED',
        state: proposal.state,
        message: describeProposalState(proposal.state),
        nextAction: proposalNextAction(proposal.state),
        warnings: proposal.validation.warnings.map((issue) => `${issue.title}: ${issue.message}`),
        data: toJsonValue(proposal),
      };
    },
  }),

  defineTool({
    name: 'arq_get_changeset',
    title: 'Read a staged proposal',
    description:
      'Returns a proposal with its validation result, affected elements, expected invalidations, approval state and whether canonical project state changed. A proposal ages: it can become expired if nobody reviewed it, or superseded if the project moved on, and this is where you find that out.',
    input: objectValue({ required: { projectId: opaqueId(), proposalId: opaqueId() } }),
    annotations: READ,
    projectIdOf: (input) => input.projectId,
    run: ({ bridge, grant }, input) => {
      const proposal = bridge.getProposal(grant, input);
      return {
        code: 'ARQ_CHANGESET_RETURNED',
        state: proposal.state,
        message: describeProposalState(proposal.state),
        nextAction: proposalNextAction(proposal.state),
        canonicalMutation: proposal.canonicalMutation.state,
        data: toJsonValue(proposal),
      };
    },
  }),

  defineTool({
    name: 'arq_list_changesets',
    title: 'List proposals for a project',
    description:
      'Lists this project’s proposals, newest first, with their current states. Rejected, cancelled and expired proposals are shown too: they are evidence of what was considered, and they are not project history.',
    input: objectValue({
      required: { projectId: opaqueId() },
      optional: { cursor: cursorInput, limit: limitInput },
    }),
    annotations: READ,
    projectIdOf: (input) => input.projectId,
    run: ({ bridge, grant }, input) => {
      const page = bridge.listProposals(grant, {
        projectId: input.projectId,
        limit: pageLimit(input.limit),
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      });
      return {
        code: 'ARQ_CHANGESETS_LISTED',
        state: 'changesets_listed',
        message: `${page.totalMatches} proposal(s) for this project.`,
        nextAction: 'Read one with arq_get_changeset.',
        data: pageData(page),
      };
    },
  }),

  defineTool({
    name: 'arq_request_changeset_review',
    title: 'Queue a proposal for the operator',
    description:
      'Puts a validated proposal in front of the operator inside Arq. It cannot carry an approval, a confirmation, a credential or a replacement operation list. The decision, the commit and the receipt all happen in Arq, and this tool cannot observe or influence any of them. After calling it, wait: do not restage the same change and do not describe it as applied.',
    input: objectValue({ required: { requestId, projectId: opaqueId(), proposalId: opaqueId() } }),
    annotations: REQUEST,
    projectIdOf: (input) => input.projectId,
    run: ({ bridge, grant }, input) => {
      const proposal = bridge.requestProposalReview(grant, input);
      return {
        code: 'ARQ_CHANGESET_REVIEW_REQUESTED',
        state: proposal.state,
        message: describeProposalState(proposal.state),
        nextAction: proposalNextAction(proposal.state),
        data: toJsonValue(proposal),
      };
    },
  }),

  defineTool({
    name: 'arq_cancel_changeset',
    title: 'Withdraw a proposal',
    description:
      'Withdraws a proposal that has not yet been decided, so it stops occupying the operator’s review queue. This removes a request; it never changes a project and never reverses anything Arq already applied. Use it as soon as you know a proposal is wrong, rather than staging a second one beside it.',
    input: objectValue({
      required: { requestId, projectId: opaqueId(), proposalId: opaqueId() },
      optional: {
        reason: boundedText(
          ARQ_MCP_TEXT_LIMITS.reason,
          'Why it is being withdrawn, for the history.',
        ),
      },
    }),
    annotations: REQUEST,
    projectIdOf: (input) => input.projectId,
    run: ({ bridge, grant }, input) => {
      const proposal = bridge.cancelProposal(grant, input);
      return {
        code: 'ARQ_CHANGESET_CANCELLED',
        state: proposal.state,
        message: describeProposalState(proposal.state),
        nextAction: proposalNextAction(proposal.state),
        data: toJsonValue(proposal),
      };
    },
  }),

  defineTool({
    name: 'arq_request_undo',
    title: 'Ask Arq to review an undo',
    description:
      'Asks the operator to review undoing one committed group of operations, and reports what that group touched. It does not perform the undo. If later work sits on top of the group, the request is refused and says so rather than quietly discarding that work.',
    input: objectValue({
      required: { requestId, projectId: opaqueId(), undoGroupId: opaqueId() },
      optional: { reason: boundedText(ARQ_MCP_TEXT_LIMITS.reason) },
    }),
    annotations: REQUEST,
    projectIdOf: (input) => input.projectId,
    run: ({ bridge, grant }, input) => {
      const request = bridge.requestUndo(grant, input);
      return {
        code: 'ARQ_UNDO_REVIEW_REQUESTED',
        state: request.state,
        message: `The undo is waiting for a decision in Arq. It would affect ${request.affectedElementIds.length} element(s) from ${request.operationCount} operation(s). Nothing in the project has changed.`,
        nextAction: 'Wait for the operator to decide in Arq. Do not describe the undo as done.',
        data: toJsonValue(request),
      };
    },
  }),

  defineTool({
    name: 'arq_request_publish',
    title: 'Ask Arq to publish a checkpoint',
    description:
      'Asks Arq to write a clean project file at an exact revision. The operator chooses the destination in Arq. This tool accepts no path, writes no file, and cannot tell you where the file went.',
    input: objectValue({ required: { requestId, projectId: opaqueId(), revision: opaqueId() } }),
    annotations: REQUEST,
    projectIdOf: (input) => input.projectId,
    run: ({ bridge, grant }, input) => {
      const request = bridge.requestPublish(grant, input);
      return {
        code: 'ARQ_PUBLISH_REVIEW_REQUESTED',
        state: request.state,
        message:
          'Publishing is waiting for the operator to choose a destination in Arq. No file was written by this tool.',
        nextAction: 'Wait for the operator. Do not state that a file exists or where it is.',
        data: toJsonValue(request),
      };
    },
  }),

  defineTool({
    name: 'arq_get_audit_trail',
    title: 'Read this connection’s audit trail',
    description:
      'Returns what this connection asked for and what it was told, newest first. Each entry holds a fingerprint of the request rather than its content, so the trail can prove what happened without becoming a second copy of every plan.',
    input: objectValue({
      required: {},
      optional: {
        limit: integerValue({ minimum: 1, maximum: ARQ_MCP_LIMITS.maxAuditPageSize }),
      },
    }),
    annotations: READ,
    run: ({ bridge, grant }, input) => {
      const trail = bridge.getAuditTrail(grant, input.limit ?? 50);
      return {
        code: 'ARQ_AUDIT_TRAIL_RETURNED',
        state: 'audit_returned',
        message: `${trail.events.length} audit entr${trail.events.length === 1 ? 'y' : 'ies'} for this connection.`,
        nextAction: 'Nothing further. This is a read of your own activity.',
        data: toJsonValue(trail),
      };
    },
  }),
];

export function toolByName(name: string): ToolDefinition | undefined {
  return ARQ_MCP_TOOLS.find((tool) => tool.name === name);
}

/** The `tools/list` payload: name, title, description, input schema and behavioural hints. */
export function describeToolsForList(): readonly JsonObject[] {
  return ARQ_MCP_TOOLS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.input.jsonSchema,
    annotations: {
      title: tool.title,
      readOnlyHint: tool.annotations.readOnlyHint,
      destructiveHint: tool.annotations.destructiveHint,
      idempotentHint: tool.annotations.idempotentHint,
      openWorldHint: tool.annotations.openWorldHint,
    },
  }));
}
