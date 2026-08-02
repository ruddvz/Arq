/**
 * Reference URIs are parsed, not pattern-matched.
 *
 * The reviewed MCP System 2.0 package guarded reference URIs with
 * `/^(https:\/\/|arq:\/\/)/` and a length ceiling. A prefix test is not a
 * URL check. Every one of these passes it and none of them is a
 * reference an assistant should be allowed to record:
 *
 *   https://user:token@example.com/x   credentials smuggled into a stored field
 *   https://127.0.0.1/admin            loopback, i.e. the operator's own machine
 *   https://169.254.169.254/latest     cloud instance metadata
 *   https://localhost:8080/x           the Arq application's own dev server
 *   https:///etc/passwd                empty host, a path wearing a scheme
 *   https://аpple.com/x                Cyrillic homograph
 *
 * The package never fetches a reference today, which is exactly why the
 * check has to be right now: the stored value is what a later importer,
 * thumbnailer or link-preview feature will be handed, and by then the
 * value is already in someone's project. Validating at the boundary
 * means that future feature inherits a URI that has been parsed, has no
 * credentials, names a public DNS host and is pure ASCII.
 *
 * This is a URI-shape control, not a claim that the destination is safe.
 * A well-formed public URL can still serve hostile content, which is why
 * reference content stays untrusted data and rights status stays a human
 * decision (see `design-program.ts`).
 */

import { SCHEMA_ISSUE_CODES, type Validator } from './schema';

export const MAX_REFERENCE_URI_LENGTH = 2048;

/** Hosts an assistant must never be able to name in a stored reference, matched on the whole host or as a suffix label. */
const BLOCKED_HOST_SUFFIXES = [
  'localhost',
  'local',
  'internal',
  'intranet',
  'lan',
  'home.arpa',
  'onion',
  'test',
  'example',
  'invalid',
] as const;

/** The resource kinds an `arq://` reference may name. Anything else is a scheme the runtime does not resolve. */
export const ARQ_REFERENCE_KINDS = ['element', 'resource', 'view', 'sheet', 'review'] as const;

export type ArqReferenceKind = (typeof ARQ_REFERENCE_KINDS)[number];

export type ReferenceUriCheck =
  | {
      readonly ok: true;
      readonly scheme: 'https';
      readonly host: string;
      readonly normalised: string;
    }
  | {
      readonly ok: true;
      readonly scheme: 'arq';
      readonly kind: ArqReferenceKind;
      readonly opaqueId: string;
      readonly normalised: string;
    }
  | { readonly ok: false; readonly reason: string };

const ARQ_OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HOST_LABEL_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const TOP_LEVEL_LABEL_PATTERN = /^[a-z]{2,63}$/;

