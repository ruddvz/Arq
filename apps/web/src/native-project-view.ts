import {
  buildGeometryPropertyGroup,
  buildIdentityPropertyGroup,
  buildRelationshipsPropertyGroup,
  buildTypeAndInstancePropertyGroup,
  calculatedProperty,
  elementId,
  inheritedProperty,
  lengthMeasurement,
  length as makeLength,
  relationshipEntry,
  toMillimetres,
  type Length,
  type Room,
  type Wall,
} from '@arq/bim-core';
import { buildHistoryPropertyGroup, buildWarningsPropertyGroup } from '@arq/operations';
import {
  buildEmptyInspectorGroups,
  type InspectorGroup,
  type ModelPanelNode,
} from '@arq/design-system';
import {
  roomsOnLevel,
  wallTypeFor,
  wallsOnLevel,
  type NativeProjectModel,
} from '@arq/project-loading';
import type { StagedNativeProject } from '@arq/project-loading';
import type { DrawnWall } from './canvas/plan-document';
import type { PlanRoom } from './canvas/canvas-interaction';

/**
 * What the workspace shows for an opened native `.arq` project: its model tree,
 * its plan and 3D geometry, its inspector content and the notices a reader needs
 * in order to trust what they are looking at.
 *
 * Every value here is read out of the project. Nothing is a placeholder, a demo
 * fixture or a plausible default - if a project does not carry something, the
 * surface says so rather than showing an invented version of it. That rule is the
 * whole reason this module is separate from `inspector-data.ts`, which builds the
 * workspace's own demo-plan content.
 */

/** Canonical wall ids, shared by plan and 3D so the two cannot disagree about what is selected. */
export function planWallsForLevel(
  model: NativeProjectModel,
  levelId: string,
): readonly DrawnWall[] {
  return wallsOnLevel(model, levelId).map((wall) => ({
    id: wall.id as string,
    start: wall.start,
    end: wall.end,
  }));
}

export function planRoomsForLevel(model: NativeProjectModel, levelId: string): readonly PlanRoom[] {
  return roomsOnLevel(model, levelId).map((room) => ({
    id: room.id as string,
    label: roomLabel(room),
    polygon: room.calculatedBoundary,
  }));
}

function roomLabel(room: Room): string {
  // Number and name as the project records them, in the order a drawing sheet
  // reads: "01 Living". A room with no number is labelled by name alone rather
  // than with an invented number.
  const area = `${room.calculatedArea.toFixed(2)} m²`;
  return room.number === undefined
    ? `${room.name} · ${area}`
    : `${room.number} ${room.name} · ${area}`;
}

/**
 * A geometry measurement is a `Length` for a length or a plain number for an
 * angle or a count, so both are rendered rather than one being assumed.
 */
function formatMeasurement(value: number | Length): string {
  return typeof value === 'number' ? String(value) : `${value.value}${value.unit}`;
}

function wallLengthMm(wall: Wall): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

/** The height a wall resolves to: its own override, or the type's default. */
export function resolvedWallHeightMm(model: NativeProjectModel, wall: Wall): number | null {
  if (wall.heightOverride !== undefined) {
    return toMillimetres(wall.heightOverride);
  }
  const type = wallTypeFor(model, wall);
  return type === null ? null : toMillimetres(type.defaultHeight);
}

export function wallThicknessMm(model: NativeProjectModel, wall: Wall): number | null {
  const type = wallTypeFor(model, wall);
  return type === null ? null : toMillimetres(type.thickness);
}

/**
 * The project's own tree: project, then a node per level, then that level's walls
 * and rooms under it. Ids are the project's canonical ids, so selecting a row
 * selects the same element the canvases do.
 */
