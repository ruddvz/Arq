/**
 * One definition, two consumers: runtime validation and JSON Schema.
 *
 * The reviewed MCP System 2.0 package kept a hand-written JSON Schema
 * beside a separate runtime validator and bolted on a generator script
 * plus a drift check to keep them equal (its finding C-09). A generator
 * detects drift after it happens; a single definition makes drift
 * unrepresentable. Every `Validator` here carries the exact JSON Schema
 * that describes the values it accepts, so a tool's advertised
 * `inputSchema` and the code that guards that tool can never disagree.
 *
 * The combinators are deliberately small and dependency-free. This
 * package is the untrusted-input boundary of the whole product - the one
 * place a language model's output becomes structured data - so the
 * validation layer is code this repository can read end to end and
 * property-test, not a pinned external version whose semantics change
 * under it. It also keeps @arq/mcp-server consistent with every other
 * workspace package, which takes a dependency only where the work is
 * genuinely specialist (SQLite, PDF, IFC).
 *
 * Emitted schemas are JSON Schema 2020-12 restricted to the keywords MCP
 * clients actually consume: type, properties, required, additionalProperties,
 * items, enum, const, minimum/maximum, minLength/maxLength, pattern,
 * minItems/maxItems, description. Cross-field rules (graph acyclicity,
 * reference resolution) live in `refine` and are described in prose in the
 * schema's `description`, because no JSON Schema keyword expresses them and
 * a client must not be told they are checked structurally.
 */

import type { JsonObject, JsonValue } from './json-value';
import { isJsonValue } from './json-value';

export const SCHEMA_ISSUE_CODES = {
  type: 'ARQ_MCP_SCHEMA_TYPE',
  range: 'ARQ_MCP_SCHEMA_RANGE',
  pattern: 'ARQ_MCP_SCHEMA_PATTERN',
  enum: 'ARQ_MCP_SCHEMA_ENUM',
  unknownKey: 'ARQ_MCP_SCHEMA_UNKNOWN_KEY',
  missingKey: 'ARQ_MCP_SCHEMA_MISSING_KEY',
  duplicate: 'ARQ_MCP_SCHEMA_DUPLICATE',
  graph: 'ARQ_MCP_SCHEMA_GRAPH',
  union: 'ARQ_MCP_SCHEMA_UNION',
} as const;

export type SchemaIssueCode = (typeof SCHEMA_ISSUE_CODES)[keyof typeof SCHEMA_ISSUE_CODES];

export interface SchemaIssue {
  /** JSON-pointer-like path using dots and bracketed indices, e.g. `components[2].parentId`. `$` is the root. */
  readonly path: string;
  readonly code: SchemaIssueCode;
  readonly message: string;
}

export type SchemaResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly SchemaIssue[] };

export interface Validator<T> {
  readonly jsonSchema: JsonObject;
  validate(value: unknown, path?: string): SchemaResult<T>;
}

export type Infer<V> = V extends Validator<infer T> ? T : never;

/**
 * A validator never reports more than this many issues for one value.
 *
 * An unbounded issue list is a denial-of-service surface in both
 * directions: a 500-element array of wrong-typed entries would otherwise
 * produce 500 messages that must be serialised into a tool result and
 * read by a model. The cap is part of the contract, and `issuesTruncated`
 * tells a caller the list was cut rather than letting it read a short
 * list as "only these problems exist".
 */
export const MAX_SCHEMA_ISSUES = 50;

export function issuesTruncated(issues: readonly SchemaIssue[]): boolean {
  return issues.length >= MAX_SCHEMA_ISSUES;
}

function fail(path: string, code: SchemaIssueCode, message: string): SchemaResult<never> {
  return { ok: false, issues: [{ path, code, message }] };
}

function joinPath(path: string, key: string): string {
  return `${path}.${key}`;
}

function indexPath(path: string, index: number): string {
  return `${path}[${index}]`;
}

