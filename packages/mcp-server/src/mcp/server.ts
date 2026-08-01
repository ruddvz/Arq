/**
 * The method dispatcher.
 *
 * The method table is a closed allowlist. An unknown method is answered
 * with `method not found` rather than being routed anywhere, and there is
 * no dynamic registration, so the reachable surface of this server is
 * exactly what this file lists.
 *
 * Two boundaries are worth pointing out.
 *
 * A tool that fails for a domain reason - a missing scope, a stale
 * revision, a capability Arq does not have - is a successful JSON-RPC call
 * whose result carries `isError: true`. That is the protocol's own
 * distinction and it matters here: those failures are content the model
 * must read and act on, and a transport-level error would strip the
 * structured explanation down to a string.
 *
 * A tool call before `initialize`, or without a grant, is refused rather
 * than served with a default. The reviewed 2.0 package had no notion of a
 * grant at all, so every connection reached every fixture project the
 * moment it connected.
 */

import type { JsonObject, JsonValue } from '../schema/json-value';
import { toJsonValue } from '../schema/json-value';
import { formatIssues, issuesTruncated } from '../schema/schema';
import type { GrantContext } from '../grant/grant';
import type { ArqBridge } from '../adapter/bridge-adapter';
import type { ToolService } from '../service/tool-service';
import { toJsonObject } from '../domain/envelope';
import { SERVER_INSTRUCTIONS } from './instructions';
import {
  JSON_RPC_ERRORS,
  type ClientIdentity,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type ProtocolVersion,
  UNKNOWN_CLIENT,
  failure,
  negotiateProtocolVersion,
  readClientIdentity,
  success,
} from './protocol';
import { describePromptsForList, promptByName } from './prompts';
import { describeResourcesForList, resourceByUri } from './resources';
import { describeToolsForList, toolByName } from './tools';

export const SERVER_INFO = {
  name: 'arq-mcp-server',
  title: 'Arq',
  version: '3.0.0',
} as const;

export interface ArqMcpServerOptions {
  readonly bridge: ArqBridge;
  readonly service: ToolService;
  /**
   * Supplies the grant for a connected client.
   *
   * The Arq application decides this from what the operator shared. The
   * server never constructs a grant, and there is no default: a client the
   * operator has not shared anything with gets no project access, not a
   * read-only one.
   */
  readonly resolveGrant: (client: ClientIdentity) => GrantContext | undefined;
}

export interface ArqMcpServer {
  /** Handles one parsed message. Returns `undefined` for a notification, which must never be answered. */
  handle(request: JsonRpcRequest): JsonRpcResponse | undefined;
  readonly initialized: boolean;
  readonly protocolVersion: ProtocolVersion | undefined;
  readonly client: ClientIdentity;
}

