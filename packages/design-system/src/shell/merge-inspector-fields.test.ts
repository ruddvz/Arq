import { describe, expect, it } from 'vitest';
import {
  describeFieldState,
  isFieldEditable,
  mergeInspectorFields,
  type InspectorField,
} from './inspector-groups';

const field = (
  overrides: Partial<InspectorField> & Pick<InspectorField, 'key'>,
): InspectorField => ({
  label: overrides.key,
  kind: 'inherited',
  displayValue: '100mm',
  ...overrides,
});

describe('mergeInspectorFields', () => {
  it('keeps a property every element agrees on', () => {
    const merged = mergeInspectorFields([
      [field({ key: 'category', displayValue: 'Wall' })],
      [field({ key: 'category', displayValue: 'Wall' })],
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.kind).toBe('inherited');
    expect(merged[0]!.displayValue).toBe('Wall');
  });

  it('reports a property the elements disagree on as mixed, with no value', () => {
    // The regression: three walls selected used to show the first wall's length
    // under a heading saying three were selected.
    const merged = mergeInspectorFields([
      [field({ key: 'length', displayValue: '4200mm' })],
      [field({ key: 'length', displayValue: '1800mm' })],
      [field({ key: 'length', displayValue: '900mm' })],
    ]);

    expect(merged[0]!.kind).toBe('mixed');
    expect(merged[0]!.displayValue).toBeNull();
    expect(describeFieldState(merged[0]!)).toBe('Multiple values');
  });

  it('treats a matching value in a different state as mixed', () => {
    // Same number, but one is inherited from a type and the other overridden on
    // the instance. Editing them is not the same act, so they are not one row.
    const merged = mergeInspectorFields([
      [field({ key: 'height', kind: 'inherited', displayValue: '2400mm' })],
      [field({ key: 'height', kind: 'overridden', displayValue: '2400mm' })],
    ]);

    expect(merged[0]!.kind).toBe('mixed');
  });

  it('treats a key only some elements carry as mixed', () => {
    // Showing the value from whichever elements happen to have it is the
    // original bug in miniature.
    const merged = mergeInspectorFields([
      [field({ key: 'fireRating', displayValue: 'REI 60' })],
      [field({ key: 'category', displayValue: 'Wall' })],
    ]);

    const fireRating = merged.find((f) => f.key === 'fireRating');
    expect(fireRating?.kind).toBe('mixed');
    expect(fireRating?.displayValue).toBeNull();
  });

  it('leaves a mixed row editable only when every element behind it was', () => {
    const editable = mergeInspectorFields([
      [field({ key: 'length', kind: 'overridden', displayValue: '1m' })],
      [field({ key: 'length', kind: 'overridden', displayValue: '2m' })],
    ]);
    expect(isFieldEditable(editable[0]!)).toBe(true);

    // A calculated value has no edit path, so a mixed row over one must not
    // offer an edit that goes nowhere.
    const calculated = mergeInspectorFields([
      [field({ key: 'area', kind: 'calculated', displayValue: '10m2' })],
      [field({ key: 'area', kind: 'overridden', displayValue: '12m2' })],
    ]);
    expect(isFieldEditable(calculated[0]!)).toBe(false);
  });

  it('passes a single element through untouched', () => {
    const only = [field({ key: 'id', kind: 'calculated', displayValue: 'wall-1' })];

    expect(mergeInspectorFields([only])).toEqual(only);
  });

  it('returns nothing for an empty selection', () => {
    expect(mergeInspectorFields([])).toEqual([]);
    expect(mergeInspectorFields([[], []])).toEqual([]);
  });

  it('keeps the first element’s row order so a selection does not reshuffle rows', () => {
    const merged = mergeInspectorFields([
      [field({ key: 'id' }), field({ key: 'category' })],
      [field({ key: 'category' }), field({ key: 'id' })],
    ]);

    expect(merged.map((f) => f.key)).toEqual(['id', 'category']);
  });
});
