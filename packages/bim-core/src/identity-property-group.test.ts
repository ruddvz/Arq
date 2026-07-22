import { describe, expect, it } from 'vitest';
import { buildIdentityPropertyGroup, type IdentitySource } from './identity-property-group';

const baseSource: IdentitySource = {
  id: 'wall-1',
  category: 'Wall',
};

describe('buildIdentityPropertyGroup', () => {
  it('always exposes id and category as calculated', () => {
    const group = buildIdentityPropertyGroup(baseSource);
    expect(group.id).toEqual({ kind: 'calculated', value: 'wall-1' });
    expect(group.category).toEqual({ kind: 'calculated', value: 'Wall' });
  });

  it('resolves name as inherited from the type when no override is given', () => {
    const group = buildIdentityPropertyGroup({
      ...baseSource,
      type: { id: 'wt-1', name: 'Interior Wall 100mm' },
    });
    expect(group.name).toEqual({
      kind: 'inherited',
      value: 'Interior Wall 100mm',
      sourceTypeId: 'wt-1',
    });
  });

  it('resolves name as overridden when a typed element has a nameOverride', () => {
    const group = buildIdentityPropertyGroup({
      ...baseSource,
      type: { id: 'wt-1', name: 'Interior Wall 100mm' },
      nameOverride: 'Kitchen partition',
    });
    expect(group.name).toEqual({
      kind: 'overridden',
      value: 'Kitchen partition',
      sourceTypeId: 'wt-1',
    });
  });

  it('resolves name as calculated for a typeless element with its own name (e.g. Room)', () => {
    const group = buildIdentityPropertyGroup({
      id: 'room-1',
      category: 'Room',
      nameOverride: 'Kitchen',
    });
    expect(group.name).toEqual({ kind: 'calculated', value: 'Kitchen' });
  });

  it('resolves name as missing for a typeless element with no name at all', () => {
    const group = buildIdentityPropertyGroup(baseSource);
    expect(group.name).toEqual({ kind: 'missing' });
  });

  it('resolves levelId as missing when absent (e.g. an Opening, which has no levelId of its own)', () => {
    const group = buildIdentityPropertyGroup(baseSource);
    expect(group.levelId).toEqual({ kind: 'missing' });
  });

  it('resolves levelId as calculated when present', () => {
    const group = buildIdentityPropertyGroup({ ...baseSource, levelId: 'level-1' });
    expect(group.levelId).toEqual({ kind: 'calculated', value: 'level-1' });
  });

  it('resolves ifcGlobalId as missing when the element was not imported from IFC', () => {
    const group = buildIdentityPropertyGroup(baseSource);
    expect(group.ifcGlobalId).toEqual({ kind: 'missing' });
  });

  it('resolves ifcGlobalId as imported when present, kept separate from the element id', () => {
    const group = buildIdentityPropertyGroup({ ...baseSource, ifcGlobalId: '2O2Fr$t4X7Zf8NOew3FLOH' });
    expect(group.ifcGlobalId).toEqual({
      kind: 'imported',
      value: '2O2Fr$t4X7Zf8NOew3FLOH',
      importSource: 'ifc',
    });
    expect(group.id).toEqual({ kind: 'calculated', value: 'wall-1' });
  });

  it('resolves dxfHandle as missing when the element was not imported from DXF', () => {
    const group = buildIdentityPropertyGroup(baseSource);
    expect(group.dxfHandle).toEqual({ kind: 'missing' });
  });

  it('resolves dxfHandle as imported when present, kept separate from the element id', () => {
    const group = buildIdentityPropertyGroup({ ...baseSource, dxfHandle: '2A3' });
    expect(group.dxfHandle).toEqual({ kind: 'imported', value: '2A3', importSource: 'dxf' });
    expect(group.id).toEqual({ kind: 'calculated', value: 'wall-1' });
  });

  it('resolves ifcGlobalId and dxfHandle independently of each other', () => {
    const group = buildIdentityPropertyGroup({
      ...baseSource,
      ifcGlobalId: '2O2Fr$t4X7Zf8NOew3FLOH',
      dxfHandle: '2A3',
    });
    expect(group.ifcGlobalId.kind).toBe('imported');
    expect(group.dxfHandle.kind).toBe('imported');
  });
});
