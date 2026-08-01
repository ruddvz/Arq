/**
 * @arq/mcp-server: the governed boundary between an AI client and an Arq
 * project.
 *
 * What is exported is what the Arq application needs to run a server and
 * what a test needs to drive one. What is deliberately not exported from
 * anywhere in this package is a way to commit, approve, open a path or
 * write a file - those live on `ArqOperatorSurface`, which the application
 * holds and this server is never given.
 */

export {
  createArqMcpRuntime,
  type ArqMcpRuntime,
  type ArqMcpRuntimeOptions,
} from './runtime/create-runtime';
export {
  createControlledClock,
  createSequentialIdSource,
  isoTimestamp,
  systemClock,
  type Clock,
  type ControlledClock,
  type IdSource,
} from './runtime/clock';

export { ArqBridge, type ArqBridgeOptions, type CapabilityReport } from './adapter/bridge-adapter';
export {
  COVERAGE_DISCLOSURE,
  assessCoverage,
  describeCoverageState,
  type CoverageItem,
  type CoverageReport,
  type CoverageState,
  type CoverageStatus,
} from './adapter/coverage';

export {
  createGrant,
  describeGrant,
  grantState,
  revokeGrant,
  type CreateGrantInput,
  type GrantContext,
} from './grant/grant';
export {
  ARQ_MCP_ABSENT_CAPABILITIES,
  ARQ_MCP_SCOPES,
  GRANT_PRESETS,
  TOOL_SCOPES,
  type ArqMcpScope,
  type ArqMcpToolName,
  type GrantPreset,
} from './grant/scopes';

export {
  createAuditTrail,
  type AuditEvent,
  type AuditOutcome,
  type AuditTrail,
} from './audit/audit-trail';

export {
  createMemoryArqHost,
  SEMANTIC_KINDS,
  type MemoryHostBundle,
  type MemoryHostOptions,
} from './host/memory-project-host';
export type {
  ArqOperatorSurface,
  ArqProjectHost,
  HostApplyResult,
  HostOperation,
  HostPrecondition,
  HostProjectSnapshot,
  HostProjectSummary,
  HostQuery,
  HostQueryResult,
  HostSemanticItem,
  HostUndoGroup,
  HostValidationResult,
} from './host/project-host';

export {
  ARCHITECTURE_PROFILE,
  ARCHITECTURE_OPERATIONS,
  ARCHITECTURE_PROFILE_ID,
} from './profile/architecture-profile';
export {
  ARQSCRIPT_OPERATION_TYPES,
  ARCHITECTURE_DEFAULTS,
} from './profile/architecture-operations';
export { DECLARED_PROFILES, VEHICLE_CONCEPT_PROFILE } from './profile/declared-profiles';
export {
  createDefaultDomainProfileRegistry,
  createDomainProfileRegistry,
  DomainProfileConfigurationError,
  type DomainProfileRegistry,
  type MissingCapabilityExplanation,
} from './profile/profile-registry';
export {
  validateDomainProfile,
  type ApprovalClass,
  type DomainProfile,
  type EvidenceRecord,
  type EvidenceState,
  type OperationDefinition,
  type ProfileStatus,
  type ProjectAccessState,
  type UndoBehaviour,
} from './profile/domain-profile';

export { briefInput, type Brief, type BriefInput } from './domain/brief';
export {
  designProgramInput,
  type DesignProgram,
  type DesignProgramInput,
  type ExecutionIntent,
} from './domain/design-program';
export { changeSetInput, type ChangeSet, type ChangeSetInput } from './domain/changeset';
export {
  PROPOSAL_STATES,
  canCancel,
  canTransition,
  canonicalMutationFor,
  describeProposalState,
  isTerminal,
  proposalNextAction,
  type Proposal,
  type ProposalState,
} from './domain/proposal';
export { ARQ_MCP_LIMITS, ARQ_MCP_TEXT_LIMITS, PROPOSAL_LIFETIME_MS } from './domain/limits';
export { ArqMcpError, isArqMcpError, type RetryGuidance } from './domain/errors';
export {
  MAX_TOOL_RESULT_BYTES,
  type CanonicalMutationState,
  type ToolEnvelope,
} from './domain/envelope';
export {
  MODEL_ASSERTABLE_RIGHTS_STATUSES,
  type PlanReference,
  type Provenance,
  type RightsStatus,
} from './domain/plan-common';

export { ARQ_MCP_TOOLS, describeToolsForList, toolByName } from './mcp/tools';
export { ARQ_MCP_RESOURCES, describeResourcesForList } from './mcp/resources';
export { ARQ_MCP_PROMPTS, describePromptsForList } from './mcp/prompts';
export { SERVER_INSTRUCTIONS } from './mcp/instructions';
export { SERVER_INFO, createArqMcpServer, type ArqMcpServer } from './mcp/server';
export {
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  negotiateProtocolVersion,
  parseMessage,
  type ClientIdentity,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type ProtocolVersion,
} from './mcp/protocol';

export {
  MAX_MESSAGE_BYTES,
  createLineReader,
  handleLine,
  serveStdio,
  type StdioTransport,
} from './transport/stdio';
export {
  MAX_HTTP_BODY_BYTES,
  MCP_ENDPOINT_PATH,
  checkHttpRequest,
  type HttpGuardOptions,
  type HttpGuardVerdict,
  type HttpRequestFacts,
} from './transport/http-guard';

export {
  ASSISTANT_ACTIONS,
  ASSISTANT_TABS,
  COVERAGE_VIEW_DISCLOSURE,
  actionAvailability,
  contextHeader,
  emptyStateText,
  impactSummary,
  persistenceStatement,
  visibleTabs,
  type ActionAvailability,
  type AssistantAction,
  type AssistantTab,
  type ReviewCentreContext,
} from './review/review-centre';

export {
  canonicalByteLength,
  canonicalJson,
  isJsonValue,
  type JsonObject,
  type JsonValue,
} from './schema/json-value';
export { checkReferenceUri, type ReferenceUriCheck } from './schema/reference-uri';
export type { SchemaIssue, SchemaResult, Validator } from './schema/schema';
