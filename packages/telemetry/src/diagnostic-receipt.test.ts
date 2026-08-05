import { describe, expect, it } from 'vitest';
import { REDACTED_PLACEHOLDER } from './redact-sensitive-fields';
import {
  DEFAULT_RECEIPT_CAPACITY,
  createReceiptLog,
  describeReceipt,
  logCovers,
} from './diagnostic-receipt';

describe('createReceiptLog', () => {
  it('records a receipt with a sequence number', () => {
    const log = createReceiptLog();

    const receipt = log.record({
      kind: 'operation-committed',
      atUnixMs: 1000,
      evidence: 'observed',
      facts: { revision: 12, durationMs: 4 },
    });

    expect(receipt.sequence).toBe(1);
    expect(receipt.facts).toEqual({ revision: 12, durationMs: 4 });
  });

  it('redacts at write time rather than at read time', () => {
    // Whatever the receipt is written into is outside the control of whoever
    // might otherwise redact it later.
    const log = createReceiptLog();

    const receipt = log.record({
      kind: 'project-opened',
      atUnixMs: 1000,
      evidence: 'observed',
      facts: { projectName: 'Client House', elementCount: 400 },
    });

    expect(receipt.facts.projectName).toBe(REDACTED_PLACEHOLDER);
    expect(receipt.facts.elementCount).toBe(400);
    // And the stored copy, not just the returned one.
    expect(log.all()[0]?.facts.projectName).toBe(REDACTED_PLACEHOLDER);
  });

  it('keeps the most recent receipts and says how many it dropped', () => {
    // A log truncated by whatever holds it keeps whichever end that storage
    // preferred, at a moment nobody chose.
    const log = createReceiptLog(3);
    for (let index = 0; index < 5; index += 1) {
      log.record({ kind: 'operation-committed', atUnixMs: index, evidence: 'observed' });
    }

    expect(log.all().map((receipt) => receipt.sequence)).toEqual([3, 4, 5]);
    expect(log.droppedCount()).toBe(2);
  });

  it('keeps counting sequence numbers past the capacity, so a gap is visible', () => {
    // Restarting at zero would make a truncated log look complete.
    const log = createReceiptLog(2);
    for (let index = 0; index < 4; index += 1) {
      log.record({ kind: 'project-opened', atUnixMs: index, evidence: 'observed' });
    }

    expect(log.all()[0]?.sequence).toBe(3);
  });

  it('records whether a claim was observed or merely reported', () => {
    // A store that reports a commit that did not happen produces a reported
    // receipt saying it did, and a reader who knows that looks in the right
    // place.
    const log = createReceiptLog();
    log.record({ kind: 'operation-committed', atUnixMs: 1, evidence: 'reported' });

    expect(log.all()[0]?.evidence).toBe('reported');
  });

  it('carries a stable code where one exists', () => {
    const log = createReceiptLog();
    log.record({
      kind: 'operation-rejected',
      atUnixMs: 1,
      evidence: 'observed',
      code: 'ARQ_OP_STALE_BASE_REVISION',
    });

    expect(log.all()[0]?.code).toBe('ARQ_OP_STALE_BASE_REVISION');
  });

  it('returns the newest first when asked for recent ones', () => {
    const log = createReceiptLog();
    log.record({ kind: 'project-opened', atUnixMs: 1, evidence: 'observed' });
    log.record({ kind: 'project-closed', atUnixMs: 2, evidence: 'observed' });

    expect(log.recent(1).map((receipt) => receipt.kind)).toEqual(['project-closed']);
  });

  it('filters by kind', () => {
    const log = createReceiptLog();
    log.record({ kind: 'operation-committed', atUnixMs: 1, evidence: 'observed' });
    log.record({ kind: 'operation-rejected', atUnixMs: 2, evidence: 'observed' });
    log.record({ kind: 'operation-committed', atUnixMs: 3, evidence: 'observed' });

    expect(log.byKind('operation-committed')).toHaveLength(2);
  });

  it('keeps the dropped count after a clear', () => {
    // Clearing does not make those receipts exist again.
    const log = createReceiptLog(1);
    log.record({ kind: 'project-opened', atUnixMs: 1, evidence: 'observed' });
    log.record({ kind: 'project-opened', atUnixMs: 2, evidence: 'observed' });
    log.clear();

    expect(log.all()).toEqual([]);
    expect(log.droppedCount()).toBe(1);
  });

  it('has a capacity a person can paste into a report', () => {
    expect(DEFAULT_RECEIPT_CAPACITY).toBeLessThanOrEqual(1000);
    expect(createReceiptLog().capacity).toBe(DEFAULT_RECEIPT_CAPACITY);
  });
});

describe('describeReceipt', () => {
  it('marks a reported claim, so a reader does not treat it as observed', () => {
    // Treating reported claims as observed reaches confident wrong
    // conclusions, which is worse than reaching none.
    const log = createReceiptLog();
    const observed = log.record({
      kind: 'operation-committed',
      atUnixMs: 1,
      evidence: 'observed',
    });
    const reported = log.record({
      kind: 'operation-committed',
      atUnixMs: 2,
      evidence: 'reported',
    });

    expect(describeReceipt(observed)).not.toContain('reported');
    expect(describeReceipt(reported)).toContain('(reported)');
  });

  it('includes the code when there is one', () => {
    const log = createReceiptLog();
    const receipt = log.record({
      kind: 'publication-refused',
      atUnixMs: 1,
      evidence: 'observed',
      code: 'sidecar-present',
    });

    expect(describeReceipt(receipt)).toContain('sidecar-present');
  });
});

describe('logCovers', () => {
  it('is false for a moment before the log starts', () => {
    // A diagnosis drawn from a window the log no longer covers is drawn from
    // nothing.
    const log = createReceiptLog(2);
    log.record({ kind: 'project-opened', atUnixMs: 1000, evidence: 'observed' });
    log.record({ kind: 'project-opened', atUnixMs: 2000, evidence: 'observed' });
    log.record({ kind: 'project-opened', atUnixMs: 3000, evidence: 'observed' });

    expect(logCovers(log, 1500)).toBe(false);
    expect(logCovers(log, 2500)).toBe(true);
  });

  it('is false for an empty log', () => {
    expect(logCovers(createReceiptLog(), 0)).toBe(false);
  });
});