export function buildNativeProjectTree(model: NativeProjectModel): readonly ModelPanelNode[] {
  return [
    {
      id: model.summary.projectId,
      displayName: model.summary.projectName,
      nodeType: 'Project',
      hidden: false,
      children: model.levels.map((level) => {
        const levelId = level.id as string;
        const walls = wallsOnLevel(model, levelId);
        const rooms = model.rooms.filter((room) => (room.levelId as string) === levelId);
        return {
          id: levelId,
          displayName: `${level.name} · ${level.elevation} mm`,
          nodeType: 'Level',
          hidden: false,
          children: [
            ...walls.map((wall) => ({
              id: wall.id as string,
              displayName: `${wallTypeFor(model, wall)?.name ?? 'Wall'} · ${Math.round(wallLengthMm(wall))} mm`,
              nodeType: 'Wall',
              hidden: false,
            })),
            ...rooms.map((room) => ({
              id: room.id as string,
              displayName: roomLabel(room),
              nodeType: 'Room',
              hidden: false,
            })),
          ],
        };
      }),
    },
  ];
}

export type NativeSelectedElement =
  | { readonly kind: 'wall'; readonly wall: Wall }
  | { readonly kind: 'room'; readonly room: Room }
  | { readonly kind: 'level'; readonly name: string }
  | { readonly kind: 'project' };

/** Resolves a selection id against the project, so the inspector shows the real element or nothing. */
export function findNativeElement(
  model: NativeProjectModel,
  id: string | null,
): NativeSelectedElement | null {
  if (id === null) {
    return null;
  }
  if (id === model.summary.projectId) {
    return { kind: 'project' };
  }
  const level = model.levels.find((entry) => (entry.id as string) === id);
  if (level !== undefined) {
    return { kind: 'level', name: level.name };
  }
  const wall = model.walls.find((entry) => (entry.id as string) === id);
  if (wall !== undefined) {
    return { kind: 'wall', wall };
  }
  const room = model.rooms.find((entry) => (entry.id as string) === id);
  return room === undefined ? null : { kind: 'room', room };
}

/** The header type name for a selection, or null when nothing addressable is selected. */
export function nativeSelectionTypeName(selected: NativeSelectedElement | null): string | null {
  if (selected === null) {
    return null;
  }
  switch (selected.kind) {
    case 'wall':
      return 'Wall';
    case 'room':
      return 'Room';
    case 'level':
      return 'Level';
    case 'project':
      return 'Project';
  }
}

function fieldGroup(
  id: InspectorGroup['id'],
  label: string,
  fields: readonly [string, string][],
): InspectorGroup {
  return {
    id,
    label,
    content: {
      kind: 'fields',
      fields: fields.map(([key, value]) => ({
        key,
        label: key,
        kind: 'calculated' as const,
        displayValue: value,
      })),
    },
  };
}

/**
 * Inspector groups for a selected element of an opened project, built through the
 * same `@arq/bim-core` property-group builders the demo path uses - so the
 * inherited-versus-overridden distinction a real wall carries is rendered as that
 * distinction rather than flattened into a number.
 */
