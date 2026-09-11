import { describe, expect, it } from 'vitest';
import { createOpenAttemptGuard } from './open-attempt-guard';
import {
  reduceFileFlow,
  isProjectOpen,
  type FileFlowState,
} from '../file-handling/file-state-machine';

describe('createOpenAttemptGuard', () => {
  it('lets the only attempt own the flow', () => {
    const isCurrent = createOpenAttemptGuard().begin();

    expect(isCurrent()).toBe(true);
  });

  it('supersedes an earlier attempt as soon as a later one begins', () => {
    const guard = createOpenAttemptGuard();

    const first = guard.begin();
    const second = guard.begin();

    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it('does not restore an earlier attempt when the later one finishes', () => {
    const guard = createOpenAttemptGuard();
    const first = guard.begin();
    const second = guard.begin();

    // Nothing "releases" ownership: an attempt that has been superseded stays
    // superseded, because the user has already asked for something else.
    expect(second()).toBe(true);
    expect(first()).toBe(false);
  });

  it('keeps every attempt distinct across many opens', () => {
    const guard = createOpenAttemptGuard();
    const attempts = Array.from({ length: 5 }, () => guard.begin());

    expect(attempts.map((isCurrent) => isCurrent())).toEqual([false, false, false, false, true]);
  });
});

/**
 * The defect this guard exists for, driven through the real reducer: without
 * gating, a superseded attempt's callbacks are all individually legal events
 * and the reducer cannot tell they belong to a file the user has moved on from.
 */
describe('a second file chosen while the first is still opening', () => {
  const started: FileFlowState = {
    kind: 'native-opening',
    name: 'second.arq',
    sidecarDependency: 'complete',
  };
  const FACTS = {
    projectName: 'House',
    revision: 191,
    sidecarDependency: 'complete',
    conditionNote: null,
  } as const;

  it('would let the superseded attempt drive the flow if it were not gated', () => {
    // The older attempt's remaining callbacks, arriving after the newer attempt
    // has restarted the flow for a different file.
    let state = reduceFileFlow(started, { type: 'stage-start' });
    state = reduceFileFlow(state, { type: 'stage-complete', projectId: 'first-project' });
    state = reduceFileFlow(state, { type: 'migration-verified', migrated: false });
    state = reduceFileFlow(state, { type: 'worker-opened', readOnlyReason: null });
    state = reduceFileFlow(state, { type: 'hydrate-start' });
    state = reduceFileFlow(state, { type: 'hydrated', facts: FACTS });

    // The flow now reports a project as open, under the second file's name,
    // carrying the first file's project id.
    expect(isProjectOpen(state)).toBe(true);
    if (state.kind === 'workspace-active') {
      expect(state.name).toBe('second.arq');
      expect(state.projectId).toBe('first-project');
    }
  });

  it('reaches no state at all once the emit is gated on the attempt', () => {
    const guard = createOpenAttemptGuard();
    const stale = guard.begin();
    guard.begin();

    let state: FileFlowState = started;
    const emit = (event: Parameters<typeof reduceFileFlow>[1]): void => {
      if (stale()) state = reduceFileFlow(state, event);
    };
    emit({ type: 'stage-start' });
    emit({ type: 'stage-complete', projectId: 'first-project' });
    emit({ type: 'worker-opened', readOnlyReason: null });
    emit({ type: 'hydrated', facts: FACTS });

    expect(state).toEqual(started);
    expect(isProjectOpen(state)).toBe(false);
  });
});
