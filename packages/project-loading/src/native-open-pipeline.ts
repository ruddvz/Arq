/**
 * The ordered native `.arq` open, as one function over a transport.
 *
 * Every check that stands between "the user picked a file" and "the workspace is
 * showing that project" happens here, in one place, in a fixed order, so that the
 * order is a property of the product rather than of whichever component happened
 * to call what first:
 *
 *   1. open          - application id, `arqfs_meta`, feature flags, capabilities
 *   2. recovery facts - SQLite `quick_check`, foreign keys, required entries,
 *                       interrupted write
 *   3. safe-mode plan - the one decision derived from those facts
 *   4. identity       - project id and revision as the file records them
 *   5. archive        - every entry's bytes, read through the Worker
 *   6. checksums      - recorded digests re-verified against those bytes
 *   7. semantic       - `importArchive`, then this package's own model reader
 *
 * It talks to a `NativeOpenTransport` rather than to a Worker, for two reasons
 * that are really one: the Worker is a browser thing and this order is not, so
 * the order can be tested in Node against a real SQLite driver and a real
 * `.arq` file, which is how it is tested. A test that stubbed the checks it is
 * meant to be verifying would prove nothing.
 *
 * Nothing here writes. Nothing here is allowed to write: the transport it is
 * given exposes no write at all, so a future edit to this file cannot introduce
 * one by accident.
 */
import { importArchive, parseChecksums, verifyChecksums } from '@arq/project-format';
import type { ArqfsOpenResult } from '@arq/arqfs/src/arqfs-open';
import type { ArqfsRecoveryReport } from '@arq/arqfs/src/arqfs-recovery-report';
import type { ArqfsSafeModePlan } from '@arq/arqfs/src/arqfs-safe-mode';
import { resolveArqfsSafeModePlan } from '@arq/arqfs/src/arqfs-safe-mode';
import type { ArqfsWorkingCopyState } from '@arq/arqfs/src/arqfs-working-copy';
import {
  parseNativeProjectModel,
  parseNativeProjectViews,
  type NativeProjectModel,
} from './native-project-model';
import { ProjectOpenStateMachine } from './state-machine';
import type { ProjectOpenSnapshot } from './types';

/**
 * The read-only surface the pipeline is allowed to use. Deliberately the whole
 * of it: no `putArchiveEntries`, no `exec`, no way to reach a driver.
 */
export interface NativeOpenTransport {
  /** Establishes what this build may do with the file, and hardens the connection. */
  open(): Promise<{ readonly result: ArqfsOpenResult; readonly usedVfs: string }>;
  recoveryReport(): Promise<ArqfsRecoveryReport>;
  workingCopyState(): Promise<ArqfsWorkingCopyState | null>;
  listArchiveEntryPaths(): Promise<readonly string[]>;
  getArchiveEntry(path: string): Promise<Uint8Array | null>;
}

/** Why an open did not produce a project, in a form a diagnostics surface can branch on. */
export type NativeOpenFailureCode =
  | 'OPEN_REJECTED'
  | 'FILE_NOT_READABLE'
  | 'INTEGRITY_FAILED'
  | 'REQUIRED_ENTRIES_MISSING'
  | 'CHECKSUM_MISMATCH'
  | 'ARCHIVE_REJECTED'
  | 'MODEL_REJECTED';

export interface NativeOpenFailure {
  readonly status: 'failed';
  readonly code: NativeOpenFailureCode;
  readonly reason: string;
  /** Whatever was learned before the failure, for diagnostics. Partial by definition. */
  readonly openResult: ArqfsOpenResult | null;
  readonly safeModePlan: ArqfsSafeModePlan | null;
  readonly progress: ProjectOpenSnapshot;
}

/**
 * A project that opened, with the evidence of how it opened attached. Staged, not
 * yet active: it is the caller that decides to make it the workspace's project,
 * which is what keeps the previous project intact when this one fails.
 */
export interface StagedNativeProject {
  readonly status: 'staged';
  readonly attemptId: string;
  readonly model: NativeProjectModel;
  readonly openResult: Extract<ArqfsOpenResult, { status: 'opened' }>;
  readonly safeModePlan: ArqfsSafeModePlan;
  readonly workingCopy: ArqfsWorkingCopyState | null;
  readonly usedVfs: string;
  readonly integrity: ArqfsRecoveryReport['integrity'];
  /** Entry paths found in the file, sorted, so an artifact of an open is stable. */
  readonly archiveEntryPaths: readonly string[];
  /** Paths whose recorded checksum was re-verified against the bytes read back. */
  readonly verifiedChecksumPaths: readonly string[];
  /** Optional entries the archive reader could not parse; the project still opened. */
  readonly corruptOptionalPaths: readonly string[];
  /**
   * Why authoring is not available. Always populated in this build: an opened
   * `.arq` project is inspected, never edited, until ADR-0028's persistence
   * responsibility split is accepted and a real working copy exists to edit.
   */
  readonly authoringUnavailableReason: string;
  readonly progress: ProjectOpenSnapshot;
}

export type NativeOpenResult = StagedNativeProject | NativeOpenFailure;

export const NATIVE_AUTHORING_UNAVAILABLE_REASON =
  'This build opens a .arq project for inspection only. Editing needs a local working copy, which is not part of this build.';