export function buildNativeInspectorGroups(
  model: NativeProjectModel,
  selected: NativeSelectedElement | null,
): readonly InspectorGroup[] {
  if (selected === null) {
    return buildEmptyInspectorGroups();
  }
  const groupById = new Map(buildEmptyInspectorGroups().map((group) => [group.id, group]));

  if (selected.kind === 'project') {
    groupById.set(
      'identity',
      fieldGroup('identity', 'Identity', [
        ['Project', model.summary.projectName],
        ['ID', model.summary.projectId],
        ['Revision', String(model.summary.revision)],
        ['Units', model.summary.units],
        ['Levels', String(model.levels.length)],
        ['Walls', String(model.walls.length)],
        ['Rooms', String(model.rooms.length)],
        ['Model schema', model.summary.modelSchema],
      ]),
    );
    return Array.from(groupById.values());
  }

  if (selected.kind === 'level') {
    groupById.set('identity', fieldGroup('identity', 'Identity', [['Level', selected.name]]));
    return Array.from(groupById.values());
  }

  if (selected.kind === 'room') {
    const { room } = selected;
    groupById.set(
      'identity',
      fieldGroup('identity', 'Identity', [
        ['ID', room.id as string],
        ['Category', 'Room'],
        ['Name', room.name],
        ...((room.number === undefined ? [] : [['Number', room.number]]) as [string, string][]),
      ]),
    );
    groupById.set(
      'geometry',
      fieldGroup('geometry', 'Geometry', [
        ['area', `${room.calculatedArea.toFixed(2)} m²`],
        ['boundary vertices', String(room.calculatedBoundary.length)],
      ]),
    );
    groupById.set(
      'relationships',
      fieldGroup('relationships', 'Relationships', [
        [
          'bounding elements',
          room.boundaryElementIds.length === 0
            ? 'None'
            : (room.boundaryElementIds as readonly string[]).join(', '),
        ],
      ]),
    );
    groupById.set('warnings', {
      id: 'warnings',
      label: 'Warnings',
      content: {
        kind: 'lines',
        // The project's own room status, surfaced rather than assumed valid.
        lines: room.status === 'valid' ? [] : [`warning: room boundary is ${room.status}`],
      },
    });
    return Array.from(groupById.values());
  }

  const { wall } = selected;
  const type = wallTypeFor(model, wall);
  const level = model.levels.find((entry) => entry.id === wall.levelId);
  const identity = buildIdentityPropertyGroup({
    id: elementId(wall.id as string),
    category: 'Wall',
    levelId: wall.levelId as string,
    ...(type === null ? {} : { type: { id: type.id as string, name: type.name } }),
  });
  const heightMm = resolvedWallHeightMm(model, wall);
  const geometry = buildGeometryPropertyGroup([
    lengthMeasurement(
      'length',
      calculatedProperty(makeLength(Math.round(wallLengthMm(wall)), 'mm')),
    ),
    ...(heightMm === null
      ? []
      : [
          lengthMeasurement(
            'height',
            // Inherited when it comes from the type, overridden when the wall
            // carries its own - the same reading-through the model defines, not a
            // single flattened number.
            wall.heightOverride === undefined && type !== null
              ? inheritedProperty(makeLength(heightMm, 'mm'), type.id as string)
              : calculatedProperty(makeLength(heightMm, 'mm')),
          ),
        ]),
  ]);
  const relationships = buildRelationshipsPropertyGroup([
    relationshipEntry('hostedOpenings', 'hosts', [...(wall.hostedOpeningIds as readonly string[])]),
  ]);
  const warnings = buildWarningsPropertyGroup(elementId(wall.id as string), []);
  const history = buildHistoryPropertyGroup(elementId(wall.id as string), []);

  groupById.set(
    'identity',
    fieldGroup('identity', 'Identity', [
      ['ID', wall.id as string],
      ['Category', 'Wall'],
      ['Level', level?.name ?? (wall.levelId as string)],
      ['Alignment', wall.alignment],
    ]),
  );
  groupById.set('geometry', {
    id: 'geometry',
    label: 'Geometry',
    content: {
      kind: 'fields',
      fields: geometry.measurements.map((measurement) => ({
        key: measurement.key,
        label: measurement.key,
        kind:
          measurement.state.kind === 'inherited' ? ('inherited' as const) : ('calculated' as const),
        displayValue:
          measurement.state.kind === 'missing' || measurement.state.kind === 'invalid'
            ? null
            : formatMeasurement(measurement.state.value),
        ...(measurement.state.kind === 'inherited'
          ? { sourceLabel: measurement.state.sourceTypeId }
          : {}),
      })),
    },
  });
  if (type !== null) {
    const typeAndInstance = buildTypeAndInstancePropertyGroup(
      { id: type.id as string, name: type.name },
      wall.heightOverride === undefined
        ? []
        : [{ key: 'height', state: calculatedProperty(toMillimetres(wall.heightOverride)) }],
    );
    groupById.set(
      'type',
      fieldGroup('type', 'Type', [
        ['Type', type.name],
        ['Thickness', `${toMillimetres(type.thickness)}mm`],
        ['Default height', `${toMillimetres(type.defaultHeight)}mm`],
        ['Function', type.function],
      ]),
    );
    groupById.set('instance', {
      id: 'instance',
      label: 'Instance',
      content: {
        kind: 'lines',
        lines: typeAndInstance.overriddenPropertyKeys.map((key) => `Overridden: ${key}`),
      },
    });
  }
  groupById.set('relationships', {
    id: 'relationships',
    label: 'Relationships',
    content: {
      kind: 'fields',
      fields: relationships.relationships.map((entry) => ({
        key: entry.key,
        label: entry.key,
        kind: 'calculated' as const,
        displayValue:
          entry.relatedIds.kind === 'calculated' && entry.relatedIds.value.length > 0
            ? entry.relatedIds.value.join(', ')
            : 'None',
      })),
    },
  });
  groupById.set('warnings', {
    id: 'warnings',
    label: 'Warnings',
    content: {
      kind: 'lines',
      lines: warnings.messages.map((message) => `${message.severity}: ${message.title}`),
    },
  });
  groupById.set('history', {
    id: 'history',
    label: 'History',
    content: {
      kind: 'lines',
      // Empty on purpose: the project's operation log is present in the file but
      // this build does not replay it, and inventing entries would be worse than
      // an empty list.
      lines: history.entries.map((entry) => `${entry.type} (${entry.timestamp})`),
    },
  });
  return Array.from(groupById.values());
}

