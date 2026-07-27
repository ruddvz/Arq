import { describe, expect, it } from 'vitest';
import { validateUniqueElementIds } from './unique-id-validation';

describe('validateUniqueElementIds', () => {
  it('accepts unique ids', () => {
    expect(validateUniqueElementIds(['a', 'b', 'c'])).toEqual([]);
  });

  it('reports each duplicated id once, with its count', () => {
    const messages = validateUniqueElementIds(['a', 'b', 'a', 'a', 'c', 'c']);
    expect(messages).toHaveLength(2);
    const byId = new Map(messages.map((m) => [m.affectedElementIds[0], m]));
    expect(byId.get('a' as never)?.explanation).toContain('3 elements');
    expect(byId.get('c' as never)?.explanation).toContain('2 elements');
    expect(messages.every((m) => m.severity === 'error')).toBe(true);
  });

  it('accepts an empty list', () => {
    expect(validateUniqueElementIds([])).toEqual([]);
  });
});
