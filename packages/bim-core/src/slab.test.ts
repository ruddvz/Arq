import { describe, expect, it } from 'vitest';
import { length } from './length';
import type { LevelId, SlabId, SlabTypeId } from './ids';
import { SLAB_TYPE_DERIVED_INVALIDATIONS, slabInstance, slabType } from './slab';

const typeId = 'slab-type-1' as SlabTypeId;
const levelId = 'level-1' as LevelId;

describe('SlabType', () => {
  it('carries thickness on the type so one edit moves every instance of it', () => {
    const type = slabType({
      id: typeId,
      name: 'Concrete 200',
      thickness: length(200, 'mm'),
      function: 'floor',
    });

    expect(type.thickness.value).toBe(200);
    expect(type.function).toBe('floor');
  });
});

describe('SlabInstance', () => {
  it('records which face the offset measures to, so identical offsets are not ambiguous', () => {
    const topDatum = slabInstance({
      id: 'slab-1' as SlabId,
      typeId,
      levelId,
      offsetFromLevel: length(0, 'mm'),
      datumFace: 'top',
      boundaryIds: ['a', 'b', 'c', 'd'],
    });
    const bottomDatum = slabInstance({
      id: 'slab-2' as SlabId,
      typeId,
      levelId,
      offsetFromLevel: length(0, 'mm'),
      datumFace: 'bottom',
      boundaryIds: ['a', 'b', 'c', 'd'],
    });

    // Same level, same offset, same type: the only thing distinguishing two
    // slabs that occupy different space is the datum face.
    expect(topDatum.datumFace).not.toBe(bottomDatum.datumFace);
  });

  it('allows a negative offset for a slab hung below its level', () => {
    const hung = slabInstance({
      id: 'slab-3' as SlabId,
      typeId,
      levelId,
      offsetFromLevel: length(-150, 'mm'),
      datumFace: 'top',
      boundaryIds: [],
    });

    expect(hung.offsetFromLevel.value).toBe(-150);
  });
});

describe('SLAB_TYPE_DERIVED_INVALIDATIONS', () => {
  it('names the derived outputs a type change invalidates, without resolving instances', () => {
    expect(SLAB_TYPE_DERIVED_INVALIDATIONS).toContain('room-volume');
    expect(SLAB_TYPE_DERIVED_INVALIDATIONS).toContain('quantity-schedule');
  });
});
