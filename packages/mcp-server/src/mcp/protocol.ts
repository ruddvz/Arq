/**
 * JSON-RPC 2.0 and the Model Context Protocol handshake, implemented here
 * rather than imported.
 *
 * The reviewed 2.0 package depended on `@modelcontextprotocol/server@2.0.0`
 * and `zod@4.4.3` pinned exactly, which is how a boundary whose entire job
 * is to be trustworthy ends up with its parsing, its framing and its error
 * mapping supplied by versions this repository never reads. The protocol
 * itself is small: a request envelope, a response envelope, a version
 * negotiation and nine methods. Implementing it is less code than
 * auditing a dependency, it keeps @arq/mcp-server consistent with every
 * other package in this workspace, and it means a protocol change is a
 * visible diff here rather than a version bump elsewhere.
 *
 * Version negotiation follows the specification's rule: the server answers
 * with the client's requested version when it supports it, and otherwise
 * with its own latest. A client that cannot accept the answer disconnects.
 */

import type { JsonObject, JsonValue } from '../schema/json-value';

/** Newest first. The order is the preference order used when a client asks for something unsupported. */
export const SUPPORTED_PROTOCOL_VERSIONS = ['2026-07-28', '2025-06-18', '2025-03-26'] as const;

export type ProtocolVersion = (typeof SUPPORTED_PROTOCOL_VERSIONS)[number];

export const LATEST_PROTOCOL_VERSION: ProtocolVersion = SUPPORTED_PROTOCOL_VERSIONS[0];

export function negotiateProtocolVersion(requested: string | undefined): ProtocolVersion {
  if (requested !== undefined && isSupportedProtocolVersion(requested)) {
    return requested;
  }
  return LATEST_PROTOCOL_VERSION;
}

export function isSupportedProtocolVersion(value: string): value is ProtocolVersion {
  return (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(value);
}

export type JsonRpcId = string | number;

export interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id?: JsonRpcId;
  readonly method: string;
  readonly params?: JsonObject;
}

export interface JsonRpcSuccess {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId;
  readonly result: JsonValue;
}

export interface JsonRpcFailure {
  readonly jsonrpc: '2.0';
  readonly id: JsonRpcId | null;
  readonly error: {
    readonly code: number;
    readonly message: string;
    readonly data?: JsonValue;
  };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

export const JSON_RPC_ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const;

export function success(id: JsonRpcId, result: JsonValue): JsonRpcSuccess {
  return { jsonrpc: '2.0', id, result };
}

export function failure(
  id: JsonRpcId | null,
  code: number,
  message: string,
  data?: JsonValue,
): JsonRpcFailure {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  };
}

/**
 * Parses one message, refusing anything that is not a well-formed request
 * or notification.
 *
 * Returned as a discriminated result rather than thrown: the transport has
 * to answer a malformed message with a JSON-RPC error, and losing the
 * identifier to an exception would make that impossible.
 */
export type ParsedMessage =
  | { readonly kind: 'request'; readonly request: JsonRpcRequest & { readonly id: JsonRpcId } }
  | { readonly kind: 'notification'; readonly request: JsonRpcRequest }
  | { readonly kind: 'invalid'; readonly id: JsonRpcId | null; readonly reason: string };

export function parseMessage(value: unknown): ParsedMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { kind: 'invalid', id: null, reason: 'A JSON-RPC message must be an object.' };
  }
  const record = value as Record<string, unknown>;
  const rawId = record.id;
  const id =
    typeof rawId === 'string' || (typeof rawId === 'number' && Number.isInteger(rawId))
      ? (rawId as JsonRpcId)
      : null;

  if (record.jsonrpc !== '2.0') {
    return { kind: 'invalid', id, reason: 'Only JSON-RPC 2.0 is supported.' };
  }
  if (typeof record.method !== 'string' || record.method.length === 0) {
    return { kind: 'invalid', id, reason: 'A JSON-RPC message must name a method.' };
  }
  if (
    record.params !== undefined &&
    (typeof record.params !== 'object' || record.params === null || Array.isArray(record.params))
  ) {
    // Positional parameters are legal JSON-RPC and are not used anywhere in
    // MCP; accepting them would mean guessing which argument is which.
    return { kind: 'invalid', id, reason: 'Parameters must be an object, not an array.' };
  }

  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    method: record.method,
    ...(id === null ? {} : { id }),
    ...(record.params === undefined ? {} : { params: record.params as JsonObject }),
  };

  // Absence of `id` is what distinguishes a notification, which must never
  // be answered. `id: null` is not a notification, it is a malformed
  // request, and is reported as one above.
  if (rawId === undefined) {
    return { kind: 'notification', request };
  }
  if (id === null) {
    return {
      kind: 'invalid',
      id: null,
      reason: 'A request identifier must be a string or integer.',
    };
  }
  return { kind: 'request', request: { ...request, id } };
}

export interface ClientIdentity {
  readonly name: string;
  readonly version: string;
}

export const UNKNOWN_CLIENT: ClientIdentity = { name: 'unknown-client', version: '0.0.0' };

/** Reads the client identity from `initialize`, defaulting rather than failing: a client that omits it is unhelpful, not hostile. */
export function readClientIdentity(params: JsonObject | undefined): ClientIdentity {
  const info = params?.clientInfo;
  if (typeof info !== 'object' || info === null || Array.isArray(info)) {
    return UNKNOWN_CLIENT;
  }
  const record = info as Record<string, JsonValue>;
  const name =
    typeof record.name === 'string' && record.name.length > 0 ? record.name : UNKNOWN_CLIENT.name;
  const version =
    typeof record.version === 'string' && record.version.length > 0
      ? record.version
      : UNKNOWN_CLIENT.version;
  // Bounded, because both values are recorded as provenance on stored plans.
  return { name: name.slice(0, 120), version: version.slice(0, 60) };
}
