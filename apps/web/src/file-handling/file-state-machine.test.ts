import { describe, expect, it } from 'vitest';
import { reduceFileFlow, type FileFlowState } from './file-state-machine';

const IDLE: FileFlowState = { kind: 'idle' };

describe('reduceFileFlow', () => {
  it('walks the native-open path: acquire -> acquired -> detecting -> route-native', () => {
    let state = reduceFileFlow(IDLE, { type: 'acquire', name: 'project.arq' });
    expect(state).toEqual({ kind: 'acquiring', name: 'project.arq' });

    state = reduceFileFlow(state, { type: 'acquired' });
    expect(state).toEqual({ kind: 'detecting', name: 'project.arq' });

    state = reduceFileFlow(state, { type: 'route-native' });
    expect(state).toEqual({ kind: 'native-opening', name: 'project.arq' });
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
