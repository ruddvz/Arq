import { isSensitiveFieldName, redactSensitiveFields } from './redact-sensitive-fields';

/**
 * V3-189: an event may only carry fields somebody declared in advance.
 *
 * `redactSensitiveFields` is a denylist, and it is a good one - it recurses
 * through arrays, normalises key casing, and names section 118's fields
 * explicitly. A denylist still has the property every denylist has: it protects
 * against the fields whose names were thought of. A payload assembled from an
 * API response and logged wholesale carries `siteAddress`, `ownerEmail` and
 * `lastPromptText` past a list that names `address`, `clientName` and
 * `rawPrompt`, and nothing anywhere reports a problem, because from the
 * redactor's point of view nothing happened.
 *
 * So this is the allowlist half. An event type declares its fields; a field not
 * declared is dropped and *reported* rather than sent. The reporting matters as
 * much as the dropping: a silently dropped field looks identical to a field
 * that was never there, so a mis-named field would be discovered as missing
 * data months later rather than as a rejected event immediately.
 *
 * The two run together, in this order. The allowlist decides which fields may
 * exist; the denylist then runs over what survives, because a declared field
 * can still be given a sensitive value by a caller passing the wrong variable -
 * an allowlist checks names, not contents, and a field called `count` holding
 * a project name is a mistake no schema can catch. Neither is sufficient; each
 * covers the other's blind spot.
 */

export type TelemetryFieldType = 'string' | 'number' | 'boolean' | 'enum';

export interface TelemetryFieldSpec {
  readonly name: string;
  readonly type: TelemetryFieldType;
  /** Required for `enum`. The value must be one of these, so a free-text field cannot masquerade as a category. */
  readonly allowedValues?: readonly string[];
  /**
   * Maximum length for a string field. Required, because an unbounded string is
   * how free text reaches a telemetry pipeline through a field that was
   * declared for an identifier.
   */
  readonly maxLength?: number;
}

export interface TelemetryEventSchema {
  readonly eventName: string;
  readonly fields: readonly TelemetryFieldSpec[];
}

export const TELEMETRY_REJECTION_CODES = {
  unknownEvent: 'ARQ_TELEMETRY_UNKNOWN_EVENT',
  undeclaredField: 'ARQ_TELEMETRY_UNDECLARED_FIELD',
  wrongType: 'ARQ_TELEMETRY_WRONG_TYPE',
  valueNotAllowed: 'ARQ_TELEMETRY_VALUE_NOT_ALLOWED',
  tooLong: 'ARQ_TELEMETRY_TOO_LONG',
  sensitiveFieldName: 'ARQ_TELEMETRY_SENSITIVE_FIELD_NAME',
  unboundedString: 'ARQ_TELEMETRY_UNBOUNDED_STRING',
} as const;

export type TelemetryRejectionCode =
  (typeof TELEMETRY_REJECTION_CODES)[keyof typeof TELEMETRY_REJECTION_CODES];

export interface TelemetryViolation {
  readonly code: TelemetryRejectionCode;
  readonly field?: string;
  readonly detail: string;
}

export type TelemetryValidation =
  | {
      readonly status: 'accepted';
      /** Only the declared fields, with the denylist applied on top. */
      readonly payload: Readonly<Record<string, unknown>>;
    }
  | { readonly status: 'rejected'; readonly violations: readonly TelemetryViolation[] };

/**
 * Checks a schema itself.
 *
 * Run over the registry at startup and in a test, because a schema that
 * declares an unbounded string or a field named `projectName` would grant in
 * one line what the whole mechanism exists to prevent. It is much easier to get
 * this wrong when adding an event than when designing the system, which is
 * exactly why it is checked rather than reviewed.
 */
export function validateSchema(schema: TelemetryEventSchema): readonly TelemetryViolation[] {
  const violations: TelemetryViolation[] = [];

  for (const field of schema.fields) {
    if (isSensitiveFieldName(field.name)) {
      violations.push({
        code: TELEMETRY_REJECTION_CODES.sensitiveFieldName,
        field: field.name,
        detail: `"${field.name}" names a field the privacy policy excludes`,
      });
    }
    if (field.type === 'string' && field.maxLength === undefined) {
      violations.push({
        code: TELEMETRY_REJECTION_CODES.unboundedString,
        field: field.name,
        detail: `"${field.name}" is an unbounded string, which is how free text reaches the pipeline`,
      });
    }
    if (field.type === 'enum' && (field.allowedValues ?? []).length === 0) {
      violations.push({
        code: TELEMETRY_REJECTION_CODES.valueNotAllowed,
        field: field.name,
        detail: `"${field.name}" is an enum with no values, which admits anything`,
      });
    }
  }

  return violations;
}

