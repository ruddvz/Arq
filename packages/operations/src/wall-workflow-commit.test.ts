import { describe, expect, it } from 'vitest';
import type { ProjectId } from '@arq/bim-core';
import { createGroupedUndoStack } from './grouped-undo-stack';
import type { ModelOperation, OperationId } from './operation';
import { OPERATION_REJECTION_CODES } from './operation-pipeline';
import {
  abandonWallWorkflow,
  commitWallWorkflow,
  type WallWorkflowStep,
} from './wall-workflow-commit';

/** The gesture's state is just the list of things that exist, which is enough to see fragmentation. */
interface DrawingState {
  readonly present: readonly string[];
}

function operation(type: string, baseRevision: number, subject: string): ModelOperation {
  return {
    id: `op-${type}-${subject}` as OperationId,
    type,
    actorId: 'user-1',
    projectId: 'project-1' as ProjectId,
    baseRevision,
    timestamp: '2026-08-05T00:00:00.000Z',
    payload: { subject },
    preconditions: [],
  };
}

function subjectOf(op: ModelOperation): string {
  return (op.payload as { subject: string }).subject;
}

/** Applies "add" by appending and "remove" by dropping, so an inverse is checkable. */
function apply(state: DrawingState, op: ModelOperation) {
  const subject = subjectOf(op);
  if (op.type.startsWith('remove')) {
    return {
      status: 'applied' as const,
      state: { present: state.present.filter((entry) => entry !== subject) },
      result: {
        status: 'applied' as const,
        affectedElementIds: [],
        invalidations: [],
        validationMessages: [],
        durationMs: 0,
      },
    };
  }
  return {
    status: 'applied' as const,
    state: { present: [...state.present, subject] },
    result: {
      status: 'applied' as const,
      affectedElementIds: [],
      invalidations: [],
      validationMessages: [],
      durationMs: 0,
    },
  };
}

function pipelineFor(revisionBox: { value: number }, rejectSubject?: string) {
  return {
    writable: true,
    source: 'user' as const,
    apply: (state: DrawingState, op: ModelOperation) => {
      if (rejectSubject !== undefined && subjectOf(op) === rejectSubject) {
        return {
          status: 'rejected' as const,
          result: {
            status: 'rejected' as const,
            affectedElementIds: [],
            invalidations: [],
            validationMessages: [],
            durationMs: 0,
          },
        };
      }
      return apply(state, op);
    },
    commit: () => {
      revisionBox.value += 1;
      return { status: 'committed' as const, revision: revisionBox.value };
    },
  };
}

/** The real shape of the gesture: create the wall, split the room it crossed, resolve both joins. */
function wallGestureSteps(baseRevision: number): readonly WallWorkflowStep<DrawingState>[] {
  const subjects = ['wall-7', 'room-split', 'join-start', 'join-end'];
  return subjects.map((subject) => ({
    description: `add ${subject}`,
    operation: operation('add', baseRevision, subject),
    inverseOf: () => operation('remove', baseRevision, subject),
  }));
}

