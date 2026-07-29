import { describe, expect, it } from 'vitest';
import {
  COMMAND_FEEDBACK_MAX_ENTRIES,
  createCommandFeedbackStore,
  formatFeedbackTitle,
} from './command-feedback-state';

describe('createCommandFeedbackStore', () => {
  it('groups a repeated identical message into one entry with a count instead of spamming', () => {
    const store = createCommandFeedbackStore();
    store.publish('success', 'Wall drawn', 1000);
    store.publish('success', 'Wall drawn', 1100);
    store.publish('success', 'Wall drawn', 1200);
    const { entries } = store.snapshot();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.count).toBe(3);
    expect(formatFeedbackTitle(entries[0]!)).toBe('Wall drawn ×3');
  });

  it('keeps different tones separate even with the same title', () => {
    const store = createCommandFeedbackStore();
    store.publish('success', 'Wall drawn', 1000);
    store.publish('error', 'Wall drawn', 1000);
    expect(store.snapshot().entries).toHaveLength(2);
  });

  it('drops the oldest entry beyond the cap rather than growing without bound', () => {
    const store = createCommandFeedbackStore();
    for (let index = 0; index < COMMAND_FEEDBACK_MAX_ENTRIES + 3; index += 1) {
      store.publish('info', `Message ${index}`, 1000 + index);
    }
    const { entries } = store.snapshot();
    expect(entries).toHaveLength(COMMAND_FEEDBACK_MAX_ENTRIES);
    expect(entries[0]?.title).toBe('Message 3');
  });

  it('expires entries after their duration and refreshes expiry on regroup', () => {
    const store = createCommandFeedbackStore({ durationMs: 1000 });
    store.publish('success', 'Wall drawn', 0);
    store.publish('success', 'Wall drawn', 900);
    store.expire(1500);
    expect(store.snapshot().entries).toHaveLength(1);
    store.expire(1901);
    expect(store.snapshot().entries).toHaveLength(0);
  });

  it('never expires while paused and shifts deadlines by the paused duration on resume', () => {
    const store = createCommandFeedbackStore({ durationMs: 1000 });
    store.publish('success', 'Wall drawn', 0);
    store.pause(500);
    store.expire(5000);
    expect(store.snapshot().entries).toHaveLength(1);
    store.resume(5000);
    store.expire(5400);
    expect(store.snapshot().entries).toHaveLength(1);
    store.expire(5501);
    expect(store.snapshot().entries).toHaveLength(0);
  });

  it('dismisses a single entry by id', () => {
    const store = createCommandFeedbackStore();
    store.publish('info', 'A', 0);
    store.publish('info', 'B', 0);
    const first = store.snapshot().entries[0]!;
    store.dismiss(first.id);
    expect(store.snapshot().entries.map((entry) => entry.title)).toEqual(['B']);
  });

  it('notifies subscribers on every state change', () => {
    const store = createCommandFeedbackStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.publish('info', 'A', 0);
    store.publish('info', 'A', 1);
    unsubscribe();
    store.publish('info', 'A', 2);
    expect(calls).toBe(2);
  });
});
