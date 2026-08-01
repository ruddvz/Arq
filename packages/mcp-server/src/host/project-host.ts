/**
 * The application bridge: what Arq must provide, and nothing more.
 *
 * The reviewed 2.0 package's integration plan asked for exactly this
 * boundary - "the MCP service should depend inward on a narrow application
 * bridge; the core should not depend on any MCP SDK" - and then defined its
 * adapter interface in terms of MCP concepts (briefs, proposals, coverage),
 * so the only implementation it could have was a mock that reimplemented
 * the whole product in fixtures.
 *
 * `ArqProjectHost` is the inward-facing half. It knows about projects,
 * revisions, semantic items and typed operations. It knows nothing about
 * MCP, briefs, design programs, grants or proposals: those live one layer
 * out, in the adapter, which is what lets the same host serve the in-process
 * implementation here and, later, the running Arq application.
 *
 * The split that matters most is between `validate` and `apply`.
 * `validate` is on this interface and is called by the MCP adapter.
 * `apply` is not: it lives on `ArqOperatorSurface`, which the MCP server is
 * never given. 2.0 put its commit path on the same adapter object the tool
 * layer held, as `approveAndCommitForTest`, which meant the "no commit
 * tool" guarantee rested on nobody calling a public method. Here the
 * guarantee is that the object with the commit method is not in scope.
 */

import type { ValidationMessage } from '@arq/operations';
import type { JsonValue } from '../schema/json-value';
import type { ProjectAccessState } from '../profile/domain-profile';

export interface HostProjectSummary {
  readonly projectId: string;
  readonly name: string;
  readonly revision: string;
  readonly accessState: ProjectAccessState;
  /** Arq owns the working copy. There is no path and no caller-chosen location. */
  readonly workingCopyState: 'application_managed';
  readonly publishedFileState: 'not_published' | 'published';
}

export interface HostSemanticItem {
  readonly id: string;
  readonly kind: string;
  /** Incremented whenever this item changes, so `element.version_equals` means something. */
  readonly version: number;
  readonly data: Readonly<Record<string, JsonValue>>;
}

export interface HostProjectSnapshot {
  readonly summary: HostProjectSummary;
  readonly semanticCounts: Readonly<Record<string, number>>;
  readonly staleOutputs: readonly string[];
  readonly warnings: readonly string[];
}

export interface HostQuery {
  readonly projectId: string;
  readonly snapshotRevision: string;
  readonly ids?: readonly string[];
  readonly kinds?: readonly string[];
  readonly text?: string;
  readonly fields?: readonly string[];
  readonly offset: number;
  readonly limit: number;
}

export interface HostQueryResult {
  readonly snapshotRevision: string;
  readonly items: readonly HostSemanticItem[];
  readonly totalMatches: number;
}

export interface HostOperation {
  readonly operationId: string;
  readonly operationType: string;
  readonly operationVersion: string;
  readonly arguments: Readonly<Record<string, JsonValue>>;
  readonly preconditions: readonly HostPrecondition[];
}

export type HostPrecondition =
  | { readonly kind: 'project.revision_equals'; readonly revision: string }
  | { readonly kind: 'element.exists'; readonly elementId: string }
  | { readonly kind: 'element.absent'; readonly elementId: string }
  | {
      readonly kind: 'element.version_equals';
      readonly elementId: string;
      readonly version: number;
    };

export interface HostValidationResult {
  readonly status: 'passed' | 'failed';
  /** Arq's own validation messages, in the shape @arq/operations already defines. Not a second error vocabulary. */
  readonly messages: readonly ValidationMessage[];
  readonly affectedElementIds: readonly string[];
  readonly expectedInvalidations: readonly string[];
  readonly availablePreviews: readonly string[];
  /** Which operation, if any, made the batch fail. Absent when the batch passed. */
  readonly failedOperationId?: string;
}

export interface HostApplyResult {
  readonly status: 'applied' | 'rejected';
  readonly revisionBefore: string;
  readonly revisionAfter?: string;
  readonly undoGroupId?: string;
  readonly messages: readonly ValidationMessage[];
  readonly affectedElementIds: readonly string[];
}

export interface HostUndoGroup {
  readonly undoGroupId: string;
  readonly projectId: string;
  readonly revisionBefore: string;
  readonly revisionAfter: string;
  readonly affectedElementIds: readonly string[];
  readonly operationCount: number;
  /** True when the project has moved on since, so undoing needs Arq to reconcile downstream effects first. */
  readonly hasDownstreamChanges: boolean;
}

/** The read and validate half. This is the only object the MCP adapter holds. */
export interface ArqProjectHost {
  listProjectIds(): readonly string[];
  getSummary(projectId: string): HostProjectSummary | undefined;
  getSnapshot(projectId: string): HostProjectSnapshot | undefined;
  query(query: HostQuery): HostQueryResult | undefined;
  /** Deterministic, side-effect free, and run against the exact revision the caller named. */
  validate(
    projectId: string,
    baseRevision: string,
    operations: readonly HostOperation[],
  ): HostValidationResult;
  createDraft(projectId: string, name: string): HostProjectSummary;
  /** Asks the running application to focus a project. Never opens a path, and reports honestly when no application is listening. */
  requestOpen(projectId: string): 'project_open_requested' | 'runtime_unavailable';
  getUndoGroup(projectId: string, undoGroupId: string): HostUndoGroup | undefined;
}

/**
 * The commit half, held only by the Arq application.
 *
 * Everything here is an action a person took in Arq: approving a proposal,
 * applying it, undoing a group, publishing a checkpoint. No MCP tool maps
 * to any of these, and the MCP server is never constructed with this
 * object, which is why the tool surface cannot reach them by any path.
 */
export interface ArqOperatorSurface {
  /** Applies a validated batch atomically. Either every operation lands or none does and the revision is unchanged. */
  apply(
    projectId: string,
    baseRevision: string,
    operations: readonly HostOperation[],
    actorId: string,
  ): HostApplyResult;
  undo(projectId: string, undoGroupId: string): HostApplyResult;
  setAccessState(projectId: string, accessState: ProjectAccessState): void;
  markPublished(projectId: string): void;
}