/**
 * Validates an event against its schema.
 *
 * Collects every violation rather than stopping at the first, because a caller
 * fixing an event wants the whole list. A rejected event is not sent at all -
 * not sent-with-holes - since a partial event is a data point that looks
 * complete and is not, and an analysis reading it cannot tell.
 */
export function validateTelemetryEvent(
  schema: TelemetryEventSchema,
  payload: Readonly<Record<string, unknown>>,
): TelemetryValidation {
  const violations: TelemetryViolation[] = [];
  const byName = new Map(schema.fields.map((field) => [field.name, field]));
  const accepted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    const spec = byName.get(key);
    if (spec === undefined) {
      // Reported, not silently dropped: a silently dropped field is
      // indistinguishable from one that was never sent, so a typo would surface
      // months later as missing data rather than now as a rejected event.
      violations.push({
        code: TELEMETRY_REJECTION_CODES.undeclaredField,
        field: key,
        detail: `"${key}" is not declared on ${schema.eventName}`,
      });
      continue;
    }

    const fieldViolation = checkValue(spec, value);
    if (fieldViolation !== null) {
      violations.push(fieldViolation);
      continue;
    }

    accepted[key] = value;
  }

  if (violations.length > 0) {
    return { status: 'rejected', violations };
  }

  // The denylist runs over what the allowlist admitted: a declared field can
  // still be handed a sensitive value by a caller passing the wrong variable,
  // and an allowlist checks names rather than contents.
  return { status: 'accepted', payload: redactSensitiveFields(accepted) };
}

function checkValue(spec: TelemetryFieldSpec, value: unknown): TelemetryViolation | null {
  switch (spec.type) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? null
        : {
            code: TELEMETRY_REJECTION_CODES.wrongType,
            field: spec.name,
            detail: `"${spec.name}" must be a finite number`,
          };
    case 'boolean':
      return typeof value === 'boolean'
        ? null
        : {
            code: TELEMETRY_REJECTION_CODES.wrongType,
            field: spec.name,
            detail: `"${spec.name}" must be a boolean`,
          };
    case 'enum':
      if (typeof value !== 'string') {
        return {
          code: TELEMETRY_REJECTION_CODES.wrongType,
          field: spec.name,
          detail: `"${spec.name}" must be a string`,
        };
      }
      return (spec.allowedValues ?? []).includes(value)
        ? null
        : {
            code: TELEMETRY_REJECTION_CODES.valueNotAllowed,
            field: spec.name,
            detail: `"${value}" is not a declared value of ${spec.name}`,
          };
    case 'string': {
      if (typeof value !== 'string') {
        return {
          code: TELEMETRY_REJECTION_CODES.wrongType,
          field: spec.name,
          detail: `"${spec.name}" must be a string`,
        };
      }
      const limit = spec.maxLength;
      if (limit !== undefined && value.length > limit) {
        return {
          code: TELEMETRY_REJECTION_CODES.tooLong,
          field: spec.name,
          detail: `"${spec.name}" is ${value.length} characters, over its ${limit} limit`,
        };
      }
      return null;
    }
  }
}

/**
 * A registry of event schemas.
 *
 * `validate` refuses an event whose name is not registered, rather than letting
 * an unregistered event through unchecked. An unknown event is the one case
 * where there is no schema to check against, and treating "no schema" as "no
 * constraints" would make registration optional in practice.
 */
export function createTelemetryRegistry(schemas: readonly TelemetryEventSchema[]) {
  const byName = new Map(schemas.map((schema) => [schema.eventName, schema]));

  function validate(
    eventName: string,
    payload: Readonly<Record<string, unknown>>,
  ): TelemetryValidation {
    const schema = byName.get(eventName);
    if (schema === undefined) {
      return {
        status: 'rejected',
        violations: [
          {
            code: TELEMETRY_REJECTION_CODES.unknownEvent,
            detail: `"${eventName}" is not a registered event`,
          },
        ],
      };
    }
    return validateTelemetryEvent(schema, payload);
  }

  /** Every schema problem across the registry. Run in a test, so a bad schema fails a build rather than a review. */
  function validateAllSchemas(): readonly TelemetryViolation[] {
    return schemas.flatMap(validateSchema);
  }

  return { validate, validateAllSchemas, eventNames: () => [...byName.keys()].sort() };
}

export type TelemetryRegistry = ReturnType<typeof createTelemetryRegistry>;
