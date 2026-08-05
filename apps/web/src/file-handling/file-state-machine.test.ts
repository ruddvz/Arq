import { describe, expect, it } from 'vitest';
import {
  reduceFileFlow,
  type FileFlowState,
  isProjectOpen,
  isProjectWritable,
  lastKnownGoodProject,
  type ProjectReadOnlyReason,
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

    state = reduceFileFlow(state, { type: 'progress', requestId: 'req-1', fraction: 0.5 });
    expect(state).toEqual({
      kind: 'importing',
      name: 'plan.dxf',
      requestId: 'req-1',
      fraction: 0.5,
    });

    state = reduceFileFlow(state, { type: 'staged', requestId: 'req-1' });
    expect(state).toEqual({ kind: 'staged-review', name: 'plan.dxf', requestId: 'req-1' });
  });

  it('clamps progress fraction into [0, 1]', () => {
    const importing: FileFlowState = { kind: 'importing', name: 'x', requestId: 'r', fraction: 0 };
    expect(reduceFileFlow(importing, { type: 'progress', requestId: 'r', fraction: 1.5 })).toEqual({
      ...importing,
      fraction: 1,
    });
    expect(reduceFileFlow(importing, { type: 'progress', requestId: 'r', fraction: -1 })).toEqual({
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
    expect(reduceFileFlow(IDLE, { type: 'staged', requestId: 'r' })).toBe(IDLE);
  });

  it('lets an open fail from any point in the open, keeping the file name', () => {
    const failed = reduceFileFlow(
      {
        kind: 'worker-open',
        name: 'house.arq',
        projectId: 'open-1',
        readOnlyReason: 'build-cannot-write',
      },
      { type: 'fail', code: 'CHECKSUM_MISMATCH', message: 'model.json' },
    );

    expect(failed).toEqual({
      kind: 'failed',
      name: 'house.arq',
      code: 'CHECKSUM_MISMATCH',
      message: 'model.json',
    });
  });
});

/**
 * The open this build actually performs. It reaches the same lifecycle as a
 * staged open, through a transition that reports the truth about itself: no
 * working copy was made, so the project can only ever be read.
 */
describe('in-place read-only open', () => {
  const compatible: FileFlowState = {
    kind: 'native-opening',
    name: 'house.arq',
    sidecarDependency: 'complete',
  };
  const FACTS = {
    projectName: 'House',
    revision: 191,
    sidecarDependency: 'complete',
    conditionNote: null,
  } as const;

  it('only starts from a file already found compatible', () => {
    expect(reduceFileFlow(compatible, { type: 'open-in-place', projectId: 'open-1' })).toEqual({
      kind: 'worker-open',
      name: 'house.arq',
      projectId: 'open-1',
      readOnlyReason: 'build-cannot-write',
    });
    // Preflight cannot be skipped: an open cannot begin from acquisition or detection.
    for (const state of [
      { kind: 'idle' } as const,
      { kind: 'acquiring', name: 'house.arq' } as const,
      { kind: 'detecting', name: 'house.arq' } as const,
    ]) {
      expect(reduceFileFlow(state, { type: 'open-in-place', projectId: 'open-1' })).toBe(state);
    }
  });

  it('cannot reach an active workspace writable, however it is driven', () => {
    const active = [
      { type: 'open-in-place', projectId: 'open-1' } as const,
      { type: 'hydrate-start' } as const,
      { type: 'hydrated', facts: FACTS } as const,
    ].reduce<FileFlowState>(reduceFileFlow, compatible);

    expect(active.kind).toBe('workspace-active');
    expect(isProjectOpen(active)).toBe(true);
    // The guarantee: an open with no working copy behind it never becomes
    // writable, and says which of the two causes applies.
    expect(isProjectWritable(active)).toBe(false);
    expect(active).toMatchObject({ readOnlyReason: 'build-cannot-write', facts: FACTS });
  });

  it('is not open until hydration finishes', () => {
    const workerOpen = reduceFileFlow(compatible, { type: 'open-in-place', projectId: 'open-1' });
    const hydrating = reduceFileFlow(workerOpen, { type: 'hydrate-start' });
    for (const state of [workerOpen, hydrating]) {
      expect(isProjectOpen(state)).toBe(false);
    }
  });

  /**
   * A successful open does not make an absent `-wal` sidecar's missing commits
   * reappear, so the caution has to survive into the opened state.
   */
  it('carries a write-ahead-log dependency into the opened project', () => {
    const active = [
      { type: 'open-in-place', projectId: 'open-1' } as const,
      { type: 'hydrate-start' } as const,
      {
        type: 'hydrated',
        facts: { ...FACTS, sidecarDependency: 'write-ahead-log-sidecar' },
      } as const,
    ].reduce<FileFlowState>(reduceFileFlow, {
      kind: 'native-opening',
      name: 'house.arq',
      sidecarDependency: 'write-ahead-log-sidecar',
    });

    expect(active).toMatchObject({
      kind: 'workspace-active',
      facts: { sidecarDependency: 'write-ahead-log-sidecar' },
    });
  });
});

