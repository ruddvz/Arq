import { describe, expect, it } from 'vitest';
import { elementId } from './ids';
import { isElementOfCategory, type ElementBase, type TypedElementBase } from './element';

describe('ElementBase / TypedElementBase', () => {
  it('TypedElementBase carries a category-specific typeId alongside the shared id', () => {
    const wall: TypedElementBase<string> = { id: elementId('w1'), typeId: 'wt-1' };
    expect(wall.id).toBe('w1');
    expect(wall.typeId).toBe('wt-1');
  });
});

describe('isElementOfCategory', () => {
  it('returns true when the element id is present in the candidate list', () => {
    const walls: TypedElementBase<string>[] = [
      { id: elementId('w1'), typeId: 'wt-1' },
      { id: elementId('w2'), typeId: 'wt-1' },
    ];
    const element: ElementBase = { id: elementId('w2') };
    expect(isElementOfCategory(element, walls)).toBe(true);
  });

  it('returns false when the element id is not present', () => {
    const walls: TypedElementBase<string>[] = [{ id: elementId('w1'), typeId: 'wt-1' }];
    const element: ElementBase = { id: elementId('r1') };
    expect(isElementOfCategory(element, walls)).toBe(false);
  });

  it('returns false for an empty candidate list', () => {
    const element: ElementBase = { id: elementId('anything') };
    expect(isElementOfCategory(element, [])).toBe(false);
  });
});
