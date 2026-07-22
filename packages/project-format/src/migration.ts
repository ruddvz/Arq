/**
 * ARQ-080: implement migration framework.
 *
 * Each registered migration matches blueprint section 74's per-migration
 * requirements list as closely as this pure module can: sourceVersion,
 * targetVersion, and a transform function ("pure transformation where
 * possible"). What section 74 also asks for - backup, and "never
 * overwrite the only copy during migration" - is a caller responsibility
 * this module cannot enforce itself: it has no I/O, so it never touches
 * "the only copy" of anything; a caller applying a migration's result to
 * disk/IndexedDB is the one who must write to a new location and keep
 * the original until the write succeeds. "Test fixture" is satisfied by
 * this file's own tests exercising the registry with example migrations,
 * not something the framework generates on a caller's behalf.
 */

export interface Migration<TFrom = unknown, TTo = unknown> {
  readonly sourceVersion: number;
  readonly targetVersion: number;
  readonly migrate: (data: TFrom) => TTo;
}

export type MigrationResult =
  | {
      readonly status: 'migrated';
      readonly data: unknown;
      readonly appliedVersions: readonly number[];
    }
  | { readonly status: 'already-current'; readonly data: unknown }
  | { readonly status: 'failed'; readonly reason: string; readonly failedAtVersion: number };

export function createMigrationRegistry() {
  const migrations = new Map<number, Migration>();

  // register is generic so callers can pass a migration typed to its
  // actual source/target shapes (Migration<TFrom, TTo>) rather than
  // being forced to accept `unknown` at the call site; the registry
  // itself stores migrations type-erased since it holds a heterogeneous
  // mix of versions side by side.
  function register<TFrom, TTo>(migration: Migration<TFrom, TTo>): void {
    if (migrations.has(migration.sourceVersion)) {
      throw new RangeError(
        `a migration from version ${migration.sourceVersion} is already registered`,
      );
    }
    migrations.set(migration.sourceVersion, migration as unknown as Migration);
  }

  /** Chains registered migrations from `fromVersion` up to `toVersion`, applying each in order. */
  function migrate(data: unknown, fromVersion: number, toVersion: number): MigrationResult {
    if (fromVersion === toVersion) {
      return { status: 'already-current', data };
    }
    if (fromVersion > toVersion) {
      return {
        status: 'failed',
        reason: `cannot migrate backwards from ${fromVersion} to ${toVersion}`,
        failedAtVersion: fromVersion,
      };
    }
    let current = data;
    let version = fromVersion;
    const appliedVersions: number[] = [];
    while (version < toVersion) {
      const migration = migrations.get(version);
      if (!migration) {
        return {
          status: 'failed',
          reason: `no migration registered from version ${version}`,
          failedAtVersion: version,
        };
      }
      try {
        current = migration.migrate(current);
      } catch (error) {
        return {
          status: 'failed',
          reason: error instanceof Error ? error.message : String(error),
          failedAtVersion: version,
        };
      }
      appliedVersions.push(migration.targetVersion);
      version = migration.targetVersion;
    }
    return { status: 'migrated', data: current, appliedVersions };
  }

  return { register, migrate };
}