function describeType(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

function withDescription(schema: JsonObject, description: string | undefined): JsonObject {
  if (description === undefined) {
    return schema;
  }
  return {
    ...schema,
    description: appendNote(schema.description as string | undefined, description),
  };
}

function appendNote(existing: string | undefined, note: string): string {
  return existing === undefined || existing.length === 0 ? note : `${existing} ${note}`;
}

export interface StringOptions {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: RegExp;
  /** Human-readable statement of what `pattern` accepts, used in the issue message instead of the raw regex source. */
  readonly patternHint?: string;
  readonly description?: string;
}

export function stringValue(options: StringOptions = {}): Validator<string> {
  const schema: Record<string, JsonValue> = { type: 'string' };
  if (options.minLength !== undefined) {
    schema.minLength = options.minLength;
  }
  if (options.maxLength !== undefined) {
    schema.maxLength = options.maxLength;
  }
  if (options.pattern !== undefined) {
    schema.pattern = options.pattern.source;
  }

  return {
    jsonSchema: withDescription(schema, options.description),
    validate(value, path = '$') {
      if (typeof value !== 'string') {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.type,
          `Expected a string, received ${describeType(value)}.`,
        );
      }
      if (options.minLength !== undefined && value.length < options.minLength) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.range,
          `Expected at least ${options.minLength} character(s), received ${value.length}.`,
        );
      }
      if (options.maxLength !== undefined && value.length > options.maxLength) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.range,
          `Expected at most ${options.maxLength} character(s), received ${value.length}.`,
        );
      }
      if (options.pattern !== undefined && !statelessTest(options.pattern, value)) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.pattern,
          options.patternHint ??
            `Value does not match the required format ${options.pattern.source}.`,
        );
      }
      return { ok: true, value };
    },
  };
}

/**
 * Tests a pattern without carrying `lastIndex` state between calls.
 *
 * A `/g` or `/y` regular expression is stateful across `test` calls, which
 * would make validation non-deterministic - the same input accepted on one
 * call and rejected on the next. Recreating the expression without those
 * flags removes the trap rather than relying on every caller to avoid it.
 * Anchoring is the pattern author's job: every pattern in this package is
 * written `^...$` so a partial match cannot pass.
 */
function statelessTest(pattern: RegExp, value: string): boolean {
  const flags = pattern.flags.replace(/[gy]/gu, '');
  return new RegExp(pattern.source, flags).test(value);
}

export interface NumberOptions {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly description?: string;
}

export function integerValue(options: NumberOptions = {}): Validator<number> {
  const schema: Record<string, JsonValue> = { type: 'integer' };
  if (options.minimum !== undefined) {
    schema.minimum = options.minimum;
  }
  if (options.maximum !== undefined) {
    schema.maximum = options.maximum;
  }

  return {
    jsonSchema: withDescription(schema, options.description),
    validate(value, path = '$') {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.type,
          `Expected an integer, received ${describeType(value)}.`,
        );
      }
      return checkNumericRange(value, options, path);
    },
  };
}

export function numberValue(options: NumberOptions = {}): Validator<number> {
  const schema: Record<string, JsonValue> = { type: 'number' };
  if (options.minimum !== undefined) {
    schema.minimum = options.minimum;
  }
  if (options.maximum !== undefined) {
    schema.maximum = options.maximum;
  }

  return {
    jsonSchema: withDescription(schema, options.description),
    validate(value, path = '$') {
      // Non-finite numbers are excluded here rather than downstream: they
      // survive `typeof value === 'number'` but cannot be serialised back
      // to JSON, so accepting one produces a value that no tool result can
      // legally carry.
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.type,
          `Expected a finite number, received ${describeType(value)}.`,
        );
      }
      return checkNumericRange(value, options, path);
    },
  };
}

function checkNumericRange(
  value: number,
  options: NumberOptions,
  path: string,
): SchemaResult<number> {
  if (options.minimum !== undefined && value < options.minimum) {
    return fail(path, SCHEMA_ISSUE_CODES.range, `Expected a value of at least ${options.minimum}.`);
  }
  if (options.maximum !== undefined && value > options.maximum) {
    return fail(path, SCHEMA_ISSUE_CODES.range, `Expected a value of at most ${options.maximum}.`);
  }
  return { ok: true, value };
}

export function booleanValue(description?: string): Validator<boolean> {
  return {
    jsonSchema: withDescription({ type: 'boolean' }, description),
    validate(value, path = '$') {
      if (typeof value !== 'boolean') {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.type,
          `Expected a boolean, received ${describeType(value)}.`,
        );
      }
      return { ok: true, value };
    },
  };
}

export function literalValue<T extends string | number | boolean>(
  expected: T,
  description?: string,
): Validator<T> {
  return {
    jsonSchema: withDescription({ const: expected }, description),
    validate(value, path = '$') {
      if (value !== expected) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.enum,
          `Expected the constant ${JSON.stringify(expected)}.`,
        );
      }
      return { ok: true, value: expected };
    },
  };
}

