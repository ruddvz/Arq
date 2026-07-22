/**
 * ARQ-071 (continued): "The user can export a local archive."
 *
 * Assembles every snapshot and journal entry for a project into a single
 * plain, JSON-serializable object. This module stops at producing that
 * data structure - turning it into a downloadable file (a .zip, a
 * File System Access API save, a <a download> Blob URL) is a UI-layer
 * concern with a DOM dependency this package deliberately does not take
 * on, consistent with every other package's separation from rendering.
 */

import type {
  ArqLocalDatabase,
  LocalOperationJournalRecord,
  LocalProjectSnapshotRecord,
} from './database';

export interface ProjectArchive {
  readonly projectId: string;
  readonly exportedAt: string;
  readonly snapshots: readonly LocalProjectSnapshotRecord[];
  readonly journal: readonly LocalOperationJournalRecord[];
}

export async function exportProjectArchive(
  db: ArqLocalDatabase,
  projectId: string,
  now: () => string = () => new Date().toISOString(),
): Promise<ProjectArchive> {
  const [snapshots, journal] = await Promise.all([
    db.projectSnapshots.where('projectId').equals(projectId).sortBy('revision'),
    db.operationJournal.where('projectId').equals(projectId).sortBy('id'),
  ]);
  return { projectId, exportedAt: now(), snapshots, journal };
}
