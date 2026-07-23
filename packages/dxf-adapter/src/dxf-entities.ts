/**
 * ARQ-158: exchange: prototype DXF parser.
 *
 * Stage 1 entity shapes, straight from docs/interoperability/DXF-PLAN.md's
 * own list: LINE, LWPOLYLINE, ARC, CIRCLE, TEXT. Coordinates are 2D only
 * (DXF's z group codes - 30/31/... - are read and discarded): this
 * prototype is linework exchange for plan drawings, not a 3D format.
 * Deliberately plain data, not @arq/bim-core types - this package has no
 * dependency on bim-core, matching every other exchange-format adapter's
 * layering (a later, separate step maps these into real Wall/Room/etc.
 * elements; that mapping is out of this prototype's scope).
 */

export interface DxfPoint2 {
  readonly x: number;
  readonly y: number;
}

export interface DxfLineEntity {
  readonly kind: 'LINE';
  readonly layer: string;
  readonly start: DxfPoint2;
  readonly end: DxfPoint2;
}

export interface DxfCircleEntity {
  readonly kind: 'CIRCLE';
  readonly layer: string;
  readonly center: DxfPoint2;
  readonly radius: number;
}

export interface DxfArcEntity {
  readonly kind: 'ARC';
  readonly layer: string;
  readonly center: DxfPoint2;
  readonly radius: number;
  readonly startAngleDegrees: number;
  readonly endAngleDegrees: number;
}

export interface DxfPolylineEntity {
  readonly kind: 'LWPOLYLINE';
  readonly layer: string;
  readonly closed: boolean;
  readonly vertices: readonly DxfPoint2[];
}

export interface DxfTextEntity {
  readonly kind: 'TEXT';
  readonly layer: string;
  readonly insertion: DxfPoint2;
  readonly height: number;
  readonly text: string;
}

export type DxfEntity =
  DxfLineEntity | DxfCircleEntity | DxfArcEntity | DxfPolylineEntity | DxfTextEntity;

/** Every DXF entity type name this prototype recognizes and preserves - anything else is reported as unsupported, never silently dropped without a trace. */
export const SUPPORTED_DXF_ENTITY_TYPES = ['LINE', 'CIRCLE', 'ARC', 'LWPOLYLINE', 'TEXT'] as const;
