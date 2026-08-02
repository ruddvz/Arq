/**
 * Distinct identifier grammars, one per identifier kind.
 *
 * The reviewed MCP System 2.0 package used a single `OperationTypeSchema`
 * regular expression (`^[a-z][a-z0-9_.:-]*$`) for six unrelated things:
 * operation types, semantic entity kinds, permission scopes, derived
 * output names, projected field names and the keys of the snapshot's
 * element counts. That is not a style problem, it is a defect with two
 * halves.
 *
 * It rejected valid input: a projection of `fields: ["hostWallId"]` -
 * the exact camelCase spelling every property in @arq/bim-core uses -
 * fails a lower-case-only pattern, so the field-projection feature could
 * not address any real Arq field.
 *
 * It accepted meaningless input: `a:::...---` satisfied the same pattern,
 * so an operation type, a scope and a kind could all be strings no
 * registry would ever contain, and the failure surfaced far from the
 * input as an "unregistered operation" rather than "that is not an
 * operation name".
 *
 * Every pattern here is anchored, bounded, and paired with a hint written
 * for the reader of a tool error rather than the author of the regular
 * expression.
 */

import { stringValue, type Validator } from './schema';

/**
 * A namespaced lower-case name: `architecture.wall.create`.
 *
 * Segments are lower-case alphanumeric, separated by single dots, with no
 * leading, trailing or repeated separator. Underscores are allowed inside
 * a segment because Arq's derived-output names already use them.
 */
export const DOTTED_NAME_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

/**
 * A derived-output name, which may contain hyphens.
 *
 * Deliberately looser than `DOTTED_NAME_PATTERN` so that Arq's existing
 * invalidation constants pass verbatim: `WALL_TYPE_DERIVED_INVALIDATIONS`
 * in @arq/bim-core is `['wall-outline', 'room-boundary', 'dimensions',
 * 'plan-render-cache', 'mesh-3d']`. Renaming those to fit a stricter
 * grammar here would create a second spelling of the same concept, which
 * is exactly the drift a profile registry exists to prevent.
 */
export const DERIVED_OUTPUT_PATTERN = /^[a-z][a-z0-9]*([-_.][a-z0-9]+)*$/;

/** An opaque handle minted by Arq: project ids, revisions, proposal ids, grant ids. Never a filesystem path. */
export const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** A property name as spelled in the Arq semantic model, e.g. `hostWallId`, `heightOverride`, `_debug`. */
export const FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** A machine-readable result code. Every code this server emits is namespaced `ARQ_`. */
export const RESULT_CODE_PATTERN = /^ARQ_[A-Z0-9_]{1,120}$/;

/**
 * Strict semantic version.
 *
 * 2.0's `^[0-9]+\.[0-9]+\.[0-9]+$` accepted `01.2.3`, which compares
 * equal to `1.2.3` under any sane parse but unequal as a string - and
 * catalogue lookups in this package are string equality, so a leading
 * zero would silently miss a registered operation.
 */
export const SEMANTIC_VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

/** A lower-case hex SHA-256 digest with its algorithm named, so a future algorithm change is a visible prefix change. */
export const CONTENT_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** A domain profile identifier, e.g. `architecture`, `vehicle.concept`. */
export const PROFILE_ID_PATTERN = DOTTED_NAME_PATTERN;

export const MAX_OPAQUE_ID_LENGTH = 128;
export const MAX_DOTTED_NAME_LENGTH = 160;

export function opaqueId(description?: string): Validator<string> {
  return stringValue({
    minLength: 1,
    maxLength: MAX_OPAQUE_ID_LENGTH,
    pattern: OPAQUE_ID_PATTERN,
    patternHint:
      'Expected an opaque Arq identifier: letters, digits, dot, underscore, colon or hyphen, starting with a letter or digit, at most 128 characters. A filesystem path is never an identifier.',
    ...(description === undefined ? {} : { description }),
  });
}

export function operationTypeName(description?: string): Validator<string> {
  return dottedName(
    description ??
      'A registered operation type from a domain profile catalogue, e.g. architecture.wall.create.',
  );
}

export function semanticKindName(description?: string): Validator<string> {
  return dottedName(
    description ?? 'A semantic entity kind registered by a domain profile, e.g. architecture.wall.',
  );
}

export function derivedOutputName(description?: string): Validator<string> {
  return stringValue({
    minLength: 1,
    maxLength: MAX_DOTTED_NAME_LENGTH,
    pattern: DERIVED_OUTPUT_PATTERN,
    patternHint:
      'Expected a derived-output name as Arq spells it, e.g. wall-outline, plan-render-cache, mesh-3d.',
    description:
      description ?? 'A derived output a change can invalidate, e.g. wall-outline, room-boundary.',
  });
}

export function scopeName(description?: string): Validator<string> {
  return dottedName(description ?? 'A permission scope carried by the active project grant.');
}

export function profileId(description?: string): Validator<string> {
  return dottedName(description ?? 'A domain profile identifier, e.g. architecture.');
}

function dottedName(description: string): Validator<string> {
  return stringValue({
    minLength: 1,
    maxLength: MAX_DOTTED_NAME_LENGTH,
    pattern: DOTTED_NAME_PATTERN,
    patternHint:
      'Expected a dotted lower-case name: segments of letters, digits and underscores joined by single dots, e.g. architecture.wall.create.',
    description,
  });
}

export function fieldName(description?: string): Validator<string> {
  return stringValue({
    minLength: 1,
    maxLength: 64,
    pattern: FIELD_NAME_PATTERN,
    patternHint:
      'Expected a property name as spelled in the Arq model: letters, digits and underscores, not starting with a digit, e.g. hostWallId.',
    ...(description === undefined ? {} : { description }),
  });
}

export function resultCode(description?: string): Validator<string> {
  return stringValue({
    minLength: 5,
    maxLength: 124,
    pattern: RESULT_CODE_PATTERN,
    patternHint: 'Expected an ARQ_-prefixed upper-case result code.',
    ...(description === undefined ? {} : { description }),
  });
}

export function semanticVersion(description?: string): Validator<string> {
  return stringValue({
    minLength: 5,
    maxLength: 32,
    pattern: SEMANTIC_VERSION_PATTERN,
    patternHint: 'Expected a semantic version such as 1.0.0, with no leading zeros in any part.',
    ...(description === undefined ? {} : { description }),
  });
}

export function contentHash(description?: string): Validator<string> {
  return stringValue({
    minLength: 71,
    maxLength: 71,
    pattern: CONTENT_HASH_PATTERN,
    patternHint: 'Expected a lower-case SHA-256 digest prefixed with "sha256:".',
    ...(description === undefined ? {} : { description }),
  });
}

/** Free prose with a hard ceiling. Every human-readable field in this package uses one of these rather than an unbounded string. */
export function boundedText(maxLength: number, description?: string): Validator<string> {
  return stringValue({
    minLength: 1,
    maxLength,
    ...(description === undefined ? {} : { description }),
  });
}
