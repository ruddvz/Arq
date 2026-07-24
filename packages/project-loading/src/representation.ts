export type RepresentationTier = 0 | 1 | 2 | 3 | 4 | 5;
export const REPRESENTATION_NAMES = [
  'bounding-box',
  'simplified-plan',
  'cached-vector',
  'simplified-3d',
  'precise-active-view',
  'export-quality',
] as const;
export function canUpgradeRepresentation(
  from: RepresentationTier,
  to: RepresentationTier,
): boolean {
  return to >= from;
}
export function representationName(
  tier: RepresentationTier,
): (typeof REPRESENTATION_NAMES)[number] {
  return REPRESENTATION_NAMES[tier];
}
