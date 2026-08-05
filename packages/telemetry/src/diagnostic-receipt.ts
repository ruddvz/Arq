import { redactSensitiveFields } from './redact-sensitive-fields';

/**
 * V3-187: every committed operation and lifecycle event leaves a receipt.
 *
 * The question a receipt answers is "what happened", asked after the fact by
 * someone who cannot reproduce it. Support gets "it lost my changes" and a
 * project file; without receipts the only available answers are a guess and a
 * request for steps to reproduce, which the user does not have because it
 * happened once, an hour ago, during something else.
 *
 * Three properties make a receipt worth keeping, and each of them is a
 * constraint rather than a feature.
 *
 * **Bounded.** A receipt log that grows forever is one that will be truncated
 * by whatever holds it, at a moment nobody chose, keeping whichever end that
 * storage happened to prefer. A ring buffer with a stated size keeps the most
 * recent N deliberately, and `droppedCount` says how many went, so a reader
 * knows the log starts mid-story rather than at the beginning.
 *
 * **Redacted at write time.** Not at read time, and not at send time. A receipt
 * holding a project name is a privacy problem the moment it is written,
 * because whatever it is written into - memory, a log file, a crash report - is
 * outside the control of whoever eventually decides to redact it.
 *
 * **Honest about what it knows.** A receipt saying an operation committed is
 * one kind of claim; a receipt saying the *revision advanced* because the store
 * reported it is another, weaker one. `evidence` records which, so a diagnosis
 * built on receipts inherits their uncertainty rather than laundering it.
 */

export type ReceiptKind =
  | 'operation-committed'
  | 'operation-rejected'
  | 'project-opened'
  | 'project-closed'
  | 'publication-verified'
  | 'publication-refused'
  | 'recovery-offered'
  | 'recovery-applied'
  | 'proposal-applied'
  | 'proposal-refused';

/**
 * How much the receipt's own claim is worth.
 *
 * `observed` is something this process did and saw. `reported` is something
 * another component said, recorded faithfully without independent confirmation.
 * The distinction matters exactly when it is inconvenient: a store that reports
 * a commit that did not happen produces a `reported` receipt saying it did, and
 * a reader who knows that is looking in the right place.
 */
export type ReceiptEvidence = 'observed' | 'reported';

export interface DiagnosticReceipt {
  readonly sequence: number;
  readonly kind: ReceiptKind;
  readonly atUnixMs: number;
  readonly evidence: ReceiptEvidence;
  /** Stable code where one exists - a rejection code, a refusal reason. */
  readonly code?: string;
  /** Bounded, redacted facts. Counts, durations, revisions, codes. Never content. */
  readonly facts: Readonly<Record<string, unknown>>;
}

/** Provisional. Large enough to cover a working session's recent history, small enough to hold in memory and paste into a report. */
export const DEFAULT_RECEIPT_CAPACITY = 500;

export interface RecordReceiptInput {
  readonly kind: ReceiptKind;
  readonly atUnixMs: number;
  readonly evidence: ReceiptEvidence;
  readonly code?: string;
  readonly facts?: Readonly<Record<string, unknown>>;
}

/**
 * A bounded, redacted receipt log.
 *
 * Sequence numbers keep counting past the capacity rather than restarting, so a
 * gap in a exported log is visible as a gap. Restarting at zero would make a
 * truncated log look complete, which is the failure this exists to avoid.
 */
export function createReceiptLog(capacity: number = DEFAULT_RECEIPT_CAPACITY) {
  const entries: DiagnosticReceipt[] = [];
  let nextSequence = 1;
  let dropped = 0;

  function record(input: RecordReceiptInput): DiagnosticReceipt {
    const receipt: DiagnosticReceipt = {
      sequence: nextSequence,
      kind: input.kind,
      atUnixMs: input.atUnixMs,
      evidence: input.evidence,
      ...(input.code === undefined ? {} : { code: input.code }),
      // At write time. Whatever this is written into is outside the control of
      // whoever might otherwise redact it later.
      facts: redactSensitiveFields(input.facts ?? {}),
    };
    nextSequence += 1;

    entries.push(receipt);
    while (entries.length > capacity) {
      entries.shift();
      dropped += 1;
    }

    return receipt;
  }

  function all(): readonly DiagnosticReceipt[] {
    return [...entries];
  }

  /** Most recent first, which is the order a person reading a fresh problem wants. */
  function recent(count: number): readonly DiagnosticReceipt[] {
    return [...entries].reverse().slice(0, Math.max(0, count));
  }

  function byKind(kind: ReceiptKind): readonly DiagnosticReceipt[] {
    return entries.filter((receipt) => receipt.kind === kind);
  }

  /** How many receipts fell off the end. A reader needs to know the log starts mid-story. */
  function droppedCount(): number {
    return dropped;
  }

  function clear(): void {
    entries.length = 0;
    // `dropped` is deliberately not reset: it counts what was never available
    // to a reader, and clearing does not make those receipts exist again.
  }

  return { record, all, recent, byKind, droppedCount, clear, capacity };
}

export type ReceiptLog = ReturnType<typeof createReceiptLog>;

/**
 * A summary line per receipt.
 *
 * Includes the evidence marker, because a support conversation that treats
 * `reported` claims as `observed` ones reaches confident wrong conclusions -
 * which is worse than reaching none.
 */
export function describeReceipt(receipt: DiagnosticReceipt): string {
  const marker = receipt.evidence === 'observed' ? '' : ' (reported)';
  const code = receipt.code === undefined ? '' : ` ${receipt.code}`;
  return `#${receipt.sequence} ${receipt.kind}${code}${marker}`;
}

/**
 * Whether the log can answer a question about a moment.
 *
 * Answering "no" is the point. A diagnosis drawn from a window the log no
 * longer covers is a diagnosis drawn from nothing, and it is much better to say
 * "the log starts after that" than to reason confidently from the receipts that
 * happen to remain.
 */
export function logCovers(log: ReceiptLog, atUnixMs: number): boolean {
  const entries = log.all();
  const first = entries[0];
  if (first === undefined) {
    return false;
  }
  return atUnixMs >= first.atUnixMs;
}
