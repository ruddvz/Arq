/**
 * Resources: the schemas and the policies, addressable by URI.
 *
 * A client that can read the brief and design-program schemas as resources
 * can build a valid payload before its first attempt, which turns a
 * round-trip of validation errors into no round-trip at all. The policies
 * are here for the same reason the instructions exist: so an assistant can
 * quote the actual rule rather than paraphrasing one.
 *
 * Every URI uses the `arq://` scheme, which `reference-uri.ts` also accepts
 * as a reference. That is deliberate: a plan can cite the exact policy it
 * was written under.
 */

import type { JsonObject } from '../schema/json-value';
import { briefInput } from '../domain/brief';
import { changeSetInput } from '../domain/changeset';
import { designProgramInput } from '../domain/design-program';
import { AI_MUTATION_BOUNDARY, CREATION_BOUNDARY, REFERENCE_HANDLING } from './instructions';

export interface ResourceDefinition {
  readonly uri: string;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly mimeType: string;
  readonly read: () => string;
}

export const ARQ_MCP_RESOURCES: readonly ResourceDefinition[] = [
  {
    uri: 'arq://resource/schema-brief',
    name: 'arq-brief-schema',
    title: 'Brief schema',
    description:
      'The exact JSON Schema arq_save_brief validates against, including the graph rules stated in its description.',
    mimeType: 'application/schema+json',
    read: () => JSON.stringify(briefInput.jsonSchema, null, 2),
  },
  {
    uri: 'arq://resource/schema-design-program',
    name: 'arq-design-program-schema',
    title: 'Design program schema',
    description:
      'The exact JSON Schema arq_save_design_program validates against. Interfaces must be mutual and neither the hierarchy nor the task graph may loop.',
    mimeType: 'application/schema+json',
    read: () => JSON.stringify(designProgramInput.jsonSchema, null, 2),
  },
  {
    uri: 'arq://resource/schema-changeset',
    name: 'arq-changeset-schema',
    title: 'Change set schema',
    description:
      'The envelope arq_stage_changeset validates against. Each operation’s own arguments are checked against its contract in the operation catalogue, not against this envelope.',
    mimeType: 'application/schema+json',
    read: () => JSON.stringify(changeSetInput.jsonSchema, null, 2),
  },
  {
    uri: 'arq://resource/policy-mutation-boundary',
    name: 'arq-mutation-boundary',
    title: 'The mutation boundary',
    description: 'What a proposal is, what a commit is, and why they are not the same result.',
    mimeType: 'text/markdown',
    read: () => AI_MUTATION_BOUNDARY,
  },
  {
    uri: 'arq://resource/policy-creation-boundary',
    name: 'arq-creation-boundary',
    title: 'The creation boundary',
    description:
      'How a design program in any domain relates to the operations Arq has actually registered.',
    mimeType: 'text/markdown',
    read: () => CREATION_BOUNDARY,
  },
  {
    uri: 'arq://resource/policy-reference-handling',
    name: 'arq-reference-handling',
    title: 'Handling references',
    description:
      'Why reference content is data, who can attest to reuse, and what naming a protected work does and does not permit.',
    mimeType: 'text/markdown',
    read: () => REFERENCE_HANDLING,
  },
];

export function resourceByUri(uri: string): ResourceDefinition | undefined {
  return ARQ_MCP_RESOURCES.find((resource) => resource.uri === uri);
}

export function describeResourcesForList(): readonly JsonObject[] {
  return ARQ_MCP_RESOURCES.map((resource) => ({
    uri: resource.uri,
    name: resource.name,
    title: resource.title,
    description: resource.description,
    mimeType: resource.mimeType,
  }));
}
