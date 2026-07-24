import { describe, expect, it } from 'vitest';
import { ProjectOpenStateMachine } from './state-machine';

function runThroughStage3(machine: ProjectOpenStateMachine): void {
  for (const stage of [0, 1, 2, 3] as const) {
    machine.start(stage);
    machine.complete(stage);
  }
}

describe('ProjectOpenStateMachine', () => {
  it('requires a non-empty attempt id', () => {
    expect(() => new ProjectOpenStateMachine('')).toThrow(/attemptId required/);
  });

  it('is not authoring-ready before stage 3 completes', () => {
    const machine = new ProjectOpenStateMachine('a');
    machine.start(0);
    machine.complete(0);
    expect(machine.snapshot().authoringReady).toBe(false);
  });

  it('becomes authoring-ready once stage 3 completes and tolerates a stage 4 degrade', () => {
    const machine = new ProjectOpenStateMachine('a');
    runThroughStage3(machine);
    machine.start(4);
    machine.degrade(4, 'mesh cache unavailable');

    expect(machine.snapshot().authoringReady).toBe(true);
  });

  it('refuses to start a stage before its predecessor has completed', () => {
    const machine = new ProjectOpenStateMachine('a');
    expect(() => machine.start(2)).toThrow(/cannot start stage 2 before stage 1/);
  });

  it('refuses to degrade a blocking stage', () => {
    const machine = new ProjectOpenStateMachine('a');
    machine.start(0);
    expect(() => machine.degrade(0, 'x')).toThrow(/blocking stage 0 cannot degrade/);
  });

  it('fail on a blocking stage marks it failed, not degraded', () => {
    const machine = new ProjectOpenStateMachine('a');
    machine.start(0);
    machine.fail(0, 'disk error');
    const progress = machine.snapshot().progress.find((p) => p.stage === 0);
    expect(progress?.status).toBe('failed');
  });

  it('fail on a non-blocking stage marks it degraded, not failed', () => {
    const machine = new ProjectOpenStateMachine('a');
    runThroughStage3(machine);
    machine.start(4);
    machine.fail(4, 'quality pass errored');
    const progress = machine.snapshot().progress.find((p) => p.stage === 4);
    expect(progress?.status).toBe('degraded');
  });

  it('cancel marks every pending/running stage cancelled and blocks further transitions', () => {
    const machine = new ProjectOpenStateMachine('a');
    machine.start(0);
    machine.cancel('another project opened');

    expect(machine.snapshot().cancelled).toBe(true);
    expect(() => machine.complete(0)).toThrow(/open attempt cancelled/);
  });
});