describe('project lifecycle after preflight', () => {
  const preflighted: FileFlowState = {
    kind: 'native-opening',
    name: 'house.arq',
    sidecarDependency: 'complete',
  };

  const FACTS = {
    projectName: 'House',
    revision: 191,
    sidecarDependency: 'complete',
    conditionNote: null,
  } as const;

  function openFully(readOnlyReason: ProjectReadOnlyReason | null = null): FileFlowState {
    return [
      { type: 'stage-start' } as const,
      { type: 'stage-complete', projectId: 'p1' } as const,
      { type: 'migration-verified' } as const,
      { type: 'worker-opened', readOnlyReason } as const,
      { type: 'hydrate-start' } as const,
      { type: 'hydrated', facts: FACTS } as const,
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
      { kind: 'worker-open', name: 'a', projectId: 'p1', readOnlyReason: null },
      { kind: 'hydrating', name: 'a', projectId: 'p1', readOnlyReason: null },
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
      { type: 'worker-opened', readOnlyReason: null },
    );
    expect(skipped.kind).toBe('staged');

    // Hydrated without hydrating must not produce an active workspace.
    const notHydrated = reduceFileFlow(
      { kind: 'worker-open', name: 'a', projectId: 'p1', readOnlyReason: null },
      { type: 'hydrated', facts: FACTS },
    );
    expect(notHydrated.kind).toBe('worker-open');
    expect(isProjectOpen(notHydrated)).toBe(false);
  });

  it('keeps a read-only file read-only all the way to active', () => {
    const active = openFully('newer-format-version');
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
      { type: 'worker-opened', readOnlyReason: null } as const,
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
    ].reduce<FileFlowState>(reduceFileFlow, openFully('newer-format-version'));

    expect(readOnly.kind).toBe('workspace-active');
    expect(isProjectWritable(readOnly)).toBe(false);
    // The cause survives the round trip too: resuming must not downgrade "this
    // file is from a newer ARQ" into a generic read-only.
    expect(readOnly).toMatchObject({ readOnlyReason: 'newer-format-version' });
  });
});

describe('V3-019: a superseded import cannot drive the current one', () => {
  const importing: FileFlowState = {
    kind: 'importing',
    name: 'plan.dxf',
    requestId: 'req-2',
    fraction: 0.1,
  };

  it('ignores progress from an abandoned request', () => {
    // The request id has been on this state since it was written and was never
    // compared, so an abandoned import's progress drove the live one's bar.
    expect(reduceFileFlow(importing, { type: 'progress', requestId: 'req-1', fraction: 0.9 })).toBe(
      importing,
    );
  });

  it('ignores completion from an abandoned request', () => {
    // The damaging one: `staged` moved the flow to review over bytes the user
    // is no longer importing.
    expect(reduceFileFlow(importing, { type: 'staged', requestId: 'req-1' })).toBe(importing);
  });

  it('still accepts events from the live request', () => {
    const progressed = reduceFileFlow(importing, {
      type: 'progress',
      requestId: 'req-2',
      fraction: 0.5,
    });
    expect(progressed).toMatchObject({ kind: 'importing', fraction: 0.5 });

    expect(reduceFileFlow(importing, { type: 'staged', requestId: 'req-2' })).toMatchObject({
      kind: 'staged-review',
      requestId: 'req-2',
    });
  });
});

