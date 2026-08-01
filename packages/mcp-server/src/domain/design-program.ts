/**
 * The design program: what the thing is, as components, interfaces,
 * requirements, a task graph and cited sources.
 *
 * This is the layer that lets an assistant take "design me a vertical
 * take-off aircraft" seriously without pretending Arq can build one. The
 * program can describe any domain in full detail. Whether any of it can be
 * executed is a separate question, answered by capability coverage against
 * a registered domain profile, and answered honestly: an unregistered
 * domain produces a named profile and a named blocker list, not a
 * substituted operation.
 *
 * Two corrections to the reviewed 2.0 schema are worth naming.
 *
 * `executionIntent` in 2.0 fed straight into the coverage verdict: a
 * program marked `concept_only` reported `concept_plan_only` regardless of
 * what the catalogue said, and a program marked
 * `requires_registered_operations` with no requested capabilities at all
 * reported `ready_for_operation_planning` - readiness concluded from an
 * empty check. Here the field records what the caller intends and the
 * verdict is computed from the coverage itself.
 *
 * `interfaceComponentIds` in 2.0 was validated as a reference list but
 * never as a relation: two components could each declare the other, or a
 * component could declare an interface to something in a different
 * subtree, with no rule about what that means. Interfaces here must be
 * mutual, which is the only reading that makes an interface a contract
 * between two parts rather than a note on one of them.
 */

import { boundedText, opaqueId, operationTypeName, profileId } from '../schema/identifiers';
import {
  arrayValue,
  enumValue,
  literalValue,
  objectValue,
  refine,
  type Infer,
} from '../schema/schema';
import { describeCycle, findCycle, findParentCycle } from './graph';
import { ARQ_MCP_LIMITS, ARQ_MCP_TEXT_LIMITS } from './limits';
import {
  PRIORITIES,
  type PlanReference,
  type Provenance,
  referenceInput,
  toPlanReference,
} from './plan-common';

export const REQUIREMENT_CATEGORIES = [
  'function',
  'geometry',
  'performance',
  'usability',
  'safety',
  'regulatory',
  'delivery',
  'other',
] as const;

export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export const EXECUTION_INTENTS = ['concept_only', 'requires_registered_operations'] as const;

export type ExecutionIntent = (typeof EXECUTION_INTENTS)[number];

const statementList = (maxItems: number, description: string) =>
  arrayValue(boundedText(ARQ_MCP_TEXT_LIMITS.statement), { maxItems, description });

export const designRequirementInput = objectValue({
  required: {
    id: opaqueId(),
    category: enumValue(REQUIREMENT_CATEGORIES),
    statement: boundedText(ARQ_MCP_TEXT_LIMITS.outcome, 'The requirement, stated so it can fail.'),
    priority: enumValue(PRIORITIES),
    verificationMethod: boundedText(
      ARQ_MCP_TEXT_LIMITS.statement,
      'How someone would check it. A requirement with no check is a wish.',
    ),
  },
  title: 'Design requirement',
});

export const designComponentInput = objectValue({
  required: {
    id: opaqueId(),
    title: boundedText(ARQ_MCP_TEXT_LIMITS.title),
    role: boundedText(ARQ_MCP_TEXT_LIMITS.outcome, 'What this part is for.'),
    requestedCapabilities: arrayValue(operationTypeName(), {
      maxItems: ARQ_MCP_LIMITS.maxRequestedCapabilities,
      uniqueBy: (name) => name,
      description:
        'Operations that would be needed to build this component in Arq. Naming one is a request, not a claim that it exists.',
    }),
    requirementIds: arrayValue(opaqueId(), {
      maxItems: ARQ_MCP_LIMITS.maxDesignProgramRequirements,
      uniqueBy: (id) => id,
    }),
    interfaceComponentIds: arrayValue(opaqueId(), {
      maxItems: ARQ_MCP_LIMITS.maxDesignProgramComponents,
      uniqueBy: (id) => id,
      description: 'Components this one meets. Interfaces must be declared by both sides.',
    }),
    notes: arrayValue(boundedText(ARQ_MCP_TEXT_LIMITS.note), { maxItems: 50 }),
  },
  optional: {
    parentId: opaqueId('The component this one is part of. Absent means it is a top-level part.'),
  },
  title: 'Design component',
});

