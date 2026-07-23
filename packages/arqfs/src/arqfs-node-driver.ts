import Database from 'better-sqlite3';
import type { ArqfsDriver, ArqfsRow, ArqfsRunResult } from './arqfs-driver';

/**
 * better-sqlite3 is a devDependency only (see package.json) - this driver exists to
 * prove arqfs-schema.ts and arqfs-open.ts natively and fast in Vitest. It is not what
 * ships to a browser; ARQ-196's Worker/OPFS driver implements the same `ArqfsDriver`
 * shape against sqlite-wasm instead.
 */
export function createNodeArqfsDriver(filename = ':memory:'): ArqfsDriver {
  const db = new Database(filename);

  return {
    exec(sql: string): void {
      db.exec(sql);
    },
    run(sql: string, params: readonly unknown[] = []): ArqfsRunResult {
      const result = db.prepare(sql).run(...params);
      return { changes: result.changes };
    },
    query<T extends ArqfsRow = ArqfsRow>(
      sql: string,
      params: readonly unknown[] = [],
    ): readonly T[] {
      return db.prepare(sql).all(...params) as T[];
    },
    pragma(name: string): unknown {
      return db.pragma(name, { simple: true });
    },
    transaction<T>(fn: () => T): T {
      return db.transaction(fn)();
    },
    close(): void {
      db.close();
    },
  };
}
