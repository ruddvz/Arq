import { descriptor, OPEN_STAGES } from './stages';
import type { OpenProgress, OpenStage, ProjectOpenSnapshot } from './types';
export class ProjectOpenStateMachine {
  readonly #attemptId: string;
  readonly #progress = new Map<OpenStage, OpenProgress>();
  #cancelled = false;
  constructor(attemptId: string) {
    if (!attemptId) throw new Error('attemptId required');
    this.#attemptId = attemptId;
    for (const item of OPEN_STAGES)
      this.#progress.set(item.stage, {
        attemptId,
        stage: item.stage,
        name: item.name,
        status: 'pending',
        message: 'Pending',
      });
  }
  start(stage: OpenStage, message = 'Running'): void {
    this.#assertNotCancelled();
    const d = descriptor(stage);
    const previous = this.#highestCompleted();
    if (stage > 0 && (previous === null || previous < stage - 1))
      throw new Error(`cannot start stage ${stage} before stage ${stage - 1}`);
    this.#progress.set(stage, {
      attemptId: this.#attemptId,
      stage,
      name: d.name,
      status: 'running',
      message,
      startedAt: new Date().toISOString(),
    });
  }
  complete(stage: OpenStage, message = 'Complete'): void {
    this.#assertNotCancelled();
    const current = this.#progress.get(stage);
    if (!current || current.status !== 'running') throw new Error(`stage ${stage} is not running`);
    this.#progress.set(stage, {
      ...current,
      status: 'complete',
      message,
      completedAt: new Date().toISOString(),
    });
  }
  degrade(stage: OpenStage, message: string): void {
    const d = descriptor(stage);
    if (d.blocking) throw new Error(`blocking stage ${stage} cannot degrade`);
    const current = this.#progress.get(stage);
    if (!current || current.status !== 'running') throw new Error(`stage ${stage} is not running`);
    this.#progress.set(stage, {
      ...current,
      status: 'degraded',
      message,
      completedAt: new Date().toISOString(),
    });
  }
  fail(stage: OpenStage, message: string): void {
    const d = descriptor(stage);
    const current = this.#progress.get(stage)!;
    this.#progress.set(stage, {
      ...current,
      status: d.blocking ? 'failed' : 'degraded',
      message,
      completedAt: new Date().toISOString(),
    });
  }
  cancel(message = 'Cancelled'): void {
    this.#cancelled = true;
    for (const [stage, current] of this.#progress) {
      if (current.status === 'pending' || current.status === 'running')
        this.#progress.set(stage, {
          ...current,
          status: 'cancelled',
          message,
          completedAt: new Date().toISOString(),
        });
    }
  }
  snapshot(): ProjectOpenSnapshot {
    const highest = this.#highestCompleted();
    return {
      attemptId: this.#attemptId,
      highestCompleted: highest,
      authoringReady: highest !== null && highest >= 3,
      cancelled: this.#cancelled,
      progress: [...this.#progress.values()].sort((a, b) => a.stage - b.stage),
    };
  }
  #highestCompleted(): OpenStage | null {
    let highest: OpenStage | null = null;
    for (const [stage, item] of this.#progress)
      if (item.status === 'complete' || item.status === 'degraded')
        highest = highest === null || stage > highest ? stage : highest;
    return highest;
  }
  #assertNotCancelled(): void {
    if (this.#cancelled) throw new Error('open attempt cancelled');
  }
}
