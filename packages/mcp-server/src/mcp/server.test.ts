import { describe, expect, it } from 'vitest';
import { createAuditTrail } from '../audit/audit-trail';
import { createControlledClock, createSequentialIdSource } from '../runtime/clock';
import { createGrant, type GrantContext } from '../grant/grant';
import { GRANT_PRESETS, TOOL_SCOPES } from '../grant/scopes';
import { createMemoryArqHost } from '../host/memory-project-host';
import { createDefaultDomainProfileRegistry } from '../profile/profile-registry';
import { ArqBridge } from '../adapter/bridge-adapter';
import { createToolService } from '../service/tool-service';
import { ARQ_MCP_TOOLS } from './tools';
import { SUPPORTED_PROTOCOL_VERSIONS, parseMessage } from './protocol';
import { createArqMcpServer } from './server';

const START = 1_700_000_000_000;

interface ToolResultShape {
  readonly content: readonly { readonly type: string; readonly text: string }[];
  readonly structuredContent: Record<string, unknown>;
  readonly isError: boolean;
}

function harness(options: { grant?: GrantContext | undefined; withGrant?: boolean } = {}) {
  const clock = createControlledClock(START);
  const { host, operator } = createMemoryArqHost();
  const audit = createAuditTrail(clock.now);
  const bridge = new ArqBridge({
    host,
    registry: createDefaultDomainProfileRegistry(),
    clock: clock.now,
    idSource: createSequentialIdSource('id'),
    audit,
    serverMode: 'local_runtime',
  });

  host.createDraft('project-a', 'Granted house');
  operator.apply(
    'project-a',
    'rev-000000',
    [
      {
        operationId: 'seed-1',
        operationType: 'architecture.level.create',
        operationVersion: '1.0.0',
        arguments: { levelId: 'level-0', name: 'Ground', elevationMm: 0 },
        preconditions: [],
      },
    ],
    'operator',
  );

  const grant =
    options.grant ??
    createGrant({
      grantId: 'grant-1',
      subjectId: 'subject-1',
      tenantId: 'tenant-1',
      clientName: 'claude-code',
      clientVersion: '1.0.0',
      scopes: GRANT_PRESETS.propose,
      projectIds: ['project-a'],
      issuedAtEpochMs: START,
      lifetimeMs: 3_600_000,
    });

  const server = createArqMcpServer({
    bridge,
    service: createToolService({
      audit,
      nextTraceId: () => bridge.nextTraceId(),
      reportFault: () => {},
    }),
    resolveGrant: () => (options.withGrant === false ? undefined : grant),
  });

  return { server, bridge, host, operator, audit, clock, grant };
}

let nextId = 0;
function call(
  server: ReturnType<typeof harness>['server'],
  method: string,
  params?: Record<string, unknown>,
) {
  nextId += 1;
  return server.handle({
    jsonrpc: '2.0',
    id: nextId,
    method,
    ...(params === undefined ? {} : { params: params as never }),
  });
}

function initialise(server: ReturnType<typeof harness>['server'], protocolVersion?: string) {
  return call(server, 'initialize', {
    ...(protocolVersion === undefined ? {} : { protocolVersion }),
    clientInfo: { name: 'claude-code', version: '1.0.0' },
    capabilities: {},
  });
}

function resultOf<T>(response: ReturnType<typeof call>): T {
  if (response === undefined || !('result' in response)) {
    throw new Error('expected a successful JSON-RPC result');
  }
  return response.result as unknown as T;
}

function toolResult(response: ReturnType<typeof call>): ToolResultShape {
  return resultOf<ToolResultShape>(response);
}

function callTool(
  server: ReturnType<typeof harness>['server'],
  name: string,
  args: Record<string, unknown> = {},
): ToolResultShape {
  return toolResult(call(server, 'tools/call', { name, arguments: args }));
}

