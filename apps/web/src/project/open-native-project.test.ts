import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createNodeArqfsDriver } from '@arq/arqfs/src/arqfs-node-driver';
import {
  createArqfsWorkerSession,
  handleArqfsWorkerRequest,
  type ArqfsWorkerContext,
} from '@arq/arqfs/src/arqfs-worker-handler';
import type { ArqfsWorkerRequestInput } from '@arq/arqfs/src/arqfs-worker-client';
import type { ArqfsWorkerResponsePayload } from '@arq/arqfs/src/arqfs-worker-protocol';
import type { ArqfsDriver } from '@arq/arqfs/src/arqfs-driver';
import {
  openNativeProject,
  REQUIRED_PROJECT_ENTRY,
  type ProjectWorkerConnection,
} from './open-native-project';
import {
  reduceFileFlow,
  isProjectOpen,
  isProjectWritable,
  lastKnownGoodProject,
  type FileFlowEvent,
  type FileFlowState,
} from '../file-handling/file-state-machine';

/**
 * The real Worker request handler, over a real SQLite database on disk, reached
 * through the same request/response shapes the browser Worker uses. Only the
 * transport is stood in for - `postMessage` becomes a direct call - so what is
 * under test is the open sequence rather than a reimplementation of it.
 */
class LocalWorkerConnection implements ProjectWorkerConnection {
  private nextId = 1;
  disposed = false;
  disposeReason: string | undefined;
  readonly sent: ArqfsWorkerRequestInput[] = [];

  constructor(
    private readonly context: ArqfsWorkerContext,
    private readonly onDispose: () => void,
  ) {}

  async request(
    input: ArqfsWorkerRequestInput,
    options: { readonly signal?: AbortSignal | undefined } = {},
  ): Promise<ArqfsWorkerResponsePayload> {
    if (this.disposed) throw new Error('connection disposed');
    if (options.signal?.aborted === true) {
      throw new DOMException('The request was aborted.', 'AbortError');
    }
    this.sent.push(input);
    const response = handleArqfsWorkerRequest(this.context, {
      ...input,
      id: this.nextId++,
    } as Parameters<typeof handleArqfsWorkerRequest>[1]);
    if (!response.ok) throw new Error(`${response.code}: ${response.error}`);
    return response.payload;
  }

