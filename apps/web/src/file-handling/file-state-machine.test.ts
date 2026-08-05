import { describe, expect, it } from 'vitest';
import {
  reduceFileFlow,
  type FileFlowState,
  isProjectOpen,
  isProjectWritable,
  lastKnownGoodProject,
} from './file-state-machine';

const IDLE: FileFlowState = { kind: 'idle' };

describe('reduceFileFlow', () => {
  it('walks the native-open path: acquire -> acquired -> detecting -> route-native', () => {
    let state = reduceFileFlow(IDLE, { type: 'acquire', name: 'project.arq' });
    expect(state).toEqual({ kind: 'acquiring', name: 'project.arq' });

    state = reduceFileFlow(state, { type: 'acquired' });
    expect(state).toEqual({ kind: 'detecting', name: 'project.arq' });

    state = reduceFileFlow(state, { type: 'route-native', sidecarDependency: 'complete' });
    expect(state).toEqual({
      kind: 'native-opening',
      name: 'project.arq',
      sidecarDependency: 'complete',
    });
  });

  /**
   * A database depending on an absent `-wal` sidecar no longer has a route into
   * `native-opening` at all. It used to arrive there carrying a flag that made
   * the copy layer say "compatible, but may not be complete" - one success state
   * that could mean a project silently missing the user's newest work. The
   * completeness policy now refuses it before routing, so the only way it can
   * reach the reducer is as a failure.
   */
  it('routes a database with a missing write-ahead-log sidecar to failure, not to native-opening', () => {
    const detecting: FileFlowState = { kind: 'detecting', name: 'project.arq' };

    const state = reduceFileFlow(detecting, {
      type: 'fail',
      code: 'ARQ_WAL_SIDECAR_REQUIRED',
      message: 'This database depends on a companion "-wal" file that was not included.',
    });

    expect(state).toMatchObject({
      kind: 'failed',
      name: 'project.arq',
      code: 'ARQ_WAL_SIDECAR_REQUIRED',
    });
  });

  it('walks the import path through progress to staged review', () => {
    let state: FileFlowState = { kind: 'detecting', name: 'plan.dxf' };
    state = reduceFileFlow(state, { type: 'route-import', formatId: 'dxf' });
    expect(state).toEqual({ kind: 'import-options', name: 'plan.dxf', formatId: 'dxf' });

    state = reduceFileFlow(state, { type: 'import-start', requestId: 'req-1' });
    expect(state).toEqual({ kind: 'importing', name: 'plan.dxf', requestId: 'req-1', fraction: 0 });

    state = reduceFileFlow(state, { type: 'progress', fraction: 0.5 });
    expect(state).toEqual({
      kind: 'importing',
      name: 'plan.dxf',
      requestId: 'req-1',
      fraction: 0.5,
    });

    state = reduceFileFlow(state, { type: 'staged' });
    expect(state).toEqual({ kind: 'staged-review', name: 'plan.dxf', requestId: 'req-1' });
  });

  it('clamps progress fraction into [0, 1]', () => {
    const importing: FileFlowState = { kind: 'importing', name: 'x', requestId: 'r', fraction: 0 };
    expect(reduceFileFlow(importing, { type: 'progress', fraction: 1.5 })).toEqual({
      ...importing,
      fraction: 1,
    });
    expect(reduceFileFlow(importing, { type: 'progress', fraction: -1 })).toEqual({
      ...importing,
      fraction: 0,
    });
  });

  it('reset always returns to idle regardless of current state', () => {
    const importing: FileFlowState = {
      kind: 'importing',
      name: 'x',
      requestId: 'r',
      fraction: 0.5,
    };
    expect(reduceFileFlow(importing, { type: 'reset' })).toEqual(IDLE);
  });

  it('fail carries the in-flight name forward when one exists', () => {
    const acquiring: FileFlowState = { kind: 'acquiring', name: 'plan.dxf' };
    expect(reduceFileFlow(acquiring, { type: 'fail', code: 'E', message: 'boom' })).toEqual({
      kind: 'failed',
      name: 'plan.dxf',
      code: 'E',
      message: 'boom',
    });
  });

  it('fail from idle has no name to carry forward', () => {
    expect(reduceFileFlow(IDLE, { type: 'fail', code: 'E', message: 'boom' })).toEqual({
      kind: 'failed',
      code: 'E',
      message: 'boom',
    });
  });

  it('safe-mode transitions any named state into read-only-safe-mode with a reason', () => {
    const detecting: FileFlowState = { kind: 'detecting', name: 'weird.arq' };
    expect(reduceFileFlow(detecting, { type: 'safe-mode', reason: 'unsupported feature' })).toEqual(
      {
        kind: 'read-only-safe-mode',
        name: 'weird.arq',
        reason: 'unsupported feature',
      },
    );
  });

  it('ignores an event that does not apply to the current state', () => {
    expect(reduceFileFlow(IDLE, { type: 'staged' })).toBe(IDLE);
  });
});

