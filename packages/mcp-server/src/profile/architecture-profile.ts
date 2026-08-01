/**
 * The architecture profile: the one domain this repository can actually
 * execute, described with the evidence that backs each claim.
 *
 * Its derived-output names are taken from @arq/bim-core's own invalidation
 * constants rather than re-spelled here, so a profile can never claim an
 * invalidation the model does not know about. Its operation types come
 * from @arq/arqscript's constructors. Its validation is @arq/validation's
 * rules, applied by the host in `memory-project-host.ts`.
 *
 * Scope is deliberately narrower than the blueprint's architectural
 * ambition. STATUS.md records that the door, window and room tools exist
 * as libraries but are not wired to the canvas, that there is no
 * end-to-end project open, and that no import or export path runs in the
 * product. This profile therefore describes what the packages verifiably
 * do - construct, validate and invert typed operations over the semantic
 * model - and nothing about sheets, PDF output or the native file
 * lifecycle, which have no operation here to describe.
 */

import {
  OPENING_DERIVED_INVALIDATIONS,
  ROOM_DERIVED_INVALIDATIONS,
  WALL_TYPE_DERIVED_INVALIDATIONS,
} from '@arq/bim-core';
import type { ArqMcpScope } from '../grant/scopes';
import type { DomainProfile, EvidenceRecord, OperationDefinition } from './domain-profile';
import {
  ARCHITECTURE_ARGUMENT_VALIDATORS,
  ARQSCRIPT_OPERATION_TYPES,
  addDimensionArguments,
  createLevelArguments,
  createRoomArguments,
  createWallArguments,
  createWallTypeArguments,
  defineUnitsArguments,
  placeDoorArguments,
  placeWindowArguments,
  renameElementArguments,
  updateWallArguments,
} from './architecture-operations';

export const ARCHITECTURE_PROFILE_ID = 'architecture';

/** Only ever the staging scope: no operation may be proposed without it, and no operation grants anything beyond it. */
const STAGE_SCOPES: readonly ArqMcpScope[] = ['arq.changes.stage'];

/** `model-tree` is this profile's own addition: renaming changes what the browser panel shows without touching geometry. */
const ARCHITECTURE_DERIVED_OUTPUTS: readonly string[] = [
  ...new Set([
    ...WALL_TYPE_DERIVED_INVALIDATIONS,
    ...OPENING_DERIVED_INVALIDATIONS,
    ...ROOM_DERIVED_INVALIDATIONS,
    'model-tree',
  ]),
].sort();

function evidence(summary: string, sources: readonly string[]): EvidenceRecord {
  return { state: 'verified', summary, sources };
}

const OPERATION_VERSION = '1.0.0';

function operation(
  input: Omit<OperationDefinition, 'operationVersion' | 'requiredScopes' | 'deprecated'> &
    Partial<Pick<OperationDefinition, 'operationVersion' | 'deprecated'>>,
): OperationDefinition {
  return {
    ...input,
    operationVersion: input.operationVersion ?? OPERATION_VERSION,
    requiredScopes: STAGE_SCOPES,
    deprecated: input.deprecated ?? false,
  };
}

