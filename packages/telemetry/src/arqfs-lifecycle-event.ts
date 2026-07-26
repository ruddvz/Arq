/**
 * ARQFS-018: structured lifecycle events for the moments in a project's life
 * this repository's own hardening (Phases ARQFS-001 through ARQFS-014) added
 * real, diagnosable failure modes for - preflight, SQLite integrity, Worker
 * transport, migration/swap, resource GC, import commit - but that, before
 * this module, had no shared, privacy-reviewed shape a support bundle or a
 * future crash-reporting pipeline could actually collect.
 *
 * Every field here is one of: a stable code/enum already defined by the
 * arqfs modules that produce it (never a raw driver error message), a count,
 * a duration, a version number, or a correlation id this module itself mints
 * - never a project name, a file name, a filesystem path, a resource's
 * bytes, or free-form SQL/driver text. Deliberately has no dependency on
 * `@arq/arqfs` at all, not even type-only - a caller building an event
 * copies the specific field it needs (`preflightResult.code`,
 * `openResult.header.major`, ...) rather than this module importing arqfs's
 * result types wholesale, so this stays safe to bundle anywhere (a Worker, a
 * browser main thread, Node) with zero risk of ever pulling in
 * `arqfs-node-driver.ts`'s `better-sqlite3` dependency through a barrel.
 */
export type ArqfsLifecycleCorrelationId = string & {
  readonly __brand: 'ArqfsLifecycleCorrelationId';
};

let nextCorrelationSequence = 0;

/** Not a UUID - a monotonic per-session counter is enough for correlating events within one client's own lifecycle timeline, and avoids pulling in a UUID dependency for something that is never compared across clients. */
export function nextArqfsLifecycleCorrelationId(): ArqfsLifecycleCorrelationId {
  nextCorrelationSequence += 1;
  return `arqfs-${Date.now()}-${nextCorrelationSequence}` as ArqfsLifecycleCorrelationId;
}

interface BaseLifecycleEvent {
  readonly correlationId: ArqfsLifecycleCorrelationId;
  readonly timestampUnixMs: number;
}

export type ArqfsLifecycleEvent =
  | (BaseLifecycleEvent & {
      readonly kind: 'preflight';
      readonly status: 'accepted' | 'rejected';
      /** arqfs-preflight.ts's own ArqfsBytePreflightResult['code'] (a plain string, not a narrower literal type there either) - e.g. ARQ_FILE_TRUNCATED, ARQ_APPLICATION_ID_MISMATCH. */
      readonly code?: string;
      readonly fileByteLength: number;
      readonly pageSize?: number;
      readonly durationMs: number;
    })
  | (BaseLifecycleEvent & {
      readonly kind: 'open';
      readonly status: 'opened' | 'rejected';
      readonly formatMajor?: number;
      readonly formatSchema?: number;
      readonly canWrite?: boolean;
      readonly safeModeRequired?: boolean;
      readonly durationMs: number;
    })
  | (BaseLifecycleEvent & {
      readonly kind: 'integrity-check';
      readonly ok: boolean;
      readonly quickCheckIssueCount: number;
      readonly foreignKeyViolationCount: number;
      readonly durationMs: number;
    })
  | (BaseLifecycleEvent & {
      readonly kind: 'migration';
      readonly status: 'migrated' | 'rejected';
      readonly fromSchema?: number;
      readonly toSchema?: number;
      readonly durationMs: number;
    })
  | (BaseLifecycleEvent & {
      readonly kind: 'atomic-swap';
      readonly status: 'swapped' | 'rejected';
      /** arqfs-node-atomic-swap.ts's ArqfsFileSwapCode, e.g. ARQ_SWAP_BACKUP_FAILED. */
      readonly code?: string;
      readonly canonicalPreserved?: boolean;
      readonly durationMs: number;
    })
  | (BaseLifecycleEvent & {
      readonly kind: 'worker-request';
      readonly requestType: string;
      readonly status: 'ok' | 'timeout' | 'aborted' | 'error';
      readonly durationMs: number;
    })
  | (BaseLifecycleEvent & {
      readonly kind: 'worker-crash';
      readonly crashKind: 'error' | 'messageerror';
      readonly pendingRequestsRejected: number;
    })
  | (BaseLifecycleEvent & {
      readonly kind: 'resource-gc';
      readonly status: 'collected' | 'rejected' | 'unsupported';
      readonly resourcesCollected: number;
      readonly bytesFreed: number;
      readonly durationMs: number;
    })
  | (BaseLifecycleEvent & {
      readonly kind: 'import-commit';
      readonly status: 'committed' | 'cancelled' | 'failed' | 'rejected';
      readonly detectedFormat?: string;
      readonly issueCount?: number;
      readonly durationMs: number;
    })
  | (BaseLifecycleEvent & {
      readonly kind: 'storage-quota';
      readonly status: 'ok' | 'near-limit' | 'exceeded' | 'unavailable';
      readonly usageBytes?: number;
      readonly quotaBytes?: number;
    });

/**
 * Fields no ArqfsLifecycleEvent variant above ever carries, but a naive
 * caller might be tempted to add later (a raw driver error's `.message`,
 * for instance, can occasionally echo a file path via SQLite's own error
 * text) - kept as an explicit denylist so a code review or a future
 * automated check has something concrete to verify against, matching
 * redact-sensitive-fields.ts's own name-based approach rather than
 * attempting to content-sniff paths out of arbitrary strings.
 */
export const ARQFS_LIFECYCLE_FORBIDDEN_FIELD_NAMES: ReadonlySet<string> = new Set([
  'filePath',
  'fileName',
  'projectId',
  'backupPath',
  'sourceUriHint',
  'message',
  'rawError',
  'stack',
]);

export function assertArqfsLifecycleEventIsSafe(event: ArqfsLifecycleEvent): void {
  for (const key of Object.keys(event)) {
    if (ARQFS_LIFECYCLE_FORBIDDEN_FIELD_NAMES.has(key)) {
      throw new Error(
        `ArqfsLifecycleEvent must not carry a "${key}" field - it is not privacy-safe.`,
      );
    }
  }
}
