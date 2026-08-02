/**
 * The change set: a revision-bound list of typed operations, and nothing
 * else.
 *
 * A change set is the only shape in which a model may ask for a project to
 * change, and it is a request, not a change. It names the exact revision it
 * was built against, so a project that moved underneath it is a detectable
 * conflict rather than a silent overwrite. It names operations by
 * registered type and version, so an operation the catalogue does not
 * contain cannot be smuggled through as free-form data. And it may carry
 * preconditions, which are the caller's own statement of what it believed
 * to be true - checked at staging and checked again before any commit,
 * because the interesting failure is the one that appears between the two.
 *
 * `preconditions` in the reviewed 2.0 package was `{ kind, subject,
 * expected: unknown }` with only one kind actually implemented and any
 * other kind rejected at validation time. An open `unknown` for the
 * expected value means neither the schema nor the client can say what a
 * precondition asserts. Here each kind is its own closed shape, so a
 * precondition is checkable before it reaches the runtime and a client can
 * see from the schema exactly which ones exist.
 */

import { boundedText, opaqueId, operationTypeName, semanticVersion } from '../schema/identifiers';
import {
  arrayValue,
  integerValue,
  jsonValue,
  literalValue,
  objectValue,
  recordValue,
  refine,
  taggedUnion,
  type Infer,
} from '../schema/schema';
import { FIELD_NAME_PATTERN } from '../schema/identifiers';
import { ARQ_MCP_LIMITS, ARQ_MCP_TEXT_LIMITS } from './limits';

export const PRECONDITION_KINDS = [
  'project.revision_equals',
  'element.exists',
  'element.absent',
  'element.version_equals',
] as const;

export type PreconditionKind = (typeof PRECONDITION_KINDS)[number];

export const preconditionInput = taggedUnion(
  'kind',
  {
    'project.revision_equals': objectValue({
      required: {
        kind: literalValue('project.revision_equals'),
        revision: opaqueId('The revision the caller believes the project is at.'),
      },
      title: 'Project revision precondition',
    }),
    'element.exists': objectValue({
      required: {
        kind: literalValue('element.exists'),
        elementId: opaqueId('An element the caller believes is present.'),
      },
      title: 'Element exists precondition',
    }),
    'element.absent': objectValue({
      required: {
        kind: literalValue('element.absent'),
        elementId: opaqueId('An identifier the caller believes is free.'),
      },
      title: 'Element absent precondition',
    }),
    'element.version_equals': objectValue({
      required: {
        kind: literalValue('element.version_equals'),
        elementId: opaqueId(),
        version: integerValue({
          minimum: 0,
          description: 'The element version the caller read.',
        }),
      },
      title: 'Element version precondition',
    }),
  },
  'A statement the caller believes true. Checked when the change set is staged and again before any commit.',
);

export type PreconditionInput = Infer<typeof preconditionInput>;

export const proposedOperationInput = objectValue({
  required: {
    operationId: opaqueId('Identifier for this operation within the change set.'),
    operationType: operationTypeName('A type registered by a domain profile in the catalogue.'),
    operationVersion: semanticVersion('The exact catalogue version this call was built against.'),
    arguments: recordValue(jsonValue(), {
      keyPattern: FIELD_NAME_PATTERN,
      keyHint: 'Argument names follow the spelling of the Arq model, e.g. hostWallId.',
      maxProperties: ARQ_MCP_LIMITS.maxOperationArgumentProperties,
      description:
        "Checked against the operation's own schema from the catalogue, not against this open shape.",
    }),
    preconditions: arrayValue(preconditionInput, {
      maxItems: ARQ_MCP_LIMITS.maxPreconditions,
    }),
  },
  optional: {
    rationale: boundedText(
      ARQ_MCP_TEXT_LIMITS.outcome,
      'Why this operation is in the change set. Shown to the reviewer, never used to decide anything.',
    ),
  },
  title: 'Proposed operation',
});

export type ProposedOperationInput = Infer<typeof proposedOperationInput>;

export const changeSetInput = refine(
  objectValue({
    required: {
      format: literalValue('arq.changeset'),
      schemaVersion: literalValue('1.0.0'),
      changeSetId: opaqueId(
        'Identifier for this change set. Reusing one with different content is a conflict.',
      ),
      projectId: opaqueId('The granted project this change set targets.'),
      baseRevision: opaqueId('The exact revision the change set was built against.'),
      intent: boundedText(
        ARQ_MCP_TEXT_LIMITS.objective,
        'What this change is for, in the operator’s terms. Shown at the top of the review.',
      ),
      constraints: arrayValue(boundedText(ARQ_MCP_TEXT_LIMITS.statement), {
        maxItems: ARQ_MCP_LIMITS.maxPlanStatements,
      }),
      operations: arrayValue(proposedOperationInput, {
        minItems: 1,
        maxItems: ARQ_MCP_LIMITS.maxChangeSetOperations,
        uniqueBy: (operation) => operation.operationId,
      }),
    },
    optional: {
      briefId: opaqueId('The brief this change set came from.'),
      designProgramId: opaqueId('The design program this change set came from.'),
    },
    title: 'Arq change set',
    description:
      'A request to change a project. Staging one validates it and changes nothing. Only Arq, after the operator approves in Arq, can commit it.',
  }),
  (value, report) => {
    for (const [index, operation] of value.operations.entries()) {
      for (const [preconditionIndex, precondition] of operation.preconditions.entries()) {
        if (
          precondition.kind === 'project.revision_equals' &&
          precondition.revision !== value.baseRevision
        ) {
          // Two different answers to "which revision is this built on" is a
          // sign the change set was assembled from stale pieces, and it is
          // cheaper to catch here than to have the runtime reject half of it.
          report(
            `$.operations[${index}].preconditions[${preconditionIndex}].revision`,
            `This precondition expects revision "${precondition.revision}" while the change set is based on "${value.baseRevision}". Rebuild the change set against one revision.`,
          );
        }
      }
    }
  },
  'A revision precondition must agree with the change set’s base revision.',
);

export type ChangeSetInput = Infer<typeof changeSetInput>;

export interface ChangeSet extends ChangeSetInput {
  readonly contentHash: string;
}

/** Every element identifier the change set's preconditions refer to, for the reviewer's impact list. */
export function preconditionElementIds(changeSet: ChangeSetInput): readonly string[] {
  const ids = new Set<string>();
  for (const operation of changeSet.operations) {
    for (const precondition of operation.preconditions) {
      if (precondition.kind !== 'project.revision_equals') {
        ids.add(precondition.elementId);
      }
    }
  }
  return [...ids].sort();
}
