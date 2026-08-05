import { describe, expect, it } from 'vitest';
import type { ProjectId } from '@arq/bim-core';
import { createGroupedUndoStack } from './grouped-undo-stack';
import type { ModelOperation, OperationId } from './operation';
import { OPERATION_REJECTION_CODES } from './operation-pipeline';
import { PROPOSAL_REFUSAL_CODES, type AiProposal, type ProposalGrant } from './ai-proposal';
import { applyProposal, presentationStateFor } from './apply-proposal';

const PROJECT = 'project-1' as ProjectId;

interface DrawingState {
  readonly present: readonly string[];
}

function operation(id: string, type: string, subject: string): ModelOperation {
  return {
    id: id as OperationId,
    type,
    actorId: 'assistant',
    projectId: PROJECT,
    baseRevision: 12,
    timestamp: '2026-08-05T00:00:00.000Z',
    payload: { subject },
    preconditions: [],
  };
}

function subjectOf(op: ModelOperation): string {
  return (op.payload as { subject: string }).subject;
}

function proposal(): AiProposal {
  return {
    proposalId: 'proposal-1',
    projectId: PROJECT,
    baseRevision: 12,
    operations: [
      {
        operation: operation('op-a', 'create-element', 'partition'),
        dependsOn: [],
        summary: 'add a partition wall',
      },
      {
        operation: operation('op-b', 'update-property', 'room-label'),
        dependsOn: ['op-a' as OperationId],
        summary: 'label the new room',
      },
    ],
    assumptions: [],
    provenance: {
      modelId: 'test-model-1',
      requestId: 'request-1',
      userIntent: 'add a partition and label the new room',
      createdAt: '2026-08-05T00:00:00.000Z',
    },
  };
}

function grant(overrides: Partial<ProposalGrant> = {}): ProposalGrant {
  return {
    grantedBy: 'user-1',
    scopes: ['create-elements', 'modify-elements'],
    projectId: PROJECT,
    expiresAtRevision: 30,
    revoked: false,
    ...overrides,
  };
}