export function enumValue<const T extends readonly [string, ...string[]]>(
  values: T,
  description?: string,
): Validator<T[number]> {
  const allowed = new Set<string>(values);
  return {
    jsonSchema: withDescription({ type: 'string', enum: [...values] }, description),
    validate(value, path = '$') {
      if (typeof value !== 'string' || !allowed.has(value)) {
        return fail(path, SCHEMA_ISSUE_CODES.enum, `Expected one of: ${values.join(', ')}.`);
      }
      return { ok: true, value: value as T[number] };
    },
  };
}

export interface ArrayOptions<T> {
  readonly minItems?: number;
  readonly maxItems?: number;
  /** Rejects duplicates by the key this returns. Absent means duplicates are allowed. */
  readonly uniqueBy?: (item: T) => string;
  readonly description?: string;
}

export function arrayValue<T>(item: Validator<T>, options: ArrayOptions<T> = {}): Validator<T[]> {
  const schema: Record<string, JsonValue> = { type: 'array', items: item.jsonSchema };
  if (options.minItems !== undefined) {
    schema.minItems = options.minItems;
  }
  if (options.maxItems !== undefined) {
    schema.maxItems = options.maxItems;
  }
  if (options.uniqueBy !== undefined) {
    // Deliberately not `uniqueItems: true`: that keyword means whole-value
    // uniqueness, whereas `uniqueBy` is usually uniqueness by one key
    // (an id). Advertising the wrong keyword would tell a client the
    // server checks something it does not.
    schema.description = appendNote(
      typeof schema.description === 'string' ? schema.description : undefined,
      'Entries must be unique by their identifying key.',
    );
  }

  return {
    jsonSchema: withDescription(schema, options.description),
    validate(value, path = '$') {
      if (!Array.isArray(value)) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.type,
          `Expected an array, received ${describeType(value)}.`,
        );
      }
      if (options.minItems !== undefined && value.length < options.minItems) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.range,
          `Expected at least ${options.minItems} item(s), received ${value.length}.`,
        );
      }
      // The length ceiling is checked before element validation so an
      // oversized array costs one comparison rather than N validations.
      if (options.maxItems !== undefined && value.length > options.maxItems) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.range,
          `Expected at most ${options.maxItems} item(s), received ${value.length}.`,
        );
      }

      const issues: SchemaIssue[] = [];
      const parsed: T[] = [];
      for (const [index, entry] of value.entries()) {
        const result = item.validate(entry, indexPath(path, index));
        if (result.ok) {
          parsed.push(result.value);
        } else {
          issues.push(...result.issues);
          if (issues.length >= MAX_SCHEMA_ISSUES) {
            return { ok: false, issues: issues.slice(0, MAX_SCHEMA_ISSUES) };
          }
        }
      }
      if (issues.length > 0) {
        return { ok: false, issues };
      }

      const uniqueBy = options.uniqueBy;
      if (uniqueBy !== undefined) {
        const seen = new Map<string, number>();
        for (const [index, entry] of parsed.entries()) {
          const key = uniqueBy(entry);
          const first = seen.get(key);
          if (first !== undefined) {
            issues.push({
              path: indexPath(path, index),
              code: SCHEMA_ISSUE_CODES.duplicate,
              message: `Duplicate entry "${key}" also appears at index ${first}.`,
            });
          } else {
            seen.set(key, index);
          }
        }
        if (issues.length > 0) {
          return { ok: false, issues: issues.slice(0, MAX_SCHEMA_ISSUES) };
        }
      }

      return { ok: true, value: parsed };
    },
  };
}

export type ValidatorRecord = Readonly<Record<string, Validator<unknown>>>;

type RequiredShape<R extends ValidatorRecord> = { readonly [K in keyof R]: Infer<R[K]> };
type OptionalShape<O extends ValidatorRecord> = { readonly [K in keyof O]?: Infer<O[K]> };

export interface ObjectOptions<R extends ValidatorRecord, O extends ValidatorRecord> {
  readonly required?: R;
  readonly optional?: O;
  readonly title?: string;
  readonly description?: string;
}

