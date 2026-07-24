import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  buildTypeAndInstancePropertyGroup,
  type NamedPropertyState,
} from './type-instance-property-group';
import {
  calculatedProperty,
  inheritedProperty,
  missingProperty,
  overriddenProperty,
} from './property-state';

describe('buildTypeAndInstancePropertyGroup', () => {
  it('resolves type as calculated when a type reference is given', () => {
    const group = buildTypeAndInstancePropertyGroup(
      { id: 'wt-1', name: 'Interior Wall 100mm' },
      [],
    );
    expect(group.type).toEqual({
      kind: 'calculated',
      value: { id: 'wt-1', name: 'Interior Wall 100mm' },
    });
  });

  it('resolves type as missing for a typeless element (e.g. Room)', () => {
    const group = buildTypeAndInstancePropertyGroup(undefined, []);
    expect(group.type).toEqual({ kind: 'missing' });
  });

  it('lists no overridden keys when every property is inherited', () => {
    const properties: readonly NamedPropertyState[] = [
      { key: 'height', state: inheritedProperty(2400, 'wt-1') },
      { key: 'thickness', state: inheritedProperty(100, 'wt-1') },
    ];
    const group = buildTypeAndInstancePropertyGroup({ id: 'wt-1', name: 'Wall' }, properties);
    expect(group.overriddenPropertyKeys).toEqual([]);
  });

  it('lists exactly the overridden property keys, ignoring other states', () => {
    const properties: readonly NamedPropertyState[] = [
      { key: 'height', state: overriddenProperty(2100, 'wt-1') },
      { key: 'thickness', state: inheritedProperty(100, 'wt-1') },
      { key: 'name', state: overriddenProperty('Kitchen partition', 'wt-1') },
      { key: 'area', state: calculatedProperty(9) },
      { key: 'ifcGlobalId', state: missingProperty() },
    ];
    const group = buildTypeAndInstancePropertyGroup({ id: 'wt-1', name: 'Wall' }, properties);
    expect(group.overriddenPropertyKeys).toEqual(['height', 'name']);
  });

  it('preserves the order properties were given in', () => {
    const properties: readonly NamedPropertyState[] = [
      { key: 'b', state: overriddenProperty(1, 'wt-1') },
      { key: 'a', state: overriddenProperty(2, 'wt-1') },
    ];
    const group = buildTypeAndInstancePropertyGroup({ id: 'wt-1', name: 'Wall' }, properties);
    expect(group.overriddenPropertyKeys).toEqual(['b', 'a']);
  });

  it('property: overriddenPropertyKeys always exactly matches the count of overridden-state inputs', () => {
    const stateArb = fc.oneof(
      fc.constant(inheritedProperty(1, 'wt-1')),
      fc.constant(overriddenProperty(1, 'wt-1')),
      fc.constant(calculatedProperty(1)),
      fc.constant(missingProperty()),
    );
    fc.assert(
      fc.property(fc.array(stateArb, { minLength: 0, maxLength: 20 }), (states) => {
        const properties = states.map((state, index) => ({ key: `k${index}`, state }));
        const group = buildTypeAndInstancePropertyGroup({ id: 'wt-1', name: 'Wall' }, properties);
        const expectedCount = states.filter((state) => state.kind === 'overridden').length;
        expect(group.overriddenPropertyKeys.length).toBe(expectedCount);
      }),
    );
  });
});
