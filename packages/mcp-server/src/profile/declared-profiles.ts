/**
 * Domains Arq understands well enough to specify and does not execute.
 *
 * This is the file that answers "design me a fictional VTOL aircraft"
 * honestly. The reviewed 2.0 package answered it with a capability feature
 * flagged `unavailable` and a sentence of prose, which tells an assistant
 * that something is missing but not what, so the next move is either to
 * give up or to substitute an architecture operation and call a fuselage a
 * wall. Neither is acceptable.
 *
 * A declared profile makes the negative answer productive. It names the
 * operations such a request would need, what each would have to validate,
 * what it would invalidate, and the specific decisions and implementations
 * standing between the specification and a runtime that could run it. An
 * assistant that asks for `vehicle.fuselage.create` gets back the profile
 * that owns it, its status, and its blocker list, and can put all of that
 * into the design program as a reviewable plan.
 *
 * Nothing here is ever offered to a change set. `executableOperations`
 * returns an empty list for any profile that is not registered, and the
 * registry never merges these operations into the catalogue a proposal is
 * validated against. Their evidence states say `blocked` for the same
 * reason: a specification is not an implementation, and this package must
 * never let the two look alike.
 */

import type { DomainProfile, OperationDefinition } from './domain-profile';

const VEHICLE_BLOCKERS: readonly string[] = [
  'No accepted product decision that Arq authors non-architectural domains. ADR-0002 commits to a plan-first semantic building model.',
  'No semantic model extension for vehicle assemblies, so there is no stable identity, hosting or relationship contract for a fuselage, cabin or landing assembly.',
  'No parametric surface or solid representation. The geometry packages are planar by decision (ADR-0007) with an OpenCascade boundary (ADR-0009) that no operation crosses today.',
  'No native file schema, migration or recovery plan for vehicle entities, so a project containing them could not be opened by a build that lacks the profile.',
  'No validation rules, tolerance policy or adversarial fixtures for assembly geometry.',
  'No renderer, selection, snapping or direct-manipulation behaviour for three-dimensional assemblies.',
  'No named owner or evidence plan, which the profile contract requires before registration.',
];

function declaredOperation(
  operationType: string,
  title: string,
  description: string,
  wouldValidate: string,
  invalidations: readonly string[],
): OperationDefinition {
  return {
    operationType,
    operationVersion: '0.0.0',
    title,
    description,
    arqScriptCommand: 'none',
    // A declared operation carries no argument schema. Publishing one
    // would invite a client to construct arguments for an operation that
    // cannot be staged, and a well-formed call to a non-existent operation
    // is more misleading than a malformed one.
    argumentsSchema: {
      type: 'null',
      description:
        'This operation is specified, not implemented. It has no argument contract until the profile is registered.',
    },
    approvalClass: 'project_review',
    consequential: true,
    destructive: false,
    allowedProjectStates: ['editable'],
    requiredScopes: ['arq.changes.stage'],
    knownInvalidations: invalidations,
    previewKinds: [],
    undoBehaviour: 'grouped_only',
    deprecated: false,
    evidence: {
      state: 'blocked',
      summary: `${wouldValidate} None of this is implemented; the entry exists so a request for this capability produces a specification rather than a substitution.`,
      sources: [
        'docs/adr/0002-plan-first-semantic-model.md',
        'docs/adr/0007-purpose-built-planar-geometry.md',
      ],
    },
  };
}

/**
 * The vehicle concept profile.
 *
 * Named `vehicle.concept` rather than `vehicle` on purpose: even if it were
 * registered, what it could produce is a concept assembly, not an
 * engineering model. Structural, propulsion, aerodynamic, regulatory and
 * airworthiness work belongs to qualified tools and qualified people, and
 * no catalogue entry in Arq should be readable as a claim otherwise.
 */
export const VEHICLE_CONCEPT_PROFILE: DomainProfile = {
  profileId: 'vehicle.concept',
  profileVersion: '0.1.0',
  title: 'Vehicle concept (specified, not implemented)',
  description:
    'A specification for concept-level vehicle assemblies: airframe, cabin volume, landing arrangement and their interfaces. Arq cannot execute any of it today. A design program can describe such a vehicle in full; only a registered profile could turn that description into project geometry.',
  owner: 'unassigned',
  status: 'declared_unregistered',
  registrationBlockers: VEHICLE_BLOCKERS,
  semanticKinds: [
    'vehicle.assembly',
    'vehicle.fuselage',
    'vehicle.cabin',
    'vehicle.landing_gear',
    'vehicle.surface',
  ],
  derivedOutputs: ['assembly-tree', 'mass-summary', 'presentation-view', 'mesh-3d'],
  operations: [
    declaredOperation(
      'vehicle.concept.fuselage.create',
      'Create airframe',
      'Would create a top-level airframe body with stable identity and a coordinate frame the rest of the assembly hangs from.',
      'Would need to validate stable component identity, parent relationship, dimensional bounds and coordinate constraints.',
      ['assembly-tree', 'mesh-3d'],
    ),
    declaredOperation(
      'vehicle.concept.cabin.create',
      'Create cabin volume',
      'Would create a hosted cabin volume inside an airframe.',
      'Would need a hosting relation, a containment rule, and an invalidation contract for anything derived from the enclosing body.',
      ['assembly-tree', 'mass-summary', 'mesh-3d'],
    ),
    declaredOperation(
      'vehicle.concept.landing_gear.create',
      'Create landing arrangement',
      'Would attach a landing assembly at a declared interface.',
      'Would need an interface relation, allowed attachment conditions and a preview a reviewer could judge.',
      ['assembly-tree', 'mesh-3d'],
    ),
    declaredOperation(
      'vehicle.concept.surface.create',
      'Create surface',
      'Would create a parametric or boundary-represented surface.',
      'Would need a representation contract, a tolerance policy, deterministic serialisation and a repairable failure mode.',
      ['mesh-3d', 'presentation-view'],
    ),
    declaredOperation(
      'vehicle.concept.assembly.attach',
      'Attach assembly',
      'Would attach one assembly to another under a constraint.',
      'Would need cycle rejection, constraint solving, multi-view identity and grouped undo.',
      ['assembly-tree', 'mass-summary'],
    ),
  ],
  // Empty on purpose: an operation nothing can stage has no argument
  // contract to check against, and publishing one would invite a client to
  // build a well-formed call to something that does not exist.
  argumentValidators: {},
  fileImpact: {
    nativeSchemaChange: true,
    migrationRequired: true,
    notes:
      'Registering this profile would add semantic entities to the native schema. A project written with it could not be opened by a build without it, so it needs a compatibility window and a downgrade decision before any operation is implemented.',
  },
  evidence: {
    state: 'blocked',
    summary:
      'Nothing in this profile is implemented or decided. It exists so that a request Arq cannot serve produces a named profile, a named operation set and a named blocker list.',
    sources: ['docs/adr/0002-plan-first-semantic-model.md', 'STATUS.md'],
  },
};

export const DECLARED_PROFILES: readonly DomainProfile[] = [VEHICLE_CONCEPT_PROFILE];
