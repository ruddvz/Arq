import type { ArqfsDriver } from './arqfs-driver';

export interface DefensiveOpenOptions {
  /** Also sets `query_only = ON`, rejecting any write - pair with resolveArqfsSafeModePlan's openReadOnly. */
  readonly readOnly: boolean;
}

/**
 * ARQ-237: SQLite defensive open policy for opening an untrusted (or not-yet-
 * trusted) .arq file. Verified directly against this exact driver, not assumed from
 * SQLite's general documentation:
 *
 * - `load_extension()` as a SQL function is rejected by SQLite's own default build
 *   ("not authorized") - confirmed directly, not merely assumed - and this codebase
 *   never calls the driver-level `loadExtension()` API either, so no untrusted file
 *   content can reach it through either path.
 * - `PRAGMA trusted_schema = OFF` (applied unconditionally here) disables
 *   trusted-schema-only SQL functions/features from being invoked by schema-embedded
 *   SQL (views, triggers, check constraints) that a malicious file could carry.
 * - `PRAGMA busy_timeout` bounds how long a caller can be blocked by lock
 *   contention, rather than hanging indefinitely.
 * - `PRAGMA query_only = ON` (only with `readOnly: true`) makes every write attempt
 *   fail cleanly - confirmed directly to actually reject a write, not merely assumed
 *   to work as documented.
 * - `PRAGMA foreign_keys = ON` enforces the REFERENCES constraints schema v1 (
 *   `resource_chunk.resource_sha256`) and v2 (`source_object_map`, `import_session`,
 *   `import_issue`, `resource_reference`, arqfs-schema-v2.ts) both declare -
 *   SQLite does not enforce a declared foreign key at all unless this is set, so
 *   without it those `ON DELETE CASCADE` clauses would silently never fire.
 * - `PRAGMA recursive_triggers = OFF` (this schema defines no triggers at all) is a
 *   defensive default against a malicious file's schema-embedded trigger content
 *   recursing into itself, at no functional cost.
 */
export function applyDefensiveOpenPolicy(driver: ArqfsDriver, options: DefensiveOpenOptions): void {
  driver.exec('PRAGMA trusted_schema = OFF');
  driver.exec('PRAGMA busy_timeout = 5000');
  driver.exec('PRAGMA foreign_keys = ON');
  driver.exec('PRAGMA recursive_triggers = OFF');
  if (options.readOnly) {
    driver.exec('PRAGMA query_only = ON');
  }
}