describe('the handshake', () => {
  it('echoes a supported protocol version and answers with its own when asked for anything else', () => {
    const { server } = harness();
    for (const version of SUPPORTED_PROTOCOL_VERSIONS) {
      const response = initialise(harness().server, version);
      expect(resultOf<{ protocolVersion: string }>(response).protocolVersion).toBe(version);
    }
    const fallback = initialise(server, '1999-01-01');
    expect(resultOf<{ protocolVersion: string }>(fallback).protocolVersion).toBe(
      SUPPORTED_PROTOCOL_VERSIONS[0],
    );
  });

  it('declares its capabilities and instructions', () => {
    const { server } = harness();
    const result = resultOf<Record<string, unknown>>(initialise(server));
    expect(result.capabilities).toEqual({
      tools: { listChanged: false },
      resources: { listChanged: false, subscribe: false },
      prompts: { listChanged: false },
    });
    expect(String(result.instructions)).toContain('canonicalMutation');
  });

  it('never answers a notification', () => {
    const { server } = harness();
    expect(server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined();
    expect(server.handle({ jsonrpc: '2.0', method: 'notifications/progress' })).toBeUndefined();
  });

  it('refuses a tool call before initialize', () => {
    const { server } = harness();
    const response = call(server, 'tools/call', { name: 'arq_get_capabilities', arguments: {} });
    expect(response).toBeDefined();
    expect(response && 'error' in response ? response.error.code : 0).toBe(-32600);
  });

  it('refuses an unknown method', () => {
    const { server } = harness();
    initialise(server);
    const response = call(server, 'sampling/createMessage');
    expect(response && 'error' in response ? response.error.code : 0).toBe(-32601);
  });
});

describe('the tool surface', () => {
  it('covers exactly the scope table, in both directions', () => {
    const declared = new Set(Object.keys(TOOL_SCOPES));
    const registered = new Set(ARQ_MCP_TOOLS.map((tool) => tool.name));
    expect([...registered].sort()).toEqual([...declared].sort());
  });

  it('publishes a closed input schema for every tool', () => {
    for (const tool of ARQ_MCP_TOOLS) {
      const schema = tool.input.jsonSchema as { type?: string; additionalProperties?: boolean };
      expect(schema.type).toBe('object');
      expect(schema.additionalProperties).toBe(false);
    }
  });

  it('marks every read-only tool as such and no tool as destructive', () => {
    for (const tool of ARQ_MCP_TOOLS) {
      expect(tool.annotations.destructiveHint).toBe(false);
      expect(tool.annotations.openWorldHint).toBe(false);
      if (tool.name.startsWith('arq_get') || tool.name.startsWith('arq_list')) {
        expect(tool.annotations.readOnlyHint).toBe(true);
      }
    }
  });

  it('has no tool that commits, approves, opens a path or runs a query language', () => {
    const listed = resultOf<{ tools: { name: string }[] }>(
      call(harnessInitialised(), 'tools/list'),
    ).tools;
    const names = listed.map((tool) => tool.name).join(' ');
    for (const forbidden of ['commit', 'approve', 'sql', 'path', 'exec', 'shell', 'file_write']) {
      expect(names).not.toContain(forbidden);
    }
    expect(listed).toHaveLength(ARQ_MCP_TOOLS.length);
  });
});

function harnessInitialised() {
  const { server } = harness();
  initialise(server);
  return server;
}

describe('tool calls', () => {
  it('returns the envelope in structuredContent, with canonicalMutation on every result', () => {
    const server = harnessInitialised();
    const result = callTool(server, 'arq_get_capabilities');
    expect(result.isError).toBe(false);
    expect(result.structuredContent.canonicalMutation).toBe('none');
    expect(result.structuredContent.nextAction).toBeDefined();
    expect(result.structuredContent.traceId).toBeDefined();
  });

  it('reports an argument mistake as content the model can act on, not a transport error', () => {
    const server = harnessInitialised();
    const result = callTool(server, 'arq_get_project_snapshot', { projectId: '../../etc/passwd' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent.code).toBe('ARQ_INPUT_INVALID');
    expect(String(result.structuredContent.message)).toContain('$.arguments.projectId');
  });

  it('rejects an unknown argument rather than ignoring it', () => {
    const server = harnessInitialised();
    const result = callTool(server, 'arq_get_project_snapshot', {
      projectId: 'project-a',
      pathHint: '/Users/someone/house.arq',
    });
    expect(result.isError).toBe(true);
    expect(String(result.structuredContent.message)).toContain('Unknown property "pathHint"');
  });

  it('refuses every tool when nothing is shared with the connection', () => {
    const { server } = harness({ withGrant: false });
    initialise(server);
    const result = callTool(server, 'arq_list_projects');
    expect(result.isError).toBe(true);
    expect(result.structuredContent.code).toBe('ARQ_NO_GRANT');
    expect(result.structuredContent.canonicalMutation).toBe('none');
  });

  it('refuses an unknown tool at the protocol level', () => {
    const server = harnessInitialised();
    const response = call(server, 'tools/call', { name: 'arq_commit', arguments: {} });
    expect(response && 'error' in response ? response.error.code : 0).toBe(-32601);
  });

  it('writes an audit entry for a refusal as well as a success', () => {
    const { server, bridge, grant } = harness();
    initialise(server);
    callTool(server, 'arq_get_capabilities');
    callTool(server, 'arq_get_project_snapshot', { projectId: 'project-nowhere' });
    const trail = bridge.getAuditTrail(grant, 10);
    expect(trail.events.map((event) => event.outcome)).toEqual(['denied', 'ok']);
  });
});

describe('the whole journey a client actually takes', () => {
  it('goes from capabilities to a queued proposal without ever claiming a change', () => {
    const server = harnessInitialised();

    const capabilities = callTool(server, 'arq_get_capabilities');
    expect(capabilities.isError).toBe(false);

    const projects = callTool(server, 'arq_list_projects');
    const projectData = projects.structuredContent.data as { items: { projectId: string }[] };
    expect(projectData.items[0]?.projectId).toBe('project-a');

    const snapshot = callTool(server, 'arq_get_project_snapshot', { projectId: 'project-a' });
    const snapshotData = snapshot.structuredContent.data as {
      summary: { revision: string };
    };
    const revision = snapshotData.summary.revision;

    const catalog = callTool(server, 'arq_get_operation_catalog', { projectId: 'project-a' });
    const catalogData = catalog.structuredContent.data as {
      operations: { operationType: string; operationVersion: string }[];
    };
    expect(
      catalogData.operations.some((op) => op.operationType === 'architecture.wall_type.create'),
    ).toBe(true);

    const staged = callTool(server, 'arq_stage_changeset', {
      requestId: 'req-1',
      changeSet: {
        format: 'arq.changeset',
        schemaVersion: '1.0.0',
        changeSetId: 'cs-1',
        projectId: 'project-a',
        baseRevision: revision,
        intent: 'Register the standard wall type.',
        constraints: [],
        operations: [
          {
            operationId: 'op-1',
            operationType: 'architecture.wall_type.create',
            operationVersion: '1.0.0',
            arguments: {
              wallTypeId: 'type-100',
              name: 'Generic 100',
              thicknessMm: 100,
              defaultHeightMm: 2700,
            },
            preconditions: [{ kind: 'project.revision_equals', revision }],
          },
        ],
      },
    });
    expect(staged.isError).toBe(false);
    expect(staged.structuredContent.state).toBe('ready_for_review');
    expect(staged.structuredContent.canonicalMutation).toBe('none');

    const proposalId = (staged.structuredContent.data as { proposalId: string }).proposalId;
    const queued = callTool(server, 'arq_request_changeset_review', {
      requestId: 'req-2',
      projectId: 'project-a',
      proposalId,
    });
    expect(queued.structuredContent.state).toBe('awaiting_user_approval');
    expect(queued.structuredContent.canonicalMutation).toBe('none');
    expect(String(queued.content[0]?.text)).toContain('Nothing in the project has changed');
  });

  it('answers a request for a domain Arq cannot build with a profile and blockers', () => {
    const server = harnessInitialised();

    const stored = callTool(server, 'arq_save_design_program', {
      requestId: 'req-1',
      designProgram: {
        format: 'arq.design-program',
        schemaVersion: '1.0.0',
        designProgramId: 'program-vtol',
        designDomain: 'vehicle.concept',
        executionIntent: 'requires_registered_operations',
        title: 'Original crewed vertical take-off concept',
        objective: 'A four-rotor crewed craft with a rear cargo ramp.',
        constraints: [],
        assumptions: [],
        requirements: [],
        components: [
          {
            id: 'airframe',
            title: 'Airframe',
            role: 'Primary structure.',
            requestedCapabilities: ['vehicle.concept.fuselage.create'],
            requirementIds: [],
            interfaceComponentIds: ['cabin'],
            notes: [],
          },
          {
            id: 'cabin',
            title: 'Cabin',
            role: 'Crew and cargo volume.',
            requestedCapabilities: ['vehicle.concept.cabin.create'],
            requirementIds: [],
            interfaceComponentIds: ['airframe'],
            notes: [],
          },
        ],
        tasks: [
          {
            id: 't1',
            title: 'Define the airframe',
            outcome: 'The airframe envelope is agreed.',
            dependsOn: [],
            componentIds: ['airframe'],
            acceptanceCriteria: ['The envelope has agreed overall dimensions.'],
            requestedCapabilities: [],
            priority: 'high',
          },
        ],
        references: [],
        questions: ['How many crew and passengers?'],
      },
    });
    expect(stored.isError).toBe(false);
    expect(stored.structuredContent.canonicalMutation).toBe('none');

    const coverage = callTool(server, 'arq_assess_design_program_coverage', {
      designProgramId: 'program-vtol',
      projectId: 'project-a',
    });
    expect(coverage.structuredContent.state).toBe('blocked_by_capability');
    const data = coverage.structuredContent.data as {
      coverage: { owningProfileId?: string; blockers: string[] }[];
    };
    expect(data.coverage[0]?.owningProfileId).toBe('vehicle.concept');
    expect(data.coverage[0]?.blockers.length).toBeGreaterThan(0);
    expect(String(coverage.structuredContent.nextAction)).toContain('Do not substitute');

    const profile = callTool(server, 'arq_get_domain_profile', { profileId: 'vehicle.concept' });
    expect(profile.structuredContent.state).toBe('declared_unregistered');
  });
});

describe('resources and prompts', () => {
  it('publishes the schemas the tools actually validate against', () => {
    const server = harnessInitialised();
    const listed = resultOf<{ resources: { uri: string }[] }>(
      call(server, 'resources/list'),
    ).resources;
    expect(listed.map((resource) => resource.uri)).toContain(
      'arq://resource/schema-design-program',
    );

    const read = call(server, 'resources/read', { uri: 'arq://resource/schema-design-program' });
    const contents = resultOf<{ contents: { text: string }[] }>(read).contents;
    const schema = JSON.parse(contents[0]?.text ?? '{}') as { additionalProperties?: boolean };
    expect(schema.additionalProperties).toBe(false);
  });

  it('refuses an unpublished resource uri', () => {
    const server = harnessInitialised();
    const response = call(server, 'resources/read', { uri: 'file:///etc/passwd' });
    expect(response && 'error' in response ? response.error.code : 0).toBe(-32602);
  });

  it('builds a prompt that ends at review, never at applied', () => {
    const server = harnessInitialised();
    const response = call(server, 'prompts/get', {
      name: 'arq_plan_change',
      arguments: { projectId: 'project-a', intent: 'Widen the entrance.' },
    });
    const text = resultOf<{ messages: { content: { text: string } }[] }>(response).messages[0]
      ?.content.text;
    expect(text).toContain('The operator decides in Arq');
    expect(text).toContain('not that it was made');
  });

  it('refuses prompt arguments that do not validate', () => {
    const server = harnessInitialised();
    const response = call(server, 'prompts/get', {
      name: 'arq_plan_change',
      arguments: { projectId: 'project-a' },
    });
    expect(response && 'error' in response ? response.error.code : 0).toBe(-32602);
  });
});

describe('message parsing', () => {
  it('treats an absent id as a notification and a null id as malformed', () => {
    expect(parseMessage({ jsonrpc: '2.0', method: 'ping' }).kind).toBe('notification');
    expect(parseMessage({ jsonrpc: '2.0', id: null, method: 'ping' }).kind).toBe('invalid');
  });

  it('refuses positional parameters, a wrong version and a missing method', () => {
    expect(parseMessage({ jsonrpc: '2.0', id: 1, method: 'ping', params: [1] }).kind).toBe(
      'invalid',
    );
    expect(parseMessage({ jsonrpc: '1.0', id: 1, method: 'ping' }).kind).toBe('invalid');
    expect(parseMessage({ jsonrpc: '2.0', id: 1 }).kind).toBe('invalid');
    expect(parseMessage([1, 2, 3]).kind).toBe('invalid');
  });
});
