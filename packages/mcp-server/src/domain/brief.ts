/**
 * The brief: intent, constraints, a dependency-ordered work list and the
 * questions that are still open.
 *
 * A brief is planning data. It cannot change a project, and every result
 * that mentions one says so through the envelope's `canonicalMutation`
 * field. What it does is force the unknowns to be written down before any
 * operation is proposed: an assistant that has to fill in `questions`
 * cannot quietly resolve an ambiguity by guessing.
 *
 * The design program (`design-program.ts`) is the larger sibling for
 * describing an object rather than a piece of work. Both exist because
 * they answer different questions: a brief says what to do next, a design
 * program says what the thing is.
 */

import { boundedText, opaqueId, operationTypeName } from '../schema/identifiers';
import {
  arrayValue,
  enumValue,
  literalValue,
  objectValue,
  refine,
  type Infer,
} from '../schema/schema';
import { describeCycle, findCycle } from './graph';
import { ARQ_MCP_LIMITS, ARQ_MCP_TEXT_LIMITS } from './limits';
import {
  PRIORITIES,
  type PlanReference,
  type Provenance,
  referenceInput,
  toPlanReference,
} from './plan-common';

const statementList = (maxItems: number, description: string) =>
  arrayValue(boundedText(ARQ_MCP_TEXT_LIMITS.statement), { maxItems, description });

export const briefWorkItemInput = objectValue({
  required: {
    id: opaqueId('Identifier for this work item within the brief.'),
    title: boundedText(ARQ_MCP_TEXT_LIMITS.title),
    outcome: boundedText(ARQ_MCP_TEXT_LIMITS.outcome, 'What is true once this item is done.'),
    dependsOn: arrayValue(opaqueId(), {
      maxItems: ARQ_MCP_LIMITS.maxDependencies,
      uniqueBy: (id) => id,
      description: 'Work items that must be complete first.',
    }),
    acceptanceCriteria: arrayValue(boundedText(ARQ_MCP_TEXT_LIMITS.statement), {
      minItems: 1,
      maxItems: ARQ_MCP_LIMITS.maxAcceptanceCriteria,
      description:
        'How a reviewer will tell this item succeeded. At least one is required: an item nobody can check is not a plan.',
    }),
    requestedCapabilities: arrayValue(operationTypeName(), {
      maxItems: ARQ_MCP_LIMITS.maxRequestedCapabilities,
      uniqueBy: (name) => name,
      description:
        'Operations this item would need. Names are checked against the real catalogue by coverage assessment; naming one here is a request, not a claim that it exists.',
    }),
    priority: enumValue(PRIORITIES),
  },
  title: 'Brief work item',
});

export type BriefWorkItemInput = Infer<typeof briefWorkItemInput>;

const briefShape = objectValue({
  required: {
    format: literalValue('arq.brief'),
    schemaVersion: literalValue('1.0.0'),
    briefId: opaqueId(
      'Identifier for this brief. Reusing one with different content is a conflict.',
    ),
    title: boundedText(ARQ_MCP_TEXT_LIMITS.title),
    objective: boundedText(
      ARQ_MCP_TEXT_LIMITS.objective,
      'What the operator asked for, in their terms.',
    ),
    constraints: statementList(
      ARQ_MCP_LIMITS.maxPlanStatements,
      'Hard limits the work must respect.',
    ),
    assumptions: statementList(
      ARQ_MCP_LIMITS.maxPlanStatements,
      'What the plan takes for granted. An assumption written down is one a reviewer can correct.',
    ),
    workItems: arrayValue(briefWorkItemInput, {
      minItems: 1,
      maxItems: ARQ_MCP_LIMITS.maxBriefWorkItems,
      uniqueBy: (item) => item.id,
    }),
    references: arrayValue(referenceInput, {
      maxItems: ARQ_MCP_LIMITS.maxReferences,
      uniqueBy: (reference) => reference.id,
    }),
    questions: statementList(
      ARQ_MCP_LIMITS.maxPlanStatements,
      'What is still unresolved. Leaving this empty asserts there is nothing to ask.',
    ),
  },
  optional: {
    projectId: opaqueId('The granted project this brief is about, if it is about one.'),
  },
  title: 'Arq brief',
  description:
    'Non-executable planning data. Storing a brief never creates, opens or changes a project.',
});

