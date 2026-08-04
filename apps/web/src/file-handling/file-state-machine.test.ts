import { describe, expect, it } from 'vitest';
import { reduceFileFlow, type FileFlowState } from './file-state-machine';

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
   * A write-ahead-log project keeps its newest commits in a `-wal` sidecar, and
   * a file picker hands over one file. The reducer must carry that finding into
   * the state rather than flattening every accepted file to the same one, or
   * the copy layer has nothing to distinguish "compatible" from "complete".
   */
  it('carries a write-ahead-log sidecar dependency into native-opening', () => {
    const detecting: FileFlowState = { kind: 'detecting', name: 'project.arq' };
    expect(
      reduceFileFlow(detecting, {
        type: 'route-native',
        sidecarDependency: 'write-ahead-log-sidecar',
      }),
    ).toEqual({
      kind: 'native-opening',
      name: 'project.arq',
      sidecarDependency: 'write-ahead-log-sidecar',
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

  /**
   * The open sequence. Each guard here is a refusal to let a surface show a
   * state the build has not actually reached.
   */
  it('only starts an open from a file already found compatible', () => {
    const compatible = reduceFileFlow(
      { kind: 'detecting', name: 'house.arq' },
      { type: 'route-native', sidecarDependency: 'complete' },
    );

    const opening = reduceFileFlow(compatible, { type: 'open-start', stageName: 'Identify' });

    expect(opening).toEqual({
      kind: 'opening-project',
      name: 'house.arq',
      stageName: 'Identify',
      sidecarDependency: 'complete',
    });
    // Preflight cannot be skipped: an open cannot begin from acquisition or detection.
    for (const state of [
      { kind: 'idle' } as const,
      { kind: 'acquiring', name: 'house.arq' } as const,
      { kind: 'detecting', name: 'house.arq' } as const,
    ]) {
      expect(reduceFileFlow(state, { type: 'open-start', stageName: 'Identify' })).toBe(state);
    }
  });

  it('advances the open stage without losing the file or its completeness', () => {
    const opening = reduceFileFlow(
      {
        kind: 'opening-project',
        name: 'house.arq',
        stageName: 'Identify',
        sidecarDependency: 'write-ahead-log-sidecar',
      },
      { type: 'open-stage', stageName: 'Skeleton' },
    );

    expect(opening).toEqual({
      kind: 'opening-project',
      name: 'house.arq',
      stageName: 'Skeleton',
      sidecarDependency: 'write-ahead-log-sidecar',
    });
  });

  it('reaches an opened project only from an open in progress', () => {
    const opened = reduceFileFlow(
      {
        kind: 'opening-project',
        name: 'house.arq',
        stageName: 'Skeleton',
        sidecarDependency: 'write-ahead-log-sidecar',
      },
      { type: 'project-opened', projectName: 'House', revision: 191, conditionNote: null },
    );

    expect(opened).toEqual({
      kind: 'project-open-read-only',
      name: 'house.arq',
      projectName: 'House',
      revision: 191,
      // Survives the open: a successful open does not make an absent sidecar's
      // missing commits reappear.
      sidecarDependency: 'write-ahead-log-sidecar',
      conditionNote: null,
    });
    // A compatibility verdict is not an open, so it cannot jump straight to opened.
    const compatible = {
      kind: 'native-opening',
      name: 'house.arq',
      sidecarDependency: 'complete',
    } as const;
    expect(
      reduceFileFlow(compatible, {
        type: 'project-opened',
        projectName: 'House',
        revision: 1,
        conditionNote: null,
      }),
    ).toBe(compatible);
  });

  it('lets an open fail from any point in the open, keeping the file name', () => {
    const failed = reduceFileFlow(
      {
        kind: 'opening-project',
        name: 'house.arq',
        stageName: 'Skeleton',
        sidecarDependency: 'complete',
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
