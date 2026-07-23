import { describe, expect, it } from 'vitest';
import { createRevisionSnapshot } from './revision-snapshot';

const baseInput = {
  id: 'r1',
  label: 'Submitted for permit',
  authorParticipantId: 'alice',
  createdAtMs: 1000,
  stateReference: 'journal-seq:482',
};

describe('createRevisionSnapshot', () => {
  it('constructs a new revision snapshot', () => {
    expect(createRevisionSnapshot(baseInput)).toEqual({ ...baseInput, description: '' });
  });

  it('trims the label, description and state reference', () => {
    const snapshot = createRevisionSnapshot({
      ...baseInput,
      label: '  Label  ',
      description: '  Details  ',
      stateReference: '  ref  ',
    });
    expect(snapshot.label).toBe('Label');
    expect(snapshot.description).toBe('Details');
    expect(snapshot.stateReference).toBe('ref');
  });

  it('rejects an empty label', () => {
    expect(() => createRevisionSnapshot({ ...baseInput, label: '' })).toThrow(RangeError);
  });

  it('rejects a whitespace-only label', () => {
    expect(() => createRevisionSnapshot({ ...baseInput, label: '   ' })).toThrow(RangeError);
  });

  it('rejects an empty state reference', () => {
    expect(() => createRevisionSnapshot({ ...baseInput, stateReference: '' })).toThrow(RangeError);
  });

  it('rejects a whitespace-only state reference', () => {
    expect(() => createRevisionSnapshot({ ...baseInput, stateReference: '   ' })).toThrow(
      RangeError,
    );
  });
});
