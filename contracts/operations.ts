import type { ElementId, ProjectId } from './model';
export interface OperationPrecondition {
  readonly kind: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
export interface ModelOperation<T = Readonly<Record<string, unknown>>> {
  readonly id: string;
  readonly type: string;
  readonly actorId: string;
  readonly projectId: ProjectId;
  readonly baseRevision: number;
  readonly timestamp: string;
  readonly payload: T;
  readonly preconditions: readonly OperationPrecondition[];
}
export interface ValidationMessage {
  readonly id: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly code: string;
  readonly title: string;
  readonly explanation: string;
  readonly affectedElementIds: readonly ElementId[];
  readonly suggestedActions: readonly string[];
  readonly technicalDetails?: string;
}
export interface OperationResult<T = unknown> {
  readonly status: 'applied' | 'rejected';
  readonly result?: T;
  readonly affectedElementIds: readonly ElementId[];
  readonly invalidations: readonly string[];
  readonly validationMessages: readonly ValidationMessage[];
  readonly inverse?: ModelOperation;
  readonly durationMs: number;
}
