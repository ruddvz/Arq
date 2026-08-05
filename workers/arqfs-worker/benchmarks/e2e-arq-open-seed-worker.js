// ARQ-217/196: seeds one project's OPFS file so the REAL arqfs Worker can then be
// asked to open it. This file is deliberately NOT the code under test - the code
// under test is the real bundled arqfs-worker-entry.ts that e2e-arq-open.html
// constructs afterwards. This seeder only puts a file into the state a user could
// hand the product: a file written by a newer writer, a file written by a newer
// format, or a file that is valid SQLite but not an Arq project at all.
//
// Two things here must match arqfs-worker-entry.ts exactly or the seeding lands in a
// different file than the one the real Worker opens, and the check would prove
// nothing: the opfs-sahpool VFS name (a SAH pool is keyed by its own name, so a
// different name is a different pool and a different set of files) and the
// `/arq-projects/<projectId>.sqlite3` filename derived from the Worker's own URL.
import sqlite3InitModule from '/sqlite-wasm/index.mjs';

const OPFS_SAHPOOL_VFS_NAME = 'arqfs-opfs-sahpool';

function projectIdFromWorkerUrl() {
  const projectId = new URLSearchParams(self.location.search).get('project');
  if (projectId === null) throw new Error('missing ?project= in seed worker URL');
  return projectId;
}

function opfsFilenameForProject(projectId) {
  return `/arq-projects/${projectId}.sqlite3`;
}

self.onmessage = async (event) => {
  const request = event.data;
  let db = null;
  try {
    const projectId = projectIdFromWorkerUrl();
    const sqlite3 = await sqlite3InitModule();
    const poolUtil = await sqlite3.installOpfsSAHPoolVfs({ name: OPFS_SAHPOOL_VFS_NAME });
    db = new poolUtil.OpfsSAHPoolDb(opfsFilenameForProject(projectId));

    if (request.type === 'setMeta') {
      // The real Worker created this schema on its first open. Moving one
      // version floor upward is exactly what a file written by a newer Arq
      // build looks like to this reader.
      db.exec('UPDATE arqfs_meta SET value = ? WHERE key = ?', {
        bind: [String(request.value), request.key],
      });
    } else if (request.type === 'makeForeignSqlite') {
      // Valid SQLite, non-zero application_id, no arqfs_meta: the real Worker
      // must refuse rather than initialise a schema over someone else's file.
      db.exec(`PRAGMA application_id = ${Number(request.applicationId)}`);
      db.exec('CREATE TABLE IF NOT EXISTS not_arq (id INTEGER PRIMARY KEY)');
    } else if (request.type === 'exportBytes') {
      // The bytes a file picker would hand the product: this project's whole
      // database, read straight out of OPFS. Produced by the seeder rather than
      // by the code under test, so the import case is importing a file from
      // outside the Worker instead of one the Worker handed itself.
      const bytes = poolUtil.exportFile(opfsFilenameForProject(projectId));
      db.close();
      db = null;
      self.postMessage({ id: request.id, ok: true, projectId, bytes }, [bytes.buffer]);
      return;
    } else {
      throw new Error(`unknown seed request: ${request.type}`);
    }

    let meta = null;
    try {
      meta = db.selectObjects('SELECT key, value FROM arqfs_meta');
    } catch {
      // A foreign SQLite file has no arqfs_meta, which is the point of that case.
    }
    db.close();
    db = null;
    self.postMessage({ id: request.id, ok: true, projectId, meta });
  } catch (error) {
    try {
      if (db !== null) db.close();
    } catch {
      // Reporting the original failure matters more than a clean close here.
    }
    self.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
