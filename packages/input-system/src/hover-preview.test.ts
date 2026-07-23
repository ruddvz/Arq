import { describe, expect, it } from 'vitest';
import { createHoverPreviewTracker } from './hover-preview';

describe('createHoverPreviewTracker', () => {
  it('starts a hover-preview session for a pencil pointer', () => {
    const tracker = createHoverPreviewTracker();
    expect(tracker.over({ pointerId: 1, pointerType: 'pen', x: 10, y: 20 })).toEqual([
      { type: 'hover-start', x: 10, y: 20 },
    ]);
    expect(tracker.isHovering()).toBe(true);
  });

  it('reports hover-move for the same pointer while hovering', () => {
    const tracker = createHoverPreviewTracker();
    tracker.over({ pointerId: 1, pointerType: 'pen', x: 10, y: 20 });
    expect(tracker.move({ pointerId: 1, pointerType: 'pen', x: 15, y: 25 })).toEqual([
      { type: 'hover-move', x: 15, y: 25 },
    ]);
  });

  it('ends the session on pointerout for the same pointer', () => {
    const tracker = createHoverPreviewTracker();
    tracker.over({ pointerId: 1, pointerType: 'pen', x: 10, y: 20 });
    expect(tracker.out({ pointerId: 1 })).toEqual([{ type: 'hover-end' }]);
    expect(tracker.isHovering()).toBe(false);
  });

  it('ends the session on real contact (pointerdown), same as pointerout', () => {
    const tracker = createHoverPreviewTracker();
    tracker.over({ pointerId: 1, pointerType: 'pen', x: 10, y: 20 });
    expect(tracker.down({ pointerId: 1 })).toEqual([{ type: 'hover-end' }]);
    expect(tracker.isHovering()).toBe(false);
  });

  it('ignores a touch pointer - hover preview is a Pencil-only role (section 13)', () => {
    const tracker = createHoverPreviewTracker();
    expect(tracker.over({ pointerId: 1, pointerType: 'touch', x: 10, y: 20 })).toEqual([]);
    expect(tracker.isHovering()).toBe(false);
  });

  it('ignores a mouse pointer - hover preview is a Pencil-only role (section 13)', () => {
    const tracker = createHoverPreviewTracker();
    expect(tracker.over({ pointerId: 1, pointerType: 'mouse', x: 10, y: 20 })).toEqual([]);
    expect(tracker.isHovering()).toBe(false);
  });

  it('ignores a move from a pointer id that never started a hover session', () => {
    const tracker = createHoverPreviewTracker();
    expect(tracker.move({ pointerId: 99, pointerType: 'pen', x: 1, y: 1 })).toEqual([]);
  });

  it('ignores an out from a pointer id that never started a hover session', () => {
    const tracker = createHoverPreviewTracker();
    expect(tracker.out({ pointerId: 99 })).toEqual([]);
  });

  it('a second pencil pointer while one is already hovering does not interfere with the first', () => {
    const tracker = createHoverPreviewTracker();
    tracker.over({ pointerId: 1, pointerType: 'pen', x: 10, y: 20 });
    expect(tracker.move({ pointerId: 2, pointerType: 'pen', x: 50, y: 60 })).toEqual([]);
    expect(tracker.isHovering()).toBe(true);
  });

  it('supports a new hover session after a previous one ends', () => {
    const tracker = createHoverPreviewTracker();
    tracker.over({ pointerId: 1, pointerType: 'pen', x: 10, y: 20 });
    tracker.out({ pointerId: 1 });
    expect(tracker.over({ pointerId: 2, pointerType: 'pen', x: 5, y: 5 })).toEqual([
      { type: 'hover-start', x: 5, y: 5 },
    ]);
  });
});