export const designTaskInput = objectValue({
  required: {
    id: opaqueId(),
    title: boundedText(ARQ_MCP_TEXT_LIMITS.title),
    outcome: boundedText(ARQ_MCP_TEXT_LIMITS.outcome),
    dependsOn: arrayValue(opaqueId(), {
      maxItems: ARQ_MCP_LIMITS.maxDependencies,
      uniqueBy: (id) => id,
    }),
    componentIds: arrayValue(opaqueId(), {
      maxItems: ARQ_MCP_LIMITS.maxDesignProgramComponents,
      uniqueBy: (id) => id,
    }),
    acceptanceCriteria: arrayValue(boundedText(ARQ_MCP_TEXT_LIMITS.statement), {
      minItems: 1,
      maxItems: ARQ_MCP_LIMITS.maxAcceptanceCriteria,
    }),
    requestedCapabilities: arrayValue(operationTypeName(), {
      maxItems: ARQ_MCP_LIMITS.maxRequestedCapabilities,
      uniqueBy: (name) => name,
    }),
    priority: enumValue(PRIORITIES),
  },
  title: 'Design task',
});

const designProgramShape = objectValue({
  required: {
    format: literalValue('arq.design-program'),
    schemaVersion: literalValue('1.0.0'),
    designProgramId: opaqueId(),
    designDomain: profileId(
      'The domain this program is about. It does not have to be a registered profile: describing a domain Arq cannot build is the point.',
    ),
    executionIntent: enumValue(
      EXECUTION_INTENTS,
      'What the caller intends. It records intent only; whether the work can be executed is decided by coverage against the catalogue.',
    ),
    title: boundedText(ARQ_MCP_TEXT_LIMITS.title),
    objective: boundedText(ARQ_MCP_TEXT_LIMITS.objective),
    constraints: statementList(ARQ_MCP_LIMITS.maxPlanStatements, 'Hard limits on the design.'),
    assumptions: statementList(
      ARQ_MCP_LIMITS.maxPlanStatements,
      'What the design takes for granted.',
    ),
    requirements: arrayValue(designRequirementInput, {
      maxItems: ARQ_MCP_LIMITS.maxDesignProgramRequirements,
      uniqueBy: (requirement) => requirement.id,
    }),
    components: arrayValue(designComponentInput, {
      minItems: 1,
      maxItems: ARQ_MCP_LIMITS.maxDesignProgramComponents,
      uniqueBy: (component) => component.id,
    }),
    tasks: arrayValue(designTaskInput, {
      minItems: 1,
      maxItems: ARQ_MCP_LIMITS.maxDesignProgramTasks,
      uniqueBy: (task) => task.id,
    }),
    references: arrayValue(referenceInput, {
      maxItems: ARQ_MCP_LIMITS.maxReferences,
      uniqueBy: (reference) => reference.id,
    }),
    questions: statementList(
      ARQ_MCP_LIMITS.maxPlanStatements,
      'What is still unresolved. These stay visible until someone answers them.',
    ),
  },
  optional: {
    projectId: opaqueId('The granted project this program is attached to, if any.'),
  },
  title: 'Arq design program',
  description:
    'Non-executable planning data for any design domain. Storing one never creates geometry, a native project, or canonical project state.',
});

export const designProgramInput = refine(
  designProgramShape,
  (value, report) => {
    const componentIds = new Set(value.components.map((component) => component.id));
    const requirementIds = new Set(value.requirements.map((requirement) => requirement.id));
    const taskIds = new Set(value.tasks.map((task) => task.id));

    const interfaces = new Map(
      value.components.map((component) => [component.id, new Set(component.interfaceComponentIds)]),
    );

    for (const [index, component] of value.components.entries()) {
      if (component.parentId !== undefined) {
        if (component.parentId === component.id) {
          report(
            `$.components[${index}].parentId`,
            `Component "${component.id}" is its own parent. Remove the parent or choose a different one.`,
          );
        } else if (!componentIds.has(component.parentId)) {
          report(
            `$.components[${index}].parentId`,
            `Component "${component.id}" names parent "${component.parentId}", which is not in this program.`,
          );
        }
      }
      for (const requirementId of component.requirementIds) {
        if (!requirementIds.has(requirementId)) {
          report(
            `$.components[${index}].requirementIds`,
            `Component "${component.id}" cites requirement "${requirementId}", which is not in this program.`,
          );
        }
      }
      for (const interfaceId of component.interfaceComponentIds) {
        if (interfaceId === component.id) {
          report(
            `$.components[${index}].interfaceComponentIds`,
            `Component "${component.id}" declares an interface with itself.`,
          );
          continue;
        }
        if (!componentIds.has(interfaceId)) {
          report(
            `$.components[${index}].interfaceComponentIds`,
            `Component "${component.id}" declares an interface with "${interfaceId}", which is not in this program.`,
          );
          continue;
        }
        // An interface is a contract between two parts. Recording it on one
        // side only is how a plan ends up with an interface that nobody on
        // the other side has to honour.
        if (!interfaces.get(interfaceId)?.has(component.id)) {
          report(
            `$.components[${index}].interfaceComponentIds`,
            `Component "${component.id}" declares an interface with "${interfaceId}", but "${interfaceId}" does not declare one back. Declare it on both components or remove it.`,
          );
        }
      }
    }

    const parentCycle = findParentCycle(
      new Map(value.components.map((component) => [component.id, component.parentId])),
    );
    if (parentCycle !== undefined) {
      report(
        '$.components',
        `The component hierarchy loops: ${describeCycle(parentCycle)}. A part cannot contain something that contains it.`,
      );
    }

    for (const [index, task] of value.tasks.entries()) {
      for (const dependency of task.dependsOn) {
        if (dependency === task.id) {
          report(`$.tasks[${index}].dependsOn`, `Task "${task.id}" depends on itself.`);
        } else if (!taskIds.has(dependency)) {
          report(
            `$.tasks[${index}].dependsOn`,
            `Task "${task.id}" depends on "${dependency}", which is not in this program.`,
          );
        }
      }
      for (const componentId of task.componentIds) {
        if (!componentIds.has(componentId)) {
          report(
            `$.tasks[${index}].componentIds`,
            `Task "${task.id}" names component "${componentId}", which is not in this program.`,
          );
        }
      }
    }

    const taskCycle = findCycle(new Map(value.tasks.map((task) => [task.id, task.dependsOn])));
    if (taskCycle !== undefined) {
      report(
        '$.tasks',
        `The tasks depend on each other in a loop: ${describeCycle(taskCycle)}. Break one of those links.`,
      );
    }
  },
  'Parents, requirements, interfaces and dependencies must resolve inside this program; interfaces must be mutual; neither the hierarchy nor the task graph may loop.',
);