export function checkReferenceUri(value: string): ReferenceUriCheck {
  if (value.length === 0 || value.length > MAX_REFERENCE_URI_LENGTH) {
    return {
      ok: false,
      reason: `A reference URI must be 1 to ${MAX_REFERENCE_URI_LENGTH} characters long.`,
    };
  }
  // Rejecting non-ASCII before parsing is what makes the homograph case
  // decidable: `new URL` silently converts an internationalised host to
  // punycode, after which the stored value no longer resembles what the
  // author wrote and nothing downstream can tell the two apart.
  if (!/^[ -~]*$/u.test(value)) {
    return {
      ok: false,
      reason:
        'A reference URI must contain only printable ASCII. Supply an already-encoded URI rather than an internationalised one.',
    };
  }
  if (/[\s<>"`\\^{}|]/u.test(value)) {
    return {
      ok: false,
      reason: 'A reference URI must not contain whitespace or the characters < > " ` \\ ^ { } |.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: 'A reference URI must be an absolute, parseable URI.' };
  }

  if (parsed.protocol === 'arq:') {
    return checkArqUri(parsed);
  }
  if (parsed.protocol === 'https:') {
    return checkHttpsUri(parsed);
  }
  return {
    ok: false,
    reason: `Scheme "${parsed.protocol.replace(':', '')}" is not allowed. Use https for external sources or arq for Arq-owned resources.`,
  };
}

function checkHttpsUri(parsed: URL): ReferenceUriCheck {
  if (parsed.username !== '' || parsed.password !== '') {
    return {
      ok: false,
      reason:
        'A reference URI must not carry credentials. Remove the user information before the host.',
    };
  }
  const host = parsed.hostname.toLowerCase();
  if (host.length === 0) {
    return { ok: false, reason: 'A reference URI must name a host.' };
  }
  if (host.startsWith('[')) {
    return {
      ok: false,
      reason: 'A reference URI must name a DNS host, not an IPv6 literal.',
    };
  }
  if (parsed.port !== '' && parsed.port !== '443') {
    return {
      ok: false,
      reason: 'A reference URI must use the default HTTPS port.',
    };
  }

  // Reserved namespaces are matched before the DNS-shape rules so that a
  // bare `localhost` is reported as unroutable rather than as a malformed
  // host name: the operator needs to know why it was refused, not that it
  // was one label short.
  for (const blocked of BLOCKED_HOST_SUFFIXES) {
    if (host === blocked || host.endsWith(`.${blocked}`)) {
      return {
        ok: false,
        reason: `Host "${host}" resolves inside a private, reserved or unroutable namespace and cannot be recorded as an external reference.`,
      };
    }
  }

  const labels = host.split('.');
  if (labels.length < 2) {
    return {
      ok: false,
      reason: 'A reference URI must name a fully qualified public host, e.g. example.com.',
    };
  }
  for (const label of labels) {
    if (!HOST_LABEL_PATTERN.test(label)) {
      return {
        ok: false,
        reason: `Host label "${label}" is not a valid DNS label.`,
      };
    }
  }
  const topLevel = labels[labels.length - 1]!;
  // A numeric or single-character final label is how every literal-address
  // form arrives: 127.0.0.1, 2130706433, 0x7f.1. Requiring letters rejects
  // all of them without having to enumerate the encodings.
  if (!TOP_LEVEL_LABEL_PATTERN.test(topLevel)) {
    return {
      ok: false,
      reason:
        'A reference URI must name a DNS host with an alphabetic top-level domain, not a numeric address.',
    };
  }
  return { ok: true, scheme: 'https', host, normalised: parsed.toString() };
}

function checkArqUri(parsed: URL): ReferenceUriCheck {
  const kind = parsed.hostname.toLowerCase();
  if (!isArqReferenceKind(kind)) {
    return {
      ok: false,
      reason: `An arq reference must name one of: ${ARQ_REFERENCE_KINDS.join(', ')}.`,
    };
  }
  if (parsed.username !== '' || parsed.password !== '' || parsed.port !== '') {
    return { ok: false, reason: 'An arq reference must not carry credentials or a port.' };
  }
  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
  if (segments.length !== 1) {
    return {
      ok: false,
      reason: 'An arq reference must be arq://<kind>/<id> with exactly one identifier segment.',
    };
  }
  const opaqueId = segments[0]!;
  if (!ARQ_OPAQUE_ID_PATTERN.test(opaqueId)) {
    return { ok: false, reason: 'An arq reference identifier must be an opaque Arq identifier.' };
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    return { ok: false, reason: 'An arq reference must not carry a query string or fragment.' };
  }
  return { ok: true, scheme: 'arq', kind, opaqueId, normalised: `arq://${kind}/${opaqueId}` };
}

function isArqReferenceKind(value: string): value is ArqReferenceKind {
  return (ARQ_REFERENCE_KINDS as readonly string[]).includes(value);
}

/**
 * The validator form, so a schema can carry the parse rather than a
 * pattern that only approximates it. The emitted JSON Schema advertises a
 * prefix pattern (all a client can usefully pre-check) plus a description
 * that states the real rule, rather than implying the pattern is the rule.
 */
export function referenceUriValue(description?: string): Validator<string> {
  const note =
    'Parsed as a URI: https with a public DNS host, no credentials, no non-default port, ASCII only; or arq://<kind>/<id> for an Arq-owned resource.';
  return {
    jsonSchema: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_REFERENCE_URI_LENGTH,
      pattern: '^(https|arq)://',
      description: description === undefined ? note : `${description} ${note}`,
    },
    validate(value, path = '$') {
      if (typeof value !== 'string') {
        return {
          ok: false,
          issues: [
            {
              path,
              code: SCHEMA_ISSUE_CODES.type,
              message: `Expected a string, received ${value === null ? 'null' : typeof value}.`,
            },
          ],
        };
      }
      const checked = checkReferenceUri(value);
      if (!checked.ok) {
        return {
          ok: false,
          issues: [{ path, code: SCHEMA_ISSUE_CODES.pattern, message: checked.reason }],
        };
      }
      return { ok: true, value };
    },
  };
}