/**
 * Checksum coverage this build insists on. `checksums.json` cannot record its own
 * digest, and an absent optional entry has nothing to verify - but a recorded
 * digest that does not match is a corrupt project, whichever entry it names.
 */
const REQUIRED_CHECKSUM_PATHS: readonly string[] = ['manifest.json', 'model.json'];

export interface RunNativeOpenOptions {
  /** Correlates every progress record of one attempt; supplied by the caller so it can be logged before the attempt starts. */
  readonly attemptId: string;
  readonly transport: NativeOpenTransport;
}

export async function runNativeOpen(options: RunNativeOpenOptions): Promise<NativeOpenResult> {
  const { attemptId, transport } = options;
  const machine = new ProjectOpenStateMachine(attemptId);

  const failed = (
    code: NativeOpenFailureCode,
    reason: string,
    openResult: ArqfsOpenResult | null,
    safeModePlan: ArqfsSafeModePlan | null,
  ): NativeOpenFailure => ({
    status: 'failed',
    code,
    reason,
    openResult,
    safeModePlan,
    progress: machine.snapshot(),
  });

  // Stage 0, Identify: what is this file, and what may be done with it.
  machine.start(0, 'Identifying the project file');
  const { result: openResult, usedVfs } = await transport.open();
  if (openResult.status !== 'opened') {
    machine.fail(0, openResult.reason);
    return failed('OPEN_REJECTED', openResult.reason, openResult, null);
  }
  machine.complete(0, 'Project file identified');

  // Stage 1, Shell: the file's health, and the single decision derived from it.
  machine.start(1, 'Checking the project file');
  const report = await transport.recoveryReport();
  const safeModePlan = resolveArqfsSafeModePlan(report);
  if (!safeModePlan.canOpen) {
    machine.fail(1, safeModePlan.reason);
    const code: NativeOpenFailureCode =
      safeModePlan.kind === 'corrupt' ? 'INTEGRITY_FAILED' : 'FILE_NOT_READABLE';
    return failed(code, safeModePlan.reason, openResult, safeModePlan);
  }
  if (report.missingRequiredEntries.length > 0) {
    // Distinguished from 'corrupt': the SQLite container is healthy and the
    // project content is not there, which is a different repair.
    const reason = `the project is missing required content: ${report.missingRequiredEntries.join(', ')}`;
    machine.fail(1, reason);
    return failed('REQUIRED_ENTRIES_MISSING', reason, openResult, safeModePlan);
  }
  machine.complete(1, 'Project file checked');

  // Stage 2, Skeleton: identity, bytes, checksums and the semantic model - after
  // which there is something real to pan and zoom around.
  machine.start(2, 'Reading the project');
  const workingCopy = await transport.workingCopyState();
  const archiveEntryPaths = [...(await transport.listArchiveEntryPaths())].sort();
  const entries = new Map<string, Uint8Array>();
  for (const path of archiveEntryPaths) {
    const content = await transport.getArchiveEntry(path);
    if (content !== null) {
      entries.set(path, content);
    }
  }

  const checksumBytes = entries.get('checksums.json');
  const recordedChecksums =
    checksumBytes === undefined ? [] : parseChecksums(new TextDecoder().decode(checksumBytes));
  const mismatches = await verifyChecksums(entries, recordedChecksums);
  if (mismatches.length > 0) {
    const reason = `recorded checksums do not match the project content: ${mismatches.join(', ')}`;
    machine.fail(2, reason);
    return failed('CHECKSUM_MISMATCH', reason, openResult, safeModePlan);
  }
  const verifiedChecksumPaths = recordedChecksums.map((entry) => entry.path).sort();
  // A file that records no digest for its own model is not verified content, and
  // treating "nothing to check" as "checked" is how an unverified project comes to
  // be presented as a verified one.
  const unverifiedRequired = REQUIRED_CHECKSUM_PATHS.filter(
    (path) => !verifiedChecksumPaths.includes(path),
  );
  if (unverifiedRequired.length > 0) {
    const reason = `the project records no checksum for ${unverifiedRequired.join(', ')}, so its content cannot be verified`;
    machine.fail(2, reason);
    return failed('CHECKSUM_MISMATCH', reason, openResult, safeModePlan);
  }

  const archive = await importArchive(entries);
  if (archive.status === 'rejected') {
    machine.fail(2, archive.reason);
    return failed('ARCHIVE_REJECTED', archive.reason, openResult, safeModePlan);
  }

  const parsed = parseNativeProjectModel(archive.model, parseNativeProjectViews(archive.views));
  if (parsed.status === 'rejected') {
    machine.fail(2, parsed.reason);
    return failed('MODEL_REJECTED', parsed.reason, openResult, safeModePlan);
  }
  machine.complete(2, 'Project read');

  // Stages 3-5 (Authoring, Quality, Intelligence) are deliberately never started.
  // `authoringReady` therefore stays false, which is the truth: this build has no
  // authoring path for an opened .arq project. Marking stage 3 failed instead
  // would report a defect where there is a boundary.
  return {
    status: 'staged',
    attemptId,
    model: parsed.model,
    openResult,
    safeModePlan,
    workingCopy,
    usedVfs,
    integrity: report.integrity,
    archiveEntryPaths,
    verifiedChecksumPaths,
    corruptOptionalPaths: archive.corruptOptionalPaths,
    authoringUnavailableReason: NATIVE_AUTHORING_UNAVAILABLE_REASON,
    progress: machine.snapshot(),
  };
}
