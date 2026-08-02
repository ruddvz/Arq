/**
 * Every bound in one place, so the advertised limit and the enforced limit
 * are the same number.
 *
 * The reviewed 2.0 package declared `limits.maxBriefWorkItems: 200` in its
 * capability report and, separately, `.max(200)` in its brief schema. Two
 * literals for one rule drift the first time either is tuned, and the
 * failure is silent in the worse direction: a client that trusts the
 * advertised ceiling builds a payload the schema then rejects, or the
 * schema quietly accepts more than the report promised. It also advertised
 * no ceiling at all for design programs, which are the largest payload the
 * surface accepts.
 *
 * These constants are consumed by the schemas, by the capability report and
 * by the tests that assert the two agree.
 */

export const ARQ_MCP_LIMITS = {
  /** Work items in one brief. */
  maxBriefWorkItems: 200,
  /** Components in one design program. A complex object plan is the largest payload this surface accepts. */
  maxDesignProgramComponents: 500,
  maxDesignProgramRequirements: 500,
  maxDesignProgramTasks: 500,
  /** References in one brief or design program. Each carries provenance and a rights decision. */
  maxReferences: 200,
  /** Operations in one change set. */
  maxChangeSetOperations: 500,
  /** Items in one page of a model query or list. */
  maxQueryPageSize: 200,
  /** Fields a query may project. */
  maxProjectedFields: 50,
  /** Requested capabilities on one component or task. */
  maxRequestedCapabilities: 50,
  /** Dependencies one work item or task may declare. */
  maxDependencies: 50,
  /** Acceptance criteria on one work item or task. */
  maxAcceptanceCriteria: 50,
  /** Constraints, assumptions or open questions on one plan. */
  maxPlanStatements: 100,
  /** Preconditions on one proposed operation. */
  maxPreconditions: 50,
  /** Properties in one operation's arguments object. */
  maxOperationArgumentProperties: 200,
  /** Audit events one read may return. */
  maxAuditPageSize: 200,
  /**
   * Binary content is never inlined. A model must not be able to move an
   * image, a PDF or a project file through this boundary as a base64
   * string; assets are Arq-owned resources named by an `arq://` reference.
   */
  inlineBinaryAllowed: false,
} as const;

export type ArqMcpLimits = typeof ARQ_MCP_LIMITS;

/** Free-text ceilings, kept beside the count ceilings for the same reason. */
export const ARQ_MCP_TEXT_LIMITS = {
  title: 200,
  objective: 4000,
  statement: 1000,
  outcome: 2000,
  note: 2000,
  label: 300,
  name: 200,
  reason: 1000,
} as const;

/**
 * How long a staged proposal stays reviewable.
 *
 * 2.0 declared `expired` in its proposal state machine and never produced
 * it: nothing measured age, so a proposal staged against a long-gone
 * revision stayed `awaiting_user_approval` for the life of the process. An
 * expiry that exists only in a type is worse than none, because reviewers
 * read the type.
 */
export const PROPOSAL_LIFETIME_MS = 30 * 60 * 1000;

/** How long an idempotency record is honoured. Beyond this a repeated request id is a fresh request, not a replay. */
export const IDEMPOTENCY_LIFETIME_MS = 60 * 60 * 1000;

/** The most idempotency records held per grant, so a long-lived process cannot be grown without bound by unique request ids. */
export const MAX_IDEMPOTENCY_RECORDS = 1000;

/** The most proposals held per project. Oldest terminal proposals are evicted first; a live proposal is never evicted. */
export const MAX_PROPOSALS_PER_PROJECT = 200;
