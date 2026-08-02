/**
 * The project grant: the security principal the reviewed 2.0 package had
 * nowhere to put.
 *
 * 2.0's `ArqAdapter` methods took only data - `getProjectSnapshot(projectId)`,
 * `stageChangeSet(input)`. There was no parameter for who was asking. Its
 * own threat model then required project grants, scopes, tenant isolation
 * and revocation, none of which any method signature could express, so
 * every one of those controls was recorded as future work rather than as
 * something the interface makes callers pass. An authorization model that
 * has no place in the type system is a document, not a control.
 *
 * Here every adapter call takes a `GrantContext` as its first argument.
 * That makes four properties structural rather than aspirational:
 *
 *   the caller's identity is always present at the point of the check;
 *   a project outside `projectIds` is indistinguishable from one that does
 *     not exist;
 *   a scope the operator did not grant cannot be assumed by a tool;
 *   expiry and revocation are checked on every call, not at connect time.
 *
 * A grant is minted by the Arq application when the operator chooses to
 * share a project. Nothing in this package can create, widen or extend one,
 * and no tool argument can name a scope. That is why `GrantContext` has no
 * constructor taking model input: `createGrant` is called by the host
 * process from operator action.
 */

import type { Clock } from '../runtime/clock';
import { grantExpired, grantRevoked, projectNotAvailable, scopeMissing } from '../domain/errors';
import { ARQ_MCP_SCOPES, type ArqMcpScope } from './scopes';

export interface GrantContext {
  readonly grantId: string;
  /** Who the operator is, as Arq knows them. Never a credential. */
  readonly subjectId: string;
  readonly tenantId: string;
  /**
   * The MCP client's self-reported name and version, taken from the
   * `initialize` handshake rather than from a tool argument. It is
   * recorded as provenance and is never trusted for authorization.
   */
  readonly clientName: string;
  readonly clientVersion: string;
  readonly scopes: readonly ArqMcpScope[];
  /** The exact projects this grant covers. An empty list is a valid grant that can see no project. */
  readonly projectIds: readonly string[];
  readonly issuedAtEpochMs: number;
  readonly expiresAtEpochMs: number;
  readonly revoked: boolean;
}

export type GrantState = 'active' | 'expired' | 'revoked';

export interface CreateGrantInput {
  readonly grantId: string;
  readonly subjectId: string;
  readonly tenantId: string;
  readonly clientName: string;
  readonly clientVersion: string;
  readonly scopes: readonly ArqMcpScope[];
  readonly projectIds: readonly string[];
  readonly issuedAtEpochMs: number;
  readonly lifetimeMs: number;
}

/** The longest a grant may live. A grant is a session-shaped permission, not an API key. */
export const MAX_GRANT_LIFETIME_MS = 12 * 60 * 60 * 1000;

export function createGrant(input: CreateGrantInput): GrantContext {
  if (!Number.isFinite(input.lifetimeMs) || input.lifetimeMs <= 0) {
    throw new RangeError('a grant lifetime must be a positive finite number of milliseconds');
  }
  if (input.lifetimeMs > MAX_GRANT_LIFETIME_MS) {
    throw new RangeError(
      `a grant may not live longer than ${MAX_GRANT_LIFETIME_MS} ms; ask the operator to re-grant instead`,
    );
  }
  for (const scope of input.scopes) {
    if (!(ARQ_MCP_SCOPES as readonly string[]).includes(scope)) {
      throw new RangeError(`unknown scope "${scope}"`);
    }
  }
  return {
    grantId: input.grantId,
    subjectId: input.subjectId,
    tenantId: input.tenantId,
    clientName: input.clientName,
    clientVersion: input.clientVersion,
    // Deduplicated and sorted so two grants with the same permissions have
    // the same shape, which keeps audit fingerprints comparable.
    scopes: [...new Set(input.scopes)].sort(),
    projectIds: [...new Set(input.projectIds)].sort(),
    issuedAtEpochMs: input.issuedAtEpochMs,
    expiresAtEpochMs: input.issuedAtEpochMs + input.lifetimeMs,
    revoked: false,
  };
}

export function revokeGrant(grant: GrantContext): GrantContext {
  return { ...grant, revoked: true };
}

/** Expiry is inclusive of the instant it names: a grant is dead at `expiresAtEpochMs`, not one millisecond later. */
export function grantState(grant: GrantContext, clock: Clock): GrantState {
  if (grant.revoked) {
    return 'revoked';
  }
  return clock() >= grant.expiresAtEpochMs ? 'expired' : 'active';
}

export function requireActiveGrant(grant: GrantContext, clock: Clock): void {
  const state = grantState(grant, clock);
  if (state === 'revoked') {
    throw grantRevoked();
  }
  if (state === 'expired') {
    throw grantExpired();
  }
}

export function grantHasScope(grant: GrantContext, scope: ArqMcpScope): boolean {
  return grant.scopes.includes(scope);
}

/** Checks liveness and then the scope, in that order: an expired grant must not report a scope problem it no longer has any business evaluating. */
export function requireScope(grant: GrantContext, scope: ArqMcpScope, clock: Clock): void {
  requireActiveGrant(grant, clock);
  if (!grantHasScope(grant, scope)) {
    throw scopeMissing(scope);
  }
}

export function grantCoversProject(grant: GrantContext, projectId: string): boolean {
  return grant.projectIds.includes(projectId);
}

/**
 * The project gate. It throws the same `projectNotAvailable` error whether
 * the project is outside the grant or does not exist at all, which is what
 * stops a caller holding one grant from enumerating the operator's other
 * projects one identifier at a time.
 */
export function requireProjectAccess(grant: GrantContext, projectId: string, clock: Clock): void {
  requireActiveGrant(grant, clock);
  if (!grantCoversProject(grant, projectId)) {
    throw projectNotAvailable();
  }
}

/** What the operator sees in the Assistant panel's context header. Never the grant id, the subject, the tenant or the scopes as raw tokens. */
export function describeGrant(grant: GrantContext, clock: Clock): string {
  const state = grantState(grant, clock);
  if (state === 'revoked') {
    return 'Access was withdrawn in Arq.';
  }
  if (state === 'expired') {
    return 'Access has expired. Renew it in Arq to continue.';
  }
  const projects =
    grant.projectIds.length === 1 ? '1 project' : `${grant.projectIds.length} projects`;
  const until = new Date(grant.expiresAtEpochMs).toISOString().slice(11, 16);
  return `${projects} shared with ${grant.clientName} until ${until} UTC.`;
}
