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
 * - `PRAGMA query_only` is set explicitly either way rather than only turned on.
 *   A pragma is connection state, not a one-way switch: leaving it alone on the
 *   writable path means a connection that was once opened read-only stays
 *   read-only for the rest of its life, so re-evaluating capabilities would have
 *   no effect. Setting both directions makes the policy a function of its
 *   argument, which is also what makes it safe to re-apply.
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
  driver.exec(options.readOnly ? 'PRAGMA query_only = ON' : 'PRAGMA query_only = OFF');
}
