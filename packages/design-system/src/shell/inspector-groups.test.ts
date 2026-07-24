import { describe, expect, it } from 'vitest';
import {
  INSPECTOR_GROUP_IDS,
  buildEmptyInspectorGroups,
  describeFieldState,
  hasOverrideMarker,
  isFieldEditable,
  type InspectorField,
} from './inspector-groups';

describe('buildEmptyInspectorGroups', () => {
  it('returns all eleven groups in the fixed blueprint order', () => {
    const groups = buildEmptyInspectorGroups();
    expect(groups.map((g) => g.id)).toEqual(INSPECTOR_GROUP_IDS);
    expect(groups).toHaveLength(11);
  });

  it('gives warnings and history a lines content shape, empty', () => {
    const groups = buildEmptyInspectorGroups();
    const warnings = groups.find((g) => g.id === 'warnings');
    expect(warnings?.content).toEqual({ kind: 'lines', lines: [] });
  });

  it('gives every other group an empty fields content shape', () => {
    const groups = buildEmptyInspectorGroups();
    const identity = groups.find((g) => g.id === 'identity');
    expect(identity?.content).toEqual({ kind: 'fields', fields: [] });
  });
});

describe('hasOverrideMarker', () => {
  it('is true only for overridden fields', () => {
    const overridden: InspectorField = {
      key: 'width',
      label: 'Width',
      kind: 'overridden',
      displayValue: '100mm',
      sourceLabel: 'Interior 100mm',
    };
    const inherited: InspectorField = { ...overridden, kind: 'inherited' };
    expect(hasOverrideMarker(overridden)).toBe(true);
    expect(hasOverrideMarker(inherited)).toBe(false);
  });
});

describe('isFieldEditable', () => {
  it('is false for calculated and missing fields', () => {
    expect(
      isFieldEditable({ key: 'area', label: 'Area', kind: 'calculated', displayValue: '12 m2' }),
    ).toBe(false);
    expect(isFieldEditable({ key: 'x', label: 'X', kind: 'missing', displayValue: null })).toBe(
      false,
    );
  });

  it('is true for invalid fields (section 12: remain editable)', () => {
    expect(
      isFieldEditable({
        key: 'width',
        label: 'Width',
        kind: 'invalid',
        displayValue: '-5mm',
        invalidReason: 'Must be positive',
      }),
    ).toBe(true);
  });

  it('is true for inherited/overridden/imported', () => {
    for (const kind of ['inherited', 'overridden', 'imported'] as const) {
      expect(isFieldEditable({ key: 'k', label: 'K', kind, displayValue: 'v' })).toBe(true);
    }
  });
});

describe('describeFieldState', () => {
  it('names the source for inherited and overridden', () => {
    expect(
      describeFieldState({
        key: 'w',
        label: 'W',
        kind: 'inherited',
        displayValue: '100mm',
        sourceLabel: 'Interior 100mm',
      }),
    ).toBe('Inherited from Interior 100mm');
    expect(
      describeFieldState({
        key: 'w',
        label: 'W',
        kind: 'overridden',
        displayValue: '120mm',
        sourceLabel: 'Interior 100mm',
      }),
    ).toBe('Overridden (was Interior 100mm)');
  });

  it('explains the valid range for invalid fields', () => {
    expect(
      describeFieldState({
        key: 'w',
        label: 'W',
        kind: 'invalid',
        displayValue: '-5mm',
        invalidReason: 'Must be positive',
      }),
    ).toBe('Must be positive');
  });

  it('covers calculated and missing without a source label', () => {
    expect(
      describeFieldState({ key: 'a', label: 'A', kind: 'calculated', displayValue: '1' }),
    ).toBe('Calculated');
    expect(describeFieldState({ key: 'm', label: 'M', kind: 'missing', displayValue: null })).toBe(
      'Not set',
    );
  });
});
