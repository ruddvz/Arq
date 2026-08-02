/**
 * Prompts: the three workflows worth starting from a known-good shape.
 *
 * Each one is a sequence a careful person would follow, written down so an
 * assistant does not have to rediscover it. The reviewed 2.0 package had
 * two prompts and both ended at "save it"; the step that actually decides
 * whether anything can be built - checking coverage, and reporting honestly
 * when it fails - was left to the model.
 */

import type { JsonObject } from '../schema/json-value';
import { boundedText, opaqueId, profileId } from '../schema/identifiers';
import { objectValue, type Validator } from '../schema/schema';
import { ARQ_MCP_TEXT_LIMITS } from '../domain/limits';

export interface PromptDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly input: Validator<Record<string, string | undefined>>;
  readonly arguments: readonly {
    readonly name: string;
    readonly description: string;
    readonly required: boolean;
  }[];
  readonly build: (input: Record<string, string | undefined>) => string;
}

const objectiveArgument = boundedText(
  ARQ_MCP_TEXT_LIMITS.objective,
  'What the operator asked for, in their own words.',
);

export const ARQ_MCP_PROMPTS: readonly PromptDefinition[] = [
  {
    name: 'arq_prepare_brief',
    title: 'Prepare a brief',
    description: 'Turn a request into a dependency-ordered plan with its unknowns written down.',
    input: objectValue({
      required: { objective: objectiveArgument },
      optional: { projectId: opaqueId('The shared project this is about, if it is about one.') },
    }) as unknown as Validator<Record<string, string | undefined>>,
    arguments: [
      { name: 'objective', description: 'What the operator asked for.', required: true },
      { name: 'projectId', description: 'The shared project, if any.', required: false },
    ],
    build: (input) =>
      [
        `Prepare an Arq brief for this objective: ${input.objective ?? ''}`,
        input.projectId === undefined
          ? 'No project was named. Call arq_get_capabilities and arq_list_projects before assuming any project context.'
          : `Use project ${input.projectId}. Read arq_get_project_snapshot first and note the exact revision.`,
        'Write the hard constraints, the assumptions you are making, a dependency-ordered work list where every item has at least one acceptance criterion, the sources you are relying on, and every question you cannot answer from what you were given.',
        'Do not resolve an ambiguity by choosing for the operator. An unanswered question belongs in questions, not in an assumption you quietly act on.',
        'Store it with arq_save_brief. Storing a brief changes nothing in any project, and you must not describe it as though it did.',
      ].join('\n\n'),
  },
  {
    name: 'arq_prepare_design_program',
    title: 'Prepare a design program',
    description:
      'Turn a broad idea in any domain into components, interfaces, requirements and tasks, then find out honestly which parts Arq can build.',
    input: objectValue({
      required: {
        objective: objectiveArgument,
        designDomain: profileId('The domain, for example architecture or vehicle.concept.'),
      },
      optional: { projectId: opaqueId() },
    }) as unknown as Validator<Record<string, string | undefined>>,
    arguments: [
      { name: 'objective', description: 'What the operator wants to design.', required: true },
      { name: 'designDomain', description: 'Which domain it belongs to.', required: true },
      { name: 'projectId', description: 'The shared project, if any.', required: false },
    ],
    build: (input) =>
      [
        `Prepare an Arq design program for this objective: ${input.objective ?? ''}`,
        `Design domain: ${input.designDomain ?? 'unspecified'}. Call arq_list_domain_profiles first and see whether Arq has that profile registered. If it does not, continue anyway: describing the design is the point of this layer.`,
        input.projectId === undefined
          ? 'No project was named, so coverage will report unknown rather than a definite answer. Name a shared project if you want one.'
          : `Use project ${input.projectId}.`,
        'Break the object into components with a parent hierarchy. Declare an interface on both components that share it. Write requirements that can fail, each with the method someone would use to check it. Write a dependency-ordered task list. On each component and task, list the capabilities that would be needed to build it in Arq.',
        'Record every source you were given as a reference with its purpose and its reuse status. If someone named a film, a building, a product or a brand, that is a source, not permission: work from the functional requirements and say so.',
        'Store it with arq_save_design_program, then call arq_assess_design_program_coverage.',
        'Report the coverage exactly as it comes back. For anything Arq cannot build, name the domain profile that would own it and the blockers it lists. Do not substitute an operation from a different profile, and do not describe a concept plan as a model.',
      ].join('\n\n'),
  },
  {
    name: 'arq_plan_change',
    title: 'Plan a change to a project',
    description:
      'Go from a covered plan to one validated proposal, without claiming anything was applied.',
    input: objectValue({
      required: {
        projectId: opaqueId('The shared project to change.'),
        intent: boundedText(ARQ_MCP_TEXT_LIMITS.objective, 'What the change is for.'),
      },
    }) as unknown as Validator<Record<string, string | undefined>>,
    arguments: [
      { name: 'projectId', description: 'The shared project.', required: true },
      { name: 'intent', description: 'What the change is for.', required: true },
    ],
    build: (input) =>
      [
        `Prepare one change set for project ${input.projectId ?? ''} with this intent: ${input.intent ?? ''}`,
        'First read arq_get_project_snapshot for the exact current revision and whether the project can be edited at all. Then read arq_get_operation_catalog and the argument contract of each operation you intend to use. Then read the elements you are about to affect with arq_query_model.',
        'Build one change set against that exact revision. Use only operation types and versions the catalogue returned. Add preconditions for what you believe to be true, so a project that moved underneath you is a detectable conflict rather than a surprise.',
        'Stage it with arq_stage_changeset and read the result. If validation failed, correct the plan; do not restage the same operations under a new identifier and hope.',
        'If it passed, call arq_request_changeset_review and stop. The operator decides in Arq. Until the proposal reads as committed, say that a change is waiting for review - not that it was made.',
      ].join('\n\n'),
  },
];

export function promptByName(name: string): PromptDefinition | undefined {
  return ARQ_MCP_PROMPTS.find((prompt) => prompt.name === name);
}

export function describePromptsForList(): readonly JsonObject[] {
  return ARQ_MCP_PROMPTS.map((prompt) => ({
    name: prompt.name,
    title: prompt.title,
    description: prompt.description,
    arguments: prompt.arguments.map((argument) => ({
      name: argument.name,
      description: argument.description,
      required: argument.required,
    })),
  }));
}
