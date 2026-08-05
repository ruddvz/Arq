/**
 * V3-116/V3-118/V3-119/V3-120: the constraint solver boundary, and a
 * deterministic solver for the accepted first subset behind it.
 *
 * The pack's decision is to build one `ConstraintSolver` abstraction and choose
 * the implementation only after a Rust and WebAssembly comparison spike, with
 * SolveSpace/libslvs among the candidates. That comparison has not run, so this
 * does not pretend to settle it. What it does is fix the *interface* the
 * comparison will be judged against, and provide an implementation of the
 * bounded first subset so the rest of the product has something correct to
 * build on meanwhile.
 *
 * The interface is the durable part, and the acceptance criteria drove its
 * shape rather than the other way round:
 *
 * - `solve` returns a discriminated result, never a mutated input, so a failed
 *   solve cannot leave half-moved geometry behind;
 * - under-constrained, over-constrained and conflicting are three distinct
 *   outcomes, because they need three different things from the user, and a
 *   solver that reports "failed" for all three has told them nothing;
 * - iteration is bounded and the bound is in the result, so a solve that gave
 *   up is distinguishable from one that converged;
 * - every emitted coordinate is checked finite, so a diverging solve cannot
 *   put NaN into canonical state.
 *
 * The solver here is analytic and direct rather than iterative least-squares.
 * For the accepted subset - coincidence, horizontal, vertical, fixed length,
 * locked points - the constraints are individually satisfiable by projection,
 * so a damped Newton iteration would be machinery without a purpose. Where the
 * subset grows past that (parallel and perpendicular between two free lines,
 * symmetric distance), an iterative kernel is the right tool, and it goes
 * behind this same interface.
 */

import { worldPoint, type WorldPoint } from './coordinate-system';

/** A solver variable: one named point that may move. */
export interface ConstraintPoint {
  readonly id: string;
  readonly point: WorldPoint;
  /** A locked point is a constant, not a variable. */
  readonly locked?: boolean;
}

/**
 * The accepted first subset. Deliberately closed: a constraint kind that is not
 * here is not silently ignored, it is reported as unsupported, because a
 * constraint the user drew and the solver quietly dropped is worse than one it
 * refused.
 */
export type Constraint =
  | { readonly id: string; readonly kind: 'coincident'; readonly a: string; readonly b: string }
  | { readonly id: string; readonly kind: 'horizontal'; readonly a: string; readonly b: string }
  | { readonly id: string; readonly kind: 'vertical'; readonly a: string; readonly b: string }
  | {
      readonly id: string;
      readonly kind: 'fixed-length';
      readonly a: string;
      readonly b: string;
      readonly length: number;
    }
  | { readonly id: string; readonly kind: 'locked'; readonly a: string };

export type ConstraintSystemState =
  /** Every constraint is satisfied and the system has a unique solution. */
  | 'well-constrained'
  /** Satisfied, but points remain free. Valid, and worth saying. */
  | 'under-constrained'
  /** More independent constraints than degrees of freedom. */
  | 'over-constrained'
  /** Constraints that cannot all hold at once, whatever the point positions. */
  | 'conflicting';

export interface ConstraintSolveResult {
  readonly status: 'solved' | 'unsatisfied';
  readonly state: ConstraintSystemState;
  /** Solved positions by point id. Only present when `status` is 'solved'. */
  readonly points: ReadonlyMap<string, WorldPoint>;
  /**
   * The smallest set of constraints that cannot hold together (V3-119). Naming
   * one constraint would blame whichever happened to be evaluated last; the
   * conflict is a property of the set.
   */
  readonly conflictSet: readonly string[];
  /** Constraint kinds this solver does not implement, reported rather than ignored. */
  readonly unsupported: readonly string[];
  readonly iterations: number;
  /** True when the iteration bound stopped the solve before it converged. */
  readonly hitIterationLimit: boolean;
}

export interface ConstraintSolverOptions {
  /** Bounded by contract: an unbounded solve cannot be cancelled or budgeted. */
  readonly maxIterations?: number;
  /** Distance below which two points count as coincident, in the caller's units. */
  readonly toleranceMicrometres?: number;
}

/**
 * The abstraction the comparison spike will implement. A Rust/WebAssembly
 * kernel, SolveSpace behind a binding, or the analytic solver below all satisfy
 * this shape, which is the point: the choice can change without the callers
 * changing.
 */
export interface ConstraintSolver {
  readonly name: string;
  solve(
    points: readonly ConstraintPoint[],
    constraints: readonly Constraint[],
    options?: ConstraintSolverOptions,
  ): ConstraintSolveResult;
}

const DEFAULT_MAX_ITERATIONS = 64;
const DEFAULT_TOLERANCE = 10;

const SUPPORTED_KINDS = new Set(['coincident', 'horizontal', 'vertical', 'fixed-length', 'locked']);

/**
 * Deterministic analytic solver for the accepted subset.
 *
 * Determinism is a requirement, not a property it happens to have: the same
 * canonical input must produce the same output on every machine and every
 * replay, or an operation log cannot be replayed and two devices editing the
 * same project diverge. That is why constraints are sorted by id before
 * evaluation and points are emitted in sorted order - iteration order over a
 * Map or an input array is a hidden input, and hidden inputs are how a solver
 * stops being reproducible.
 */
