/**
 * ARQ-076: define arq manifest.
 *
 * manifest.json's required fields, straight from blueprint section 73's
 * ".arq format v0" requirements list: "schema version; application
 * version; project ID; creation time." parseManifest is deliberately
 * defensive (returns null rather than throwing on anything malformed) so
 * a corrupt manifest fails the archive open safely rather than crashing
 * - manifest.json is the one file import.ts (ARQ-079) treats as
 * required, everything else in the archive is optional per the same
 * section's "unknown optional sections ignored safely; corrupted
 * optional cache does not prevent opening."
 *
 * Schema version / migration effect: `schemaVersion` is the field
 * migration.ts (ARQ-080) reads to decide which migrations to run before
 * treating the rest of the archive as current-version data. Bumping it
 * is what triggers a migration; this module does not itself decide when
 * to bump it.
 */

export interface ArqManifest {
  readonly schemaVersion: number;
  readonly applicationVersion: string;
  readonly projectId: string;
  readonly createdAt: string;
}

export interface CreateManifestInput {
  readonly projectId: string;
  readonly applicationVersion: string;
  readonly schemaVersion?: number;
  readonly createdAt?: string;
}

export const CURRENT_SCHEMA_VERSION = 0;

export function createManifest(input: CreateManifestInput): ArqManifest {
  return {
    schemaVersion: input.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    applicationVersion: input.applicationVersion,
    projectId: input.projectId,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function serializeManifest(manifest: ArqManifest): string {
  return JSON.stringify(manifest, null, 2);
}

/** Parses and structurally validates manifest.json content; returns null (never throws) on anything malformed - a corrupt manifest must fail the archive open safely, not crash it. */
export function parseManifest(content: string): ArqManifest | null {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return null;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    typeof (value as { schemaVersion: unknown }).schemaVersion === 'number' &&
    'applicationVersion' in value &&
    typeof (value as { applicationVersion: unknown }).applicationVersion === 'string' &&
    'projectId' in value &&
    typeof (value as { projectId: unknown }).projectId === 'string' &&
    'createdAt' in value &&
    typeof (value as { createdAt: unknown }).createdAt === 'string'
  ) {
    return value as ArqManifest;
  }
  return null;
}
