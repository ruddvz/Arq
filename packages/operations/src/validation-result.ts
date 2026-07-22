/**
 * ARQ-066: define validation result contract.
 *
 * Mirrors contracts/operations.ts's existing ValidationMessage shape
 * (same duplication rationale as bim-core's ids.ts/level.ts - contracts/
 * isn't wired up as an importable workspace package yet), used by
 * OperationResult (operation.ts, ARQ-065) to report problems an applied
 * or rejected operation surfaced - independent of whether the operation
 * itself succeeded (an 'applied' result can still carry warning-level
 * validation messages, e.g. a wall that joined but now overlaps another).
 */

import type { ElementId } from '@arq/bim-core';

export type ValidationSeverity = 'info' | 'warning' | 'error';

export interface ValidationMessage {
  readonly id: string;
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly title: string;
  readonly explanation: string;
  readonly affectedElementIds: readonly ElementId[];
  readonly suggestedActions: readonly string[];
  readonly technicalDetails?: string;
}

export function hasSeverity(
  messages: readonly ValidationMessage[],
  severity: ValidationSeverity,
): boolean {
  return messages.some((message) => message.severity === severity);
}

export function hasErrors(messages: readonly ValidationMessage[]): boolean {
  return hasSeverity(messages, 'error');
}

export function filterBySeverity(
  messages: readonly ValidationMessage[],
  severity: ValidationSeverity,
): readonly ValidationMessage[] {
  return messages.filter((message) => message.severity === severity);
}
