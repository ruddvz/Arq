/**
 * ARQ-060: define ID types.
 *
 * Branded (nominal) string IDs for the semantic building model, using the
 * same Brand<T, N> pattern established in
 * packages/geometry-2d/src/coordinate-system.ts (ARQ-032) - so a WallId
 * can never be silently passed where a RoomId is expected, even though
 * both are plain strings at runtime.
 *
 * These mirror contracts/model.ts's existing ProjectId/ElementId/WallId/
 * OpeningId/RoomId/LevelId/WallTypeId types exactly (that file already
 * did this design work). They are redefined here, not imported, because
 * contracts/ is not wired up as an importable workspace package yet (no
 * package.json, no tsconfig path alias - see D-014's note in
 * docs/product/DECISION-REGISTER.csv for the same gap affecting
 * operations.ts). Wiring contracts/ up as a real package - so this
 * duplication can be replaced with a single source of truth - is a
 * separate structural decision, not a side effect of this issue.
 *
 * DoorId/DoorTypeId (ARQ-104), WindowId/WindowTypeId (ARQ-107),
 * DimensionId (ARQ-137), TextNoteId (ARQ-139), ViewId and SheetId
 * (ARQ-140) are new additions with no contracts/model.ts counterpart -
 * that file predates the door/window type/instance splits (blueprint
 * sections 46/47), the dimension reference model (section 55, ARQ-136),
 * text notes (section 56, ARQ-139) and sheets (section 58, ARQ-140) -
 * so they follow the same brand convention by extension rather than by
 * mirroring an existing declaration. ViewId/SheetId brand directly off
 * `string`, not `ElementId`, the same way LevelId/WallTypeId do: a View
 * or Sheet is a top-level project entity (section 32 lists View and
 * Sheet separately from Element/ElementType), not a selectable building
 * element.
 */

export type Brand<T, N extends string> = T & { readonly __brand: N };

export type ProjectId = Brand<string, 'ProjectId'>;
export type ElementId = Brand<string, 'ElementId'>;
export type WallId = Brand<ElementId, 'WallId'>;
export type OpeningId = Brand<ElementId, 'OpeningId'>;
export type RoomId = Brand<ElementId, 'RoomId'>;
export type LevelId = Brand<string, 'LevelId'>;
export type WallTypeId = Brand<string, 'WallTypeId'>;
export type DoorId = Brand<ElementId, 'DoorId'>;
export type DoorTypeId = Brand<string, 'DoorTypeId'>;
export type WindowId = Brand<ElementId, 'WindowId'>;
export type WindowTypeId = Brand<string, 'WindowTypeId'>;
export type DimensionId = Brand<ElementId, 'DimensionId'>;
export type TextNoteId = Brand<ElementId, 'TextNoteId'>;
export type ViewId = Brand<string, 'ViewId'>;
export type SheetId = Brand<string, 'SheetId'>;

export function projectId(value: string): ProjectId {
  return value as ProjectId;
}
export function elementId(value: string): ElementId {
  return value as ElementId;
}
export function wallId(value: string): WallId {
  return value as WallId;
}
export function openingId(value: string): OpeningId {
  return value as OpeningId;
}
export function roomId(value: string): RoomId {
  return value as RoomId;
}
export function levelId(value: string): LevelId {
  return value as LevelId;
}
export function wallTypeId(value: string): WallTypeId {
  return value as WallTypeId;
}
export function doorId(value: string): DoorId {
  return value as DoorId;
}
export function doorTypeId(value: string): DoorTypeId {
  return value as DoorTypeId;
}
export function windowId(value: string): WindowId {
  return value as WindowId;
}
export function windowTypeId(value: string): WindowTypeId {
  return value as WindowTypeId;
}
export function dimensionId(value: string): DimensionId {
  return value as DimensionId;
}
export function textNoteId(value: string): TextNoteId {
  return value as TextNoteId;
}
export function viewId(value: string): ViewId {
  return value as ViewId;
}
export function sheetId(value: string): SheetId {
  return value as SheetId;
}

export type SlabId = Brand<ElementId, 'SlabId'>;
export type SlabTypeId = Brand<string, 'SlabTypeId'>;
export type StairId = Brand<ElementId, 'StairId'>;
export type StairTypeId = Brand<string, 'StairTypeId'>;
export type MaterialId = Brand<string, 'MaterialId'>;
export type ScheduleId = Brand<string, 'ScheduleId'>;