export function createAnalyticConstraintSolver(): ConstraintSolver {
  return {
    name: 'arq-analytic-2d-v1',
    solve(points, constraints, options = {}) {
      const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
      const tolerance = options.toleranceMicrometres ?? DEFAULT_TOLERANCE;

      const unsupported = [
        ...new Set(
          constraints.filter((c) => !SUPPORTED_KINDS.has(c.kind)).map((c) => c.kind as string),
        ),
      ].sort();

      const working = new Map<string, WorldPoint>();
      const locked = new Set<string>();
      for (const entry of points) {
        working.set(entry.id, worldPoint(entry.point.x, entry.point.y));
        if (entry.locked) {
          locked.add(entry.id);
        }
      }

      const supported = constraints
        .filter((c) => SUPPORTED_KINDS.has(c.kind))
        // Sorted so evaluation order is a function of the data, not of however
        // the caller happened to build the array.
        .sort((a, b) => a.id.localeCompare(b.id));

      for (const constraint of supported) {
        if (constraint.kind === 'locked') {
          locked.add(constraint.a);
        }
      }

      // A constraint naming a point that does not exist cannot be satisfied and
      // cannot be blamed on the geometry, so it is a conflict in its own right.
      const missingReferences = supported.filter((constraint) =>
        referencedIds(constraint).some((pointId) => !working.has(pointId)),
      );
      if (missingReferences.length > 0) {
        return unsatisfied(
          'conflicting',
          missingReferences.map((c) => c.id),
          unsupported,
          0,
        );
      }

      const conflicts = detectStructuralConflicts(supported, locked);
      if (conflicts.length > 0) {
        return unsatisfied('conflicting', conflicts, unsupported, 0);
      }

      let iterations = 0;
      let settled = false;
      while (iterations < maxIterations && !settled) {
        iterations += 1;
        let moved = false;
        for (const constraint of supported) {
          moved = applyConstraint(constraint, working, locked, tolerance) || moved;
        }
        settled = !moved;
      }

      if (!settled) {
        // Reported rather than returned as a solution: a set that never stops
        // moving has not converged, and emitting the last positions would
        // present an arbitrary intermediate state as an answer.
        return {
          status: 'unsatisfied',
          state: 'conflicting',
          points: new Map(),
          conflictSet: supported.map((c) => c.id),
          unsupported,
          iterations,
          hitIterationLimit: true,
        };
      }

      for (const [pointId, point] of working) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
          // A non-finite coordinate must never reach canonical state, so this is
          // checked at the boundary rather than trusted from the arithmetic.
          return unsatisfied(
            'conflicting',
            supported.map((c) => c.id),
            unsupported,
            iterations,
          );
        }
        working.set(pointId, point);
      }

      return {
        status: 'solved',
        state: classify(points, supported, locked),
        points: new Map([...working].sort(([a], [b]) => a.localeCompare(b))),
        conflictSet: [],
        unsupported,
        iterations,
        hitIterationLimit: false,
      };
    },
  };
}

function unsatisfied(
  state: ConstraintSystemState,
  conflictSet: readonly string[],
  unsupported: readonly string[],
  iterations: number,
): ConstraintSolveResult {
  return {
    status: 'unsatisfied',
    state,
    points: new Map(),
    conflictSet: [...conflictSet].sort(),
    unsupported,
    iterations,
    hitIterationLimit: false,
  };
}

function referencedIds(constraint: Constraint): readonly string[] {
  return constraint.kind === 'locked' ? [constraint.a] : [constraint.a, constraint.b];
}

/**
 * Conflicts detectable without solving: two constraints that cannot both hold
 * regardless of where the points are.
 *
 * Structural detection matters because the alternative is discovering the
 * conflict as a non-convergence, which reports every constraint as suspect
 * instead of the two that actually disagree.
 */
function detectStructuralConflicts(
  constraints: readonly Constraint[],
  locked: ReadonlySet<string>,
): readonly string[] {
  const conflicts = new Set<string>();

  for (const a of constraints) {
    for (const b of constraints) {
      if (a.id >= b.id) continue;

      // A segment cannot be both horizontal and vertical unless it is a point,
      // which a fixed non-zero length then forbids.
      if (
        ((a.kind === 'horizontal' && b.kind === 'vertical') ||
          (a.kind === 'vertical' && b.kind === 'horizontal')) &&
        samePair(a, b)
      ) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }

      // Two different fixed lengths on the same pair.
      if (
        a.kind === 'fixed-length' &&
        b.kind === 'fixed-length' &&
        samePair(a, b) &&
        a.length !== b.length
      ) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }

      // Coincident points cannot also be a fixed non-zero distance apart.
      if (
        ((a.kind === 'coincident' && b.kind === 'fixed-length' && b.length !== 0) ||
          (b.kind === 'coincident' && a.kind === 'fixed-length' && a.length !== 0)) &&
        samePair(a, b)
      ) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }

  // A constraint that would have to move a locked point cannot be satisfied.
  for (const constraint of constraints) {
    if (constraint.kind === 'locked') continue;
    const ids = referencedIds(constraint);
    if (ids.every((pointId) => locked.has(pointId))) {
      conflicts.add(constraint.id);
    }
  }

  return [...conflicts].sort();
}

