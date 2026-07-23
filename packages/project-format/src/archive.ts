/**
 * ARQ-078: implement arq export. ARQ-079: implement arq import.
 *
 * Operates on a logical archive - a Map from path to raw bytes - rather
 * than a real .zip container: no zip library has been chosen yet (that
 * decision, and the zip-bomb protection that belongs at the actual
 * compressed-container-decoding layer, is out of scope here per this
 * issue's non-goal against introducing unreviewed dependencies). What IS
 * fully implemented and tested at this layer: path-traversal protection
 * (every entry name is checked before anything is read), a per-entry
 * size cap, a whole-archive total size cap, and a generic JSON
 * node-count/nesting-depth cap on every parsed section (ARQ-157) - all
 * defense-in-depth once bytes are already decoded, even though the
 * primary zip-bomb defense belongs one layer down.
 *
 * Required vs optional, straight from blueprint section 73: manifest.json
 * and model.json are required (a missing or corrupt one rejects the
 * whole archive); operations.ndjson/views.json/sheets.json/
 * checksums.json are optional-cache-like ("corrupted optional cache does
 * not prevent opening") - a corrupt one is reported but does not reject
 * the archive. Anything else ("unknown optional sections ignored
 * safely") is reported as ignored, not rejected.
 */

import { parseManifest, serializeManifest, type ArqManifest } from './manifest';
import { computeChecksums, serializeChecksums } from './checksum';
import {
  exceedsJsonComplexityLimits,
  totalArchiveBytes,
  MAX_ARCHIVE_TOTAL_BYTES,
} from './complexity-limits';

/** Defense-in-depth per-entry size cap once bytes are already decoded - the primary zip-bomb defense belongs at the (not yet chosen) zip container layer. */
export const MAX_ENTRY_BYTES = 500 * 1024 * 1024;

const OPTIONAL_JSON_FILES = ['views.json', 'sheets.json'] as const;
const KNOWN_TOP_LEVEL_ENTRIES = new Set([
  'manifest.json',
  'model.json',
  'operations.ndjson',
  'views.json',
  'sheets.json',
  'checksums.json',
  'imports',
  'thumbnails',
]);

export interface BuildArchiveInput {
  readonly manifest: ArqManifest;
  readonly model: unknown;
  readonly operations?: readonly unknown[];
  readonly views?: unknown;
  readonly sheets?: unknown;
}

function encodeEntries(input: BuildArchiveInput): Map<string, Uint8Array> {
  const encoder = new TextEncoder();
  const entries = new Map<string, Uint8Array>();
  entries.set('manifest.json', encoder.encode(serializeManifest(input.manifest)));
  entries.set('model.json', encoder.encode(JSON.stringify(input.model)));
  if (input.operations !== undefined) {
    entries.set(
      'operations.ndjson',
      encoder.encode(input.operations.map((operation) => JSON.stringify(operation)).join('\n')),
    );
  }
  if (input.views !== undefined) {
    entries.set('views.json', encoder.encode(JSON.stringify(input.views)));
  }
  if (input.sheets !== undefined) {
    entries.set('sheets.json', encoder.encode(JSON.stringify(input.sheets)));
  }
  return entries;
}

/** Builds the full archive entry map, including a freshly computed checksums.json covering every other entry. */
export async function exportArchive(input: BuildArchiveInput): Promise<Map<string, Uint8Array>> {
  const entries = encodeEntries(input);
  const checksums = await computeChecksums(entries);
  entries.set('checksums.json', new TextEncoder().encode(serializeChecksums(checksums)));
  return entries;
}

function isPathSafe(path: string): boolean {
  if (
    path.length === 0 ||
    path.startsWith('/') ||
    path.startsWith('\\') ||
    /^[a-zA-Z]:/.test(path)
  ) {
    return false;
  }
  const segments = path.split(/[/\\]/);
  return segments.every((segment) => segment !== '..' && segment !== '');
}

export type ArchiveOpenResult =
  | {
      readonly status: 'opened';
      readonly manifest: ArqManifest;
      readonly model: unknown;
      readonly operations: readonly unknown[];
      readonly views: unknown;
      readonly sheets: unknown;
      readonly ignoredPaths: readonly string[];
      readonly corruptOptionalPaths: readonly string[];
    }
  | { readonly status: 'rejected'; readonly reason: string };

export async function importArchive(
  entries: ReadonlyMap<string, Uint8Array>,
): Promise<ArchiveOpenResult> {
  if (totalArchiveBytes(entries) > MAX_ARCHIVE_TOTAL_BYTES) {
    return { status: 'rejected', reason: 'archive exceeds total size limit' };
  }

  for (const [path, content] of entries) {
    if (!isPathSafe(path)) {
      return { status: 'rejected', reason: `unsafe archive path: ${path}` };
    }
    if (content.byteLength > MAX_ENTRY_BYTES) {
      return { status: 'rejected', reason: `archive entry too large: ${path}` };
    }
  }

  const decoder = new TextDecoder();

  const manifestBytes = entries.get('manifest.json');
  if (!manifestBytes) {
    return { status: 'rejected', reason: 'missing required manifest.json' };
  }
  const manifest = parseManifest(decoder.decode(manifestBytes));
  if (!manifest) {
    return { status: 'rejected', reason: 'corrupt manifest.json' };
  }

  const modelBytes = entries.get('model.json');
  if (!modelBytes) {
    return { status: 'rejected', reason: 'missing required model.json' };
  }
  let model: unknown;
  try {
    model = JSON.parse(decoder.decode(modelBytes));
  } catch {
    return { status: 'rejected', reason: 'corrupt model.json' };
  }
  const modelComplexity = exceedsJsonComplexityLimits(model);
  if (modelComplexity.exceeded) {
    return { status: 'rejected', reason: `model.json ${modelComplexity.reason}` };
  }

  const corruptOptionalPaths: string[] = [];

  let operations: readonly unknown[] = [];
  const operationsBytes = entries.get('operations.ndjson');
  if (operationsBytes) {
    try {
      const text = decoder.decode(operationsBytes);
      operations = text.length === 0 ? [] : text.split('\n').map((line) => JSON.parse(line));
      if (exceedsJsonComplexityLimits(operations).exceeded) {
        operations = [];
        corruptOptionalPaths.push('operations.ndjson');
      }
    } catch {
      corruptOptionalPaths.push('operations.ndjson');
    }
  }

  const optionalJson: { views: unknown; sheets: unknown } = { views: undefined, sheets: undefined };
  for (const file of OPTIONAL_JSON_FILES) {
    const bytes = entries.get(file);
    if (!bytes) {
      continue;
    }
    const key = file === 'views.json' ? 'views' : 'sheets';
    try {
      const parsed = JSON.parse(decoder.decode(bytes));
      if (exceedsJsonComplexityLimits(parsed).exceeded) {
        corruptOptionalPaths.push(file);
        continue;
      }
      optionalJson[key] = parsed;
    } catch {
      corruptOptionalPaths.push(file);
    }
  }

  const ignoredPaths = [...entries.keys()].filter((path) => {
    const topLevel = path.split(/[/\\]/)[0] ?? path;
    return !KNOWN_TOP_LEVEL_ENTRIES.has(topLevel);
  });

  return {
    status: 'opened',
    manifest,
    model,
    operations,
    views: optionalJson.views,
    sheets: optionalJson.sheets,
    ignoredPaths,
    corruptOptionalPaths,
  };
}
