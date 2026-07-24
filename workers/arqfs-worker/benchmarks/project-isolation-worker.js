// ARQ-196/220: proves the actual field bug found in arqfs-worker-entry.ts before
// this fix - a single fixed OPFS filename shared by every project. OPFS storage is
// shared at the origin, not per-Worker, so two projects opened through the same
// filename would silently read and write the same underlying file.
//
// Deliberately a throwaway single-table schema, not a bundled build of the real
// @arq/arqfs-worker TS package (no bundler exists yet in this repo), matching
// opfs-capability-worker.js's own established convention for this kind of raw
// browser check. What this file must reproduce faithfully from the real
// arqfs-project-filename.ts is the *mechanism under test*: reading the project id
// from this Worker's own URL and deriving `/arq-projects/<projectId>.sqlite3` from
// it, not the real arqfs schema.
import sqlite3InitModule from '/sqlite-wasm/index.mjs';

const VFS_NAME = 'arqfs-isolation-sahpool';

function projectIdFromWorkerUrl() {
  const projectId = new URLSearchParams(self.location.search).get('project');
  if (projectId === null) {
    throw new Error('missing ?project= in worker URL');
  }
  return projectId;
}

function opfsFilenameForProject(projectId) {
  return `/arq-projects/${projectId}.sqlite3`;
}

async function openProjectDb(projectId) {
  const sqlite3 = await sqlite3InitModule();
  const poolUtil = await sqlite3.installOpfsSAHPoolVfs({ name: VFS_NAME });
  const db = new poolUtil.OpfsSAHPoolDb(opfsFilenameForProject(projectId));
  return { db, libVersion: sqlite3.version.libVersion };
}

self.onmessage = async (event) => {
  const request = event.data;
  try {
    const projectId = projectIdFromWorkerUrl();
    const { db, libVersion } = await openProjectDb(projectId);
    if (request.type === 'write') {
      db.exec(
        'CREATE TABLE IF NOT EXISTS project_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)',
      );
      db.exec('INSERT INTO project_probe (value) VALUES (?)', { bind: [request.value] });
      const rows = db.selectObjects('SELECT id, value FROM project_probe ORDER BY id');
      db.close();
      self.postMessage({ id: request.id, ok: true, projectId, libVersion, rows });
    } else if (request.type === 'read') {
      let rows = [];
      try {
        rows = db.selectObjects('SELECT id, value FROM project_probe ORDER BY id');
      } catch {
        // Table not created yet in this project's file - an empty result is correct.
      }
      db.close();
      self.postMessage({ id: request.id, ok: true, projectId, libVersion, rows });
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
