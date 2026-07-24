import type { ArqfsLifecycleEvent } from './arqfs-lifecycle-event';

/**
 * ARQFS-018: an opt-in, redacted support bundle - "opt-in" enforced by this
 * module never being called automatically anywhere in this repository, only
 * ever from an explicit user action a caller wires up (a "Copy diagnostics"
 * button, e.g.). Capability data is caller-supplied rather than this module
 * reaching for it itself, so the bundle can genuinely never include a raw
 * driver connection, a file handle, or project bytes - it can only include
 * what the caller chose to pass in, which is a plain, already-redacted
 * summary object by construction (`ArqfsSupportBundleCapabilities` has no
 * field that could hold a path, a name, or content).
 */
export interface ArqfsSupportBundleCapabilities {
  readonly usedVfs: string;
  readonly formatMajor: number;
  readonly formatSchema: number;
  readonly nativeSqliteAvailable: boolean;
  /** From navigator.userAgent or similar - browser build/version, never a full UA string that could carry more than intended. */
  readonly runtime: string;
}

export interface ArqfsSupportBundleHealth {
  readonly integrityOk: boolean | null;
  readonly interruptedWrite: boolean | null;
  readonly missingRequiredEntryCount: number | null;
}

export interface ArqfsSupportBundleInput {
  readonly capabilities: ArqfsSupportBundleCapabilities;
  readonly health: ArqfsSupportBundleHealth;
  readonly events: readonly ArqfsLifecycleEvent[];
  readonly generatedAtUnixMs?: number;
}

export interface ArqfsSupportBundle {
  readonly generatedAtUnixMs: number;
  readonly capabilities: ArqfsSupportBundleCapabilities;
  readonly health: ArqfsSupportBundleHealth;
  readonly events: readonly ArqfsLifecycleEvent[];
  /**
   * What a UI must show before a user agrees to share this - the master
   * prompt's own "bundle preview clearly states what is included"
   * acceptance criterion, made into data rather than left as a UI
   * responsibility a future implementer could word however they like.
   */
  readonly preview: {
    readonly includes: readonly string[];
    readonly excludes: readonly string[];
    readonly eventCount: number;
  };
}

const BUNDLE_EXCLUDES: readonly string[] = [
  'project file bytes or geometry',
  'file names or filesystem paths',
  'authentication tokens or credentials',
  'project, client or address names',
] as const;

export function buildArqfsSupportBundle(input: ArqfsSupportBundleInput): ArqfsSupportBundle {
  return {
    generatedAtUnixMs: input.generatedAtUnixMs ?? Date.now(),
    capabilities: input.capabilities,
    health: input.health,
    events: input.events,
    preview: {
      includes: [
        `capability info (VFS: ${input.capabilities.usedVfs}, format ${input.capabilities.formatMajor}.${input.capabilities.formatSchema})`,
        `integrity/health status`,
        `${input.events.length} recent lifecycle event${input.events.length === 1 ? '' : 's'} (codes, sizes, timings only)`,
      ],
      excludes: BUNDLE_EXCLUDES,
      eventCount: input.events.length,
    },
  };
}