export const ARCHITECTURE_OPERATIONS: readonly OperationDefinition[] = [
  operation({
    operationType: 'architecture.project.define_units',
    title: 'Define project units',
    description:
      "Sets the project's measurement system. This is the display and authoring preference, not the internal storage representation, which ADR-0004 leaves open.",
    arqScriptCommand: ARQSCRIPT_OPERATION_TYPES.units,
    argumentsSchema: defineUnitsArguments.jsonSchema,
    approvalClass: 'project_review',
    consequential: true,
    destructive: false,
    allowedProjectStates: ['editable'],
    knownInvalidations: ['dimensions', 'plan-render-cache'],
    previewKinds: ['property-diff'],
    undoBehaviour: 'inverse_operation',
    evidence: evidence('ArqScript defines the command; ProjectV0 carries the units preference.', [
      'packages/arqscript/src/arqscript-command.ts',
      'packages/bim-core/src/project.ts',
    ]),
  }),
  operation({
    operationType: 'architecture.level.create',
    title: 'Create level',
    description:
      'Adds a storey with a name and elevation. A wall, room or dimension must name the level it belongs to.',
    arqScriptCommand: ARQSCRIPT_OPERATION_TYPES.level,
    argumentsSchema: createLevelArguments.jsonSchema,
    approvalClass: 'project_review',
    consequential: true,
    destructive: false,
    allowedProjectStates: ['editable'],
    knownInvalidations: ['model-tree', 'plan-render-cache'],
    previewKinds: ['property-diff'],
    undoBehaviour: 'inverse_operation',
    evidence: evidence('createLevel validates elevation and storey height at construction.', [
      'packages/bim-core/src/level.ts',
      'packages/arqscript/src/arqscript-command.ts',
    ]),
  }),
  operation({
    operationType: 'architecture.wall_type.create',
    title: 'Create wall type',
    description:
      'Registers a wall type with a thickness and default height. ArqScript v0 has no command for this: its wall command names a type by display name, while the semantic model needs an identified type.',
    arqScriptCommand: 'none',
    argumentsSchema: createWallTypeArguments.jsonSchema,
    approvalClass: 'project_review',
    consequential: true,
    destructive: false,
    allowedProjectStates: ['editable'],
    knownInvalidations: [...WALL_TYPE_DERIVED_INVALIDATIONS],
    previewKinds: ['property-diff'],
    undoBehaviour: 'inverse_operation',
    evidence: evidence(
      'createWallType rejects a non-positive thickness or height; its invalidation set is bim-core’s own constant.',
      ['packages/bim-core/src/wall-type.ts'],
    ),
  }),
  operation({
    operationType: 'architecture.wall.create',
    title: 'Create wall',
    description:
      'Draws a semantic wall between two plan points on a level, using a registered wall type. Arq validates the segment before it is staged.',
    arqScriptCommand: ARQSCRIPT_OPERATION_TYPES.wall,
    argumentsSchema: createWallArguments.jsonSchema,
    approvalClass: 'project_review',
    consequential: true,
    destructive: false,
    allowedProjectStates: ['editable'],
    knownInvalidations: [...WALL_TYPE_DERIVED_INVALIDATIONS],
    previewKinds: ['plan', 'property-diff'],
    undoBehaviour: 'inverse_operation',
    evidence: evidence(
      'validateWallSegment rejects non-finite coordinates and degenerate length; duplicate geometry is reported as a warning.',
      [
        'packages/validation/src/wall-segment-validation.ts',
        'packages/bim-core/src/wall-instance.ts',
      ],
    ),
  }),
  operation({
    operationType: 'architecture.wall.update',
    title: 'Update wall',
    description:
      "Changes a wall's type or height override. Reversing endpoints is a property update, not a delete and recreate, so hosted openings keep their references.",
    arqScriptCommand: ARQSCRIPT_OPERATION_TYPES.updateWall,
    argumentsSchema: updateWallArguments.jsonSchema,
    approvalClass: 'project_review',
    consequential: true,
    destructive: false,
    allowedProjectStates: ['editable'],
    knownInvalidations: [...WALL_TYPE_DERIVED_INVALIDATIONS],
    previewKinds: ['plan', 'property-diff'],
    undoBehaviour: 'inverse_operation',
    evidence: evidence(
      'resolveWallHeight and resetWallHeightOverride define inherited versus overridden height; the ArqScript proposal prototype builds exactly this edit.',
      ['packages/bim-core/src/wall-instance.ts', 'packages/arqscript/src/wall-edit-proposal.ts'],
    ),
  }),
  operation({
    operationType: 'architecture.door.place',
    title: 'Place door',
    description:
      'Hosts a door opening in a wall at an offset along it. Overlapping openings on the same wall are blocking errors, not warnings.',
    arqScriptCommand: ARQSCRIPT_OPERATION_TYPES.door,
    argumentsSchema: placeDoorArguments.jsonSchema,
    approvalClass: 'project_review',
    consequential: true,
    destructive: false,
    allowedProjectStates: ['editable'],
    knownInvalidations: [...OPENING_DERIVED_INVALIDATIONS],
    previewKinds: ['plan', 'property-diff'],
    undoBehaviour: 'inverse_operation',
    evidence: evidence(
      'openingFitsWallLength, openingFitsWallHeight and validateOpeningOverlaps gate placement.',
      ['packages/bim-core/src/opening.ts', 'packages/operations/src/opening-overlap-validation.ts'],
    ),
  }),
  operation({
    operationType: 'architecture.window.place',
    title: 'Place window',
    description:
      'Hosts a window opening in a wall, with a sill height. Subject to the same fit and overlap rules as a door.',
    arqScriptCommand: ARQSCRIPT_OPERATION_TYPES.window,
    argumentsSchema: placeWindowArguments.jsonSchema,
    approvalClass: 'project_review',
    consequential: true,
    destructive: false,
    allowedProjectStates: ['editable'],
    knownInvalidations: [...OPENING_DERIVED_INVALIDATIONS],
    previewKinds: ['plan', 'property-diff'],
    undoBehaviour: 'inverse_operation',
    evidence: evidence(
      'openingFitsWallLength, openingFitsWallHeight and validateOpeningOverlaps gate placement.',
      ['packages/bim-core/src/opening.ts', 'packages/operations/src/opening-overlap-validation.ts'],
    ),
  }),
  operation({
    operationType: 'architecture.room.create',
    title: 'Create room',
    description:
      'Creates a room from a boundary polygon. Arq derives the calculated boundary, area and status; a caller may not assert an area.',
    arqScriptCommand: ARQSCRIPT_OPERATION_TYPES.room,
    argumentsSchema: createRoomArguments.jsonSchema,
    approvalClass: 'project_review',
    consequential: true,
    destructive: false,
    allowedProjectStates: ['editable'],
    knownInvalidations: [...ROOM_DERIVED_INVALIDATIONS],
    previewKinds: ['plan', 'property-diff'],
    undoBehaviour: 'inverse_operation',
    evidence: evidence(
      'validateRoomPolygon rejects fewer than three points, self-intersection and degenerate area before createRoom is reached.',
      ['packages/validation/src/room-polygon-validation.ts', 'packages/bim-core/src/room.ts'],
    ),
  }),
  operation({
    operationType: 'architecture.dimension.add',
    title: 'Add dimension',
    description:
      'Adds a linear dimension between two explicit plan points. Element-anchored references exist in the model but ArqScript v0 cannot express them, so this operation is limited to explicit points.',
    arqScriptCommand: ARQSCRIPT_OPERATION_TYPES.dimension,
    argumentsSchema: addDimensionArguments.jsonSchema,
    approvalClass: 'project_review',
    consequential: true,
    destructive: false,
    allowedProjectStates: ['editable'],
    knownInvalidations: ['dimensions', 'plan-render-cache'],
    previewKinds: ['plan'],
    undoBehaviour: 'inverse_operation',
    evidence: evidence(
      'createLinearDimension and explicitPoint define the supported reference; measuredLinearDimensionLength ignores any text override.',
      ['packages/bim-core/src/linear-dimension.ts', 'packages/bim-core/src/dimension-reference.ts'],
    ),
  }),
  operation({
    operationType: 'architecture.element.rename',
    title: 'Rename',
    description:
      'Renames a level, wall type or room. Identity is unchanged: a rename never mints a new stable id.',
    arqScriptCommand: ARQSCRIPT_OPERATION_TYPES.rename,
    argumentsSchema: renameElementArguments.jsonSchema,
    approvalClass: 'project_review',
    consequential: true,
    destructive: false,
    allowedProjectStates: ['editable'],
    knownInvalidations: ['model-tree'],
    previewKinds: ['property-diff'],
    undoBehaviour: 'inverse_operation',
    evidence: evidence('Stable ids never change for the life of an element.', [
      'packages/bim-core/src/ids.ts',
      'packages/arqscript/src/arqscript-command.ts',
    ]),
  }),
];

