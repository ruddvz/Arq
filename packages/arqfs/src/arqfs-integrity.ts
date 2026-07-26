import type { ArqfsDriver } from './arqfs-driver';

/**
 * A direct SQLite-level health check (`PRAGMA quick_check` plus
 * `PRAGMA foreign_key_check`, distinct from arqfs-recovery-report.ts's
 * higher-level Arq-semantic recovery report) - useful right after a schema
 * migration (arqfs-migration.ts, arqfs-schema-v2.ts) or before trusting an
 * imported/copied file, to catch page-level corruption or a foreign-key
 * violation `PRAGMA foreign_keys = ON` (arqfs-defensive-open.ts) would not
 * itself have caught (that PRAGMA only enforces new writes going forward, not
 * pre-existing rows in a file it did not write).
 */
export interface ArqfsIntegrityReport {
  readonly ok: boolean;
  readonly quickCheck: readonly string[];
  readonly foreignKeyViolations: readonly Readonly<Record<string, unknown>>[];
}

export function checkArqfsIntegrity(driver: ArqfsDriver): ArqfsIntegrityReport {
  // SQLite names this result column after the pragma that produced it: `quick_check`
  // here, `integrity_check` for the slower full check. Reading a fixed column name
  // silently yields `undefined` on every row and makes a healthy file look corrupt,
  // so take the row's single value positionally instead.
  const quickRows = driver.query('PRAGMA quick_check');
  const quickCheck = quickRows.map((row) => String(Object.values(row)[0]));
  const foreignKeyViolations = driver.query('PRAGMA foreign_key_check') as readonly Readonly<
    Record<string, unknown>
  >[];
  return {
    ok: quickCheck.length === 1 && quickCheck[0] === 'ok' && foreignKeyViolations.length === 0,
    quickCheck,
    foreignKeyViolations,
  };
}