export type DesignProgramInput = Infer<typeof designProgramInput>;
export type DesignComponentInput = Infer<typeof designComponentInput>;
export type DesignTaskInput = Infer<typeof designTaskInput>;
export type DesignRequirementInput = Infer<typeof designRequirementInput>;

export interface DesignComponent extends DesignComponentInput {
  readonly status: 'proposed';
}

export interface DesignTask extends DesignTaskInput {
  readonly status: 'proposed';
}

export interface DesignRequirement extends DesignRequirementInput {
  readonly status: 'proposed';
}

export interface DesignProgram {
  readonly format: 'arq.design-program';
  readonly schemaVersion: '1.0.0';
  readonly designProgramId: string;
  readonly projectId?: string;
  readonly designDomain: string;
  readonly executionIntent: ExecutionIntent;
  readonly title: string;
  readonly objective: string;
  readonly constraints: readonly string[];
  readonly assumptions: readonly string[];
  readonly requirements: readonly DesignRequirement[];
  readonly components: readonly DesignComponent[];
  readonly tasks: readonly DesignTask[];
  readonly references: readonly PlanReference[];
  readonly questions: readonly string[];
  readonly provenance: Provenance;
  readonly contentHash: string;
  /** Increments each time the same program id is stored with different content, so the history tab can show versions. */
  readonly version: number;
}

export interface BuildDesignProgramInput {
  readonly input: DesignProgramInput;
  readonly provenance: Provenance;
  readonly contentHash: string;
  readonly version: number;
}

export function buildDesignProgram(build: BuildDesignProgramInput): DesignProgram {
  const { input, provenance, contentHash, version } = build;
  return {
    format: 'arq.design-program',
    schemaVersion: '1.0.0',
    designProgramId: input.designProgramId,
    designDomain: input.designDomain,
    executionIntent: input.executionIntent,
    title: input.title,
    objective: input.objective,
    constraints: [...input.constraints],
    assumptions: [...input.assumptions],
    requirements: input.requirements.map((requirement) => ({
      ...requirement,
      status: 'proposed' as const,
    })),
    components: input.components.map((component) => ({
      ...component,
      status: 'proposed' as const,
    })),
    tasks: input.tasks.map((task) => ({ ...task, status: 'proposed' as const })),
    references: input.references.map(toPlanReference),
    questions: [...input.questions],
    provenance,
    contentHash,
    version,
    ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
  };
}

/** Every capability the program asks for, with what asked for it. The input to coverage assessment. */
export function requestedCapabilities(program: DesignProgram): readonly {
  readonly targetKind: 'component' | 'task';
  readonly targetId: string;
  readonly capability: string;
}[] {
  const requests: {
    readonly targetKind: 'component' | 'task';
    readonly targetId: string;
    readonly capability: string;
  }[] = [];
  for (const component of program.components) {
    for (const capability of component.requestedCapabilities) {
      requests.push({ targetKind: 'component', targetId: component.id, capability });
    }
  }
  for (const task of program.tasks) {
    for (const capability of task.requestedCapabilities) {
      requests.push({ targetKind: 'task', targetId: task.id, capability });
    }
  }
  return requests;
}
