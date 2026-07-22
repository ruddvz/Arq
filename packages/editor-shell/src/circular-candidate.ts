import type { WorldPoint } from '@arq/geometry-2d';

/**
 * Renderer- and model-independent circular geometry offered to the snap system.
 * An arc and its parent circle share the same centre and radius, so both can use
 * this contract without exposing project element types to editor interaction code.
 */
export interface CircularCandidate {
  readonly kind: 'circle' | 'arc';
  readonly centre: WorldPoint;
  readonly radius: number;
}

/** Invalid geometry is ignored by snapping instead of producing a corrupt preview. */
export function isValidCircularCandidate(candidate: CircularCandidate): boolean {
  return (
    Number.isFinite(candidate.centre.x) &&
    Number.isFinite(candidate.centre.y) &&
    Number.isFinite(candidate.radius) &&
    candidate.radius > 0
  );
}