/** What a screen reader announces for a selected element of an opened project. */
export function buildNativeAccessibleDescription(
  model: NativeProjectModel,
  selected: NativeSelectedElement | null,
): string | null {
  if (selected === null) {
    return null;
  }
  if (selected.kind === 'project') {
    return `${model.summary.projectName}, revision ${model.summary.revision}, ${model.levels.length} levels, ${model.walls.length} walls, open read-only.`;
  }
  if (selected.kind === 'level') {
    return `Level ${selected.name}.`;
  }
  if (selected.kind === 'room') {
    return `Room ${selected.room.name}, area ${selected.room.calculatedArea.toFixed(2)} square metres, boundary ${selected.room.status}.`;
  }
  const { wall } = selected;
  const type = wallTypeFor(model, wall);
  const heightMm = resolvedWallHeightMm(model, wall);
  return `Wall ${wall.id}, ${type?.name ?? 'unknown type'}, length ${Math.round(wallLengthMm(wall))} millimetres${
    heightMm === null ? '' : `, height ${heightMm} millimetres`
  }, ${wall.hostedOpeningIds.length} hosted openings, read-only.`;
}

/**
 * Everything a reader needs to know about what they are looking at that the
 * geometry itself does not tell them: why it cannot be edited, what the file
 * contains that is not drawn, which views cannot be presented, and any condition
 * the open found. This is the list that keeps a partial view of a project from
 * being mistaken for the whole project.
 */
export function nativeProjectNotices(staged: StagedNativeProject): readonly string[] {
  const notices: string[] = [staged.authoringUnavailableReason];
  if (staged.safeModePlan.kind !== 'healthy') {
    notices.push(`This file opened with a condition: ${staged.safeModePlan.reason}.`);
  }
  for (const entry of staged.model.unsupported) {
    notices.push(`${entry.count} ${entry.section}: ${entry.reason}`);
  }
  for (const view of staged.model.views) {
    if (!view.supported) {
      notices.push(`View "${view.name}" is not shown. ${view.unsupportedReason ?? ''}`.trim());
    }
  }
  if (staged.corruptOptionalPaths.length > 0) {
    notices.push(
      `Optional project content that could not be read: ${staged.corruptOptionalPaths.join(', ')}.`,
    );
  }
  return notices;
}
