/**
 * The envelope every tool result is wrapped in.
 *
 * `canonicalMutation` is required on every single response, successful or
 * not. That is the one structural change in this package aimed squarely at
 * the failure mode the whole design exists to prevent: an assistant
 * reporting that it saved, created or changed a project when it only
 * stored a plan. In the reviewed 2.0 package the field appeared inside
 * some `data` payloads and not others, so a client had to know which
 * payload type carried it before it could tell whether anything happened.
 * Hoisting it to the envelope means the answer is in a fixed place on
 * every result, including errors, where it is always `none`.
 *
 * `nextAction` is likewise always present. A tool result that reports a
 * blocked capability without saying what to do next is how a model ends up
 * inventing an operation.
 *
 * The byte ceiling is enforced here rather than left to the transport.
 * 2.0 bounded item counts (200 items, 5000 affected ids) but never the
 * serialised size, so a page of 200 wide semantic items could still
 * produce a result larger than a client will accept - and the failure
 * would surface as a truncated or dropped message rather than as a
 * request to narrow the query.
 */

import type { JsonObject, JsonValue } from '../schema/json-value';
import { canonicalByteLength } from '../schema/json-value';
import { type ArqMcpError, type RetryGuidance, resultTooLarge } from './errors';

/**
 * Whether canonical project state changed as a result of this call.
 *
 * `committed_by_arq` can only ever be reported, never caused, by a tool in
 * this package: the value appears when a caller reads back a proposal that
 * the Arq application itself committed after its own review.
 */
export type CanonicalMutationState = 'none' | 'committed_by_arq';

export interface ToolEnvelope<T extends JsonValue = JsonValue> {
  readonly ok: boolean;
  readonly code: string;
  readonly state: string;
  readonly message: string;
  readonly canonicalMutation: CanonicalMutationState;
  readonly nextAction: string;
  readonly retry: RetryGuidance;
  readonly warnings: readonly string[];
  readonly traceId: string;
  readonly data?: T;
}

/**
 * 256 KiB of canonical JSON per tool result.
 *
 * Large enough for a full design program with 500 components and a
 * 200-item model page; small enough that a client is never handed a
 * multi-megabyte structuredContent it will silently drop.
 */
export const MAX_TOOL_RESULT_BYTES = 262_144;

export interface SuccessEnvelopeInit<T extends JsonValue> {
  readonly code: string;
  readonly state: string;
  readonly message: string;
  readonly nextAction: string;
  readonly traceId: string;
  readonly canonicalMutation?: CanonicalMutationState;
  readonly warnings?: readonly string[];
  readonly data?: T;
}

export function successEnvelope<T extends JsonValue>(
  init: SuccessEnvelopeInit<T>,
): ToolEnvelope<T> {
  const envelope: ToolEnvelope<T> = {
    ok: true,
    code: init.code,
    state: init.state,
    message: init.message,
    canonicalMutation: init.canonicalMutation ?? 'none',
    nextAction: init.nextAction,
    retry: 'never',
    warnings: init.warnings ?? [],
    traceId: init.traceId,
    ...(init.data === undefined ? {} : { data: init.data }),
  };
  return envelope;
}

export function errorEnvelope(error: ArqMcpError, traceId: string): ToolEnvelope<never> {
  return {
    ok: false,
    code: error.code,
    state: error.state,
    message: error.message,
    // An error never changed canonical state. Stating it rather than
    // omitting it removes the reading where "the field is missing, so
    // perhaps something happened".
    canonicalMutation: 'none',
    nextAction: error.nextAction,
    retry: error.retry,
    warnings: error.warnings,
    traceId,
  };
}

/**
 * Enforces the response ceiling, returning either the original envelope or
 * a replacement that explains how to ask for less.
 *
 * The oversized payload is discarded rather than truncated: a half-serialised
 * design program or a partial element list read as complete is worse than a
 * refusal, because nothing in the shortened value says it was cut.
 */
export function enforceResponseBudget<T extends JsonValue>(
  envelope: ToolEnvelope<T>,
  limit = MAX_TOOL_RESULT_BYTES,
): ToolEnvelope<T> | ToolEnvelope<never> {
  const bytes = canonicalByteLength(toJsonObject(envelope));
  if (bytes <= limit) {
    return envelope;
  }
  return errorEnvelope(resultTooLarge(bytes, limit), envelope.traceId);
}

/** The envelope as plain JSON, for hashing, byte measurement and the MCP `structuredContent` field. */
export function toJsonObject(envelope: ToolEnvelope<JsonValue>): JsonObject {
  const output: Record<string, JsonValue> = {
    ok: envelope.ok,
    code: envelope.code,
    state: envelope.state,
    message: envelope.message,
    canonicalMutation: envelope.canonicalMutation,
    nextAction: envelope.nextAction,
    retry: envelope.retry,
    warnings: [...envelope.warnings],
    traceId: envelope.traceId,
  };
  if (envelope.data !== undefined) {
    output.data = envelope.data;
  }
  return output;
}
