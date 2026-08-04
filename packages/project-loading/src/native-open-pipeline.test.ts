import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createArqfsWorkerSession,
  createNodeArqfsDriver,
  handleArqfsWorkerRequest,
  type ArqfsDriver,
  type ArqfsWorkerContext,
  type ArqfsWorkerRequest,
  type ArqfsWorkerRequestInput,
  type ArqfsWorkerResponsePayload,
} from '@arq/arqfs';
import { runNativeOpen, type NativeOpenTransport } from './native-open-pipeline';

/**
 * The open order, proven against the real golden fixture through the real
 * request handler.
 *
 * The transport below is the same `handleArqfsWorkerRequest` the browser Worker
 * calls, over the same `selected-bytes` source, driven by better-sqlite3 instead
 * of sqlite-wasm. That substitution is the only thing this test fakes: every
 * check the pipeline is supposed to make is really made, against real SQLite and
 * a real 1 MB project file. Stubbing the transport would have left this test
 * asserting that the pipeline calls the functions it calls.
 *
 * The browser half - sqlite-wasm, a real Worker, real deserialize-read-only -
 * is proven separately by `pnpm benchmark:native-open`, which drives the shipped
 * application code in headless Chromium.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const fixturePath = path.join(repoRoot, 'fixtures/ARQ_Courtyard_House_Golden_Fixture_v2.arq');
const FIXTURE_SHA256 = '0afd9a9785b99ba4338e73067a1af383079363893c30fdc6d538c7e44ed87bd6';

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

const temporaryDirectories: string[] = [];
const openDrivers: ArqfsDriver[] = [];

afterEach(() => {
  for (const driver of openDrivers.splice(0)) {
    try {
      driver.close();
    } catch {
      // Already closed by the test; nothing to release.
    }
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/**
 * Every case works on its own copy. Nothing in this file may open the golden
 * fixture in place: a test that can write to the control cannot prove the
 * control was left alone.
 */
function copyOfFixture(mutate?: (bytes: Uint8Array) => Uint8Array): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'arq-native-open-'));
  temporaryDirectories.push(directory);
  const target = path.join(directory, 'project.arq');
  if (mutate === undefined) {
    copyFileSync(fixturePath, target);
  } else {
    writeFileSync(target, mutate(new Uint8Array(readFileSync(fixturePath))));
  }
  return target;
}

function transportFor(filename: string): NativeOpenTransport {
  const driver = createNodeArqfsDriver(filename);
  openDrivers.push(driver);
  const context: ArqfsWorkerContext = {
    driver,
    usedVfs: 'test-node-driver',
    session: createArqfsWorkerSession(),
    source: 'selected-bytes',
  };
  const send = async (request: ArqfsWorkerRequestInput): Promise<ArqfsWorkerResponsePayload> => {
    const response = handleArqfsWorkerRequest(context, { ...request, id: 1 } as ArqfsWorkerRequest);
    if (!response.ok) {
      throw new Error(`${response.code}: ${response.error}`);
    }
    return response.payload;
  };
  return {
    async open() {
      // What the Worker entry sends after it has turned the selected bytes into
      // this connection: an ordinary open, measured against `source`.
      const payload = await send({ type: 'open' });
      if (payload.kind !== 'open') throw new Error('expected an open payload');
      return { result: payload.result, usedVfs: payload.usedVfs };
    },
    async recoveryReport() {
      const payload = await send({ type: 'recoveryReport' });
      if (payload.kind !== 'recoveryReport') throw new Error('expected a recoveryReport payload');
      return payload.report;
    },
    async workingCopyState() {
      const payload = await send({ type: 'readWorkingCopyState' });
      if (payload.kind !== 'readWorkingCopyState') throw new Error('expected a state payload');
      return payload.state;
    },
    async listArchiveEntryPaths() {
      const payload = await send({ type: 'listArchiveEntryPaths' });
      if (payload.kind !== 'listArchiveEntryPaths') throw new Error('expected a paths payload');
      return payload.paths;
    },
    async getArchiveEntry(entryPath: string) {
      const payload = await send({ type: 'getArchiveEntry', path: entryPath });
      if (payload.kind !== 'getArchiveEntry') throw new Error('expected an entry payload');
      return payload.content;
    },
  };
}

