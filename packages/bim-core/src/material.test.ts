import { describe, expect, it } from 'vitest';
import type { MaterialId } from './ids';
import { createMaterial, findMaterialProperty } from './material';

const id = 'material-1' as MaterialId;

describe('createMaterial', () => {
  it('keeps name and code distinct so renaming does not rewrite the schedule key', () => {
    const material = createMaterial({ id, name: 'Cast-in-place concrete', code: 'CON-01' });

    expect(material.name).toBe('Cast-in-place concrete');
    expect(material.code).toBe('CON-01');
    expect(material.properties).toEqual([]);
  });

  it('rejects an empty name', () => {
    expect(() => createMaterial({ id, name: '   ' })).toThrow(RangeError);
  });

  it('rejects a hatch spacing that cannot be drawn', () => {
    expect(() =>
      createMaterial({
        id,
        name: 'Brick',
        cutPattern: { name: 'masonry-brick', angleDegrees: 45, spacingPaperMm: 0 },
      }),
    ).toThrow(RangeError);
  });

  it('rejects a duplicate property key, so no reader has to pick between two answers', () => {
    expect(() =>
      createMaterial({
        id,
        name: 'Insulation',
        properties: [
          { key: 'thermal-conductivity', value: 0.035, unit: 'W/mK', source: 'manufacturer' },
          { key: 'thermal-conductivity', value: 0.04, unit: 'W/mK', source: 'estimated' },
        ],
      }),
    ).toThrow(/duplicate material property key/);
  });

  it('carries provenance on every property, so an estimate never prints as a datasheet value', () => {
    const material = createMaterial({
      id,
      name: 'Insulation',
      properties: [
        { key: 'thermal-conductivity', value: 0.035, unit: 'W/mK', source: 'estimated' },
      ],
    });

    expect(findMaterialProperty(material, 'thermal-conductivity')?.source).toBe('estimated');
  });
});

describe('findMaterialProperty', () => {
  it('returns undefined rather than zero for an absent property', () => {
    const material = createMaterial({ id, name: 'Timber' });

    expect(findMaterialProperty(material, 'density')).toBeUndefined();
  });
});