describe('V3-015: replacing an open project keeps the one it replaced', () => {
  function activeProject(): FileFlowState {
    return {
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'project-1',
      readOnlyReason: null,
      facts: {
        projectName: 'House',
        revision: 4,
        sidecarDependency: 'complete',
        conditionNote: null,
      },
    };
  }

  it('records the outgoing project when a second file is picked', () => {
    // Opening another file while a project is active is legitimate. Losing the
    // outgoing project's identity on the way is not.
    const acquiring = reduceFileFlow(activeProject(), { type: 'acquire', name: 'flat.arq' });

    expect(acquiring).toMatchObject({
      kind: 'acquiring',
      name: 'flat.arq',
      replacing: { projectId: 'project-1', name: 'house.arq' },
    });
  });

  it('hands the replaced project to a failure, so there is a route back', () => {
    // Before this, a replacement failing anywhere in preflight left the user at
    // `failed` with nothing, having had a working project a moment earlier.
    let state = reduceFileFlow(activeProject(), { type: 'acquire', name: 'flat.arq' });
    state = reduceFileFlow(state, { type: 'fail', code: 'ARQ_UNREADABLE', message: 'bad bytes' });

    expect(state).toMatchObject({
      kind: 'failed',
      code: 'ARQ_UNREADABLE',
      lastKnownGood: { projectId: 'project-1', name: 'house.arq' },
    });
  });

  it('records nothing to replace when no project was open', () => {
    expect(reduceFileFlow(IDLE, { type: 'acquire', name: 'first.arq' })).toEqual({
      kind: 'acquiring',
      name: 'first.arq',
    });
  });

  it('carries a project through a failure that is not a replacement', () => {
    const state = reduceFileFlow(activeProject(), {
      type: 'fail',
      code: 'ARQ_X',
      message: 'x',
    });

    expect(state).toMatchObject({ lastKnownGood: { projectId: 'project-1' } });
  });
});