describe('commitWallWorkflow', () => {
  it('commits every step of the gesture', () => {
    const revisionBox = { value: 4 };
    const undoStack = createGroupedUndoStack<ModelOperation>();

    const outcome = commitWallWorkflow<DrawingState>({
      label: 'Draw wall',
      undoStack,
      steps: wallGestureSteps(4),
      initialState: { present: ['room-1'] },
      initialRevision: 4,
      pipeline: pipelineFor(revisionBox),
    });

    expect(outcome.status).toBe('committed');
    if (outcome.status !== 'committed') return;
    expect(outcome.state.present).toEqual([
      'room-1',
      'wall-7',
      'room-split',
      'join-start',
      'join-end',
    ]);
    expect(outcome.revision).toBe(8);
  });

  it('produces exactly one undo entry for one gesture', () => {
    // AC3-034's "fragmented" half: four operations, one thing the user did.
    const undoStack = createGroupedUndoStack<ModelOperation>();

    commitWallWorkflow<DrawingState>({
      label: 'Draw wall',
      undoStack,
      steps: wallGestureSteps(0),
      initialState: { present: [] },
      initialRevision: 0,
      pipeline: pipelineFor({ value: 0 }),
    });

    expect(undoStack.depth()).toBe(1);
    expect(undoStack.peekUndoLabel()).toBe('Draw wall');
  });

  it('reverses the whole gesture in one undo, newest first', () => {
    const undoStack = createGroupedUndoStack<ModelOperation>();

    commitWallWorkflow<DrawingState>({
      label: 'Draw wall',
      undoStack,
      steps: wallGestureSteps(0),
      initialState: { present: [] },
      initialRevision: 0,
      pipeline: pipelineFor({ value: 0 }),
    });

    const inverses = undoStack.undo();

    // Newest first: the joins come apart before the wall they were resolved
    // against disappears.
    expect(inverses.map(subjectOf)).toEqual(['join-end', 'join-start', 'room-split', 'wall-7']);
    expect(undoStack.canUndo()).toBe(false);
  });

  it('never leaves a group open, so the next gesture is not swallowed into this one', () => {
    // AC3-034's "unrelated" half.
    const undoStack = createGroupedUndoStack<ModelOperation>();

    commitWallWorkflow<DrawingState>({
      label: 'Draw wall',
      undoStack,
      steps: wallGestureSteps(0),
      initialState: { present: [] },
      initialRevision: 0,
      pipeline: pipelineFor({ value: 0 }),
    });

    expect(undoStack.isGroupOpen()).toBe(false);

    undoStack.record(
      { forward: operation('add', 9, 'door-1'), inverse: operation('remove', 9, 'door-1') },
      'Place door',
    );

    expect(undoStack.depth()).toBe(2);
    expect(undoStack.peekUndoLabel()).toBe('Place door');
  });

  it('rebases later steps onto the revision this gesture itself produced', () => {
    // Without the rebase every step after the first is rejected as stale
    // against a revision this function advanced a moment earlier.
    const outcome = commitWallWorkflow<DrawingState>({
      label: 'Draw wall',
      undoStack: createGroupedUndoStack<ModelOperation>(),
      steps: wallGestureSteps(0),
      initialState: { present: [] },
      initialRevision: 0,
      pipeline: pipelineFor({ value: 0 }),
    });

    expect(outcome.status).toBe('committed');
  });

  it('still rejects a gesture whose first step was built on stale state', () => {
    const outcome = commitWallWorkflow<DrawingState>({
      label: 'Draw wall',
      undoStack: createGroupedUndoStack<ModelOperation>(),
      steps: wallGestureSteps(4),
      initialState: { present: [] },
      initialRevision: 9,
      pipeline: pipelineFor({ value: 9 }),
    });

    expect(outcome.status).toBe('rejected');
    if (outcome.status !== 'rejected') return;
    expect(outcome.code).toBe(OPERATION_REJECTION_CODES.staleBaseRevision);
    expect(outcome.failedStep).toBe(0);
  });

  it('leaves no undo entry when a step is rejected mid-gesture', () => {
    const undoStack = createGroupedUndoStack<ModelOperation>();

    const outcome = commitWallWorkflow<DrawingState>({
      label: 'Draw wall',
      undoStack,
      steps: wallGestureSteps(0),
      initialState: { present: [] },
      initialRevision: 0,
      pipeline: pipelineFor({ value: 0 }, 'join-start'),
    });

    expect(outcome.status).toBe('rejected');
    if (outcome.status !== 'rejected') return;
    expect(outcome.failedStep).toBe(2);
    expect(outcome.code).toBe(OPERATION_REJECTION_CODES.applyRejected);
    // A half-drawn wall the user never saw complete is not history.
    expect(undoStack.depth()).toBe(0);
    expect(undoStack.canUndo()).toBe(false);
    expect(undoStack.isGroupOpen()).toBe(false);
  });

  it('hands back the inverses needed to reverse the partial gesture, newest first', () => {
    const outcome = commitWallWorkflow<DrawingState>({
      label: 'Draw wall',
      undoStack: createGroupedUndoStack<ModelOperation>(),
      steps: wallGestureSteps(0),
      initialState: { present: [] },
      initialRevision: 0,
      pipeline: pipelineFor({ value: 0 }, 'join-start'),
    });

    expect(outcome.status).toBe('rejected');
    if (outcome.status !== 'rejected') return;
    expect(outcome.reversals.map(subjectOf)).toEqual(['room-split', 'wall-7']);
  });

  it('names the step that failed, so a message can say what went wrong', () => {
    const outcome = commitWallWorkflow<DrawingState>({
      label: 'Draw wall',
      undoStack: createGroupedUndoStack<ModelOperation>(),
      steps: wallGestureSteps(0),
      initialState: { present: [] },
      initialRevision: 0,
      pipeline: pipelineFor({ value: 0 }, 'wall-7'),
    });

    expect(outcome.status).toBe('rejected');
    if (outcome.status !== 'rejected') return;
    expect(outcome.detail).toContain('add wall-7');
  });

  it('commits a step with no inverse without fragmenting the group', () => {
    const undoStack = createGroupedUndoStack<ModelOperation>();
    const steps: readonly WallWorkflowStep<DrawingState>[] = [
      {
        description: 'add wall-7',
        operation: operation('add', 0, 'wall-7'),
        inverseOf: () => operation('remove', 0, 'wall-7'),
      },
      {
        description: 'recompute room areas',
        operation: operation('add', 0, 'area-recompute'),
        inverseOf: () => null,
      },
    ];

    const outcome = commitWallWorkflow<DrawingState>({
      label: 'Draw wall',
      undoStack,
      steps,
      initialState: { present: [] },
      initialRevision: 0,
      pipeline: pipelineFor({ value: 0 }),
    });

    expect(outcome.status).toBe('committed');
    expect(undoStack.depth()).toBe(1);
    expect(undoStack.undo().map(subjectOf)).toEqual(['wall-7']);
  });
});

describe('abandonWallWorkflow', () => {
  it('discards a cancelled gesture and returns its inverses newest first', () => {
    const undoStack = createGroupedUndoStack<ModelOperation>();

    undoStack.beginGroup('Draw wall');
    undoStack.record({
      forward: operation('add', 0, 'wall-7'),
      inverse: operation('remove', 0, 'wall-7'),
    });
    undoStack.record({
      forward: operation('add', 1, 'room-split'),
      inverse: operation('remove', 1, 'room-split'),
    });

    const reversals = abandonWallWorkflow(undoStack);

    expect(reversals.map(subjectOf)).toEqual(['room-split', 'wall-7']);
    expect(undoStack.depth()).toBe(0);
    expect(undoStack.isGroupOpen()).toBe(false);
  });
});
