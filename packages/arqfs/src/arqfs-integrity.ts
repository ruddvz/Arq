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
  const quickRows = driver.query<{ readonly integrity_check: string }>('PRAGMA quick_check');
  const quickCheck = quickRows.map((row) => String(row.integrity_check));
  const foreignKeyViolations = driver.query('PRAGMA foreign_key_check') as readonly Readonly<
    Record<string, unknown>
  >[];
  return {
    ok: quickCheck.length === 1 && quickCheck[0] === 'ok' && foreignKeyViolations.length === 0,
    quickCheck,
    foreignKeyViolations,
  };
}
