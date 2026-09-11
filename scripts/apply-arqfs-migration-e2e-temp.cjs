const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, value) {
  fs.writeFileSync(path, value);
}

function replaceOne(path, before, after) {
  const source = read(path);
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing anchor in ${path}: ${before.slice(0, 120)}`);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Non-unique anchor in ${path}: ${before.slice(0, 120)}`);
  }
  write(path, source.slice(0, index) + after + source.slice(index + before.length));
}

const html = 'workers/arqfs-worker/benchmarks/e2e-arq-open.html';
replaceOne(
  html,
  `      window.__arqOpen = (projectId) =>
        runOnFreshWorker('./e2e-arq-open-worker.js', projectId, { type: 'open' });

      window.__arqSeed = (projectId, request) =>
`,
  `      window.__arqOpen = (projectId) =>
        runOnFreshWorker('./e2e-arq-open-worker.js', projectId, { type: 'open' });

      // Migration is session-gated: the migrate request must run on the same
      // real Worker that first opened the older schema. Terminate only after both
      // replies so this proves the shipped session gate rather than two unrelated calls.
      window.__arqOpenAndMigrate = (projectId) =>
        new Promise((resolve, reject) => {
          const worker = new Worker(
            \`./e2e-arq-open-worker.js?project=\${encodeURIComponent(projectId)}\`,
            { type: 'module' },
          );
          const timer = setTimeout(() => {
            worker.terminate();
            reject(new Error('migration worker timed out after 30000ms'));
          }, 30_000);
          const replies = [];
          worker.onmessage = (event) => {
            replies.push(event.data);
            if (replies.length === 1) {
              worker.postMessage({ id: nextId++, type: 'migrateSchemaV1ToV2' });
              return;
            }
            clearTimeout(timer);
            worker.terminate();
            resolve({ open: replies[0], migration: replies[1] });
          };
          worker.onerror = (event) => {
            clearTimeout(timer);
            worker.terminate();
            reject(new Error(event.message || 'worker error'));
          };
          worker.postMessage({ id: nextId++, type: 'open' });
        });

      window.__arqSeed = (projectId, request) =>
`,
);

const seeder = 'workers/arqfs-worker/benchmarks/e2e-arq-open-seed-worker.js';
replaceOne(
  seeder,
  `    } else if (request.type === 'makeForeignSqlite') {
      // Valid SQLite, non-zero application_id, no arqfs_meta: the real Worker
      // must refuse rather than initialise a schema over someone else's file.
      db.exec(\`PRAGMA application_id = \${Number(request.applicationId)}\`);
      db.exec('CREATE TABLE IF NOT EXISTS not_arq (id INTEGER PRIMARY KEY)');
    } else {
`,
  `    } else if (request.type === 'makeSchemaV1') {
      // Start from a current project written by the real Worker, then remove only
      // the v2 additions and reset user_version. The resulting file is a genuine
      // schema-v1 project that the real Worker must classify as migratable.
      db.exec('DROP TABLE IF EXISTS source_object_map');
      db.exec('DROP TABLE IF EXISTS import_issue');
      db.exec('DROP TABLE IF EXISTS import_session');
      db.exec('DROP TABLE IF EXISTS resource_reference');
      db.exec('DROP TABLE IF EXISTS source_document');
      db.exec('DELETE FROM schema_migration WHERE version = 2');
      db.exec('PRAGMA user_version = 1');
    } else if (request.type === 'makeForeignSqlite') {
      // Valid SQLite, non-zero application_id, no arqfs_meta: the real Worker
      // must refuse rather than initialise a schema over someone else's file.
      db.exec(\`PRAGMA application_id = \${Number(request.applicationId)}\`);
      db.exec('CREATE TABLE IF NOT EXISTS not_arq (id INTEGER PRIMARY KEY)');
    } else {
`,
);

