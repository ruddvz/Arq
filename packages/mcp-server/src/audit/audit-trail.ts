/**
 * An append-only record of what was asked and what was answered, holding
 * fingerprints rather than content.
 *
 * The reviewed 2.0 package had no audit surface at all, while its own
 * threat model required audit events for every consequential request and
 * named "credential leakage" and "unknown retention of AI plans" as open
 * risks. Adding a log that stores request payloads would have created the
 * second risk while closing the first, so this one stores a digest of the
 * request and never the request itself. An operator can prove that a
 * particular design program was submitted - by hashing the copy they hold
 * and comparing - without the log becoming a second, unmanaged copy of
 * every brief, reference URI and project excerpt that ever crossed the
 * boundary.
 *
 * The trail is bounded and drops its oldest entries first. Unbounded
 * retention inside a long-lived process is a memory leak with a privacy
 * consequence attached.
 */

import type { Clock } from '../runtime/clock';
import { isoTimestamp } from '../runtime/clock';
import type { CanonicalMutationState } from '../domain/envelope';
import type { GrantContext } from '../grant/grant';

export type AuditOutcome = 'ok' | 'denied' | 'error';

export interface AuditEvent {
  readonly sequence: number;
  readonly recordedAt: string;
  readonly traceId: string;
  readonly grantId: string;
  readonly subjectId: string;
  readonly tenantId: string;
  readonly clientName: string;
  readonly tool: string;
  readonly projectId?: string;
  readonly outcome: AuditOutcome;
  readonly code: string;
  readonly canonicalMutation: CanonicalMutationState;
  /** A digest of the request arguments. Never the arguments themselves. */
  readonly requestFingerprint: string;
}

export interface RecordAuditInput {
  readonly traceId: string;
  readonly grant: GrantContext;
  readonly tool: string;
  readonly projectId?: string;
  readonly outcome: AuditOutcome;
  readonly code: string;
  readonly canonicalMutation: CanonicalMutationState;
  readonly requestFingerprint: string;
}

export const DEFAULT_AUDIT_CAPACITY = 2000;

export interface AuditTrail {
  record(input: RecordAuditInput): AuditEvent;
  /** Newest first, and only the calling grant's own events. One grant must not read another's activity. */
  read(grant: GrantContext, limit: number): readonly AuditEvent[];
  readonly size: number;
  readonly droppedCount: number;
}

export function createAuditTrail(clock: Clock, capacity = DEFAULT_AUDIT_CAPACITY): AuditTrail {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new RangeError('audit capacity must be a positive integer');
  }
  const events: AuditEvent[] = [];
  let sequence = 0;
  let dropped = 0;

  return {
    record(input) {
      sequence += 1;
      const event: AuditEvent = {
        sequence,
        recordedAt: isoTimestamp(clock),
        traceId: input.traceId,
        grantId: input.grant.grantId,
        subjectId: input.grant.subjectId,
        tenantId: input.grant.tenantId,
        clientName: input.grant.clientName,
        tool: input.tool,
        outcome: input.outcome,
        code: input.code,
        canonicalMutation: input.canonicalMutation,
        requestFingerprint: input.requestFingerprint,
        ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
      };
      events.push(event);
      while (events.length > capacity) {
        events.shift();
        dropped += 1;
      }
      return event;
    },
    read(grant, limit) {
      const own = events.filter(
        (event) => event.grantId === grant.grantId && event.tenantId === grant.tenantId,
      );
      return own.slice(-limit).reverse();
    },
    get size() {
      return events.length;
    },
    get droppedCount() {
      return dropped;
    },
  };
}
