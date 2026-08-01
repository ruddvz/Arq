/**
 * ARQ-155: create threat model.
 *
 * Blueprint section 118 ("Analytics privacy")'s "Do not collect by
 * default" list - geometry, project names, addresses, raw prompts,
 * sheet content, client names - matches this package's own README
 * verbatim ("no raw geometry, project names, or prompt text by
 * default"). This is that promise's actual enforcement: a small, pure
 * function any future logging/telemetry call site in this repository
 * routes an event through before it is ever sent or written anywhere,
 * rather than leaving the promise as prose with nothing checking it.
 *
 * Matches by field *name* rather than attempting to detect sensitive
 * *content* (e.g. scanning string values for anything that looks like
 * an address): a content-sniffing redactor would be a much larger,
 * much less predictable piece of work (what does "looks like an
 * address" even mean, precisely?) than this issue's "do not expand
 * into later release scope" non-goal allows, and a name-based
 * allowlist-of-blocked-keys is exactly how a caller already knows
 * which fields it is about to log - the field names below are section
 * 118's own list, not invented ones.
 *
 * Two limits of the first version were not scope discipline but holes,
 * and both are closed here. Neither requires content sniffing; both are
 * still purely name-based.
 *
 * **One spelling is not a name.** The set held exact camelCase only, so
 * `projectName` was redacted while `project_name`, `Project-Name` and
 * `PROJECTNAME` went through untouched. Telemetry payloads are assembled
 * from API responses, database rows and worker messages, which do not
 * agree on a case convention, so the redactor caught whichever spelling
 * its author happened to think of. Keys are now compared with case and
 * separators normalised away. The comparison stays a whole-key match:
 * `geometryCount` and `promptId` normalise to something other than
 * `geometry` and `prompt`, so a count of walls is still collectable.
 *
 * **Arrays are where payloads keep their objects.** The first version
 * declined to recurse into arrays and called it predictable. What it
 * predictably did was leak: `{ walls: [{ geometry: ... }] }` is the
 * ordinary shape of an event about several things, and every sensitive
 * field inside one passed straight through. A redactor that stops at the
 * first array is not simpler in any way a reader benefits from, because
 * the rule it leaves them with is "sensitive names are removed, unless
 * they are in a list". Arrays are now walked, at any depth.
 *
 * What remains deliberately out of scope: a key is only redacted when
 * the whole normalised key matches, so a field like `wallGeometry` is
 * not caught. Widening to substring matching would redact
 * `geometryVersion` and `promptTokenCount` too, and the honest fix for a
 * new sensitive field is to name it in the list below.
 */

const SENSITIVE_FIELD_NAMES: ReadonlySet<string> = new Set(
  ['geometry', 'projectName', 'address', 'rawPrompt', 'prompt', 'sheetContent', 'clientName'].map(
    normaliseFieldName,
  ),
);

export const REDACTED_PLACEHOLDER = '[redacted]';

/** Lower-cases and drops separators, so one entry covers every spelling of the same field name. */
function normaliseFieldName(name: string): string {
  return name.toLowerCase().replace(/[\s._-]/gu, '');
}

/** Whether this key names one of section 118's fields, in any case convention. */
export function isSensitiveFieldName(name: string): boolean {
  return SENSITIVE_FIELD_NAMES.has(normaliseFieldName(name));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Walks a value that is not itself a redaction decision - an array element,
 * or a nested payload - and redacts inside it. Arrays and objects nest
 * arbitrarily, so this recurses through both rather than through objects only.
 */
function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (isPlainObject(value)) return redactSensitiveFields(value);
  return value;
}

/** Strips section 118's "do not collect by default" fields from `event`, replacing each with REDACTED_PLACEHOLDER - recursing through nested objects and arrays alike. Everything else passes through unchanged. */
export function redactSensitiveFields(
  event: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    result[key] = isSensitiveFieldName(key) ? REDACTED_PLACEHOLDER : redactValue(value);
  }
  return result;
}
