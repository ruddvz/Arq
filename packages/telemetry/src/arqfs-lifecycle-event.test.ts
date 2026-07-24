import { describe, expect, it } from 'vitest';
import {
  nextArqfsLifecycleCorrelationId,
  assertArqfsLifecycleEventIsSafe,
  type ArqfsLifecycleEvent,
} from './arqfs-lifecycle-event';

describe('nextArqfsLifecycleCorrelationId', () => {
  it('never repeats within a session', () => {
    const ids = new Set(Array.from({ length: 50 }, () => nextArqfsLifecycleCorrelationId()));
    expect(ids.size).toBe(50);
  });
});

describe('assertArqfsLifecycleEventIsSafe', () => {
  const baseEvent = {
    correlationId: nextArqfsLifecycleCorrelationId(),
    timestampUnixMs: Date.now(),
  };

  it('accepts a well-formed preflight event', () => {
    const event: ArqfsLifecycleEvent = {
      ...baseEvent,
      kind: 'preflight',
      status: 'rejected',
      code: 'ARQ_FILE_TRUNCATED',
      fileByteLength: 4096,
      durationMs: 3,
    };
    expect(() => assertArqfsLifecycleEventIsSafe(event)).not.toThrow();
  });

  it('accepts every declared event kind without throwing', () => {
    const events: readonly ArqfsLifecycleEvent[] = [
      { ...baseEvent, kind: 'preflight', status: 'accepted', fileByteLength: 1, durationMs: 1 },
      { ...baseEvent, kind: 'open', status: 'opened', durationMs: 1 },
      {
        ...baseEvent,
        kind: 'integrity-check',
        ok: true,
        quickCheckIssueCount: 0,
        foreignKeyViolationCount: 0,
        durationMs: 1,
      },
      { ...baseEvent, kind: 'migration', status: 'migrated', durationMs: 1 },
      { ...baseEvent, kind: 'atomic-swap', status: 'swapped', durationMs: 1 },
      { ...baseEvent, kind: 'worker-request', requestType: 'open', status: 'ok', durationMs: 1 },
      { ...baseEvent, kind: 'worker-crash', crashKind: 'error', pendingRequestsRejected: 2 },
      {
        ...baseEvent,
        kind: 'resource-gc',
        status: 'collected',
        resourcesCollected: 3,
        bytesFreed: 1024,
        durationMs: 1,
      },
      { ...baseEvent, kind: 'import-commit', status: 'committed', durationMs: 1 },
      { ...baseEvent, kind: 'storage-quota', status: 'ok' },
    ];
    for (const event of events) {
      expect(() => assertArqfsLifecycleEventIsSafe(event)).not.toThrow();
    }
  });

  /**
   * The actual point of this function: catch a forbidden field even though
   * TypeScript's own structural typing would happily accept an object with
   * an extra property at a call site that isn't directly type-checked
   * against ArqfsLifecycleEvent (e.g. spread from an untyped source).
   */
  it('rejects an event carrying a forbidden field, even one TypeScript would not itself flag', () => {
    const unsafeEvent = {
      ...baseEvent,
      kind: 'open',
      status: 'rejected',
      durationMs: 1,
      filePath: '/Users/jsmith/Documents/secret-project.arq',
    } as unknown as ArqfsLifecycleEvent;
    expect(() => assertArqfsLifecycleEventIsSafe(unsafeEvent)).toThrow(/filePath/);
  });

  it('rejects a raw error message field', () => {
    const unsafeEvent = {
      ...baseEvent,
      kind: 'worker-request',
      requestType: 'open',
      status: 'error',
      durationMs: 1,
      message: 'ENOENT: /Users/jsmith/private/project.arq',
    } as unknown as ArqfsLifecycleEvent;
    expect(() => assertArqfsLifecycleEventIsSafe(unsafeEvent)).toThrow(/message/);
  });
});
