import type { ElementId, Point2 } from './model';
export interface PlanLine {
  readonly kind: 'line';
  readonly id: string;
  readonly sourceElementId?: ElementId;
  readonly start: Point2;
  readonly end: Point2;
  readonly styleToken: string;
  readonly hitPriority: number;
}
export interface PlanPolygon {
  readonly kind: 'polygon';
  readonly id: string;
  readonly sourceElementId?: ElementId;
  readonly points: readonly Point2[];
  readonly styleToken: string;
  readonly hitPriority: number;
}
export interface PlanText {
  readonly kind: 'text';
  readonly id: string;
  readonly sourceElementId?: ElementId;
  readonly position: Point2;
  readonly text: string;
  readonly styleToken: string;
}
export type PlanPrimitive = PlanLine | PlanPolygon | PlanText;
export interface PlanScene {
  readonly revision: number;
  readonly primitives: readonly PlanPrimitive[];
}
