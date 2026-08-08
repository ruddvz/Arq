#!/usr/bin/env node
/**
 * Answers one question about a real `.arq` file, with the product's own code
 * rather than an inspection of it: *would this build open it and hydrate the
 * semantic elements it carries?*
 *
 * A package can be internally perfect and still not be a project this build can
 * open. Container integrity (SQLite `integrity_check`, `application_id`, the
 * archive entries and their checksums) says the bytes are sound; it says nothing
 * about whether `model.json` speaks the vocabulary `parseNativeProjectModel`
 * reads. A file can pass every integrity gate and be refused at the first field.
 * Those are two different claims and this script keeps them apart, reporting
 * both:
 *
 *   1. Container - opened through `node:sqlite`, checking the format header
 *      `@arq/arqfs` requires (`application_id`, `user_version`) and the schema
 *      tables it expects, plus SQLite's own integrity check.
 *   2. Hydration - `model.json` and `views.json` handed to the real
 *      `parseNativeProjectModel` / `parseNativeProjectViews`, with
 *      `checkArqModelConformance` enumerating every contract divergence in one
 *      pass instead of only the first.
 *
 * The file is opened read-only and never written to: this is a verification
 * tool, and a released artifact whose bytes this script changed would no longer
 * be the artifact anyone checksummed.
 *
 * Usage:
 *   node scripts/run-arq-hydration-capability-check.mjs <path-to.arq> [--json <out>]
 *
 * Exits 0 when the file hydrates, 1 when it does not, and 2 when it could not be
 * read as an Arq container at all - a distinct outcome from "read fine, refused".
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/** `0x41525131` - the ASCII bytes `ARQ1`, mirroring @arq/arqfs's ARQ_APPLICATION_ID. */
const ARQ_APPLICATION_ID = 0x41525131;
/** The tables @arq/arqfs's schema v1 and v2 create; a container missing one is not one this build wrote. */
const REQUIRED_TABLES = [
  'arqfs_meta',
  'archive_entry',
  'resource',
  'resource_chunk',
  'schema_migration',
  'working_copy_state',
  'feature_flag',
];

function parseArguments(argv) {
  const positional = [];
  let jsonOut = null;
  let adapt = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--json') {
      jsonOut = argv[index + 1] ?? null;
      index += 1;
    } else if (argv[index] === '--adapt') {
      adapt = true;
    } else {
      positional.push(argv[index]);
    }
  }
  return { arqPath: positional[0] ?? null, jsonOut, adapt };
}

function fail(message, code) {
  console.error(`arq-hydration-check: ${message}`);
  process.exit(code);
}

/**
 * Reads the container half. Returns the header facts and the archive entries,
 * or throws with a reason a person can act on - never a bare SQLite error.
 */
function readContainer(arqPath) {
  let db;
  try {
    db = new DatabaseSync(arqPath, { readOnly: true });
  } catch (error) {
    throw new Error(`could not be opened as a SQLite database (${error.message})`);
  }
  try {
    const applicationId = db.prepare('PRAGMA application_id').get().application_id;
    if (applicationId !== ARQ_APPLICATION_ID) {
      throw new Error(
        `declares application_id ${applicationId}, not ${ARQ_APPLICATION_ID} - this is not an Arq file`,
      );
    }
    const userVersion = db.prepare('PRAGMA user_version').get().user_version;
    const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
    const foreignKeyViolations = db.prepare('PRAGMA foreign_key_check').all().length;
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name);
    const missingTables = REQUIRED_TABLES.filter((name) => !tables.includes(name));
    const meta = Object.fromEntries(
      db
        .prepare('SELECT key, value FROM arqfs_meta')
        .all()
        .map((row) => [row.key, row.value]),
    );
    const entries = db
      .prepare('SELECT path, length(content) AS byteLength FROM archive_entry ORDER BY path')
      .all();
    const read = (entryPath) => {
      const row = db.prepare('SELECT content FROM archive_entry WHERE path = ?').get(entryPath);
      return row ? Buffer.from(row.content) : null;
    };
    return {
      applicationId,
      userVersion,
      integrity,
      foreignKeyViolations,
      missingTables,
      meta,
      entries,
      manifest: read('manifest.json'),
      model: read('model.json'),
      views: read('views.json'),
    };
  } finally {
    db.close();
  }
}

/**
 * Runs the semantic half through a throwaway vitest test rather than importing
 * @arq/project-loading into this plain Node script: the package's module graph
 * only resolves through TypeScript's "Bundler" resolution (vitest/tsc), not
 * Node's native ESM resolver, which requires explicit file extensions on every
 * relative import. Same reason, and same shape, as
 * run-file-open-capability-check.mjs's fixture generation.
 */