const runner = 'scripts/run-e2e-arq-open-capability-check.mjs';
replaceOne(
  runner,
  `      if (!passed) fail(\`\${testCase.id}: unexpected open result \${JSON.stringify(result)}\`);
    }
  } finally {
`,
  `      if (!passed) fail(\`\${testCase.id}: unexpected open result \${JSON.stringify(result)}\`);
    }

    // Real copy-on-write product prerequisite: a schema-v1 file opens as
    // migratable, migrates on that same Worker session, survives Worker teardown,
    // and then a fresh Worker sees current schema v2. This is actual sqlite-wasm
    // over OPFS, not the in-memory Worker-handler unit driver.
    const migrationProjectId = 'e2e-open-migration-v1';
    const migrationCreated = await page.evaluate(
      (projectId) => window.__arqOpen(projectId),
      migrationProjectId,
    );
    if (migrationCreated.ok !== true || migrationCreated.payload?.result?.status !== 'opened') {
      throw new Error('migration case could not create its current project');
    }
    const migrationSeeded = await page.evaluate(
      ([projectId, request]) => window.__arqSeed(projectId, request),
      [migrationProjectId, { type: 'makeSchemaV1' }],
    );
    if (migrationSeeded.ok !== true) {
      throw new Error(\`migration case seed failed: \${migrationSeeded.error}\`);
    }
    const migrated = await page.evaluate(
      (projectId) => window.__arqOpenAndMigrate(projectId),
      migrationProjectId,
    );
    const migrationOpen = migrated.open;
    const migrationReply = migrated.migration;
    const reopened = await page.evaluate(
      (projectId) => window.__arqOpen(projectId),
      migrationProjectId,
    );
    const migrationPassed =
      migrationOpen.ok === true &&
      migrationOpen.payload?.kind === 'open' &&
      migrationOpen.payload.result?.status === 'opened' &&
      migrationOpen.payload.result.header?.schema === 1 &&
      migrationOpen.payload.result.capabilities?.canMigrate === true &&
      migrationReply.ok === true &&
      migrationReply.payload?.kind === 'migrateSchemaV1ToV2' &&
      migrationReply.payload.fromSchema === 1 &&
      migrationReply.payload.toSchema === 2 &&
      migrationReply.payload.result?.status === 'opened' &&
      migrationReply.payload.result.header?.schema === 2 &&
      migrationReply.payload.result.capabilities?.canMigrate === false &&
      migrationReply.payload.result.capabilities?.canWrite === true &&
      reopened.ok === true &&
      reopened.payload?.result?.status === 'opened' &&
      reopened.payload.result.header?.schema === 2 &&
      reopened.payload.result.capabilities?.canMigrate === false;
    observed.push({
      case: 'migration-v1-v2',
      describe:
        'an older schema migrates on its isolated OPFS working copy, verifies, and persists as current',
      projectId: migrationProjectId,
      usedVfs: reopened.payload?.usedVfs ?? migrationReply.payload?.usedVfs,
      result: {
        initialOpen: migrationOpen.payload?.result ?? migrationOpen,
        migration: migrationReply.payload ?? migrationReply,
        reopened: reopened.payload?.result ?? reopened,
      },
      passed: migrationPassed,
    });
    if (!migrationPassed) {
      fail(\`migration-v1-v2: unexpected result \${JSON.stringify(migrated)} / reopened \${JSON.stringify(reopened)}\`);
    }
  } finally {
`,
);
replaceOne(
  runner,
  `  if (observed.length !== CASES.length) fail('not every case reported a result');
`,
  `  if (observed.length !== CASES.length + 1) fail('not every case reported a result');
`,
);
replaceOne(
  runner,
  `      'Proves the Worker and OPFS open path for these four outcomes, driving the Worker directly. That apps/web reaches this path from a chosen file, and that the decoded project arrives in the workspace, is the separate claim benchmark:file-open makes by driving the real UI.',
`,
  `      'Proves the Worker and OPFS open path for the four compatibility outcomes plus real schema-v1 to schema-v2 migration and fresh-Worker persistence. That apps/web reaches this path from a chosen file, and that the decoded project arrives in the workspace, is the separate claim benchmark:file-open makes by driving the real UI.',
`,
);

console.log('ARQFS real-Worker migration evidence patch applied.');