describe('project lifecycle after preflight', () => {
  const preflighted: FileFlowState = {
    kind: 'native-opening',
    name: 'house.arq',
    sidecarDependency: 'complete',
  };

  function openFully(writable = true): FileFlowState {
    return [
      { type: 'stage-start' } as const,
      { type: 'stage-complete', projectId: 'p1' } as const,
      { type: 'migration-verified' } as const,
      { type: 'worker-opened', writable } as const,
      { type: 'hydrate-start' } as const,
      { type: 'hydrated' } as const,
    ].reduce<FileFlowState>(reduceFileFlow, preflighted);
  }

  it('reaches an active workspace only through every stage in order', () => {
    const active = openFully();
    expect(active.kind).toBe('workspace-active');
    expect(isProjectOpen(active)).toBe(true);
    expect(isProjectWritable(active)).toBe(true);
  });

  // The rule this whole state machine exists to enforce. Before it, the flow
  // stopped at "compatible Arq project" and anything downstream had to decide
  // for itself whether that meant open.
  it('reports no state before workspace-active as open', () => {
    const states: FileFlowState[] = [
      { kind: 'idle' },
      { kind: 'acquiring', name: 'a' },
      { kind: 'detecting', name: 'a' },
      preflighted,
      { kind: 'staging', name: 'a', fraction: 0.5 },
      { kind: 'staged', name: 'a', projectId: 'p1' },
      { kind: 'migration-verified', name: 'a', projectId: 'p1' },
      { kind: 'worker-open', name: 'a', projectId: 'p1', writable: true },
      { kind: 'hydrating', name: 'a', projectId: 'p1', writable: true },
    ];
    for (const state of states) {
      expect(isProjectOpen(state)).toBe(false);
      expect(isProjectWritable(state)).toBe(false);
    }
  });

  it('refuses to skip a stage', () => {
    // Worker open without migration verification must not advance.
    const skipped = reduceFileFlow(
      { kind: 'staged', name: 'a', projectId: 'p1' },
      { type: 'worker-opened', writable: true },
    );
    expect(skipped.kind).toBe('staged');

    // Hydrated without hydrating must not produce an active workspace.
    const notHydrated = reduceFileFlow(
      { kind: 'worker-open', name: 'a', projectId: 'p1', writable: true },
      { type: 'hydrated' },
    );
    expect(notHydrated.kind).toBe('worker-open');
    expect(isProjectOpen(notHydrated)).toBe(false);
  });

  it('keeps a read-only file read-only all the way to active', () => {
    const active = openFully(false);
    expect(active.kind).toBe('workspace-active');
    expect(isProjectOpen(active)).toBe(true);
    expect(isProjectWritable(active)).toBe(false);
  });

  it('carries the last known good project through every failure', () => {
    const active = openFully();
    for (const event of [
      { type: 'project-fail', reason: 'worker-failed', detail: 'x' } as const,
      { type: 'close' } as const,
    ]) {
      const failed = reduceFileFlow(active, event);
      expect(lastKnownGoodProject(failed)).toEqual({ projectId: 'p1', name: 'house.arq' });
      expect(isProjectOpen(failed)).toBe(false);
    }
  });

  it('keeps the half-migrated copy when migration fails', () => {
    const quarantined = reduceFileFlow(
      { kind: 'staged', name: 'house.arq', projectId: 'p1' },
      { type: 'quarantine', quarantinePath: '/quarantine/p1.sqlite3' },
    );
    expect(quarantined).toMatchObject({
      kind: 'quarantined',
      quarantinePath: '/quarantine/p1.sqlite3',
    });
    expect(isProjectOpen(quarantined)).toBe(false);
  });

  it('only cancels a stage that has something in flight', () => {
    const cancelled = reduceFileFlow(
      { kind: 'staging', name: 'a', fraction: 0.2 },
      { type: 'cancel' },
    );
    expect(cancelled).toMatchObject({ kind: 'cancelled', cancelledAt: 'staging' });

    // Nothing is in flight in an active workspace, so cancel must not invent an
    // undo that never happened.
    const active = openFully();
    expect(reduceFileFlow(active, { type: 'cancel' })).toBe(active);
  });

  it('sends recovery back through hydration rather than straight to active', () => {
    const withRecovery = [
      { type: 'stage-start' } as const,
      { type: 'stage-complete', projectId: 'p1' } as const,
      { type: 'migration-verified' } as const,
      { type: 'worker-opened', writable: true } as const,
      { type: 'recovery-found', journalledOperations: 3 } as const,
      { type: 'recover-start' } as const,
      { type: 'recovered' } as const,
    ].reduce<FileFlowState>(reduceFileFlow, preflighted);
    expect(withRecovery.kind).toBe('hydrating');
    expect(isProjectOpen(withRecovery)).toBe(false);
  });

  it('does not treat publishing as a save that already happened', () => {
    const publishing = reduceFileFlow(openFully(), { type: 'publish-start' });
    expect(publishing.kind).toBe('publishing');
  });

  it('refuses to reach published straight from publishing, without verification', () => {
    const publishing = reduceFileFlow(openFully(), { type: 'publish-start' });
    // Writing the bytes is the step that can succeed and still leave an unusable
    // file, so it is the step that must not be able to declare success.
    const shortcut = reduceFileFlow(publishing, {
      type: 'published',
      revision: 4,
      semanticHash: 'abc',
    });
    expect(shortcut.kind).toBe('publishing');
  });

  it('reaches published only through verification, carrying the reader’s own findings', () => {
    const verifying = [
      { type: 'publish-start' } as const,
      { type: 'publish-verify-start' } as const,
    ].reduce<FileFlowState>(reduceFileFlow, openFully());
    expect(verifying.kind).toBe('publication-verifying');

    const published = reduceFileFlow(verifying, {
      type: 'published',
      revision: 214,
      semanticHash: 'deadbeef',
    });
    expect(published).toMatchObject({
      kind: 'published',
      revision: 214,
      semanticHash: 'deadbeef',
    });
  });

  it('does not call a project open while its publication is being verified', () => {
    const verifying = [
      { type: 'publish-start' } as const,
      { type: 'publish-verify-start' } as const,
    ].reduce<FileFlowState>(reduceFileFlow, openFully());
    expect(isProjectOpen(verifying)).toBe(false);
    expect(isProjectWritable(verifying)).toBe(false);
  });

  it('ignores a cancel during verification rather than claiming nothing changed', () => {
    const verifying = [
      { type: 'publish-start' } as const,
      { type: 'publish-verify-start' } as const,
    ].reduce<FileFlowState>(reduceFileFlow, openFully());
    // A file exists on disk whose soundness is exactly what is unknown, so
    // "cancelled, nothing changed" would be false about it.
    expect(reduceFileFlow(verifying, { type: 'cancel' })).toEqual(verifying);
  });

  it('keeps the project as last known good when a publication fails', () => {
    const verifying = [
      { type: 'publish-start' } as const,
      { type: 'publish-verify-start' } as const,
    ].reduce<FileFlowState>(reduceFileFlow, openFully());

    const failed = reduceFileFlow(verifying, {
      type: 'project-fail',
      reason: 'publication-failed',
      detail: 'the published file did not match this revision',
    });

    expect(failed).toMatchObject({ kind: 'project-failed', reason: 'publication-failed' });
    // The failure copy promises the user their changes are still in the working
    // project. That has to be true of the state, not only of the wording.
    expect(lastKnownGoodProject(failed)).toEqual({ projectId: 'p1', name: 'house.arq' });
  });

  it('returns to the open project after publishing, without reopening it', () => {
    const published = [
      { type: 'publish-start' } as const,
      { type: 'publish-verify-start' } as const,
      { type: 'published', revision: 3, semanticHash: 'abc' } as const,
    ].reduce<FileFlowState>(reduceFileFlow, openFully());

    const resumed = reduceFileFlow(published, { type: 'resume-editing' });

    expect(resumed.kind).toBe('workspace-active');
    expect(isProjectWritable(resumed)).toBe(true);
  });

  it('does not make a read-only project writable by publishing it', () => {
    const readOnly = [
      { type: 'publish-start' } as const,
      { type: 'publish-verify-start' } as const,
      { type: 'published', revision: 1, semanticHash: 'abc' } as const,
      { type: 'resume-editing' } as const,
    ].reduce<FileFlowState>(reduceFileFlow, openFully(false));

    expect(readOnly.kind).toBe('workspace-active');
    expect(isProjectWritable(readOnly)).toBe(false);
  });
});
