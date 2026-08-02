/**
 * The loopback HTTP guards, as pure functions.
 *
 * The reviewed 2.0 package implemented the same controls inside its
 * development server's request handler, so the only way to exercise them
 * was to start a server and make requests - which its smoke script did, and
 * its test suite did not. Guards that are only covered by a smoke script
 * are guards that regress quietly.
 *
 * Each rule here answers one attack:
 *
 * The Host check answers DNS rebinding. A page on any origin can make a
 * browser resolve an attacker-controlled name to 127.0.0.1 and then talk to
 * a local server; refusing any Host header that is not the loopback address
 * this server bound to closes it.
 *
 * The Origin check answers the same attack from the other side, and is
 * strict about a missing Origin only for state-changing methods, because a
 * browser always sends one and a command-line client never does.
 *
 * The Content-Type check answers simple-request CSRF: a form post cannot
 * set `application/json`, so requiring it means a cross-site form cannot
 * reach the endpoint at all.
 *
 * The pairing token answers the local-process problem the other three do
 * not touch: on a shared machine any process can reach a loopback port. 2.0
 * listed a pairing token as required and implemented none, so any local
 * program could drive its server.
 */

export interface HttpGuardOptions {
  readonly port: number;
  /** A secret the Arq application generates and shows to the operator when pairing. Absent means unpaired, and every request is refused. */
  readonly pairingToken?: string;
}

export interface HttpRequestFacts {
  readonly method: string;
  readonly path: string;
  readonly host?: string;
  readonly origin?: string;
  readonly contentType?: string;
  readonly authorization?: string;
  readonly contentLength?: number;
}

export type HttpGuardVerdict =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly status: number; readonly reason: string };

export const MAX_HTTP_BODY_BYTES = 1_048_576;

export const MCP_ENDPOINT_PATH = '/mcp';

export function checkHttpRequest(
  request: HttpRequestFacts,
  options: HttpGuardOptions,
): HttpGuardVerdict {
  const allowedHosts = new Set([`127.0.0.1:${options.port}`, `[::1]:${options.port}`]);

  // Deliberately not `localhost`: a resolver can be made to point that name
  // anywhere, and this server only ever binds to the loopback address.
  const host = request.host?.toLowerCase();
  if (host === undefined || !allowedHosts.has(host)) {
    return {
      allowed: false,
      status: 403,
      reason: 'The Host header does not name this loopback endpoint.',
    };
  }

  if (request.origin !== undefined) {
    let originHost: string;
    try {
      const parsed = new URL(request.origin);
      originHost = parsed.host.toLowerCase();
    } catch {
      return { allowed: false, status: 403, reason: 'The Origin header is not a valid origin.' };
    }
    if (!allowedHosts.has(originHost)) {
      return {
        allowed: false,
        status: 403,
        reason: 'That origin is not allowed to reach this endpoint.',
      };
    }
  }

  if (request.path.split('?', 1)[0] !== MCP_ENDPOINT_PATH) {
    return { allowed: false, status: 404, reason: 'There is nothing at that path.' };
  }

  if (request.method !== 'POST') {
    return { allowed: false, status: 405, reason: 'This endpoint accepts POST only.' };
  }

  if (options.pairingToken === undefined || options.pairingToken.length === 0) {
    return {
      allowed: false,
      status: 401,
      reason: 'This endpoint is not paired. Pair it from Arq before connecting.',
    };
  }
  const presented = readBearerToken(request.authorization);
  if (presented === undefined || !constantTimeEquals(presented, options.pairingToken)) {
    return { allowed: false, status: 401, reason: 'The pairing token is missing or wrong.' };
  }

  const contentType = request.contentType?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    return { allowed: false, status: 415, reason: 'The content type must be application/json.' };
  }

  if (request.contentLength !== undefined && request.contentLength > MAX_HTTP_BODY_BYTES) {
    return { allowed: false, status: 413, reason: 'That request body is too large.' };
  }

  return { allowed: true };
}

function readBearerToken(header: string | undefined): string | undefined {
  if (header === undefined) {
    return undefined;
  }
  const match = /^Bearer +(.+)$/u.exec(header.trim());
  return match?.[1];
}

/**
 * Compares two tokens without leaking their length or their matching prefix
 * through timing.
 *
 * A local attacker who can time responses can otherwise recover a token one
 * character at a time. The length difference is folded into the result
 * rather than short-circuiting on it.
 */
export function constantTimeEquals(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}