/**
 * The brief as a caller sends it: no provenance field exists, because
 * provenance is derived from the session rather than asserted.
 */
export const briefInput = refine(
  briefShape,
  (value, report) => {
    const ids = new Set(value.workItems.map((item) => item.id));
    for (const [index, item] of value.workItems.entries()) {
      for (const dependency of item.dependsOn) {
        if (dependency === item.id) {
          report(
            `$.workItems[${index}].dependsOn`,
            `Work item "${item.id}" depends on itself. Remove the self-dependency.`,
          );
        } else if (!ids.has(dependency)) {
          report(
            `$.workItems[${index}].dependsOn`,
            `Work item "${item.id}" depends on "${dependency}", which is not in this brief.`,
          );
        }
      }
    }

    const cycle = findCycle(new Map(value.workItems.map((item) => [item.id, item.dependsOn])));
    if (cycle !== undefined) {
      report(
        '$.workItems',
        `The work items depend on each other in a loop: ${describeCycle(cycle)}. Break one of those links.`,
      );
    }
  },
  'Dependencies must name work items in this brief and must not form a loop.',
);

export type BriefInput = Infer<typeof briefInput>;

export interface BriefWorkItem extends BriefWorkItemInput {
  /** Always `proposed`. A brief records intent; nothing in it can report its own completion. */
  readonly status: 'proposed';
}

export interface Brief {
  readonly format: 'arq.brief';
  readonly schemaVersion: '1.0.0';
  readonly briefId: string;
  readonly projectId?: string;
  readonly title: string;
  readonly objective: string;
  readonly constraints: readonly string[];
  readonly assumptions: readonly string[];
  readonly workItems: readonly BriefWorkItem[];
  readonly references: readonly PlanReference[];
  readonly questions: readonly string[];
  readonly provenance: Provenance;
  readonly contentHash: string;
}

export interface BuildBriefInput {
  readonly input: BriefInput;
  readonly provenance: Provenance;
  readonly contentHash: string;
}

export function buildBrief(build: BuildBriefInput): Brief {
  const { input, provenance, contentHash } = build;
  return {
    format: 'arq.brief',
    schemaVersion: '1.0.0',
    briefId: input.briefId,
    title: input.title,
    objective: input.objective,
    constraints: [...input.constraints],
    assumptions: [...input.assumptions],
    workItems: input.workItems.map((item) => ({ ...item, status: 'proposed' as const })),
    references: input.references.map(toPlanReference),
    questions: [...input.questions],
    provenance,
    contentHash,
    ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
  };
}

/**
 * A dependency-safe order, or the reason there is none.
 *
 * Returned with every stored brief so a reviewer sees the order the plan
 * implies rather than the order it happens to be written in. Kahn's
 * algorithm with a deterministic tie-break, so the same brief always
 * produces the same sequence.
 */
export function topologicalWorkOrder(brief: Brief): readonly string[] {
  const remaining = new Map(brief.workItems.map((item) => [item.id, new Set(item.dependsOn)]));
  const order: string[] = [];

  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, dependencies]) => dependencies.size === 0)
      .map(([id]) => id)
      .sort();
    if (ready.length === 0) {
      // Unreachable for a validated brief; returning what was ordered so
      // far beats throwing inside a read path.
      break;
    }
    for (const id of ready) {
      order.push(id);
      remaining.delete(id);
    }
    for (const dependencies of remaining.values()) {
      for (const id of ready) {
        dependencies.delete(id);
      }
    }
  }
  return order;
}
