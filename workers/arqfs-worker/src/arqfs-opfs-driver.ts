import type { ArqfsDriver, ArqfsRow, ArqfsRunResult } from '@arq/arqfs';

/**
 * The sqlite-wasm OO1 API surface this driver actually uses - `Database`,
 * `OpfsDatabase` and `OpfsSAHPoolDatabase` all share it, so this driver works
 * unchanged regardless of which VFS produced the instance (see arqfs-worker-entry.ts,
 * which picks the VFS).
 */
export interface Sqlite3Oo1DatabaseLike {
  exec(sql: string, opts?: { readonly bind?: readonly unknown[] }): unknown;
  selectObjects(sql: string, bind?: readonly unknown[]): readonly Record<string, unknown>[];
  selectValue(sql: string): unknown;
  changes(): number | bigint;
  transaction<T>(callback: () => T): T;
  close(): void;
}

/**
 * Wraps a live sqlite-wasm OO1 database connection as an `ArqfsDriver` - the exact
 * same interface `arqfs-node-driver.ts` (better-sqlite3) implements, so
 * arqfs-schema.ts/arqfs-open.ts/arqfs-archive-store.ts from @arq/arqfs run unchanged
 * against either. This is what makes "the schema/open-capability code doesn't change
 * when the Worker/OPFS runtime lands" (ARQ-195's own claim) true rather than aspirational.
 */
export function createSqliteWasmArqfsDriver(db: Sqlite3Oo1DatabaseLike): ArqfsDriver {
  return {
    exec(sql: string): void {
      db.exec(sql);
    },
    run(sql: string, params: readonly unknown[] = []): ArqfsRunResult {
      db.exec(sql, { bind: params });
      return { changes: Number(db.changes()) };
    },
    query<T extends ArqfsRow = ArqfsRow>(
      sql: string,
      params: readonly unknown[] = [],
    ): readonly T[] {
      return db.selectObjects(sql, params) as T[];
    },
    pragma(name: string): unknown {
      return db.selectValue(`PRAGMA ${name}`);
    },
    transaction<T>(fn: () => T): T {
      return db.transaction(fn);
    },
    close(): void {
      db.close();
    },
  };
}