function pipeline(revisionBox: { value: number }, rejectSubject?: string) {
  return {
    writable: true,
    source: 'ai' as const,
    apply: (state: DrawingState, op: ModelOperation) => {
      const subject = subjectOf(op);
      if (rejectSubject !== undefined && subject === rejectSubject) {
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
    },
    commit: () => {
      revisionBox.value += 1;
      return { status: 'committed' as const, revision: revisionBox.value };
    },
  };
}

function inverseOf(op: ModelOperation): ModelOperation {
  return { ...op, id: `${op.id}-inverse` as OperationId, type: `remove-${op.type}` };
}

function ids(...values: string[]): readonly OperationId[] {
  return values.map((value) => value as OperationId);
}

describe('applyProposal', () => {
  it('applies an approved proposal through the ordinary operation pipeline', () => {
    const undoStack = createGroupedUndoStack<ModelOperation>();

    const result = applyProposal<DrawingState>({
      proposal: proposal(),
      grant: grant(),
      currentRevision: 12,
      approvedOperationIds: ids('op-a', 'op-b'),
      undoStack,
      initialState: { present: [] },
      pipeline: pipeline({ value: 12 }),
      inverseOf,
    });

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.state.present).toEqual(['partition', 'room-label']);
    expect(result.revision).toBe(14);
    expect(result.appliedOperationIds).toEqual(['op-a', 'op-b']);
  });

  it('produces one undo group labelled with what the user asked for', () => {
    // "Undo proposal-4f2a" is not a sentence anyone recognises.
    const undoStack = createGroupedUndoStack<ModelOperation>();

    const result = applyProposal<DrawingState>({
      proposal: proposal(),
      grant: grant(),
      currentRevision: 12,
      approvedOperationIds: ids('op-a', 'op-b'),
      undoStack,
      initialState: { present: [] },
      pipeline: pipeline({ value: 12 }),
      inverseOf,
    });

    expect(undoStack.depth()).toBe(1);
    expect(undoStack.peekUndoLabel()).toBe('add a partition and label the new room');
    if (result.status !== 'applied') return;
    expect(result.undoLabel).toBe('add a partition and label the new room');
  });

  it('reverses the whole application in one undo', () => {
    const undoStack = createGroupedUndoStack<ModelOperation>();

    applyProposal<DrawingState>({
      proposal: proposal(),
      grant: grant(),
      currentRevision: 12,
      approvedOperationIds: ids('op-a', 'op-b'),
      undoStack,
      initialState: { present: [] },
      pipeline: pipeline({ value: 12 }),
      inverseOf,
    });

    expect(undoStack.undo().map((op) => op.id)).toEqual(['op-b-inverse', 'op-a-inverse']);
    expect(undoStack.canUndo()).toBe(false);
  });

  it('runs nothing when the evaluation refuses', () => {
    // AC3-090: an approval is a decision, an apply is an event, and a refused
    // proposal must not look like either.
    const undoStack = createGroupedUndoStack<ModelOperation>();
    const revisionBox = { value: 12 };

    const result = applyProposal<DrawingState>({
      proposal: proposal(),
      grant: grant({ scopes: ['read-model'] }),
      currentRevision: 12,
      approvedOperationIds: ids('op-a'),
      undoStack,
      initialState: { present: [] },
      pipeline: pipeline(revisionBox),
      inverseOf,
    });

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.code).toBe(PROPOSAL_REFUSAL_CODES.scopeNotGranted);
    expect(result.state.present).toEqual([]);
    expect(result.revision).toBe(12);
    expect(revisionBox.value).toBe(12);
    expect(undoStack.depth()).toBe(0);
  });

  it('cannot be made to skip its evaluation', () => {
    // The evaluation happens inside apply, so no arrangement of calls applies
    // an unevaluated proposal.
    const undoStack = createGroupedUndoStack<ModelOperation>();

    const result = applyProposal<DrawingState>({
      proposal: proposal(),
      grant: grant(),
      currentRevision: 15,
      approvedOperationIds: ids('op-a'),
      undoStack,
      initialState: { present: [] },
      pipeline: pipeline({ value: 15 }),
      inverseOf,
    });

    expect(result.status).toBe('refused');
    if (result.status !== 'refused') return;
    expect(result.code).toBe(PROPOSAL_REFUSAL_CODES.stale);
  });

  it('refuses an AI operation the pipeline would refuse from the toolbar, with the same code', () => {
    // AC3-035: no alternate mutation path. A read-only project refuses an AI
    // operation for the reason it refuses any other.
    const undoStack = createGroupedUndoStack<ModelOperation>();

    const result = applyProposal<DrawingState>({
      proposal: proposal(),
      grant: grant(),
      currentRevision: 12,
      approvedOperationIds: ids('op-a'),
      undoStack,
      initialState: { present: [] },
      pipeline: { ...pipeline({ value: 12 }), writable: false },
      inverseOf,
    });

    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.code).toBe(OPERATION_REJECTION_CODES.notWritable);
  });

  it('distinguishes a mid-application failure from a refusal', () => {
    const undoStack = createGroupedUndoStack<ModelOperation>();

    const result = applyProposal<DrawingState>({
      proposal: proposal(),
      grant: grant(),
      currentRevision: 12,
      approvedOperationIds: ids('op-a', 'op-b'),
      undoStack,
      initialState: { present: [] },
      pipeline: pipeline({ value: 12 }, 'room-label'),
      inverseOf,
    });

    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    // Something ran, so the caller has inverses to apply - which a refusal
    // never has.
    expect(result.failedOperationIndex).toBe(1);
    expect(result.reversals.map((op) => op.id)).toEqual(['op-a-inverse']);
  });

  it('leaves no undo entry for a partial application', () => {
    const undoStack = createGroupedUndoStack<ModelOperation>();

    applyProposal<DrawingState>({
      proposal: proposal(),
      grant: grant(),
      currentRevision: 12,
      approvedOperationIds: ids('op-a', 'op-b'),
      undoStack,
      initialState: { present: [] },
      pipeline: pipeline({ value: 12 }, 'room-label'),
      inverseOf,
    });

    expect(undoStack.depth()).toBe(0);
    expect(undoStack.isGroupOpen()).toBe(false);
  });

  it('names the failing step in the proposer own words', () => {
    const undoStack = createGroupedUndoStack<ModelOperation>();

    const result = applyProposal<DrawingState>({
      proposal: proposal(),
      grant: grant(),
      currentRevision: 12,
      approvedOperationIds: ids('op-a', 'op-b'),
      undoStack,
      initialState: { present: [] },
      pipeline: pipeline({ value: 12 }, 'room-label'),
      inverseOf,
    });

    if (result.status !== 'failed') return;
    expect(result.detail).toContain('label the new room');
  });

  it('applies only the approved subset', () => {
    const undoStack = createGroupedUndoStack<ModelOperation>();

    const result = applyProposal<DrawingState>({
      proposal: proposal(),
      grant: grant(),
      currentRevision: 12,
      approvedOperationIds: ids('op-a'),
      undoStack,
      initialState: { present: [] },
      pipeline: pipeline({ value: 12 }),
      inverseOf,
    });

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.state.present).toEqual(['partition']);
  });
});

describe('presentationStateFor', () => {
  it('never calls an approved-but-unapplied proposal applied', () => {
    // AC3-090's failure is a proposal shown as applied, which is a wording
    // failure before it is a logic one.
    expect(presentationStateFor(null, true)).toBe('approved');
    expect(presentationStateFor(null, false)).toBe('proposed');
  });

  it('gives a part-applied-and-reversed proposal its own word', () => {
    expect(
      presentationStateFor(
        {
          status: 'failed',
          code: 'x',
          detail: '',
          failedOperationIndex: 1,
          state: { present: [] },
          revision: 12,
          reversals: [],
        },
        true,
      ),
    ).toBe('reversed');
  });

  it('reports applied only after an application succeeded', () => {
    expect(
      presentationStateFor(
        {
          status: 'applied',
          state: { present: [] },
          revision: 14,
          appliedOperationIds: [],
          undoLabel: 'x',
        },
        true,
      ),
    ).toBe('applied');
  });

  it('reports a refusal as refused, not as proposed', () => {
    expect(
      presentationStateFor(
        {
          status: 'refused',
          code: PROPOSAL_REFUSAL_CODES.stale,
          detail: '',
          state: { present: [] },
          revision: 12,
        },
        true,
      ),
    ).toBe('refused');
  });
});
