/**
 * The seam between arqfs's schema/open-capability logic and whatever SQLite runtime
 * actually executes it. `arqfs-node-driver.ts` (better-sqlite3, Node-only, tests) is
 * the only implementation today; a Worker/OPFS implementation (ARQ-196) implements
 * the same shape against sqlite-wasm instead, without this package's schema or
 * open-capability code changing.
 *
 * Synchronous by design, not async-for-uniformity: SQLite's own transaction model
 * (and better-sqlite3's) requires a transaction body to run to completion without
 * yielding, so an async callback here would let other work interleave mid-transaction
 * and observe partial state. A Worker-based driver still exposes this same
 * synchronous-callback shape to its own callers; it is the postMessage RPC one layer
 * further out that is async, not this interface.
 */
export interface ArqfsRow {
  readonly [column: string]: string | number | Uint8Array | bigint | null;
}

export interface ArqfsRunResult {
  readonly changes: number;
}

export interface ArqfsDriver {
  exec(sql: string): void;
  run(sql: string, params?: readonly unknown[]): ArqfsRunResult;
  query<T extends ArqfsRow = ArqfsRow>(sql: string, params?: readonly unknown[]): readonly T[];
  pragma(name: string): unknown;
  transaction<T>(fn: () => T): T;
  close(): void;
}
