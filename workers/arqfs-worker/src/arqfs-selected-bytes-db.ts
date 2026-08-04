/**
 * Turns the bytes a user selected into a SQLite connection that cannot write
 * anywhere - not to the user's file, and not to this origin's storage.
 *
 * Why memory rather than a staged copy in OPFS: ADR-0028 (persistence
 * responsibility split) is Proposed, so no owner has decided who owns a durable
 * local working copy. A staged OPFS copy would be that decision made silently,
 * in code, ahead of the ADR. `sqlite3_deserialize` needs none of it: the pages
 * live in the Worker's own wasm heap for the life of the connection, so opening
 * a file establishes no persistence authority at all and closing it leaves
 * nothing behind. The cost is honest and bounded - the whole database is
 * resident, so this path is for inspection, not for the eventual editable
 * working copy, which is Phase 2's job once the ADR is accepted.
 *
 * `SQLITE_DESERIALIZE_READONLY` is the load-bearing flag. Without it SQLite may
 * write into the deserialized buffer, and a build that means to be a reader
 * would be one bug away from mutating the copy it is inspecting.
 * `SQLITE_DESERIALIZE_FREEONCLOSE` hands the allocation back on close, so
 * opening a hundred projects in one session leaks nothing.
 */
import type { Sqlite3Oo1DatabaseLike } from './arqfs-opfs-driver';

/** The `oo1.DB` surface this module needs beyond what the driver already uses. */
export interface Sqlite3Oo1DeserializableDatabase extends Sqlite3Oo1DatabaseLike {
  /** The `sqlite3*` this connection wraps, which is what the C-style API takes. */
  readonly pointer: number;
  /** Throws a descriptive error for a non-zero SQLite result code. */
  checkRc(rc: number): void;
}

export interface Sqlite3DeserializeModule {
  readonly capi: {
    readonly SQLITE_DESERIALIZE_FREEONCLOSE: number;
    readonly SQLITE_DESERIALIZE_READONLY: number;
    sqlite3_deserialize(
      db: number,
      schema: string,
      data: number,
      dbSize: number,
      bufferSize: number,
      flags: number,
    ): number;
  };
  readonly wasm: {
    allocFromTypedArray(bytes: Uint8Array): number;
    dealloc(pointer: number): void;
  };
  readonly oo1: {
    readonly DB: new (filename?: string) => Sqlite3Oo1DeserializableDatabase;
  };
}

/**
 * `bytes` is copied into the wasm heap, so the caller's array is untouched and
 * may be released immediately. The connection owns the copy from here on.
 *
 * A failed deserialize frees the allocation before rethrowing: `FREEONCLOSE`
 * only applies once SQLite has taken ownership, which a failure means it has
 * not.
 */
export function openSelectedBytesReadOnly(
  sqlite3: Sqlite3DeserializeModule,
  bytes: Uint8Array,
): Sqlite3Oo1DeserializableDatabase {
  // No filename: `oo1.DB` defaults to a transient in-memory database, which is
  // exactly the empty shell `sqlite3_deserialize` replaces the contents of.
  const db = new sqlite3.oo1.DB();
  let pointer = 0;
  try {
    pointer = sqlite3.wasm.allocFromTypedArray(bytes);
    const rc = sqlite3.capi.sqlite3_deserialize(
      db.pointer,
      'main',
      pointer,
      bytes.byteLength,
      bytes.byteLength,
      sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_READONLY,
    );
    db.checkRc(rc);
    return db;
  } catch (error) {
    if (pointer !== 0) {
      sqlite3.wasm.dealloc(pointer);
    }
    db.close();
    throw error;
  }
}