describe('runNativeOpen over the golden fixture', () => {
  it('is running against the unmodified fixture', () => {
    // If this fails, every other assertion in this file is about a different
    // file than the one the evidence names.
    expect(sha256(fixturePath)).toBe(FIXTURE_SHA256);
  });

  it('opens the project and reports the file facts it verified', async () => {
    const result = await runNativeOpen({
      attemptId: 'attempt-1',
      transport: transportFor(copyOfFixture()),
    });

    expect(result.status).toBe('staged');
    if (result.status !== 'staged') return;
    expect(result.openResult.header).toEqual({
      major: 1,
      minor: 0,
      schema: 2,
      minReaderMajor: 1,
      minWriterMajor: 1,
    });
    expect(result.integrity?.ok).toBe(true);
    expect(result.safeModePlan.kind).toBe('healthy');
    expect(result.workingCopy?.projectId).toBe('proj-house-courtyard-001');
    expect(result.workingCopy?.localRevision).toBe(191);
    expect(result.archiveEntryPaths).toEqual([
      'checksums.json',
      'manifest.json',
      'model.json',
      'operations.ndjson',
      'sheets.json',
      'views.json',
    ]);
    expect(result.verifiedChecksumPaths).toEqual([
      'manifest.json',
      'model.json',
      'operations.ndjson',
      'sheets.json',
      'views.json',
    ]);
    expect(result.corruptOptionalPaths).toEqual([]);
  });

  it('hydrates the semantic model the fixture actually contains', async () => {
    const result = await runNativeOpen({
      attemptId: 'attempt-2',
      transport: transportFor(copyOfFixture()),
    });

    if (result.status !== 'staged') throw new Error(`expected staged, got ${result.status}`);
    const { model } = result;
    expect(model.summary.projectName).toBe('Courtyard House Reference');
    expect(model.summary.revision).toBe(191);
    expect(model.summary.units).toBe('metric');
    expect(model.levels.map((level) => level.name)).toEqual([
      'Ground floor',
      'Upper floor',
      'Roof',
    ]);
    expect(model.walls).toHaveLength(79);
    // The ground-floor count the package's fixture forensics record, re-derived
    // here from the file rather than copied from the report.
    expect(model.walls.filter((wall) => (wall.levelId as string) === 'lvl-gf')).toHaveLength(37);
    expect(model.rooms).toHaveLength(34);
    expect(model.views.filter((view) => view.supported).map((view) => view.id)).toEqual([
      'view-gf-plan',
      'view-uf-plan',
      'view-axo',
    ]);
    expect(model.views.find((view) => view.id === 'view-section-a')?.unsupportedReason).toContain(
      'proposed-not-rendered',
    );
    expect(model.unsupported.map((entry) => [entry.section, entry.count])).toEqual([
      ['openings', 30],
      ['doors', 14],
      ['windows', 16],
      ['linearDimensions', 5],
    ]);
  });

  it('never reports authoring as available, and never advances past the skeleton stage', async () => {
    const result = await runNativeOpen({
      attemptId: 'attempt-3',
      transport: transportFor(copyOfFixture()),
    });

    if (result.status !== 'staged') throw new Error('expected a staged project');
    expect(result.progress.authoringReady).toBe(false);
    expect(result.progress.highestCompleted).toBe(2);
    expect(result.authoringUnavailableReason).toContain('inspection only');
    // Stages the build cannot honestly reach stay pending rather than being
    // reported as failures.
    expect(result.progress.progress[3]?.status).toBe('pending');
  });

  it('leaves the selected file byte-for-byte unchanged', async () => {
    const copy = copyOfFixture();
    const before = sha256(copy);

    const result = await runNativeOpen({ attemptId: 'attempt-4', transport: transportFor(copy) });

    expect(result.status).toBe('staged');
    expect(sha256(copy)).toBe(before);
    expect(sha256(fixturePath)).toBe(FIXTURE_SHA256);
  });

  it('refuses a project whose recorded checksum no longer matches its content', async () => {
    // A single flipped byte inside model.json's stored content: the SQLite
    // container stays healthy, so only the checksum step can catch this.
    const copy = copyOfFixture();
    const driver = createNodeArqfsDriver(copy);
    const original = driver.query<{ content: Uint8Array }>(
      "SELECT content FROM archive_entry WHERE path = 'model.json'",
    )[0]!.content;
    const tampered = new Uint8Array(original);
    tampered[tampered.length - 2] = tampered[tampered.length - 2]! ^ 0x01;
    driver.run("UPDATE archive_entry SET content = ? WHERE path = 'model.json'", [tampered]);
    driver.close();

    const result = await runNativeOpen({ attemptId: 'attempt-5', transport: transportFor(copy) });

    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.code).toBe('CHECKSUM_MISMATCH');
    expect(result.reason).toContain('model.json');
  });

  it('refuses a project that records no checksum for its own model', async () => {
    const copy = copyOfFixture();
    const driver = createNodeArqfsDriver(copy);
    driver.run("DELETE FROM archive_entry WHERE path = 'checksums.json'");
    driver.close();

    const result = await runNativeOpen({ attemptId: 'attempt-6', transport: transportFor(copy) });

    // "Nothing recorded" must not read as "nothing wrong": an unverifiable
    // project would otherwise open as a verified one.
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.code).toBe('CHECKSUM_MISMATCH');
    expect(result.reason).toContain('model.json');
  });

  it('refuses a project whose required model content is missing', async () => {
    const copy = copyOfFixture();
    const driver = createNodeArqfsDriver(copy);
    driver.run("DELETE FROM archive_entry WHERE path = 'model.json'");
    driver.close();

    const result = await runNativeOpen({ attemptId: 'attempt-7', transport: transportFor(copy) });

    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.code).toBe('REQUIRED_ENTRIES_MISSING');
    // Distinguished from corruption: the container is fine, the content is absent.
    expect(result.safeModePlan?.kind).not.toBe('corrupt');
  });

  it('refuses a file that is not an Arq project at all', async () => {
    const empty = path.join(
      mkdtempSync(path.join(tmpdir(), 'arq-native-open-empty-')),
      'blank.arq',
    );
    temporaryDirectories.push(path.dirname(empty));
    writeFileSync(empty, new Uint8Array());

    const result = await runNativeOpen({ attemptId: 'attempt-8', transport: transportFor(empty) });

    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    // The selected-bytes source refuses rather than initialising a schema, so
    // the failure names the file instead of reporting a brand-new empty project.
    expect(result.code).toBe('OPEN_REJECTED');
    expect(result.progress.progress[0]?.status).toBe('failed');
  });

  it('reports a project whose previous write was interrupted without opening it as healthy', async () => {
    const copy = copyOfFixture();
    const driver = createNodeArqfsDriver(copy);
    driver.run("UPDATE working_copy_state SET local_commit_state = 'writing' WHERE id = 1");
    driver.close();

    const result = await runNativeOpen({ attemptId: 'attempt-9', transport: transportFor(copy) });

    // Read-only inspection of an interrupted project is safe and useful, so this
    // opens - but the plan records what happened rather than calling it healthy.
    expect(result.status).toBe('staged');
    if (result.status !== 'staged') return;
    expect(result.safeModePlan.kind).toBe('interrupted-write');
    expect(result.safeModePlan.openReadOnly).toBe(true);
  });
});
