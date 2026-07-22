import { describe, expect, it } from 'vitest';
import { elementId } from '@arq/bim-core';
import {
  filterBySeverity,
  hasErrors,
  hasSeverity,
  type ValidationMessage,
} from './validation-result';

function message(severity: ValidationMessage['severity']): ValidationMessage {
  return {
    id: `msg-${severity}`,
    severity,
    code: 'TEST',
    title: 'Test message',
    explanation: 'A test validation message.',
    affectedElementIds: [elementId('e1')],
    suggestedActions: [],
  };
}

describe('hasSeverity / hasErrors', () => {
  it('detects the presence of a given severity', () => {
    const messages = [message('info'), message('warning')];
    expect(hasSeverity(messages, 'warning')).toBe(true);
    expect(hasSeverity(messages, 'error')).toBe(false);
    expect(hasErrors(messages)).toBe(false);
  });

  it('hasErrors is true once an error-level message is present', () => {
    expect(hasErrors([message('info'), message('error')])).toBe(true);
  });

  it('is false for an empty message list', () => {
    expect(hasErrors([])).toBe(false);
  });
});

describe('filterBySeverity', () => {
  it('returns only messages matching the given severity', () => {
    const messages = [message('info'), message('error'), message('error')];
    expect(filterBySeverity(messages, 'error')).toHaveLength(2);
    expect(filterBySeverity(messages, 'warning')).toHaveLength(0);
  });
});
