/**
 * Content hashing over canonical JSON.
 *
 * Proposal hashes, idempotency fingerprints and audit request fingerprints
 * are all taken here, so they all inherit the same two properties: key
 * order cannot change the digest, and the digest is over a value that was
 * already proved to be JSON.
 *
 * `node:crypto` is the only host API this package uses. The MCP server is a
 * Node process by construction - it speaks JSON-RPC over stdio - so this is
 * not a portability compromise the way it would be in a package the browser
 * bundles.
 */

import { createHash } from 'node:crypto';
import type { JsonValue } from '../schema/json-value';
import { canonicalJson } from '../schema/json-value';

/** A digest with its algorithm named, so replacing SHA-256 later is a visible prefix change rather than a silent one. */
export function contentDigest(value: JsonValue): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

/**
 * A short digest for identifiers that must be stable for the same input.
 *
 * 16 hex characters is 64 bits. That is not a collision-resistance claim -
 * these identifiers are scoped to one grant and one project, and every
 * consumer of one also checks the full record it names.
 */
export function shortDigest(value: JsonValue, length = 16): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex').slice(0, length);
}