/**
 * A closed object: unknown keys are an error, never silently dropped.
 *
 * Silently dropping an unknown key is how a model's misremembered field
 * name becomes an invisible no-op - the call "succeeds" and the field it
 * meant to set is simply absent. Rejecting the key turns that into a
 * message the model can act on, and it also closes the smuggling route
 * where extra properties ride along to a downstream consumer that reads
 * them.
 *
 * The two overloads exist so that an object with no optional keys gets an
 * exact type. A single signature with a defaulted `O` would fall back to
 * `ValidatorRecord`, whose `keyof` is `string`, and the resulting index
 * signature would widen every property to `unknown` - which in turn breaks
 * discriminated-union narrowing for anything built out of these objects.
 */
export function objectValue<R extends ValidatorRecord>(
  options: ObjectOptions<R, never> & { readonly required: R; readonly optional?: undefined },
): Validator<RequiredShape<R>>;
export function objectValue<R extends ValidatorRecord, O extends ValidatorRecord>(
  options: ObjectOptions<R, O> & { readonly required: R; readonly optional: O },
): Validator<RequiredShape<R> & OptionalShape<O>>;
export function objectValue<R extends ValidatorRecord, O extends ValidatorRecord>(
  options: ObjectOptions<R, O>,
): Validator<RequiredShape<R> & OptionalShape<O>> {
  const required = (options.required ?? {}) as R;
  const optional = (options.optional ?? {}) as O;
  const requiredKeys = Object.keys(required);
  const optionalKeys = Object.keys(optional);

  const properties: Record<string, JsonValue> = {};
  for (const key of requiredKeys) {
    properties[key] = required[key]!.jsonSchema;
  }
  for (const key of optionalKeys) {
    properties[key] = optional[key]!.jsonSchema;
  }

  const schema: Record<string, JsonValue> = {
    type: 'object',
    properties,
    required: [...requiredKeys].sort(),
    additionalProperties: false,
  };
  if (options.title !== undefined) {
    schema.title = options.title;
  }

  return {
    jsonSchema: withDescription(schema, options.description),
    validate(value, path = '$') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.type,
          `Expected an object, received ${describeType(value)}.`,
        );
      }

      const source = value as Record<string, unknown>;
      const issues: SchemaIssue[] = [];
      const output: Record<string, unknown> = {};

      const known = new Set([...requiredKeys, ...optionalKeys]);
      for (const key of Object.keys(source)) {
        if (!known.has(key)) {
          issues.push({
            path: joinPath(path, key),
            code: SCHEMA_ISSUE_CODES.unknownKey,
            message: `Unknown property "${key}". Allowed properties: ${[...known].sort().join(', ') || 'none'}.`,
          });
        }
      }

      for (const key of requiredKeys) {
        if (!Object.hasOwn(source, key) || source[key] === undefined) {
          issues.push({
            path: joinPath(path, key),
            code: SCHEMA_ISSUE_CODES.missingKey,
            message: `Missing required property "${key}".`,
          });
          continue;
        }
        const result = required[key]!.validate(source[key], joinPath(path, key));
        if (result.ok) {
          output[key] = result.value;
        } else {
          issues.push(...result.issues);
        }
      }

      for (const key of optionalKeys) {
        // `exactOptionalPropertyTypes` is on across this repository, so an
        // explicit `undefined` is not the same as an absent key. Treating a
        // present-but-undefined property as absent keeps clients that
        // serialise `{ "a": undefined }` away from `{ a: undefined }`
        // reaching a consumer that only guards `'a' in value`.
        if (!Object.hasOwn(source, key) || source[key] === undefined) {
          continue;
        }
        const result = optional[key]!.validate(source[key], joinPath(path, key));
        if (result.ok) {
          output[key] = result.value;
        } else {
          issues.push(...result.issues);
        }
      }

      if (issues.length > 0) {
        return { ok: false, issues: issues.slice(0, MAX_SCHEMA_ISSUES) };
      }
      return { ok: true, value: output as RequiredShape<R> & OptionalShape<O> };
    },
  };
}

export interface RecordOptions {
  readonly keyPattern: RegExp;
  readonly keyHint: string;
  readonly maxProperties: number;
  readonly description?: string;
}

