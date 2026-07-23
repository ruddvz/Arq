import { describe, expect, it } from 'vitest';
import { createIssue } from './issue';

const baseInput = {
  id: 'i1',
  targetElementId: 'wall-1',
  authorParticipantId: 'alice',
  title: 'Wall thickness does not match schedule',
  createdAtMs: 1000,
};

describe('createIssue', () => {
  it('constructs a new, open, unassigned issue', () => {
    expect(createIssue(baseInput)).toEqual({
      ...baseInput,
      description: '',
      status: 'open',
      assigneeParticipantId: null,
    });
  });

  it('trims the title and description', () => {
    const issue = createIssue({ ...baseInput, title: '  Title  ', description: '  Details  ' });
    expect(issue.title).toBe('Title');
    expect(issue.description).toBe('Details');
  });

  it('accepts an explicit assignee', () => {
    expect(createIssue({ ...baseInput, assigneeParticipantId: 'bob' }).assigneeParticipantId).toBe(
      'bob',
    );
  });

  it('accepts a null targetElementId for a general project issue', () => {
    expect(createIssue({ ...baseInput, targetElementId: null }).targetElementId).toBeNull();
  });

  it('rejects an empty title', () => {
    expect(() => createIssue({ ...baseInput, title: '' })).toThrow(RangeError);
  });

  it('rejects a whitespace-only title', () => {
    expect(() => createIssue({ ...baseInput, title: '   ' })).toThrow(RangeError);
  });
});
