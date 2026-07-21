import type { ModelOperation } from './operations';
import type { ProjectId } from './model';
export interface LocalProjectStore {
  open(projectId: ProjectId): Promise<void>;
  readSnapshot(projectId: ProjectId): Promise<Uint8Array | undefined>;
  writeJournal(operation: ModelOperation): Promise<void>;
  listJournal(projectId: ProjectId, afterSequence?: number): Promise<readonly ModelOperation[]>;
  writeSnapshot(projectId: ProjectId, revision: number, bytes: Uint8Array): Promise<void>;
  estimateUsage(): Promise<{ usage?: number; quota?: number }>;
  close(projectId: ProjectId): Promise<void>;
}
