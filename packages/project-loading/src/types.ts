export type OpenStage = 0 | 1 | 2 | 3 | 4 | 5;
export type OpenStageName =
  'Identify' | 'Shell' | 'Skeleton' | 'Authoring' | 'Quality' | 'Intelligence';
export interface StageDescriptor {
  readonly stage: OpenStage;
  readonly name: OpenStageName;
  readonly blocking: boolean;
  readonly capability: string;
}
export interface OpenProgress {
  readonly attemptId: string;
  readonly stage: OpenStage;
  readonly name: OpenStageName;
  readonly status: 'pending' | 'running' | 'complete' | 'degraded' | 'failed' | 'cancelled';
  readonly message: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
}
export interface ProjectOpenSnapshot {
  readonly attemptId: string;
  readonly highestCompleted: OpenStage | null;
  readonly authoringReady: boolean;
  readonly cancelled: boolean;
  readonly progress: readonly OpenProgress[];
}
