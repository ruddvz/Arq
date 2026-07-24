import type { ArqfsDriver } from './arqfs-driver';
import {
  ARQ_APPLICATION_ID,
  ARQFS_CURRENT_FORMAT_VERSION,
  type ArqFormatVersion,
} from './arqfs-header';
import {
  readFeatureFlags,
  unsupportedRequiredFeatures,
  KNOWN_FEATURE_NAMES,
} from './arqfs-feature-flags';

/** Reproduces contracts/arqfs.ts's ArqOpenCapabilities shape - reference-only, not imported (see arqfs-header.ts). */
export interface ArqOpenCapabilities {
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly canMigrate: boolean;
  readonly safeModeRequired: boolean;
  readonly unsupportedRequiredFeatures: readonly string[];
}

export type ArqfsOpenResult =
  | {
      readonly status: 'opened';
      readonly header: ArqFormatVersion;
      readonly capabilities: ArqOpenCapabilities;
    }
  | { readonly status: 'rejected'; readonly reason: string };

/**
 * A reader whose own major version is below the file's minReaderMajor must refuse to
 * open at all; one below minWriterMajor may still read but must refuse to write,
 * rather than risk silently corrupting semantics it does not fully understand. An
 * unrecognised *required* feature flag (ARQ-221) is treated the same as a too-new
 * major version - refuse to open at all - since a reader proceeding anyway could
 * silently misinterpret the file's canonical semantics.
 */
export function evaluateOpenCapabilities(
  fileHeader: ArqFormatVersion,
  readerFormatVersion: ArqFormatVersion,
  unsupportedFeatures: readonly string[] = [],
): ArqOpenCapabilities {
  const versionCanRead = readerFormatVersion.major >= fileHeader.minReaderMajor;
  const canRead = versionCanRead && unsupportedFeatures.length === 0;
  const canWrite = canRead && readerFormatVersion.major >= fileHeader.minWriterMajor;
  const canMigrate = canWrite && fileHeader.schema < readerFormatVersion.schema;
  const unsupportedRequiredFeatures: string[] = [];
  if (!versionCanRead) {
    unsupportedRequiredFeatures.push('format-major-too-new-for-reader');
  }
  unsupportedRequiredFeatures.push(...unsupportedFeatures);
  return {
    canRead,
    canWrite,
    canMigrate,
    safeModeRequired: !canRead,
    unsupportedRequiredFeatures,
  };
}

/**
 * Reads an existing arqfs database's header and evaluates open capabilities against
 * this reader's own format version. Never throws for a database that opened
 * successfully but does not look like a valid arqfs file (wrong application ID,
 * missing arqfs_meta, non-numeric version fields) - each is a 'rejected' result, not
 * an exception. This does NOT cover a file that is not valid SQLite at all - that can
 * still throw out of the driver's own constructor (e.g. createNodeArqfsDriver); byte-
 * level hardening against a completely malformed or malicious file is ARQ-217's job,
 * not this prototype's.
 */
export function openArqfs(
  driver: ArqfsDriver,
  readerFormatVersion: ArqFormatVersion = ARQFS_CURRENT_FORMAT_VERSION,
): ArqfsOpenResult {
  let applicationId: unknown;
  try {
    applicationId = driver.pragma('application_id');
  } catch (error) {
    return {
      status: 'rejected',
      reason: `could not read application_id: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (applicationId !== ARQ_APPLICATION_ID) {
    return { status: 'rejected', reason: 'not an Arq file: application_id does not match' };
  }

  let schema: unknown;
  let metaRows: readonly { key: string; value: string }[];
  try {
    schema = driver.pragma('user_version');
    metaRows = driver.query<{ key: string; value: string }>('SELECT key, value FROM arqfs_meta');
  } catch (error) {
    return {
      status: 'rejected',
      reason: `could not read arqfs_meta: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const meta = new Map(metaRows.map((row) => [row.key, row.value]));
  const major = Number(meta.get('format_major'));
  const minor = Number(meta.get('format_minor'));
  const minReaderMajor = Number(meta.get('min_reader_major'));
  const minWriterMajor = Number(meta.get('min_writer_major'));

  if (
    typeof schema !== 'number' ||
    !Number.isFinite(major) ||
    !Number.isFinite(minor) ||
    !Number.isFinite(minReaderMajor) ||
    !Number.isFinite(minWriterMajor)
  ) {
    return {
      status: 'rejected',
      reason: 'arqfs_meta is missing or contains non-numeric version fields',
    };
  }

  const header: ArqFormatVersion = { major, minor, schema, minReaderMajor, minWriterMajor };

  // feature_flag exists on every file created by createArqfsSchemaV1, but this stays
  // defensive (treats an unreadable/missing table as "no flags declared") rather than
  // assuming every file this reader ever encounters was created by this exact schema.
  let unsupportedFeatures: readonly string[] = [];
  try {
    unsupportedFeatures = unsupportedRequiredFeatures(
      readFeatureFlags(driver),
      KNOWN_FEATURE_NAMES,
    );
  } catch {
    unsupportedFeatures = [];
  }

  return {
    status: 'opened',
    header,
    capabilities: evaluateOpenCapabilities(header, readerFormatVersion, unsupportedFeatures),
  };
}
