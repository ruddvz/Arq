import { describe, expect, it } from 'vitest';
import { GenerationGuard } from './generation-guard';
import {
  DERIVED_GEOMETRY_REFUSALS,
  acceptGeometryResult,
  beginDerivation,
  derivationKey,
  derivationsMatch,
  meshEditIsPersistable,
  meshIsMeasurable,
  type DerivationInputs,
} from './derived-geometry-contract';

function inputs(overrides: Partial<DerivationInputs> = {}): DerivationInputs {
  return {
    elementId: 'wall-1',
    category: 'Wall',
    revision: 12,
    inputs: { startX: 0, startY: 0, endX: 5000, endY: 0, thickness: 200, height: 2400 },
    engineVersion: 'mesher-1.2.0',
    ...overrides,
  };
}

describe('derivationKey', () => {
  it('is stable across property insertion order', () => {
    // A cache keyed on object iteration order misses constantly and nobody
    // notices, because a miss is only slow rather than wrong.
    const a = inputs({ inputs: { startX: 0, endX: 5000 } });
    const b = inputs({ inputs: { endX: 5000, startX: 0 } });

    expect(derivationKey(a)).toBe(derivationKey(b));
  });

  it('changes when a consumed input changes', () => {
    expect(derivationKey(inputs())).not.toBe(
      derivationKey(inputs({ inputs: { ...inputs().inputs, thickness: 300 } })),
    );
  });

  it('changes when the mesher version changes', () => {
    // An algorithm change invalidates every mesh it produced.
    expect(derivationKey(inputs())).not.toBe(
      derivationKey(inputs({ engineVersion: 'mesher-1.3.0' })),
    );
  });
});

describe('derivationsMatch', () => {
  it('ignores the revision', () => {
    // A wall whose name changed at revision 13 has the geometry it had at 12,
    // and re-meshing because a number moved is the waste this avoids.
    expect(derivationsMatch(inputs({ revision: 12 }), inputs({ revision: 13 }))).toBe(true);
  });

  it('notices a geometric change', () => {
    expect(derivationsMatch(inputs(), inputs({ inputs: { ...inputs().inputs, endX: 6000 } }))).toBe(
      false,
    );
  });
});

describe('acceptGeometryResult', () => {
  it('accepts a current result computed from the current inputs', () => {
    const guard = new GenerationGuard();
    const current = inputs();
    const token = beginDerivation(guard, current);

    const acceptance = acceptGeometryResult(
      guard,
      { token, inputs: current, mesh: 'mesh' },
      current,
    );

    expect(acceptance.status).toBe('accepted');
    if (acceptance.status !== 'accepted') return;
    expect(acceptance.mesh).toBe('mesh');
  });

  it('refuses a result whose request was superseded', () => {
    // The user discovers an adopted stale mesh by seeing a wall they already
    // moved.
    const guard = new GenerationGuard();
    const current = inputs();
    const first = beginDerivation(guard, current);
    beginDerivation(guard, current);

    const acceptance = acceptGeometryResult(
      guard,
      { token: first, inputs: current, mesh: 'a' },
      current,
    );

    expect(acceptance.status).toBe('refused');
    if (acceptance.status !== 'refused') return;
    expect(acceptance.code).toBe(DERIVED_GEOMETRY_REFUSALS.staleGeneration);
  });

  it('refuses a result whose inputs changed even though no new request was issued', () => {
    // A change arriving from sync or from an undo while a mesh is in flight
    // does not go through the request path.
    const guard = new GenerationGuard();
    const at12 = inputs();
    const token = beginDerivation(guard, at12);
    const at13 = inputs({ revision: 13, inputs: { ...at12.inputs, endX: 6000 } });

    const acceptance = acceptGeometryResult(guard, { token, inputs: at12, mesh: 'a' }, at13);

    expect(acceptance.status).toBe('refused');
    if (acceptance.status !== 'refused') return;
    expect(acceptance.code).toBe(DERIVED_GEOMETRY_REFUSALS.inputsChanged);
  });

  it('refuses a result from a superseded mesher version', () => {
    const guard = new GenerationGuard();
    const old = inputs();
    const token = beginDerivation(guard, old);

    const acceptance = acceptGeometryResult(
      guard,
      { token, inputs: old, mesh: 'a' },
      inputs({ engineVersion: 'mesher-2.0.0' }),
    );

    expect(acceptance.status).toBe('refused');
    if (acceptance.status !== 'refused') return;
    expect(acceptance.code).toBe(DERIVED_GEOMETRY_REFUSALS.engineChanged);
  });

  it('accepts a result when only the revision moved', () => {
    // Refusing here would re-mesh a building because a room was renamed.
    const guard = new GenerationGuard();
    const at12 = inputs();
    const token = beginDerivation(guard, at12);

    const acceptance = acceptGeometryResult(
      guard,
      { token, inputs: at12, mesh: 'a' },
      inputs({ revision: 13 }),
    );

    expect(acceptance.status).toBe('accepted');
  });

  it('checks the generation before the inputs, so a superseded request reports as superseded', () => {
    const guard = new GenerationGuard();
    const at12 = inputs();
    const first = beginDerivation(guard, at12);
    beginDerivation(guard, at12);

    const acceptance = acceptGeometryResult(
      guard,
      { token: first, inputs: at12, mesh: 'a' },
      inputs({ inputs: { ...at12.inputs, endX: 9000 } }),
    );

    expect(acceptance.status).toBe('refused');
    if (acceptance.status !== 'refused') return;
    expect(acceptance.code).toBe(DERIVED_GEOMETRY_REFUSALS.staleGeneration);
  });

  it('cannot be satisfied by a token nobody issued', () => {
    const guard = new GenerationGuard();
    const current = inputs();

    const acceptance = acceptGeometryResult(
      guard,
      { token: { target: derivationKey(current), generation: 99 }, inputs: current, mesh: 'a' },
      current,
    );

    expect(acceptance.status).toBe('refused');
  });
});

describe('derived geometry is never a source of truth', () => {
  it('refuses to be measured', () => {
    // A length taken from a tessellation is an approximation presented as a
    // measurement, and it is the number that reaches a drawing because it was
    // easy to reach.
    expect(meshIsMeasurable()).toBe(false);
    expect(meshIsMeasurable.length).toBe(0);
  });

  it('refuses to persist an edit', () => {
    // There is nowhere for it to go: the mesh is regenerated on the next
    // change, so the edit survives until something else moves.
    expect(meshEditIsPersistable()).toBe(false);
    expect(meshEditIsPersistable.length).toBe(0);
  });
});