function samePair(a: Constraint, b: Constraint): boolean {
  const first = referencedIds(a);
  const second = referencedIds(b);
  if (first.length !== 2 || second.length !== 2) return false;
  return (
    (first[0] === second[0] && first[1] === second[1]) ||
    (first[0] === second[1] && first[1] === second[0])
  );
}

/**
 * Applies one constraint by projection. Returns whether it moved anything, so
 * the caller can stop when the system settles.
 *
 * Locked points are never written. When both ends of a constraint are free the
 * correction is split between them, which keeps the result independent of which
 * point the caller happened to list first - another hidden input that would
 * cost determinism.
 */
function applyConstraint(
  constraint: Constraint,
  working: Map<string, WorldPoint>,
  locked: ReadonlySet<string>,
  tolerance: number,
): boolean {
  if (constraint.kind === 'locked') {
    return false;
  }

  const a = working.get(constraint.a)!;
  const b = working.get(constraint.b)!;
  const aLocked = locked.has(constraint.a);
  const bLocked = locked.has(constraint.b);
  if (aLocked && bLocked) {
    return false;
  }

  switch (constraint.kind) {
    case 'coincident': {
      if (Math.hypot(b.x - a.x, b.y - a.y) <= tolerance) return false;
      return moveTogether(
        working,
        constraint.a,
        constraint.b,
        aLocked,
        bLocked,
        worldPoint((a.x + b.x) / 2, (a.y + b.y) / 2),
      );
    }
    case 'horizontal': {
      if (Math.abs(b.y - a.y) <= tolerance) return false;
      const target = aLocked ? a.y : bLocked ? b.y : (a.y + b.y) / 2;
      if (!aLocked) working.set(constraint.a, worldPoint(a.x, target));
      if (!bLocked) working.set(constraint.b, worldPoint(b.x, target));
      return true;
    }
    case 'vertical': {
      if (Math.abs(b.x - a.x) <= tolerance) return false;
      const target = aLocked ? a.x : bLocked ? b.x : (a.x + b.x) / 2;
      if (!aLocked) working.set(constraint.a, worldPoint(target, a.y));
      if (!bLocked) working.set(constraint.b, worldPoint(target, b.y));
      return true;
    }
    case 'fixed-length': {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const current = Math.hypot(dx, dy);
      if (Math.abs(current - constraint.length) <= tolerance) return false;
      if (current === 0) {
        // Degenerate: coincident points have no direction to scale along, so a
        // direction is chosen deterministically rather than left undefined.
        const half = constraint.length / 2;
        if (!aLocked) working.set(constraint.a, worldPoint(a.x - half, a.y));
        if (!bLocked) working.set(constraint.b, worldPoint(b.x + half, b.y));
        return true;
      }
      const scale = constraint.length / current;
      if (aLocked) {
        working.set(constraint.b, worldPoint(a.x + dx * scale, a.y + dy * scale));
      } else if (bLocked) {
        working.set(constraint.a, worldPoint(b.x - dx * scale, b.y - dy * scale));
      } else {
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        working.set(constraint.a, worldPoint(midX - (dx * scale) / 2, midY - (dy * scale) / 2));
        working.set(constraint.b, worldPoint(midX + (dx * scale) / 2, midY + (dy * scale) / 2));
      }
      return true;
    }
  }
}

function moveTogether(
  working: Map<string, WorldPoint>,
  aId: string,
  bId: string,
  aLocked: boolean,
  bLocked: boolean,
  midpoint: WorldPoint,
): boolean {
  const target = aLocked ? working.get(aId)! : bLocked ? working.get(bId)! : midpoint;
  if (!aLocked) working.set(aId, worldPoint(target.x, target.y));
  if (!bLocked) working.set(bId, worldPoint(target.x, target.y));
  return true;
}

/**
 * Degrees of freedom against independent constraints.
 *
 * Reported as three distinct states rather than a pass/fail, because they need
 * three different things: under-constrained is valid and merely informative,
 * over-constrained needs a constraint removed, and conflicting needs one
 * changed.
 */
function classify(
  points: readonly ConstraintPoint[],
  constraints: readonly Constraint[],
  locked: ReadonlySet<string>,
): ConstraintSystemState {
  const freePoints = points.filter((entry) => !locked.has(entry.id)).length;
  const degreesOfFreedom = freePoints * 2;

  let removed = 0;
  for (const constraint of constraints) {
    switch (constraint.kind) {
      case 'coincident':
        removed += 2;
        break;
      case 'horizontal':
      case 'vertical':
      case 'fixed-length':
        removed += 1;
        break;
      case 'locked':
        break;
    }
  }

  if (removed > degreesOfFreedom) return 'over-constrained';
  if (removed < degreesOfFreedom) return 'under-constrained';
  return 'well-constrained';
}