  dispose(reason?: string): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeReason = reason;
    this.onDispose();
  }
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('openNativeProject', () => {
  let dir: string;
  let drivers: ArqfsDriver[];
  let connections: LocalWorkerConnection[];
  let events: FileFlowEvent[];

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arq-open-native-'));
    drivers = [];
    connections = [];
    events = [];
  });

  afterEach(() => {
    for (const driver of drivers) {
      try {
        driver.close();
      } catch {
        // Already closed by the code under test.
      }
    }
    rmSync(dir, { recursive: true, force: true });
  });

  function track(driver: ArqfsDriver): ArqfsDriver {
    drivers.push(driver);
    return driver;
  }

  /** A complete Arq project written by this build, as the bytes a file picker would hand over. */
  function sourceBytes(options: { readonly withModel?: boolean } = {}): Uint8Array {
    const file = path.join(dir, `source-${drivers.length}.arq`);
    const driver = createNodeArqfsDriver(file);
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      projectId: 'source',
      session: createArqfsWorkerSession(),
    };
    handleArqfsWorkerRequest(context, { id: 1, type: 'open' });
    if (options.withModel !== false) {
      handleArqfsWorkerRequest(context, {
        id: 2,
        type: 'putArchiveEntries',
        entries: [[REQUIRED_PROJECT_ENTRY, new TextEncoder().encode('{"walls":[]}')]],
      });
    }
    driver.close();
    return new Uint8Array(readFileSync(file));
  }

  /** A file this build may read but must not write. */
  function readOnlySourceBytes(): Uint8Array {
    const file = path.join(dir, `read-only-${drivers.length}.arq`);
    const driver = createNodeArqfsDriver(file);
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      projectId: 'source',
      session: createArqfsWorkerSession(),
    };
    handleArqfsWorkerRequest(context, { id: 1, type: 'open' });
    handleArqfsWorkerRequest(context, {
      id: 2,
      type: 'putArchiveEntries',
      entries: [[REQUIRED_PROJECT_ENTRY, new TextEncoder().encode('{"walls":[]}')]],
    });
    driver.exec(`UPDATE arqfs_meta SET value = '99' WHERE key = 'min_writer_major'`);
    driver.close();
    return new Uint8Array(readFileSync(file));
  }

  function connect(projectId: string): Promise<ProjectWorkerConnection> {
    const workingFile = path.join(dir, `${projectId}.working.sqlite3`);
    const context: ArqfsWorkerContext = {
      driver: track(createNodeArqfsDriver(workingFile)),
      usedVfs: 'test-node-driver',
      projectId,
      session: createArqfsWorkerSession(),
      importDatabase: (bytes) => {
        context.driver.close();
        writeFileSync(workingFile, bytes);
        return track(createNodeArqfsDriver(workingFile));
      },
    };
    const connection = new LocalWorkerConnection(context, () => {
      try {
        context.driver.close();
      } catch {
        // Already closed.
      }
    });
    connections.push(connection);
    return Promise.resolve(connection);
  }

  const dependencies = {
    connect,
    emit: (event: FileFlowEvent) => events.push(event),
    digestSource: (bytes: Uint8Array) => Promise.resolve(sha256Hex(bytes)),
  };

  /** Replays the emitted events through the reducer, starting where routing left the flow. */
  function replay(): FileFlowState {
    let state: FileFlowState = {
      kind: 'native-opening',
      name: 'project.arq',
      sidecarDependency: 'complete',
    };
    for (const event of events) state = reduceFileFlow(state, event);
    return state;
  }

  it('reaches workspace-active through every lifecycle state, in order', async () => {
    const bytes = sourceBytes();

    const outcome = await openNativeProject(
      { projectId: 'project-a', bytes },
      { ...dependencies, emit: (event) => events.push(event) },
    );

    expect(outcome.kind).toBe('workspace-active');
    if (outcome.kind !== 'workspace-active') throw new Error('expected workspace-active');
    expect(outcome.writable).toBe(true);
    expect(outcome.sourceDigest).toBe(sha256Hex(bytes));
    expect(outcome.sidecarDependency).toBe('complete');
    // Every blocking stage of the shared open state machine actually completed,
    // rather than the flow reporting a project while the machine still thinks it
    // is at stage zero.
    expect(outcome.snapshot.authoringReady).toBe(true);

    // The order is the contract: nothing may be skipped, because skipping is how
    // a project reaches "active" without having been hydrated.
    expect(events.map((event) => event.type)).toEqual([
      'stage-start',
      'stage-progress',
      'stage-progress',
      'stage-progress',
      'stage-complete',
      'migration-verified',
      'worker-opened',
      'hydrate-start',
      'hydrated',
    ]);

    const state = replay();
    expect(state.kind).toBe('workspace-active');
    expect(isProjectOpen(state)).toBe(true);
    expect(isProjectWritable(state)).toBe(true);
  });

  it('opens a project the working copy actually contains, not an empty database', async () => {
    const bytes = sourceBytes();

    await openNativeProject({ projectId: 'project-a', bytes }, dependencies);

    const connection = connections[0];
    expect(connection).toBeDefined();
    // The Worker was asked to import before it was asked to open. Reversing those
    // would open the empty database this build creates for a fresh project and
    // then refuse the import, which is exactly the false open being prevented.
    expect(connection?.sent.map((request) => request.type)).toEqual([
      'importDatabase',
      'open',
      'checkIntegrity',
      'listArchiveEntryPaths',
      'getArchiveEntry',
    ]);
  });

  it('carries a read-only file all the way to workspace-active as read-only', async () => {
    const outcome = await openNativeProject(
      { projectId: 'project-a', bytes: readOnlySourceBytes() },
      dependencies,
    );

    // A file this build may read but not write is a project, not a failure.
    expect(outcome.kind).toBe('workspace-active');
    if (outcome.kind !== 'workspace-active') throw new Error('expected workspace-active');
    expect(outcome.writable).toBe(false);
    const state = replay();
    expect(isProjectOpen(state)).toBe(true);
    expect(isProjectWritable(state)).toBe(false);
  });

  it('refuses a project with no model to hydrate rather than opening an empty workspace', async () => {
    const outcome = await openNativeProject(
      { projectId: 'project-a', bytes: sourceBytes({ withModel: false }) },
      dependencies,
    );

    expect(outcome).toMatchObject({ kind: 'failed', reason: 'hydration-failed' });
    const state = replay();
    expect(state.kind).toBe('project-failed');
    expect(isProjectOpen(state)).toBe(false);
  });

  it('refuses source bytes that are not an Arq database, and never reaches an open', async () => {
    const outcome = await openNativeProject(
      { projectId: 'project-a', bytes: new TextEncoder().encode('not a database') },
      dependencies,
    );

    expect(outcome.kind).toBe('failed');
    expect(events.some((event) => event.type === 'worker-opened')).toBe(false);
    expect(isProjectOpen(replay())).toBe(false);
  });

  it('releases the Worker on every failure path', async () => {
    await openNativeProject(
      { projectId: 'project-a', bytes: new TextEncoder().encode('not a database') },
      dependencies,
    );

    // A Worker left alive holds the project's OPFS file, and the next attempt to
    // open that project would block behind it.
    expect(connections).toHaveLength(1);
    expect(connections[0]?.disposed).toBe(true);
    expect(connections[0]?.disposeReason).toBe('project open failed');
  });

  it('reports a cancellation as cancelled, not as a damaged project, and releases the Worker', async () => {
    const controller = new AbortController();
    const bytes = sourceBytes();

    const outcome = await openNativeProject(
      { projectId: 'project-a', bytes, signal: controller.signal },
      {
        ...dependencies,
        // Cancel while the source digest is in flight - the first genuinely
        // interruptible moment, before anything has been staged.
        digestSource: (value: Uint8Array) => {
          controller.abort();
          return Promise.resolve(sha256Hex(value));
        },
      },
    );

    expect(outcome).toEqual({ kind: 'cancelled' });
    expect(events.at(-1)).toEqual({ type: 'cancel' });
    expect(connections).toHaveLength(0);
  });

  it('leaves the previously active project untouched when an open fails', async () => {
    // A session that already has a project open.
    const active: FileFlowState = {
      kind: 'workspace-active',
      name: 'first.arq',
      projectId: 'project-first',
      writable: true,
    };

    await openNativeProject(
      { projectId: 'project-second', bytes: new TextEncoder().encode('not a database') },
      dependencies,
    );

    let state: FileFlowState = active;
    for (const event of events) state = reduceFileFlow(state, event);
    // ADR-0028: a failure never silently replaces the last known good project.
    expect(lastKnownGoodProject(state)).toEqual({ projectId: 'project-first', name: 'first.arq' });
  });

  it('reports a Worker that cannot be constructed as worker-failed', async () => {
    const outcome = await openNativeProject(
      { projectId: 'project-a', bytes: sourceBytes() },
      {
        ...dependencies,
        connect: () => Promise.reject(new Error('SecurityError: Worker construction blocked')),
      },
    );

    expect(outcome).toMatchObject({ kind: 'failed', reason: 'worker-failed' });
    expect(isProjectOpen(replay())).toBe(false);
  });
});