function runHydration(workDir, adapt) {
  const testFilePath = path.join(
    repoRoot,
    'packages/project-loading/src/_arq-hydration.generated.test.ts',
  );
  const escaped = workDir.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  writeFileSync(
    testFilePath,
    `import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseNativeProjectModel, parseNativeProjectViews } from './native-project-model';
import { checkArqModelConformance } from './arq-model-conformance';
import { adaptArqHouse17Model } from './arq-house-17-model-adapter';

const dir = '${escaped}';
const adapt = ${adapt ? 'true' : 'false'};

it('hydrates the model under check', () => {
  const original = JSON.parse(readFileSync(dir + '/model.json', 'utf8'));
  let views: readonly ReturnType<typeof parseNativeProjectViews>[number][] = [];
  try {
    views = parseNativeProjectViews(JSON.parse(readFileSync(dir + '/views.json', 'utf8')));
  } catch {
    views = [];
  }

  // Reported whether or not --adapt was asked for, so the output always states
  // what the file is as it stands before saying what an adapter could make it.
  const beforeAdapting = checkArqModelConformance(original, views);

  let model: unknown = original;
  let adaptation: unknown = null;
  if (adapt) {
    const result = adaptArqHouse17Model(original);
    adaptation =
      result.status === 'adapted'
        ? { status: result.status, translations: result.translations }
        : { status: result.status, reason: result.reason };
    if (result.status === 'adapted') model = result.model;
  }

  const conformance = checkArqModelConformance(model, views);
  const parsed = parseNativeProjectModel(model, views);
  writeFileSync(
    dir + '/result.json',
    JSON.stringify({
      beforeAdapting: { hydrates: beforeAdapting.hydrates, findings: beforeAdapting.findings },
      adaptation,
      conformance,
      views: views.map((view) => ({ id: view.id, kind: view.kind, supported: view.supported })),
      hydrated:
        parsed.status === 'parsed'
          ? {
              summary: parsed.model.summary,
              counts: {
                levels: parsed.model.levels.length,
                wallTypes: parsed.model.wallTypes.length,
                walls: parsed.model.walls.length,
                openings: parsed.model.openings.length,
                doors: parsed.model.doors.length,
                windows: parsed.model.windows.length,
                rooms: parsed.model.rooms.length,
              },
              wallHeightOverrides: parsed.model.walls.filter(
                (wall) => wall.heightOverride !== undefined,
              ).length,
              unsupported: parsed.model.unsupported,
            }
          : null,
    }),
  );
});
`,
    'utf8',
  );
  try {
    execFileSync(
      'npx',
      ['vitest', 'run', 'packages/project-loading/src/_arq-hydration.generated.test.ts'],
      { cwd: repoRoot, stdio: 'pipe' },
    );
  } catch (error) {
    throw new Error(
      `the hydration probe did not run: ${error.stderr?.toString().slice(-800) ?? error.message}`,
    );
  } finally {
    rmSync(testFilePath, { force: true });
  }
  return JSON.parse(readFileSync(path.join(workDir, 'result.json'), 'utf8'));
}

