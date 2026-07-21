export type Brand<T, N extends string> = T & { readonly __brand: N };
export type ProjectId = Brand<string, 'ProjectId'>;
export type ElementId = Brand<string, 'ElementId'>;
export type WallId = Brand<ElementId, 'WallId'>;
export type OpeningId = Brand<ElementId, 'OpeningId'>;
export type RoomId = Brand<ElementId, 'RoomId'>;
export type LevelId = Brand<string, 'LevelId'>;
export interface Point2 {
  readonly x: number;
  readonly y: number;
}
export interface Level {
  readonly id: LevelId;
  readonly name: string;
  readonly elevation: number;
  readonly storeyHeight?: number;
}
export interface WallType {
  readonly id: string;
  readonly name: string;
  readonly thickness: number;
  readonly defaultHeight: number;
  readonly function: 'exterior' | 'interior' | 'unknown';
}
export interface Wall {
  readonly id: WallId;
  readonly typeId: string;
  readonly levelId: LevelId;
  readonly start: Point2;
  readonly end: Point2;
  readonly alignment: 'centre' | 'interior' | 'exterior';
  readonly heightOverride?: number;
  readonly joinStart: 'auto' | 'butt' | 'mitre' | 'disallow';
  readonly joinEnd: 'auto' | 'butt' | 'mitre' | 'disallow';
  readonly hostedOpeningIds: readonly OpeningId[];
}
export interface Opening {
  readonly id: OpeningId;
  readonly hostWallId: WallId;
  readonly kind: 'door' | 'window' | 'void';
  readonly offsetFromWallStart: number;
  readonly width: number;
  readonly sillHeight: number;
  readonly height: number;
}
export interface Room {
  readonly id: RoomId;
  readonly levelId: LevelId;
  readonly seedPoint: Point2;
  readonly name: string;
  readonly number?: string;
  readonly boundaryElementIds: readonly ElementId[];
  readonly calculatedBoundary: readonly Point2[];
  readonly calculatedArea: number;
  readonly status: 'valid' | 'not-enclosed' | 'overlapping' | 'invalid';
}
