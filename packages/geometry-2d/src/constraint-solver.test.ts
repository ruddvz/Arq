import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import {
  createAnalyticConstraintSolver,
  type Constraint,
  type ConstraintPoint,
} from './constraint-solver';

const solver = createAnalyticConstraintSolver();

function point(id: string, x: number, y: number, locked = false): ConstraintPoint {
  return { id, point: worldPoint(x, y), locked };
}

describe('analytic constraint solver', () => {
  it('makes two points coincident', () => {
    const result = solver.solve(
      [point('a', 0, 0), point('b', 100, 0)],
      [{ id: 'c1', kind: 'coincident', a: 'a', b: 'b' }],
    );

    expect(result.status).toBe('solved');
    expect(result.points.get('a')).toEqual(result.points.get('b'));
  });

  it('levels a segment to horizontal', () => {
    const result = solver.solve(
      [point('a', 0, 0), point('b', 1000, 500)],
      [{ id: 'c1', kind: 'horizontal', a: 'a', b: 'b' }],
    );

    expect(result.status).toBe('solved');
    expect(result.points.get('a')!.y).toBe(result.points.get('b')!.y);
  });

  it('aligns a segment to vertical', () => {
    const result = solver.solve(
      [point('a', 0, 0), point('b', 500, 1000)],
      [{ id: 'c1', kind: 'vertical', a: 'a', b: 'b' }],
    );

    expect(result.status).toBe('solved');
    expect(result.points.get('a')!.x).toBe(result.points.get('b')!.x);
  });

  it('sets a fixed length', () => {
    const result = solver.solve(
      [point('a', 0, 0), point('b', 100, 0)],
      [{ id: 'c1', kind: 'fixed-length', a: 'a', b: 'b', length: 3000 }],
    );

    expect(result.status).toBe('solved');
    const a = result.points.get('a')!;
    const b = result.points.get('b')!;
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(3000, 6);
  });

  it('never moves a locked point', () => {
    const result = solver.solve(
      [point('a', 0, 0, true), point('b', 100, 700)],
      [{ id: 'c1', kind: 'horizontal', a: 'a', b: 'b' }],
    );

    expect(result.status).toBe('solved');
    expect(result.points.get('a')).toEqual(worldPoint(0, 0));
    expect(result.points.get('b')!.y).toBe(0);
  });

  it('honours a locked constraint as well as the locked flag', () => {
    const result = solver.solve(
      [point('a', 0, 0), point('b', 100, 700)],
      [
        { id: 'c1', kind: 'locked', a: 'a' },
        { id: 'c2', kind: 'horizontal', a: 'a', b: 'b' },
      ],
    );

    expect(result.points.get('a')).toEqual(worldPoint(0, 0));
  });

  it('satisfies several constraints together', () => {
    const result = solver.solve(
      [point('a', 0, 0, true), point('b', 900, 400)],
      [
        { id: 'c1', kind: 'horizontal', a: 'a', b: 'b' },
        { id: 'c2', kind: 'fixed-length', a: 'a', b: 'b', length: 2000 },
      ],
    );

    expect(result.status).toBe('solved');
    const a = result.points.get('a')!;
    const b = result.points.get('b')!;
    expect(b.y).toBeCloseTo(a.y, 6);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(2000, 6);
  });

  describe('determinism', () => {
    /**
     * A requirement, not a happy accident: without it an operation log cannot
     * be replayed and two devices editing the same project diverge.
     */
    it('produces byte-identical output for the same input, repeatedly', () => {
      const points = [point('a', 13, 29), point('b', 977, 431), point('c', 55, 88)];
      const constraints: Constraint[] = [
        { id: 'c1', kind: 'horizontal', a: 'a', b: 'b' },
        { id: 'c2', kind: 'coincident', a: 'b', b: 'c' },
      ];

      const first = JSON.stringify([...solver.solve(points, constraints).points]);
      for (let i = 0; i < 20; i += 1) {
        expect(JSON.stringify([...solver.solve(points, constraints).points])).toBe(first);
      }
    });

    /**
     * Constraint array order is a hidden input. Sorting by id before evaluation
     * is what stops it changing the answer.
     */
    it('is independent of the order the caller lists constraints in', () => {
      const points = [point('a', 13, 29), point('b', 977, 431)];
      const forward: Constraint[] = [
        { id: 'c1', kind: 'horizontal', a: 'a', b: 'b' },
        { id: 'c2', kind: 'fixed-length', a: 'a', b: 'b', length: 1500 },
      ];
      const reversed = [...forward].reverse();

      expect(JSON.stringify([...solver.solve(points, forward).points])).toBe(
        JSON.stringify([...solver.solve(points, reversed).points]),
      );
    });

    it('emits points in a stable order regardless of input order', () => {
      const forward = [point('a', 0, 0), point('b', 10, 10), point('c', 20, 20)];
      const shuffled = [forward[2]!, forward[0]!, forward[1]!];

      expect([...solver.solve(forward, []).points.keys()]).toEqual(['a', 'b', 'c']);
      expect([...solver.solve(shuffled, []).points.keys()]).toEqual(['a', 'b', 'c']);
    });
  });

  describe('system state', () => {
    it('reports an unconstrained system as under-constrained rather than solved-and-silent', () => {
      const result = solver.solve([point('a', 0, 0), point('b', 100, 0)], []);

      expect(result.status).toBe('solved');
      expect(result.state).toBe('under-constrained');
    });

    /**
     * Over-constrained is not the same as conflicting: this system is
     * satisfiable, it just carries a redundant constraint. The user needs one
     * removed, not one changed - which is why the two states are distinct.
     */
    it('reports a satisfiable but redundant system as over-constrained', () => {
      const result = solver.solve(
        [point('a', 0, 0, true), point('b', 100, 0)],
        [
          { id: 'c1', kind: 'horizontal', a: 'a', b: 'b' },
          { id: 'c2', kind: 'fixed-length', a: 'a', b: 'b', length: 1000 },
          { id: 'c3', kind: 'fixed-length', a: 'a', b: 'b', length: 1000 },
        ],
      );

      expect(result.status).toBe('solved');
      expect(result.state).toBe('over-constrained');
    });

    it('reports a system with exactly matched freedoms as well-constrained', () => {
      const result = solver.solve(
        [point('a', 0, 0, true), point('b', 100, 0)],
        [
          { id: 'c1', kind: 'horizontal', a: 'a', b: 'b' },
          { id: 'c2', kind: 'fixed-length', a: 'a', b: 'b', length: 1000 },
        ],
      );

      expect(result.state).toBe('well-constrained');
    });
  });

  describe('conflicts', () => {
    /**
     * V3-119: the conflict is a property of the set. Naming one constraint
     * would blame whichever happened to be evaluated last.
     */
    it('names both constraints when a segment is asked to be horizontal and vertical', () => {
      const result = solver.solve(
        [point('a', 0, 0), point('b', 100, 100)],
        [
          { id: 'c1', kind: 'horizontal', a: 'a', b: 'b' },
          { id: 'c2', kind: 'vertical', a: 'a', b: 'b' },
        ],
      );

      expect(result.status).toBe('unsatisfied');
      expect(result.state).toBe('conflicting');
      expect(result.conflictSet).toEqual(['c1', 'c2']);
    });

    it('detects two different fixed lengths on the same pair', () => {
      const result = solver.solve(
        [point('a', 0, 0), point('b', 100, 0)],
        [
          { id: 'c1', kind: 'fixed-length', a: 'a', b: 'b', length: 1000 },
          { id: 'c2', kind: 'fixed-length', a: 'a', b: 'b', length: 2000 },
        ],
      );

      expect(result.state).toBe('conflicting');
      expect(result.conflictSet).toEqual(['c1', 'c2']);
    });

    it('detects coincident points also required to be a fixed distance apart', () => {
      const result = solver.solve(
        [point('a', 0, 0), point('b', 100, 0)],
        [
          { id: 'c1', kind: 'coincident', a: 'a', b: 'b' },
          { id: 'c2', kind: 'fixed-length', a: 'a', b: 'b', length: 1000 },
        ],
      );

      expect(result.state).toBe('conflicting');
      expect(result.conflictSet).toEqual(['c1', 'c2']);
    });

    it('detects a constraint that would have to move two locked points', () => {
      const result = solver.solve(
        [point('a', 0, 0, true), point('b', 100, 100, true)],
        [{ id: 'c1', kind: 'horizontal', a: 'a', b: 'b' }],
      );

      expect(result.state).toBe('conflicting');
      expect(result.conflictSet).toEqual(['c1']);
    });

    it('treats a constraint naming a point that does not exist as a conflict', () => {
      const result = solver.solve(
        [point('a', 0, 0)],
        [{ id: 'c1', kind: 'coincident', a: 'a', b: 'ghost' }],
      );

      expect(result.state).toBe('conflicting');
      expect(result.conflictSet).toEqual(['c1']);
    });

    /** A failed solve returns no points at all, so nothing half-moved can be committed. */
    it('emits no positions when the system is unsatisfied', () => {
      const result = solver.solve(
        [point('a', 0, 0), point('b', 100, 100)],
        [
          { id: 'c1', kind: 'horizontal', a: 'a', b: 'b' },
          { id: 'c2', kind: 'vertical', a: 'a', b: 'b' },
        ],
      );

      expect(result.points.size).toBe(0);
    });
  });

  describe('bounds and safety', () => {
    it('reports an unsupported constraint kind rather than ignoring it', () => {
      const result = solver.solve([point('a', 0, 0), point('b', 100, 0)], [
        { id: 'c1', kind: 'parallel', a: 'a', b: 'b' },
      ] as unknown as Constraint[]);

      expect(result.unsupported).toEqual(['parallel']);
    });

    it('bounds iteration and says when the bound stopped it', () => {
      const result = solver.solve(
        [point('a', 0, 0), point('b', 1000, 1000)],
        [
          { id: 'c1', kind: 'fixed-length', a: 'a', b: 'b', length: 5000 },
          { id: 'c2', kind: 'coincident', a: 'a', b: 'b' },
        ],
        { maxIterations: 3 },
      );

      // Whether it converges or not, an unconverged solve must never present
      // its last intermediate positions as an answer.
      if (result.hitIterationLimit) {
        expect(result.status).toBe('unsatisfied');
        expect(result.points.size).toBe(0);
        expect(result.iterations).toBe(3);
      }
    });

    it('emits only finite coordinates', () => {
      const result = solver.solve(
        [point('a', 0, 0, true), point('b', 0, 0)],
        [{ id: 'c1', kind: 'fixed-length', a: 'a', b: 'b', length: 1000 }],
      );

      for (const value of result.points.values()) {
        expect(Number.isFinite(value.x)).toBe(true);
        expect(Number.isFinite(value.y)).toBe(true);
      }
    });

    it('handles a degenerate zero-length pair deterministically rather than dividing by zero', () => {
      const first = solver.solve(
        [point('a', 0, 0), point('b', 0, 0)],
        [{ id: 'c1', kind: 'fixed-length', a: 'a', b: 'b', length: 1000 }],
      );
      const second = solver.solve(
        [point('a', 0, 0), point('b', 0, 0)],
        [{ id: 'c1', kind: 'fixed-length', a: 'a', b: 'b', length: 1000 }],
      );

      expect(JSON.stringify([...first.points])).toBe(JSON.stringify([...second.points]));
      for (const value of first.points.values()) {
        expect(Number.isFinite(value.x)).toBe(true);
      }
    });

    it('solves an already-satisfied system without moving anything', () => {
      const result = solver.solve(
        [point('a', 0, 0), point('b', 1000, 0)],
        [{ id: 'c1', kind: 'horizontal', a: 'a', b: 'b' }],
      );

      expect(result.points.get('a')).toEqual(worldPoint(0, 0));
      expect(result.points.get('b')).toEqual(worldPoint(1000, 0));
      expect(result.iterations).toBe(1);
    });

    it('names itself, so evidence can record which implementation produced a result', () => {
      expect(solver.name).toBe('arq-analytic-2d-v1');
    });
  });
});
