/**
 * The service layer: one place where a bridge call becomes a tool result.
 *
 * Everything that must happen on every call happens here exactly once - a
 * trace identifier, the envelope, the audit entry, the response budget, and
 * the conversion of an unexpected fault into a non-disclosing failure. The
 * reviewed 2.0 package had the same idea and stopped at the envelope: it
 * had no audit, no size ceiling, and its success-describing callback ran
 * inside the try block, so a bug in the code that phrased a successful
 * result was reported to the caller as an internal server error on a call
 * that had actually succeeded.
 *
 * Here the work runs first and the description is built afterwards, so
 * those two failures cannot be confused. And the audit entry is written on
 * every path - success, refusal and fault alike - because a log that only
 * records what worked is not an audit trail.
 */

import type { AuditTrail } from '../audit/audit-trail';
import type { GrantContext } from '../grant/grant';
import type { ArqMcpToolName } from '../grant/scopes';
import type { JsonValue } from '../schema/json-value';
import { toJsonValue } from '../schema/json-value';
import { contentDigest } from '../util/hash';
import {
  type CanonicalMutationState,
  type ToolEnvelope,
  enforceResponseBudget,
  errorEnvelope,
  successEnvelope,
} from '../domain/envelope';
import { internalFailure, isArqMcpError } from '../domain/errors';

export interface ToolOutcome<T> {
  readonly code: string;
  readonly state: string;
  readonly message: string;
  readonly nextAction: string;
  readonly canonicalMutation?: CanonicalMutationState;
  readonly warnings?: readonly string[];
  readonly data?: T;
}

export interface RunToolInput<T> {
  readonly tool: ArqMcpToolName;
  readonly grant: GrantContext;
  /** The validated arguments. Only their digest is recorded; the values never reach the audit trail. */
  readonly request: JsonValue;
  readonly projectId?: string;
  readonly work: () => T;
  readonly describe: (value: T) => ToolOutcome<JsonValue>;
}

export interface ToolService {
  run<T>(input: RunToolInput<T>): ToolEnvelope;
}

export interface ToolServiceOptions {
  readonly audit: AuditTrail;
  readonly nextTraceId: () => string;
  /** Where an unexpected fault is reported. Defaults to standard error, which for a stdio server is the only stream that is not the protocol. */
  readonly reportFault?: (error: unknown, traceId: string) => void;
}

export function createToolService(options: ToolServiceOptions): ToolService {
  const reportFault =
    options.reportFault ??
    ((error, traceId) => {
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
      process.stderr.write(`[arq-mcp] ${traceId} ${detail}\n`);
    });

  return {
    run<T>(input: RunToolInput<T>): ToolEnvelope {
      const traceId = options.nextTraceId();
      const requestFingerprint = contentDigest(input.request);

      let envelope: ToolEnvelope;
      let outcomeKind: 'ok' | 'denied' | 'error';
      let canonicalMutation: CanonicalMutationState = 'none';
      let code: string;

      try {
        const value = input.work();
        const outcome = input.describe(value);
        canonicalMutation = outcome.canonicalMutation ?? 'none';
        code = outcome.code;
        outcomeKind = 'ok';
        envelope = successEnvelope({
          code: outcome.code,
          state: outcome.state,
          message: outcome.message,
          nextAction: outcome.nextAction,
          traceId,
          canonicalMutation,
          ...(outcome.warnings === undefined ? {} : { warnings: outcome.warnings }),
          ...(outcome.data === undefined ? {} : { data: toJsonValue(outcome.data) }),
        });
      } catch (error) {
        if (isArqMcpError(error)) {
          code = error.code;
          outcomeKind = 'denied';
          envelope = errorEnvelope(error, traceId);
        } else {
          // An unexpected fault says nothing about itself to the caller. The
          // detail goes to standard error, where an operator can find it by
          // trace identifier.
          reportFault(error, traceId);
          code = 'ARQ_INTERNAL_ERROR';
          outcomeKind = 'error';
          envelope = errorEnvelope(internalFailure(), traceId);
        }
      }

      const budgeted = enforceResponseBudget(envelope);
      if (budgeted !== envelope) {
        code = budgeted.code;
        outcomeKind = 'denied';
        canonicalMutation = budgeted.canonicalMutation;
      }

      options.audit.record({
        traceId,
        grant: input.grant,
        tool: input.tool,
        outcome: outcomeKind,
        code,
        canonicalMutation,
        requestFingerprint,
        ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
      });

      return budgeted;
    },
  };
}
