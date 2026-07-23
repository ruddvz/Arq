/**
 * ARQ-166: ai: define ArqScript grammar v0.
 *
 * The AST shape of ArqScript v0's eleven commands (blueprint section 99):
 * define units; create level; create wall; update wall; place door; place
 * window; create room; add dimension; select by ID; select by category;
 * rename. This module is the grammar itself - what a valid ArqScript
 * document's parse tree looks like - not a parser: turning source text
 * into these AST nodes is ARQ-167's separate, later job (this issue's own
 * non-goal rules out expanding into that scope here).
 *
 * Every command carries `operationType`, the typed operation name section
 * 98/ADR-0014 says ArqScript ultimately produces ("AI creates previewable
 * typed operations through ArqScript") - real, checkable data today, even
 * though actually constructing and previewing a `@arq/operations`
 * ModelOperation from a command is later work. Every command also
 * carries `assumptions`: human-readable notes recording any value this
 * constructor filled in by default rather than the caller supplying it
 * explicitly, per section 97's AI workflow step 3 ("assumptions") - kept
 * visible here rather than silently applied.
 *
 * All lengths are millimetres (matching the example script's `mm`
 * suffixes) represented as plain `number` - this grammar module has no
 * dependency on @arq/bim-core's Length or ids types. ArqScript is Arq's
 * own native interchange language, not a foreign format, but a v0
 * grammar-only issue still has no reason to import a semantic package it
 * does not yet call into (nothing here validates geometry or project
 * state - see the module doc's "later work" notes throughout).
 *
 * Constructors throw RangeError on genuinely invalid direct construction
 * input (e.g. a negative height) - callers here are ARQ-167's future
 * parser or tests building AST nodes directly, not an untrusted-bytes
 * boundary, following @arq/bim-core's createLevel precedent.
 */

export interface ArqScriptPoint {
  readonly xMm: number;
  readonly yMm: number;
}

function requireFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite, non-negative number`);
  }
}

function requireNonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new RangeError(`${label} must not be empty`);
  }
  return trimmed;
}

export const DEFAULT_WALL_TYPE = 'Generic 100';
export const DEFAULT_WALL_HEIGHT_MM = 2700;

/**
 * `unit` is the project's measurement *system* ('metric' | 'imperial') -
 * matching both docs/ai/ARQSCRIPT-GRAMMAR.ebnf's pre-existing
 * `units_decl = "units", ("metric" | "imperial")` (this issue's own
 * starting-point draft) and @arq/bim-core's already-shipped
 * `ProjectUnitsPreference` (project.ts, ARQ-061) exactly. This is
 * deliberately not the same choice as a length value's own `mm`/`cm`/
 * `m`/`in`/`ft` suffix (ArqScriptPoint's fields, wall/door/window
 * lengths): those are per-value units on individual lengths; this
 * command is a project-wide display/authoring preference, the same
 * distinction bim-core's own ProjectUnitsPreference doc comment draws
 * against internal storage.
 */
export interface UnitsCommand {
  readonly kind: 'units';
  readonly operationType: 'DefineProjectUnits';
  readonly unit: 'metric' | 'imperial';
  readonly assumptions: readonly string[];
}

export function createUnitsCommand(unit: UnitsCommand['unit']): UnitsCommand {
  return { kind: 'units', operationType: 'DefineProjectUnits', unit, assumptions: [] };
}

export interface LevelCommand {
  readonly kind: 'level';
  readonly operationType: 'CreateLevel';
  readonly name: string;
  readonly elevationMm: number;
  readonly assumptions: readonly string[];
}

export interface CreateLevelCommandInput {
  readonly name: string;
  readonly elevationMm: number;
}

export function createLevelCommand(input: CreateLevelCommandInput): LevelCommand {
  const name = requireNonEmpty(input.name, 'level name');
  if (!Number.isFinite(input.elevationMm)) {
    throw new RangeError('level elevationMm must be a finite number');
  }
  return {
    kind: 'level',
    operationType: 'CreateLevel',
    name,
    elevationMm: input.elevationMm,
    assumptions: [],
  };
}

export interface WallCommand {
  readonly kind: 'wall';
  readonly operationType: 'CreateWall';
  readonly id: string;
  readonly from: ArqScriptPoint;
  readonly to: ArqScriptPoint;
  readonly wallType: string;
  readonly heightMm: number;
  readonly assumptions: readonly string[];
}

export interface CreateWallCommandInput {
  readonly id: string;
  readonly from: ArqScriptPoint;
  readonly to: ArqScriptPoint;
  readonly wallType?: string;
  readonly heightMm?: number;
}

/** wallType and heightMm are optional - an omitted value falls back to a documented default, recorded as an assumption rather than silently applied. */
export function createWallCommand(input: CreateWallCommandInput): WallCommand {
  const id = requireNonEmpty(input.id, 'wall id');
  requireFiniteNonNegative(input.from.xMm, 'wall from.xMm');
  requireFiniteNonNegative(input.from.yMm, 'wall from.yMm');
  requireFiniteNonNegative(input.to.xMm, 'wall to.xMm');
  requireFiniteNonNegative(input.to.yMm, 'wall to.yMm');

  const assumptions: string[] = [];
  let wallType = input.wallType;
  if (wallType === undefined) {
    wallType = DEFAULT_WALL_TYPE;
    assumptions.push(`assumed default wall type "${DEFAULT_WALL_TYPE}"`);
  }
  let heightMm = input.heightMm;
  if (heightMm === undefined) {
    heightMm = DEFAULT_WALL_HEIGHT_MM;
    assumptions.push(`assumed default wall height ${DEFAULT_WALL_HEIGHT_MM}mm`);
  } else {
    requireFiniteNonNegative(heightMm, 'wall heightMm');
  }

  return {
    kind: 'wall',
    operationType: 'CreateWall',
    id,
    from: input.from,
    to: input.to,
    wallType,
    heightMm,
    assumptions,
  };
}

export interface UpdateWallCommand {
  readonly kind: 'update-wall';
  readonly operationType: 'UpdateWall';
  readonly id: string;
  readonly wallType?: string;
  readonly heightMm?: number;
  readonly assumptions: readonly string[];
}

export interface UpdateWallCommandInput {
  readonly id: string;
  readonly wallType?: string;
  readonly heightMm?: number;
}

/** At least one of wallType/heightMm must be present - an update with nothing to change is not a valid command. */
export function createUpdateWallCommand(input: UpdateWallCommandInput): UpdateWallCommand {
  const id = requireNonEmpty(input.id, 'wall id');
  if (input.wallType === undefined && input.heightMm === undefined) {
    throw new RangeError('update-wall must change at least one of wallType or heightMm');
  }
  if (input.heightMm !== undefined) {
    requireFiniteNonNegative(input.heightMm, 'wall heightMm');
  }
  return {
    kind: 'update-wall',
    operationType: 'UpdateWall',
    id,
    ...(input.wallType !== undefined && { wallType: input.wallType }),
    ...(input.heightMm !== undefined && { heightMm: input.heightMm }),
    assumptions: [],
  };
}

export const DEFAULT_DOOR_WIDTH_MM = 900;
export const DEFAULT_DOOR_HEIGHT_MM = 2100;

export interface DoorCommand {
  readonly kind: 'door';
  readonly operationType: 'PlaceDoor';
  readonly id: string;
  readonly hostWallId: string;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly offsetMm: number;
  readonly assumptions: readonly string[];
}

export interface PlaceDoorCommandInput {
  readonly id: string;
  readonly hostWallId: string;
  readonly widthMm?: number;
  readonly heightMm?: number;
  readonly offsetMm: number;
}

export function createDoorCommand(input: PlaceDoorCommandInput): DoorCommand {
  const id = requireNonEmpty(input.id, 'door id');
  const hostWallId = requireNonEmpty(input.hostWallId, 'door host');
  requireFiniteNonNegative(input.offsetMm, 'door offsetMm');

  const assumptions: string[] = [];
  let widthMm = input.widthMm;
  if (widthMm === undefined) {
    widthMm = DEFAULT_DOOR_WIDTH_MM;
    assumptions.push(`assumed default door width ${DEFAULT_DOOR_WIDTH_MM}mm`);
  } else {
    requireFiniteNonNegative(widthMm, 'door widthMm');
  }
  let heightMm = input.heightMm;
  if (heightMm === undefined) {
    heightMm = DEFAULT_DOOR_HEIGHT_MM;
    assumptions.push(`assumed default door height ${DEFAULT_DOOR_HEIGHT_MM}mm`);
  } else {
    requireFiniteNonNegative(heightMm, 'door heightMm');
  }

  return {
    kind: 'door',
    operationType: 'PlaceDoor',
    id,
    hostWallId,
    widthMm,
    heightMm,
    offsetMm: input.offsetMm,
    assumptions,
  };
}

export const DEFAULT_WINDOW_WIDTH_MM = 1200;
export const DEFAULT_WINDOW_HEIGHT_MM = 1200;
export const DEFAULT_WINDOW_SILL_HEIGHT_MM = 900;

export interface WindowCommand {
  readonly kind: 'window';
  readonly operationType: 'PlaceWindow';
  readonly id: string;
  readonly hostWallId: string;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly sillHeightMm: number;
  readonly offsetMm: number;
  readonly assumptions: readonly string[];
}

export interface PlaceWindowCommandInput {
  readonly id: string;
  readonly hostWallId: string;
  readonly widthMm?: number;
  readonly heightMm?: number;
  readonly sillHeightMm?: number;
  readonly offsetMm: number;
}

export function createWindowCommand(input: PlaceWindowCommandInput): WindowCommand {
  const id = requireNonEmpty(input.id, 'window id');
  const hostWallId = requireNonEmpty(input.hostWallId, 'window host');
  requireFiniteNonNegative(input.offsetMm, 'window offsetMm');

  const assumptions: string[] = [];
  let widthMm = input.widthMm;
  if (widthMm === undefined) {
    widthMm = DEFAULT_WINDOW_WIDTH_MM;
    assumptions.push(`assumed default window width ${DEFAULT_WINDOW_WIDTH_MM}mm`);
  } else {
    requireFiniteNonNegative(widthMm, 'window widthMm');
  }
  let heightMm = input.heightMm;
  if (heightMm === undefined) {
    heightMm = DEFAULT_WINDOW_HEIGHT_MM;
    assumptions.push(`assumed default window height ${DEFAULT_WINDOW_HEIGHT_MM}mm`);
  } else {
    requireFiniteNonNegative(heightMm, 'window heightMm');
  }
  let sillHeightMm = input.sillHeightMm;
  if (sillHeightMm === undefined) {
    sillHeightMm = DEFAULT_WINDOW_SILL_HEIGHT_MM;
    assumptions.push(`assumed default window sill height ${DEFAULT_WINDOW_SILL_HEIGHT_MM}mm`);
  } else {
    requireFiniteNonNegative(sillHeightMm, 'window sillHeightMm');
  }

  return {
    kind: 'window',
    operationType: 'PlaceWindow',
    id,
    hostWallId,
    widthMm,
    heightMm,
    sillHeightMm,
    offsetMm: input.offsetMm,
    assumptions,
  };
}

export interface RoomCommand {
  readonly kind: 'room';
  readonly operationType: 'CreateRoom';
  readonly id: string;
  readonly name: string;
  readonly boundary: readonly ArqScriptPoint[];
  readonly assumptions: readonly string[];
}

export interface CreateRoomCommandInput {
  readonly id: string;
  readonly name: string;
  readonly boundary: readonly ArqScriptPoint[];
}

/** A room boundary needs at least 3 vertices to describe a real polygon. */
export function createRoomCommand(input: CreateRoomCommandInput): RoomCommand {
  const id = requireNonEmpty(input.id, 'room id');
  const name = requireNonEmpty(input.name, 'room name');
  if (input.boundary.length < 3) {
    throw new RangeError('room boundary must have at least 3 points');
  }
  return {
    kind: 'room',
    operationType: 'CreateRoom',
    id,
    name,
    boundary: input.boundary,
    assumptions: [],
  };
}

export interface DimensionCommand {
  readonly kind: 'dimension';
  readonly operationType: 'AddDimension';
  readonly id: string;
  readonly from: ArqScriptPoint;
  readonly to: ArqScriptPoint;
  readonly assumptions: readonly string[];
}

export interface AddDimensionCommandInput {
  readonly id: string;
  readonly from: ArqScriptPoint;
  readonly to: ArqScriptPoint;
}

export function createDimensionCommand(input: AddDimensionCommandInput): DimensionCommand {
  const id = requireNonEmpty(input.id, 'dimension id');
  return {
    kind: 'dimension',
    operationType: 'AddDimension',
    id,
    from: input.from,
    to: input.to,
    assumptions: [],
  };
}

export interface SelectByIdCommand {
  readonly kind: 'select-id';
  readonly operationType: 'Select';
  readonly ids: readonly string[];
  readonly assumptions: readonly string[];
}

export function createSelectByIdCommand(ids: readonly string[]): SelectByIdCommand {
  if (ids.length === 0) {
    throw new RangeError('select-id must name at least one id');
  }
  return { kind: 'select-id', operationType: 'Select', ids, assumptions: [] };
}

export interface SelectByCategoryCommand {
  readonly kind: 'select-category';
  readonly operationType: 'Select';
  readonly category: string;
  readonly assumptions: readonly string[];
}

export function createSelectByCategoryCommand(category: string): SelectByCategoryCommand {
  return {
    kind: 'select-category',
    operationType: 'Select',
    category: requireNonEmpty(category, 'select category'),
    assumptions: [],
  };
}

export interface RenameCommand {
  readonly kind: 'rename';
  readonly operationType: 'Rename';
  readonly id: string;
  readonly newName: string;
  readonly assumptions: readonly string[];
}

export interface RenameCommandInput {
  readonly id: string;
  readonly newName: string;
}

export function createRenameCommand(input: RenameCommandInput): RenameCommand {
  const id = requireNonEmpty(input.id, 'rename id');
  const newName = requireNonEmpty(input.newName, 'rename newName');
  return { kind: 'rename', operationType: 'Rename', id, newName, assumptions: [] };
}

export type ArqScriptCommand =
  | UnitsCommand
  | LevelCommand
  | WallCommand
  | UpdateWallCommand
  | DoorCommand
  | WindowCommand
  | RoomCommand
  | DimensionCommand
  | SelectByIdCommand
  | SelectByCategoryCommand
  | RenameCommand;