export function recordValue<T>(
  value: Validator<T>,
  options: RecordOptions,
): Validator<Readonly<Record<string, T>>> {
  return {
    jsonSchema: withDescription(
      {
        type: 'object',
        propertyNames: { pattern: options.keyPattern.source },
        additionalProperties: value.jsonSchema,
        maxProperties: options.maxProperties,
      },
      options.description,
    ),
    validate(input, path = '$') {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.type,
          `Expected an object, received ${describeType(input)}.`,
        );
      }
      const source = input as Record<string, unknown>;
      const keys = Object.keys(source);
      if (keys.length > options.maxProperties) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.range,
          `Expected at most ${options.maxProperties} propert(ies), received ${keys.length}.`,
        );
      }

      const issues: SchemaIssue[] = [];
      const output: Record<string, T> = {};
      for (const key of keys) {
        if (!statelessTest(options.keyPattern, key)) {
          issues.push({
            path: joinPath(path, key),
            code: SCHEMA_ISSUE_CODES.pattern,
            message: options.keyHint,
          });
          continue;
        }
        const result = value.validate(source[key], joinPath(path, key));
        if (result.ok) {
          output[key] = result.value;
        } else {
          issues.push(...result.issues);
        }
      }
      if (issues.length > 0) {
        return { ok: false, issues: issues.slice(0, MAX_SCHEMA_ISSUES) };
      }
      return { ok: true, value: output };
    },
  };
}

/** Any JSON value. Used only where a schema is genuinely open, such as an operation's arguments before its own profile schema is applied. */
export function jsonValue(description?: string): Validator<JsonValue> {
  return {
    jsonSchema: withDescription({}, description),
    validate(value, path = '$') {
      if (!isJsonValue(value)) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.type,
          'Expected a JSON value: no undefined, function, cycle, NaN or Infinity.',
        );
      }
      return { ok: true, value: value as JsonValue };
    },
  };
}

/**
 * Adds cross-field rules that no JSON Schema keyword can express.
 *
 * The refinement runs only after the structural validator succeeded, so a
 * graph check never has to defend against a missing or wrong-typed field.
 */
export function refine<T>(
  base: Validator<T>,
  check: (value: T, report: (path: string, message: string) => void) => void,
  schemaNote?: string,
): Validator<T> {
  const jsonSchema =
    schemaNote === undefined
      ? base.jsonSchema
      : {
          ...base.jsonSchema,
          description:
            typeof base.jsonSchema.description === 'string'
              ? `${base.jsonSchema.description} ${schemaNote}`
              : schemaNote,
        };

  return {
    jsonSchema,
    validate(value, path = '$') {
      const result = base.validate(value, path);
      if (!result.ok) {
        return result;
      }
      const issues: SchemaIssue[] = [];
      check(result.value, (issuePath, message) => {
        if (issues.length < MAX_SCHEMA_ISSUES) {
          issues.push({ path: issuePath, code: SCHEMA_ISSUE_CODES.graph, message });
        }
      });
      return issues.length > 0 ? { ok: false, issues } : result;
    },
  };
}

/** Renders issues as one deterministic line per issue, ordered as reported, for a tool result message. */
export function formatIssues(issues: readonly SchemaIssue[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join(' ');
}

/**
 * A closed union discriminated by one literal property.
 *
 * Used for operation preconditions, where each kind carries different
 * fields. Validating by discriminant rather than by "try each variant and
 * collect every failure" matters for the error message: a caller who sent
 * a known kind with one bad field should be told about that field, not
 * shown why their value failed to match all four variants.
 */
export function taggedUnion<V extends ValidatorRecord>(
  discriminant: string,
  variants: V,
  description?: string,
): Validator<Infer<V[keyof V]>> {
  type Union = Infer<V[keyof V]>;
  const names = Object.keys(variants).sort();
  const schema: Record<string, JsonValue> = {
    oneOf: names.map((name) => variants[name]!.jsonSchema),
  };

  return {
    jsonSchema: withDescription(schema, description),
    validate(value, path = '$') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.type,
          `Expected an object, received ${describeType(value)}.`,
        );
      }
      const tag = (value as Record<string, unknown>)[discriminant];
      if (typeof tag !== 'string' || !Object.hasOwn(variants, tag)) {
        return fail(
          path,
          SCHEMA_ISSUE_CODES.union,
          `Expected "${discriminant}" to be one of: ${names.join(', ')}.`,
        );
      }
      // The discriminant selected the variant, so its parsed value is one
      // member of the union this validator reports. TypeScript cannot see
      // that through the index, hence the single narrowing cast here rather
      // than at every call site.
      return variants[tag]!.validate(value, path) as SchemaResult<Union>;
    },
  };
}
