/**
 * ARQ-161: exchange: define IFC mapping report.
 *
 * ARQ-160's readIfcModel already reports which IFC *schema* types this
 * prototype can read at all (supportReport.preservedEntityCounts /
 * unsupportedLineCount). This is a different, additional question: of
 * what was read, which IFC types correspond to an Arq concept that
 * actually exists in `@arq/bim-core` today, and which do not yet have
 * one? A "mapped" status here means only that an Arq concept exists to
 * eventually receive this IFC type's data - it does NOT mean any
 * conversion code exists. Building real IFC-to-bim-core conversion, and
 * importing `@arq/bim-core` types into this package at all, are both out
 * of scope: this issue's own non-goal ("do not couple project semantics
 * to ... external-format classes") is exactly why this module stays
 * plain data (an ifcType string plus an arqConcept string), never a
 * `@arq/bim-core` import.
 *
 * The mapping table below is hand-checked against `@arq/bim-core`'s
 * actual current source (packages/bim-core/src/*.ts) at the time of
 * writing, not aspirational: Level, Room, WallType/WallInstance,
 * DoorType/DoorInstance and WindowType/WindowInstance all exist there
 * today; Site, Building, Slab, Column, Beam and Roof do not.
 */

import type { IfcEntitySummary } from './ifc-viewer';
import { SUPPORTED_IFC_TYPES } from './ifc-supported-types';

export type IfcMappingStatus = 'mapped' | 'no-arq-concept-yet';

interface IfcTypeMappingDefinition {
  readonly status: IfcMappingStatus;
  readonly arqConcept?: string;
  readonly note: string;
}

/** One entry per key in SUPPORTED_IFC_TYPES - completeness is enforced by ifc-mapping-report.test.ts. */
const IFC_TYPE_MAPPING_TABLE: Readonly<Record<string, IfcTypeMappingDefinition>> = {
  IFCPROJECT: {
    status: 'mapped',
    arqConcept: '@arq/bim-core ProjectV0 (project.ts)',
    note: 'The project hierarchy root.',
  },
  IFCSITE: {
    status: 'no-arq-concept-yet',
    note: 'No site concept exists in @arq/bim-core yet.',
  },
  IFCBUILDING: {
    status: 'no-arq-concept-yet',
    note: 'No building concept exists in @arq/bim-core yet - a project currently goes directly to Level.',
  },
  IFCBUILDINGSTOREY: {
    status: 'mapped',
    arqConcept: '@arq/bim-core Level (level.ts)',
    note: 'A building storey.',
  },
  IFCSPACE: {
    status: 'mapped',
    arqConcept: '@arq/bim-core Room (room.ts)',
    note: 'An enclosed space.',
  },
  IFCWALL: {
    status: 'mapped',
    arqConcept: '@arq/bim-core WallType / WallInstance (wall-type.ts, wall-instance.ts)',
    note: 'A wall.',
  },
  IFCDOOR: {
    status: 'mapped',
    arqConcept: '@arq/bim-core DoorType / DoorInstance (door-type.ts, door-instance.ts)',
    note: 'A door.',
  },
  IFCWINDOW: {
    status: 'mapped',
    arqConcept: '@arq/bim-core WindowType / WindowInstance (window-type.ts, window-instance.ts)',
    note: 'A window.',
  },
  IFCSLAB: {
    status: 'no-arq-concept-yet',
    note: 'No floor/slab concept exists in @arq/bim-core yet.',
  },
  IFCCOLUMN: {
    status: 'no-arq-concept-yet',
    note: 'No structural-column concept exists in @arq/bim-core yet.',
  },
  IFCBEAM: {
    status: 'no-arq-concept-yet',
    note: 'No structural-beam concept exists in @arq/bim-core yet.',
  },
  IFCROOF: {
    status: 'no-arq-concept-yet',
    note: 'No roof concept exists in @arq/bim-core yet.',
  },
};

const FALLBACK_MAPPING: IfcTypeMappingDefinition = {
  status: 'no-arq-concept-yet',
  note: "Not present in this prototype's own mapping table - treated conservatively as unmapped.",
};

export interface IfcMappingReportEntry {
  readonly ifcType: string;
  readonly count: number;
  readonly status: IfcMappingStatus;
  readonly arqConcept?: string;
  readonly note: string;
}

export interface IfcMappingReport {
  /** One entry per distinct IFC type present in the input, sorted by type name. */
  readonly entries: readonly IfcMappingReportEntry[];
  readonly mappedEntityCount: number;
  readonly unmappedEntityCount: number;
}

/** Groups already-read IFC entities (ARQ-160's readIfcModel output) by type and reports each type's Arq-mapping status. Pure and total - every input entity is counted in exactly one entry, mapped or not. */
export function buildIfcMappingReport(entities: readonly IfcEntitySummary[]): IfcMappingReport {
  const countsByType = new Map<string, number>();
  for (const entity of entities) {
    countsByType.set(entity.ifcType, (countsByType.get(entity.ifcType) ?? 0) + 1);
  }

  const entries: IfcMappingReportEntry[] = [...countsByType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ifcType, count]) => {
      const definition = IFC_TYPE_MAPPING_TABLE[ifcType] ?? FALLBACK_MAPPING;
      return {
        ifcType,
        count,
        status: definition.status,
        note: definition.note,
        ...(definition.arqConcept !== undefined && { arqConcept: definition.arqConcept }),
      };
    });

  let mappedEntityCount = 0;
  let unmappedEntityCount = 0;
  for (const entry of entries) {
    if (entry.status === 'mapped') {
      mappedEntityCount += entry.count;
    } else {
      unmappedEntityCount += entry.count;
    }
  }

  return { entries, mappedEntityCount, unmappedEntityCount };
}

/** Every IFC type this prototype can read at all (ifc-supported-types.ts) has exactly one entry in the mapping table above - checked directly rather than assumed. */
export function ifcMappingTableCoversEverySupportedType(): boolean {
  return Object.keys(SUPPORTED_IFC_TYPES).every((ifcType) => ifcType in IFC_TYPE_MAPPING_TABLE);
}
