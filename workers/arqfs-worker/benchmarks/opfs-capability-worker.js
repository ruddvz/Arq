// ARQ-196/219: real headless-Chromium capability check, not a bundled build of the
// real @arq/arqfs-worker TS package (no bundler exists yet in this repo - that's
// Phase 7). Deliberately a throwaway single-table schema, per this issue's own scope:
// prove the sqlite-wasm + opfs-sahpool mechanics work for real in this sandboxed
// environment, not exercise the real arqfs schema (that merge is ARQ-197 onward).
import sqlite3InitModule from '/sqlite-wasm/index.mjs';

const VFS_NAME = 'arqfs-capability-sahpool';
const DB_FILENAME = '/capability-check.sqlite3';

async function openThrowawayDb() {
  const sqlite3 = await sqlite3InitModule();
  try {
    const poolUtil = await sqlite3.installOpfsSAHPoolVfs({ name: VFS_NAME });
    const db = new poolUtil.OpfsSAHPoolDb(DB_FILENAME);
    return { db, usedVfs: 'opfs-sahpool', libVersion: sqlite3.version.libVersion };
  } catch (error) {
    const db = new sqlite3.oo1.DB(':memory:', 'ct');
    return {
      db,
      usedVfs: `memory-fallback (opfs-sahpool failed: ${error instanceof Error ? error.message : String(error)})`,
      libVersion: sqlite3.version.libVersion,
    };
  }
}

self.onmessage = async (event) => {
  const request = event.data;
  try {
    const { db, usedVfs, libVersion } = await openThrowawayDb();
    if (request.type === 'write') {
      db.exec(
        'CREATE TABLE IF NOT EXISTS capability_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)',
      );
      db.exec('INSERT INTO capability_probe (value) VALUES (?)', { bind: [request.value] });
      const rows = db.selectObjects('SELECT id, value FROM capability_probe ORDER BY id');
      db.close();
      self.postMessage({ id: request.id, ok: true, usedVfs, libVersion, rows });
    } else if (request.type === 'read') {
      let rows = [];
      let tableExists = true;
      try {
        rows = db.selectObjects('SELECT id, value FROM capability_probe ORDER BY id');
      } catch {
        tableExists = false;
      }
      db.close();
      self.postMessage({ id: request.id, ok: true, usedVfs, libVersion, rows, tableExists });
    } else {
      self.postMessage({
        id: request.id,
        ok: false,
        error: `unknown request type: ${request.type}`,
      });
    }
  } catch (error) {
    self.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
