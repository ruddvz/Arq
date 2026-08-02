/**
 * The permission vocabulary, and the fixed map from tool to required scope.
 *
 * The map is data, not a check scattered through the tool handlers, for
 * two reasons. A test can assert the whole surface at once - that no tool
 * is unguarded, that no read tool asks for a write scope, that the
 * scopes a preset grants are exactly the tools it enables. And a reviewer
 * can read the entire authorization model on one screen instead of
 * reconstructing it from twenty call sites.
 *
 * The scopes are deliberately finer than "read" and "write". An operator
 * who wants an assistant to read a project and draft plans, but never to
 * queue a change for review, can express that. A single write scope would
 * force the choice to be all or nothing, and the safe answer to an
 * all-or-nothing choice is always nothing.
 */

export const ARQ_MCP_SCOPES = [
  /** Read the server's own capability report. Every grant has it; it discloses nothing about any project. */
  'arq.capabilities.read',
  /** List the projects this grant covers and read their snapshots. */
  'arq.projects.read',
  /** Run bounded semantic queries against a granted project. */
  'arq.model.read',
  /** Read domain profiles and the operation catalogue. */
  'arq.catalog.read',
  /** Read briefs and design programs stored under this grant. */
  'arq.plans.read',
  /** Store briefs and design programs. Never changes a project. */
  'arq.plans.write',
  /** Stage and validate a typed change set. Never commits. */
  'arq.changes.stage',
  /** Queue a validated proposal for the operator's review in Arq. */
  'arq.changes.review_request',
  /** Ask Arq to focus a granted project. Never opens a path. */
  'arq.project.open_request',
  /** Ask Arq to create an application-managed working copy. Never writes a native file. */
  'arq.project.draft_create',
  /** Ask Arq to publish a checkpoint to a destination the operator chooses. */
  'arq.publish.request',
  /** Ask Arq to review a grouped undo. Never performs one. */
  'arq.undo.request',
  /** Read this grant's own audit trail. */
  'arq.audit.read',
] as const;

export type ArqMcpScope = (typeof ARQ_MCP_SCOPES)[number];

/**
 * There is no scope for committing, approving, opening a path, or running
 * a query language, because there is no tool that does any of those. A
 * scope that names a capability the surface does not have would be a
 * promise the next version has to keep.
 */
export const ARQ_MCP_ABSENT_CAPABILITIES = [
  'canonical.commit',
  'proposal.approve',
  'filesystem.path_open',
  'database.raw_query',
  'native_file.write',
] as const;

/** The presets an Arq grant dialogue offers, from least to most capable. Each is a superset of the one before it. */
export const GRANT_PRESETS = {
  read_only: [
    'arq.capabilities.read',
    'arq.projects.read',
    'arq.model.read',
    'arq.catalog.read',
    'arq.plans.read',
    'arq.audit.read',
  ],
  plan: [
    'arq.capabilities.read',
    'arq.projects.read',
    'arq.model.read',
    'arq.catalog.read',
    'arq.plans.read',
    'arq.plans.write',
    'arq.project.open_request',
    'arq.audit.read',
  ],
  propose: [
    'arq.capabilities.read',
    'arq.projects.read',
    'arq.model.read',
    'arq.catalog.read',
    'arq.plans.read',
    'arq.plans.write',
    'arq.project.open_request',
    'arq.project.draft_create',
    'arq.changes.stage',
    'arq.changes.review_request',
    'arq.undo.request',
    'arq.publish.request',
    'arq.audit.read',
  ],
} as const satisfies Readonly<Record<string, readonly ArqMcpScope[]>>;

export type GrantPreset = keyof typeof GRANT_PRESETS;

/** Every tool this server exposes, mapped to the one scope it needs. A tool absent from this map cannot be registered. */
export const TOOL_SCOPES = {
  arq_get_capabilities: 'arq.capabilities.read',
  arq_list_domain_profiles: 'arq.catalog.read',
  arq_get_domain_profile: 'arq.catalog.read',
  arq_list_projects: 'arq.projects.read',
  arq_get_project_snapshot: 'arq.projects.read',
  arq_query_model: 'arq.model.read',
  arq_get_operation_catalog: 'arq.catalog.read',
  arq_save_brief: 'arq.plans.write',
  arq_get_brief: 'arq.plans.read',
  arq_list_briefs: 'arq.plans.read',
  arq_save_design_program: 'arq.plans.write',
  arq_get_design_program: 'arq.plans.read',
  arq_list_design_programs: 'arq.plans.read',
  arq_assess_design_program_coverage: 'arq.catalog.read',
  arq_create_project_draft: 'arq.project.draft_create',
  arq_request_project_open: 'arq.project.open_request',
  arq_stage_changeset: 'arq.changes.stage',
  arq_get_changeset: 'arq.plans.read',
  arq_list_changesets: 'arq.plans.read',
  arq_request_changeset_review: 'arq.changes.review_request',
  arq_cancel_changeset: 'arq.changes.stage',
  arq_request_undo: 'arq.undo.request',
  arq_request_publish: 'arq.publish.request',
  arq_get_audit_trail: 'arq.audit.read',
} as const satisfies Readonly<Record<string, ArqMcpScope>>;

export type ArqMcpToolName = keyof typeof TOOL_SCOPES;

export function toolScope(tool: ArqMcpToolName): ArqMcpScope {
  return TOOL_SCOPES[tool];
}

export function isArqMcpScope(value: string): value is ArqMcpScope {
  return (ARQ_MCP_SCOPES as readonly string[]).includes(value);
}
