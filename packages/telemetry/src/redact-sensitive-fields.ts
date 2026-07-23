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
 * Redacts recursively into nested plain objects (an event's payload is
 * not always flat), but does not attempt to redact inside arrays or
 * other structures - keeping this predictable and simple rather than a
 * general-purpose deep-sanitiser, matching the same non-goal.
 */

const SENSITIVE_FIELD_NAMES: ReadonlySet<string> = new Set([
  'geometry',
  'projectName',
  'address',
  'rawPrompt',
  'prompt',
  'sheetContent',
  'clientName',
]);

export const REDACTED_PLACEHOLDER = '[redacted]';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Strips section 118's "do not collect by default" fields from `event`, replacing each with REDACTED_PLACEHOLDER - recursing into nested plain objects. Everything else passes through unchanged. */
export function redactSensitiveFields(
  event: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (SENSITIVE_FIELD_NAMES.has(key)) {
      result[key] = REDACTED_PLACEHOLDER;
    } else if (isPlainObject(value)) {
      result[key] = redactSensitiveFields(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
