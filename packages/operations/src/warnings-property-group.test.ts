import { describe, expect, it } from 'vitest';
import { elementId } from '@arq/bim-core';
import { buildWarningsPropertyGroup, warningsGroupHasErrors } from './warnings-property-group';
import type { ValidationMessage } from './validation-result';

const wall1 = elementId('wall-1');
const wall2 = elementId('wall-2');

function message(
  overrides: Partial<ValidationMessage> & Pick<ValidationMessage, 'id' | 'severity'>,
): ValidationMessage {
  return {
    code: 'TEST_CODE',
    title: 'Test message',
    explanation: 'Test explanation.',
    affectedElementIds: [wall1],
    suggestedActions: [],
    ...overrides,
  };
}

describe('buildWarningsPropertyGroup', () => {
  it('keeps only messages naming the given element', () => {
    const forWall1 = message({ id: 'm1', severity: 'error', affectedElementIds: [wall1] });
    const forWall2 = message({ id: 'm2', severity: 'error', affectedElementIds: [wall2] });
    const group = buildWarningsPropertyGroup(wall1, [forWall1, forWall2]);
    expect(group.messages).toEqual([forWall1]);
  });

  it('keeps a message naming the element among several affected ids', () => {
    const shared = message({ id: 'm1', severity: 'error', affectedElementIds: [wall1, wall2] });
    expect(buildWarningsPropertyGroup(wall2, [shared]).messages).toEqual([shared]);
  });

  it('returns an empty group when no messages name the element', () => {
    const forWall2 = message({ id: 'm1', severity: 'error', affectedElementIds: [wall2] });
    expect(buildWarningsPropertyGroup(wall1, [forWall2]).messages).toEqual([]);
  });

  it('orders messages most-severe-first: error, then warning, then info', () => {
    const info = message({ id: 'm-info', severity: 'info' });
    const error = message({ id: 'm-error', severity: 'error' });
    const warning = message({ id: 'm-warning', severity: 'warning' });
    const group = buildWarningsPropertyGroup(wall1, [info, warning, error]);
    expect(group.messages.map((m) => m.id)).toEqual(['m-error', 'm-warning', 'm-info']);
  });

  it('keeps the original relative order among messages of equal severity (stable sort)', () => {
    const first = message({ id: 'm-first', severity: 'warning' });
    const second = message({ id: 'm-second', severity: 'warning' });
    const group = buildWarningsPropertyGroup(wall1, [first, second]);
    expect(group.messages.map((m) => m.id)).toEqual(['m-first', 'm-second']);
  });
});

describe('warningsGroupHasErrors', () => {
  it('is true when the group has an error-severity message', () => {
    const group = buildWarningsPropertyGroup(wall1, [message({ id: 'm1', severity: 'error' })]);
    expect(warningsGroupHasErrors(group)).toBe(true);
  });

  it('is false when the group only has warning/info messages', () => {
    const group = buildWarningsPropertyGroup(wall1, [message({ id: 'm1', severity: 'warning' })]);
    expect(warningsGroupHasErrors(group)).toBe(false);
  });

  it('is false for an empty group', () => {
    expect(warningsGroupHasErrors(buildWarningsPropertyGroup(wall1, []))).toBe(false);
  });
});
