import { elementId } from '@arq/bim-core';
import type { ValidationMessage } from '@arq/operations';

/**
 * §4.3 identity rule: element ids must be unique within a project. A
 * duplicate id makes selection, undo targeting, and sync addressing
 * ambiguous, so it is error severity - a model in this state must not be
 * committed.
 */
export function validateUniqueElementIds(ids: readonly string[]): readonly ValidationMessage[] {
  const counts = new Map<string, number>();
  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const messages: ValidationMessage[] = [];
  for (const [id, count] of counts) {
    if (count > 1) {
      messages.push({
        id: `duplicate-id-${id}`,
        severity: 'error',
        code: 'DUPLICATE_ELEMENT_ID',
        title: 'Element id is not unique',
        explanation: `${count} elements share the id "${id}". Every element must have its own id, or selection and undo become ambiguous. No change was applied.`,
        affectedElementIds: [elementId(id)],
        suggestedActions: ['Regenerate the duplicate element with a fresh id.'],
      });
    }
  }
  return messages;
}
