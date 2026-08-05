import type { ArqfsDriver } from './arqfs-driver';
import { readAllArchiveEntries } from './arqfs-archive-store';
import { parseChecksums, verifyChecksums } from '@arq/project-format/src/checksum';

/**
 * V3-069: verifying that every canonical archive entry still hashes to what the
 * project says it should, before a publication is described as sound.
 *
 * Deliberately *not* a new `content_sha256` column on `archive_entry`. The
 * schema's own comment (arqfs-schema.ts) states the reason and it still holds:
 * the per-entry digest already exists, in `checksums.json`, written by
 * @arq/project-format. Adding a second copy at the SQLite layer would create two
 * digests that can disagree, and a disagreement between two of your own
 * checksums tells you nothing about which one the bytes actually match. So this
 * module verifies against the digest the format already defines rather than
 * inventing a competing one.
 *
 * What it adds is the distinction the ARQ File System 3.0 draft asks for and
 * `checksums.json` alone does not carry: which entries are canonical and which
 * are derived. A corrupt thumbnail and a corrupt `model.json` are both checksum
 * mismatches and are not remotely the same event - one is regenerable, the other
 * means the project's meaning is gone. Publication must refuse the second and
 * may proceed past the first.
 */

/**
 * Entries whose loss changes what the project *means*. Matches
 * @arq/project-format's own required set (manifest.json and model.json reject
 * the archive) plus the operation log, which carries history the model alone
 * cannot reconstruct.
 */
export const CANONICAL_ENTRY_PATHS = [
  'manifest.json',
  'model.json',
  'operations.ndjson',
  'views.json',
  'sheets.json',
] as const;

/**
 * Entries a reader may discard and regenerate. Prefix-matched, since these are
 * directories in the logical archive.
 */
const DERIVED_ENTRY_PREFIXES = ['thumbnails/', 'previews/', 'render-cache/'] as const;

/** `checksums.json` describes the others and cannot meaningfully describe itself. */
const CHECKSUM_MANIFEST_PATH = 'checksums.json';

export type ArqfsEntryRole = 'canonical' | 'derived' | 'unknown';

export function classifyEntryPath(path: string): ArqfsEntryRole {
  if ((CANONICAL_ENTRY_PATHS as readonly string[]).includes(path)) {
    return 'canonical';
  }
  if (DERIVED_ENTRY_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return 'derived';
  }
  // Neither known-canonical nor known-derived. Treated as unknown rather than
  // silently derived: a future writer's canonical entry must not become
  // discardable just because this build has not heard of it.
  return 'unknown';
}

export interface ArqfsEntryDigestReport {
  /** True when no canonical or unknown entry failed its digest. */
  readonly ok: boolean;
  /** Whether the project carried a usable `checksums.json` at all. */
  readonly checksumsPresent: boolean;
  /** Canonical entries recorded in checksums.json but absent from the database. */
  readonly missingCanonicalEntries: readonly string[];
  /** Canonical entries whose bytes no longer match their recorded digest. */
  readonly canonicalMismatches: readonly string[];
  /** Regenerable entries that failed. Reported, never fatal. */
  readonly derivedMismatches: readonly string[];
  /** Failures on entries this build cannot classify. Treated as fatal. */
  readonly unknownMismatches: readonly string[];
  readonly verifiedEntryCount: number;
}

/**
 * Recomputes every archive entry's SHA-256 and compares it against
 * `checksums.json`, splitting the failures by entry role.
 *
 * A project with no `checksums.json` is reported as `checksumsPresent: false`
 * and `ok: true`: the format treats that file as optional-cache-like, so its
 * absence is a missing *check*, not a detected fault. Callers that need the
 * check to have actually run must read the flag rather than the verdict, which
 * is why the two are separate fields instead of one boolean.
 */
export async function verifyArqfsEntryDigests(
  driver: ArqfsDriver,
): Promise<ArqfsEntryDigestReport> {
  return verifyEntryDigestsOfEntries(readAllArchiveEntries(driver));
}

/**
 * V3-038: the same verification, over entries a caller already holds.
 *
 * Split out because the driver form could only run inside the Worker, and so
 * the only caller this check ever had was publication - which verifies a file
 * this build has just written. The open path, which is handed a file from
 * anywhere at all, read every entry across the Worker boundary and adopted them
 * without ever comparing one against `checksums.json`. The trusted direction
 * was verified and the untrusted one was not.
 */
export async function verifyEntryDigestsOfEntries(
  entries: ReadonlyMap<string, Uint8Array>,
): Promise<ArqfsEntryDigestReport> {
  const manifestBytes = entries.get(CHECKSUM_MANIFEST_PATH);
  if (manifestBytes === undefined) {
    return {
      ok: true,
      checksumsPresent: false,
      missingCanonicalEntries: [],
      canonicalMismatches: [],
      derivedMismatches: [],
      unknownMismatches: [],
      verifiedEntryCount: 0,
    };
  }

  const checksums = parseChecksums(new TextDecoder().decode(manifestBytes));
  if (checksums.length === 0) {
    // A malformed or empty checksums.json is the same situation as an absent
    // one: nothing was verified. Reporting `ok: true` with the flag clear keeps
    // that honest rather than letting an unreadable manifest read as a pass.
    return {
      ok: true,
      checksumsPresent: false,
      missingCanonicalEntries: [],
      canonicalMismatches: [],
      derivedMismatches: [],
      unknownMismatches: [],
      verifiedEntryCount: 0,
    };
  }

  const mismatches = await verifyChecksums(entries, checksums);

  const missingCanonicalEntries: string[] = [];
  const canonicalMismatches: string[] = [];
  const derivedMismatches: string[] = [];
  const unknownMismatches: string[] = [];

  for (const path of mismatches) {
    const role = classifyEntryPath(path);
    if (role === 'derived') {
      derivedMismatches.push(path);
      continue;
    }
    if (role === 'unknown') {
      unknownMismatches.push(path);
      continue;
    }
    // A canonical entry that is absent entirely and one whose bytes changed are
    // different repairs - regenerate versus restore - so they are reported
    // apart even though both are fatal.
    if (entries.has(path)) {
      canonicalMismatches.push(path);
    } else {
      missingCanonicalEntries.push(path);
    }
  }

  return {
    ok:
      missingCanonicalEntries.length === 0 &&
      canonicalMismatches.length === 0 &&
      unknownMismatches.length === 0,
    checksumsPresent: true,
    missingCanonicalEntries,
    canonicalMismatches,
    derivedMismatches,
    unknownMismatches,
    verifiedEntryCount: checksums.length,
  };
}

/** One line naming what failed, for a diagnostic that has to fit in a result. */
export function describeEntryDigestFailure(report: ArqfsEntryDigestReport): string {
  const parts: string[] = [];
  if (report.missingCanonicalEntries.length > 0) {
    parts.push(`missing canonical entries: ${report.missingCanonicalEntries.join(', ')}`);
  }
  if (report.canonicalMismatches.length > 0) {
    parts.push(`canonical digest mismatch: ${report.canonicalMismatches.join(', ')}`);
  }
  if (report.unknownMismatches.length > 0) {
    parts.push(`unrecognised entry digest mismatch: ${report.unknownMismatches.join(', ')}`);
  }
  return parts.join('; ') || 'entry digests verified';
}
