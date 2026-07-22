import { describe, expect, it } from 'vitest';
import { createCommandLifecycle } from './command-lifecycle';

describe('createCommandLifecycle', () => {
  it('walks the documented happy path: idle -> armed -> previewing -> awaiting-input -> committed', () => {
    const lifecycle = createCommandLifecycle();
    expect(lifecycle.arm().state).toBe('armed');
    expect(lifecycle.beginPreview().state).toBe('previewing');
    expect(lifecycle.placeSegment().state).toBe('awaiting-input');
    expect(lifecycle.snapshot().segmentCount).toBe(1);
    expect(lifecycle.commit(true).state).toBe('committed');
  });

  it('rejects an invalid commit into Failed safely instead of Committed', () => {
    const lifecycle = createCommandLifecycle();
    lifecycle.arm();
    lifecycle.beginPreview();
    expect(lifecycle.commit(false).state).toBe('failed-safely');
  });

  it('ignores commit() outside Previewing/Awaiting input (Idle, Armed)', () => {
    const lifecycle = createCommandLifecycle();
    expect(lifecycle.commit(true).state).toBe('idle');
    lifecycle.arm();
    expect(lifecycle.commit(true).state).toBe('armed');
  });

  it('Escape clears a pending field first, without cancelling the segment', () => {
    const lifecycle = createCommandLifecycle();
    lifecycle.arm();
    lifecycle.beginPreview();
    lifecycle.placeSegment();
    lifecycle.beginPreview();
    lifecycle.editField();
    expect(lifecycle.snapshot().hasPendingField).toBe(true);
    const afterEscape = lifecycle.escape();
    expect(afterEscape.hasPendingField).toBe(false);
    expect(afterEscape.state).toBe('previewing');
    expect(afterEscape.segmentCount).toBe(1);
  });

  it('Escape cancels the most recent segment once there is no pending field', () => {
    const lifecycle = createCommandLifecycle();
    lifecycle.arm();
    lifecycle.beginPreview();
    lifecycle.placeSegment();
    lifecycle.beginPreview();
    lifecycle.placeSegment();
    expect(lifecycle.snapshot().segmentCount).toBe(2);
    const afterEscape = lifecycle.escape();
    expect(afterEscape.segmentCount).toBe(1);
    expect(afterEscape.state).toBe('awaiting-input');
  });

  it('Escape exits the tool to Cancelled once no field and no segments remain', () => {
    const lifecycle = createCommandLifecycle();
    lifecycle.arm();
    lifecycle.beginPreview();
    lifecycle.placeSegment();
    lifecycle.escape(); // cancels the one segment -> back to armed, 0 segments
    expect(lifecycle.snapshot()).toEqual({
      state: 'armed',
      segmentCount: 0,
      hasPendingField: false,
    });
    expect(lifecycle.escape().state).toBe('cancelled');
  });

  it('is a no-op from any terminal state (idle, committed, failed-safely, cancelled)', () => {
    const committed = createCommandLifecycle();
    committed.arm();
    committed.beginPreview();
    committed.commit(true);
    expect(committed.escape().state).toBe('committed');

    const failed = createCommandLifecycle();
    failed.arm();
    failed.beginPreview();
    failed.commit(false);
    expect(failed.escape().state).toBe('failed-safely');

    const idle = createCommandLifecycle();
    expect(idle.escape().state).toBe('idle');
  });

  it('reset() returns any terminal state to Idle, ready to arm again', () => {
    const lifecycle = createCommandLifecycle();
    lifecycle.arm();
    lifecycle.beginPreview();
    lifecycle.commit(true);
    expect(lifecycle.reset()).toEqual({ state: 'idle', segmentCount: 0, hasPendingField: false });
    expect(lifecycle.arm().state).toBe('armed');
  });
});
