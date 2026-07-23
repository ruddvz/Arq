import { describe, expect, it } from 'vitest';
import {
  buildIfcMappingReport,
  ifcMappingTableCoversEverySupportedType,
} from './ifc-mapping-report';
import { SUPPORTED_IFC_TYPES } from './ifc-supported-types';
import type { IfcEntitySummary } from './ifc-viewer';

const wall1: IfcEntitySummary = { expressId: 1, ifcType: 'IFCWALL', name: 'Wall 1' };
const wall2: IfcEntitySummary = { expressId: 2, ifcType: 'IFCWALL', name: 'Wall 2' };
const storey: IfcEntitySummary = { expressId: 3, ifcType: 'IFCBUILDINGSTOREY', name: 'Level 1' };
const site: IfcEntitySummary = { expressId: 4, ifcType: 'IFCSITE', name: 'Site' };

describe('ifcMappingTableCoversEverySupportedType', () => {
  it('has a mapping table entry for every IFC type ifc-viewer.ts can actually read', () => {
    expect(Object.keys(SUPPORTED_IFC_TYPES).length).toBeGreaterThan(0);
    expect(ifcMappingTableCoversEverySupportedType()).toBe(true);
  });
});

describe('buildIfcMappingReport', () => {
  it('groups entities by IFC type and reports mapped vs unmapped counts', () => {
    const report = buildIfcMappingReport([wall1, wall2, storey, site]);
    expect(report.entries).toEqual([
      {
        ifcType: 'IFCBUILDINGSTOREY',
        count: 1,
        status: 'mapped',
        arqConcept: '@arq/bim-core Level (level.ts)',
        note: 'A building storey.',
      },
      {
        ifcType: 'IFCSITE',
        count: 1,
        status: 'no-arq-concept-yet',
        note: 'No site concept exists in @arq/bim-core yet.',
      },
      {
        ifcType: 'IFCWALL',
        count: 2,
        status: 'mapped',
        arqConcept: '@arq/bim-core WallType / WallInstance (wall-type.ts, wall-instance.ts)',
        note: 'A wall.',
      },
    ]);
    expect(report.mappedEntityCount).toBe(3);
    expect(report.unmappedEntityCount).toBe(1);
  });

  it('returns an empty report for no entities', () => {
    const report = buildIfcMappingReport([]);
    expect(report).toEqual({ entries: [], mappedEntityCount: 0, unmappedEntityCount: 0 });
  });

  it('every entity is accounted for exactly once (mapped + unmapped counts sum to input length)', () => {
    const entities = [wall1, wall2, storey, site];
    const report = buildIfcMappingReport(entities);
    expect(report.mappedEntityCount + report.unmappedEntityCount).toBe(entities.length);
  });

  it('treats an IFC type absent from the mapping table as unmapped, conservatively, rather than throwing', () => {
    const unknown: IfcEntitySummary = { expressId: 99, ifcType: 'IFCSOMETHINGNEW' };
    const report = buildIfcMappingReport([unknown]);
    expect(report.entries).toEqual([
      {
        ifcType: 'IFCSOMETHINGNEW',
        count: 1,
        status: 'no-arq-concept-yet',
        note: "Not present in this prototype's own mapping table - treated conservatively as unmapped.",
      },
    ]);
  });
});
