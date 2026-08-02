/**
 * The JSON value lattice every MCP payload is confined to.
 *
 * MCP tool arguments, tool results, resource contents and JSON Schema
 * documents are all JSON. Modelling that explicitly (rather than passing
 * `unknown` around and casting at the edges) is what lets
 * `canonicalJson` below be total: it can reject a non-JSON value loudly
 * instead of silently emitting `undefined` or dropping a function.
 *
 * `JsonObject` is intentionally mutable-keyed but `readonly`-valued: the
 * builders in this package assemble objects key by key, while callers
 * that receive one must not mutate what they were handed.
 */

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/** True for values that can round-trip through JSON without loss. Rejects `undefined`, functions, symbols, NaN, Infinity and cyclic graphs. */
export function isJsonValue(value: unknown, seen: ReadonlySet<object> = new Set()): boolean {
  if (value === null) {
    return true;
  }
  const kind = typeof value;
  if (kind === 'string' || kind === 'boolean') {
    return true;
  }
  if (kind === 'number') {
    return Number.isFinite(value as number);
  }
  if (kind !== 'object') {
    return false;
  }
  const object = value as object;
  if (seen.has(object)) {
    return false;
  }
  const nextSeen = new Set(seen).add(object);
  if (Array.isArray(object)) {
    return object.every((entry) => isJsonValue(entry, nextSeen));
  }
  if (
    Object.getPrototypeOf(object) !== Object.prototype &&
    Object.getPrototypeOf(object) !== null
  ) {
    return false;
  }
  return Object.values(object as Record<string, unknown>).every((entry) =>
    isJsonValue(entry, nextSeen),
  );
}

/**
 * Deterministic JSON with object keys sorted at every depth.
 *
 * Every content hash, idempotency fingerprint and proposal hash in this
 * package is taken over this string, so two structurally equal payloads
 * that differ only in key order must produce the same bytes. `JSON.stringify`
 * alone does not guarantee that, because it preserves insertion order.
 */
export function canonicalJson(value: JsonValue): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: JsonValue): JsonValue {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  const source = value as JsonObject;
  const output: Record<string, JsonValue> = {};
  for (const key of Object.keys(source).sort()) {
    output[key] = sortKeys(source[key] as JsonValue);
  }
  return output;
}

/** The UTF-8 byte length of a value's canonical JSON - the unit every response budget in this package is measured in. */
export function canonicalByteLength(value: JsonValue): number {
  return new TextEncoder().encode(canonicalJson(value)).byteLength;
}

/**
 * Asserts that a value is JSON, and types it as such.
 *
 * Used at the point where a domain object becomes a tool result. Throwing
 * here rather than serialising loosely means a field that cannot survive
 * the boundary - an `undefined`, a `Map`, a `Date` - is a loud failure in
 * the server's own tests rather than a silently missing property in a
 * client's structured content.
 */
export function toJsonValue(value: unknown): JsonValue {
  if (!isJsonValue(value)) {
    throw new TypeError('value is not JSON and cannot cross the MCP boundary');
  }
  return value as JsonValue;
}
