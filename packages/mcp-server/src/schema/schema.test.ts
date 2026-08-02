import { describe, expect, it } from 'vitest';
import { canonicalByteLength, canonicalJson, isJsonValue } from './json-value';
import {
  MAX_SCHEMA_ISSUES,
  arrayValue,
  booleanValue,
  enumValue,
  formatIssues,
  integerValue,
  jsonValue,
  literalValue,
  numberValue,
  objectValue,
  recordValue,
  refine,
  stringValue,
} from './schema';

describe('canonical JSON', () => {
  it('sorts object keys at every depth so equal payloads hash equally', () => {
    const a = { b: 1, a: { d: [3, { f: 1, e: 2 }], c: 2 } };
    const b = { a: { c: 2, d: [3, { e: 2, f: 1 }] }, b: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('preserves array order, which is meaningful', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it('measures bytes, not characters', () => {
    // A four-byte astral character must not be counted as one or two.
    expect(canonicalByteLength('a')).toBe(3);
    expect(canonicalByteLength('\u{1F3D7}')).toBe(6);
  });

  it('rejects values JSON cannot carry', () => {
    expect(isJsonValue(Number.NaN)).toBe(false);
    expect(isJsonValue(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isJsonValue(undefined)).toBe(false);
    expect(isJsonValue(() => 1)).toBe(false);
    expect(isJsonValue(new Date())).toBe(false);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(isJsonValue(cyclic)).toBe(false);
  });
});

describe('primitive validators', () => {
  it('reports the received type rather than only the expected one', () => {
    const result = stringValue().validate(7);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('received number');
    }
  });

  it('enforces length bounds', () => {
    const validator = stringValue({ minLength: 2, maxLength: 3 });
    expect(validator.validate('a').ok).toBe(false);
    expect(validator.validate('abcd').ok).toBe(false);
    expect(validator.validate('abc').ok).toBe(true);
  });

  it('uses the human hint instead of the raw pattern in the message', () => {
    const validator = stringValue({
      pattern: /^[a-z]+$/,
      patternHint: 'Expected lower-case letters.',
    });
    const result = validator.validate('A1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toBe('Expected lower-case letters.');
    }
  });

  it('is not made non-deterministic by a stateful pattern', () => {
    // A /g pattern carries lastIndex between calls; the same input must
    // still produce the same verdict every time.
    const validator = stringValue({ pattern: /^ab$/g });
    expect(validator.validate('ab').ok).toBe(true);
    expect(validator.validate('ab').ok).toBe(true);
    expect(validator.validate('ab').ok).toBe(true);
  });

  it('rejects non-finite numbers that would not survive serialisation', () => {
    expect(numberValue().validate(Number.NaN).ok).toBe(false);
    expect(numberValue().validate(Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(numberValue().validate(1.5).ok).toBe(true);
    expect(integerValue().validate(1.5).ok).toBe(false);
  });

  it('checks ranges', () => {
    const validator = integerValue({ minimum: 1, maximum: 10 });
    expect(validator.validate(0).ok).toBe(false);
    expect(validator.validate(11).ok).toBe(false);
    expect(validator.validate(10).ok).toBe(true);
  });

  it('narrows literals and enums', () => {
    expect(literalValue('none').validate('none').ok).toBe(true);
    expect(literalValue('none').validate('some').ok).toBe(false);
    expect(booleanValue().validate('true').ok).toBe(false);
    const state = enumValue(['editable', 'read_only']);
    expect(state.validate('editable').ok).toBe(true);
    expect(state.validate('deleted').ok).toBe(false);
    expect(state.jsonSchema).toEqual({ type: 'string', enum: ['editable', 'read_only'] });
  });
});

describe('arrays', () => {
  const items = arrayValue(stringValue({ minLength: 1 }), {
    minItems: 1,
    maxItems: 3,
    uniqueBy: (item) => item,
  });

  it('enforces bounds and uniqueness', () => {
    expect(items.validate([]).ok).toBe(false);
    expect(items.validate(['a', 'b', 'c', 'd']).ok).toBe(false);
    expect(items.validate(['a', 'a']).ok).toBe(false);
    expect(items.validate(['a', 'b']).ok).toBe(true);
  });

  it('names the index of the offending entry', () => {
    const result = items.validate(['a', 7]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.path).toBe('$[1]');
    }
  });

  it('does not advertise uniqueItems, which means something else', () => {
    expect(items.jsonSchema.uniqueItems).toBeUndefined();
    expect(String(items.jsonSchema.description)).toContain('unique');
  });

  it('caps the issue list rather than reporting one issue per bad entry', () => {
    const unbounded = arrayValue(stringValue());
    const result = unbounded.validate(Array.from({ length: 400 }, () => 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBe(MAX_SCHEMA_ISSUES);
    }
  });
});

describe('objects', () => {
  const validator = objectValue({
    required: { id: stringValue({ minLength: 1 }) },
    optional: { note: stringValue({ minLength: 1 }) },
  });

  it('accepts a value with only the required keys', () => {
    const result = validator.validate({ id: 'a' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ id: 'a' });
    }
  });

  it('rejects unknown keys instead of dropping them', () => {
    const result = validator.validate({ id: 'a', extra: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('ARQ_MCP_SCHEMA_UNKNOWN_KEY');
      expect(result.issues[0]?.path).toBe('$.extra');
    }
  });

  it('names every missing required key at once', () => {
    const two = objectValue({ required: { a: stringValue(), b: stringValue() } });
    const result = two.validate({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.path)).toEqual(['$.a', '$.b']);
    }
  });

  it('treats an explicitly undefined optional key as absent', () => {
    const result = validator.validate({ id: 'a', note: undefined });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.hasOwn(result.value, 'note')).toBe(false);
    }
  });

  it('emits a closed JSON Schema with sorted required keys', () => {
    const two = objectValue({ required: { b: stringValue(), a: stringValue() } });
    expect(two.jsonSchema.required).toEqual(['a', 'b']);
    expect(two.jsonSchema.additionalProperties).toBe(false);
  });

  it('rejects arrays and null, which are typeof object', () => {
    expect(validator.validate([]).ok).toBe(false);
    expect(validator.validate(null).ok).toBe(false);
  });
});

describe('records', () => {
  const counts = recordValue(integerValue({ minimum: 0 }), {
    keyPattern: /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/,
    keyHint: 'Expected a dotted lower-case kind name.',
    maxProperties: 2,
  });

  it('checks keys and values separately', () => {
    expect(counts.validate({ 'architecture.wall': 3 }).ok).toBe(true);
    expect(counts.validate({ 'Architecture Wall': 3 }).ok).toBe(false);
    expect(counts.validate({ 'architecture.wall': -1 }).ok).toBe(false);
  });

  it('bounds the number of properties', () => {
    expect(counts.validate({ a: 1, b: 2, c: 3 }).ok).toBe(false);
  });
});

describe('refinements', () => {
  const graph = refine(
    objectValue({ required: { ids: arrayValue(stringValue()), parent: stringValue() } }),
    (value, report) => {
      if (!value.ids.includes(value.parent)) {
        report('$.parent', `Unknown parent "${value.parent}".`);
      }
    },
    'The parent must appear in ids.',
  );

  it('runs only after the structure is known good', () => {
    const result = graph.validate({ ids: 'nope', parent: 'a' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.every((issue) => issue.code !== 'ARQ_MCP_SCHEMA_GRAPH')).toBe(true);
    }
  });

  it('reports cross-field problems with a graph code', () => {
    const result = graph.validate({ ids: ['a'], parent: 'b' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('ARQ_MCP_SCHEMA_GRAPH');
    }
  });

  it('states the rule in the schema description because no keyword expresses it', () => {
    expect(String(graph.jsonSchema.description)).toContain('The parent must appear in ids.');
  });
});

describe('open JSON values', () => {
  it('accepts any serialisable value and rejects anything else', () => {
    expect(jsonValue().validate({ a: [1, 'b', null] }).ok).toBe(true);
    expect(jsonValue().validate(new Map()).ok).toBe(false);
  });
});

describe('issue formatting', () => {
  it('renders one deterministic line per issue', () => {
    const result = objectValue({ required: { a: stringValue(), b: stringValue() } }).validate({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(formatIssues(result.issues)).toBe(
        '$.a: Missing required property "a". $.b: Missing required property "b".',
      );
    }
  });
});
