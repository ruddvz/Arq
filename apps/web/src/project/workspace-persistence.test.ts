import { worldPoint } from '@arq/geometry-2d';
import { describe, expect, it, vi } from 'vitest';
import type { PlanJournal } from '../canvas/plan-journal';
import type { WorkspaceOperation } from '../canvas/plan-document';
import {
  NativeProjectReadOnlyError,
  NativeProjectUnsupportedEditError,
  type NativeProjectSession,
} from './native-project-session';
import { persistWorkspaceOperation } from './workspace-persistence';

const operation: WorkspaceOperation = {
  kind: 'add-walls',
  walls: [{ id: 'wall-1', start: worldPoint(0, 0), end: worldPoint(1000, 0) }],
};
const walls = operation.kind === 'add-walls' ? operation.walls : [];

function journal(result: Awaited<ReturnType<PlanJournal['append']>>) {
  return {
    append: vi.fn().mockResolvedValue(result),
  } satisfies Pick<PlanJournal, 'append'>;
}

function nativeSession(save: ReturnType<typeof vi.fn>) {
  return { save } as unknown as Pick<NativeProjectSession, 'save'>;
}

describe('persistWorkspaceOperation', () => {
  it('uses the demo journal only when no native project owns the edit', async () => {
    const localJournal = journal({ status: 'ready' });

    const result = await persistWorkspaceOperation({
      nativeSession: null,
      journal: localJournal,
      journalProjectId: 'demo-project',
      operation,
      walls,
    });

    expect(result).toEqual({ status: 'saved', authority: 'journal' });
    expect(localJournal.append).toHaveBeenCalledWith('demo-project', operation);
  });

  it('uses the native session without duplicating the edit into the demo journal', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const localJournal = journal({ status: 'ready' });

    const result = await persistWorkspaceOperation({
      nativeSession: nativeSession(save),
      journal: localJournal,
      journalProjectId: 'demo-project',
      operation,
      walls,
    });

    expect(result).toEqual({ status: 'saved', authority: 'native' });
    expect(save).toHaveBeenCalledWith({ walls, operation });
    expect(localJournal.append).not.toHaveBeenCalled();
  });

  it('never falls back to the demo journal when a native project is read-only', async () => {
    const save = vi.fn().mockRejectedValue(new NativeProjectReadOnlyError());
    const localJournal = journal({ status: 'ready' });

    const result = await persistWorkspaceOperation({
      nativeSession: nativeSession(save),
      journal: localJournal,
      journalProjectId: 'demo-project',
      operation,
      walls,
    });

    expect(result).toMatchObject({
      status: 'blocked',
      authority: 'native',
      reason: 'read-only',
    });
    expect(localJournal.append).not.toHaveBeenCalled();
  });

  it('never flattens a reference project or falls back to the demo journal', async () => {
    const save = vi.fn().mockRejectedValue(new NativeProjectUnsupportedEditError());
    const localJournal = journal({ status: 'ready' });

    const result = await persistWorkspaceOperation({
      nativeSession: nativeSession(save),
      journal: localJournal,
      journalProjectId: 'demo-project',
      operation,
      walls,
    });

    expect(result).toMatchObject({
      status: 'blocked',
      authority: 'native',
      reason: 'reference-project',
    });
    expect(localJournal.append).not.toHaveBeenCalled();
  });

  it('reports a native write failure and allows the next operation to try the session again', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('durable write failed'))
      .mockResolvedValueOnce(undefined);
    const session = nativeSession(save);

    const first = await persistWorkspaceOperation({
      nativeSession: session,
      journal: null,
      journalProjectId: 'demo-project',
      operation,
      walls,
    });
    const second = await persistWorkspaceOperation({
      nativeSession: session,
      journal: null,
      journalProjectId: 'demo-project',
      operation,
      walls,
    });

    expect(first).toEqual({
      status: 'failed',
      authority: 'native',
      detail: 'durable write failed',
    });
    expect(second).toEqual({ status: 'saved', authority: 'native' });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('does not persist note-only UI history', async () => {
    const save = vi.fn();
    const localJournal = journal({ status: 'ready' });

    const result = await persistWorkspaceOperation({
      nativeSession: nativeSession(save),
      journal: localJournal,
      journalProjectId: 'demo-project',
      operation: { kind: 'note', label: 'Opened menu' },
      walls,
    });

    expect(result).toEqual({ status: 'skipped' });
    expect(save).not.toHaveBeenCalled();
    expect(localJournal.append).not.toHaveBeenCalled();
  });

  it('preserves actionable journal failure causes', async () => {
    const localJournal = journal({
      status: 'write-failed',
      cause: 'storage-full',
      reason: 'quota exceeded',
    });

    const result = await persistWorkspaceOperation({
      nativeSession: null,
      journal: localJournal,
      journalProjectId: 'demo-project',
      operation,
      walls,
    });

    expect(result).toEqual({
      status: 'failed',
      authority: 'journal',
      detail: 'quota exceeded',
      cause: 'storage-full',
    });
  });

  it('reports an unexpected thrown journal failure instead of rejecting the UI callback', async () => {
    const localJournal = {
      append: vi.fn().mockRejectedValue(new Error('database closed')),
    } as unknown as Pick<PlanJournal, 'append'>;

    const result = await persistWorkspaceOperation({
      nativeSession: null,
      journal: localJournal,
      journalProjectId: 'demo-project',
      operation,
      walls,
    });

    expect(result).toEqual({
      status: 'failed',
      authority: 'journal',
      detail: 'database closed',
    });
  });
});