export function createArqMcpServer(options: ArqMcpServerOptions): ArqMcpServer {
  let initialized = false;
  let protocolVersion: ProtocolVersion | undefined;
  let client: ClientIdentity = UNKNOWN_CLIENT;

  const server: ArqMcpServer = {
    get initialized() {
      return initialized;
    },
    get protocolVersion() {
      return protocolVersion;
    },
    get client() {
      return client;
    },
    handle(request) {
      const id = request.id;
      const isNotification = id === undefined;

      if (request.method === 'notifications/initialized') {
        initialized = true;
        return undefined;
      }
      if (request.method.startsWith('notifications/')) {
        // Every other notification is accepted and ignored: a server that
        // errors on an unrecognised notification breaks clients that send
        // progress or cancellation it never asked for.
        return undefined;
      }
      if (isNotification) {
        return undefined;
      }

      switch (request.method) {
        case 'initialize': {
          const requested = request.params?.protocolVersion;
          protocolVersion = negotiateProtocolVersion(
            typeof requested === 'string' ? requested : undefined,
          );
          client = readClientIdentity(request.params);
          initialized = true;
          return success(id, {
            protocolVersion,
            serverInfo: { ...SERVER_INFO },
            capabilities: {
              tools: { listChanged: false },
              resources: { listChanged: false, subscribe: false },
              prompts: { listChanged: false },
            },
            instructions: SERVER_INSTRUCTIONS,
          });
        }

        case 'ping':
          return success(id, {});

        case 'tools/list':
          return success(id, { tools: describeToolsForList() as JsonValue });

        case 'resources/list':
          return success(id, { resources: describeResourcesForList() as JsonValue });

        case 'resources/templates/list':
          // Declared and empty rather than absent: a client that asks must
          // get a well-formed answer, and there are no templated resources.
          return success(id, { resourceTemplates: [] });

        case 'prompts/list':
          return success(id, { prompts: describePromptsForList() as JsonValue });

        case 'resources/read':
          return handleResourceRead(id, request.params);

        case 'prompts/get':
          return handlePromptGet(id, request.params);

        case 'tools/call':
          return handleToolCall(id, request.params);

        default:
          return failure(
            id,
            JSON_RPC_ERRORS.methodNotFound,
            `This server does not implement "${request.method}".`,
          );
      }
    },
  };

  function handleResourceRead(
    id: string | number,
    params: JsonObject | undefined,
  ): JsonRpcResponse {
    const uri = params?.uri;
    if (typeof uri !== 'string') {
      return failure(id, JSON_RPC_ERRORS.invalidParams, 'A resource read must name a uri.');
    }
    const resource = resourceByUri(uri);
    if (resource === undefined) {
      return failure(id, JSON_RPC_ERRORS.invalidParams, `No resource is published at "${uri}".`);
    }
    return success(id, {
      contents: [{ uri: resource.uri, mimeType: resource.mimeType, text: resource.read() }],
    });
  }

  function handlePromptGet(id: string | number, params: JsonObject | undefined): JsonRpcResponse {
    const name = params?.name;
    if (typeof name !== 'string') {
      return failure(id, JSON_RPC_ERRORS.invalidParams, 'A prompt request must name a prompt.');
    }
    const prompt = promptByName(name);
    if (prompt === undefined) {
      return failure(id, JSON_RPC_ERRORS.invalidParams, `No prompt is published as "${name}".`);
    }
    const parsed = prompt.input.validate(params?.arguments ?? {}, '$.arguments');
    if (!parsed.ok) {
      return failure(
        id,
        JSON_RPC_ERRORS.invalidParams,
        `Those prompt arguments are not valid: ${formatIssues(parsed.issues)}`,
      );
    }
    return success(id, {
      description: prompt.description,
      messages: [{ role: 'user', content: { type: 'text', text: prompt.build(parsed.value) } }],
    });
  }

  function handleToolCall(id: string | number, params: JsonObject | undefined): JsonRpcResponse {
    const name = params?.name;
    if (typeof name !== 'string') {
      return failure(id, JSON_RPC_ERRORS.invalidParams, 'A tool call must name a tool.');
    }
    const tool = toolByName(name);
    if (tool === undefined) {
      return failure(
        id,
        JSON_RPC_ERRORS.methodNotFound,
        `This server has no tool called "${name}".`,
      );
    }
    if (!initialized) {
      return failure(id, JSON_RPC_ERRORS.invalidRequest, 'Call initialize before calling a tool.');
    }

    const grant = options.resolveGrant(client);
    if (grant === undefined) {
      return success(
        id,
        toolResult({
          ok: false,
          code: 'ARQ_NO_GRANT',
          state: 'no_grant',
          message:
            'Nothing is shared with this connection yet. No project was read and nothing was changed.',
          nextAction:
            'Ask the operator to share a project with this client in Arq, then call arq_get_capabilities again.',
          retry: 'after_grant_renewal',
          warnings: [],
          traceId: 'trace-no-grant',
          canonicalMutation: 'none',
        }),
      );
    }

    const parsed = tool.input.validate(params?.arguments ?? {}, '$.arguments');
    if (!parsed.ok) {
      // An argument-shaped mistake is content, not a transport failure: the
      // model needs the paths and the messages to fix its next call.
      return success(
        id,
        toolResult({
          ok: false,
          code: 'ARQ_INPUT_INVALID',
          state: 'input_invalid',
          message: `Those arguments do not match the tool's schema: ${formatIssues(parsed.issues)}${
            issuesTruncated(parsed.issues) ? ' More problems were found than are listed here.' : ''
          }`,
          nextAction:
            'Read the tool’s inputSchema from tools/list, correct the arguments, and call it again.',
          retry: 'never',
          warnings: [],
          traceId: 'trace-input-invalid',
          canonicalMutation: 'none',
        }),
      );
    }

    const projectId = tool.projectIdOf(parsed.value);
    const envelope = options.service.run({
      tool: tool.name,
      grant,
      request: toJsonValue(parsed.value),
      work: () => tool.run({ bridge: options.bridge, grant }, parsed.value),
      describe: (outcome) => outcome,
      ...(projectId === undefined ? {} : { projectId }),
    });

    return success(id, toolResult(envelope));
  }

  return server;
}

/**
 * The MCP tool result.
 *
 * `content` carries the human-readable message and the next action, because
 * some clients render only that. `structuredContent` carries the whole
 * envelope, including `canonicalMutation`, which is the field that decides
 * whether an assistant may say a project changed.
 */
function toolResult(envelope: Parameters<typeof toJsonObject>[0]): JsonValue {
  const object = toJsonObject(envelope);
  return {
    content: [{ type: 'text', text: `${envelope.message} ${envelope.nextAction}` }],
    structuredContent: object,
    isError: !envelope.ok,
  };
}
