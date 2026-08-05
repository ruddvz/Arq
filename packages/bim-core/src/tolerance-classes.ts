import { MICROMETRES_PER_MILLIMETRE, type CanonicalLength } from './canonical-length';

/**
 * V3-111/V3-112: named tolerance classes, replacing a single global epsilon.
 *
 * One epsilon cannot be right for every question. "Are these two stored
 * coordinates the same value" and "are these two wall endpoints close enough to
 * join" and "did the user click near enough to that edge to snap to it" are
 * different questions with different correct answers, and a shared constant
 * makes them one question. What happens in practice is that the constant gets
 * tuned for whichever call site is failing today, quietly changing the answer
 * everywhere else - a snapping fix that alters topology merging, or a topology
 * fix that makes selection feel unresponsive.
 *
 * So each class is named for the question it answers, carries its own value, and
 * says what it is not. `.zeus/FAST-KERNEL.md` puts the same rule from the other
 * side: canonical units are not resolved incidentally.
 */

export type ToleranceClass =
  | 'storage-quantum'
  | 'canonical-equality'
  | 'planar-topology-merge'
  | 'operation-validation'
  | 'inference-acquisition'
  | 'import'
  | 'rendering';

export interface ToleranceDefinition {
  readonly id: ToleranceClass;
  /**
   * The tolerance in micrometres, or null where the class has no single
   * model-space value - because it is screen-relative, source-derived, or
   * exactly zero by construction.
   */
  readonly micrometres: number | null;
  readonly appliesTo: string;
  readonly doesNotApplyTo: string;
}

export const TOLERANCE_CLASSES: Readonly<Record<ToleranceClass, ToleranceDefinition>> = {
  'storage-quantum': {
    id: 'storage-quantum',
    micrometres: 1,
    appliesTo: 'the smallest difference the canonical grid can represent at all',
    doesNotApplyTo: 'deciding whether two things are the same; that is canonical-equality',
  },
  'canonical-equality': {
    id: 'canonical-equality',
    // Exactly zero, and not a small number. Both operands are integers on the
    // grid, so equality is `===`. A non-zero value here would reintroduce the
    // approximate comparison that storing integers exists to remove.
    micrometres: 0,
    appliesTo: 'comparing two values that are already canonical',
    doesNotApplyTo: 'comparing anything that came from float geometry before quantising',
  },
  'planar-topology-merge': {
    id: 'planar-topology-merge',
    // 10µm: far below anything a person can draw or a document can express, far
    // above the accumulated error of a few float transforms. Candidate pending
    // the adversarial-join fixtures.
    micrometres: 10,
    appliesTo: 'deciding whether two endpoints or edges are coincident and should join',
    doesNotApplyTo: 'equality of stored values, or whether a user meant to snap',
  },
  'operation-validation': {
    id: 'operation-validation',
    // Product constraints - minimum wall length, minimum opening clearance -
    // vary per rule, so there is no single number. They are not numerical
    // epsilon at all, which is why they are listed here rather than left to be
    // confused with one.
    micrometres: null,
    appliesTo: 'product rules about what geometry is allowed to exist',
    doesNotApplyTo: 'numerical comparison of any kind',
  },
  'inference-acquisition': {
    id: 'inference-acquisition',
    // Screen-space, so it has no fixed model-space value: the same pixel radius
    // is metres when zoomed out and micrometres when zoomed in. Model-space caps
    // belong with the inference engine, which knows the current zoom.
    micrometres: null,
    appliesTo: 'deciding what the pointer is near enough to snap or hover',
    doesNotApplyTo: 'anything that changes stored geometry',
  },
  import: {
    id: 'import',
    // Derived from the source's declared precision and units, capped by policy,
    // and reported in the fidelity statement. A fixed value would either
    // over-trust a coarse source or discard a precise one.
    micrometres: null,
    appliesTo: 'reconciling incoming geometry whose precision Arq did not choose',
    doesNotApplyTo: 'geometry Arq authored',
  },
  rendering: {
    id: 'rendering',
    // Deliberately coarser than canonical: the renderer may simplify freely
    // because its output is derived and never read back into the model.
    micrometres: null,
    appliesTo: 'visual simplification and tessellation',
    doesNotApplyTo: 'any value that will be committed',
  },
};

export function toleranceMicrometres(id: ToleranceClass): number | null {
  return TOLERANCE_CLASSES[id].micrometres;
}

/**
 * Whether two canonical lengths are within a named model-space tolerance.
 *
 * Refuses the classes that have no single model-space value rather than
 * substituting one, since a caller reaching for `inference-acquisition` here is
 * asking a screen-space question of a model-space function and needs to be told
 * so, not given a plausible number.
 */
export function withinTolerance(
  a: CanonicalLength,
  b: CanonicalLength,
  id: ToleranceClass,
): boolean {
  const tolerance = toleranceMicrometres(id);
  if (tolerance === null) {
    throw new Error(
      `tolerance class "${id}" has no fixed model-space value; ${TOLERANCE_CLASSES[id].appliesTo}`,
    );
  }
  return Math.abs(a - b) <= tolerance;
}

/** The topology merge threshold expressed in millimetres, for copy and diagnostics. */
export function planarMergeToleranceMm(): number {
  return TOLERANCE_CLASSES['planar-topology-merge'].micrometres! / MICROMETRES_PER_MILLIMETRE;
}
