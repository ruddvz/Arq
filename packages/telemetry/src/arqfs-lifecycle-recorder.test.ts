import { describe, expect, it } from 'vitest';
import { ArqfsLifecycleRecorder } from './arqfs-lifecycle-recorder';
import { nextArqfsLifecycleCorrelationId, type ArqfsLifecycleEvent } from './arqfs-lifecycle-event';

function preflightEvent(fileByteLength: number): ArqfsLifecycleEvent {
  return {
    correlationId: nextArqfsLifecycleCorrelationId(),
    timestampUnixMs: Date.now(),
    kind: 'preflight',
    status: 'accepted',
    fileByteLength,
    durationMs: 1,
  };
}

describe('ArqfsLifecycleRecorder', () => {
  it('records and lists events in order', () => {
    const recorder = new ArqfsLifecycleRecorder();
    recorder.record(preflightEvent(1));
    recorder.record(preflightEvent(2));
    expect(recorder.list().map((e) => (e.kind === 'preflight' ? e.fileByteLength : -1))).toEqual([
      1, 2,
    ]);
  });

  it('is bounded - the oldest events are dropped once maxEvents is exceeded', () => {
    const recorder = new ArqfsLifecycleRecorder({ maxEvents: 3 });
    for (let i = 0; i < 5; i++) recorder.record(preflightEvent(i));
    const remaining = recorder.list().map((e) => (e.kind === 'preflight' ? e.fileByteLength : -1));
    expect(remaining).toEqual([2, 3, 4]);
  });

  it('refuses an invalid maxEvents rather than silently becoming unbounded', () => {
    expect(() => new ArqfsLifecycleRecorder({ maxEvents: 0 })).toThrow(RangeError);
    expect(() => new ArqfsLifecycleRecorder({ maxEvents: -1 })).toThrow(RangeError);
  });

  it('refuses to record an event carrying a forbidden field', () => {
    const recorder = new ArqfsLifecycleRecorder();
    const unsafeEvent = {
      ...preflightEvent(1),
      fileName: 'secret.arq',
    } as unknown as ArqfsLifecycleEvent;
    expect(() => recorder.record(unsafeEvent)).toThrow(/fileName/);
    expect(recorder.list()).toEqual([]);
  });

  it('clear empties the buffer', () => {
    const recorder = new ArqfsLifecycleRecorder();
    recorder.record(preflightEvent(1));
    recorder.clear();
    expect(recorder.list()).toEqual([]);
  });

  it('list returns a snapshot, not a live reference the caller could mutate', () => {
    const recorder = new ArqfsLifecycleRecorder();
    recorder.record(preflightEvent(1));
    const snapshot = recorder.list();
    recorder.record(preflightEvent(2));
    expect(snapshot).toHaveLength(1);
  });
});
