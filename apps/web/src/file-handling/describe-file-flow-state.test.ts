import { describe, expect, it } from 'vitest';
import { describeFileFlowState } from './describe-file-flow-state';
import type { FileFlowState } from './file-state-machine';

describe('describeFileFlowState', () => {
  it('never claims a project is open for the native-opening state - it is honest about the unwired boundary', () => {
    const description = describeFileFlowState({ kind: 'native-opening', name: 'house.arq' });

    expect(description.headline).not.toMatch(/is open|opened successfully/i);
    expect(description.detail).toMatch(/not wired/i);
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
   * The reachable success state must be unambiguous. There is no longer a
   * variant of `native-opening` that means "accepted, but possibly stale" - if
   * the flow reaches it at all, the bytes are whole.
   */
  it('describes the one native-opening state as complete, with no incomplete variant left', () => {
    const description = describeFileFlowState({ kind: 'native-opening', name: 'house.arq' });

    expect(description.tone).toBe('neutral');
    expect(description.headline).toMatch(/complete/i);
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

  it('describes every state kind without throwing (exhaustiveness)', () => {
    const states: readonly FileFlowState[] = [
      { kind: 'idle' },
      { kind: 'acquiring', name: 'a.arq' },
      { kind: 'detecting', name: 'a.arq' },
      { kind: 'native-opening', name: 'a.arq' },
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
});
