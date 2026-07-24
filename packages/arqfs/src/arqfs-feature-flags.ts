import type { ArqfsDriver } from './arqfs-driver';

/**
 * ARQ-221: feature flag compatibility matrix. Names this build of arqfs understands
 * well enough to safely open a file that declares them as required. Extend this set
 * whenever a new optional capability is added that changes canonical semantics.
 */
export const KNOWN_FEATURE_NAMES: ReadonlySet<string> = new Set([
  'content-addressed-chunks-v1',
  'working-copy-v1',
]);

export interface ArqfsFeatureFlag {
  readonly name: string;
  readonly required: boolean;
}

export function declareFeatureFlag(driver: ArqfsDriver, flag: ArqfsFeatureFlag): void {
  driver.run(
    `INSERT INTO feature_flag (name, required) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET required = excluded.required`,
    [flag.name, flag.required ? 1 : 0],
  );
}

export function readFeatureFlags(driver: ArqfsDriver): readonly ArqfsFeatureFlag[] {
  return driver
    .query<{ readonly name: string; readonly required: number }>(
      'SELECT name, required FROM feature_flag',
    )
    .map((row) => ({ name: row.name, required: row.required === 1 }));
}

/**
 * Required features this reader does not recognise - a reader that proceeded
 * anyway could silently misinterpret the file's canonical semantics, so these are
 * treated the same as an unrecognised major version (refuse to open), not merely
 * logged. An unrecognised *optional* feature is never returned here - matching
 * @arq/project-format's "unknown optional sections ignored safely" rule.
 */
export function unsupportedRequiredFeatures(
  flags: readonly ArqfsFeatureFlag[],
  knownFeatureNames: ReadonlySet<string> = KNOWN_FEATURE_NAMES,
): readonly string[] {
  return flags
    .filter((flag) => flag.required && !knownFeatureNames.has(flag.name))
    .map((flag) => flag.name);
}
