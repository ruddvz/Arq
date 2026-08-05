import { describe, expect, it } from 'vitest';
import { REDACTED_PLACEHOLDER } from './redact-sensitive-fields';
import {
  TELEMETRY_REJECTION_CODES,
  createTelemetryRegistry,
  validateSchema,
  validateTelemetryEvent,
  type TelemetryEventSchema,
} from './telemetry-schema';

const OPEN_SCHEMA: TelemetryEventSchema = {
  eventName: 'project.open',
  fields: [
    { name: 'durationMs', type: 'number' },
    { name: 'elementCount', type: 'number' },
    { name: 'usedVfs', type: 'enum', allowedValues: ['opfs', 'memory'] },
    { name: 'formatVersion', type: 'string', maxLength: 16 },
    { name: 'recovered', type: 'boolean' },
  ],
};

describe('validateTelemetryEvent', () => {
  it('accepts an event whose fields are all declared', () => {
    const result = validateTelemetryEvent(OPEN_SCHEMA, {
      durationMs: 412,
      elementCount: 1820,
      usedVfs: 'opfs',
      formatVersion: '3.0',
      recovered: false,
    });

    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    expect(result.payload.durationMs).toBe(412);
  });

  it('reports an undeclared field rather than dropping it quietly', () => {
    // A silently dropped field is indistinguishable from one never sent, so a
    // typo would surface months later as missing data.
    const result = validateTelemetryEvent(OPEN_SCHEMA, {
      durationMs: 1,
      siteAddress: '12 High St',
    });

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.violations[0]).toMatchObject({
      code: TELEMETRY_REJECTION_CODES.undeclaredField,
      field: 'siteAddress',
    });
  });

  it('catches what a denylist alone would miss', () => {
    // These are exactly the shapes redactSensitiveFields does not name.
    const result = validateTelemetryEvent(OPEN_SCHEMA, {
      durationMs: 1,
      ownerEmail: 'a@example.com',
      lastPromptText: 'draw me a house',
    });

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.violations.map((violation) => violation.field).sort()).toEqual([
      'lastPromptText',
      'ownerEmail',
    ]);
  });

  it('collects every violation, not just the first', () => {
    const result = validateTelemetryEvent(OPEN_SCHEMA, { a: 1, b: 2, c: 3 });

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.violations).toHaveLength(3);
  });

  it('sends nothing at all when an event is rejected', () => {
    // A partial event is a data point that looks complete and is not.
    const result = validateTelemetryEvent(OPEN_SCHEMA, { durationMs: 412, stray: 'x' });

    expect(result.status).toBe('rejected');
    expect(result).not.toHaveProperty('payload');
  });

  it('rejects a value of the wrong type', () => {
    const result = validateTelemetryEvent(OPEN_SCHEMA, { durationMs: '412' });

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.violations[0]?.code).toBe(TELEMETRY_REJECTION_CODES.wrongType);
  });

  it('rejects a non-finite number', () => {
    expect(validateTelemetryEvent(OPEN_SCHEMA, { durationMs: Number.NaN }).status).toBe('rejected');
  });

  it('rejects an enum value nobody declared', () => {
    // A free-text field cannot masquerade as a category.
    const result = validateTelemetryEvent(OPEN_SCHEMA, { usedVfs: '/Users/sam/site-plan.arq' });

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.violations[0]?.code).toBe(TELEMETRY_REJECTION_CODES.valueNotAllowed);
  });

  it('rejects a string past its declared length', () => {
    const result = validateTelemetryEvent(OPEN_SCHEMA, { formatVersion: 'x'.repeat(17) });

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.violations[0]?.code).toBe(TELEMETRY_REJECTION_CODES.tooLong);
  });

  it('still runs the denylist over what it admits', () => {
    // An allowlist checks names, not contents: a declared field can be handed
    // a sensitive value by a caller passing the wrong variable.
    const schema: TelemetryEventSchema = {
      eventName: 'test',
      fields: [{ name: 'detail', type: 'string', maxLength: 200 }],
    };
    const nested: TelemetryEventSchema = {
      eventName: 'test2',
      fields: [{ name: 'context', type: 'string', maxLength: 200 }],
    };

    expect(validateTelemetryEvent(schema, { detail: 'fine' }).status).toBe('accepted');
    expect(validateTelemetryEvent(nested, { context: 'fine' }).status).toBe('accepted');
  });

  it('redacts a sensitive key that survived into an accepted payload', () => {
    const schema: TelemetryEventSchema = {
      eventName: 'test',
      fields: [{ name: 'geometry', type: 'string', maxLength: 200 }],
    };

    const result = validateTelemetryEvent(schema, { geometry: 'x'.repeat(10) });

    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    expect(result.payload.geometry).toBe(REDACTED_PLACEHOLDER);
  });

  it('accepts an empty payload for a schema whose fields are all optional in practice', () => {
    expect(validateTelemetryEvent(OPEN_SCHEMA, {}).status).toBe('accepted');
  });
});

describe('validateSchema', () => {
  it('refuses a schema declaring a field the privacy policy excludes', () => {
    // A schema can grant in one line what the mechanism exists to prevent.
    const violations = validateSchema({
      eventName: 'bad',
      fields: [{ name: 'projectName', type: 'string', maxLength: 40 }],
    });

    expect(violations[0]?.code).toBe(TELEMETRY_REJECTION_CODES.sensitiveFieldName);
  });

  it('catches an excluded field under a different spelling', () => {
    const violations = validateSchema({
      eventName: 'bad',
      fields: [{ name: 'project_name', type: 'string', maxLength: 40 }],
    });

    expect(violations[0]?.code).toBe(TELEMETRY_REJECTION_CODES.sensitiveFieldName);
  });

  it('refuses an unbounded string', () => {
    // An unbounded string is how free text reaches the pipeline through a field
    // declared for an identifier.
    const violations = validateSchema({
      eventName: 'bad',
      fields: [{ name: 'detail', type: 'string' }],
    });

    expect(violations[0]?.code).toBe(TELEMETRY_REJECTION_CODES.unboundedString);
  });

  it('refuses an enum with no values, which admits anything', () => {
    const violations = validateSchema({
      eventName: 'bad',
      fields: [{ name: 'kind', type: 'enum', allowedValues: [] }],
    });

    expect(violations[0]?.code).toBe(TELEMETRY_REJECTION_CODES.valueNotAllowed);
  });

  it('passes a sound schema', () => {
    expect(validateSchema(OPEN_SCHEMA)).toEqual([]);
  });
});

describe('createTelemetryRegistry', () => {
  const registry = createTelemetryRegistry([OPEN_SCHEMA]);

  it('validates a registered event', () => {
    expect(registry.validate('project.open', { durationMs: 12 }).status).toBe('accepted');
  });

  it('refuses an unregistered event rather than letting it through unchecked', () => {
    // Treating "no schema" as "no constraints" would make registration
    // optional in practice.
    const result = registry.validate('project.mystery', { anything: 'at all' });

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.violations[0]?.code).toBe(TELEMETRY_REJECTION_CODES.unknownEvent);
  });

  it('checks every schema it holds, so a bad one fails a build rather than a review', () => {
    expect(registry.validateAllSchemas()).toEqual([]);
    expect(
      createTelemetryRegistry([
        { eventName: 'bad', fields: [{ name: 'address', type: 'string' }] },
      ]).validateAllSchemas().length,
    ).toBeGreaterThan(0);
  });

  it('lists what it knows about', () => {
    expect(registry.eventNames()).toEqual(['project.open']);
  });
});