describe('V3-012 and V3-018: invariants across every state and event pair', () => {
  const STATES: readonly FileFlowState[] = [
    { kind: 'idle' },
    { kind: 'acquiring', name: 'a.arq' },
    { kind: 'detecting', name: 'a.arq' },
    { kind: 'native-opening', name: 'a.arq', sidecarDependency: 'complete' },
    { kind: 'import-options', name: 'a.dxf', formatId: 'dxf' },
    { kind: 'importing', name: 'a.dxf', requestId: 'r', fraction: 0.2 },
    { kind: 'staged-review', name: 'a.dxf', requestId: 'r' },
    { kind: 'migrating', name: 'a.arq', fraction: 0.3 },
    { kind: 'read-only-safe-mode', name: 'a.arq', reason: 'locked' },
    { kind: 'failed', name: 'a.arq', code: 'X', message: 'm' },
    { kind: 'staging', name: 'a.arq', fraction: 0.4 },
    { kind: 'staged', name: 'a.arq', projectId: 'p1' },
    { kind: 'migration-verified', name: 'a.arq', projectId: 'p1' },
    { kind: 'worker-open', name: 'a.arq', projectId: 'p1', readOnlyReason: null },
    { kind: 'hydrating', name: 'a.arq', projectId: 'p1', readOnlyReason: null },
    {
      kind: 'workspace-active',
      name: 'a.arq',
      projectId: 'p1',
      readOnlyReason: null,
      facts: {
        projectName: 'House',
        revision: 4,
        sidecarDependency: 'complete',
        conditionNote: null,
      },
    },
    { kind: 'closed', lastKnownGood: { projectId: 'p1', name: 'a.arq' } },
  ];

  const EVENTS: readonly Parameters<typeof reduceFileFlow>[1][] = [
    { type: 'reset' },
    { type: 'acquire', name: 'b.arq' },
    { type: 'acquired' },
    { type: 'route-native', sidecarDependency: 'complete' },
    { type: 'route-import', formatId: 'dxf' },
    { type: 'import-start', requestId: 'r2' },
    { type: 'progress', requestId: 'r', fraction: 0.7 },
    { type: 'staged', requestId: 'r' },
    { type: 'safe-mode', reason: 'locked' },
    { type: 'fail', code: 'X', message: 'm' },
    { type: 'stage-start' },
    { type: 'stage-progress', fraction: 0.6 },
    { type: 'stage-complete', projectId: 'p2' },
    { type: 'migration-verified' },
    { type: 'worker-opened', readOnlyReason: null },
    { type: 'hydrate-start' },
    {
      type: 'hydrated',
      facts: {
        projectName: 'House',
        revision: 4,
        sidecarDependency: 'complete',
        conditionNote: null,
      },
    },
    { type: 'project-fail', reason: 'corrupt', detail: 'm' },
    { type: 'quarantine', quarantinePath: '/q' },
    { type: 'cancel' },
    { type: 'publish-start' },
    { type: 'publish-verify-start' },
    { type: 'published', revision: 3, semanticHash: 'h' },
    { type: 'resume-editing' },
    { type: 'close' },
  ];

  /**
   * V3-012, swept rather than sampled. The reducer's own comment says skipping
   * a stage is the dangerous direction, and the way that regresses is a new
   * event handled without naming the state it comes from - which no single
   * example test would catch.
   */
  it('never opens a project without having hydrated one', () => {
    for (const state of STATES) {
      for (const event of EVENTS) {
        const next = reduceFileFlow(state, event);
        if (!isProjectOpen(next) || isProjectOpen(state)) {
          continue;
        }
        // The only way to reach an open project from a closed one is to
        // hydrate, or to resume editing a project that is already open behind
        // a publication.
        expect(['hydrated', 'resume-editing']).toContain(event.type);
      }
    }
  });

  it('never returns a writable project from a read-only one without an explicit event', () => {
    const readOnly: FileFlowState = {
      kind: 'workspace-active',
      name: 'a.arq',
      projectId: 'p1',
      readOnlyReason: 'newer-format-version',
      facts: {
        projectName: 'House',
        revision: 4,
        sidecarDependency: 'complete',
        conditionNote: null,
      },
    };

    for (const event of EVENTS) {
      const next = reduceFileFlow(readOnly, event);
      if (isProjectWritable(next)) {
        // Only a fresh open can produce a writable project from this one.
        expect(['hydrated', 'worker-opened']).toContain(event.type);
      }
    }
  });

  it('always returns a state, and never mutates the one it was given', () => {
    for (const state of STATES) {
      const before = JSON.stringify(state);
      for (const event of EVENTS) {
        const next = reduceFileFlow(state, event);
        expect(next).toBeDefined();
        expect(typeof next.kind).toBe('string');
      }
      expect(JSON.stringify(state)).toBe(before);
    }
  });

  it('offers back only a project that was actually open', () => {
    // Holding a project id is not the same as being a project the user can
    // return to. `staged`, `migration-verified`, `worker-open` and `hydrating`
    // each carry an id for a working copy that has never hydrated - there is no
    // semantic model behind it - so offering one as "last known good" would
    // offer something that was never good. Only a project that reached
    // `workspace-active`, and the publication states that read it, qualify.
    const everOpen = new Set([
      'workspace-active',
      'publishing',
      'publication-verifying',
      'published',
    ]);

    for (const state of STATES) {
      if (everOpen.has(state.kind)) {
        expect(lastKnownGoodProject(state)).not.toBeNull();
      } else if ('projectId' in state && typeof state.projectId === 'string') {
        expect(lastKnownGoodProject(state)).toBeNull();
      }
    }
  });
});
