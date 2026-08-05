import { GenerationGuard, type GenerationToken } from './generation-guard';

/**
 * V3-122: 3D is derived from the semantic model. V3-124: a stale result is
 * refused rather than adopted.
 *
 * `geometry-3d` can already extrude a wall and cut its openings. What was not
 * written down is the rule those functions exist under, and it is the one that
 * decides whether the model stays trustworthy: **derived geometry is never a
 * source of truth**. A mesh is a consequence of a wall's type, its endpoints,
 * its level and its openings, and if any of those change the mesh is wrong -
 * not stale-but-usable, wrong. Nothing may read a dimension, an area, a
 * quantity or a clash from a mesh, because the mesh is a lossy tessellation of
 * something the model already knows exactly.
 *
 * That has a consequence people find inconvenient, which is why it needs
 * stating: an edit made to a mesh cannot be saved. There is nowhere for it to
 * go. `derivationInputsOf` names every semantic input a mesh depends on, so a
 * regeneration produces the same mesh and a change to any of them is detectable
 * without comparing geometry.
 *
 * V3-124 is the other half. Meshing happens off the main thread and takes long
 * enough that the model moves underneath it. A result arriving for a wall that
 * has since been edited describes a wall that no longer exists, and adopting it
 * puts the user's screen a revision behind their model - which they discover by
 * seeing a wall they already moved. `GenerationGuard` tracks which request is
 * current; this pairs a result with its token so accepting one without checking
 * is not something a caller can do by forgetting.
 */

/**
 * Everything a mesh depends on.
 *
 * Named rather than hashed from the whole element, so a change to a property no
 * mesh reads - a name, a mark, a comment - does not force a re-mesh. That is
 * the same bound `effect-invalidation.ts` applies to the invalidation side,
 * applied here to the regeneration side, and the two have to agree or a mesh
 * gets invalidated and then regenerated identically.
 */
export interface DerivationInputs {
  readonly elementId: string;
  readonly category: string;
  /** The semantic revision these inputs were read at. */
  readonly revision: number;
  /** The property values the mesh actually consumes, in a stable order. */
  readonly inputs: Readonly<Record<string, string | number | boolean>>;
  /** The mesher's own version, so an algorithm change invalidates every mesh it produced. */
  readonly engineVersion: string;
}

/**
 * A stable key for a derivation.
 *
 * Keys are sorted so the same inputs in a different insertion order produce the
 * same key: a cache keyed on object iteration order misses constantly and
 * nobody notices, because a miss is only slow rather than wrong.
 */
export function derivationKey(inputs: DerivationInputs): string {
  const entries = Object.entries(inputs.inputs)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');
  return `${inputs.engineVersion}|${inputs.category}|${inputs.elementId}|${entries}`;
}

/**
 * Whether two derivations describe the same mesh.
 *
 * Deliberately excludes the revision. A wall whose name changed at revision 13
 * has the same geometry it had at revision 12, and re-meshing it because a
 * number moved is exactly the waste this contract exists to avoid.
 */
export function derivationsMatch(a: DerivationInputs, b: DerivationInputs): boolean {
  return derivationKey(a) === derivationKey(b);
}

export const DERIVED_GEOMETRY_REFUSALS = {
  staleGeneration: 'ARQ_GEOMETRY_STALE_GENERATION',
  inputsChanged: 'ARQ_GEOMETRY_INPUTS_CHANGED',
  engineChanged: 'ARQ_GEOMETRY_ENGINE_CHANGED',
} as const;

export type DerivedGeometryRefusal =
  (typeof DERIVED_GEOMETRY_REFUSALS)[keyof typeof DERIVED_GEOMETRY_REFUSALS];

export interface GeometryResult<TMesh> {
  readonly token: GenerationToken;
  readonly inputs: DerivationInputs;
  readonly mesh: TMesh;
}

export type GeometryAcceptance<TMesh> =
  | { readonly status: 'accepted'; readonly mesh: TMesh; readonly key: string }
  | { readonly status: 'refused'; readonly code: DerivedGeometryRefusal; readonly detail: string };

/**
 * Decides whether a returned mesh may be shown.
 *
 * Both checks are needed and neither implies the other. The generation token
 * catches a result for a request that has been superseded; the input comparison
 * catches a result computed from inputs that changed even though no new request
 * was issued for them - which happens when a change arrives from sync or from
 * an undo while a mesh is in flight.
 *
 * Refusing costs a re-mesh. Accepting costs the user's trust in what they are
 * looking at, and they find out by seeing a wall they already moved.
 */
export function acceptGeometryResult<TMesh>(
  guard: GenerationGuard,
  result: GeometryResult<TMesh>,
  currentInputs: DerivationInputs,
): GeometryAcceptance<TMesh> {
  if (!guard.isCurrent(result.token)) {
    return {
      status: 'refused',
      code: DERIVED_GEOMETRY_REFUSALS.staleGeneration,
      detail: `a newer request for ${result.token.target} superseded this one`,
    };
  }

  if (result.inputs.engineVersion !== currentInputs.engineVersion) {
    return {
      status: 'refused',
      code: DERIVED_GEOMETRY_REFUSALS.engineChanged,
      detail: `computed by engine ${result.inputs.engineVersion}, now on ${currentInputs.engineVersion}`,
    };
  }

  if (!derivationsMatch(result.inputs, currentInputs)) {
    return {
      status: 'refused',
      code: DERIVED_GEOMETRY_REFUSALS.inputsChanged,
      detail: `${result.inputs.elementId} changed while its mesh was being built`,
    };
  }

  return { status: 'accepted', mesh: result.mesh, key: derivationKey(currentInputs) };
}

/**
 * Whether anything may read a measurement from derived geometry.
 *
 * Always false. A mesh is a lossy tessellation of something the model knows
 * exactly, so a length taken from it is an approximation presented as a
 * measurement - and it will be the number that ends up on a drawing, because it
 * is the one that was easy to reach. Written as a function so a change of mind
 * has to delete it.
 */
export function meshIsMeasurable(): false {
  return false;
}

/**
 * Whether a mesh edit can be saved.
 *
 * Always false, for the same reason. There is nowhere for it to go: the mesh is
 * regenerated from the semantic model on the next change, so an edit made to it
 * survives exactly until something else moves.
 */
export function meshEditIsPersistable(): false {
  return false;
}

/**
 * Starts a derivation and returns the token its result must carry.
 *
 * The token comes from here rather than being constructed by the caller, so a
 * result cannot be accepted with a token nobody issued.
 */
export function beginDerivation(guard: GenerationGuard, inputs: DerivationInputs): GenerationToken {
  return guard.begin(derivationKey(inputs));
}