function main() {
  const { arqPath, jsonOut, adapt } = parseArguments(process.argv.slice(2));
  if (arqPath === null) {
    fail(
      'usage: node scripts/run-arq-hydration-capability-check.mjs <path-to.arq> [--adapt] [--json <out>]',
      2,
    );
  }
  if (!existsSync(arqPath)) fail(`no such file: ${arqPath}`, 2);

  let container;
  try {
    container = readContainer(arqPath);
  } catch (error) {
    fail(`${path.basename(arqPath)} ${error.message}`, 2);
  }

  console.log(`File: ${arqPath}`);
  console.log('--- Container ---');
  console.log(`  application_id: ${container.applicationId} (ARQ1)`);
  console.log(`  user_version (schema): ${container.userVersion}`);
  console.log(`  integrity_check: ${container.integrity}`);
  console.log(`  foreign key violations: ${container.foreignKeyViolations}`);
  console.log(`  archive entries: ${container.entries.length}`);
  console.log(
    `  format: major ${container.meta.format_major ?? '?'}, minor ${container.meta.format_minor ?? '?'}, min reader major ${container.meta.min_reader_major ?? '?'}`,
  );
  if (container.missingTables.length > 0) {
    console.log(`  MISSING TABLES: ${container.missingTables.join(', ')}`);
  }

  if (container.manifest === null) {
    fail('the container carries no manifest.json, which every Arq project requires', 2);
  }
  if (container.model === null) {
    fail('the container carries no model.json, so there is no semantic model to hydrate', 2);
  }

  const workDir = mkdtempSync(path.join(tmpdir(), 'arq-hydration-'));
  let result;
  try {
    writeFileSync(path.join(workDir, 'model.json'), container.model);
    if (container.views !== null) {
      writeFileSync(path.join(workDir, 'views.json'), container.views);
    } else {
      writeFileSync(path.join(workDir, 'views.json'), '{"views":[]}');
    }
    result = runHydration(workDir, adapt);
  } catch (error) {
    rmSync(workDir, { recursive: true, force: true });
    fail(error.message, 2);
  }
  rmSync(workDir, { recursive: true, force: true });

  const { conformance } = result;

  /*
   * Printed before the adapted verdict, always: a run with --adapt must never
   * read as though the file itself hydrates. What the file is, then what an
   * adapter can make of it - in that order.
   */
  if (adapt) {
    console.log('--- As shipped (before adapting) ---');
    console.log(`  hydrates: ${result.beforeAdapting.hydrates ? 'yes' : 'no'}`);
    console.log(`  divergences: ${result.beforeAdapting.findings.length}`);
    const { adaptation } = result;
    if (adaptation === null || adaptation.status !== 'adapted') {
      console.log(`--- Adapter --- not applicable: ${adaptation?.reason ?? 'no adaptation run'}`);
    } else {
      const derived = adaptation.translations.filter((entry) => entry.basis === 'derived');
      const assumed = adaptation.translations.filter((entry) => entry.basis === 'assumed');
      console.log(
        `--- Adapter --- ${adaptation.translations.length} translations (${derived.length} derived, ${assumed.length} assumed)`,
      );
      for (const entry of adaptation.translations) {
        console.log(
          `  [${entry.basis}] ${entry.section}.${entry.field} - ${entry.entries} entr${entry.entries === 1 ? 'y' : 'ies'}`,
        );
        console.log(`      ${entry.from}  ->  ${entry.to}`);
        console.log(`      ${entry.rationale}`);
      }
    }
  }

  console.log('--- Hydration ---');
  console.log(`  reader verdict: ${conformance.readerVerdict}`);
  if (conformance.readerReason !== null) {
    console.log(`  reader reason: ${conformance.readerReason}`);
  }
  console.log(
    `  declared elements: ${Object.entries(conformance.declaredCounts)
      .map(([section, count]) => `${section} ${count}`)
      .join(', ')}`,
  );
  if (result.hydrated !== null) {
    console.log(
      `  hydrated elements: ${Object.entries(result.hydrated.counts)
        .map(([section, count]) => `${section} ${count}`)
        .join(', ')}`,
    );
    console.log(`  wall height overrides carried: ${result.hydrated.wallHeightOverrides}`);
    for (const entry of result.hydrated.unsupported) {
      console.log(`  not displayed: ${entry.section} (${entry.count}) - ${entry.reason}`);
    }
  }
  console.log(
    `  views: ${result.views.filter((view) => view.supported).length} of ${result.views.length} presentable`,
  );

  if (!conformance.consistentWithReader) {
    console.log(
      '  WARNING: conformance findings disagree with the reader verdict - the checker has drifted from native-project-model.ts.',
    );
  }

  if (conformance.findings.length > 0) {
    console.log(`--- Contract divergences (${conformance.findings.length}) ---`);
    for (const finding of conformance.findings) {
      console.log(
        `  [${finding.severity}] ${finding.section}.${finding.field} - ${finding.affectedEntries} affected`,
      );
      console.log(`      found:    ${finding.found}`);
      console.log(`      expected: ${finding.expected}`);
    }
  }

  if (jsonOut !== null) {
    writeFileSync(
      jsonOut,
      `${JSON.stringify(
        {
          file: path.basename(arqPath),
          container: {
            applicationId: container.applicationId,
            userVersion: container.userVersion,
            integrity: container.integrity,
            foreignKeyViolations: container.foreignKeyViolations,
            archiveEntries: container.entries.length,
            missingTables: container.missingTables,
            meta: container.meta,
          },
          adapted: adapt,
          hydration: result,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    console.log(`Wrote ${jsonOut}`);
  }

  /*
   * The adapted result is never reported as the file's own property. "Hydrates
   * once adapted" and "hydrates" are different claims, and collapsing them is
   * how a package ends up believed to open when it does not.
   */
  console.log(
    conformance.hydrates
      ? adapt
        ? 'RESULT: this build hydrates the file once adapted. As shipped it does not.'
        : 'RESULT: this build opens and hydrates the file.'
      : 'RESULT: this build does not hydrate the file - see the divergences above.',
  );
  process.exit(conformance.hydrates ? 0 : 1);
}

main();
