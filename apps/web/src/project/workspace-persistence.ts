import type { PlanJournal, PlanJournalWriteFailureCause } from '../canvas/plan-journal';
import type { DrawnWall, WorkspaceOperation } from '../canvas/plan-document';
import {
  NativeProjectReadOnlyError,
  NativeProjectUnsupportedEditError,
  type NativeProjectSession,
} from './native-project-session';

/**
 * The workspace has two persistence authorities, but never for the same edit.
 *
 * A native session owns an opened `.arq` project's working copy. The IndexedDB
 * journal owns only the no-project/demo plan. Falling back from a native write
 * to the demo journal would be dangerous: the UI could say an opened project is
 * saved even though its own working copy never changed.
 */
export interface WorkspacePersistenceInputs {
  readonly nativeSession: Pick<NativeProjectSession, 'save'> | null;
  readonly journal: Pick<PlanJournal, 'append'> | null;
  readonly journalProjectId: string;
  readonly operation: WorkspaceOperation;
  readonly walls: readonly DrawnWall[];
}

export type WorkspacePersistenceResult =
  | { readonly status: 'saved'; readonly authority: 'native' | 'journal' }
  | { readonly status: 'skipped' }
  | {
      readonly status: 'blocked';
      readonly authority: 'native';
      readonly reason: 'read-only' | 'reference-project';
      readonly detail: string;
    }
  | {
      readonly status: 'failed';
      readonly authority: 'native' | 'journal';
      readonly detail: string;
      readonly cause?: PlanJournalWriteFailureCause;
    };

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Persists one operation through exactly one authority.
 *
 * Native sessions already serialize writes and remember failed changes for a
 * later recovery attempt, so this bridge deliberately adds no queue of its own.
 * Its job is routing and honest outcome reporting, not another persistence
 * implementation.
 */
export async function persistWorkspaceOperation(
  inputs: WorkspacePersistenceInputs,
): Promise<WorkspacePersistenceResult> {
  if (inputs.operation.kind === 'note') {
    return { status: 'skipped' };
  }

  if (inputs.nativeSession !== null) {
    try {
      await inputs.nativeSession.save({ walls: inputs.walls, operation: inputs.operation });
      return { status: 'saved', authority: 'native' };
    } catch (error) {
      if (error instanceof NativeProjectReadOnlyError) {
        return {
          status: 'blocked',
          authority: 'native',
          reason: 'read-only',
          detail: error.message,
        };
      }
      if (error instanceof NativeProjectUnsupportedEditError) {
        return {
          status: 'blocked',
          authority: 'native',
          reason: 'reference-project',
          detail: error.message,
        };
      }
      return {
        status: 'failed',
        authority: 'native',
        detail: describeError(error),
      };
    }
  }

  if (inputs.journal === null) {
    return {
      status: 'failed',
      authority: 'journal',
      detail: 'Local edit persistence is unavailable.',
    };
  }

  try {
    const state = await inputs.journal.append(inputs.journalProjectId, inputs.operation);
    if (state.status === 'ready') {
      return { status: 'saved', authority: 'journal' };
    }
    if (state.status === 'unavailable') {
      return { status: 'failed', authority: 'journal', detail: state.reason };
    }
    return {
      status: 'failed',
      authority: 'journal',
      detail: state.reason,
      cause: state.cause,
    };
  } catch (error) {
    return {
      status: 'failed',
      authority: 'journal',
      detail: describeError(error),
    };
  }
}