export const ARCHITECTURE_PROFILE: DomainProfile = {
  profileId: ARCHITECTURE_PROFILE_ID,
  profileVersion: '1.0.0',
  title: 'Architecture',
  description:
    'Levels, wall types, walls, hosted openings, rooms, linear dimensions and renames over the Arq semantic model.',
  owner: 'arq-architecture',
  status: 'registered',
  registrationBlockers: [],
  semanticKinds: [
    'architecture.level',
    'architecture.wall_type',
    'architecture.wall',
    'architecture.opening',
    'architecture.room',
    'architecture.dimension',
  ],
  derivedOutputs: ARCHITECTURE_DERIVED_OUTPUTS,
  operations: ARCHITECTURE_OPERATIONS,
  argumentValidators: ARCHITECTURE_ARGUMENT_VALIDATORS,
  fileImpact: {
    nativeSchemaChange: false,
    migrationRequired: false,
    notes:
      'These operations act on the in-memory semantic model only. Nothing here writes a .arq file: STATUS.md records that no end-to-end project open or publish pipeline exists yet, so publication remains a request the operator completes in Arq.',
  },
  evidence: {
    state: 'partially_verified',
    summary:
      'Operations, validation and inverses are library-verified by this repository’s own tests. Reaching them from the product surface, and the native file lifecycle around them, are not.',
    sources: [
      'STATUS.md',
      'packages/operations/src/inverse-operation.property.test.ts',
      'packages/validation/src/index.ts',
      'docs/adr/0005-typed-operations.md',
      'docs/adr/0014-ai-operation-model.md',
    ],
  },
};
