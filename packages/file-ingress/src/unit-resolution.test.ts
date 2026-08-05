import { describe, expect, it } from 'vitest';
import {
  OFFERED_IMPORT_UNITS,
  UNRESOLVED_UNIT_CAPABILITIES,
  canConvertLengths,
  describeUnresolvedUnits,
  resolveImportUnits,
  resolveWithUserChoice,
  unitScaleFactor,
} from './unit-resolution';

describe('resolveImportUnits', () => {
  it('resolves a unit the file declares', () => {
    expect(resolveImportUnits('millimeters')).toEqual({
      status: 'resolved',
      unit: 'mm',
      source: 'declared',
    });
    expect(resolveImportUnits('feet')).toEqual({
      status: 'resolved',
      unit: 'ft',
      source: 'declared',
    });
  });

  it('accepts either spelling and any case', () => {
    expect(resolveImportUnits('Metres')).toEqual({
      status: 'resolved',
      unit: 'm',
      source: 'declared',
    });
    expect(resolveImportUnits('METERS')).toEqual({
      status: 'resolved',
      unit: 'm',
      source: 'declared',
    });
  });

  it('does not default an undeclared unit', () => {
    // Assuming millimetres is how a ten metre wall arrives as ten millimetres.
    const resolution = resolveImportUnits(undefined);

    expect(resolution.status).toBe('unresolved');
    if (resolution.status !== 'unresolved') return;
    expect(resolution.reason).toBe('undeclared');
  });

  it('treats "unitless" as a statement of ignorance, not as a unit', () => {
    // Reading it as "so use the default" converts a statement of ignorance
    // into a measurement.
    const resolution = resolveImportUnits('unitless');

    expect(resolution.status).toBe('unresolved');
    if (resolution.status !== 'unresolved') return;
    expect(resolution.reason).toBe('unitless');
  });

  it('treats "unspecified" the same way resolveDxfUnits produces it', () => {
    expect(resolveImportUnits('unspecified').status).toBe('unresolved');
  });

  it('keeps what the file said, so a prompt can show it', () => {
    const resolution = resolveImportUnits('astronomical units');

    expect(resolution.status).toBe('unresolved');
    if (resolution.status !== 'unresolved') return;
    expect(resolution.reason).toBe('unrecognised');
    expect(resolution.declaredValue).toBe('astronomical units');
  });

  it('treats an empty declaration as no declaration', () => {
    expect(resolveImportUnits('   ').status).toBe('unresolved');
  });
});

describe('resolveWithUserChoice', () => {
  it('records that a person decided, not that the file said', () => {
    // A declared unit is what the file said; a chosen one is what somebody
    // decided it meant. Only one of them is evidence.
    expect(resolveWithUserChoice('m')).toEqual({ status: 'resolved', unit: 'm', source: 'user' });
  });
});

describe('unitScaleFactor', () => {
  it('converts a resolved unit', () => {
    expect(unitScaleFactor(resolveImportUnits('meters'))).toBe(1000);
    expect(unitScaleFactor(resolveImportUnits('inches'))).toBeCloseTo(25.4, 10);
  });

  it('returns null rather than 1 for an unresolved unit', () => {
    // A factor of 1 is a claim that the file was already in millimetres, and
    // it would be indistinguishable from a genuine millimetre file.
    expect(unitScaleFactor(resolveImportUnits(undefined))).toBeNull();
    expect(unitScaleFactor(resolveImportUnits('unitless'))).toBeNull();
  });
});

describe('canConvertLengths', () => {
  it('is false until the unit is known', () => {
    expect(canConvertLengths(resolveImportUnits(undefined))).toBe(false);
    expect(canConvertLengths(resolveImportUnits('mm'))).toBe(true);
    expect(canConvertLengths(resolveWithUserChoice('ft'))).toBe(true);
  });
});

describe('UNRESOLVED_UNIT_CAPABILITIES', () => {
  it('still preserves the source and reports structure', () => {
    // Not "nothing": layer names, block names and entity counts are scale-free
    // and real, and reporting them is how a user is given enough to answer.
    expect(UNRESOLVED_UNIT_CAPABILITIES.preserveSource).toBe(true);
    expect(UNRESOLVED_UNIT_CAPABILITIES.reportStructure).toBe(true);
  });

  it('converts and stages nothing', () => {
    expect(UNRESOLVED_UNIT_CAPABILITIES.convertGeometry).toBe(false);
    expect(UNRESOLVED_UNIT_CAPABILITIES.stageElements).toBe(false);
  });
});

describe('describeUnresolvedUnits', () => {
  it('says nothing when the unit is known', () => {
    expect(describeUnresolvedUnits(resolveImportUnits('mm'))).toBeNull();
  });

  it('states a fact about the file rather than a failure of the import', () => {
    // "Import failed" is neither true nor actionable.
    expect(describeUnresolvedUnits(resolveImportUnits(undefined))).toBe(
      'This drawing does not say what its units are. Choose the unit it was drawn in.',
    );
  });

  it('quotes an unrecognised declaration back', () => {
    expect(describeUnresolvedUnits(resolveImportUnits('smoots'))).toContain('"smoots"');
  });
});

describe('OFFERED_IMPORT_UNITS', () => {
  it('leads with the units an architectural drawing is most likely in', () => {
    expect(OFFERED_IMPORT_UNITS[0]).toBe('mm');
    expect(OFFERED_IMPORT_UNITS).toHaveLength(5);
  });
});
