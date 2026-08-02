/**
 * Every failure this boundary can produce, with a repair path attached.
 *
 * Two rules shape this module.
 *
 * The first is non-disclosure. A caller must not be able to learn that a
 * project exists by observing a different error for "not granted" than for
 * "does not exist". `projectNotAvailable` is therefore the single factory
 * for both, and nothing else in this package may distinguish them. The
 * reviewed 2.0 package got this right for projects and then leaked
 * proposal state back to the caller in its review-request path, so the
 * proposal factories here are written the same non-disclosing way.
 *
 * The second is that an error must say what to do next. A model that
 * receives "the request ID was reused with different content" and nothing
 * else will usually retry the same call. `retry` and `nextAction` turn
 * each failure into an instruction: refresh the revision, mint a new
 * request id, ask the operator, or stop. The product's copy principles
 * ask user-facing errors for what happened, why, what was affected and
 * what to do; this is the same contract in machine-readable form.
 *
 * Messages never contain a filesystem path, a token, a grant, an approval
 * receipt or reference content. They may contain opaque Arq identifiers
 * and revisions, because those are already what the caller sent or was
 * given.
 */

/** What a caller should do about a failure. Anything other than `never` names a concrete precondition to change first. */
export type RetryGuidance =
  | 'never'
  | 'after_refreshing_revision'
  | 'after_new_request_id'
  | 'after_operator_action'
  | 'after_grant_renewal';

export interface ArqMcpErrorInit {
  readonly code: string;
  readonly state: string;
  readonly message: string;
  readonly retry: RetryGuidance;
  readonly nextAction: string;
  readonly warnings?: readonly string[];
}

export class ArqMcpError extends Error {
  readonly code: string;
  readonly state: string;
  readonly retry: RetryGuidance;
  readonly nextAction: string;
  readonly warnings: readonly string[];

  constructor(init: ArqMcpErrorInit) {
    super(init.message);
    this.name = 'ArqMcpError';
    this.code = init.code;
    this.state = init.state;
    this.retry = init.retry;
    this.nextAction = init.nextAction;
    this.warnings = init.warnings ?? [];
  }
}

export function isArqMcpError(value: unknown): value is ArqMcpError {
  return value instanceof ArqMcpError;
}

/**
 * The one answer to "that project" for an unknown id and an ungranted id
 * alike. Splitting these would turn the tool surface into a project
 * enumeration oracle for any caller holding one valid grant.
 */
export function projectNotAvailable(): ArqMcpError {
  return new ArqMcpError({
    code: 'ARQ_PROJECT_NOT_AVAILABLE',
    state: 'not_available',
    message:
      'That project is not available under the current grant. No project data was read or changed.',
    retry: 'after_operator_action',
    nextAction:
      'Call arq_list_projects to see the granted projects, or ask the operator to grant this project in Arq.',
  });
}

/** Used for proposals, briefs, design programs and undo groups: present-but-forbidden and absent are the same answer. */
export function recordNotAvailable(kind: string): ArqMcpError {
  return new ArqMcpError({
    code: 'ARQ_RECORD_NOT_AVAILABLE',
    state: 'not_available',
    message: `That ${kind} is not available under the current grant. No project data was read or changed.`,
    retry: 'after_operator_action',
    nextAction: `List the ${kind}s available to this grant and use an identifier from that result.`,
  });
}

export function scopeMissing(scope: string): ArqMcpError {
  return new ArqMcpError({
    code: 'ARQ_SCOPE_MISSING',
    state: 'forbidden',
    message: `The active grant does not carry the ${scope} scope. Nothing was read or changed.`,
    retry: 'after_grant_renewal',
    nextAction:
      'Ask the operator to widen the grant in Arq. A tool cannot request or raise its own scope.',
  });
}

export function grantExpired(): ArqMcpError {
  return new ArqMcpError({
    code: 'ARQ_GRANT_EXPIRED',
    state: 'grant_expired',
    message: 'The project grant has expired. Nothing was read or changed.',
    retry: 'after_grant_renewal',
    nextAction: 'Ask the operator to renew the grant in Arq, then call arq_get_capabilities again.',
  });
}

export function grantRevoked(): ArqMcpError {
  return new ArqMcpError({
    code: 'ARQ_GRANT_REVOKED',
    state: 'grant_revoked',
    message: 'The project grant was withdrawn. Nothing was read or changed.',
    retry: 'never',
    nextAction:
      'Stop using this connection and ask the operator whether access should be restored.',
  });
}

export function staleRevision(expected: string, actual: string): ArqMcpError {
  return new ArqMcpError({
    code: 'ARQ_REVISION_STALE',
    state: 'stale_revision',
    message: `The request targets revision ${expected}, but the project is at ${actual}. Nothing was changed.`,
    retry: 'after_refreshing_revision',
    nextAction:
      'Call arq_get_project_snapshot for the current revision, then rebuild the request against it.',
  });
}

export function projectNotEditable(accessState: string): ArqMcpError {
  return new ArqMcpError({
    code: 'ARQ_PROJECT_NOT_EDITABLE',
    state: accessState,
    message: `The project is ${accessState.replace(/_/gu, ' ')}, so Arq will not stage a change against it. Nothing was changed.`,
    retry: 'after_operator_action',
    nextAction:
      'Resolve the project state in Arq - finish the migration, complete recovery, or take the project out of read-only - before proposing changes.',
  });
}

export function idempotencyConflict(what: string): ArqMcpError {
  return new ArqMcpError({
    code: 'ARQ_IDEMPOTENCY_CONFLICT',
    state: 'idempotency_conflict',
    message: `That ${what} identifier was already used with different content. Nothing was changed.`,
    retry: 'after_new_request_id',
    nextAction: `Mint a fresh ${what} identifier rather than resending the previous one with edits.`,
  });
}

export function invalidInput(message: string, nextAction: string): ArqMcpError {
  return new ArqMcpError({
    code: 'ARQ_INPUT_INVALID',
    state: 'input_invalid',
    message,
    retry: 'never',
    nextAction,
  });
}

export function invalidState(
  code: string,
  state: string,
  message: string,
  nextAction: string,
): ArqMcpError {
  return new ArqMcpError({ code, state, message, retry: 'never', nextAction });
}

export function capabilityUnavailable(capability: string, reason: string): ArqMcpError {
  return new ArqMcpError({
    code: 'ARQ_CAPABILITY_UNAVAILABLE',
    state: 'blocked_by_capability',
    message: `Arq does not expose ${capability}. ${reason} Nothing was changed.`,
    retry: 'never',
    nextAction:
      'Keep the work at design-program level and record the missing capability, or ask for a registered domain profile that provides it. Do not substitute a different operation.',
  });
}

export function resultTooLarge(bytes: number, limit: number): ArqMcpError {
  return new ArqMcpError({
    code: 'ARQ_RESULT_TOO_LARGE',
    state: 'result_too_large',
    message: `The result would be ${bytes} bytes, above the ${limit} byte ceiling for one tool response. Nothing was changed.`,
    retry: 'never',
    nextAction:
      'Narrow the request: use a smaller page limit, restrict the field projection, or filter by identifier or kind.',
  });
}

/** The last resort. It deliberately says nothing about the cause: an unexpected fault must not become an information channel. */
export function internalFailure(): ArqMcpError {
  return new ArqMcpError({
    code: 'ARQ_INTERNAL_ERROR',
    state: 'failed',
    message:
      'Arq could not complete the request. No successful project change is implied by this failure.',
    retry: 'never',
    nextAction:
      'Report the trace identifier from this result. Do not retry the same call and do not assume a partial change was made.',
  });
}
