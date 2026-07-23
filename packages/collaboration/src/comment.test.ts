import { describe, expect, it } from 'vitest';
import { createComment } from './comment';

const baseInput = {
  id: 'c1',
  targetElementId: 'wall-1',
  authorParticipantId: 'alice',
  authorInitials: 'AL',
  body: 'Should this wall be load-bearing?',
  createdAtMs: 1000,
};

describe('createComment', () => {
  it('constructs a new, unresolved, top-level comment', () => {
    expect(createComment(baseInput)).toEqual({
      ...baseInput,
      body: baseInput.body,
      resolved: false,
      parentCommentId: null,
    });
  });

  it('trims the body', () => {
    expect(createComment({ ...baseInput, body: '  hello  ' }).body).toBe('hello');
  });

  it('accepts an explicit parentCommentId for a reply', () => {
    expect(createComment({ ...baseInput, parentCommentId: 'c0' }).parentCommentId).toBe('c0');
  });

  it('accepts a null targetElementId for a general project comment', () => {
    expect(createComment({ ...baseInput, targetElementId: null }).targetElementId).toBeNull();
  });

  it('rejects an empty body', () => {
    expect(() => createComment({ ...baseInput, body: '' })).toThrow(RangeError);
  });

  it('rejects a whitespace-only body', () => {
    expect(() => createComment({ ...baseInput, body: '   ' })).toThrow(RangeError);
  });
});
