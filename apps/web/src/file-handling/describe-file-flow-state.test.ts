import { describe, expect, it } from 'vitest';
import { describeFileFlowState } from './describe-file-flow-state';
import type { FileFlowState } from './file-state-machine';

describe('describeFileFlowState', () => {
  it('never claims a project is open for the native-opening state - preflight passed, the open has not', () => {
    const description = describeFileFlowState({
      kind: 'native-opening',
      name: 'house.arq',
      sidecarDependency: 'complete',
    });
    // "Opening it" is the honest present tense for a state that has passed byte
    // preflight and has not yet staged, opened, checked or hydrated anything.
    expect(description.headline).not.toMatch(/is open\b|opened successfully/i);
    expect(description.headline).toMatch(/opening/i);
    expect(description.tone).toBe('progress');
  });

  /**
   * The silent-staleness case. SQLite opened without a write-ahead log's `-wal`
   * sidecar does not fail - it returns the database as of the last checkpoint -
   * so an accepted file can be missing the user's most recent saved work with
   * nothing reporting a problem. The copy has to name the companion file and a
   * way out, because a caution the reader cannot act on is only alarming.
   */
  it('warns that a write-ahead-log project may be missing its newest work, and says how to get it', () => {
    const description = describeFileFlowState({
      kind: 'native-opening',
      name: 'house.arq',
      sidecarDependency: 'write-ahead-log-sidecar',
    });

    expect(description.tone).toBe('warning');
    expect(description.headline).toMatch(/may not be complete/i);
    // Names the actual artifact the user has to find, not just "a companion file".
    expect(description.detail).toMatch(/-wal/);
    expect(description.detail).toMatch(/reopen and close|Choose the/i);
    // Still never claims the project is open.
    expect(description.headline).not.toMatch(/is open|opened successfully/i);
  });

  it('says something materially different for a complete file than an incomplete one', () => {
    const complete = describeFileFlowState({
      kind: 'native-opening',
      name: 'house.arq',
      sidecarDependency: 'complete',
    });
    const incomplete = describeFileFlowState({
      kind: 'native-opening',
      name: 'house.arq',
      sidecarDependency: 'write-ahead-log-sidecar',
    });

    expect(complete.headline).not.toBe(incomplete.headline);
    expect(complete.tone).toBe('progress');
    expect(incomplete.tone).toBe('warning');
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
      { kind: 'native-opening', name: 'a.arq', sidecarDependency: 'complete' },
      { kind: 'native-opening', name: 'a.arq', sidecarDependency: 'write-ahead-log-sidecar' },
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
