import { describe, expect, it } from 'vitest';
import { describeFileFlowState } from './describe-file-flow-state';
import type { FileFlowState } from './file-state-machine';

const PUBLISH_FACTS = {
  projectName: 'a',
  revision: 2,
  sidecarDependency: 'complete',
  conditionNote: null,
} as const;

describe('describeFileFlowState', () => {
  /**
   * `native-opening` is progress, not a verdict: the bytes were accepted and the
   * project is being copied into a local working copy. It must not claim the
   * project is open, because the decode and adoption that make that true have
   * not happened yet - `workspace-active` is the only state entitled to say so.
   */
  it('reports native-opening as work in progress, not as an opened project', () => {
    const description = describeFileFlowState({
      kind: 'native-opening',
      name: 'house.arq',
      sidecarDependency: 'complete',
    });

    expect(description.tone).toBe('progress');
    expect(description.headline).toMatch(/opening/i);
    expect(description.headline).not.toMatch(/is open\b|opened successfully/i);
    // Names where the copy goes, so "opening" does not read as "uploading".
    expect(description.detail).toMatch(/local working copy/i);
  });

  it('says a project is open only once it has actually been adopted', () => {
    const description = describeFileFlowState({
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'p1',
      readOnlyReason: null,
      facts: {
        projectName: 'Courtyard House',
        revision: 12,
        sidecarDependency: 'complete',
        conditionNote: null,
      },
    });

    expect(description.tone).toBe('neutral');
    // The project's own name, not the file's: a file renamed on disk is not a
    // renamed project, and the name the reader recognises is the one inside.
    expect(description.headline).toBe('Courtyard House is open · revision 12');
  });

  /**
   * A project that silently refuses edits is a bug report; one that says so is a
   * product. Read-only rides on the state decided at Worker open, so a file that
   * opened read-only is provably still read-only when the workspace renders it.
   */
  it('says so when a project opened read-only', () => {
    const description = describeFileFlowState({
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'p1',
      readOnlyReason: 'newer-format-version',
      facts: {
        projectName: 'House',
        revision: 4,
        sidecarDependency: 'complete',
        conditionNote: null,
      },
    });

    expect(description.tone).toBe('warning');
    expect(description.headline).toMatch(/read-only/i);
    // The reason travels with the state rather than leaving the user to find it
    // by trying to draw.
    expect(description.detail).toContain('newer version');
  });

  /**
   * The silent-staleness case, now handled by refusing rather than cautioning.
   *
   * SQLite opened without a write-ahead log's `-wal` sidecar does not fail - it
   * returns the database as of the last checkpoint - so an accepted file can be
   * missing the user's most recent saved work with nothing reporting a problem.
   * That used to reach `native-opening` and be described as "compatible, but it
   * may not be complete". A caution shown beside a project that is already on
   * screen is not a safeguard, so the state is now a failure with its own code.
   */
  it('reports a missing write-ahead-log sidecar as a failure, naming the file and the way out', () => {
    const description = describeFileFlowState({
      kind: 'failed',
      name: 'house.arq',
      code: 'ARQ_WAL_SIDECAR_REQUIRED',
      message:
        'This database depends on a companion "-wal" file that was not included, so it may be missing the newest saved work. Reopen the project in the application that created it and close it cleanly, which folds the companion file back into the database, then choose the database again.',
    });

    expect(description.tone).toBe('error');
    expect(description.headline).toMatch(/could not be opened/i);
    // Names the actual artifact the user has to find, and the remedy.
    expect(description.detail).toMatch(/-wal/);
    expect(description.detail).toMatch(/close it cleanly/i);
    expect(description.detail).toContain('ARQ_WAL_SIDECAR_REQUIRED');
  });

  /**
   * There is no longer a variant of `native-opening` that means "accepted, but
   * possibly stale" - if the flow reaches it at all, the bytes are whole.
   */
  it('has no state that hedges about completeness', () => {
    const description = describeFileFlowState({
      kind: 'native-opening',
      name: 'house.arq',
      sidecarDependency: 'complete',
    });

    expect(description.headline).not.toMatch(/may not be complete/i);
  });

  it('surfaces the real failure code and message, not a generic error string', () => {
    const description = describeFileFlowState({
      kind: 'failed',
      name: 'house.arq',
      code: 'ARQ_FILE_TRUNCATED',
      message: 'SQLite page count exceeds the bytes available in the file.',
    });
    expect(description.tone).toBe('error');
    expect(description.detail).toBe(
      'ARQ_FILE_TRUNCATED: SQLite page count exceeds the bytes available in the file.',
    );
  });

  it('handles a failure with no file name yet (rejected before a name was ever acquired)', () => {
    const description = describeFileFlowState({
      kind: 'failed',
      code: 'NO_FORMAT_CANDIDATE',
      message: 'No file format candidate was produced.',
    });
    expect(description.headline).toBe('This file could not be opened.');
  });

  it('surfaces the real safe-mode reason, not a paraphrase', () => {
    const description = describeFileFlowState({
      kind: 'read-only-safe-mode',
      name: 'house.arq',
      reason: 'a previous local write did not reach commit',
    });
    expect(description.tone).toBe('warning');
    expect(description.detail).toBe('a previous local write did not reach commit');
  });

  /**
   * The rule the state-language map already states for this machine: "published"
   * is licensed only after the file was reopened and verified. Before this the
   * copy asserted that check had happened while no such check existed anywhere in
   * the flow, which is the strongest form of the claim being wrong - the
   * reassurance was the fabrication.
   */
  it('does not say a project file was published while the file is still being checked', () => {
    const description = describeFileFlowState({
      kind: 'publication-verifying',
      name: 'house.arq',
      projectId: 'p1',
      readOnlyReason: null,
      facts: PUBLISH_FACTS,
    });

    expect(description.headline).not.toMatch(/published/i);
    expect(description.tone).toBe('progress');
  });

  it('names the exact revision it published, so the claim can be checked', () => {
    const description = describeFileFlowState({
      kind: 'published',
      name: 'house.arq',
      projectId: 'p1',
      readOnlyReason: null,
      facts: PUBLISH_FACTS,
      revision: 214,
      semanticHash: 'deadbeef',
    });

    expect(description.headline).toContain('214');
    expect(description.detail).toMatch(/reopened and checked/i);
  });

  it('never calls publishing a sync or a save', () => {
    const publishStates: readonly FileFlowState[] = [
      {
        kind: 'publishing',
        name: 'a.arq',
        projectId: 'p1',
        fraction: 0.5,
        readOnlyReason: null,
        facts: PUBLISH_FACTS,
      },
      {
        kind: 'publication-verifying',
        name: 'a.arq',
        projectId: 'p1',
        readOnlyReason: null,
        facts: PUBLISH_FACTS,
      },
      {
        kind: 'published',
        name: 'a.arq',
        projectId: 'p1',
        readOnlyReason: null,
        facts: PUBLISH_FACTS,
        revision: 2,
        semanticHash: 'h',
      },
    ];

    for (const state of publishStates) {
      const { headline, detail } = describeFileFlowState(state);
      const copy = `${headline} ${detail ?? ''}`;
      expect(copy).not.toMatch(/synced|saved|auto-saved/i);
    }
  });

  it('describes every state kind without throwing (exhaustiveness)', () => {
    const states: readonly FileFlowState[] = [
      { kind: 'idle' },
      { kind: 'staging', name: 'a.arq', fraction: 0.25 },
      { kind: 'staged', name: 'a.arq', projectId: 'p1' },
      { kind: 'migration-verified', name: 'a.arq', projectId: 'p1' },
      { kind: 'worker-open', name: 'a.arq', projectId: 'p1', readOnlyReason: null },
      { kind: 'hydrating', name: 'a.arq', projectId: 'p1', readOnlyReason: null },
      { kind: 'quarantined', name: 'a.arq', quarantinePath: '/q/a.arq', lastKnownGood: null },
      { kind: 'cancelled', name: 'a.arq', cancelledAt: 'staging', lastKnownGood: null },
      {
        kind: 'project-failed',
        name: 'a.arq',
        reason: 'publication-failed',
        detail: 'd',
        lastKnownGood: null,
      },
      {
        kind: 'recovery-available',
        name: 'a.arq',
        projectId: 'p1',
        journalledOperations: 2,
        readOnlyReason: null,
      },
      { kind: 'recovering', name: 'a.arq', projectId: 'p1', readOnlyReason: null },
      {
        kind: 'publishing',
        name: 'a.arq',
        projectId: 'p1',
        fraction: 0.5,
        readOnlyReason: null,
        facts: PUBLISH_FACTS,
      },
      {
        kind: 'publication-verifying',
        name: 'a.arq',
        projectId: 'p1',
        readOnlyReason: null,
        facts: PUBLISH_FACTS,
      },
      {
        kind: 'published',
        name: 'a.arq',
        projectId: 'p1',
        readOnlyReason: null,
        facts: PUBLISH_FACTS,
        revision: 2,
        semanticHash: 'h',
      },
      { kind: 'closed', lastKnownGood: null },
      { kind: 'acquiring', name: 'a.arq' },
      { kind: 'detecting', name: 'a.arq' },
      { kind: 'native-opening', name: 'a.arq', sidecarDependency: 'complete' },
      {
        kind: 'workspace-active',
        name: 'a.arq',
        projectId: 'p1',
        readOnlyReason: null,
        facts: {
          projectName: 'A',
          revision: 1,
          sidecarDependency: 'complete',
          conditionNote: null,
        },
      },
      {
        kind: 'workspace-active',
        name: 'a.arq',
        projectId: 'p1',
        readOnlyReason: 'build-cannot-write',
        facts: {
          projectName: 'A',
          revision: 1,
          sidecarDependency: 'complete',
          conditionNote: null,
        },
      },
      { kind: 'import-options', name: 'a.dxf', formatId: 'dxf' },
      { kind: 'importing', name: 'a.dxf', requestId: 'r1', fraction: 0.5 },
      { kind: 'staged-review', name: 'a.dxf', requestId: 'r1' },
      { kind: 'migrating', name: 'a.arq', fraction: 0.5 },
      { kind: 'read-only-safe-mode', name: 'a.arq', reason: 'corrupt' },
      { kind: 'failed', code: 'X', message: 'y' },
    ];
    for (const state of states) {
      expect(() => describeFileFlowState(state)).not.toThrow();
      expect(describeFileFlowState(state).headline.length).toBeGreaterThan(0);
    }
  });

  /**
   * The state that only exists because this build can now really open a project.
   * A user told a project is open will try to edit it, so the same sentence that
   * says "open" has to say "read-only" and has to say the chosen file is
   * untouched - otherwise the true half is read as permission for the rest.
   */
  it('says a project is open, and in the same breath what cannot be done with it', () => {
    const description = describeFileFlowState({
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'open-1',
      readOnlyReason: 'build-cannot-write',
      facts: {
        projectName: 'Courtyard House Reference',
        revision: 191,
        sidecarDependency: 'complete',
        conditionNote: null,
      },
    });

    expect(description.headline).toBe(
      'Courtyard House Reference is open, read-only · revision 191',
    );
    expect(description.detail).toMatch(/does not edit or save/i);
    expect(description.detail).toMatch(/unchanged/i);
    expect(description.tone).toBe('neutral');
  });

  /**
   * Two causes, two sentences. Telling a reader their file is from a newer ARQ
   * when the real limit is this build is a false statement about their own work,
   * so the copy must not collapse the two into one read-only apology.
   */
  it('names the cause of read-only rather than assuming one', () => {
    const byFile = describeFileFlowState({
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'p1',
      readOnlyReason: 'newer-format-version',
      facts: {
        projectName: 'House',
        revision: 4,
        sidecarDependency: 'complete',
        conditionNote: null,
      },
    });

    expect(byFile.detail).toMatch(/newer version of ARQ/i);
    expect(byFile.detail).not.toMatch(/does not edit or save/i);
  });

  it('says nothing about read-only when the project is writable', () => {
    const description = describeFileFlowState({
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'p1',
      readOnlyReason: null,
      facts: {
        projectName: 'House',
        revision: 4,
        sidecarDependency: 'complete',
        conditionNote: null,
      },
    });

    expect(description.headline).toBe('House is open · revision 4');
    expect(description.headline).not.toMatch(/read-only/i);
    expect(description.detail).toBeNull();
  });

  it('keeps the write-ahead-log caution after a successful open', () => {
    const description = describeFileFlowState({
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'open-1',
      readOnlyReason: 'build-cannot-write',
      facts: {
        projectName: 'House',
        revision: 4,
        sidecarDependency: 'write-ahead-log-sidecar',
        conditionNote: null,
      },
    });

    // A successful open must not swallow the fact that the newest work may be in
    // a sidecar the file picker never handed over.
    expect(description.tone).toBe('warning');
    expect(description.detail).toMatch(/-wal/);
  });

  it('adds a file condition note when the open found one worth stating', () => {
    const description = describeFileFlowState({
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'open-1',
      readOnlyReason: 'build-cannot-write',
      facts: {
        projectName: 'House',
        revision: 4,
        sidecarDependency: 'complete',
        conditionNote: 'A previous write to this project did not finish.',
      },
    });

    expect(description.detail).toMatch(/did not finish/);
  });

  /**
   * The states between preflight and an active workspace are the ones a false
   * open would hide in, so none of them may use the word.
   */
  it('never says a project is open before hydration finishes', () => {
    const inFlight: readonly FileFlowState[] = [
      { kind: 'worker-open', name: 'house.arq', projectId: 'p1', readOnlyReason: null },
      {
        kind: 'worker-open',
        name: 'house.arq',
        projectId: 'p1',
        readOnlyReason: 'build-cannot-write',
      },
      { kind: 'hydrating', name: 'house.arq', projectId: 'p1', readOnlyReason: null },
    ];
    for (const state of inFlight) {
      const description = describeFileFlowState(state);
      expect(description.tone).toBe('progress');
      expect(description.headline).not.toMatch(/\bis open\b/);
      // No fabricated fraction: neither stage has a measurable one.
      expect(description.headline).not.toMatch(/%/);
    }
  });
});
